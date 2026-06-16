import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user';
import { ExtensionService } from './extension.service';
import { ExtProcessDto, ExtSessionDto } from './dto/extension.dto';

@Controller('extension')
@UseGuards(JwtAuthGuard)
export class ExtensionController {
  constructor(private readonly extension: ExtensionService) {}

  @Post('process')
  process(@CurrentUser() user: AuthUser, @Body() dto: ExtProcessDto) {
    return this.extension.process(user.id, dto.transcript, dto.platform);
  }

  @Post('session')
  postSession(@CurrentUser() user: AuthUser, @Body() dto: ExtSessionDto) {
    return this.extension.session(user.id, dto);
  }

  @Get('session')
  getSession(@CurrentUser() user: AuthUser) {
    return this.extension.status(user.id);
  }
}
