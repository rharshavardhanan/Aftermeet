"use client";

import { useCallback, useRef, useState } from "react";

type RecorderState = "idle" | "recording" | "paused";

export interface StartOptions {
  /**
   * Capture the meeting's tab/system audio (the other participants) and mix it
   * with your mic, so an online call is recorded in full. Uses getDisplayMedia
   * — the browser prompts you to pick a tab and tick "Share tab audio". No mic
   * = system only; no system audio share = we throw a helpful error.
   */
  captureSystemAudio?: boolean;
}

/** MediaRecorder wrapper with a timer + optional whole-meeting (tab) capture. */
export function useRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Everything we must tear down on stop.
  const streamsRef = useRef<MediaStream[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const teardown = useCallback(() => {
    stopTimer();
    streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    streamsRef.current = [];
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  const begin = useCallback((recordStream: MediaStream) => {
    const mr = new MediaRecorder(recordStream, { mimeType: pickMime() });
    chunksRef.current = [];
    mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
    mr.start(1000);
    mediaRef.current = mr;
    setSeconds(0);
    setState("recording");
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }, []);

  const start = useCallback(
    async (opts: StartOptions = {}) => {
      setError(null);
      try {
        if (opts.captureSystemAudio) {
          // 1) Tab/system audio (the remote participants).
          const display = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
          streamsRef.current.push(display);
          if (display.getAudioTracks().length === 0) {
            teardown();
            setError(
              'No tab audio captured. Re-share and tick "Share tab audio" (Chrome shares it per-tab).',
            );
            return;
          }
          // Auto-stop if the user clicks the browser's "Stop sharing".
          display.getVideoTracks()[0]?.addEventListener("ended", () => {
            if (mediaRef.current?.state === "recording") void stop();
          });

          // 2) Mic (your voice) — best effort; continue without it if blocked.
          let mic: MediaStream | null = null;
          try {
            mic = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamsRef.current.push(mic);
          } catch {
            /* no mic — record system audio only */
          }

          // 3) Mix both audio sources into one recordable stream.
          const ctx = new AudioContext();
          audioCtxRef.current = ctx;
          const dest = ctx.createMediaStreamDestination();
          ctx.createMediaStreamSource(new MediaStream(display.getAudioTracks())).connect(dest);
          if (mic) ctx.createMediaStreamSource(mic).connect(dest);

          begin(dest.stream);
        } else {
          const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamsRef.current.push(mic);
          begin(mic);
        }
      } catch {
        teardown();
        setError(
          opts.captureSystemAudio
            ? "Screen/tab share was cancelled or blocked. Try again and pick the meeting tab."
            : "Microphone access was blocked. Allow it and try again.",
        );
      }
    },
    [begin, teardown],
  );

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mr = mediaRef.current;
      if (!mr) return resolve(null);
      mr.onstop = () => {
        teardown();
        setState("idle");
        resolve(new Blob(chunksRef.current, { type: mr.mimeType }));
      };
      mr.stop();
    });
  }, [teardown]);

  return { state, seconds, error, start, stop };
}

function pickMime() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "audio/webm";
}

export function formatClock(total: number) {
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
