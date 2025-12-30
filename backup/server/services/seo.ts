export interface SEOAnalysis {
  score: number;
  issues: string[];
  recommendations: string[];
  keywords: { keyword: string; density: number; rank?: number }[];
}

export interface SiteHealthMetrics {
  loadTime: number;
  mobileScore: number;
  seoScore: number;
  securityScore: number;
  accessibilityScore: number;
}

export interface AIGeneratedKeyword {
  keyword: string;
  currentRank: number;
  searchVolume: number;
  difficulty: number;
  neighborhood?: string;
}

export class SEOService {
  async analyzeContent(content: string, targetKeywords: string[]): Promise<SEOAnalysis> {
    try {
      const analysis = this.performContentAnalysis(content, targetKeywords);
      return analysis;
    } catch (error) {
      console.error('SEO analysis error:', error);
      throw new Error('Failed to analyze content for SEO');
    }
  }

  async checkKeywordRankings(keywords: string[], domain: string): Promise<{ keyword: string; rank: number | null }[]> {
    try {
      // In a real implementation, this would integrate with SEO APIs like SEMrush, Ahrefs, or SerpAPI
      console.log('Checking rankings for keywords:', keywords, 'domain:', domain);
      
      return keywords.map(keyword => ({
        keyword,
        rank: Math.floor(Math.random() * 100) + 1, // Mock ranking
      }));
    } catch (error) {
      console.error('Keyword ranking check error:', error);
      throw new Error('Failed to check keyword rankings');
    }
  }

  async getSiteHealth(url: string): Promise<SiteHealthMetrics> {
    try {
      // In a real implementation, this would integrate with PageSpeed Insights API, Lighthouse, etc.
      console.log('Checking site health for:', url);
      
      return {
        loadTime: Math.random() * 2 + 1, // 1-3 seconds
        mobileScore: Math.floor(Math.random() * 10) + 90, // 90-100
        seoScore: Math.floor(Math.random() * 10) + 85, // 85-95
        securityScore: Math.floor(Math.random() * 5) + 95, // 95-100
        accessibilityScore: Math.floor(Math.random() * 15) + 85, // 85-100
      };
    } catch (error) {
      console.error('Site health check error:', error);
      throw new Error('Failed to check site health');
    }
  }

  async suggestContentTopics(neighborhood?: string): Promise<string[]> {
    const baseTopics = [
      'First-time home buyer guide',
      'Luxury home features that matter',
      'Understanding the mortgage process',
      'Home staging tips for quick sales',
      'Market trends and predictions',
      'Investment property opportunities',
    ];

    const neighborhoodTopics = neighborhood ? [
      `${neighborhood} neighborhood guide`,
      `Best restaurants in ${neighborhood}`,
      `${neighborhood} school district overview`,
      `Parks and recreation in ${neighborhood}`,
      `${neighborhood} real estate market analysis`,
    ] : [];

    return [...baseTopics, ...neighborhoodTopics];
  }

