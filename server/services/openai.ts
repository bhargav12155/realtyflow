import { GoogleGenAI } from "@google/genai";

// All AI generation now uses Google Gemini 2.5 Flash as the primary provider.
// The OpenAI interface is preserved so all call sites work without changes.

const GEMINI_MODEL = "gemini-2.5-flash";

function getGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
}

// Gemini-compatible client that mimics the OpenAI client interface.
// Used by makeRequest() so existing callbacks work unchanged.
function createGeminiCompatibleClient() {
  const genAI = getGeminiClient();

  return {
    chat: {
      completions: {
        async create(params: any): Promise<any> {
          const systemMsg = params.messages?.find((m: any) => m.role === "system")?.content;
          const otherMessages: any[] = params.messages?.filter((m: any) => m.role !== "system") || [];

          const contents = otherMessages.map((m: any) => {
            const role = m.role === "assistant" ? "model" : "user";
            if (Array.isArray(m.content)) {
              const parts = m.content.map((part: any) => {
                if (part.type === "text") return { text: part.text };
                if (part.type === "image_url") {
                  return { text: `[Analyze this image: ${part.image_url?.url}]` };
                }
                return { text: String(part) };
              });
              return { role, parts };
            }
            return { role, parts: [{ text: m.content || "" }] };
          });

          const config: any = {
            maxOutputTokens: params.max_completion_tokens || params.max_tokens || 2000,
          };
          if (systemMsg) config.systemInstruction = systemMsg;
          if (params.response_format?.type === "json_object") {
            config.responseMimeType = "application/json";
          }

          const response = await genAI.models.generateContent({
            model: GEMINI_MODEL,
            contents,
            config,
          });

          const text = response.text || "";
          return {
            choices: [{ message: { content: text, role: "assistant" }, finish_reason: "stop" }],
            model: GEMINI_MODEL,
            usage: { total_tokens: 0 },
          };
        },
      },
    },
    images: {
      async generate(_params: any): Promise<any> {
        console.warn("⚠️ [Gemini] Image generation (DALL-E) not available — returning null");
        return { data: [{ url: null }] };
      },
    },
  };
}

interface APIKeyConfig {
  key: string;
  name: string;
  isAvailable: boolean;
  lastError?: Date;
  quotaResetTime?: Date;
  requestCount: number;
  priority: number;
  capabilities: string[];
  costTier: "free" | "paid" | "premium";
}

class MultiOpenAIService {
  private apiKeys: APIKeyConfig[] = [];

  constructor() {
    this.loadAPIKeys();
  }

  private loadAPIKeys() {
    const geminiKey = process.env.GEMINI_API_KEY || "";
    if (geminiKey && geminiKey.length > 10) {
      this.apiKeys = [
        {
          key: geminiKey,
          name: "Primary Key (paid)",
          isAvailable: true,
          requestCount: 0,
          priority: 100,
          capabilities: ["content", "vision", "code", "analysis", "advanced"],
          costTier: "paid",
        },
      ];
    }
    console.log(
      `🔑 Loaded ${this.apiKeys.length} OpenAI API keys:`,
      this.apiKeys.map((k) => k.name)
    );
    if (this.apiKeys.length === 0) {
      console.warn("⚠️ No valid GEMINI_API_KEY found. Please set it in environment variables.");
    }
  }

  getBestKeyForTask(_taskType: string): APIKeyConfig | null {
    const available = this.apiKeys.filter((k) => k.isAvailable);
    return available[0] || null;
  }

  markKeyUnavailable(keyName: string, errorType: string) {
    const key = this.apiKeys.find((k) => k.name === keyName);
    if (key) {
      key.isAvailable = false;
      key.lastError = new Date();
      const cooldown =
        errorType === "quota_exceeded" ? 24 * 60 * 60 * 1000 :
        errorType === "rate_limit" ? 60 * 1000 : 5 * 60 * 1000;
      key.quotaResetTime = new Date(Date.now() + cooldown);
    }
  }

  checkKeyAvailability() {
    const now = new Date();
    this.apiKeys.forEach((key) => {
      if (!key.isAvailable && key.quotaResetTime && now > key.quotaResetTime) {
        key.isAvailable = true;
        key.quotaResetTime = undefined;
        key.lastError = undefined;
      }
    });
  }

  forceResetAllKeys() {
    this.apiKeys.forEach((key) => {
      key.isAvailable = true;
      key.quotaResetTime = undefined;
      key.lastError = undefined;
      key.requestCount = 0;
    });
  }

