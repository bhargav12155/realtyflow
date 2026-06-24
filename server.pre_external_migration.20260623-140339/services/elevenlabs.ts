import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  labels?: Record<string, string>;
  preview_url?: string;
}

interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

interface TextToSpeechRequest {
  text: string;
  voiceId: string;
  modelId?: string;
  voiceSettings?: VoiceSettings;
  outputFormat?: string;
}

interface TextToSpeechResult {
  success: boolean;
  audioUrl?: string;
  audioBuffer?: Buffer;
  error?: string;
}

class ElevenLabsService {
  private apiKey: string;

  constructor() {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY environment variable is not set");
    }
    this.apiKey = apiKey;
  }

  async getVoices(): Promise<ElevenLabsVoice[]> {
    try {
      const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
        method: "GET",
        headers: {
          "xi-api-key": this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ ElevenLabs get voices error:", response.status, errorText);
        return [];
      }

      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error("❌ Error fetching ElevenLabs voices:", error);
      return [];
    }
  }

  async textToSpeech(request: TextToSpeechRequest): Promise<TextToSpeechResult> {
    try {
      console.log("🎙️ ElevenLabs: Generating speech...");
      console.log("📝 Text:", request.text.substring(0, 50) + (request.text.length > 50 ? "..." : ""));
      console.log("🔊 Voice ID:", request.voiceId);

      const outputFormat = request.outputFormat || "mp3_44100_128";
      const response = await fetch(
        `${ELEVENLABS_API_URL}/text-to-speech/${request.voiceId}?output_format=${outputFormat}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": this.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: request.text,
            model_id: request.modelId || "eleven_multilingual_v2",
            voice_settings: request.voiceSettings || {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ ElevenLabs TTS error:", response.status, errorText);
        return {
          success: false,
          error: `ElevenLabs API error: ${response.status} - ${errorText}`,
        };
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      console.log("✅ ElevenLabs: Audio generated, size:", audioBuffer.length, "bytes");

      return {
        success: true,
        audioBuffer,
      };
    } catch (error) {
      console.error("❌ ElevenLabs TTS error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async textToSpeechWithUpload(request: TextToSpeechRequest): Promise<TextToSpeechResult> {
    const result = await this.textToSpeech(request);
    
    if (!result.success || !result.audioBuffer) {
      return result;
    }

    try {
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
        },
      });

      const bucketName = process.env.AWS_S3_BUCKET || "";
      const fileName = `elevenlabs-audio/${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: fileName,
          Body: result.audioBuffer,
          ContentType: "audio/mpeg",
        })
      );

      const audioUrl = `https://${bucketName}.s3.amazonaws.com/${fileName}`;
      console.log("✅ Audio uploaded to S3:", audioUrl);

      return {
        success: true,
        audioUrl,
      };
    } catch (error) {
      console.error("❌ Error uploading audio to S3:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to upload audio",
      };
    }
  }
}

export async function getElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
  try {
    const service = new ElevenLabsService();
    return service.getVoices();
  } catch (error) {
    console.error("❌ Error creating ElevenLabs service:", error);
    return [];
  }
}

export async function generateSpeech(
  text: string,
  voiceId: string,
  options?: {
    modelId?: string;
    stability?: number;
    similarityBoost?: number;
    uploadToS3?: boolean;
    outputFormat?: string;
  }
): Promise<TextToSpeechResult> {
  try {
    const service = new ElevenLabsService();
    
    const request: TextToSpeechRequest = {
      text,
      voiceId,
      modelId: options?.modelId,
      outputFormat: options?.outputFormat || "mp3_44100_128",
      voiceSettings: {
        stability: options?.stability ?? 0.5,
        similarity_boost: options?.similarityBoost ?? 0.75,
      },
    };

    if (options?.uploadToS3) {
      return service.textToSpeechWithUpload(request);
    }
    
    return service.textToSpeech(request);
  } catch (error) {
    console.error("❌ Error generating speech:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function isElevenLabsConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}

export const DEFAULT_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", description: "American female, calm" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", description: "American female, strong" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", description: "American female, soft" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", description: "American male, well-rounded" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", description: "American female, emotional" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", description: "American male, deep" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", description: "American male, crisp" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", description: "American male, deep" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", description: "American male, raspy" },
];
