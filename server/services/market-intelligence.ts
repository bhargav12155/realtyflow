export interface MarketOverview {
  medianHomePrice: number;
  medianPriceChange: string;
  avgDaysOnMarket: number;
  monthsOfInventory: number;
  activeListings: number;
  marketCondition: 'hot' | 'balanced' | 'cooling';
}

export interface NeighborhoodInsight {
  name: string;
  medianPrice: number;
  trend: 'hot' | 'rising' | 'steady' | 'cooling';
  daysOnMarket: number;
  priceChange: string;
  inventory: number;
  aiInsight: string;
}

export interface MarketIntelligence {
  overview: MarketOverview;
  trendingNeighborhoods: NeighborhoodInsight[];
  aiSummary: string;
  contentOpportunities: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    reasoning: string;
  }>;
  lastUpdated: string;
}

export class MarketIntelligenceService {
  async generateIntelligence(marketData: any[]): Promise<MarketIntelligence> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        console.warn('⚠️  OpenAI API key not found - returning basic market intelligence');
        return this.getBasicIntelligence(marketData);
      }

      if (!marketData || marketData.length === 0) {
        throw new Error('No market data available for analysis');
      }

      const { OpenAI } = await import('openai');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Calculate base statistics
      const overview = this.calculateOverview(marketData);
      
      // Prepare market data summary for AI
      const marketSummary = marketData.map(d => ({
        neighborhood: d.neighborhood,
        avgPrice: d.avgPrice,
        daysOnMarket: d.daysOnMarket,
        inventory: d.inventory,
        priceGrowth: d.priceGrowth,
        trend: d.trend
      }));

      const prompt = `You are a real estate market analyst specializing in Omaha, Nebraska. Analyze this market data and provide actionable insights.

**MARKET DATA:**
${JSON.stringify(marketSummary, null, 2)}

**CALCULATED OVERVIEW:**
- Median Home Price: $${overview.medianHomePrice.toLocaleString()}
- Average Days on Market: ${overview.avgDaysOnMarket}
- Months of Inventory: ${overview.monthsOfInventory}
- Active Listings: ${overview.activeListings}

Generate a comprehensive market intelligence report with:

1. **AI Market Summary** (2-3 sentences): Synthesize the overall market condition, key trends, and what it means for real estate agents and their clients.

2. **Top 3 Trending Neighborhoods** (for each provide):
   - Short AI insight (1 sentence about why this neighborhood is noteworthy)
   - Use actual data from above

3. **Content Opportunities** (3-5 items): Suggest blog post topics, social media content, or marketing angles based on current market trends. For each:
   - Title
   - Description (what it should cover)
   - Priority (high/medium/low)
   - Reasoning (why this is timely/valuable now)

Return ONLY a valid JSON object with this structure:
{
  "aiSummary": "market summary text",
  "neighborhoodInsights": [
    {
      "name": "neighborhood name",
      "aiInsight": "why this neighborhood is noteworthy"
    }
  ],
  "contentOpportunities": [
    {
      "title": "content title",
      "description": "what to cover",
      "priority": "high|medium|low",
      "reasoning": "why timely"
    }
  ]
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1500,
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

      const aiResponse = JSON.parse(responseText);

      // Validate response structure
      if (!aiResponse.aiSummary || !Array.isArray(aiResponse.neighborhoodInsights) || !Array.isArray(aiResponse.contentOpportunities)) {
        throw new Error('Invalid AI response structure');
      }

      // Build trending neighborhoods with AI insights
      const trendingNeighborhoods = this.buildTrendingNeighborhoods(marketData, aiResponse.neighborhoodInsights);

      return {
        overview,
        trendingNeighborhoods,
        aiSummary: aiResponse.aiSummary,
        contentOpportunities: aiResponse.contentOpportunities,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ Market intelligence generation error:', error);
      throw new Error(`Failed to generate market intelligence: ${(error as Error).message}`);
    }
  }

  private calculateOverview(marketData: any[]): MarketOverview {
    if (!marketData || marketData.length === 0) {
      throw new Error('No market data to calculate overview');
    }

    const prices = marketData.map(d => d.avgPrice || 0).filter(p => p > 0);
    const medianHomePrice = prices.length > 0 
      ? prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)]
      : 0;

    const avgDaysOnMarket = Math.round(
      marketData.reduce((sum, d) => sum + (d.daysOnMarket || 0), 0) / marketData.length
    );

    // Parse months of inventory correctly (values like "0.8 months", "1.4 months")
    const inventoryValues = marketData.map(d => {
      if (!d.inventory) return 0;
      // Extract numeric value from strings like "0.8 months" or "1.4"
      const numStr = String(d.inventory).replace(/[^\d.]/g, '');
      return parseFloat(numStr) || 0;
    }).filter(v => v > 0);

    const monthsOfInventory = inventoryValues.length > 0
      ? Math.round((inventoryValues.reduce((sum, v) => sum + v, 0) / inventoryValues.length) * 10) / 10
      : 0;

    // Calculate approximate active listings (if we assume avg sales rate)
    // Since we don't have actual listing counts, estimate from market activity
    const activeListings = Math.round(monthsOfInventory * marketData.length * 10);

    const medianPriceChange = this.calculatePriceChange(marketData);

    const hotCount = marketData.filter(d => d.trend === 'hot').length;
    const coolingCount = marketData.filter(d => d.trend === 'cooling').length;
    
    const marketCondition = hotCount > coolingCount ? 'hot' : 
                           coolingCount > hotCount ? 'cooling' : 
                           'balanced';

    return {
      medianHomePrice,
      medianPriceChange,
      avgDaysOnMarket,
      monthsOfInventory,
      activeListings,
      marketCondition,
    };
  }

  private calculatePriceChange(marketData: any[]): string {
    const growthValues = marketData
      .map(d => d.priceGrowth)
      .filter(g => g && g.includes('%'))
      .map(g => parseFloat(g.replace('%', '')))
      .filter(n => !isNaN(n));

    if (growthValues.length === 0) return '+0.0%';

    const avgGrowth = growthValues.reduce((sum, g) => sum + g, 0) / growthValues.length;
    const sign = avgGrowth >= 0 ? '+' : '';
    return `${sign}${avgGrowth.toFixed(1)}%`;
  }

  private buildTrendingNeighborhoods(marketData: any[], aiInsights: any[]): NeighborhoodInsight[] {
    const topNeighborhoods = marketData
      .filter(d => d.trend === 'hot' || d.trend === 'rising')
      .sort((a, b) => {
        const trendWeight = { hot: 3, rising: 2, steady: 1, cooling: 0 };
        return (trendWeight[b.trend as keyof typeof trendWeight] || 0) - 
               (trendWeight[a.trend as keyof typeof trendWeight] || 0);
      })
      .slice(0, 5);

    return topNeighborhoods.map(neighborhood => {
      const aiInsight = aiInsights.find(
        insight => insight.name.toLowerCase() === neighborhood.neighborhood.toLowerCase()
      );

      // Parse inventory correctly (values like "0.8 months")
      const invStr = String(neighborhood.inventory || '0').replace(/[^\d.]/g, '');
      const inventoryMonths = parseFloat(invStr) || 0;

      return {
        name: neighborhood.neighborhood,
        medianPrice: neighborhood.avgPrice,
        trend: neighborhood.trend,
        daysOnMarket: neighborhood.daysOnMarket,
        priceChange: neighborhood.priceGrowth || '+0%',
        inventory: inventoryMonths,
        aiInsight: aiInsight?.aiInsight || `${neighborhood.neighborhood} is showing ${neighborhood.trend} market activity.`,
      };
    });
  }

  private getBasicIntelligence(marketData: any[]): MarketIntelligence {
    const overview = this.calculateOverview(marketData);
    
    const trendingNeighborhoods = marketData
      .filter(d => d.trend === 'hot' || d.trend === 'rising')
      .slice(0, 3)
      .map(d => {
        // Parse inventory correctly (values like "0.8 months")
        const invStr = String(d.inventory || '0').replace(/[^\d.]/g, '');
        const inventoryMonths = parseFloat(invStr) || 0;
        
        return {
          name: d.neighborhood,
          medianPrice: d.avgPrice,
          trend: d.trend,
          daysOnMarket: d.daysOnMarket,
          priceChange: d.priceGrowth || '+0%',
          inventory: inventoryMonths,
          aiInsight: `${d.neighborhood} is showing ${d.trend} market activity.`,
        };
      });

    return {
      overview,
      trendingNeighborhoods,
      aiSummary: `The Omaha real estate market is ${overview.marketCondition} with a median home price of $${overview.medianHomePrice.toLocaleString()} and homes selling in an average of ${overview.avgDaysOnMarket} days.`,
      contentOpportunities: [
        {
          title: 'Market Update Report',
          description: 'Share current market statistics and trends',
          priority: 'high',
          reasoning: 'Regular market updates establish expertise',
        },
        {
          title: 'Neighborhood Spotlight',
          description: 'Feature trending neighborhoods',
          priority: 'medium',
          reasoning: 'Capitalize on hot market areas',
        },
      ],
      lastUpdated: new Date().toISOString(),
    };
  }
}
