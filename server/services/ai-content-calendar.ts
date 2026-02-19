import type { InsertScheduledPost, MarketData } from "@shared/schema";
import { PLATFORM_CONFIGS } from "@shared/platform-prompts";

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

  /**
   * Generate content plan for specified number of weeks
   */
  async generateContentPlan(
    serviceAreas: string[],
    marketData: MarketData[],
    targetAudience?: string,
    specialties?: string[],
    weeks: number = 4
  ): Promise<GeneratedContentPlan> {
    if (!this.openai) {
      await this.initialize();
    }

    const days = weeks * 7;
    const areasText = serviceAreas.length > 0 ? serviceAreas.join(', ') : 'Omaha metro area';
    const audienceText = targetAudience || 'home buyers and sellers';
    const specialtiesText = specialties && specialties.length > 0 
      ? ` Specialties: ${specialties.join(', ')}.` 
      : '';

    // Create market insights from actual market data
    const marketInsights = marketData.map(m => 
      `${m.neighborhood}: avg $${Math.round((m.avgPrice || 0) / 1000)}K, ${m.daysOnMarket} days on market, ${m.trend} market`
    ).join('; ');

    const fbConfig = PLATFORM_CONFIGS.facebook;
    const igConfig = PLATFORM_CONFIGS.instagram;
    const liConfig = PLATFORM_CONFIGS.linkedin;
    const xConfig = PLATFORM_CONFIGS.x;

    const prompt = `You are a social media content strategist for real estate agents. Create a ${weeks}-week (${days}-day) content calendar for a real estate agent in Omaha, Nebraska.

**Agent Profile:**
- Service Areas: ${areasText}
- Target Audience: ${audienceText}${specialtiesText}
- Current Market Data: ${marketInsights || 'Strong Omaha market'}

**Content Strategy:**
Create posts for ALL 5 platforms (Facebook, Instagram, LinkedIn, X, TikTok) for EACH day.
Each day should have a separate post for EACH platform, optimized for that platform's format.
Total posts = ${days} days × 5 platforms = ${days * 5} posts.

1. Mix content types: 40% local market updates, 30% neighborhood spotlights, 20% buyer/seller tips, 10% community engagement
2. Every day must have one post for EACH platform: Facebook, Instagram, LinkedIn, X (Twitter), TikTok
3. Vary posting times: mornings (9-10am), afternoons (2-3pm), evenings (6-7pm)
4. Include relevant hashtags for Instagram posts only (1-2 hashtags max - 21% better engagement than 3+)
5. Reference actual market data and neighborhoods from service areas
6. CRITICAL: Optimize character count for each platform's engagement sweet spot

**📊 Platform Character Optimization (FOLLOW THESE EXACTLY):**

FACEBOOK:
- Optimal: ${fbConfig.optimalCharacters.min}-${fbConfig.optimalCharacters.max} characters (posts under 50 get 66% more engagement!)
- Truncates at: ${fbConfig.truncatesAt} chars - put hook FIRST
- ${fbConfig.hashtagRecommendation}
- Lead with attention-grabbing hook (users spend only 2.5 seconds scanning)

INSTAGRAM:
- Optimal: ${igConfig.optimalCharacters.min}-${igConfig.optimalCharacters.max} characters for maximum engagement
- Truncates at: ${igConfig.truncatesAt} chars - first line is critical!
- ${igConfig.hashtagRecommendation}
- Use emojis sparingly, line breaks strategically

X (TWITTER):
- Optimal: ${xConfig.optimalCharacters.min}-${xConfig.optimalCharacters.max} characters (36% more engagement!)
- Maximum: ${xConfig.maxCharacters} chars (hard limit)
- ${xConfig.hashtagRecommendation}
- Create urgency or curiosity in every tweet

LINKEDIN:
- Optimal: ${liConfig.optimalCharacters.min}-${liConfig.optimalCharacters.max} characters (~25 words)
- Truncates at: ${liConfig.truncatesAt} chars with 'See More'
- ${liConfig.hashtagRecommendation}
- Professional yet approachable tone, position as thought leader

TIKTOK:
- Optimal: 100-150 characters for video description
- Short-form, vertical video style content
- Reference trending sounds and challenges when relevant
- Use casual, energetic tone with emoji
- Focus on quick tips, property reveals, behind-the-scenes content

**Post Types:**
- "local_market": Market updates, price trends, inventory levels
- "neighborhood_spotlight": Highlight specific neighborhoods with amenities, lifestyle
- "buyer_tips": First-time buyer advice, financing, inspections
- "seller_tips": Staging, pricing strategy, market timing
- "community": Local events, businesses, Omaha lifestyle

💡 KEY INSIGHT: Average attention span is 1.7 seconds on mobile - LEAD WITH A STRONG HOOK!

Return ONLY a valid JSON array with exactly ${days * 5} posts in this structure:
[
  {
    "platform": "facebook|instagram|linkedin|x|tiktok",
    "postType": "local_market|neighborhood_spotlight|buyer_tips|seller_tips|community",
    "content": "engaging post text (OPTIMIZED for platform character count)",
    "hashtags": ["tag1", "tag2"] (only for Instagram, 1-2 max, empty array for others),
    "neighborhood": "neighborhood name or null",
    "dayOffset": day_number (0-${days-1}, where 0 = tomorrow)
  }
]`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_completion_tokens: 16000,
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

      const expectedPosts = weeks * 7 * 5;
      const minPosts = Math.max(5, Math.floor(expectedPosts * 0.6));
      
      if (posts.length < minPosts) {
        console.warn(`AI generated only ${posts.length} posts, expected ${expectedPosts}. Using fallback data.`);
        return this.getFallbackContentPlan(serviceAreas, marketData, weeks);
      }

      const today = new Date();

      // Validate and transform each post
      const validatedPosts: InsertScheduledPost[] = posts.map((p, index) => {
        if (!p.platform || !p.postType || !p.content) {
          throw new Error(`Invalid post at index ${index}: missing required fields`);
        }

        // Validate platform
        const validPlatforms = ['facebook', 'instagram', 'linkedin', 'x', 'tiktok'];
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

      console.log(`✅ AI generated ${weeks}-week content calendar with ${validatedPosts.length} posts for user ${this.userId}`);

      return {
        posts: validatedPosts,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: 'gpt-4o-mini',
          planDuration: `${weeks} weeks (${days} days)`,
          userContext: `Service areas: ${areasText}, Audience: ${audienceText}`,
        },
      };
    } catch (error) {
      console.error('❌ AI content calendar generation failed:', error);
      console.log('🔄 Using fallback content plan...');
      return this.getFallbackContentPlan(serviceAreas, marketData, weeks);
    }
  }

  /**
   * Legacy method - calls generateContentPlan with 4 weeks (30 days)
   */
  async generate30DayPlan(
    serviceAreas: string[],
    marketData: MarketData[],
    targetAudience?: string,
    specialties?: string[]
  ): Promise<GeneratedContentPlan> {
    return this.generateContentPlan(serviceAreas, marketData, targetAudience, specialties, 4);
  }

  /**
   * Generate fallback content plan if AI fails
   */
  getFallbackContentPlan(serviceAreas: string[], marketData: MarketData[], weeks: number = 4): GeneratedContentPlan {
    const areas = serviceAreas.length > 0 ? serviceAreas : ['Omaha'];
    const platforms = ['facebook', 'instagram', 'linkedin', 'x', 'tiktok'];
    const today = new Date();

    const contentTemplates = [
      { type: 'local_market', content: `Market update: The ${areas[0]} real estate market continues to show strong activity. Great time for both buyers and sellers!` },
      { type: 'neighborhood_spotlight', content: `Spotlight on ${areas[0]}: This vibrant neighborhood offers excellent schools, parks, and convenient shopping. Perfect for families!` },
      { type: 'buyer_tips', content: `First-time buyer tip: Get pre-approved before house hunting. It shows sellers you're serious and helps you understand your budget.` },
      { type: 'seller_tips', content: `Seller strategy: Proper staging can increase your home's value by 5-10%. Let's discuss how to showcase your property's best features!` },
      { type: 'community', content: `Love living in Omaha! Check out the local farmers market this weekend for fresh produce and community connections. 🌽` },
    ];

    const fallbackPosts: InsertScheduledPost[] = [];
    const days = weeks * 7;

    for (let day = 0; day < days; day++) {
      for (let pIdx = 0; pIdx < platforms.length; pIdx++) {
        const scheduleDate = new Date(today);
        scheduleDate.setDate(today.getDate() + day + 1);
        scheduleDate.setHours(9 + (day % 8), pIdx * 3, 0, 0);
        const template = contentTemplates[day % contentTemplates.length];
        const platform = platforms[pIdx];
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
    }

    return {
      posts: fallbackPosts,
      metadata: {
        generatedAt: new Date().toISOString(),
        model: 'fallback',
        planDuration: `${weeks} weeks (${days} days)`,
        userContext: `Service areas: ${areas.join(', ')}`,
      },
    };
  }
}
