# Sign-in loop + make the extension actually capture

Date: 2026-09-28
Status: in progress

## Context

Three reported failures after the Render/Vercel deploy went live:

1. Google sign-in bounces straight back to `/login`.
2. "Load unpacked" fails in Chrome.
3. The extension never actually listens to a meeting.

Investigation found (2) is not reproducible from the repo — `manifest.json` is
valid JSON, every file it references exists, the icons are real PNGs, and all
four scripts pass `node --check`. Needs the literal Chrome error. Nothing in
`manifest.json` referenced the `config.js` that was deleted earlier, so that
removal is not the cause.

(3) has a definite root cause, below. (1) has a plausible one plus a
resilience gap worth closing either way.

### The extension has never been able to capture — structural, not config

`content.js` renders a "Start AI Notes" button inside the injected panel. It
messages the service worker, which calls
`chrome.tabCapture.getMediaStreamId({ targetTabId })`.

Chrome only permits `tabCapture` after the extension has been **invoked** on
that tab — an action-icon click, keyboard shortcut, or context-menu entry. A
button inside a content script is not an invocation, so `getMediaStreamId`
rejects with *"Extension has not been invoked for the current page"* and capture
never starts. No amount of configuration fixes this; the trigger is in the wrong
context.

### The upload path would break on any real meeting

`offscreen.js` ships recorded audio to the service worker as
`Array.from(new Uint8Array(buf))` — a JSON array with one element per byte. A
30-minute Opus recording is roughly 7 MB, so ~7 million array elements through
`chrome.runtime.sendMessage`. That is slow enough to hang the worker and large
enough to fail outright.

It also makes the upload fragile for a second reason: `content.js` does the
`fetch` to the backend, so it runs with `meet.google.com` as its origin and is
subject to CORS. Doing the same fetch from the extension's own context uses the
manifest's `host_permissions` and bypasses CORS entirely.

### Sign-in: the resilience gap

`lib/auth.ts` provisions a workspace, membership, billing row and preference
inside `events.createUser`, in one interactive `$transaction`. If that
transaction throws for any reason, the OAuth callback errors and NextAuth
redirects back to `/login` — which is exactly the reported symptom, and it would
fail identically on every attempt.

Whether that is *the* cause here is unconfirmed: the decisive evidence is the
`?error=` code NextAuth appends to the bounce URL, which only the operator can
read. Regardless, first-run provisioning should not be able to lock a user out
permanently, so Task 1 removes that failure mode on its own merits.

## Tasks

### Task 1 — A failed first-run provision cannot block sign-in

- **Goal**: Signing in succeeds even if workspace provisioning fails, and the
  workspace is created on first use instead.
- **Why**: Today a single throw inside `events.createUser` makes the account
  permanently unable to log in, with no error surfaced to the user. That is
  true whatever is causing the current loop.
- **Files**: `frontend/web/lib/auth.ts`.
- **Steps**:
  1. Wrap the `createUser` transaction so a failure is logged, not thrown.
  2. Make `getCurrentWorkspace` provision the personal workspace when absent,
     idempotently (`findFirst` then create, tolerating a unique-slug clash).
  3. Keep the eager path — it stays the fast case; the lazy path is the net.
- **Done when**: `npx tsc --noEmit` passes, and a unit test proves
  `getCurrentWorkspace` returns a workspace for a user that has none.

### Task 2 — Capture starts from the popup, so Chrome permits it

- **Goal**: Clicking Start in the extension popup begins recording tab audio on
  the active meeting tab.
- **Why**: This is the actual reason the extension never listens. The
  invocation requirement means the trigger must live in the popup.
- **Files**: `frontend/extension/popup.html`, `popup.js`, `background.js`,
  `content.js`.
- **Steps**:
  1. Add a Start/Stop control to `popup.html`, enabled only on a meeting tab.
  2. In `popup.js`, call `chrome.tabCapture.getMediaStreamId({ targetTabId })`
     directly — the popup being open *is* the invocation — and pass the id to
     the worker.
  3. `background.js` accepts a `streamId` rather than deriving one, keeping
     offscreen creation as-is.
  4. `content.js` keeps the panel for live transcript and tasks; its button
     now tells the user to start from the toolbar rather than failing silently.
- **Done when**: `node --check` passes on every extension script, and loading
  unpacked then clicking Start on a Meet tab produces a recording (verified by
  the panel leaving "Waiting to start…").

### Task 3 — Upload the recording from the extension, not the page

- **Goal**: Audio goes straight from the offscreen document to the backend.
- **Why**: Removes the multi-million-element message that would fail on any
  real meeting, and drops the content script's CORS dependency since extension
  contexts use `host_permissions`.
- **Files**: `frontend/extension/offscreen.js`, `background.js`, `content.js`.
- **Steps**:
  1. `offscreen.js` reads `apiBase`/`token` from `chrome.storage.local` and
     POSTs the `Blob` directly as `multipart/form-data`.
  2. It posts the resulting transcript text back — a string, not bytes.
  3. `content.js` keeps handling extraction and rendering from that text.
- **Done when**: no `Array.from(new Uint8Array` remains in the extension, and
  `node --check` passes on every script.

### Task 4 — Confirm what "load unpacked" actually reports

- **Goal**: Know the real failure instead of guessing.
- **Why**: Everything checkable in the repo is already valid, so the cause is
  environmental — wrong folder, Chrome version below the manifest's
  `minimum_chrome_version: 116`, or a stale cached load.
- **Done when**: the operator reports the literal error text from
  `chrome://extensions`.

## Out of scope

- Real-time streaming ASR. The accumulate-then-upload design stays; only the
  transport changes.
- Publishing to the Chrome Web Store.
