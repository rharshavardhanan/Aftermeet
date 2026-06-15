import { test } from "node:test";
import assert from "node:assert/strict";
import { apiUrl, getHealth } from "../api-client";

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
