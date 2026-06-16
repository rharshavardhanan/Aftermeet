import "server-only";
import jwt from "jsonwebtoken";
import { auth } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4001";

/**
 * Server-side authenticated call to the NestJS backend. Mints a short-lived app
 * JWT from the current NextAuth session (same shared API_JWT_SECRET the backend
 * verifies) and attaches it as a bearer. For React Server Components.
 */
export async function serverApi<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const secret = process.env.API_JWT_SECRET;
  if (!secret) throw new Error("API_JWT_SECRET is not configured");

  const token = jwt.sign(
    { sub: session.user.id, email: session.user.email ?? null },
    secret,
    { algorithm: "HS256", expiresIn: "5m" },
  );

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return (await res.json()) as T;
}
