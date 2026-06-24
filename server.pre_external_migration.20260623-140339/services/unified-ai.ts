import { GoogleGenAI } from "@google/genai";

const GEMINI_MODEL = "gemini-2.5-flash";

interface UnifiedAIOptions {
  systemPrompt?: string;
  maxTokens?: number;
  jsonMode?: boolean;
}

interface UnifiedAIResponse {
  content: string;
  provider: "google";
  model?: string;
}

interface ContentGenerationRequest {
  type: string;
  topic: string;
  aiPrompt?: string;
  neighborhood?: string;
  keywords?: string[];
  seoOptimized?: boolean;
  longTailKeywords?: boolean;
  localSeoFocus?: boolean;
  propertyData?: any;
  companyProfile?: any;
}

interface GeneratedContent {
  title: string;
  content: string;
  keywords: string[];
  metaDescription?: string;
  seoScore: number;
  wordCount: number;
}

class UnifiedAIService {
  private genAI: GoogleGenAI;

  constructor() {
    this.genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
    console.log(`🤖 Unified AI Service initialized`);
    console.log(`   - Provider: Google Gemini (${GEMINI_MODEL})`);
  }

  async generate(prompt: string, options: UnifiedAIOptions = {}): Promise<UnifiedAIResponse> {
    const { systemPrompt, maxTokens = 1500, jsonMode = false } = options;

    const config: any = { maxOutputTokens: maxTokens };
    if (systemPrompt) config.systemInstruction = systemPrompt;
    if (jsonMode) config.responseMimeType = "application/json";

    const response = await this.genAI.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config,
    });

    return {
      content: response.text || "",
      provider: "google",
      model: GEMINI_MODEL,
    };
  }

  async generateBlogPost(topic: string, tone: string = "professional", length: string = "medium"): Promise<UnifiedAIResponse> {
    const prompt = `Write a ${length} blog post about "${topic}" in a ${tone} tone. Format the content in Markdown.`;
    return this.generate(prompt, {
      systemPrompt: "You are a professional content writer specializing in real estate and local market insights.",
      maxTokens: 2000,
    });
  }

  async generatePropertyDescription(
    address: string,
    features: string[] = [],
    price?: number,
    neighborhood?: string
  ): Promise<UnifiedAIResponse> {
    const featureText = features.length > 0 ? `Features: ${features.join(", ")}. ` : "";
    const priceText = price ? `Price: $${price.toLocaleString()}. ` : "";
    const neighborhoodText = neighborhood ? `Located in ${neighborhood}. ` : "";
    const prompt = `Write a compelling property description for ${address}. ${neighborhoodText}${featureText}${priceText}Make it engaging and highlight key selling points.`;
    return this.generate(prompt, {
      systemPrompt: "You are a professional real estate copywriter who creates compelling property descriptions.",
      maxTokens: 500,
    });
  }

  async chat(message: string, context?: string): Promise<UnifiedAIResponse> {
    const fullMessage = context ? `Context: ${context}\n\nUser: ${message}` : message;
    return this.generate(fullMessage, {
      systemPrompt: "You are a helpful real estate assistant.",
      maxTokens: 1000,
    });
  }

  private getBusinessDefaults(companyProfile?: any) {
    const bt = companyProfile?.businessType || "real_estate";
    const defaults: Record<string, { role: string; industry: string; fallbackName: string }> = {
      real_estate: { role: "real estate agent", industry: "real estate", fallbackName: "your local real estate agent" },
      restaurant: { role: "restaurant professional", industry: "food & hospitality", fallbackName: "our restaurant team" },
      home_services: { role: "home services professional", industry: "home services", fallbackName: "our service team" },
      retail: { role: "retail professional", industry: "retail", fallbackName: "our retail team" },
      professional_services: { role: "professional consultant", industry: "professional services", fallbackName: "our team" },
      general: { role: "business professional", industry: "business", fallbackName: "our team" },
    };
    return defaults[bt] || defaults.general;
  }

  async generateStructuredContent(request: ContentGenerationRequest): Promise<GeneratedContent> {
    try {
      const bizDefaults = this.getBusinessDefaults(request.companyProfile);
      const agentName = request.companyProfile?.agentName || bizDefaults.fallbackName;
      const businessName = request.companyProfile?.businessName || request.companyProfile?.brokerageName || "our business";
      const agentTitle = request.companyProfile?.agentTitle || bizDefaults.role;

      let prompt = `Generate ${request.type} content about "${request.topic}"`;
      if (request.neighborhood) prompt += ` focusing on the ${request.neighborhood} area`;
      else prompt += ` for a ${bizDefaults.industry} business`;
      if (request.aiPrompt) prompt += `\n\nAdditional instructions: ${request.aiPrompt}`;
      if (request.keywords && request.keywords.length > 0) prompt += `\n\nInclude these keywords: ${request.keywords.join(", ")}`;
      if (request.seoOptimized) prompt += `\n\nOptimize for SEO with proper headings, meta descriptions, and keyword placement.`;
      if (request.propertyData) prompt += `\n\nProperty details: ${JSON.stringify(request.propertyData)}`;
      prompt += `\n\nRespond with a JSON object containing: title, content, keywords (array), metaDescription, seoScore (0-100), wordCount`;

      const response = await this.generate(prompt, {
        systemPrompt: `You are an expert ${bizDefaults.industry} content writer and SEO specialist. Generate high-quality, SEO-optimized content for ${agentName}, a top ${agentTitle} with ${businessName}. Always respond with valid JSON. Keep the content field under 800 words to avoid truncation.`,
        maxTokens: 4000,
        jsonMode: true,
      });

      let result: any;
      try {
        result = JSON.parse(response.content);
      } catch {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try { result = JSON.parse(jsonMatch[0]); } catch { result = null; }
        }
        if (!result) throw new Error("Failed to parse AI response as JSON");
      }
      return {
        title: result.title || "Untitled Content",
        content: result.content || "",
        keywords: result.keywords || [],
        metaDescription: result.metaDescription,
        seoScore: result.seoScore || 0,
        wordCount: result.wordCount || 0,
      };
    } catch (error) {
      console.error("Structured content generation error:", error);
      return this.getFallbackContent(request);
    }
  }

  private getFallbackContent(request: ContentGenerationRequest): GeneratedContent {
    const bizDefaults = this.getBusinessDefaults(request.companyProfile);
    const agentName = request.companyProfile?.agentName || bizDefaults.fallbackName;
    const businessName = request.companyProfile?.businessName || request.companyProfile?.brokerageName || "our business";
    const area = request.neighborhood || "your area";
    return {
      title: `${request.topic} - ${bizDefaults.industry}`,
      content: `Looking for expert ${bizDefaults.industry} guidance in ${area}? Contact ${agentName} with ${businessName} for professional service and expertise.`,
      keywords: [bizDefaults.industry, request.neighborhood || "local", request.topic],
      metaDescription: `${request.topic} - ${agentName} with ${businessName}`,
      seoScore: 45,
      wordCount: 25,
    };
  }

  getStatus() {
    return {
      primary: {
        provider: "google",
        model: GEMINI_MODEL,
        available: !!process.env.GEMINI_API_KEY,
      },
    };
  }
}

export const unifiedAI = new UnifiedAIService();
