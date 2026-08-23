import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isAiConfigured } from '../ai/providers';

export interface HealthStatus {
  status: 'ok';
  db: 'up' | 'down';
  ai: 'up' | 'down';
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  // Reports 'ok' even with a dead DB so the platform health check keeps the
  // instance alive during a Supabase cold start; the fields carry the detail.
  async check(): Promise<HealthStatus> {
    let db: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }
    return { status: 'ok', db, ai: isAiConfigured() ? 'up' : 'down' };
  }
}
