import Anthropic from "@anthropic-ai/sdk";

const CLAUDE_MODEL = "claude-sonnet-4-5";

interface ChatMessage {
  role: string;
  content: string;
}

export interface ChatImageInput {
  url: string;
  mediaType?: string;
}

interface AnthropicChatResponse {
  success: boolean;
  message?: string;
  error?: string;
}

type ClaudeMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

const SUPPORTED_MEDIA_TYPES: ReadonlySet<string> = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

function normalizeMediaType(mediaType?: string): ClaudeMediaType {
  const lower = (mediaType || "").toLowerCase();
  if (lower === "image/jpg") return "image/jpeg";
  if (SUPPORTED_MEDIA_TYPES.has(lower)) {
    return lower as ClaudeMediaType;
  }
  return "image/jpeg";
}

async function fetchImageAsBase64(
  url: string,
  fallbackMediaType?: string
): Promise<{ data: string; mediaType: ClaudeMediaType }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch image (${response.status} ${response.statusText}): ${url}`
    );
  }
  const headerType = response.headers.get("content-type") || undefined;
  const mediaType = normalizeMediaType(
    headerType?.split(";")[0]?.trim() || fallbackMediaType
  );
  const buffer = Buffer.from(await response.arrayBuffer());
  return { data: buffer.toString("base64"), mediaType };
}

export class AnthropicService {
  private client: Anthropic | null = null;
  private lastApiKey: string | null = null;

  private getClient(): Anthropic | null {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn("⚠️ [Anthropic] No ANTHROPIC_API_KEY found in environment");
      return null;
    }
    if (this.client && this.lastApiKey === apiKey) {
      return this.client;
    }
    console.log("✅ [Anthropic] Initializing Claude client");
    this.client = new Anthropic({ apiKey });
    this.lastApiKey = apiKey;
    return this.client;
  }

  async chat(
    message: string,
    conversationHistory?: ChatMessage[],
    customSystemPrompt?: string,
    images?: ChatImageInput[]
  ): Promise<AnthropicChatResponse> {
    const client = this.getClient();
    if (!client) {
      return {
        success: false,
        error: "Claude API key not configured. Please add ANTHROPIC_API_KEY to secrets.",
      };
    }

    try {
      const hasImages = Array.isArray(images) && images.length > 0;
      console.log(
        `💬 [Anthropic] Processing chat with ${CLAUDE_MODEL}${hasImages ? ` (vision: ${images!.length} image${images!.length === 1 ? "" : "s"})` : ""}`
      );

      const systemPrompt =
        customSystemPrompt ||
        `You are a helpful AI assistant for real estate professionals. Be professional, helpful, and focused on real estate marketing. Keep responses concise but informative.`;

      const messages: Array<{
        role: "user" | "assistant";
        content: string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>;
      }> = [];

      if (conversationHistory && conversationHistory.length > 0) {
        for (const msg of conversationHistory) {
          const role = msg.role === "assistant" ? "assistant" : "user";
          messages.push({ role, content: msg.content });
        }
      }

      if (hasImages) {
        const contentBlocks: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [];
        for (const img of images!) {
          try {
            const { data, mediaType } = await fetchImageAsBase64(img.url, img.mediaType);
            contentBlocks.push({
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data,
              },
            });
          } catch (fetchErr) {
            const errMsg =
              fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
            console.error(`❌ [Anthropic] Image fetch failed: ${errMsg}`);
            throw new Error(`Failed to load image for Claude vision: ${errMsg}`);
          }
        }
        if (message && message.trim() !== "") {
          contentBlocks.push({ type: "text", text: message });
        } else {
          contentBlocks.push({
            type: "text",
            text: "Please analyze the attached image(s).",
          });
        }
        messages.push({ role: "user", content: contentBlocks });
      } else {
        messages.push({ role: "user", content: message });
      }

      const response = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages,
      });

      const textBlock = response.content.find(
        (b): b is Anthropic.TextBlock => b.type === "text"
      );
      const text = textBlock?.text ?? "";

      if (!text || text.trim() === "") {
        return {
          success: false,
          error: "Claude returned an empty response. Please try again.",
        };
      }

      return { success: true, message: text };
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : "Claude chat failed";
      console.error("❌ [Anthropic] Chat error:", errMessage);
      return {
        success: false,
        error: errMessage,
      };
    }
  }
}

export const anthropicService = new AnthropicService();
