import { GoogleGenAI } from "@google/genai";

// All AI generation now uses Google Gemini 2.5 Flash as the primary provider.
// The OpenAI interface is preserved so all call sites work without changes.

const GEMINI_MODEL = "gemini-2.5-flash";

function getGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
}

async function fetchImageAsBase64(
  url: string,
): Promise<{ base64: string; mimeType: string } | null> {
  try {
    if (url.startsWith("data:")) {
      const match = url.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return null;
      return { mimeType: match[1], base64: match[2] };
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type") || "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    return { base64: buf.toString("base64"), mimeType };
  } catch {
    return null;
  }
}

function extractJSON(raw: string, fallback: any = {}): any {
  try {
    const stripped = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const match = stripped.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    let parsed = JSON.parse(match ? match[0] : stripped);
    
    // Recursive unwrap and prefix stripping
    const unwrap = (obj: any): any => {
      if (typeof obj === "string") {
        const clean = obj.replace(/^(promote[ _]app|promoteapp)\s*/i, "").trim();
        if (clean.startsWith("{") || clean.startsWith("[")) {
          try { return unwrap(JSON.parse(clean)); } catch { return clean; }
        }
        return clean;
      }
      if (obj && typeof obj === "object") {
        if (obj.content) obj.content = unwrap(obj.content);
        if (obj.text) obj.text = unwrap(obj.text);
      }
      return obj;
    };
    
    parsed = unwrap(parsed);
    return parsed;
  } catch {
    return fallback;
  }
}

function pickInlineImagePart(response: any): any | null {
  const candidates = Array.isArray(response?.candidates) ? response.candidates : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    const imgPart = parts.find((p: any) => p?.inlineData?.data);
    if (imgPart) return imgPart;
  }
  return null;
}

