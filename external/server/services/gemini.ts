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
  private client: GoogleGenAI | null = null;
  private lastApiKey: string | null = null;

  private getClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn("⚠️ [Gemini] No GEMINI_API_KEY found in environment");
      return null;
    }
    
    if (this.client && this.lastApiKey === apiKey) {
      return this.client;
    }
    
    console.log("✅ [Gemini] Initializing Gemini client with API key");
    this.client = new GoogleGenAI({ apiKey });
    this.lastApiKey = apiKey;
    return this.client;
  }

  async chat(
    message: string,
    conversationHistory?: ChatMessage[],
    customSystemPrompt?: string,
    images?: ChatImageInput[]
  ): Promise<GeminiChatResponse> {
    const client = this.getClient();
    
    if (!client) {
      console.error("❌ [Gemini] Cannot chat - GEMINI_API_KEY not configured");
      return { success: false, error: "Gemini API key not configured. Please add GEMINI_API_KEY to secrets." };
    }

    const hasImages = Array.isArray(images) && images.length > 0;

    try {
      console.log(
        `💬 [Gemini] Processing chat message with gemini-2.5-flash${hasImages ? ` (vision: ${images!.length} image${images!.length === 1 ? "" : "s"})` : ""}`
      );

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
            throw new Error(`Failed to load image for Gemini vision: ${errMsg}`);
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
        console.error("❌ [Gemini] Empty response from API");
        return { success: false, error: "Received empty response from Gemini" };
      }

      console.log(`✅ [Gemini] Chat response received (${responseText.length} chars)`);

      return {
        success: true,
        message: responseText,
      };
    } catch (error: any) {
      console.error("❌ [Gemini] Chat error:", error.message);
      if (error.message?.includes("API key")) {
        return { success: false, error: "Invalid Gemini API key. Please check your GEMINI_API_KEY secret." };
      }
      return { success: false, error: error.message };
    }
  }

  isConfigured(): boolean {
    const hasKey = !!process.env.GEMINI_API_KEY;
    console.log(`🔑 [Gemini] isConfigured check: GEMINI_API_KEY ${hasKey ? 'present' : 'missing'}`);
    return hasKey;
  }
}

export const geminiService = new GeminiService();
