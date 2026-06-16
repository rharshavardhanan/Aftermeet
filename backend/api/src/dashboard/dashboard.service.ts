import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // Aggregates the dashboard view in one call (mirrors the monolith page).
  async summary(userId: string) {
    const [
      recentMeetings,
      openTasks,
      meetingsTotal,
      openCount,
      totalTasks,
      completedTasks,
      upcoming,
    ] = await Promise.all([
      this.prisma.meeting.findMany({
        where: { userId },
        orderBy: { meetingDate: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          meetingDate: true,
          source: true,
          _count: { select: { tasks: true } },
        },
      }),
      this.prisma.task.findMany({
        where: { userId, status: 'OPEN' },
        orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
        take: 6,
        include: { meeting: { select: { title: true } } },
      }),
      this.prisma.meeting.count({ where: { userId } }),
      this.prisma.task.count({ where: { userId, status: 'OPEN' } }),
      this.prisma.task.count({ where: { userId } }),
      this.prisma.task.count({ where: { userId, status: 'DONE' } }),
      this.prisma.task.findMany({
        where: { userId, status: 'OPEN', dueDate: { not: null } },
        orderBy: { dueDate: 'asc' },
        take: 4,
        include: { meeting: { select: { title: true } } },
      }),
    ]);

    const productivity =
      totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    return {
      stats: { meetingsTotal, openCount, completedTasks, productivity },
      openTasks,
      upcoming,
      recentMeetings,
    };
  }
}