function geminiNoImageDiagnostics(response: any): string {
  const promptFeedback = response?.promptFeedback ? JSON.stringify(response.promptFeedback) : "none";
  const candidates = Array.isArray(response?.candidates) ? response.candidates : [];
  const candidateReasons = candidates
    .map((c: any, idx: number) => {
      const finish = c?.finishReason ?? "unknown";
      const safety = c?.safetyRatings ? JSON.stringify(c.safetyRatings) : "none";
      return `c${idx}: finish=${finish} safety=${safety}`;
    })
    .join(" | ");
  return `promptFeedback=${promptFeedback}; ${candidateReasons || "no-candidates"}`;
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
      async generate(params: any): Promise<any> {
        try {
          const response = await genAI.models.generateContent({
            model: "gemini-2.5-flash-image",
            contents: [{ role: "user", parts: [{ text: params.prompt }] }],
            config: { responseModalities: ["TEXT", "IMAGE"] },
          });
          const imgPart = pickInlineImagePart(response);
          if (imgPart?.inlineData?.data) {
            const mime = imgPart.inlineData.mimeType || "image/png";
            return { data: [{ url: `data:${mime};base64,${imgPart.inlineData.data}` }] };
          }
          console.warn("⚠️ [Gemini] No image part found in candidates:", geminiNoImageDiagnostics(response));
          return { data: [{ url: null }] };
        } catch (err: any) {
          console.error("⚠️ [Gemini] Image generation error:", err?.message);
          return { data: [{ url: null }] };
        }
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
  businessType?: string;
}

function getBusinessContext(businessType: string, companyProfile?: CompanyProfileData, location?: string) {
  const name = companyProfile?.businessName || companyProfile?.brokerageName || "";
  const person = companyProfile?.agentName || "";
  const city = (companyProfile as any)?.city || "";
  const state = (companyProfile as any)?.state || "";
  const loc = location || (city && state ? `${city}, ${state}` : city || state || "the local area");
  const hasLocation = loc !== "the local area";

  // Build city-specific hashtag from city name (e.g. "Omaha" -> "OmahaRealEstate")
  const cityTag = city ? city.replace(/\s+/g, "") : "";
  const stateTag = state ? state.replace(/\s+/g, "") : "";

  const contexts: Record<string, { industryContext: string; roleLabel: string; fallbackHashtags: string[] }> = {
    restaurant: {
      industryContext: `${name || "a restaurant"}${person ? `, featuring ${person}` : ""} — focusing on food, dining, menu items, atmosphere, and community${hasLocation ? ` in ${loc}` : ""}`,
      roleLabel: "restaurant and food & beverage",
      fallbackHashtags: ["Restaurant", "FoodLovers", "LocalEats", "Foodie", "DineLocal", ...(cityTag ? [`${cityTag}Eats`, `${cityTag}Food`] : [])],
    },
    home_services: {
      industryContext: `${name || "a home services company"}${person ? ` with ${person}` : ""}${hasLocation ? ` in ${loc}` : ""}`,
      roleLabel: "home services",
      fallbackHashtags: ["HomeServices", "HomeImprovement", "LocalContractor", "HomeRepair", ...(cityTag ? [`${cityTag}HomeServices`] : [])],
    },
    retail: {
      industryContext: `${name || "a retail store"}${person ? ` with ${person}` : ""}${hasLocation ? ` in ${loc}` : ""}`,
      roleLabel: "retail",
      fallbackHashtags: ["Shopping", "RetailTherapy", "LocalShop", "NewArrivals", ...(cityTag ? [`${cityTag}Shopping`, `Shop${cityTag}`] : [])],
    },
    professional_services: {
      industryContext: `${name || "a professional services firm"}${person ? ` with ${person}` : ""}${hasLocation ? ` in ${loc}` : ""}`,
      roleLabel: "professional services",
      fallbackHashtags: ["ProfessionalServices", "BusinessTips", "Consulting", "ExpertAdvice", ...(cityTag ? [`${cityTag}Business`] : [])],
    },
    real_estate: {
      industryContext: `${loc} real estate${name ? ` — ${name}` : ""}${person ? `, represented by ${person}` : ""}`,
      roleLabel: "real estate",
      fallbackHashtags: ["RealEstate", "HomesForSale", "DreamHome", ...(cityTag ? [`${cityTag}RealEstate`, `${cityTag}Homes`] : []), ...(stateTag ? [`${stateTag}RealEstate`] : [])],
    },
    general: {
      industryContext: `${name || "a local business"}${person ? ` with ${person}` : ""}${hasLocation ? ` in ${loc}` : ""}`,
      roleLabel: "general business",
      fallbackHashtags: ["LocalBusiness", "SmallBusiness", "Community", "SupportLocal", ...(cityTag ? [`${cityTag}Business`, `${cityTag}Local`] : [])],
    },
  };

  return contexts[businessType] || contexts.real_estate;
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
      const agentTitle = request.companyProfile?.agentTitle || profile.agentTitle || "professional";
      const city = (request.companyProfile as any)?.city || (profile as any)?.city || "";
      const state = (request.companyProfile as any)?.state || (profile as any)?.state || "";
      const locationStr = city && state ? `${city}, ${state}` : city || state || "the local market";
      const bType = request.companyProfile?.businessType || (profile as any)?.businessType || "real_estate";
      const { roleLabel } = getBusinessContext(bType, request.companyProfile);

      const genAI = getGeminiClient();
      const response = await genAI.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: `You are an expert ${roleLabel} content writer and SEO specialist focused on ${locationStr}. Generate high-quality, SEO-optimized content for ${agentName}, a top ${agentTitle} with ${businessName} in ${locationStr}. Always include ${agentName}'s name and credentials for better SEO and personal branding. Always respond with valid JSON only — no markdown, no code blocks.`,
          maxOutputTokens: 2000,
        },
      });

      const result = extractJSON(response.text || "{}", {});
      return {
        title: result.title || "Untitled Content",
        content: result.content || result.text || result.body || result.post || result.caption || result.message || "",
        keywords: result.keywords || result.hashtags || [],
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
      prompt += ` focusing on the ${request.neighborhood} neighborhood`;
    }
    const bTypeForPrompt = request.companyProfile?.businessType || "general";
    const { roleLabel: promptRole } = getBusinessContext(bTypeForPrompt, request.companyProfile);
    prompt += ` for the local ${promptRole} market`;

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
      - Include relevant long-tail keywords for the local market
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
    companyProfile?: CompanyProfileData,
    businessType?: string,
    menuItem?: { name?: string; description?: string; price?: string; category?: string }
  ): Promise<any> {
    try {
      const bType = businessType || companyProfile?.businessType || "real_estate";
      const { industryContext, roleLabel, fallbackHashtags } = getBusinessContext(bType, companyProfile, neighborhood);

      const menuItemContext = menuItem?.name
        ? `\nFeatured item context (use naturally, do NOT quote brackets or show this literally): Name: ${menuItem.name}${menuItem.description ? `, Description: ${menuItem.description}` : ""}${menuItem.price ? `, Price: ${menuItem.price}` : ""}${menuItem.category ? `, Category: ${menuItem.category}` : ""}`
        : "";

      const prompt = `Create a ${platform} post about "${topic}" for ${industryContext}.${menuItemContext}
      Platform: ${platform}. Keep it engaging, authentic, and on-brand. Do NOT use placeholder text like [Business Name] or [Agent Name] — use the actual names provided. Do NOT include any bracket notation or raw metadata in the output.
      Return ONLY the post content in the "content" field — do NOT include hashtags inside "content". Put all hashtags only in the "hashtags" array.
      Respond with JSON: { "content": "post text without hashtags", "hashtags": ["tag1", "tag2"], "characterCount": 0 }`;

      const genAI = getGeminiClient();
      const response = await genAI.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: `You are an expert social media content creator for ${roleLabel} businesses. Write posts that sound natural and specific to the industry. Always respond with valid JSON only — no markdown, no code blocks, just raw JSON.`,
          maxOutputTokens: 1500,
        },
      });

      return extractJSON(response.text || "{}", { content: `${topic} — follow us for more updates! ${fallbackHashtags.map(t => "#" + t).join(" ")}`, hashtags: fallbackHashtags });
    } catch (error) {
      console.error("Gemini social media post error:", error);
      return { content: `${topic}`, hashtags: [] };
    }
  }

  async generatePlatformSpecificContent(params: {
    topic: string;
    platform: string;
    postType?: string;
    neighborhood?: string;
    companyProfile?: CompanyProfileData;
    propertyData?: any;
    customPrompt?: string;
    businessType?: string;
    originalContent?: string;
    contentType?: string;
    seoOptimized?: boolean;
    longTailKeywords?: boolean;
  }): Promise<any> {
    try {
      const bType = params.businessType || params.companyProfile?.businessType || "real_estate";
      const { industryContext, roleLabel, fallbackHashtags } = getBusinessContext(bType, params.companyProfile, params.neighborhood);
      const postTypeLabel = params.postType || params.contentType || "post";

      const prompt = `Create a ${params.platform} ${postTypeLabel} about "${params.topic}" for ${industryContext}.
      ${params.customPrompt ? `Additional instructions: ${params.customPrompt}` : ""}
      ${params.propertyData ? `Additional details: ${JSON.stringify(params.propertyData)}` : ""}
      Do NOT use placeholder text like [Business Name] or [Agent Name] — use the actual names provided.
      Make it engaging and platform-appropriate. Respond with JSON: { "content": "post text", "hashtags": ["tag1"], "characterCount": 0 }`;

      const genAI = getGeminiClient();
      const response = await genAI.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: `You are an expert social media content creator for ${roleLabel} businesses. Write posts that sound natural and specific to the industry. Always respond with valid JSON only — no markdown, no code blocks, just raw JSON.`,
          maxOutputTokens: 1500,
        },
      });

      return extractJSON(response.text || "{}", { content: `${params.topic} — contact us today! ${fallbackHashtags.map(t => "#" + t).join(" ")}`, hashtags: fallbackHashtags });
    } catch (error) {
      console.error("Gemini platform-specific content error:", error);
      return { content: `${params.topic}`, hashtags: [] };
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
      const bTypeVideo = companyProfile?.businessType || "general";
      const { roleLabel: videoRole } = getBusinessContext(bTypeVideo, companyProfile);
      const agentName = companyProfile?.agentName || `your ${videoRole} professional`;
      const businessName = companyProfile?.businessName || companyProfile?.brokerageName || "our brokerage";
      const city = (companyProfile as any)?.city || "";
      const state = (companyProfile as any)?.state || "";
      const defaultLoc = city && state ? `${city}, ${state}` : city || state || "the local area";
      const locationText = neighborhood ? `${neighborhood}, ${defaultLoc}` : defaultLoc;

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
          systemInstruction: `You are a professional video script writer specializing in ${videoRole} social media content. Output ONLY the script text - no stage directions, no brackets, no timestamps.`,
          maxOutputTokens: 800,
        },
      });

      return response.text || "Script generation failed";
    } catch (error) {
      console.error("Gemini video script error:", error);
      const agentName = params.companyProfile?.agentName || "your agent";
      const businessName = params.companyProfile?.businessName || params.companyProfile?.brokerageName || "our team";
      const fbCity = (params.companyProfile as any)?.city || "";
      const fbLoc = params.neighborhood || fbCity || "our area";
      return `Hi, I'm ${agentName} with ${businessName}. Today I want to talk to you about ${params.topic} in ${fbLoc}. I'd love to help you navigate these opportunities. Give me a call — I'm ${agentName} and I'm here to help.`;
    }
  }

  async generateImage({ prompt, size = "1024x1024", isPublic = false }: { prompt: string; size?: string; isPublic?: boolean }): Promise<string | null> {
    try {
      const genAI = getGeminiClient();
      console.log(`🎨 [ImageGen] Generating image with prompt: "${prompt.substring(0, 100)}..."`);

      const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { responseModalities: ["TEXT", "IMAGE"] },
      });

      const imgPart = pickInlineImagePart(response);

      if (!imgPart?.inlineData?.data) {
        console.warn("⚠️ [ImageGen] No image returned from Gemini image generation:", geminiNoImageDiagnostics(response));
        return null;
      }

      const imageBase64 = imgPart.inlineData.data;
      const mimeType = imgPart.inlineData.mimeType || "image/png";
      const ext = mimeType.includes("jpeg") ? "jpg" : "png";
      const imageBuffer = Buffer.from(imageBase64, "base64");
      const filename = `ai-generated-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

      try {
        const { persistImageBuffer, persistImageBufferPublic } = await import("../objectStorage");
        const storedUrl = isPublic
          ? await persistImageBufferPublic(imageBuffer, filename, mimeType)
          : await persistImageBuffer(imageBuffer, filename, mimeType);
        if (storedUrl) {
          console.log(`✅ [ImageGen] Image generated and stored: ${storedUrl}`);
          return storedUrl;
        }
      } catch (storageError: any) {
        console.warn(`⚠️ [ImageGen] Object storage failed, using base64 fallback:`, storageError?.message);
      }

      const base64DataUri = `data:${mimeType};base64,${imageBase64}`;
      console.log(`✅ [ImageGen] Image generated (base64 fallback, ${imageBuffer.length} bytes)`);
      return base64DataUri;
    } catch (error: any) {
      console.error("❌ [ImageGen] Image generation error:", error?.message || error);
      return null;
    }
  }

  async editImage({
    prompt,
    referenceImageUrls,
  }: {
    prompt: string;
    referenceImageUrls: string[];
  }): Promise<string | null> {
    try {
      const genAI = getGeminiClient();
      console.log(
        `🎨 [ImageEdit] Editing ${referenceImageUrls.length} image(s) with prompt: "${prompt.substring(0, 100)}..."`,
      );

      const parts: any[] = [{ text: prompt }];
      for (const url of referenceImageUrls) {
        const fetched = await fetchImageAsBase64(url);
        if (!fetched) {
          console.warn(`⚠️ [ImageEdit] Could not fetch reference image: ${url}`);
          continue;
        }
        parts.push({ inlineData: { mimeType: fetched.mimeType, data: fetched.base64 } });
      }

      const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [{ role: "user", parts }],
        config: { responseModalities: ["TEXT", "IMAGE"] },
      });

      const imgPart = pickInlineImagePart(response);
      if (!imgPart?.inlineData?.data) {
        console.warn("⚠️ [ImageEdit] No image returned from Gemini image edit:", geminiNoImageDiagnostics(response));
        return null;
      }

      const imageBase64 = imgPart.inlineData.data;
      const mimeType = imgPart.inlineData.mimeType || "image/png";
      const ext = mimeType.includes("jpeg") ? "jpg" : "png";
      const imageBuffer = Buffer.from(imageBase64, "base64");
      const filename = `ai-edited-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

      try {
        const { persistImageBuffer } = await import("../objectStorage");
        const storedUrl = await persistImageBuffer(imageBuffer, filename, mimeType);
        if (storedUrl) {
          console.log(`✅ [ImageEdit] Edited image stored: ${storedUrl}`);
          return storedUrl;
        }
      } catch (storageError: any) {
        console.warn(`⚠️ [ImageEdit] Object storage failed, using base64 fallback:`, storageError?.message);
      }

      return `data:${mimeType};base64,${imageBase64}`;
    } catch (error: any) {
      console.error("❌ [ImageEdit] Image edit error:", error?.message || error);
      return null;
    }
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
- Include relevant local SEO keywords
- Optimize for ${platform} platform best practices
- Keep content engaging and authentic
- Ensure call-to-action is clear

