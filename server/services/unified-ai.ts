// Unified AI Service - Uses GitHub Copilot (primary) with OpenAI (fallback)
// GitHub Copilot deployed at: https://www.imakepage.com/api/copilot

interface UnifiedAIOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

interface UnifiedAIResponse {
  content: string;
  provider: 'github-copilot' | 'openai';
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
  private copilotBaseUrl: string;
  private copilotAvailable: boolean = true;
  private lastCopilotError?: Date;

  constructor() {
    this.copilotBaseUrl = process.env.COPILOT_API_URL || 'https://www.imakepage.com/api/copilot';
    console.log(`🤖 Unified AI Service initialized`);
    console.log(`   - Primary: GitHub Copilot (${this.copilotBaseUrl})`);
    console.log(`   - Fallback: OpenAI GPT-5`);
  }

  async generate(prompt: string, options: UnifiedAIOptions = {}): Promise<UnifiedAIResponse> {
    const {
      systemPrompt,
      temperature = 0.7,
      maxTokens = 1500,
      jsonMode = false
    } = options;

    // Try GitHub Copilot first
    if (this.copilotAvailable) {
      try {
        console.log(`🚀 Trying GitHub Copilot...`);
        const response = await this.callCopilot(prompt, {
          systemPrompt,
          temperature,
          maxTokens,
          jsonMode
        });
        console.log(`✅ GitHub Copilot success`);
        return response;
      } catch (error: any) {
        console.warn(`⚠️ GitHub Copilot failed: ${error.message}`);
        this.lastCopilotError = new Date();
        
        // Don't disable Copilot permanently, just try fallback
        console.log(`🔄 Falling back to OpenAI...`);
      }
    } else {
      console.log(`⏭️ Skipping GitHub Copilot (recently failed), using OpenAI directly`);
    }

    // Fallback to OpenAI
    try {
      console.log(`🔄 Using OpenAI fallback...`);
      const response = await this.callOpenAI(prompt, {
        systemPrompt,
        temperature,
        maxTokens,
        jsonMode
      });
      console.log(`✅ OpenAI fallback success`);
      return response;
    } catch (error: any) {
      console.error(`❌ Both GitHub Copilot and OpenAI failed`);
      throw new Error(`AI generation failed: ${error.message}`);
    }
  }

