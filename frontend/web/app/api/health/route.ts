import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Which values must be present for the app to function at all.
const REQUIRED = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXTAUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "API_JWT_SECRET",
  "NEXT_PUBLIC_API_BASE_URL",
] as const;

/**
 * Deployment self-check. Answers "is this instance configured and can it reach
 * its database" without a login, because every failure that needs answering
 * sits behind one.
 *
 * Reports presence, never values — a leaked DATABASE_URL carries the database
 * password. The Prisma failure is reported by error class only, since its
 * message embeds the connection string.
 */
export async function GET() {
  const missing = REQUIRED.filter((k) => !process.env[k]);

  // Pasting a .env line into a dashboard field keeps the quotes, because only
  // a .env parser strips them. It is the single most common deploy mistake and
  // it fails silently everywhere downstream.
  const quoted = REQUIRED.filter((k) => {
    const v = process.env[k];
    return v ? /^["']|["']$/.test(v) : false;
  });

  let db: "up" | "down" = "down";
  let dbError: string | null = null;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "up";
  } catch (err) {
    dbError = err instanceof Error ? err.constructor.name : "UnknownError";
  }

  return NextResponse.json(
    {
      ok: db === "up" && missing.length === 0 && quoted.length === 0,
      db,
      dbError,
      missing,
      quoted,
      // Non-secret by definition; both are wrong often enough to be worth showing.
      nextAuthUrl: process.env.NEXTAUTH_URL ?? null,
      apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? null,
    },
    { status: 200 },
  );
}
