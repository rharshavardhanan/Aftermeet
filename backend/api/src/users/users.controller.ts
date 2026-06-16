import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user';
import { UsersService } from './users.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // Returns the signed-in user's profile — proves the full auth chain
  // (frontend-minted JWT -> guard -> Prisma).
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.profile(user.id);
  }
}
