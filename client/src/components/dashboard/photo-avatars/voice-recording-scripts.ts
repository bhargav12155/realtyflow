export interface VoiceReadingScript {
  id: string;
  title: string;
  language: string;
  locale: string;
  estimatedDurationSeconds: number;
  lines: string[];
}

export const VOICE_RECORDING_MIN_SECONDS = 15;
export const VOICE_RECORDING_RECOMMENDED_SECONDS = {
  min: 20,
  max: 30,
} as const;

export const VOICE_READING_SCRIPTS: VoiceReadingScript[] = [
  {
    id: "en-us-professional-intro",
    title: "Professional Introduction",
    language: "English",
    locale: "en-US",
    estimatedDurationSeconds: 19,
    lines: [
      "Hello, this is a quick sample of my natural speaking voice.",
      "I help clients buy and sell homes with confidence and clarity.",
      "I focus on honest advice, steady communication, and smooth closings.",
      "My goal is to sound warm, professional, and easy to understand in every message.",
      "Thank you for listening to this recording today.",
    ],
  },
];

export const DEFAULT_VOICE_READING_SCRIPT_ID = "en-us-professional-intro";

export function getDefaultVoiceReadingScript(): VoiceReadingScript {
  return (
    VOICE_READING_SCRIPTS.find((script) => script.id === DEFAULT_VOICE_READING_SCRIPT_ID) ??
    VOICE_READING_SCRIPTS[0]
  );
}
