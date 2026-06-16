import { IsString } from 'class-validator';

export class ExportDocDto {
  @IsString()
  meetingId!: string;
}
