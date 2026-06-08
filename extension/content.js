// Injected on Zoom & Google Meet. Renders a quiet floating panel and drives the
// capture session. Live transcript uses the Web Speech API (mic) for instant
// feedback; the full tab-audio recording is transcribed server-side on stop for
// accuracy. Content scripts can't use ES imports, so config is inlined.

(() => {
  const APP_ORIGIN = "http://localhost:4000";
  const PLATFORM = location.host.includes("zoom") ? "Zoom" : "Google Meet";
  if (document.getElementById("m2t-panel")) return;

  let recording = false;
  let liveTranscript = "";
  let recognition = null;

  // ---- UI ------------------------------------------------------------------
  const panel = document.createElement("div");
  panel.id = "m2t-panel";
  panel.innerHTML = `
    <div class="m2t-header" id="m2t-drag">
      <div class="m2t-brand">
        <span class="m2t-dot" id="m2t-status-dot"></span>
        <span>Meeting-to-Tasks</span>
      </div>
      <span class="m2t-platform">${PLATFORM}</span>
    </div>
    <div class="m2t-body">
      <div class="m2t-row">
        <span id="m2t-timer" class="m2t-timer">00:00</span>
        <button id="m2t-toggle" class="m2t-btn m2t-btn-primary">Start AI Notes</button>
      </div>
      <div class="m2t-section-label">Live transcript</div>
      <div id="m2t-transcript" class="m2t-transcript">Waiting to start…</div>
      <div class="m2t-section-label">Live tasks</div>
      <div id="m2t-tasks" class="m2t-tasks"><div class="m2t-empty">Tasks appear as the call progresses.</div></div>
    </div>
    <div class="m2t-footer">
      <a href="${APP_ORIGIN}/dashboard" target="_blank" rel="noreferrer">Open workspace ↗</a>
    </div>`;
  document.body.appendChild(panel);

  const toggleBtn = panel.querySelector("#m2t-toggle");
  const transcriptEl = panel.querySelector("#m2t-transcript");
  const tasksEl = panel.querySelector("#m2t-tasks");
  const timerEl = panel.querySelector("#m2t-timer");
  const dot = panel.querySelector("#m2t-status-dot");

  // ---- Timer ---------------------------------------------------------------
  let seconds = 0;
  let timer = null;
  const fmt = (t) =>
    `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;

  // ---- Live transcription (mic) -------------------------------------------
  function startLiveASR() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript;
        if (e.results[i].isFinal) liveTranscript += txt + " ";
        else interim += txt;
      }
      transcriptEl.textContent = (liveTranscript + interim).slice(-1200) || "Listening…";
      transcriptEl.scrollTop = transcriptEl.scrollHeight;
    };
    recognition.onerror = () => {};
    recognition.onend = () => recording && recognition.start();
    try { recognition.start(); } catch {}
  }
  function stopLiveASR() {
    if (recognition) { recognition.onend = null; recognition.stop(); recognition = null; }
  }

  // ---- Start / stop --------------------------------------------------------
  // Tell the backend a capture session is live so the web app's
  // "Extension: connected" badge lights up. Non-blocking, best-effort.
  const SESSION_PLATFORM = location.host.includes("zoom") ? "zoom" : "meet";
  let heartbeat = null;
  function reportSession(action) {
    fetch(`${APP_ORIGIN}/api/extension/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action, platform: SESSION_PLATFORM, tabUrl: location.href }),
    }).catch(() => {});
  }

  async function start() {
    recording = true;
    seconds = 0;
    liveTranscript = "";
    toggleBtn.textContent = "Stop & summarize";
    toggleBtn.classList.add("m2t-btn-stop");
    dot.classList.add("m2t-live");
    transcriptEl.textContent = "Listening…";
    timer = setInterval(() => (timerEl.textContent = fmt(++seconds)), 1000);
    startLiveASR();
    chrome.runtime.sendMessage({ target: "background", type: "start" });
    reportSession("start");
    heartbeat = setInterval(() => reportSession("heartbeat"), 60_000);
  }

  async function stop() {
    recording = false;
    toggleBtn.disabled = true;
    toggleBtn.textContent = "Processing…";
    toggleBtn.classList.remove("m2t-btn-stop");
    dot.classList.remove("m2t-live");
    clearInterval(timer);
    clearInterval(heartbeat);
    stopLiveASR();
    chrome.runtime.sendMessage({ target: "background", type: "stop" });
    reportSession("end");
    // If we have a live transcript, send it immediately for fast results.
    if (liveTranscript.trim().length > 20) await processTranscript(liveTranscript.trim());
  }

  toggleBtn.addEventListener("click", () => (recording ? stop() : start()));

  // ---- Receive recording result from offscreen via background -------------
  chrome.runtime.onMessage.addListener(async (msg) => {
    if (msg.type === "recording-stopped" && Array.isArray(msg.bytes)) {
      try {
        const blob = new Blob([new Uint8Array(msg.bytes)], { type: msg.mime || "audio/webm" });
        const form = new FormData();
        form.append("audio", new File([blob], "call.webm", { type: blob.type }));
        const res = await fetch(`${APP_ORIGIN}/api/transcribe`, {
          method: "POST",
          body: form,
          credentials: "include",
        });
        const json = await res.json();
        if (res.ok && json.text) await processTranscript(json.text);
      } catch (e) {
        renderError("Couldn't transcribe the recording.");
      }
    }
    if (msg.type === "recording-error") renderError(msg.error || "Capture failed.");
  });

  // ---- Send transcript to the app for extraction --------------------------
  async function processTranscript(text) {
    try {
      const res = await fetch(`${APP_ORIGIN}/api/extension/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ transcript: text, platform: PLATFORM, source: "EXTENSION" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Processing failed");
      renderTasks(json.tasks || [], json.meetingId);
    } catch (e) {
      renderError(e.message || "Processing failed. Open the workspace to retry.");
    } finally {
      toggleBtn.disabled = false;
      toggleBtn.textContent = "Start AI Notes";
    }
  }

  function renderTasks(tasks, meetingId) {
    if (!tasks.length) {
      tasksEl.innerHTML = `<div class="m2t-empty">No tasks detected.</div>`;
      return;
    }
    tasksEl.innerHTML = tasks
      .map(
        (t) => `<div class="m2t-task">
          <span class="m2t-check"></span>
          <div><div class="m2t-task-title">${esc(t.title)}</div>
          <div class="m2t-task-meta">${[t.assignee, t.dueDate].filter(Boolean).map(esc).join(" · ")}</div></div>
        </div>`,
      )
      .join("");
    if (meetingId) {
      const link = document.createElement("a");
      link.href = `${APP_ORIGIN}/workspace/${meetingId}`;
      link.target = "_blank";
      link.className = "m2t-open-meeting";
      link.textContent = "View full minutes ↗";
      tasksEl.appendChild(link);
    }
  }

  function renderError(message) {
    tasksEl.innerHTML = `<div class="m2t-error">${esc(message)}</div>`;
  }

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---- Dragging ------------------------------------------------------------
  (function makeDraggable() {
    const handle = panel.querySelector("#m2t-drag");
    let ox = 0, oy = 0, dragging = false;
    handle.addEventListener("mousedown", (e) => {
      dragging = true;
      ox = e.clientX - panel.offsetLeft;
      oy = e.clientY - panel.offsetTop;
      document.body.style.userSelect = "none";
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      panel.style.left = `${e.clientX - ox}px`;
      panel.style.top = `${e.clientY - oy}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    });
    window.addEventListener("mouseup", () => {
      dragging = false;
      document.body.style.userSelect = "";
    });
  })();
})();
