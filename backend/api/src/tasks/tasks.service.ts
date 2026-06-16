import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  // Open tasks across the user's meetings, most urgent first.
  list(userId: string) {
    return this.prisma.task.findMany({
      where: { userId, status: 'OPEN' },
      orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
      include: { meeting: { select: { id: true, title: true } } },
    });
  }

  private async assertOwned(id: string, userId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!task) throw new NotFoundException('Task not found');
  }

  async update(id: string, userId: string, dto: UpdateTaskDto) {
    await this.assertOwned(id, userId);
    return this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        assignee: dto.assignee,
        urgency: dto.urgency,
        status: dto.status,
        dueDate:
          dto.dueDate === undefined
            ? undefined
            : dto.dueDate
              ? new Date(dto.dueDate)
              : null,
      },
    });
  }

  async setDone(id: string, userId: string, done: boolean) {
    await this.assertOwned(id, userId);
    return this.prisma.task.update({
      where: { id },
      data: { status: done ? 'DONE' : 'OPEN' },
    });
  }

  async archive(id: string, userId: string) {
    await this.assertOwned(id, userId);
    return this.prisma.task.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }
}
