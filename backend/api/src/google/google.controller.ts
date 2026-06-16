import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user';
import { GoogleService } from './google.service';
import { ExportDocDto } from './dto/export-doc.dto';

@Controller('google')
@UseGuards(JwtAuthGuard)
export class GoogleController {
  constructor(private readonly google: GoogleService) {}

  @Post('export-doc')
  exportDoc(@CurrentUser() user: AuthUser, @Body() dto: ExportDocDto) {
    return this.google.exportDoc(user.id, dto.meetingId);
  }
}
