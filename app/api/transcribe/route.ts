import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAiConfigured } from "@/lib/openai";
import { transcribeAudio, refineTranscript } from "@/lib/ai/transcribe";

export const maxDuration = 60;

/** Accepts an audio blob and returns a transcript. Used by upload + recording. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "Transcription needs OPENAI_API_KEY. Paste text instead in demo mode." },
      { status: 503 },
    );
  }

  try {
    const form = await req.formData();
    const file = form.get("audio");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No audio file provided." }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "Audio exceeds 25MB limit." }, { status: 413 });
    }
    // Stage 1: Whisper → raw text in the original language.
    const { text, language } = await transcribeAudio(file);
    // Stage 2: LLM cleans it into a polished, speaker-labeled transcript
    // (same language). Falls back to raw text if refinement is unavailable.
    const refined = await refineTranscript(text);
    return NextResponse.json({ text: refined, language });
  } catch (err) {
    console.error("transcribe error", err);
    const msg = err instanceof Error ? err.message : "";
    if (/429|quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "AI quota exceeded. Your Gemini key has no free-tier quota right now — enable billing on its Google Cloud project, or switch providers. The recording itself worked.",
        },
        { status: 429 },
      );
    }
    if (/too large|18MB/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 413 });
    }
    return NextResponse.json({ error: "Transcription failed. Please try again." }, { status: 500 });
  }
}
