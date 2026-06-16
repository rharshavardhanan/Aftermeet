// Supported transcription languages — a two-tier system:
//   • `whisper: true`  → Whisper (Groq/OpenAI) handles it with high accuracy.
//   • `whisper: false` → Whisper has no/poor support; we route audio to Gemini
//     multimodal transcription (broad, instructable coverage; best-effort).
//
// `bootstrap` is native-script seed text fed as Whisper's initial prompt so the
// decoder commits to the target script instead of phonetic English.

export interface LangSpec {
  code: string;
  label: string;
  whisper: boolean;
  bootstrap?: string;
}

export const LANGUAGES: LangSpec[] = [
  // ── Indian languages: Whisper-supported ──
  { code: 'hi', label: 'Hindi', whisper: true, bootstrap: 'नमस्ते। यह एक हिंदी और अंग्रेजी व्यापार बैठक है।' },
  { code: 'bn', label: 'Bengali', whisper: true, bootstrap: 'নমস্কার। এটি একটি বাংলা এবং ইংরেজি ব্যবসায়িক বৈঠক।' },
  { code: 'ta', label: 'Tamil', whisper: true, bootstrap: 'நமஸ்கார. இது தமிழ் மற்றும் ஆங்கில வணிக கூட்டம்.' },
  { code: 'te', label: 'Telugu', whisper: true, bootstrap: 'నమస్కారం. ఇది తెలుగు మరియు ఆంగ్ల వ్యాపార సమావేశం.' },
  { code: 'kn', label: 'Kannada', whisper: true, bootstrap: 'ನಮಸ್ಕಾರ. ಇದು ಕನ್ನಡ ಮತ್ತು ಇಂಗ್ಲಿಷ್ ವ್ಯಾಪಾರ ಸಭೆ.' },
  { code: 'ml', label: 'Malayalam', whisper: true, bootstrap: 'നമസ്കാരം. ഇത് ഒരു മലയാള ഇംഗ്ലീഷ് ബിസിനസ് മീറ്റിംഗ് ആണ്.' },
  { code: 'mr', label: 'Marathi', whisper: true, bootstrap: 'नमस्कार. ही एक मराठी आणि इंग्रजी व्यावसायिक बैठक आहे.' },
  { code: 'gu', label: 'Gujarati', whisper: true, bootstrap: 'નમસ્તે. આ એક ગુજરાતી અને અંગ્રેજી વ્યવસાય બેઠક છે.' },
  { code: 'pa', label: 'Punjabi', whisper: true, bootstrap: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ। ਇਹ ਇੱਕ ਪੰਜਾਬੀ ਅਤੇ ਅੰਗਰੇਜ਼ੀ ਕਾਰੋਬਾਰੀ ਮੀਟਿੰਗ ਹੈ।' },
  { code: 'ur', label: 'Urdu', whisper: true, bootstrap: 'السلام علیکم۔ یہ ایک اردو اور انگریزی کاروباری میٹنگ ہے۔' },
  { code: 'as', label: 'Assamese', whisper: true },
  { code: 'ne', label: 'Nepali', whisper: true },
  { code: 'sa', label: 'Sanskrit', whisper: true },
  { code: 'sd', label: 'Sindhi', whisper: true },
  // ── Indian languages: Gemini fallback (not in Whisper) ──
  { code: 'or', label: 'Odia', whisper: false },
  { code: 'ks', label: 'Kashmiri', whisper: false },
  { code: 'kok', label: 'Konkani', whisper: false },
  { code: 'mni', label: 'Manipuri (Meitei)', whisper: false },
  { code: 'sat', label: 'Santali', whisper: false },
  { code: 'bho', label: 'Bhojpuri', whisper: false },
  { code: 'mai', label: 'Maithili', whisper: false },
  { code: 'doi', label: 'Dogri', whisper: false },
  { code: 'brx', label: 'Bodo', whisper: false },
  { code: 'awa', label: 'Awadhi', whisper: false },
  // ── Other major world languages: Whisper-supported ──
  { code: 'en', label: 'English', whisper: true },
  { code: 'ar', label: 'Arabic', whisper: true, bootstrap: 'السلام عليكم. هذا اجتماع عمل باللغة العربية والإنجليزية.' },
  { code: 'zh', label: 'Chinese', whisper: true, bootstrap: '你好。这是一次中英文混合商务会议。' },
  { code: 'ja', label: 'Japanese', whisper: true, bootstrap: 'こんにちは。これは日本語と英語のビジネス会議です。' },
  { code: 'ko', label: 'Korean', whisper: true, bootstrap: '안녕하세요. 이것은 한국어와 영어 비즈니스 회의입니다.' },
  { code: 'fr', label: 'French', whisper: true },
  { code: 'de', label: 'German', whisper: true },
  { code: 'es', label: 'Spanish', whisper: true },
  { code: 'pt', label: 'Portuguese', whisper: true },
  { code: 'ru', label: 'Russian', whisper: true },
  { code: 'it', label: 'Italian', whisper: true },
  { code: 'nl', label: 'Dutch', whisper: true },
  { code: 'tr', label: 'Turkish', whisper: true },
  { code: 'pl', label: 'Polish', whisper: true },
  { code: 'uk', label: 'Ukrainian', whisper: true },
  { code: 'vi', label: 'Vietnamese', whisper: true },
  { code: 'th', label: 'Thai', whisper: true },
  { code: 'id', label: 'Indonesian', whisper: true },
  { code: 'fa', label: 'Persian', whisper: true },
  { code: 'he', label: 'Hebrew', whisper: true },
  { code: 'sw', label: 'Swahili', whisper: true },
  { code: 'fil', label: 'Filipino', whisper: false },
];

export const LANG_BY_CODE: Record<string, LangSpec> = Object.fromEntries(
  LANGUAGES.map((l) => [l.code, l]),
);
