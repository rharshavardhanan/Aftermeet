"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Upload, Mic, Square, Loader2, FileText, Clipboard, MonitorSpeaker } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRecorder, formatClock } from "@/hooks/use-recorder";
import { processMeeting } from "@/app/actions/meetings";
import { cn } from "@/lib/utils";

const SAMPLE = `Alex: Thanks everyone for joining. Main goal today is to lock the Q3 launch.
Sarah: I think we should target the 14th. I'll own the press kit and have a draft by Friday.
Marco: One risk — we still have the API rate-limit issue. I'll need to resolve that before we ship.
Alex: Agreed, let's make the 14th the date. Marco, can you fix the rate limit by next week?
Marco: Yes, I'll have it done by Wednesday.
Sarah: I'll also loop in design on the launch assets.
Alex: Great. Let's review progress in our sync on Monday.`;

type Mode = "paste" | "upload" | "record";

export function NewMeeting({ defaultRecord = false }: { defaultRecord?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Mode>(defaultRecord ? "record" : "paste");
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [pending, startTransition] = useTransition();
  const [transcribing, setTranscribing] = useState(false);
  const [captureMode, setCaptureMode] = useState<"mic" | "system">("mic");
  const fileRef = useRef<HTMLInputElement>(null);
  const recorder = useRecorder();

  async function transcribeBlob(file: File) {
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append("audio", file);
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Transcription failed");
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
      const res = await processMeeting({
        title: title || undefined,
        transcript,
        source: tab === "record" ? "RECORDING" : tab === "upload" ? "UPLOAD" : "PASTE",
        participants: [],
      });
      if (res.ok) {
        toast.success("Meeting analyzed.");
        router.push(`/workspace/${res.data.meetingId}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card className="p-0">
      <div className="border-b border-border p-5">
        <Label htmlFor="title" className="text-xs text-muted-foreground">
          Title (optional)
        </Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Q3 Roadmap Sync"
          className="mt-1.5 border-0 px-0 text-base font-medium shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="p-5">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Mode)}>
          <TabsList>
            <TabsTrigger value="paste"><Clipboard className="mr-1.5 size-3.5" /> Paste</TabsTrigger>
            <TabsTrigger value="upload"><Upload className="mr-1.5 size-3.5" /> Upload</TabsTrigger>
            <TabsTrigger value="record"><Mic className="mr-1.5 size-3.5" /> Record</TabsTrigger>
          </TabsList>

          <TabsContent value="paste">
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste your meeting transcript or notes here…"
              className="min-h-72 font-mono text-[13px] leading-relaxed"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{transcript.split(/\s+/).filter(Boolean).length} words</span>
              <button onClick={() => setTranscript(SAMPLE)} className="hover:text-foreground">
                Use sample transcript
              </button>
            </div>
          </TabsContent>

          <TabsContent value="upload">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={transcribing}
              className="flex min-h-72 w-full flex-col items-center justify-center rounded-lg border border-dashed border-border bg-subtle/40 transition-colors hover:border-foreground/30"
            >
              {transcribing ? (
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              ) : (
                <FileText className="size-6 text-muted-foreground" />
              )}
              <p className="mt-3 text-sm font-medium">
                {transcribing ? "Transcribing…" : "Click to upload"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
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
            <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-border bg-subtle/40 p-4">
              {/* capture-source choice (hidden while recording) */}
              {recorder.state !== "recording" && (
                <div className="mb-6 grid w-full max-w-sm grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1">
                  <button
                    type="button"
                    onClick={() => setCaptureMode("mic")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-md py-2 text-[13px] font-medium transition-all active:scale-95",
                      captureMode === "mic" ? "bg-card shadow-subtle" : "text-muted-foreground",
                    )}
                  >
                    <Mic className="size-4" /> My mic
                  </button>
                  <button
                    type="button"
                    onClick={() => setCaptureMode("system")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-md py-2 text-[13px] font-medium transition-all active:scale-95",
                      captureMode === "system" ? "bg-card shadow-subtle" : "text-muted-foreground",
                    )}
                  >
                    <MonitorSpeaker className="size-4" /> Meeting audio
                  </button>
                </div>
              )}

              <div className="font-mono text-3xl tabular-nums tracking-tight">
                {formatClock(recorder.seconds)}
              </div>
              <p className="mt-2 max-w-xs text-center text-xs text-muted-foreground">
                {recorder.state === "recording"
                  ? "Recording…"
                  : captureMode === "system"
                    ? "Captures the whole call (everyone). You'll pick the meeting tab and tick “Share tab audio”."
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
                <p className="mt-3 max-w-sm text-center text-xs text-destructive">{recorder.error}</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex items-center justify-between border-t border-border p-5">
        <p className="text-xs text-muted-foreground">
          The AI extracts tasks, decisions, and minutes — grounded in your transcript.
        </p>
        <Button onClick={generate} disabled={pending || transcribing}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {pending ? "Analyzing…" : "Generate"}
        </Button>
      </div>
    </Card>
  );
}
