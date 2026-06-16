import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MeetingsService } from '../meetings/meetings.service';
import { ExtSessionDto } from './dto/extension.dto';

const FRESH_MS = 2 * 60 * 1000; // a session is "connected" if touched < 2 min ago

@Injectable()
export class ExtensionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly meetings: MeetingsService,
  ) {}

  // Transcript from a live call -> full AI pipeline -> tasks for the panel.
  async process(userId: string, transcript: string, platform?: string) {
    const { meetingId } = await this.meetings.process(userId, {
      transcript,
      title: platform ? `${platform} call` : undefined,
      source: 'EXTENSION',
    });
    const tasks = await this.prisma.task.findMany({
      where: { meetingId },
      select: { title: true, assignee: true, dueDate: true, urgency: true },
      orderBy: { urgency: 'desc' },
    });
    return {
      meetingId,
      tasks: tasks.map((t) => ({
        title: t.title,
        assignee: t.assignee,
        dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
        urgency: t.urgency,
      })),
    };
  }

  async session(userId: string, dto: ExtSessionDto) {
    const action = dto.action ?? 'start';
    const platform = ['zoom', 'meet', 'teams'].includes(dto.platform ?? '')
      ? dto.platform!
      : 'meet';

    if (action === 'end') {
      await this.prisma.extensionSession.updateMany({
        where: { userId, status: 'active' },
        data: { status: 'ended', endedAt: new Date() },
      });
      return { ok: true, connected: false };
    }

    const existing = await this.prisma.extensionSession.findFirst({
      where: { userId, status: 'active' },
      orderBy: { startedAt: 'desc' },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.extensionSession.update({
        where: { id: existing.id },
        data: {
          platform,
          tabUrl: dto.tabUrl ?? undefined,
          meetingId: dto.meetingId ?? undefined,
          startedAt: new Date(),
        },
      });
    } else {
      await this.prisma.extensionSession.create({
        data: {
          userId,
          platform,
          tabUrl: dto.tabUrl,
          meetingId: dto.meetingId,
          status: 'active',
        },
      });
    }
    return { ok: true, connected: true };
  }

  async status(userId: string) {
    const latest = await this.prisma.extensionSession.findFirst({
      where: { userId, status: 'active' },
      orderBy: { startedAt: 'desc' },
      select: { id: true, platform: true, tabUrl: true, startedAt: true, meetingId: true },
    });
    const connected =
      !!latest && Date.now() - latest.startedAt.getTime() < FRESH_MS;
    return { connected, session: connected ? latest : null };
  }
}
