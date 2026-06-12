import type { InsertMarketData } from "@shared/schema";

export interface GeneratedMarketData {
  neighborhoods: InsertMarketData[];
  metadata: {
    generatedAt: string;
    model: string;
    prompt: string;
  };
}

export class AIMarketDataGenerator {
  private userId: string;
  private location: { city: string; state: string; zipCode?: string };

  constructor(userId: string, location?: { city?: string; state?: string; zipCode?: string }) {
    this.userId = userId;
    this.location = {
      city: location?.city || "Omaha",
      state: location?.state || "Nebraska",
      zipCode: location?.zipCode,
    };
  }

  async generateOmahaMarketData(): Promise<GeneratedMarketData> {
    const city = this.location.city;
    const state = this.location.state;
    const zipCode = this.location.zipCode;
    const locationLabel = zipCode ? `${city}, ${state} (${zipCode})` : `${city}, ${state}`;

    const prompt = `You are a real estate market data analyst for ${locationLabel}. Generate realistic, current market statistics for major neighborhoods or areas in ${city}, ${state}.

Generate data for 10 neighborhoods or well-known areas in ${city}, ${state}. If you don't know specific neighborhoods for this city, use reasonable area names like "Downtown ${city}", "North ${city}", "South ${city}", "East ${city}", "West ${city}", "Midtown", "Suburbs", "Historic District", "New Development", "Waterfront" as appropriate.

For EACH neighborhood, provide:
1. **avgPrice** (integer): Average home price in dollars. Range $150,000-$1,500,000 depending on neighborhood desirability and local market.
2. **daysOnMarket** (integer): Average days homes stay on market. Range 10-60 days. Hot neighborhoods = lower numbers.
3. **inventory** (string): Months of inventory supply. Format as "X.X months". Range 0.5-3.5 months. Lower = hotter market.
4. **priceGrowth** (string): Year-over-year price growth. Format as "+X.X%" or "-X.X%". Range -3% to +15%. Premium neighborhoods typically higher.
5. **trend** (string): Market trend. Must be one of: "hot", "rising", "steady", "cooling"

**IMPORTANT CONSTRAINTS:**
- Use realistic price ranges appropriate for the ${city}, ${state} real estate market
- Keep data realistic and internally consistent (hot markets = low days on market + low inventory)
- Vary trends across neighborhoods to reflect a real market distribution
- Aim for mostly positive growth reflecting current market conditions

Return ONLY a valid JSON array with this exact structure:
[
  {
    "neighborhood": "neighborhood name",
    "avgPrice": integer,
    "daysOnMarket": integer,
    "inventory": "X.X months",
    "priceGrowth": "+X.X%",
    "trend": "hot|rising|steady|cooling"
  }
]`;

    try {
      // Use Unified AI Service (GitHub Copilot with OpenAI fallback)
      const { unifiedAI } = await import('./unified-ai');
      const aiResponse = await unifiedAI.generate(prompt, {
        temperature: 0.7,
        maxTokens: 800,
        jsonMode: true // Enable JSON mode for better structure enforcement
      });

      console.log(`✅ Market data generation AI response from: ${aiResponse.provider}`);

      let responseText = aiResponse.content.trim();

      // Remove markdown code blocks if present
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?$/g, '').trim();
      } else if (responseText.startsWith('```')) {
        responseText = responseText.replace(/```\n?/g, '').trim();
      }

      const neighborhoods = JSON.parse(responseText);

      // Validate structure
      if (!Array.isArray(neighborhoods) || neighborhoods.length === 0) {
        throw new Error('Invalid response structure: expected array of neighborhoods');
      }

      // Validate each neighborhood and add userId
      const validatedNeighborhoods: InsertMarketData[] = neighborhoods.map((n, index) => {
        if (!n.neighborhood || !n.avgPrice || !n.daysOnMarket || !n.inventory || !n.priceGrowth || !n.trend) {
          throw new Error(`Invalid neighborhood data at index ${index}: missing required fields`);
        }

        // Validate bounds
        if (n.avgPrice < 200000 || n.avgPrice > 1000000) {
          throw new Error(`Invalid avgPrice for ${n.neighborhood}: ${n.avgPrice} (must be 200K-1M)`);
        }

        if (n.daysOnMarket < 10 || n.daysOnMarket > 90) {
          throw new Error(`Invalid daysOnMarket for ${n.neighborhood}: ${n.daysOnMarket} (must be 10-90)`);
        }

        if (!['hot', 'rising', 'steady', 'cooling'].includes(n.trend)) {
          throw new Error(`Invalid trend for ${n.neighborhood}: ${n.trend}`);
        }

        return {
          userId: this.userId, // Add userId to satisfy InsertMarketData contract
          neighborhood: n.neighborhood,
          avgPrice: n.avgPrice,
          daysOnMarket: n.daysOnMarket,
          inventory: n.inventory,
          priceGrowth: n.priceGrowth,
          trend: n.trend,
        };
      });

      console.log(`✅ AI generated market data for ${validatedNeighborhoods.length} neighborhoods in ${this.location.city}, ${this.location.state}`);

      return {
        neighborhoods: validatedNeighborhoods,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: `${aiResponse.provider}${aiResponse.model ? ` (${aiResponse.model})` : ''}`,
          prompt: prompt.substring(0, 200) + '...',
        },
      };
    } catch (error) {
      console.error('❌ AI market data generation failed:', error);
      throw new Error(`Failed to generate market data: ${(error as Error).message}`);
    }
  }

  /**
   * Generate fallback market data if AI fails
   */
  getFallbackData(): GeneratedMarketData {
    const fallbackNeighborhoods: InsertMarketData[] = [
      { userId: this.userId, neighborhood: "Aksarben", avgPrice: 685000, daysOnMarket: 18, inventory: "0.8 months", priceGrowth: "+9.2%", trend: "hot" },
      { userId: this.userId, neighborhood: "Dundee", avgPrice: 625000, daysOnMarket: 21, inventory: "0.9 months", priceGrowth: "+8.7%", trend: "hot" },
      { userId: this.userId, neighborhood: "Blackstone", avgPrice: 465000, daysOnMarket: 23, inventory: "1.1 months", priceGrowth: "+7.5%", trend: "rising" },
      { userId: this.userId, neighborhood: "Benson", avgPrice: 425000, daysOnMarket: 25, inventory: "1.2 months", priceGrowth: "+6.8%", trend: "rising" },
      { userId: this.userId, neighborhood: "Midtown", avgPrice: 510000, daysOnMarket: 22, inventory: "1.0 months", priceGrowth: "+7.9%", trend: "rising" },
      { userId: this.userId, neighborhood: "West Omaha", avgPrice: 575000, daysOnMarket: 26, inventory: "1.3 months", priceGrowth: "+5.2%", trend: "steady" },
      { userId: this.userId, neighborhood: "Regency", avgPrice: 595000, daysOnMarket: 24, inventory: "1.2 months", priceGrowth: "+6.1%", trend: "steady" },
      { userId: this.userId, neighborhood: "Old Market", avgPrice: 445000, daysOnMarket: 20, inventory: "0.9 months", priceGrowth: "+8.3%", trend: "hot" },
      { userId: this.userId, neighborhood: "Elkhorn", avgPrice: 415000, daysOnMarket: 28, inventory: "1.5 months", priceGrowth: "+5.8%", trend: "steady" },
      { userId: this.userId, neighborhood: "Papillion", avgPrice: 385000, daysOnMarket: 29, inventory: "1.6 months", priceGrowth: "+5.4%", trend: "steady" },
    ];

    return {
      neighborhoods: fallbackNeighborhoods,
      metadata: {
        generatedAt: new Date().toISOString(),
        model: 'fallback',
        prompt: 'Static fallback data',
      },
    };
  }
}