  getStatus() {
    return {
      totalKeys: this.apiKeys.length,
      availableKeys: this.apiKeys.filter((k) => k.isAvailable).length,
      keys: this.apiKeys.map((key) => ({
        name: key.name,
        isAvailable: key.isAvailable,
        capabilities: key.capabilities,
        requestCount: key.requestCount,
        priority: key.priority,
        costTier: key.costTier,
        lastError: key.lastError,
        quotaResetTime: key.quotaResetTime,
      })),
    };
  }

  async makeRequest(
    taskType: string,
    requestFn: (client: any) => Promise<any>
  ): Promise<any> {
    this.checkKeyAvailability();
    const key = this.getBestKeyForTask(taskType);
    if (!key) {
      throw new Error("No available API keys for this task");
    }

    const client = createGeminiCompatibleClient();
    try {
      const result = await requestFn(client);
      key.requestCount++;
      return result;
    } catch (error: any) {
      console.error(`❌ Gemini request failed:`, error.message);
      this.markKeyUnavailable(key.name, "api_error");
      throw error;
    }
  }
}

const multiOpenAI = new MultiOpenAIService();

export interface CompanyProfileData {
  businessName?: string;
  agentName?: string;
  agentTitle?: string;
  phone?: string;
  email?: string;
  brokerageName?: string;
  tagline?: string;
}

export interface ContentGenerationRequest {
  type: "blog" | "social" | "property_feature";
  topic: string;
  userId?: string;
  aiPrompt?: string;
  neighborhood?: string;
  keywords?: string[];
  seoOptimized?: boolean;
  longTailKeywords?: boolean;
  localSeoFocus?: boolean;
  companyProfile?: CompanyProfileData;
  propertyData?: {
    id: string;
    mlsNumber: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    price: number;
    bedrooms: number;
    bathrooms: number;
    squareFootage: number;
    propertyType: string;
    description?: string;
    yearBuilt?: number;
    listingAgent?: string;
    photos?: string[];
  };
}

export interface GeneratedContent {
  title: string;
  content: string;
  keywords: string[];
  metaDescription?: string;
  seoScore?: number;
  wordCount: number;
  seoBreakdown?: {
    keywordOptimization: number;
    contentStructure: number;
    localSEO: number;
    contentQuality: number;
    metaOptimization: number;
    callToAction: number;
  };
}

