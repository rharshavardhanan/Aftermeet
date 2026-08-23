// Identity resolved from the verified token. Controllers load full records
// from Prisma when they need more than id/email.
export interface AuthUser {
  id: string;
  email: string | null;
}

// The signed app JWT the frontend mints from the NextAuth session.
export interface AppJwtPayload {
  sub: string;
  email?: string | null;
}
