// Offscreen document: records the captured tab stream, then uploads it.
//
// The upload happens here rather than in the content script for two reasons.
// Passing the audio to another context meant serialising it a byte per array
// element, which a half-hour recording turns into millions of entries. And a
// fetch from here runs in the extension's own context, so host_permissions
// apply and CORS never enters into it.

let recorder = null;
let chunks = [];
let audioCtx = null;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target !== "offscreen") return;
  if (msg.type === "start-recording") start(msg.streamId);
  if (msg.type === "stop-recording") stop();
});

function report(type, payload) {
  chrome.runtime.sendMessage({ target: "background", type, ...payload });
}

async function start(streamId) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      },
    });

    // Keep the tab audible to the user while we tap it.
    audioCtx = new AudioContext();
    audioCtx.createMediaStreamSource(stream).connect(audioCtx.destination);

    chunks = [];
    recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      audioCtx?.close();
      const blob = new Blob(chunks, { type: "audio/webm" });
      chunks = [];
      await upload(blob);
    };
    recorder.start(4000); // flush every 4s so nothing is held in one buffer
  } catch (err) {
    report("recording-error", { error: String(err?.message ?? err) });
  }
}

function stop() {
  if (recorder && recorder.state !== "inactive") recorder.stop();
  recorder = null;
}

async function upload(blob) {
  if (blob.size < 1024) {
    report("recording-error", { error: "Nothing was recorded — no audio on that tab." });
    return;
  }
  const cfg = await chrome.storage.local.get({ apiBase: "", token: "" });
  if (!cfg.token) {
    report("recording-error", { error: "Not connected. Paste a token in the popup." });
    return;
  }

  try {
    const form = new FormData();
    form.append("audio", new File([blob], "call.webm", { type: "audio/webm" }));
    const res = await fetch(`${cfg.apiBase}/transcribe`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}` },
      body: form,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.text) {
      report("recording-error", {
        error: json.error ?? json.message ?? "Couldn't transcribe the recording.",
      });
      return;
    }
    report("transcript-ready", { text: json.text });
  } catch (err) {
    report("recording-error", { error: String(err?.message ?? err) });
  }
}
