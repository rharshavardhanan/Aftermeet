import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user';
import { MeetingsService } from './meetings.service';
import { ProcessMeetingDto } from './dto/process-meeting.dto';

@Controller('meetings')
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.meetings.list(user.id);
  }

  // Transcript in -> AI analysis -> persisted meeting + tasks.
  @Post()
  process(@CurrentUser() user: AuthUser, @Body() dto: ProcessMeetingDto) {
    return this.meetings.process(user.id, dto);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.meetings.get(id, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.meetings.remove(id, user.id);
  }
}
