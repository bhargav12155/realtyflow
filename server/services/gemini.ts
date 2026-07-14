import { GoogleGenAI } from "@google/genai";

interface ChatMessage {
  role: string;
  content: string;
}

export interface ChatImageInput {
  url: string;
  mediaType?: string;
}

interface GeminiChatResponse {
  success: boolean;
  message?: string;
  error?: string;
}

type GeminiMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

const SUPPORTED_GEMINI_MEDIA_TYPES: ReadonlySet<string> = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

function normalizeGeminiMediaType(mediaType?: string): GeminiMediaType {
  const lower = (mediaType || "").toLowerCase();
  if (lower === "image/jpg") return "image/jpeg";
  if (SUPPORTED_GEMINI_MEDIA_TYPES.has(lower)) {
    return lower as GeminiMediaType;
  }
  return "image/jpeg";
}

async function fetchImageAsBase64ForGemini(
  url: string,
  fallbackMediaType?: string
): Promise<{ data: string; mediaType: GeminiMediaType }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch image (${response.status} ${response.statusText}): ${url}`
    );
  }
  const headerType = response.headers.get("content-type") || undefined;
  const mediaType = normalizeGeminiMediaType(
    headerType?.split(";")[0]?.trim() || fallbackMediaType
  );
  const buffer = Buffer.from(await response.arrayBuffer());
  return { data: buffer.toString("base64"), mediaType };
}

export class GeminiService {
  private clientsByKey = new Map<string, GoogleGenAI>();

  private getApiKeyCandidates(): string[] {
    const candidates = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2]
      .map((k) => (k || "").trim())
      .filter((k) => k.length > 10);
    return Array.from(new Set(candidates));
  }

  private getClientForKey(apiKey: string): GoogleGenAI {
    const cached = this.clientsByKey.get(apiKey);
    if (cached) return cached;
    const created = new GoogleGenAI({ apiKey });
    this.clientsByKey.set(apiKey, created);
    return created;
  }

  private isAuthKeyError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error || "");
    const normalized = msg.toLowerCase();
    return (
      normalized.includes("api key") ||
      normalized.includes("permission_denied") ||
      normalized.includes("unauthorized") ||
      normalized.includes("403") ||
      normalized.includes("leaked")
    );
  }

  async chat(
    message: string,
    conversationHistory?: ChatMessage[],
    customSystemPrompt?: string,
    images?: ChatImageInput[]
  ): Promise<GeminiChatResponse> {
    const apiKeys = this.getApiKeyCandidates();

    if (apiKeys.length === 0) {
      console.error("❌ [Gemini] Cannot chat - GEMINI_API_KEY not configured");
      return { success: false, error: "Gemini API key not configured. Please add GEMINI_API_KEY to secrets." };
    }

    const hasImages = Array.isArray(images) && images.length > 0;

    const systemPrompt = customSystemPrompt || `You are a helpful AI assistant for real estate professionals. 
You help with:
- Creating social media posts and marketing content
- Writing blog articles and property descriptions
- Answering real estate marketing questions
- Providing market insights and advice
- Generating image and video ideas

Be professional, helpful, and focused on real estate marketing. Keep responses concise but informative.`;
    type GeminiPart =
      | { text: string }
      | { inlineData: { mimeType: string; data: string } };
    const contents: Array<{ role: string; parts: GeminiPart[] }> = [];

    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory) {
        const role = msg.role === "assistant" ? "model" : "user";
        contents.push({
          role,
          parts: [{ text: msg.content }],
        });
      }
    }

    const userParts: GeminiPart[] = [];
    if (hasImages) {
      for (const img of images!) {
        try {
          const { data, mediaType } = await fetchImageAsBase64ForGemini(img.url, img.mediaType);
          userParts.push({ inlineData: { mimeType: mediaType, data } });
        } catch (fetchErr) {
          const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
          console.error(`❌ [Gemini] Image fetch failed: ${errMsg}`);
          return { success: false, error: `Failed to load image for Gemini vision: ${errMsg}` };
        }
      }
      const textForVision = message && message.trim() !== ""
        ? message
        : "Please analyze the attached image(s).";
      userParts.push({ text: textForVision });
    } else {
      userParts.push({ text: message });
    }

    contents.push({
      role: "user",
      parts: userParts,
    });

    console.log(
      `💬 [Gemini] Processing chat message with gemini-2.5-flash${hasImages ? ` (vision: ${images!.length} image${images!.length === 1 ? "" : "s"})` : ""}`
    );

    let lastError = "Unknown Gemini error";
    for (let i = 0; i < apiKeys.length; i++) {
      const apiKey = apiKeys[i];
      const client = this.getClientForKey(apiKey);
      if (i === 0) {
        console.log("✅ [Gemini] Initializing Gemini client with primary API key");
      } else {
        console.warn(`⚠️ [Gemini] Retrying with fallback API key #${i + 1}`);
      }
      try {
        const response = await client.models.generateContent({
          model: "gemini-2.5-flash",
          contents,
          config: {
            systemInstruction: systemPrompt,
            maxOutputTokens: 1000,
          },
        });

        const responseText = response.text || "";
        if (!responseText) {
          lastError = "Received empty response from Gemini";
          continue;
        }

        console.log(`✅ [Gemini] Chat response received (${responseText.length} chars)`);
        return {
          success: true,
          message: responseText,
        };
      } catch (error: any) {
        const errMsg = error?.message || String(error);
        lastError = errMsg;
        console.error("❌ [Gemini] Chat error:", errMsg);
        // Try the next configured key when auth/key issues are detected.
        if (this.isAuthKeyError(error) && i < apiKeys.length - 1) {
          continue;
        }
      }
    }

    if (lastError.toLowerCase().includes("api key") || lastError.toLowerCase().includes("leaked")) {
      return { success: false, error: "Invalid Gemini API key. Please check your GEMINI_API_KEY secret." };
    }
    return { success: false, error: lastError };
  }

  isConfigured(): boolean {
    const count = this.getApiKeyCandidates().length;
    console.log(`🔑 [Gemini] isConfigured check: ${count} Gemini key(s) present`);
    return count > 0;
  }
}

export const geminiService = new GeminiService();
