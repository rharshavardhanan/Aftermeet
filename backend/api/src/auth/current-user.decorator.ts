import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from './auth-user';
import { AuthedRequest } from './jwt-auth.guard';

// Injects the principal resolved by JwtAuthGuard.
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
