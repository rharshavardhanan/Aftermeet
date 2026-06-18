import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TranscriptionService } from './transcription.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class TranscriptionController {
  constructor(private readonly transcription: TranscriptionService) {}

  // Audio in -> ffmpeg chunking -> per-chunk auto code-switch transcription
  // -> stitch -> refine. Fully automatic: detects & preserves every language.
  // Large uploads are streamed to disk (not RAM) and removed afterwards.
  @Post('transcribe')
  @UseInterceptors(
    FileInterceptor('audio', {
      storage: diskStorage({ destination: os.tmpdir() }),
      limits: { fileSize: 200 * 1024 * 1024 },
    }),
  )
  async transcribe(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('No audio file provided.');
    try {
      const result = await this.transcription.transcribe(file.path, file.mimetype);
      return { text: result.text, language: result.language };
    } finally {
      await fs.rm(file.path, { force: true }).catch(() => undefined);
    }
  }
}
