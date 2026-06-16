import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from './auth-user';
import { AuthedRequest } from './jwt-auth.guard';

// Injects the authenticated principal resolved by JwtAuthGuard.
// Usage: someHandler(@CurrentUser() user: AuthUser) { ... }
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user) {
      // Should never happen when the route is protected by JwtAuthGuard.
      throw new Error('CurrentUser used on an unguarded route');
    }
    return req.user;
  },
);
