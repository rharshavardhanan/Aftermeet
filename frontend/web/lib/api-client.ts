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

/** Get a short-lived backend bearer token from the same-origin /api/token route. */
export async function getApiToken(fetchImpl: FetchLike = fetch): Promise<string> {
  const res = await fetchImpl("/api/token");
  if (!res.ok) throw new Error("Not authenticated");
  const json = (await res.json()) as { token: string };
  return json.token;
}

/**
 * Call the standalone backend with a bearer token attached. Browser-side helper:
 * fetches a token from /api/token, then calls the NestJS API. `base`/`fetchImpl`
 * are injectable for tests.
 */
export async function backendFetch(
  path: string,
  init: RequestInit = {},
  base: string = DEFAULT_BASE,
  fetchImpl: FetchLike = fetch,
): Promise<Response> {
  const token = await getApiToken(fetchImpl);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetchImpl(apiUrl(path, base), { ...init, headers });
}

export interface MeResponse {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  onboardingCompleted: boolean;
}

/** Fetch the signed-in user's profile from the backend. */
export async function getMe(
  base: string = DEFAULT_BASE,
  fetchImpl: FetchLike = fetch,
): Promise<MeResponse> {
  const res = await backendFetch("/me", {}, base, fetchImpl);
  if (!res.ok) throw new Error(`/me failed: ${res.status}`);
  return (await res.json()) as MeResponse;
}
