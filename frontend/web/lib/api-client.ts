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

// ── Domain write-path helpers (browser-side; backend is the source of truth) ──

export interface ProcessMeetingInput {
  title?: string;
  transcript: string;
  source?: "PASTE" | "UPLOAD" | "RECORDING" | "EXTENSION";
  participants?: string[];
}

/** Run a transcript through the backend AI pipeline; returns the new meeting id. */
export async function processMeetingViaApi(
  input: ProcessMeetingInput,
  base: string = DEFAULT_BASE,
  fetchImpl: FetchLike = fetch,
): Promise<{ meetingId: string }> {
  const res = await backendFetch(
    "/meetings",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    base,
    fetchImpl,
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Processing failed");
  return json as { meetingId: string };
}

/** Upload audio for transcription. `form` must carry `audio` (+ optional `language`). */
export async function transcribeViaApi(
  form: FormData,
  base: string = DEFAULT_BASE,
  fetchImpl: FetchLike = fetch,
): Promise<{ text: string; language: string | null }> {
  // Do NOT set Content-Type — the browser sets the multipart boundary.
  const res = await backendFetch("/transcribe", { method: "POST", body: form }, base, fetchImpl);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Transcription failed");
  return json as { text: string; language: string | null };
}

/** Mark a task done / not-done. */
export async function setTaskDoneViaApi(
  id: string,
  done: boolean,
  base: string = DEFAULT_BASE,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  const res = await backendFetch(
    `/tasks/${id}/done`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    },
    base,
    fetchImpl,
  );
  if (!res.ok) throw new Error("Update failed");
}

/** Start a Stripe Checkout session; returns the hosted checkout URL. */
export async function createCheckoutViaApi(
  base: string = DEFAULT_BASE,
  fetchImpl: FetchLike = fetch,
): Promise<{ url: string }> {
  const res = await backendFetch("/billing/checkout", { method: "POST" }, base, fetchImpl);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Could not start checkout");
  return json as { url: string };
}

/** Export a meeting's minutes to a Google Doc; returns the doc URL. */
export async function exportDocViaApi(
  meetingId: string,
  base: string = DEFAULT_BASE,
  fetchImpl: FetchLike = fetch,
): Promise<{ url?: string }> {
  const res = await backendFetch(
    "/google/export-doc",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId }),
    },
    base,
    fetchImpl,
  );
  const json = (await res.json().catch(() => ({}))) as { url?: string; message?: string; error?: string };
  if (!res.ok) throw new Error(json.message ?? json.error ?? "Couldn't export to Google Docs");
  return json;
}