Please enhance this content while keeping the same core message and format. Return only the enhanced content text.`;

      const genAI = getGeminiClient();
      const response = await genAI.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: "You are an expert content optimizer specializing in social media and SEO for local businesses.",
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
    const bTypeFallback = request.companyProfile?.businessType || "general";
    const { roleLabel: fallbackRole, fallbackHashtags } = getBusinessContext(bTypeFallback, request.companyProfile);
    const agentName = request.companyProfile?.agentName || `your local ${fallbackRole} professional`;
    const businessName = request.companyProfile?.businessName || request.companyProfile?.brokerageName || "our team";
    const primaryTag = fallbackHashtags[0] || "Business";

    const loc = neighborhood || "your area";
    const content = type === "social"
      ? `Thinking about ${topic.toLowerCase()} in ${loc}? Contact ${agentName} with ${businessName} for expert guidance! #${primaryTag}`
      : `Looking for expert ${fallbackRole} guidance in ${loc}? Contact ${agentName} with ${businessName} for professional service and local market expertise.`;

    return {
      title: `${topic} - ${loc} ${fallbackRole.charAt(0).toUpperCase() + fallbackRole.slice(1)}`,
      content,
      keywords: [fallbackRole, neighborhood ? `${neighborhood} ${fallbackRole}` : `local ${fallbackRole}`, topic],
      metaDescription: `${topic} in ${loc} with ${agentName}`,
      seoScore: 45,
      wordCount: content.split(" ").length,
    };
  }
}

export const getAPIKeyStatus = () => multiOpenAI.getStatus();
export { multiOpenAI };
export const openaiService = new OpenAIService();
