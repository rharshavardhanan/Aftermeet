import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class ExtProcessDto {
  @IsString()
  @MinLength(12, { message: 'Transcript is too short to analyze.' })
  transcript!: string;

  @IsOptional()
  @IsString()
  platform?: string;
}

export class ExtSessionDto {
  @IsOptional()
  @IsIn(['start', 'heartbeat', 'end'])
  action?: 'start' | 'heartbeat' | 'end';

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  tabUrl?: string;

  @IsOptional()
  @IsString()
  meetingId?: string;
}
