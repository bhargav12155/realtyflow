import { GoogleGenAI } from "@google/genai";

interface ChatMessage {
  role: string;
  content: string;
}

interface GeminiChatResponse {
  success: boolean;
  message?: string;
  error?: string;
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

  async chat(message: string, conversationHistory?: ChatMessage[], customSystemPrompt?: string): Promise<GeminiChatResponse> {
    const client = this.getClient();
    
    if (!client) {
      console.error("❌ [Gemini] Cannot chat - GEMINI_API_KEY not configured");
      return { success: false, error: "Gemini API key not configured. Please add GEMINI_API_KEY to secrets." };
    }

    try {
      console.log(`💬 [Gemini] Processing chat message with gemini-2.5-flash`);

      const systemPrompt = customSystemPrompt || `You are a helpful AI assistant for real estate professionals. 
You help with:
- Creating social media posts and marketing content
- Writing blog articles and property descriptions
- Answering real estate marketing questions
- Providing market insights and advice
- Generating image and video ideas

Be professional, helpful, and focused on real estate marketing. Keep responses concise but informative.`;

      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

      if (conversationHistory && conversationHistory.length > 0) {
        for (const msg of conversationHistory) {
          const role = msg.role === "assistant" ? "model" : "user";
          contents.push({
            role,
            parts: [{ text: msg.content }],
          });
        }
      }

      contents.push({
        role: "user",
        parts: [{ text: message }],
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
