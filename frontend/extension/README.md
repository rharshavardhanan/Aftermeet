# Aftermeet — Chrome Extension (MV3)

Live AI notes inside Zoom & Google Meet. Detects the call, captures tab audio,
shows a live transcript, and turns the meeting into tasks + minutes synced to
your workspace.

## Architecture

| File | Role |
|------|------|
| `manifest.json` | MV3 manifest. `tabCapture`, `offscreen`, content scripts for Meet/Zoom. |
| `background.js` | Service worker. Gets the tabCapture stream id and coordinates the offscreen recorder; relays events. |
| `offscreen.html/js` | Hidden document that runs `MediaRecorder` on the captured tab stream (MV3 can't record in the worker). |
| `content.js` | Injects the floating panel, drives start/stop, runs Web Speech API for instant live transcript. |
| `panel.css` | Compact dark panel styling. |
| `popup.html/js` | Toolbar popup: meeting status, backend URL, and the pasted token. |

## Capture pipeline

1. User clicks **Start AI Notes** in the panel (`content.js`).
2. `content.js` → `background.js` `start` → `chrome.tabCapture.getMediaStreamId`.
3. Stream id handed to `offscreen.js`, which records via `MediaRecorder` and keeps the tab audible.
4. The Web Speech API gives an instant on-screen transcript while recording.
5. On **Stop**, offscreen assembles a WebM blob → `content.js` → `POST {apiBase}/transcribe`, which chunks it with ffmpeg and runs Groq Whisper per chunk.
6. Transcript → `POST {apiBase}/extension/process` → extraction engine → tasks render in the panel, full minutes in the web app.

## Auth

Bearer token, not cookies. Sign in at `appOrigin/extension/connect`, copy the
short-lived token it mints, and paste it into the popup. `content.js` sends it
as `Authorization: Bearer …` to the NestJS backend, which allows
`meet.google.com` and `*.zoom.us` by CORS pattern.

## Load it (development)

1. Run both halves: the backend on `:4001` and the web app on `:4000`. Sign in.
2. Visit `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select this `extension/` folder.
4. Open a Google Meet or Zoom call — the panel appears bottom-right.

## Production notes

- Point `appOrigin` (Vercel URL) and `apiBase` (Render URL) at production in the popup, and add both to `host_permissions`.
- Replace `icons/*.png` with brand assets before publishing to the Web Store.
