const APP_ORIGIN = "http://localhost:4000";

document.getElementById("open").href = `${APP_ORIGIN}/dashboard`;
document.getElementById("signin").href = `${APP_ORIGIN}/login`;

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  const statusEl = document.getElementById("status");
  const onCall = tab?.url && /meet\.google\.com|zoom\.us/.test(tab.url);
  statusEl.innerHTML = onCall
    ? `Meeting detected — use the panel on the call to <b>Start AI Notes</b>.`
    : `No meeting on this tab. Open <b>Zoom</b> or <b>Google Meet</b> to capture.`;
});
