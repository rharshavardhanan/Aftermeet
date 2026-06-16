import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExtractionService } from '../ai/extraction.service';
import { mockExtract } from '../ai/mock';
import { isAiConfigured, isQuotaError } from '../ai/providers';
import { Extraction } from '../ai/schema';
import { ProcessMeetingDto } from './dto/process-meeting.dto';

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly extraction: ExtractionService,
  ) {}

  // List the user's meetings, newest first, with a task count for the cards.
  list(userId: string) {
    return this.prisma.meeting.findMany({
      where: { userId },
      orderBy: { meetingDate: 'desc' },
      select: {
        id: true,
        title: true,
        source: true,
        status: true,
        meetingDate: true,
        createdAt: true,
        participants: true,
        _count: { select: { tasks: true } },
      },
    });
  }

  // Full meeting detail (transcript + AI output + tasks), scoped to owner.
  async get(id: string, userId: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, userId },
      include: {
        transcript: true,
        aiOutput: true,
        tasks: { orderBy: { urgency: 'desc' } },
      },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting;
  }

  async remove(id: string, userId: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');
    await this.prisma.meeting.delete({ where: { id } });
    return { ok: true };
  }

  // The core flow: transcript -> AI engine -> persist meeting/transcript/output/
  // tasks atomically, enforcing the free-plan limit. Ported from the monolith
  // server action processMeeting.
  async process(
    userId: string,
    dto: ProcessMeetingDto,
  ): Promise<{ meetingId: string }> {
    const membership = await this.prisma.membership.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { workspace: { include: { billing: true } } },
    });
    const workspace = membership?.workspace;
    if (!workspace) throw new BadRequestException('No workspace found.');

    const billing = workspace.billing;
    if (
      billing &&
      billing.plan === 'FREE' &&
      billing.meetingsUsed >= billing.meetingsLimit
    ) {
      throw new ForbiddenException(
        "You've reached your free plan limit. Upgrade to Pro for unlimited meetings.",
      );
    }

    const source = dto.source ?? 'PASTE';
    const participants = dto.participants ?? [];
    const meetingDate = new Date();
    const pref = await this.prisma.userPreference.findUnique({
      where: { userId },
      select: { priority: true },
    });

    let extraction: Extraction;
    let model = 'demo';
    let tokensUsed = 0;
    try {
      if (isAiConfigured()) {
        const res = await this.extraction.extract({
          transcript: dto.transcript,
          meetingDate: meetingDate.toISOString().slice(0, 10),
          knownParticipants: participants,
          priority: pref?.priority,
        });
        extraction = res.data;
        model = res.model;
        tokensUsed = res.tokensUsed;
      } else {
        extraction = mockExtract(dto.transcript, meetingDate);
      }
    } catch (err) {
      throw this.translateAiError(err);
    }

    const title = dto.title?.trim() || extraction.title || 'Untitled meeting';

    const meeting = await this.prisma.$transaction(async (tx) => {
      const m = await tx.meeting.create({
        data: {
          workspaceId: workspace.id,
          userId,
          title,
          source,
          status: 'COMPLETED',
          meetingDate,
          participants: extraction.participants,
          transcript: {
            create: {
              rawText: dto.transcript,
              wordCount: dto.transcript.split(/\s+/).filter(Boolean).length,
            },
          },
          aiOutput: {
            create: {
              model,
              summary: extraction.summary,
              decisions: extraction.decisions as unknown as Prisma.InputJsonValue,
              risks: extraction.risks as unknown as Prisma.InputJsonValue,
              deadlines: extraction.deadlines as unknown as Prisma.InputJsonValue,
              followupEmail: extraction.followupEmail,
              mom: extraction.mom as unknown as Prisma.InputJsonValue,
              tokensUsed,
            },
          },
        },
      });

      if (extraction.actionItems.length) {
        await tx.task.createMany({
          data: extraction.actionItems.map((t) => ({
            meetingId: m.id,
            userId,
            title: t.title,
            assignee: t.assignee,
            dueDate: t.dueDate ? safeDate(t.dueDate) : null,
            urgency: t.urgency,
            confidence: t.confidence,
            sourceQuote: t.sourceQuote,
          })),
        });
      }

      if (billing) {
        await tx.billing.update({
          where: { id: billing.id },
          data: { meetingsUsed: { increment: 1 } },
        });
      }

      await tx.activityLog.create({
        data: {
          userId,
          action: 'meeting.processed',
          meta: { meetingId: m.id, tasks: extraction.actionItems.length, model },
        },
      });

      return m;
    });

    return { meetingId: meeting.id };
  }

  // Map provider failures to friendly HTTP errors (ported from the monolith).
  private translateAiError(err: unknown): HttpException {
    const msg = err instanceof Error ? err.message : String(err ?? '');
    if (isQuotaError(err)) {
      return new HttpException(
        'AI quota exceeded — your Gemini key has no free-tier quota. Enable billing on its Google Cloud project, or make sure GROQ_API_KEY is also set as a fallback.',
        429,
      );
    }
    if (
      /PERMISSION_DENIED|location is not supported|not available in your (country|region)|SERVICE_DISABLED/i.test(
        msg,
      )
    ) {
      return new BadRequestException(
        'Gemini is not available in your region. The app will use Groq — make sure GROQ_API_KEY is set.',
      );
    }
    if (/API.?key.*(not valid|invalid)|invalid.?API.?key/i.test(msg)) {
      return new BadRequestException(
        'Your Gemini API key is invalid. Check GEMINI_API_KEY in your environment.',
      );
    }
    return new InternalServerErrorException(
      'AI analysis failed. Please try again in a moment.',
    );
  }
}

function safeDate(s: string): Date | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
