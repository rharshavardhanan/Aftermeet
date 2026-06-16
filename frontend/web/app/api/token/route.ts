import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Mints a short-lived HS256 app JWT from the current NextAuth session, for the
 * standalone backend to verify (shared API_JWT_SECRET). This bridges the
 * existing Google login to the split backend: clients call this same-origin
 * route to obtain a bearer token, then call the NestJS API with it.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const secret = process.env.API_JWT_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "API_JWT_SECRET is not configured" },
      { status: 500 },
    );
  }
  const token = jwt.sign(
    { sub: session.user.id, email: session.user.email ?? null },
    secret,
    { algorithm: "HS256", expiresIn: "15m" },
  );
  return NextResponse.json({ token, expiresIn: 900 });
}
