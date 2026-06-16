import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TaskStatus, TaskUrgency } from '@prisma/client';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(280)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  assignee?: string | null;

  // ISO date string or null to clear. Validated as a date when present.
  @IsOptional()
  @IsISO8601()
  dueDate?: string | null;

  @IsOptional()
  @IsEnum(TaskUrgency)
  urgency?: TaskUrgency;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}

export class SetDoneDto {
  @IsBoolean()
  done!: boolean;
}
