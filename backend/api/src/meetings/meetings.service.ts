import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MeetingsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
