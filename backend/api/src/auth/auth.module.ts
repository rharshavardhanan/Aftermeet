import { Global, Module } from '@nestjs/common';
import { TokenService } from './token.service';
import { JwtAuthGuard } from './jwt-auth.guard';

// Global so any module can protect routes with JwtAuthGuard without re-importing.
@Global()
@Module({
  providers: [TokenService, JwtAuthGuard],
  exports: [TokenService, JwtAuthGuard],
})
export class AuthModule {}
