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
/**
 * Enough of a connection string's shape to tell a wrong URL from a bad password,
 * with nothing that could authenticate anyone. The first 11 characters are the
 * scheme, which is the point when the wrong URL has been pasted entirely.
 */
function fingerprint(raw: string | undefined) {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return {
      protocol: u.protocol.replace(":", ""),
      port: u.port || null,
      hostSuffix: u.hostname.split(".").slice(-3).join("."),
      hasUser: Boolean(u.username),
      hasPassword: Boolean(u.password),
      pgbouncer: u.searchParams.get("pgbouncer"),
      length: raw.length,
    };
  } catch {
    return { unparseable: true, startsWith: raw.slice(0, 11), length: raw.length };
  }
}

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
  let dbErrorCode: string | null = null;
  let dbCause: string | null = null;
  let dbMessage: string | null = null;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "up";
  } catch (err) {
    dbError = err instanceof Error ? err.constructor.name : "UnknownError";
    const code = (err as { errorCode?: string }).errorCode;
    dbErrorCode = typeof code === "string" ? code : null;
    // Classify from the message without echoing it: Prisma embeds the
    // connection string, and P1001's text carries the host.
    const msg = err instanceof Error ? err.message : "";
    // Prisma's message is the only thing that names the real failure, but it can
    // embed the connection string. Strip URL credentials, then cap it.
    dbMessage = msg
      .replace(/\/\/[^@\s]*@/g, "//[redacted]@")
      .replace(/\s+/g, " ")
      .slice(0, 300);
    dbCause = /query engine|libquery|binaryTarget|not found.*engine/i.test(msg)
      ? "prisma-client-not-generated-for-this-runtime"
      : /can.t reach database|P1001|timed out|ECONNREFUSED|ENOTFOUND/i.test(msg)
        ? "database-unreachable"
        : /authentication failed|P1000|password/i.test(msg)
          ? "bad-credentials"
          : /must start with the protocol|invalid.*url|provided database string|error validating datasource|invalid port/i.test(msg)
            ? "malformed-connection-string"
            : /tenant or user not found/i.test(msg)
              ? "wrong-project-ref"
              : "unclassified";
  }

  return NextResponse.json(
    {
      ok: db === "up" && missing.length === 0 && quoted.length === 0,
      db,
      dbError,
      dbErrorCode,
      dbCause,
      dbMessage,
      missing,
      quoted,
      databaseUrl: fingerprint(process.env.DATABASE_URL),
      directUrl: fingerprint(process.env.DIRECT_URL),
      // Non-secret by definition; both are wrong often enough to be worth showing.
      nextAuthUrl: process.env.NEXTAUTH_URL ?? null,
      apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? null,
    },
    { status: 200 },
  );
}
