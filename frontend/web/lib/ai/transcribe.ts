import "server-only";
import { openai, TRANSCRIBE_MODEL } from "@/lib/openai";
import { gemini, GEMINI_MODEL, isGeminiConfigured } from "@/lib/gemini";
import { groq, GROQ_MODEL, GROQ_STT_MODEL, isGroqConfigured, isQuotaError } from "@/lib/groq";

// Gemini inline audio cap (~20MB request limit; stay safely under it).
const GEMINI_INLINE_MAX_BYTES = 18 * 1024 * 1024;

export interface TranscribeOptions {
  /** ISO 639-1 language code, e.g. "ta" for Tamil. Omit for auto-detect. */
  language?: string;
}

// Native-script bootstrap text fed as Whisper's initial prompt — seeds the
// decoder with the target language's tokens so Tamil/Hindi/etc. audio isn't
// mistakenly decoded as phonetically-similar English words.
const LANG_BOOTSTRAP: Record<string, string> = {
  ta: "நமஸ்கார. இது தமிழ் மற்றும் ஆங்கில வணிக கூட்டம்.",
  hi: "नमस्ते. यह एक हिंदी और अंग्रेजी व्यापार बैठक है।",
  te: "నమస్కారం. ఇది తెలుగు మరియు ఆంగ్ల వ్యాపార సమావేశం.",
  kn: "ನಮಸ್ಕಾರ. ಇದು ಕನ್ನಡ ಮತ್ತು ಇಂಗ್ಲಿಷ್ ವ್ಯಾಪಾರ ಸಭೆ.",
  ml: "നമസ്കാരം. ഇത് ഒരു മലയാള ഇംഗ്ലീഷ് ബിസിനസ് മീറ്റിംഗ് ആണ്.",
  bn: "নমস্কার। এটি একটি বাংলা এবং ইংরেজি ব্যবসায়িক বৈঠক।",
  mr: "नमस्कार. ही एक मराठी आणि इंग्रजी व्यावसायिक बैठक आहे.",
  ur: "السلام علیکم. یہ ایک اردو اور انگریزی کاروباری میٹنگ ہے۔",
  ar: "السلام عليكم. هذا اجتماع عمل باللغة العربية والإنجليزية.",
  zh: "你好。这是一次中英文混合商务会议。",
  ja: "こんにちは。これは日本語と英語のビジネス会議です。",
  ko: "안녕하세요. 이것은 한국어와 영어 비즈니스 회의입니다.",
  fr: "Bonjour. Ceci est une réunion d'affaires en français et en anglais.",
  de: "Hallo. Dies ist ein deutsch-englisches Geschäftstreffen.",
  es: "Hola. Esta es una reunión de negocios en español e inglés.",
  pt: "Olá. Esta é uma reunião de negócios em português e inglês.",
};

const LANG_DISPLAY: Record<string, string> = {
  ta: "Tamil", hi: "Hindi", te: "Telugu", kn: "Kannada", ml: "Malayalam",
  bn: "Bengali", mr: "Marathi", ur: "Urdu", ar: "Arabic", zh: "Chinese",
  ja: "Japanese", ko: "Korean", fr: "French", de: "German", es: "Spanish",
  pt: "Portuguese",
};

/**
 * Transcribe an audio file. Provider preference:
 *   Groq Whisper (free, multilingual) → Gemini (multimodal) → OpenAI Whisper.
 * Used by upload + recording flows.
 */
export async function transcribeAudio(
  file: File,
  opts: TranscribeOptions = {},
): Promise<{ text: string; language?: string }> {
  if (isGroqConfigured()) return transcribeWithGroq(file, opts.language);
  if (isGeminiConfigured()) return transcribeWithGemini(file, opts.language);
  return transcribeWithWhisper(file, opts.language);
}

// ── Stage 2: refine raw STT into a clean transcript ──────────────────────────

