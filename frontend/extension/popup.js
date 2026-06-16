const DEFAULTS = {
  appOrigin: "http://localhost:4000",
  apiBase: "http://localhost:4001",
  token: "",
  language: "",
};

const $ = (id) => document.getElementById(id);

function paint(cfg) {
  $("appOrigin").value = cfg.appOrigin;
  $("apiBase").value = cfg.apiBase;
  $("token").value = cfg.token;
  const connected = Boolean(cfg.token);
  $("conn").textContent = connected ? "Connected" : "Not connected";
  $("conn").className = `pill ${connected ? "ok" : "no"}`;
}

chrome.storage.local.get(DEFAULTS, (cfg) => {
  paint(cfg);

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
      $("save").textContent = "Saved ✓";
      setTimeout(() => ($("save").textContent = "Save"), 1500);
    });
  });
});

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  const onCall = tab?.url && /meet\.google\.com|zoom\.us/.test(tab.url);
  $("status").innerHTML = onCall
    ? `Meeting detected — use the panel on the call to <b>Start AI Notes</b>.`
    : `No meeting on this tab. Open <b>Zoom</b> or <b>Google Meet</b> to capture.`;
});
