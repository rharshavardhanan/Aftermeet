// Service worker — coordinates tab-audio capture across an offscreen document.
//
// MV3 can't capture audio in the service worker and getUserMedia is unavailable
// there, so the offscreen document does the MediaRecorder work. The stream id
// arrives from the popup: chrome.tabCapture only works once the extension has
// been invoked on the tab, and opening the popup is what counts as invoking it.

let creating = null; // dedupe offscreen creation
let recordingTabId = null;

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

function notifyTab(tabId, msg) {
  if (tabId) chrome.tabs.sendMessage(tabId, msg).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target && msg.target !== "background") return;

  (async () => {
    switch (msg.type) {
      case "state":
        sendResponse({ ok: true, recording: recordingTabId !== null });
        break;

      case "start": {
        const tabId = msg.tabId ?? sender.tab?.id ?? null;
        if (!msg.streamId) {
          sendResponse({ ok: false, error: "No stream id" });
          break;
        }
        await ensureOffscreen();
        recordingTabId = tabId;
        chrome.runtime.sendMessage({
          target: "offscreen",
          type: "start-recording",
          streamId: msg.streamId,
        });
        notifyTab(tabId, { type: "capture-started" });
        sendResponse({ ok: true });
        break;
      }

      case "stop": {
        chrome.runtime.sendMessage({ target: "offscreen", type: "stop-recording" });
        notifyTab(recordingTabId, { type: "capture-stopping" });
        sendResponse({ ok: true });
        break;
      }

      // Results come back from the offscreen document as text, never as bytes.
      case "transcript-ready":
      case "recording-error": {
        notifyTab(recordingTabId, msg);
        recordingTabId = null;
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
