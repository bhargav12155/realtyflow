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

// Research-backed posting frequency per platform
// 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
const PLATFORM_POSTING_DAYS: Record<string, number[]> = {
  facebook:  [0, 1, 2, 3, 4, 5, 6], // every day (1x/day)
  instagram: [1, 3, 5, 6],            // Mon, Wed, Fri, Sat (4x/week)
  linkedin:  [1, 3, 5],               // Mon, Wed, Fri (3x/week)
  x:         [1, 2, 3, 4, 5],         // Mon–Fri (5x/week)
  tiktok:    [1, 2, 4, 6],            // Mon, Tue, Thu, Sat (4x/week)
};

// Platform-friendly day names for the AI prompt
const PLATFORM_SCHEDULE_DESCRIPTION: Record<string, string> = {
  facebook:  "every day (daily posting works well for Facebook's algorithm)",
  instagram: "Monday, Wednesday, Friday, Saturday only (4x/week — daily posting drops engagement 20%)",
  linkedin:  "Monday, Wednesday, Friday only (3x/week — professional audience fatigues quickly with daily posts)",
  x:         "Monday through Friday only (5x/week — weekday focus for maximum reach)",
  tiktok:    "Monday, Tuesday, Thursday, Saturday only (4x/week — algorithm rewards consistent schedule over volume)",
};

/**
 * Calculate which platforms should post on a given day offset from today.
 * dayOffset 0 = tomorrow, 1 = day after tomorrow, etc.
 */
function getPlatformsForDay(dayOffset: number, startDate: Date): string[] {
  const date = new Date(startDate);
  date.setDate(startDate.getDate() + dayOffset + 1);
  const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ...
  return Object.entries(PLATFORM_POSTING_DAYS)
    .filter(([, days]) => days.includes(dayOfWeek))
    .map(([platform]) => platform);
}

/**
 * Calculate total expected posts across all days for a given number of weeks.
 */
function calculateExpectedPosts(weeks: number, startDate: Date): number {
  const days = weeks * 7;
  let total = 0;
  for (let day = 0; day < days; day++) {
    total += getPlatformsForDay(day, startDate).length;
  }
  return total;
}

