"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Upload, Mic, Square, Loader2, FileText, Clipboard, MonitorSpeaker, Globe } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRecorder, formatClock } from "@/hooks/use-recorder";
import { processMeetingViaApi, transcribeViaApi, fetchLanguages } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const SAMPLE = `Alex: Thanks everyone for joining. Main goal today is to lock the Q3 launch.
Sarah: I think we should target the 14th. I'll own the press kit and have a draft by Friday.
Marco: One risk — we still have the API rate-limit issue. I'll need to resolve that before we ship.
Alex: Agreed, let's make the 14th the date. Marco, can you fix the rate limit by next week?
Marco: Yes, I'll have it done by Wednesday.
Sarah: I'll also loop in design on the launch assets.
Alex: Great. Let's review progress in our sync on Monday.`;

const FALLBACK_LANGUAGES = [
  { code: "", label: "Auto-detect" },
  { code: "ta", label: "Tamil" },
  { code: "hi", label: "Hindi" },
  { code: "te", label: "Telugu" },
  { code: "kn", label: "Kannada" },
  { code: "ml", label: "Malayalam" },
  { code: "bn", label: "Bengali" },
  { code: "mr", label: "Marathi" },
  { code: "ur", label: "Urdu" },
  { code: "ar", label: "Arabic" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "es", label: "Spanish" },
  { code: "pt", label: "Portuguese" },
  { code: "en", label: "English" },
];

type Mode = "paste" | "upload" | "record";

