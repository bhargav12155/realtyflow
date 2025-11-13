import type { InsertSeoKeyword } from "@shared/schema";

export interface GeneratedKeywords {
  keywords: InsertSeoKeyword[];
  metadata: {
    generatedAt: string;
    model: string;
    userContext: string;
  };
}

export class AIKeywordGenerator {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async generateKeywords(serviceAreas: string[], specialties?: string[]): Promise<GeneratedKeywords> {

    const areasText = serviceAreas.length > 0 ? serviceAreas.join(', ') : 'Omaha metro area';
    const specialtiesText = specialties && specialties.length > 0 
      ? ` specializing in ${specialties.join(', ')}` 
      : '';

    const prompt = `You are an SEO expert for real estate agents. Generate high-value SEO keywords for a real estate agent serving ${areasText}${specialtiesText} in the Omaha, Nebraska market.

Generate 8-12 strategic SEO keywords that:
1. Target local Omaha neighborhoods mentioned in service areas
2. Include property type variations (homes, condos, townhomes, luxury properties)
3. Cover buyer intent keywords (for sale, buy, move to, relocate)
4. Mix broad market terms and specific neighborhood terms
5. Focus on commercial viability and search intent

**IMPORTANT CONSTRAINTS:**
- Each keyword MUST include "Omaha" or a specific Omaha neighborhood name
- Prioritize keywords for the service areas provided
- Use natural language (how people actually search)
- Avoid overly technical or industry jargon
- Include both short-tail (2-3 words) and long-tail (4-6 words) keywords

Return ONLY a valid JSON array with this exact structure:
[
  {
    "keyword": "keyword phrase",
    "searchVolume": estimated_monthly_searches (integer, realistic 100-5000),
    "difficulty": seo_difficulty_score (integer 1-100, where higher = more competitive),
    "neighborhood": "neighborhood name or null"
  }
]

Example keywords:
- "Dundee homes for sale" (if Dundee is a service area)
- "luxury condos Aksarben Omaha"
- "first time home buyer Omaha"
- "moving to West Omaha"`;

    try {
      // Use Unified AI Service (GitHub Copilot with OpenAI fallback)
      const { unifiedAI } = await import('./unified-ai');
      const aiResponse = await unifiedAI.generate(prompt, {
        temperature: 0.7,
        maxTokens: 1000,
        jsonMode: true // Enable JSON mode for better structure enforcement
      });

      console.log(`✅ Keyword generation AI response from: ${aiResponse.provider}`);

      let responseText = aiResponse.content.trim();

      // Remove markdown code blocks if present
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?$/g, '').trim();
      } else if (responseText.startsWith('```')) {
        responseText = responseText.replace(/```\n?/g, '').trim();
      }

      const keywords = JSON.parse(responseText);

      // Validate structure
      if (!Array.isArray(keywords) || keywords.length === 0) {
        throw new Error('Invalid response structure: expected array of keywords');
      }

      // Validate and transform each keyword
      const validatedKeywords: InsertSeoKeyword[] = keywords.map((k, index) => {
        if (!k.keyword) {
          throw new Error(`Invalid keyword at index ${index}: missing keyword field`);
        }

        // Validate search volume
        const searchVolume = k.searchVolume || 100;
        if (searchVolume < 0 || searchVolume > 100000) {
          console.warn(`Adjusting search volume for "${k.keyword}" from ${searchVolume} to valid range`);
        }

        // Validate difficulty
        const difficulty = k.difficulty || 50;
        if (difficulty < 1 || difficulty > 100) {
          console.warn(`Adjusting difficulty for "${k.keyword}" from ${difficulty} to valid range`);
        }

        return {
          userId: this.userId,
          keyword: k.keyword,
          searchVolume: Math.max(0, Math.min(100000, searchVolume)),
          difficulty: Math.max(1, Math.min(100, difficulty)),
          neighborhood: k.neighborhood || null,
          currentRank: null, // Rankings start null until real API integration
          previousRank: null,
          lastChecked: null,
        };
      });

      console.log(`✅ AI generated ${validatedKeywords.length} SEO keywords for user ${this.userId}`);

      return {
        keywords: validatedKeywords,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: `${aiResponse.provider}${aiResponse.model ? ` (${aiResponse.model})` : ''}`,
          userContext: `Service areas: ${areasText}${specialtiesText}`,
        },
      };
    } catch (error) {
      console.error('❌ AI keyword generation failed:', error);
      throw new Error(`Failed to generate keywords: ${(error as Error).message}`);
    }
  }

  /**
   * Generate fallback keywords if AI fails
   */
  getFallbackKeywords(serviceAreas: string[]): GeneratedKeywords {
    const fallbackKeywords: InsertSeoKeyword[] = [
      { userId: this.userId, keyword: "Omaha real estate agent", searchVolume: 1200, difficulty: 70, neighborhood: null, currentRank: null, previousRank: null, lastChecked: null },
      { userId: this.userId, keyword: "homes for sale Omaha", searchVolume: 2800, difficulty: 75, neighborhood: null, currentRank: null, previousRank: null, lastChecked: null },
      { userId: this.userId, keyword: "Omaha real estate market", searchVolume: 950, difficulty: 65, neighborhood: null, currentRank: null, previousRank: null, lastChecked: null },
      { userId: this.userId, keyword: "buy house Omaha Nebraska", searchVolume: 720, difficulty: 60, neighborhood: null, currentRank: null, previousRank: null, lastChecked: null },
    ];

    // Add service area specific keywords if provided
    if (serviceAreas.length > 0) {
      serviceAreas.forEach(area => {
        fallbackKeywords.push({
          userId: this.userId,
          keyword: `${area} homes for sale`,
          searchVolume: 450,
          difficulty: 55,
          neighborhood: area,
          currentRank: null,
          previousRank: null,
          lastChecked: null,
        });
      });
    }

    return {
      keywords: fallbackKeywords.slice(0, 10), // Limit to 10 keywords
      metadata: {
        generatedAt: new Date().toISOString(),
        model: 'fallback',
        userContext: `Service areas: ${serviceAreas.join(', ') || 'Omaha metro'}`,
      },
    };
  }
}
