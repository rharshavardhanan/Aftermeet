import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MeetingsModule } from './meetings/meetings.module';
import { TasksModule } from './tasks/tasks.module';
import { TranscriptionModule } from './transcription/transcription.module';
import { ExtensionModule } from './extension/extension.module';
import { BillingModule } from './billing/billing.module';
import { GoogleModule } from './google/google.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    HealthModule,
    UsersModule,
    MeetingsModule,
    TasksModule,
    TranscriptionModule,
    ExtensionModule,
    BillingModule,
    GoogleModule,
  ],
})
export class AppModule {}