export function NewMeeting({ defaultRecord = false }: { defaultRecord?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Mode>(defaultRecord ? "record" : "paste");
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [pending, startTransition] = useTransition();
  const [transcribing, setTranscribing] = useState(false);
  const [captureMode, setCaptureMode] = useState<"mic" | "system">("mic");
  const [language, setLanguage] = useState("");
  const [languages, setLanguages] = useState(FALLBACK_LANGUAGES);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorder = useRecorder();

  // Load the full 45-language set from the backend; keep the static list as a
  // fallback if the backend is unreachable.
  useEffect(() => {
    let alive = true;
    fetchLanguages()
      .then((list) => {
        if (!alive) return;
        setLanguages([
          { code: "", label: "Auto-detect" },
          ...list.map((l) => ({ code: l.code, label: l.label })),
        ]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function transcribeBlob(file: File) {
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append("audio", file);
      if (language) form.append("language", language);
      const json = await transcribeViaApi(form);
      setTranscript((t) => (t ? `${t}\n${json.text}` : json.text));
      setTab("paste");
      toast.success("Transcribed. Review and generate.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("audio/") || /\.(mp3|wav|m4a|webm|ogg)$/i.test(file.name)) {
      await transcribeBlob(file);
    } else {
      const text = await file.text();
      setTranscript(text);
      setTab("paste");
      toast.success(`Loaded ${file.name}`);
    }
    e.target.value = "";
  }

  async function stopRecording() {
    const blob = await recorder.stop();
    if (blob) await transcribeBlob(new File([blob], "recording.webm", { type: blob.type }));
  }

  function generate() {
    if (transcript.trim().length < 12) {
      toast.error("Add a bit more transcript first.");
      return;
    }
    startTransition(async () => {
      try {
        const { meetingId } = await processMeetingViaApi({
          title: title || undefined,
          transcript,
          source: tab === "record" ? "RECORDING" : tab === "upload" ? "UPLOAD" : "PASTE",
        });
        toast.success("Meeting analyzed.");
        router.push(`/workspace/${meetingId}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Analysis failed. Please try again.");
      }
    });
  }

  return (
    <Card className="animate-rise overflow-hidden p-0">
      <div className="border-b border-border p-5">
        <Label
          htmlFor="title"
          className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
        >
          Title (optional)
        </Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Q3 roadmap sync"
          className="mt-1.5 border-0 bg-transparent px-0 font-display text-lg font-semibold tracking-tight shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="p-5">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Mode)}>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              <TabsTrigger value="paste"><Clipboard className="mr-1.5 size-3.5" /> Paste</TabsTrigger>
              <TabsTrigger value="upload"><Upload className="mr-1.5 size-3.5" /> Upload</TabsTrigger>
              <TabsTrigger value="record"><Mic className="mr-1.5 size-3.5" /> Record</TabsTrigger>
            </TabsList>
            {/* Language hint — only relevant for audio tabs */}
            {tab !== "paste" && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Globe className="size-3.5 shrink-0" />
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="cursor-pointer border-0 bg-transparent text-xs text-foreground outline-none transition-colors hover:text-ember"
                  title="Spoken language — helps with non-English audio"
                >
                  {languages.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <TabsContent value="paste">
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste your meeting transcript or notes here…"
              className="min-h-72 font-mono text-[13px] leading-relaxed"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-mono">
                <span className="tabular-nums text-foreground/70">
                  {transcript.split(/\s+/).filter(Boolean).length}
                </span>{" "}
                words
              </span>
              <button
                onClick={() => setTranscript(SAMPLE)}
                className="transition-colors hover:text-foreground"
              >
                Use sample transcript
              </button>
            </div>
          </TabsContent>

          <TabsContent value="upload">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={transcribing}
              className="flex min-h-72 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border transition-colors hover:border-ember/40 disabled:cursor-wait"
            >
              <span className="glass-pill flex size-12 items-center justify-center rounded-2xl">
                {transcribing ? (
                  <Loader2 className="size-5 motion-safe:animate-spin text-ember" />
                ) : (
                  <FileText className="size-5 text-ember" />
                )}
              </span>
              <p className="mt-3.5 text-sm font-medium text-foreground">
                {transcribing ? "Transcribing…" : "Click to upload a file"}
              </p>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                .txt / .vtt / .srt transcript, or .mp3 / .m4a / .wav audio
              </p>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.vtt,.srt,.md,audio/*"
              className="hidden"
              onChange={onFile}
            />
          </TabsContent>

          <TabsContent value="record">
            <div className="liquid-glass flex min-h-72 flex-col items-center justify-center rounded-xl p-4">
              {/* capture-source choice (hidden while recording) */}
              {recorder.state !== "recording" && (
                <div className="mb-6 grid w-full max-w-sm grid-cols-2 gap-1 rounded-xl bg-foreground/[0.04] p-1">
                  <button
                    type="button"
                    onClick={() => setCaptureMode("mic")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-medium transition-all duration-300 ease-ios active:scale-95",
                      captureMode === "mic" ? "glass-pill text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <Mic className={cn("size-4", captureMode === "mic" && "text-ember")} /> My mic
                  </button>
                  <button
                    type="button"
                    onClick={() => setCaptureMode("system")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-medium transition-all duration-300 ease-ios active:scale-95",
                      captureMode === "system" ? "glass-pill text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <MonitorSpeaker className={cn("size-4", captureMode === "system" && "text-ember")} />{" "}
                    Meeting audio
                  </button>
                </div>
              )}

              {recorder.state === "recording" && (
                <span className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-ember">
                  <span className="size-2 rounded-full bg-ember motion-safe:animate-pulse" />
                  Recording
                </span>
              )}

              <div className="font-mono text-4xl tabular-nums tracking-tight text-foreground">
                {formatClock(recorder.seconds)}
              </div>
              <p className="mt-2 max-w-xs text-center text-xs leading-relaxed text-muted-foreground">
                {recorder.state === "recording"
                  ? "Stop when you're done to transcribe automatically."
                  : captureMode === "system"
                    ? 'Captures the whole call (everyone). You\'ll pick the meeting tab and tick "Share tab audio".'
                    : "Records your microphone — best for in-person meetings."}
              </p>
              <div className="mt-6">
                {recorder.state !== "recording" ? (
                  <Button
                    onClick={() => recorder.start({ captureSystemAudio: captureMode === "system" })}
                    disabled={transcribing}
                  >
                    {captureMode === "system" ? (
                      <MonitorSpeaker className="size-4" />
                    ) : (
                      <Mic className="size-4" />
                    )}
                    {captureMode === "system" ? "Share tab & record" : "Start recording"}
                  </Button>
                ) : (
                  <Button variant="destructive" onClick={stopRecording}>
                    <Square className="size-4" /> Stop & transcribe
                  </Button>
                )}
              </div>
              {recorder.error && (
                <p className="mt-3 max-w-sm text-center text-xs leading-relaxed text-destructive">
                  {recorder.error}
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex flex-col items-start gap-3 border-t border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Every task, decision, and line of the minutes is grounded in your transcript.
        </p>
        <Button onClick={generate} disabled={pending || transcribing} className="w-full sm:w-auto">
          {pending ? <Loader2 className="size-4 motion-safe:animate-spin" /> : <Sparkles className="size-4" />}
          {pending ? "Analyzing…" : "Generate"}
        </Button>
      </div>
    </Card>
  );
}
