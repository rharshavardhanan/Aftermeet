const DEFAULTS = {
  appOrigin: "http://localhost:4000",
  apiBase: "http://localhost:4001",
  token: "",
};

const $ = (id) => document.getElementById(id);
const isMeeting = (url) => Boolean(url) && /meet\.google\.com|zoom\.us/.test(url);

let activeTab = null;
let recording = false;

function paint(cfg) {
  $("appOrigin").value = cfg.appOrigin;
  $("apiBase").value = cfg.apiBase;
  $("token").value = cfg.token;
  const connected = Boolean(cfg.token);
  $("conn").textContent = connected ? "Connected" : "Not connected";
  $("conn").className = `pill ${connected ? "ok" : "no"}`;
}

function paintCapture() {
  const btn = $("capture");
  const ready = isMeeting(activeTab?.url) && Boolean($("token").value.trim());
  btn.disabled = !ready && !recording;
  btn.textContent = recording ? "Stop & summarize" : "Start AI Notes";
  btn.className = `btn ${recording ? "recording" : "primary"}`;
}

chrome.storage.local.get(DEFAULTS, (cfg) => {
  paint(cfg);
  paintCapture();

  $("connect").addEventListener("click", () => {
    const origin = $("appOrigin").value.trim() || DEFAULTS.appOrigin;
    chrome.tabs.create({ url: `${origin}/extension/connect` });
  });

  $("save").addEventListener("click", () => {
    const next = {
      appOrigin: $("appOrigin").value.trim() || DEFAULTS.appOrigin,
      apiBase: $("apiBase").value.trim() || DEFAULTS.apiBase,
      token: $("token").value.trim(),
    };
    chrome.storage.local.set(next, () => {
      paint({ ...DEFAULTS, ...next });
      paintCapture();
      $("save").textContent = "Saved ✓";
      setTimeout(() => ($("save").textContent = "Save"), 1500);
    });
  });

  // Chrome only grants tabCapture after the extension has been invoked on the
  // tab, and opening this popup is that invocation. The stream id therefore has
  // to be obtained here — asking for it from the content script's panel throws
  // "Extension has not been invoked for the current page".
  $("capture").addEventListener("click", async () => {
    if (!activeTab?.id) return;
    try {
      if (recording) {
        await chrome.runtime.sendMessage({ target: "background", type: "stop" });
        recording = false;
        $("status").textContent = "Processing the recording…";
      } else {
        const streamId = await chrome.tabCapture.getMediaStreamId({
          targetTabId: activeTab.id,
        });
        await chrome.runtime.sendMessage({
          target: "background",
          type: "start",
          streamId,
          tabId: activeTab.id,
        });
        recording = true;
        $("status").textContent = "Recording. You can close this popup.";
      }
    } catch (err) {
      $("status").textContent = err?.message ?? "Could not start recording.";
      recording = false;
    }
    paintCapture();
  });
});

$("token").addEventListener("input", paintCapture);

chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
  activeTab = tab ?? null;
  const onCall = isMeeting(tab?.url);
  $("status").innerHTML = onCall
    ? `Meeting detected — press <b>Start AI Notes</b>.`
    : `No meeting on this tab. Open <b>Zoom</b> or <b>Google Meet</b> to capture.`;

  const state = await chrome.runtime
    .sendMessage({ target: "background", type: "state" })
    .catch(() => null);
  recording = Boolean(state?.recording);
  if (recording) $("status").textContent = "Recording in progress.";
  paintCapture();
});
