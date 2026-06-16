import { test } from "node:test";
import assert from "node:assert/strict";
import { apiUrl, getHealth, backendFetch } from "../api-client";

test("apiUrl joins base and path without double slashes", () => {
  assert.equal(
    apiUrl("/health", "http://localhost:4001"),
    "http://localhost:4001/health",
  );
  assert.equal(
    apiUrl("health", "http://localhost:4001/"),
    "http://localhost:4001/health",
  );
});

test("getHealth parses the backend health payload", async () => {
  const fakeFetch = async () =>
    new Response(JSON.stringify({ status: "ok", db: "up" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  const result = await getHealth("http://localhost:4001", fakeFetch);
  assert.deepEqual(result, { status: "ok", db: "up" });
});

test("backendFetch attaches a bearer token from /api/token", async () => {
  const seen: { url: string; auth: string | null }[] = [];
  const fakeFetch = async (url: string, init?: RequestInit) => {
    if (url.endsWith("/api/token")) {
      return new Response(JSON.stringify({ token: "abc123" }), { status: 200 });
    }
    const headers = new Headers(init?.headers);
    seen.push({ url, auth: headers.get("authorization") });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  await backendFetch("/me", {}, "http://localhost:4001", fakeFetch);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, "http://localhost:4001/me");
  assert.equal(seen[0].auth, "Bearer abc123");
});
