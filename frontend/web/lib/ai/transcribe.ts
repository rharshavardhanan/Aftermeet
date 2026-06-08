import "server-only";
import { openai, TRANSCRIBE_MODEL } from "@/lib/openai";
import { gemini, GEMINI_MODEL, isGeminiConfigured } from "@/lib/gemini";
import { groq, GROQ_MODEL, GROQ_STT_MODEL, isGroqConfigured, isQuotaError } from "@/lib/groq";

// Gemini inline audio cap (~20MB request limit; stay safely under it).
const GEMINI_INLINE_MAX_BYTES = 18 * 1024 * 1024;

/**
 * Transcribe an audio file. Provider preference:
 *   Groq Whisper (free, multilingual) → Gemini (multimodal) → OpenAI Whisper.
 * Used by upload + recording flows.
 */
export async function transcribeAudio(file: File): Promise<{ text: string; language?: string }> {
  if (isGroqConfigured()) return transcribeWithGroq(file);
  if (isGeminiConfigured()) return transcribeWithGemini(file);
  return transcribeWithWhisper(file);
}

// ── Stage 2: refine raw STT into a clean transcript ──────────────────────────

const REFINE_PROMPT = `You are a transcription editor. You receive a raw, machine-generated speech-to-text transcript that may contain recognition errors, no punctuation, and no speaker labels.

Produce a clean, faithful transcript:
- Keep the ORIGINAL spoken language(s) exactly. Do NOT translate. Preserve code-switching (words/phrases in different languages) exactly as spoken.
- Fix obvious mis-recognitions using context; add natural punctuation, capitalization, and paragraph breaks.
- If distinct speakers are discernible, label each turn as "Speaker 1:", "Speaker 2:", etc. Use real names only if clearly stated in the audio.
- Do NOT summarize, add, or remove meaning. Output ONLY the cleaned transcript text — no preamble, no commentary.`;

// Above this length we skip refinement (cost/latency); the raw STT is used as-is.
const REFINE_MAX_CHARS = 40_000;

/**
 * Second stage of the pipeline: hand the raw Whisper output to the LLM (Gemini
 * preferred, Groq fallback) to produce a clean, speaker-labeled transcript in
 * the original language. Everything downstream (extraction, minutes) then runs
 * on this polished transcript. Never blocks: on any failure it returns the raw
 * text so transcription still succeeds.
 */
export async function refineTranscript(raw: string): Promise<string> {
  const text = raw.trim();
  if (text.length < 12 || text.length > REFINE_MAX_CHARS) return text;
  try {
    if (isGeminiConfigured()) {
      try {
        return await refineWithGemini(text);
      } catch (err) {
        if (isQuotaError(err) && isGroqConfigured()) return await refineWithGroq(text);
        throw err;
      }
    }
    if (isGroqConfigured()) return await refineWithGroq(text);
    return text;
  } catch (err) {
    console.error("transcript refine failed; using raw STT", err);
    return text;
  }
}

async function refineWithGemini(text: string): Promise<string> {
  const model = gemini().getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: REFINE_PROMPT,
    generationConfig: { temperature: 0.2 },
  });
  const res = await model.generateContent(text);
  return res.response.text()?.trim() || text;
}

async function refineWithGroq(text: string): Promise<string> {
  const res = await groq().chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: REFINE_PROMPT },
      { role: "user", content: text },
    ],
  });
  return res.choices[0]?.message?.content?.trim() || text;
}

async function transcribeWithGroq(file: File): Promise<{ text: string; language?: string }> {
  // Groq's Whisper large-v3 is multilingual and auto-detects language. We leave
  // `language` unset so code-switched audio isn't forced into one language.
  const res = await groq().audio.transcriptions.create({
    file,
    model: GROQ_STT_MODEL,
    response_format: "verbose_json",
  });
  return { text: res.text, language: (res as { language?: string }).language };
}

async function transcribeWithWhisper(file: File): Promise<{ text: string; language?: string }> {
  const res = await openai().audio.transcriptions.create({
    file,
    model: TRANSCRIBE_MODEL,
    response_format: "verbose_json",
  });
  return { text: res.text, language: (res as { language?: string }).language };
}

async function transcribeWithGemini(file: File): Promise<{ text: string; language?: string }> {
  if (file.size > GEMINI_INLINE_MAX_BYTES) {
    throw new Error(
      "Audio is too large for transcription (over ~18MB). Use a shorter clip or paste the transcript.",
    );
  }
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const model = gemini().getGenerativeModel({ model: GEMINI_MODEL });
  const res = await model.generateContent([
    {
      text:
        "Transcribe this meeting audio verbatim in the ORIGINAL spoken language(s). " +
        "The conversation may switch between languages within or across sentences " +
        "(code-switching) — keep each word in the language it was actually spoken; do " +
        "NOT translate or normalize to one language. Preserve names and technical terms " +
        "as spoken. If distinct speakers are audible, prefix lines with a label like " +
        "'Speaker 1:'. Output only the transcript text — no preamble, no commentary.",
    },
    { inlineData: { mimeType: file.type || "audio/webm", data: base64 } },
  ]);
  const text = res.response.text()?.trim();
  if (!text) throw new Error("Transcription returned no text.");
  return { text };
}

/**
 * Lightweight heuristic speaker segmentation for diarization fallback when
 * the source has no speaker labels. Splits on blank lines / "Name:" prefixes.
 * Real diarization happens client-side in the extension; this keeps the
 * server path useful for pasted/uploaded transcripts.
 */
export function segmentSpeakers(text: string) {
  const lines = text.split(/\n+/).filter(Boolean);
  let auto = 1;
  const speakers = new Set<string>();
  const chunks = lines.map((line, index) => {
    const m = line.match(/^([A-Z][\w .'-]{1,28}):\s*(.*)$/);
    if (m) {
      speakers.add(m[1]);
      return { index, speaker: m[1], text: m[2] };
    }
    const speaker = `Speaker ${((auto - 1) % 2) + 1}`;
    auto++;
    return { index, speaker, text: line };
  });
  return { chunks, detectedSpeakers: [...speakers] };
}
