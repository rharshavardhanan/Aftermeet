// Minimal typed client for the NestJS backend. Phase 0 only exposes the health
// check; later phases add authenticated resource calls. Reads the base URL from
// NEXT_PUBLIC_API_BASE_URL so it works in both browser and server contexts.

export interface HealthResponse {
  status: "ok";
  db: "up" | "down";
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const DEFAULT_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4001";

/** Join a base origin and a path with exactly one slash between them. */
export function apiUrl(path: string, base: string = DEFAULT_BASE): string {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

/** Fetch the backend health status. `base`/`fetchImpl` are injectable for tests. */
export async function getHealth(
  base: string = DEFAULT_BASE,
  fetchImpl: FetchLike = fetch,
): Promise<HealthResponse> {
  const res = await fetchImpl(apiUrl("/health", base));
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return (await res.json()) as HealthResponse;
}