  async generateTopKeywordsWithAI(
    location: string = 'Omaha, Nebraska',
    businessType: string = 'real estate agent',
    marketData?: any[]
  ): Promise<AIGeneratedKeyword[]> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        console.warn('⚠️  OpenAI API key not found - using fallback keywords (not recommended)');
        return this.getFallbackKeywords();
      }

      const { OpenAI } = await import('openai');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Build market intelligence context from real data
      let marketContext = '';
      if (marketData && marketData.length > 0) {
        const marketSummary = marketData.map(data => {
          const trend = data.trend || 'stable';
          const trendDirection = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
          return `- ${data.neighborhood || 'Overall Market'}: Median Price $${data.medianPrice?.toLocaleString() || 'N/A'} (${trendDirection} ${data.percentChange || 0}%), ${data.daysOnMarket || 'N/A'} days on market, ${data.inventory || 'N/A'} active listings`;
        }).join('\n');

        marketContext = `\n\n**REAL-TIME MARKET DATA (Use this actual data, do NOT make up numbers):**
${marketSummary}

Based on this live market data, generate keywords that reflect current market conditions.`;
      }

      const prompt = `You are an expert SEO specialist for real estate. Generate the top 12 most valuable SEO keywords for a ${businessType} in ${location}.${marketContext}

For each keyword, provide:
1. The exact keyword phrase (optimized for local SEO)
2. Realistic monthly search volume (base on market activity and neighborhood popularity)
3. Current ranking (1-100, where lower is better - assume good SEO practices)
4. Keyword difficulty (0-100, where higher is more competitive)
5. Associated neighborhood (MUST use actual neighborhoods from the market data above, or null if general)

Focus on:
- High-intent commercial keywords (buyers/sellers looking for agents)
- Location-specific keywords aligned with market data trends
- Neighborhood-based searches for areas with strong market activity
- Long-tail keywords with good conversion potential
- Keywords that capitalize on current market trends (hot neighborhoods, price points, inventory levels)

Return ONLY a valid JSON array with this exact structure:
[
  {
    "keyword": "exact keyword phrase",
    "searchVolume": number,
    "currentRank": number (1-100),
    "difficulty": number (0-100),
    "neighborhood": "neighborhood name or null"
  }
]`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      });

      let responseText = completion.choices[0]?.message?.content?.trim();
      if (!responseText) {
        throw new Error('Empty response from OpenAI');
      }

      // Remove markdown code blocks if present
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?$/g, '').trim();
      } else if (responseText.startsWith('```')) {
        responseText = responseText.replace(/```\n?/g, '').trim();
      }

      const keywords = JSON.parse(responseText);
      
      if (!Array.isArray(keywords)) {
        throw new Error('Invalid response format from OpenAI - expected JSON array');
      }

      // Validate keyword structure
      const isValid = keywords.every(kw => 
        typeof kw.keyword === 'string' &&
        typeof kw.searchVolume === 'number' &&
        typeof kw.currentRank === 'number' &&
        typeof kw.difficulty === 'number'
      );

      if (!isValid) {
        throw new Error('Invalid keyword schema from OpenAI - missing required fields');
      }

      return keywords;
    } catch (error) {
      console.error('❌ AI keyword generation error:', error);
      // Rethrow error to surface to client - do NOT fall back to static keywords
      // Only use fallback when API key is completely missing (handled above)
      throw new Error(`Failed to generate live market-driven keywords: ${(error as Error).message}`);
    }
  }

  private getFallbackKeywords(): AIGeneratedKeyword[] {
    return [
      { keyword: 'omaha real estate agent', currentRank: 3, searchVolume: 1200, difficulty: 75, neighborhood: undefined },
      { keyword: 'dundee homes for sale', currentRank: 1, searchVolume: 450, difficulty: 45, neighborhood: 'Dundee' },
      { keyword: 'aksarben real estate', currentRank: 2, searchVolume: 380, difficulty: 52, neighborhood: 'Aksarben' },
      { keyword: 'blackstone district homes', currentRank: 5, searchVolume: 290, difficulty: 48, neighborhood: 'Blackstone' },
      { keyword: 'best realtor omaha nebraska', currentRank: 4, searchVolume: 950, difficulty: 82, neighborhood: undefined },
      { keyword: 'omaha luxury homes', currentRank: 7, searchVolume: 720, difficulty: 68, neighborhood: undefined },
      { keyword: 'west omaha houses', currentRank: 6, searchVolume: 540, difficulty: 58, neighborhood: 'West Omaha' },
      { keyword: 'sell my house fast omaha', currentRank: 8, searchVolume: 680, difficulty: 71, neighborhood: undefined },
      { keyword: 'downtown omaha condos', currentRank: 3, searchVolume: 410, difficulty: 55, neighborhood: 'Downtown' },
      { keyword: 'omaha first time home buyer', currentRank: 9, searchVolume: 580, difficulty: 64, neighborhood: undefined },
      { keyword: 'omaha real estate market trends', currentRank: 12, searchVolume: 320, difficulty: 59, neighborhood: undefined },
      { keyword: 'relocating to omaha', currentRank: 15, searchVolume: 890, difficulty: 47, neighborhood: undefined },
    ];
  }

  private performContentAnalysis(content: string, targetKeywords: string[]): SEOAnalysis {
    const words = content.toLowerCase().split(/\s+/);
    const wordCount = words.length;
    
    let score = 60; // Base score
    const issues: string[] = [];
    const recommendations: string[] = [];
    const keywords: { keyword: string; density: number; rank?: number }[] = [];

    // Analyze keyword density
    targetKeywords.forEach(keyword => {
      const keywordOccurrences = (content.toLowerCase().match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
      const density = (keywordOccurrences / wordCount) * 100;
      
      keywords.push({ keyword, density });

      if (density < 0.5) {
        issues.push(`Low keyword density for "${keyword}" (${density.toFixed(1)}%)`);
        recommendations.push(`Increase usage of "${keyword}" to 1-2% density`);
      } else if (density > 3) {
        issues.push(`Keyword stuffing detected for "${keyword}" (${density.toFixed(1)}%)`);
        recommendations.push(`Reduce usage of "${keyword}" to avoid over-optimization`);
        score -= 10;
      } else {
        score += 5;
      }
    });

    // Content length analysis
    if (wordCount < 300) {
      issues.push('Content too short for SEO optimization');
      recommendations.push('Expand content to at least 800 words for better SEO performance');
      score -= 15;
    } else if (wordCount > 2000) {
      score += 10;
    }

    // Check for headings (simple heuristic)
    const hasHeadings = content.includes('#') || content.includes('<h');
    if (!hasHeadings) {
      issues.push('No headings detected');
      recommendations.push('Add H1, H2, and H3 headings to structure content');
      score -= 10;
    } else {
      score += 5;
    }

    // Check for local terms
    const localTerms = ['omaha', 'nebraska', 'neighborhood', 'local', 'community'];
    const hasLocalTerms = localTerms.some(term => content.toLowerCase().includes(term));
    if (hasLocalTerms) {
      score += 10;
    } else {
      recommendations.push('Include local Omaha references for better local SEO');
    }

    return {
      score: Math.min(100, Math.max(0, score)),
      issues,
      recommendations,
      keywords,
    };
  }
}

export const seoService = new SEOService();
