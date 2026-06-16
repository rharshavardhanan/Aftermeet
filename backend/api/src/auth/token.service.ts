import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AppJwtPayload, AuthUser } from './auth-user';

// Verifies the short-lived HS256 app JWT minted by the frontend's /api/token
// route (signed with the shared API_JWT_SECRET). This is the bridge from the
// existing NextAuth+Google login to the standalone backend; it can later be
// swapped for Supabase/JWKS verification without changing JwtAuthGuard.
@Injectable()
export class TokenService {
  private secret(): string {
    const secret = process.env.API_JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException('API_JWT_SECRET is not configured');
    }
    return secret;
  }

  verify(token: string): AuthUser {
    let payload: AppJwtPayload;
    try {
      payload = jwt.verify(token, this.secret(), {
        algorithms: ['HS256'],
      }) as AppJwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (!payload?.sub) {
      throw new UnauthorizedException('Token missing subject');
    }
    return { id: payload.sub, email: payload.email ?? null };
  }
}