export class AIContentCalendarGenerator {
  private openai: any;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async initialize() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }
    
    const { GoogleGenAI } = await import('@google/genai');
    this.openai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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
    const today = new Date();
    const areasText = serviceAreas.length > 0 ? serviceAreas.join(', ') : 'the local area';
    const audienceText = targetAudience || 'home buyers and sellers';
    const specialtiesText = specialties && specialties.length > 0 
      ? ` Specialties: ${specialties.join(', ')}.` 
      : '';

    const marketInsights = marketData.map(m => 
      `${m.neighborhood}: avg $${Math.round((m.avgPrice || 0) / 1000)}K, ${m.daysOnMarket} days on market, ${m.trend} market`
    ).join('; ');

    const fbConfig = PLATFORM_CONFIGS.facebook;
    const igConfig = PLATFORM_CONFIGS.instagram;
    const liConfig = PLATFORM_CONFIGS.linkedin;
    const xConfig = PLATFORM_CONFIGS.x;

    const expectedPosts = calculateExpectedPosts(weeks, today);

    // Build the per-day schedule for the prompt so AI knows exactly which platforms each day
    const dayScheduleLines: string[] = [];
    for (let day = 0; day < days; day++) {
      const platforms = getPlatformsForDay(day, today);
      if (platforms.length > 0) {
        dayScheduleLines.push(`Day ${day + 1}: ${platforms.join(', ')}`);
      }
    }

    const prompt = `You are a social media content strategist for real estate agents. Create a ${weeks}-week (${days}-day) content calendar for a real estate agent.

**Agent Profile:**
- Service Areas: ${areasText}
- Target Audience: ${audienceText}${specialtiesText}
- Current Market Data: ${marketInsights || 'Strong local market'}

**Research-Backed Posting Schedule (FOLLOW EXACTLY):**
Do NOT post to every platform every day. Use this platform-specific frequency based on engagement research:

${Object.entries(PLATFORM_SCHEDULE_DESCRIPTION).map(([p, desc]) => `- ${p.toUpperCase()}: ${desc}`).join('\n')}

**Per-Day Platform Schedule:**
${dayScheduleLines.slice(0, 14).join('\n')}
(This pattern repeats for the full ${weeks} weeks)

Total posts to generate: ${expectedPosts} (NOT ${days * 5} — do not post to all platforms every day)

**Content Mix:**
1. 40% local market updates, 30% neighborhood spotlights, 20% buyer/seller tips, 10% community engagement
2. Vary posting times: mornings (9-10am), afternoons (2-3pm), evenings (6-7pm)
3. Include relevant hashtags for Instagram posts only (1-2 hashtags max)
4. Reference actual market data and neighborhoods from service areas

**📊 Platform Character Optimization:**

FACEBOOK:
- Optimal: ${fbConfig.optimalCharacters.min}-${fbConfig.optimalCharacters.max} characters
- ${fbConfig.hashtagRecommendation}
- Lead with attention-grabbing hook

INSTAGRAM:
- Optimal: ${igConfig.optimalCharacters.min}-${igConfig.optimalCharacters.max} characters
- ${igConfig.hashtagRecommendation}
- First line is critical — it's all users see before "more"

X (TWITTER):
- Optimal: ${xConfig.optimalCharacters.min}-${xConfig.optimalCharacters.max} characters (36% more engagement)
- Maximum: ${xConfig.maxCharacters} chars (hard limit)
- ${xConfig.hashtagRecommendation}

LINKEDIN:
- Optimal: ${liConfig.optimalCharacters.min}-${liConfig.optimalCharacters.max} characters
- ${liConfig.hashtagRecommendation}
- Professional yet approachable tone

TIKTOK:
- Optimal: 100-150 characters for video description
- Casual, energetic tone with emoji
- Focus on quick tips, property reveals, behind-the-scenes

**Post Types:**
- "local_market": Market updates, price trends, inventory
- "neighborhood_spotlight": Highlight neighborhoods with amenities
- "buyer_tips": First-time buyer advice, financing, inspections
- "seller_tips": Staging, pricing strategy, market timing
- "community": Local events, businesses, local lifestyle

Return ONLY a valid JSON array with exactly ${expectedPosts} posts:
[
  {
    "platform": "facebook|instagram|linkedin|x|tiktok",
    "postType": "local_market|neighborhood_spotlight|buyer_tips|seller_tips|community",
    "content": "engaging post text optimized for platform",
    "hashtags": ["tag1"] (only for instagram, 1-2 max, empty array for others),
    "neighborhood": "neighborhood name or null",
    "dayOffset": day_number (0-${days-1}, where 0 = tomorrow)
  }
]`;

    try {
      const completion = await this.openai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { maxOutputTokens: 8000 },
      });

      let responseText = (completion.text || '').trim();
      if (!responseText) {
        throw new Error('Empty response from Gemini');
      }

      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?$/g, '').trim();
      } else if (responseText.startsWith('```')) {
        responseText = responseText.replace(/```\n?/g, '').trim();
      }

      const posts = JSON.parse(responseText);

      if (!Array.isArray(posts) || posts.length === 0) {
        throw new Error('Invalid response structure: expected array of posts');
      }

      const minPosts = Math.max(5, Math.floor(expectedPosts * 0.6));
      
      if (posts.length < minPosts) {
        console.warn(`AI generated only ${posts.length} posts, expected ${expectedPosts}. Using fallback.`);
        return this.getFallbackContentPlan(serviceAreas, marketData, weeks);
      }

      const validPlatforms = ['facebook', 'instagram', 'linkedin', 'x', 'tiktok'];
      const validTypes = ['local_market', 'neighborhood_spotlight', 'buyer_tips', 'seller_tips', 'community'];

      const validatedPosts: InsertScheduledPost[] = posts.map((p, index) => {
        if (!p.platform || !p.postType || !p.content) {
          throw new Error(`Invalid post at index ${index}: missing required fields`);
        }

        if (!validPlatforms.includes(p.platform)) {
          p.platform = 'facebook';
        }
        if (!validTypes.includes(p.postType)) {
          p.postType = 'local_market';
        }

        const dayOffset = typeof p.dayOffset === 'number' ? p.dayOffset : index;
        const scheduleDate = new Date(today);
        scheduleDate.setDate(today.getDate() + dayOffset + 1);
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

      console.log(`✅ AI generated ${weeks}-week calendar with ${validatedPosts.length} posts (research-backed frequency) for user ${this.userId}`);

      return {
        posts: validatedPosts,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: 'gemini-2.5-flash',
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
   * Legacy method - calls generateContentPlan with 4 weeks
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
   * Generate fallback content plan following the same platform frequency rules
   */
  getFallbackContentPlan(serviceAreas: string[], marketData: MarketData[], weeks: number = 4): GeneratedContentPlan {
    const areas = serviceAreas.length > 0 ? serviceAreas : ['your area'];
    const today = new Date();
    const days = weeks * 7;

    const contentTemplates: Record<string, { type: string; content: string }> = {
      facebook: {
        type: 'local_market',
        content: `Market update: The ${areas[0]} real estate market continues to show strong activity. Great time for both buyers and sellers! Reach out to discuss your options.`,
      },
      instagram: {
        type: 'neighborhood_spotlight',
        content: `${areas[0]} has everything — great schools, parks, and community! 🏡 Whether you're buying or selling, let's make your next move the right one.`,
      },
      linkedin: {
        type: 'seller_tips',
        content: `Thinking of selling? Proper staging can increase your home's value by 5–10%. Here are three things to do before listing in today's market.`,
      },
      x: {
        type: 'buyer_tips',
        content: `Buyer tip: Get pre-approved before house hunting. It shows sellers you're serious and helps you know your budget. #RealEstate`,
      },
      tiktok: {
        type: 'community',
        content: `Love living here! 🏡 Local gems, great neighborhoods, and an amazing community await. Ask me anything about buying or selling here!`,
      },
    };

    const fallbackPosts: InsertScheduledPost[] = [];

    for (let day = 0; day < days; day++) {
      const scheduledPlatforms = getPlatformsForDay(day, today);
      
      scheduledPlatforms.forEach((platform, pIdx) => {
        const scheduleDate = new Date(today);
        scheduleDate.setDate(today.getDate() + day + 1);
        scheduleDate.setHours(9 + (pIdx * 3), 0, 0, 0);

        const template = contentTemplates[platform] || contentTemplates.facebook;

        fallbackPosts.push({
          userId: this.userId,
          platform,
          postType: template.type,
          content: template.content,
          hashtags: platform === 'instagram' ? ['RealEstate', 'HomesForSale'] : [],
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
      });
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
