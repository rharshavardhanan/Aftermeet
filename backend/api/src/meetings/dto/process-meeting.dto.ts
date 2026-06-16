import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MeetingSource } from '@prisma/client';

export class ProcessMeetingDto {
  @IsOptional()
  @IsString()
  @MaxLength(140)
  title?: string;

  @IsString()
  @MinLength(12, { message: 'Add a bit more transcript to analyze.' })
  transcript!: string;

  @IsOptional()
  @IsEnum(MeetingSource)
  source?: MeetingSource;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participants?: string[];
}
