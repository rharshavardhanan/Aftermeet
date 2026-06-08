// Shared config for the extension. Point APP_ORIGIN at your deployment.
export const APP_ORIGIN = "http://localhost:4000";
export const API = {
  transcribe: `${APP_ORIGIN}/api/transcribe`,
  process: `${APP_ORIGIN}/api/extension/process`,
  session: `${APP_ORIGIN}/api/extension/session`,
};

// Auth strategy: the extension reuses the web app's NextAuth session cookie.
// Because requests to APP_ORIGIN are same-origin to the cookie, `credentials:
// "include"` carries the session. The user signs in once in the web app; the
// extension piggybacks on that session. No separate token store required.
export const FETCH_OPTS = { credentials: "include" };
