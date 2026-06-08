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
| `popup.html/js` | Toolbar popup with meeting status + links. |
| `config.js` | `APP_ORIGIN` + API endpoints. |

## Capture pipeline

1. User clicks **Start AI Notes** in the panel (`content.js`).
2. `content.js` → `background.js` `start` → `chrome.tabCapture.getMediaStreamId`.
3. Stream id handed to `offscreen.js`, which records via `MediaRecorder` and keeps the tab audible.
4. The Web Speech API gives an instant on-screen transcript while recording.
5. On **Stop**, offscreen assembles a WebM blob → `content.js` → `POST /api/transcribe` (Whisper) for an accurate transcript.
6. Transcript → `POST /api/extension/process` → extraction engine → tasks render in the panel, full minutes in the web app.

## Auth

The extension reuses the web app's NextAuth session. Sign in once at
`APP_ORIGIN/login`; requests use `credentials: "include"` and the server route
sets credentialed CORS for `meet.google.com` / `*.zoom.us`.

## Load it (development)

1. Run the web app (`npm run dev`) so `APP_ORIGIN` (default `http://localhost:4000`) is live, and sign in.
2. Visit `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select this `extension/` folder.
4. Open a Google Meet or Zoom call — the panel appears bottom-right.

## Production notes

- Set `APP_ORIGIN` in `config.js` and `content.js`/`popup.js` to your deployed URL, and add it to `host_permissions`.
- For true real-time tasks, replace the accumulate-then-send step in `offscreen.js` with chunked streaming to a realtime ASR endpoint; the rest of the pipeline is unchanged.
- Replace `icons/*.png` with brand assets before publishing to the Web Store.
