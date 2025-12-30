import type { InsertScheduledPost, MarketData } from "@shared/schema";

export interface GeneratedContentPlan {
  posts: InsertScheduledPost[];
  metadata: {
    generatedAt: string;
    model: string;
    planDuration: string;
    userContext: string;
  };
}

export class AIContentCalendarGenerator {
  private openai: any;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async initialize() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }
    
    const { OpenAI } = await import('openai');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generate30DayPlan(
    serviceAreas: string[],
    marketData: MarketData[],
    targetAudience?: string,
    specialties?: string[]
  ): Promise<GeneratedContentPlan> {
    if (!this.openai) {
      await this.initialize();
    }

    const areasText = serviceAreas.length > 0 ? serviceAreas.join(', ') : 'Omaha metro area';
    const audienceText = targetAudience || 'home buyers and sellers';
    const specialtiesText = specialties && specialties.length > 0 
      ? ` Specialties: ${specialties.join(', ')}.` 
      : '';

    // Create market insights from actual market data
    const marketInsights = marketData.map(m => 
      `${m.neighborhood}: avg $${Math.round((m.avgPrice || 0) / 1000)}K, ${m.daysOnMarket} days on market, ${m.trend} market`
    ).join('; ');

    const prompt = `You are a social media content strategist for real estate agents. Create a 30-day content calendar for a real estate agent in Omaha, Nebraska.

**Agent Profile:**
- Service Areas: ${areasText}
- Target Audience: ${audienceText}${specialtiesText}
- Current Market Data: ${marketInsights || 'Strong Omaha market'}

**Content Strategy:**
Create exactly 30 social media posts (one per day) that:
1. Mix content types: 40% local market updates, 30% neighborhood spotlights, 20% buyer/seller tips, 10% community engagement
2. Rotate platforms: Facebook, Instagram, LinkedIn, X (Twitter)
3. Vary posting times: mornings (9-10am), afternoons (2-3pm), evenings (6-7pm)
4. Include relevant hashtags for Instagram posts only
5. Reference actual market data and neighborhoods from service areas
6. Keep posts concise and engaging (Instagram: 150-200 chars, others: 200-300 chars)

**Post Types:**
- "local_market": Market updates, price trends, inventory levels
- "neighborhood_spotlight": Highlight specific neighborhoods with amenities, lifestyle
- "buyer_tips": First-time buyer advice, financing, inspections
- "seller_tips": Staging, pricing strategy, market timing
- "community": Local events, businesses, Omaha lifestyle

Return ONLY a valid JSON array with exactly 30 posts in this structure:
[
  {
    "platform": "facebook|instagram|linkedin|x",
    "postType": "local_market|neighborhood_spotlight|buyer_tips|seller_tips|community",
    "content": "engaging post text (concise, platform-appropriate)",
    "hashtags": ["tag1", "tag2"] (only for Instagram, empty array for others),
    "neighborhood": "neighborhood name or null",
    "dayOffset": day_number (0-29, where 0 = tomorrow)
  }
]`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_completion_tokens: 3000,
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

      const posts = JSON.parse(responseText);

      // Validate structure
      if (!Array.isArray(posts) || posts.length === 0) {
        throw new Error('Invalid response structure: expected array of posts');
      }

      if (posts.length < 20) {
        console.warn(`AI generated only ${posts.length} posts, expected 30. Using fallback data.`);
        return this.getFallbackContentPlan(serviceAreas, marketData);
      }

      const today = new Date();

      // Validate and transform each post
      const validatedPosts: InsertScheduledPost[] = posts.map((p, index) => {
        if (!p.platform || !p.postType || !p.content) {
          throw new Error(`Invalid post at index ${index}: missing required fields`);
        }

        // Validate platform
        const validPlatforms = ['facebook', 'instagram', 'linkedin', 'x'];
        if (!validPlatforms.includes(p.platform)) {
          p.platform = 'facebook'; // Default fallback
        }

        // Validate post type
        const validTypes = ['local_market', 'neighborhood_spotlight', 'buyer_tips', 'seller_tips', 'community'];
        if (!validTypes.includes(p.postType)) {
          p.postType = 'local_market'; // Default fallback
        }

        // Calculate scheduled date
        const dayOffset = typeof p.dayOffset === 'number' ? p.dayOffset : index;
        const scheduleDate = new Date(today);
        scheduleDate.setDate(today.getDate() + dayOffset + 1); // +1 to start tomorrow
        
        // Vary posting times
        const hour = dayOffset % 3 === 0 ? 9 : (dayOffset % 3 === 1 ? 14 : 18);
        scheduleDate.setHours(hour, 0, 0, 0);

        return {
          userId: this.userId,
          platform: p.platform,
          postType: p.postType,
          content: p.content,
          hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
          scheduledFor: scheduleDate,
          status: 'pending' as const,
          isEdited: false,
          isAiGenerated: true,
          originalContent: p.content,
          neighborhood: p.neighborhood || null,
          seoScore: 75,
          metadata: { 
            aiGenerated: true,
            generatedAt: new Date().toISOString(),
          },
        };
      });

      console.log(`✅ AI generated ${validatedPosts.length}-day content calendar for user ${this.userId}`);

      return {
        posts: validatedPosts,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: 'gpt-4o-mini',
          planDuration: `${validatedPosts.length} days`,
          userContext: `Service areas: ${areasText}, Audience: ${audienceText}`,
        },
      };
    } catch (error) {
      console.error('❌ AI content calendar generation failed:', error);
      console.log('🔄 Using fallback content plan...');
      return this.getFallbackContentPlan(serviceAreas, marketData);
    }
  }

  /**
   * Generate fallback content plan if AI fails
   */
  getFallbackContentPlan(serviceAreas: string[], marketData: MarketData[]): GeneratedContentPlan {
    const areas = serviceAreas.length > 0 ? serviceAreas : ['Omaha'];
    const platforms = ['facebook', 'instagram', 'linkedin', 'x'];
    const today = new Date();

    const contentTemplates = [
      { type: 'local_market', content: `Market update: The ${areas[0]} real estate market continues to show strong activity. Great time for both buyers and sellers!` },
      { type: 'neighborhood_spotlight', content: `Spotlight on ${areas[0]}: This vibrant neighborhood offers excellent schools, parks, and convenient shopping. Perfect for families!` },
      { type: 'buyer_tips', content: `First-time buyer tip: Get pre-approved before house hunting. It shows sellers you're serious and helps you understand your budget.` },
      { type: 'seller_tips', content: `Seller strategy: Proper staging can increase your home's value by 5-10%. Let's discuss how to showcase your property's best features!` },
      { type: 'community', content: `Love living in Omaha! Check out the local farmers market this weekend for fresh produce and community connections. 🌽` },
    ];

    const fallbackPosts: InsertScheduledPost[] = [];

    for (let day = 0; day < 30; day++) {
      const scheduleDate = new Date(today);
      scheduleDate.setDate(today.getDate() + day + 1);
      scheduleDate.setHours(9 + (day % 8), 0, 0, 0);

      const template = contentTemplates[day % contentTemplates.length];
      const platform = platforms[day % platforms.length];

      fallbackPosts.push({
        userId: this.userId,
        platform,
        postType: template.type,
        content: template.content,
        hashtags: platform === 'instagram' ? ['OmahaRealEstate', 'NebraskaHomes'] : [],
        scheduledFor: scheduleDate,
        status: 'pending',
        isEdited: false,
        isAiGenerated: false,
        originalContent: template.content,
        neighborhood: areas[day % areas.length],
        seoScore: 70,
        metadata: { 
          aiGenerated: false,
          fallback: true,
        },
      });
    }

    return {
      posts: fallbackPosts,
      metadata: {
        generatedAt: new Date().toISOString(),
        model: 'fallback',
        planDuration: '30 days',
        userContext: `Service areas: ${areas.join(', ')}`,
      },
    };
  }
}
