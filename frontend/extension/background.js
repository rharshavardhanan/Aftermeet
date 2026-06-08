// Service worker — coordinates tab-audio capture across an offscreen document.
//
// MV3 can't capture audio directly in the service worker, and getUserMedia is
// unavailable there. The pattern: the worker obtains a tabCapture stream id,
// spins up an offscreen document, and hands the id over. The offscreen page
// does the actual MediaRecorder work and posts audio chunks back.

let creating = null; // dedupe offscreen creation

async function ensureOffscreen() {
  const has = await chrome.offscreen.hasDocument?.();
  if (has) return;
  if (creating) {
    await creating;
    return;
  }
  creating = chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["USER_MEDIA"],
    justification: "Record tab audio to transcribe the meeting.",
  });
  await creating;
  creating = null;
}

async function startCapture(tabId) {
  await ensureOffscreen();
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  chrome.runtime.sendMessage({ target: "offscreen", type: "start-recording", streamId });
}

function stopCapture() {
  chrome.runtime.sendMessage({ target: "offscreen", type: "stop-recording" });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target && msg.target !== "background") return;

  (async () => {
    switch (msg.type) {
      case "start": {
        const tabId = msg.tabId ?? sender.tab?.id;
        if (!tabId) return sendResponse({ ok: false, error: "No tab" });
        await startCapture(tabId);
        sendResponse({ ok: true });
        break;
      }
      case "stop": {
        stopCapture();
        sendResponse({ ok: true });
        break;
      }
      // Relay transcript/audio events from offscreen back to the active tab UI.
      case "audio-chunk":
      case "recording-stopped":
      case "recording-error": {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) chrome.tabs.sendMessage(tab.id, msg);
        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ ok: false, error: "unknown" });
    }
  })();

  return true; // async
});

// Surface meeting detection on the toolbar badge.
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (!tab.url) return;
  const onCall = /meet\.google\.com|zoom\.us/.test(tab.url);
  chrome.action.setBadgeText({ tabId, text: onCall ? "●" : "" });
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#16181d" });
});
