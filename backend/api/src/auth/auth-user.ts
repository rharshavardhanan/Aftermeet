// The authenticated principal attached to each request by JwtAuthGuard and
// surfaced to controllers via @CurrentUser(). Kept tiny on purpose — the guard
// resolves identity from the verified token; controllers load full records from
// Prisma when they need more than id/email.
export interface AuthUser {
  id: string;
  email: string | null;
}

// Shape of the signed app JWT the frontend mints from the NextAuth session.
export interface AppJwtPayload {
  sub: string;
  email?: string | null;
}