function buildRefinePrompt(language?: string): string {
  const langLine = language && LANG_DISPLAY[language]
    ? `\n- The primary spoken language is ${LANG_DISPLAY[language]}. Preserve all words in that script/language exactly. Keep English technical terms and loanwords as spoken — do NOT translate them.`
    : "";
  return `You are a transcription editor. You receive a raw, machine-generated speech-to-text transcript that may contain recognition errors, no punctuation, and no speaker labels.

Produce a clean, faithful transcript:
- Keep the ORIGINAL spoken language(s) exactly. Do NOT translate. Preserve code-switching (words/phrases in different languages) exactly as spoken.${langLine}
- Fix obvious mis-recognitions using context; add natural punctuation, capitalization, and paragraph breaks.
- If distinct speakers are discernible, label each turn as "Speaker 1:", "Speaker 2:", etc. Use real names only if clearly stated in the audio.
- Do NOT summarize, add, or remove meaning. Output ONLY the cleaned transcript text — no preamble, no commentary.`;
}

// Above this length we skip refinement (cost/latency); the raw STT is used as-is.
const REFINE_MAX_CHARS = 40_000;

/**
 * Second stage of the pipeline: hand the raw Whisper output to the LLM (Gemini
 * preferred, Groq fallback) to produce a clean, speaker-labeled transcript in
 * the original language. Everything downstream (extraction, minutes) then runs
 * on this polished transcript. Never blocks: on any failure it returns the raw
 * text so transcription still succeeds.
 */
export async function refineTranscript(raw: string, language?: string): Promise<string> {
  const text = raw.trim();
  if (text.length < 12 || text.length > REFINE_MAX_CHARS) return text;
  const prompt = buildRefinePrompt(language);
  try {
    if (isGeminiConfigured()) {
      try {
        return await refineWithGemini(text, prompt);
      } catch (err) {
        if (isQuotaError(err) && isGroqConfigured()) return await refineWithGroq(text, prompt);
        throw err;
      }
    }
    if (isGroqConfigured()) return await refineWithGroq(text, prompt);
    return text;
  } catch (err) {
    console.error("transcript refine failed; using raw STT", err);
    return text;
  }
}

async function refineWithGemini(text: string, prompt: string): Promise<string> {
  const model = gemini().getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: prompt,
    generationConfig: { temperature: 0.2 },
  });
  const res = await model.generateContent(text);
  return res.response.text()?.trim() || text;
}

async function refineWithGroq(text: string, prompt: string): Promise<string> {
  const res = await groq().chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: text },
    ],
  });
  return res.choices[0]?.message?.content?.trim() || text;
}

async function transcribeWithGroq(
  file: File,
  language?: string,
): Promise<{ text: string; language?: string }> {
  // When a language is specified, feed native-script bootstrap text as the
  // Whisper prompt. This seeds the decoder with the target language's tokens,
  // preventing Indian/Asian languages from being force-decoded as phonetic
  // English (e.g. Tamil words appearing as "mining and key rights").
  const prompt = language ? LANG_BOOTSTRAP[language] : undefined;
  const res = await groq().audio.transcriptions.create({
    file,
    model: GROQ_STT_MODEL,
    response_format: "verbose_json",
    ...(language ? { language } : {}),
    ...(prompt ? { prompt } : {}),
  });
  return { text: res.text, language: (res as { language?: string }).language };
}

async function transcribeWithWhisper(
  file: File,
  language?: string,
): Promise<{ text: string; language?: string }> {
  const res = await openai().audio.transcriptions.create({
    file,
    model: TRANSCRIBE_MODEL,
    response_format: "verbose_json",
    ...(language ? { language } : {}),
  });
  return { text: res.text, language: (res as { language?: string }).language };
}

async function transcribeWithGemini(
  file: File,
  language?: string,
): Promise<{ text: string; language?: string }> {
  if (file.size > GEMINI_INLINE_MAX_BYTES) {
    throw new Error(
      "Audio is too large for transcription (over ~18MB). Use a shorter clip or paste the transcript.",
    );
  }
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const model = gemini().getGenerativeModel({ model: GEMINI_MODEL });
  const langInstruction =
    language && LANG_DISPLAY[language]
      ? `The primary language is ${LANG_DISPLAY[language]}. `
      : "";
  const res = await model.generateContent([
    {
      text:
        `${langInstruction}Transcribe this meeting audio verbatim in the ORIGINAL spoken language(s). ` +
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
  return { text, language };
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