  private async callCopilot(prompt: string, options: UnifiedAIOptions): Promise<UnifiedAIResponse> {
    // Always use /generate endpoint and parse JSON ourselves
    // The /generate-json endpoint has issues with markdown-wrapped responses
    const endpoint = `${this.copilotBaseUrl}/generate`;

    const requestBody: any = {
      prompt,
      temperature: options.temperature,
      maxTokens: options.maxTokens
    };

    if (options.systemPrompt) {
      requestBody.systemPrompt = options.systemPrompt;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Copilot API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // Debug: Log the full response structure
    console.log('📥 GitHub Copilot API Response:', JSON.stringify(data, null, 2));

    if (!data.success) {
      throw new Error(data.error || 'Copilot request failed');
    }

    // Always extract content from data.data.content
    // The response structure is: { success: true, data: { content: "...", provider: "...", model: "..." } }
    let content = data.data?.content;
    
    // Debug: Log what we extracted
    console.log('📤 Extracted content (raw):', typeof content, content ? content.substring(0, 100) + '...' : 'EMPTY/UNDEFINED');

    if (!content) {
      throw new Error('No content in Copilot response');
    }

    // GitHub Copilot sometimes returns markdown-wrapped JSON, clean it up
    if (typeof content === 'string') {
      content = content.trim();
      if (content.startsWith('```json')) {
        content = content.replace(/```json\n?/g, '').replace(/```\n?$/g, '').trim();
        console.log('🧹 Cleaned markdown wrapper from JSON response');
      } else if (content.startsWith('```')) {
        content = content.replace(/```\n?/g, '').trim();
        console.log('🧹 Cleaned markdown wrapper from response');
      }
    }

    return {
      content,
      provider: 'github-copilot',
      model: data.metadata?.model || data.data?.model
    };
  }

  private async callOpenAI(prompt: string, options: UnifiedAIOptions): Promise<UnifiedAIResponse> {
    const { multiOpenAI } = await import('./openai');

    const messages: any[] = [];
    
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });

    const requestOptions: any = {
      model: 'gpt-5',
      messages,
      max_completion_tokens: options.maxTokens
    };

    // GPT-5 only supports default temperature (1.0), don't set custom values
    // temperature parameter removed for GPT-5 compatibility

    if (options.jsonMode) {
      requestOptions.response_format = { type: 'json_object' };
    }

    const response = await multiOpenAI.makeRequest(
      'content',
      async (client) => {
        return await client.chat.completions.create(requestOptions);
      }
    );

    const content = response.choices[0]?.message?.content || '';

    return {
      content,
      provider: 'openai',
      model: response.model
    };
  }

  async generateBlogPost(topic: string, tone: string = 'professional', length: string = 'medium'): Promise<UnifiedAIResponse> {
    // Try Copilot's specialized blog-post endpoint first
    if (this.copilotAvailable) {
      try {
        console.log(`📝 Generating blog post with GitHub Copilot...`);
        const response = await fetch(`${this.copilotBaseUrl}/blog-post`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, tone, length })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            console.log(`✅ GitHub Copilot blog post generated`);
            return {
              content: data.data.content,
              provider: 'github-copilot',
              model: data.metadata?.model
            };
          }
        }
      } catch (error) {
        console.warn(`⚠️ Copilot blog-post endpoint failed, using generic generate`);
      }
    }

    // Fallback to generic generate
    const prompt = `Write a ${length} blog post about "${topic}" in a ${tone} tone. Format the content in Markdown.`;
    return this.generate(prompt, {
      systemPrompt: 'You are a professional content writer specializing in real estate and local market insights.',
      temperature: 0.7,
      maxTokens: 2000
    });
  }

  async generatePropertyDescription(
    address: string,
    features: string[] = [],
    price?: number,
    neighborhood?: string
  ): Promise<UnifiedAIResponse> {
    // Try Copilot's specialized property-description endpoint
    if (this.copilotAvailable) {
      try {
        console.log(`🏠 Generating property description with GitHub Copilot...`);
        const response = await fetch(`${this.copilotBaseUrl}/property-description`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, features, price, neighborhood })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            console.log(`✅ GitHub Copilot property description generated`);
            return {
              content: data.data.description,
              provider: 'github-copilot',
              model: data.metadata?.model
            };
          }
        }
      } catch (error) {
        console.warn(`⚠️ Copilot property-description endpoint failed, using generic generate`);
      }
    }

    // Fallback to generic generate
    const featureText = features.length > 0 ? `Features: ${features.join(', ')}. ` : '';
    const priceText = price ? `Price: $${price.toLocaleString()}. ` : '';
    const neighborhoodText = neighborhood ? `Located in ${neighborhood}. ` : '';
    
    const prompt = `Write a compelling property description for ${address}. ${neighborhoodText}${featureText}${priceText}Make it engaging and highlight key selling points.`;
    
    return this.generate(prompt, {
      systemPrompt: 'You are a professional real estate copywriter who creates compelling property descriptions.',
      temperature: 0.8,
      maxTokens: 500
    });
  }

  async chat(message: string, context?: string): Promise<UnifiedAIResponse> {
    // Try Copilot's specialized chat endpoint
    if (this.copilotAvailable) {
      try {
        console.log(`💬 Chat with GitHub Copilot...`);
        const response = await fetch(`${this.copilotBaseUrl}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, context })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            console.log(`✅ GitHub Copilot chat response`);
            return {
              content: data.response,
              provider: 'github-copilot',
              model: data.metadata?.model
            };
          }
        }
      } catch (error) {
        console.warn(`⚠️ Copilot chat endpoint failed, using generic generate`);
      }
    }

    // Fallback to generic generate
    const fullMessage = context ? `Context: ${context}\n\nUser: ${message}` : message;
    return this.generate(fullMessage, {
      systemPrompt: 'You are a helpful real estate assistant.',
      temperature: 0.7,
      maxTokens: 1000
    });
  }

  async generateStructuredContent(request: ContentGenerationRequest): Promise<GeneratedContent> {
    try {
      const prompt = this.buildContentPrompt(request);
      const agentName = request.companyProfile?.agentName || "Mike Bjork";
      const businessName = request.companyProfile?.businessName || request.companyProfile?.brokerageName || "Berkshire Hathaway HomeServices";
      const agentTitle = request.companyProfile?.agentTitle || "real estate agent";

      const systemPrompt = `You are an expert real estate content writer and SEO specialist focused on the Omaha, Nebraska market. Generate high-quality, SEO-optimized content for ${agentName}, a top ${agentTitle} with ${businessName} in Omaha. Always include ${agentName}'s name and credentials for better SEO and personal branding. Always respond with valid JSON.`;

      const response = await this.generate(prompt, {
        systemPrompt,
        temperature: 0.7,
        maxTokens: 2000,
        jsonMode: true
      });

      console.log('📝 Parsing structured content response from:', response.provider);

      const result = JSON.parse(response.content);

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

  private buildContentPrompt(request: ContentGenerationRequest): string {
    let prompt = `Generate ${request.type} content about "${request.topic}"`;

    if (request.neighborhood) {
      prompt += ` focusing on the ${request.neighborhood} neighborhood in Omaha, Nebraska`;
    } else {
      prompt += ` for the Omaha, Nebraska real estate market`;
    }

    if (request.aiPrompt) {
      prompt += `\n\nAdditional instructions: ${request.aiPrompt}`;
    }

    if (request.keywords && request.keywords.length > 0) {
      prompt += `\n\nInclude these keywords: ${request.keywords.join(', ')}`;
    }

    if (request.seoOptimized) {
      prompt += `\n\nOptimize for SEO with proper headings, meta descriptions, and keyword placement.`;
    }

    if (request.longTailKeywords) {
      prompt += `\n\nInclude long-tail keywords relevant to Omaha real estate buyers and sellers.`;
    }

    if (request.localSeoFocus) {
      prompt += `\n\nFocus on local Omaha SEO by mentioning specific neighborhoods, landmarks, and local insights.`;
    }

    if (request.propertyData) {
      prompt += `\n\nProperty details: ${JSON.stringify(request.propertyData)}`;
    }

    prompt += `\n\nRespond with a JSON object containing: title, content, keywords (array), metaDescription, seoScore (0-100), wordCount`;

    return prompt;
  }

  private getFallbackContent(request: ContentGenerationRequest): GeneratedContent {
    const agentName = request.companyProfile?.agentName || "Mike Bjork";
    const businessName = request.companyProfile?.businessName || request.companyProfile?.brokerageName || "Berkshire Hathaway HomeServices";

    return {
      title: `${request.topic} - ${request.neighborhood || 'Omaha'} Real Estate`,
      content: `Looking for expert real estate guidance in ${request.neighborhood || 'Omaha'}? Contact ${agentName} with ${businessName} for professional service and local market expertise. Whether you're buying or selling, we're here to help you achieve your real estate goals.`,
      keywords: [
        'Omaha real estate',
        request.neighborhood ? `${request.neighborhood} homes` : 'Nebraska homes',
        request.topic
      ],
      metaDescription: `${request.topic} in ${request.neighborhood || 'Omaha'} with ${agentName}`,
      seoScore: 45,
      wordCount: 50
    };
  }

  getStatus() {
    return {
      primary: {
        provider: 'github-copilot',
        url: this.copilotBaseUrl,
        available: this.copilotAvailable,
        lastError: this.lastCopilotError
      },
      fallback: {
        provider: 'openai',
        model: 'gpt-5',
        available: true
      }
    };
  }
}

// Export singleton instance
export const unifiedAI = new UnifiedAIService();
