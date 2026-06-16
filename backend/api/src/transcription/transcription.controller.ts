import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TranscriptionService } from './transcription.service';
import { LANGUAGES } from './languages';

@Controller()
@UseGuards(JwtAuthGuard)
export class TranscriptionController {
  constructor(private readonly transcription: TranscriptionService) {}

  // Supported languages for the client picker (code, label, whisper-tier).
  @Get('languages')
  languages() {
    return LANGUAGES.map(({ code, label, whisper }) => ({ code, label, whisper }));
  }

  // Audio in -> raw STT (two-tier) -> refined transcript out.
  @Post('transcribe')
  @UseInterceptors(
    FileInterceptor('audio', { limits: { fileSize: 25 * 1024 * 1024 } }),
  )
  async transcribe(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('language') language?: string,
  ) {
    if (!file) throw new BadRequestException('No audio file provided.');
    const lang = language && language.trim() ? language.trim() : undefined;
    const raw = await this.transcription.transcribe(file, lang);
    const refined = await this.transcription.refine(raw.text, raw.language ?? lang);
    return { text: refined, language: raw.language ?? lang ?? null };
  }
}
