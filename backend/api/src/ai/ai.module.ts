import { Module } from '@nestjs/common';
import { ExtractionService } from './extraction.service';

@Module({
  providers: [ExtractionService],
  exports: [ExtractionService],
})
export class AiModule {}