export class OpenAIService {
  async generateContent(request: ContentGenerationRequest): Promise<GeneratedContent> {
    try {
      const prompt = this.buildPrompt(request);
      const { getCompanyProfileOrDefaults } = await import("../utils/profile-helper");
      const storage = (await import("../storage")).storage;
      const profile = await getCompanyProfileOrDefaults(storage, request.userId);

      const agentName = request.companyProfile?.agentName || profile.agentName || "[Your Name]";
      const businessName = request.companyProfile?.businessName || profile.businessName || profile.brokerageName || "[Your Business]";
      const agentTitle = request.companyProfile?.agentTitle || profile.agentTitle || "real estate professional";

      const genAI = getGeminiClient();
      const response = await genAI.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: `You are an expert real estate content writer and SEO specialist focused on the Omaha, Nebraska market. Generate high-quality, SEO-optimized content for ${agentName}, a top ${agentTitle} with ${businessName} in Omaha. Always include ${agentName}'s name and credentials for better SEO and personal branding. Always respond with valid JSON.`,
          maxOutputTokens: 2000,
          responseMimeType: "application/json",
        },
      });

      const result = JSON.parse(response.text || "{}");
      return {
        title: result.title || "Untitled Content",
        content: result.content || "",
        keywords: result.keywords || [],
        metaDescription: result.metaDescription,
        seoScore: result.seoScore || 0,
        wordCount: result.wordCount || 0,
      };
    } catch (error) {
      console.error("Gemini content generation error:", error);
      return this.getFallbackContent(request);
    }
  }

  private buildPrompt(request: ContentGenerationRequest): string {
    let prompt = `Generate ${request.type} content about "${request.topic}"`;

    if (request.neighborhood) {
      prompt += ` focusing on the ${request.neighborhood} neighborhood in Omaha, Nebraska`;
    } else {
      prompt += ` for the Omaha, Nebraska real estate market`;
    }

    if (request.aiPrompt && request.aiPrompt.trim()) {
      prompt += `\n\nCustom Instructions: ${request.aiPrompt.trim()}`;
    }

    prompt += `\n\nRequirements:`;

    if (request.type === "blog") {
      prompt += `
      - Create a comprehensive blog post (800-1200 words)
      - Include an engaging title and meta description
      - Structure with clear headings and subheadings
      - Focus on providing valuable information to potential buyers/sellers`;
    } else if (request.type === "social") {
      prompt += `
      - Create engaging social media content (150-300 characters)
      - Include relevant hashtags
      - Focus on engagement and lead generation`;
    } else if (request.type === "property_feature") {
      if (request.propertyData) {
        const property = request.propertyData;
        prompt += `
      - Create compelling property feature content for MLS# ${property.mlsNumber}
      - Property: ${property.address}, ${property.city}
      - Price: $${property.price.toLocaleString()}
      - ${property.bedrooms}BR/${property.bathrooms}BA, ${property.squareFootage.toLocaleString()} sq ft
      - Property Type: ${property.propertyType}
      - Highlight the unique features and benefits of this specific property`;
      } else {
        prompt += `\n      - Create compelling property description content`;
      }
      prompt += `\n      - Include calls-to-action for interested buyers`;
    }

    if (request.seoOptimized) {
      prompt += `
      - Optimize for SEO with natural keyword integration (aim for 80%+ SEO score)
      - Include relevant long-tail keywords for Omaha real estate
      - Use proper heading structure (H1, H2, H3) for blog posts`;
    }

    if (request.keywords && request.keywords.length > 0) {
      prompt += `\n      - Incorporate these specific keywords: ${request.keywords.join(", ")}`;
    }

    prompt += `
    
    Respond with JSON in this exact format:
    {
      "title": "SEO-optimized title with primary keyword",
      "content": "Full content with proper formatting and structure",
      "metaDescription": "150-160 character meta description with keyword",
      "keywords": ["primary keyword", "secondary keyword 1", "secondary keyword 2"],
      "seoScore": 85,
      "wordCount": 1200,
      "seoBreakdown": {
        "keywordOptimization": 25,
        "contentStructure": 20,
        "localSEO": 20,
        "contentQuality": 15,
        "metaOptimization": 10,
        "callToAction": 10
      }
    }`;

    return prompt;
  }

  async generateSocialMediaPost(
    topic: string,
    platform: string,
    neighborhood?: string,
    companyProfile?: CompanyProfileData
  ): Promise<any> {
    try {
      const agentName = companyProfile?.agentName || "your local real estate agent";
      const businessName = companyProfile?.businessName || companyProfile?.brokerageName || "our brokerage";

      const prompt = `Create a ${platform} post about "${topic}" for ${neighborhood || "Omaha"} real estate. 
      Include ${agentName} as the real estate agent and reference ${businessName}.
      Platform: ${platform}. Keep it engaging, on-brand, and include relevant hashtags.
      Respond with JSON: { "content": "post text", "hashtags": ["tag1", "tag2"], "characterCount": 0 }`;

      const genAI = getGeminiClient();
      const response = await genAI.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: "You are an expert social media content creator for real estate. Always respond with valid JSON.",
          maxOutputTokens: 800,
          responseMimeType: "application/json",
        },
      });

      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("Gemini social media post error:", error);
      return { content: `Check out our latest listings in ${neighborhood || "Omaha"}! #RealEstate #Omaha`, hashtags: ["RealEstate", "Omaha"] };
    }
  }

  async generatePlatformSpecificContent(params: {
    topic: string;
    platform: string;
    postType: string;
    neighborhood?: string;
    companyProfile?: CompanyProfileData;
    propertyData?: any;
    customPrompt?: string;
  }): Promise<any> {
    try {
      const agentName = params.companyProfile?.agentName || "your local real estate agent";
      const prompt = `Create a ${params.platform} ${params.postType} post about "${params.topic}" for ${params.neighborhood || "Omaha"} real estate by ${agentName}.
      ${params.customPrompt ? `Additional instructions: ${params.customPrompt}` : ""}
      ${params.propertyData ? `Property details: ${JSON.stringify(params.propertyData)}` : ""}
      Make it engaging and platform-appropriate. Respond with JSON: { "content": "post text", "hashtags": ["tag1"], "characterCount": 0 }`;

      const genAI = getGeminiClient();
      const response = await genAI.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: "You are an expert social media content creator for real estate. Always respond with valid JSON.",
          maxOutputTokens: 800,
          responseMimeType: "application/json",
        },
      });

      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("Gemini platform-specific content error:", error);
      return { content: `${params.topic} in ${params.neighborhood || "Omaha"} - contact us today! #RealEstate`, hashtags: ["RealEstate"] };
    }
  }

  async generateVideoScript(params: {
    topic: string;
    neighborhood?: string;
    duration?: number;
    platform?: string;
    videoType?: string;
    customPrompt?: string;
    companyProfile?: CompanyProfileData;
  }): Promise<string> {
    try {
      const { topic, neighborhood, duration = 30, platform = "Instagram Reel", videoType = "market update", customPrompt, companyProfile } = params;
      const agentName = companyProfile?.agentName || "your real estate agent";
      const businessName = companyProfile?.businessName || companyProfile?.brokerageName || "our brokerage";
      const locationText = neighborhood ? `${neighborhood}, Omaha` : "Omaha, Nebraska";

      const prompt = `Create a ${duration}-second video script for ${agentName} with ${businessName} in ${locationText}.
Platform: ${platform}
Video type: ${videoType}
Duration: EXACTLY ${duration} seconds (~${Math.round(duration * 2.5)} words)
Topic: ${topic}
${customPrompt ? `Additional instructions: ${customPrompt}` : ""}

RULES:
- Write ONLY the spoken script text - no stage directions, brackets, or timestamps
- Natural, conversational tone suitable for AI avatar
- Make every word count`;

      const genAI = getGeminiClient();
      const response = await genAI.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: "You are a professional video script writer specializing in real estate social media content. Output ONLY the script text - no stage directions, no brackets, no timestamps.",
          maxOutputTokens: 800,
        },
      });

      return response.text || "Script generation failed";
    } catch (error) {
      console.error("Gemini video script error:", error);
      const agentName = params.companyProfile?.agentName || "Mike Bjork";
      const businessName = params.companyProfile?.businessName || params.companyProfile?.brokerageName || "Berkshire Hathaway HomeServices";
      return `Hi, I'm ${agentName} with ${businessName} here in Omaha. Today I want to talk to you about ${params.topic} in ${params.neighborhood || "Omaha"}. I'd love to help you navigate these opportunities. Give me a call — I'm ${agentName} and I'm here to make your real estate dreams a reality.`;
    }
  }

  async generateImage({ prompt, size = "1024x1024" }: { prompt: string; size?: string }): Promise<string | null> {
    console.warn("⚠️ [Gemini] Image generation not available with Gemini API. Returning null.");
    return null;
  }

  async analyzeImage(imageUrl: string, prompt: string): Promise<string | null> {
    try {
      const genAI = getGeminiClient();
      const response = await genAI.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { text: `[Image URL for analysis: ${imageUrl}]` },
            ],
          },
        ],
        config: { maxOutputTokens: 300 },
      });
      return response.text || null;
    } catch (error) {
      console.error("Gemini image analysis error:", error);
      return null;
    }
  }

  async enhanceContent({
    originalContent,
    customPrompt,
    platform,
    postType,
  }: {
    originalContent: string;
    customPrompt: string;
    platform: string;
    postType: string;
  }): Promise<string> {
    try {
      const prompt = `${customPrompt}

Original Content:
"${originalContent}"

Platform: ${platform}
Post Type: ${postType}

Requirements:
- Maintain the professional brand voice
- Include relevant Omaha, Nebraska local SEO keywords
- Optimize for ${platform} platform best practices
- Keep content engaging and authentic
- Ensure call-to-action is clear

Please enhance this content while keeping the same core message and format. Return only the enhanced content text.`;

      const genAI = getGeminiClient();
      const response = await genAI.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: "You are an expert content optimizer specializing in real estate social media and SEO for the Omaha, Nebraska market.",
          maxOutputTokens: 500,
        },
      });

      return response.text || originalContent;
    } catch (error) {
      console.error("Gemini content enhancement error:", error);
      return originalContent;
    }
  }

  private getFallbackContent(request: ContentGenerationRequest): GeneratedContent {
    const { type, topic, neighborhood } = request;
    const agentName = request.companyProfile?.agentName || "your local real estate agent";
    const businessName = request.companyProfile?.businessName || request.companyProfile?.brokerageName || "our brokerage";

    const content = type === "social"
      ? `🏡 Thinking about ${topic.toLowerCase()} in ${neighborhood || "Omaha"}? Contact ${agentName} with ${businessName} for expert real estate guidance! #OmahaRealEstate`
      : `Looking for expert real estate guidance in ${neighborhood || "Omaha"}? Contact ${agentName} with ${businessName} for professional service and local market expertise.`;

    return {
      title: `${topic} - ${neighborhood || "Omaha"} Real Estate`,
      content,
      keywords: ["Omaha real estate", neighborhood ? `${neighborhood} homes` : "Nebraska homes", topic],
      metaDescription: `${topic} in ${neighborhood || "Omaha"} with ${agentName}`,
      seoScore: 45,
      wordCount: content.split(" ").length,
    };
  }
}

export const getAPIKeyStatus = () => multiOpenAI.getStatus();
export { multiOpenAI };
export const openaiService = new OpenAIService();
