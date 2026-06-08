// Offscreen document: records the captured tab stream and ships audio chunks.
// Chunks are accumulated; on stop we assemble a single Blob and forward it for
// transcription. (Chunked streaming to a realtime ASR endpoint can replace the
// accumulate-then-send step without changing the rest of the pipeline.)

let recorder = null;
let chunks = [];
let audioCtx = null;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target !== "offscreen") return;
  if (msg.type === "start-recording") start(msg.streamId);
  if (msg.type === "stop-recording") stop();
});

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
      const blob = new Blob(chunks, { type: "audio/webm" });
      const buf = await blob.arrayBuffer();
      // Forward as a transferable-ish base64 payload (service worker can't hold Blobs well).
      chrome.runtime.sendMessage({
        target: "background",
        type: "recording-stopped",
        mime: "audio/webm",
        bytes: Array.from(new Uint8Array(buf)),
      });
      stream.getTracks().forEach((t) => t.stop());
      audioCtx?.close();
    };
    recorder.start(4000); // emit every 4s for progressive handling
  } catch (err) {
    chrome.runtime.sendMessage({
      target: "background",
      type: "recording-error",
      error: String(err?.message ?? err),
    });
  }
}

function stop() {
  if (recorder && recorder.state !== "inactive") recorder.stop();
  recorder = null;
}
