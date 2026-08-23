import "server-only";
import jwt from "jsonwebtoken";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4001";

/**
 * The React Server Component counterpart to `backendFetch`: signs a short-lived
 * JWT straight from the NextAuth session rather than round-tripping /api/token.
 */
export async function serverApi<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
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
