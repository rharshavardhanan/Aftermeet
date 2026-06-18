import { Module } from '@nestjs/common';
import { TranscriptionController } from './transcription.controller';
import { TranscriptionService } from './transcription.service';
import { AudioChunkingService } from './audio-chunking.service';

@Module({
  controllers: [TranscriptionController],
  providers: [TranscriptionService, AudioChunkingService],
})
export class TranscriptionModule {}
