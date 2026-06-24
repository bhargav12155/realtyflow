import type { InsertScheduledPost, MarketData } from "@shared/schema";
import { PLATFORM_CONFIGS } from "@shared/platform-prompts";
import { INDUSTRY_CALENDAR_BLUEPRINTS, PLATFORM_OPTIMIZATION_CHEATSHEET, type IndustryCalendarBlueprint } from "@shared/industryCalendarBlueprints";
import { INDUSTRY_CONTENT } from "@shared/industryContent";

export interface GeneratedContentPlan {
  posts: InsertScheduledPost[];
  metadata: {
    generatedAt: string;
    model: string;
    planDuration: string;
    userContext: string;
  };
}

const PLATFORM_POSTING_DAYS: Record<string, number[]> = {
  facebook:  [0, 1, 2, 3, 4, 5, 6],
  instagram: [1, 3, 5, 6],
  linkedin:  [1, 3, 5],
  x:         [1, 2, 3, 4, 5],
  tiktok:    [1, 2, 4, 6],
};

const DAY_NAME_TO_NUMBER: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

const PLATFORM_SCHEDULE_DESCRIPTION: Record<string, string> = {
  facebook:  "every day (daily posting works well for Facebook's algorithm)",
  instagram: "Monday, Wednesday, Friday, Saturday only (4x/week — daily posting drops engagement 20%)",
  linkedin:  "Monday, Wednesday, Friday only (3x/week — professional audience fatigues quickly with daily posts)",
  x:         "Monday through Friday only (5x/week — weekday focus for maximum reach)",
  tiktok:    "Monday, Tuesday, Thursday, Saturday only (4x/week — algorithm rewards consistent schedule over volume)",
};

function getPlatformsForDay(dayOffset: number, startDate: Date): string[] {
  const date = new Date(startDate);
  date.setDate(startDate.getDate() + dayOffset + 1);
  const dayOfWeek = date.getDay();
  return Object.entries(PLATFORM_POSTING_DAYS)
    .filter(([, days]) => days.includes(dayOfWeek))
    .map(([platform]) => platform);
}

function calculateExpectedPosts(weeks: number, startDate: Date): number {
  const days = weeks * 7;
  let total = 0;
  for (let day = 0; day < days; day++) {
    total += getPlatformsForDay(day, startDate).length;
  }
  return total;
}

function getBlueprintPostsForDay(dayOffset: number, startDate: Date, blueprint: IndustryCalendarBlueprint): { contentType: string; platforms: string[] } | null {
  const date = new Date(startDate);
  date.setDate(startDate.getDate() + dayOffset + 1);
  const dayOfWeek = date.getDay();
  const weekIndex = Math.floor(dayOffset / 7) % 2;
  const weekPosts = weekIndex === 0 ? blueprint.week1 : blueprint.week2;
  const match = weekPosts.find(p => DAY_NAME_TO_NUMBER[p.day] === dayOfWeek);
  return match ? { contentType: match.contentType, platforms: match.platforms } : null;
}

function calculateBlueprintExpectedPosts(weeks: number, startDate: Date, blueprint: IndustryCalendarBlueprint): number {
  const days = weeks * 7;
  let total = 0;
  for (let day = 0; day < days; day++) {
    const match = getBlueprintPostsForDay(day, startDate, blueprint);
    if (match) {
      total += match.platforms.length;
    }
  }
  return total;
}

function buildBlueprintDaySchedule(weeks: number, startDate: Date, blueprint: IndustryCalendarBlueprint): string[] {
  const days = weeks * 7;
  const lines: string[] = [];
  for (let day = 0; day < days; day++) {
    const match = getBlueprintPostsForDay(day, startDate, blueprint);
    if (match) {
      lines.push(`Day ${day + 1}: ${match.platforms.join(', ')} — ${match.contentType.replace(/_/g, ' ')}`);
    }
  }
  return lines;
}

function buildIndustryPrompt(
  businessType: string,
  serviceAreas: string[],
  targetAudience: string,
  specialties: string,
  weeks: number,
  days: number,
  expectedPosts: number,
  dayScheduleLines: string[]
): string {
  const blueprint = INDUSTRY_CALENDAR_BLUEPRINTS[businessType];
  if (!blueprint) return "";

  const areasText = serviceAreas.length > 0 ? serviceAreas.join(', ') : 'the local area';

  const week1Schedule = blueprint.week1.map(p =>
    `  - **${p.day}:** ${p.contentType.replace(/_/g, ' ')} — ${p.description} *(${p.platforms.join('/')})*`
  ).join('\n');

  const week2Schedule = blueprint.week2.map(p =>
    `  - **${p.day}:** ${p.contentType.replace(/_/g, ' ')} — ${p.description} *(${p.platforms.join('/')})*`
  ).join('\n');

  const platformOptLines = blueprint.focusPlatforms.map(p => {
    const opt = PLATFORM_OPTIMIZATION_CHEATSHEET[p];
    const config = PLATFORM_CONFIGS[p];
    if (!opt) return "";
    return `${p.toUpperCase()}:
- Frequency: ${opt.optimalFrequency}
- Ideal character count: ${opt.idealCharacterCount}
- Strategy: ${opt.strategyFocus}${config ? `\n- Optimal chars: ${config.optimalCharacters.min}-${config.optimalCharacters.max}` : ''}`;
  }).filter(Boolean).join('\n\n');

  const businessLabel = businessType.replace(/_/g, ' ');

  const industryContent = INDUSTRY_CONTENT[businessType] || INDUSTRY_CONTENT.general;
  const topHashtags = industryContent.hashtags.slice(0, 8).join(', ');
  const topTopics = industryContent.suggestedTopics.join('; ');

  const startersByType: Record<string, string[]> = {};
  for (const starter of industryContent.contentStarters) {
    if (!startersByType[starter.postTypeId]) {
      startersByType[starter.postTypeId] = [];
    }
    if (startersByType[starter.postTypeId].length < 2) {
      startersByType[starter.postTypeId].push(`"${starter.label}": ${starter.template.substring(0, 80)}...`);
    }
  }
  const contentStarterLines = Object.entries(startersByType)
    .map(([type, examples]) => `  ${type}: ${examples.join(' | ')}`)
    .join('\n');

  return `You are a social media content strategist for a ${businessLabel} business. Create a ${weeks}-week (${days}-day) content calendar.

**Business Profile:**
- Business Type: ${businessLabel}
- Service Areas: ${areasText}
- Target Audience: ${targetAudience}${specialties}

**Industry Tone & Style:**
${blueprint.tone}

**Content Mix:**
${blueprint.contentMix}

**14-Day Rotating Content Blueprint (follow this pattern, repeating for ${weeks} weeks):**
* Week 1:
${week1Schedule}
* Week 2:
${week2Schedule}

**Focus Platforms:** ${blueprint.focusPlatforms.join(', ')}

**Platform Optimization:**
${platformOptLines}

**SEO & AEO (Answer Engine Optimization) Requirements:**
Every post MUST follow these SEO/AEO rules:
1. **Question-Format Hooks:** Start at least 40% of posts with a question (e.g., "Looking for the best [service] in [area]?", "Did you know...?", "What makes [area] the best place for...?"). Questions rank higher in AI answer engines and voice search.
2. **Keyword-Rich Captions:** Naturally weave in industry keywords: ${topHashtags}. Each post should contain at least one searchable phrase a potential customer would type into Google.
3. **Local SEO Signals:** Mention specific service areas (${areasText}) by name. Include "near me" style phrasing where natural (e.g., "best [service] in [area]").
4. **Trending Topics:** Draw from these suggested topics for content variety: ${topTopics}
5. **Call-to-Action (CTA):** Every post must end with a clear CTA (e.g., "Book today", "DM us", "Visit us at...", "Call now", "Link in bio").
6. **Snippet-Friendly Format:** Write posts so the first sentence could serve as a featured snippet answer — concise, factual, and directly answering a common customer question.

**Content Starter Templates (use these as inspiration for tone and structure):**
${contentStarterLines}

**Per-Day Platform Schedule (research-backed frequency):**
${dayScheduleLines.slice(0, 14).join('\n')}
(This pattern repeats for the full ${weeks} weeks)

Total posts to generate: ${expectedPosts}

**Post Type IDs to use:** ${blueprint.postTypes.map(t => `"${t}"`).join(', ')}

Vary posting times: mornings (9-10am), afternoons (2-3pm), evenings (6-7pm).
Include 1-2 relevant hashtags for Instagram posts only (empty array for others).
Reference actual service areas and local context.

Return ONLY a valid JSON array with exactly ${expectedPosts} posts:
[
  {
    "platform": "${blueprint.focusPlatforms.join('|')}",
    "postType": "${blueprint.postTypes.join('|')}",
    "content": "engaging post text optimized for platform character limits, SEO keywords, and tone — start with a question or keyword-rich hook",
    "hashtags": ["tag1"] (only for instagram, 1-2 max, empty array for others),
    "neighborhood": "area name or null",
    "dayOffset": day_number (0-${days-1}, where 0 = tomorrow)
  }
]`;
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

  async generateContentPlan(
    serviceAreas: string[],
    marketData: MarketData[],
    targetAudience?: string,
    specialties?: string[],
    weeks: number = 4,
    businessType: string = 'real_estate'
  ): Promise<GeneratedContentPlan> {
    if (!this.openai) {
      await this.initialize();
    }

    const days = weeks * 7;
    const today = new Date();

    const blueprint = INDUSTRY_CALENDAR_BLUEPRINTS[businessType];
    const isIndustryType = businessType !== 'real_estate' && !!blueprint;

    let expectedPosts: number;
    let dayScheduleLines: string[];

    if (isIndustryType) {
      expectedPosts = calculateBlueprintExpectedPosts(weeks, today, blueprint);
      dayScheduleLines = buildBlueprintDaySchedule(weeks, today, blueprint);
    } else {
      expectedPosts = calculateExpectedPosts(weeks, today);
      dayScheduleLines = [];
      for (let day = 0; day < days; day++) {
        const platforms = getPlatformsForDay(day, today);
        if (platforms.length > 0) {
          dayScheduleLines.push(`Day ${day + 1}: ${platforms.join(', ')}`);
        }
      }
    }

    let prompt: string;

    if (isIndustryType) {
      const audienceText = targetAudience || 'local customers';
      const specialtiesText = specialties && specialties.length > 0
        ? ` Specialties: ${specialties.join(', ')}.`
        : '';

      prompt = buildIndustryPrompt(
        businessType,
        serviceAreas,
        audienceText,
        specialtiesText,
        weeks,
        days,
        expectedPosts,
        dayScheduleLines
      );
    } else {
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

      prompt = `You are a social media content strategist for real estate agents. Create a ${weeks}-week (${days}-day) content calendar for a real estate agent.

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

**SEO & AEO (Answer Engine Optimization) Requirements:**
Every post MUST follow these SEO/AEO rules:
1. **Question-Format Hooks:** Start at least 40% of posts with a question (e.g., "What's happening in the [neighborhood] market?", "Looking for a home in [area]?", "Is now a good time to sell in [neighborhood]?"). Questions rank higher in AI answer engines and voice search.
2. **Keyword-Rich Captions:** Naturally include searchable real estate phrases: #JustListed, #OpenHouse, #DreamHome, #RealEstate, #HomesForSale, #FirstTimeHomeBuyer, #LuxuryHomes, #PropertyTour. Each post should contain at least one phrase a buyer or seller would search.
3. **Local SEO Signals:** Mention specific neighborhoods (${areasText}) by name. Include "near me" style phrasing (e.g., "homes for sale in [neighborhood]", "best realtor near [area]").
4. **Call-to-Action (CTA):** Every post must end with a clear CTA (e.g., "Schedule a showing", "DM me for details", "Call today", "Link in bio").
5. **Snippet-Friendly Format:** Write so the first sentence could be a featured snippet answer — concise and directly answering a common real estate question.

**Content Starter Templates (use as inspiration for tone and structure):**
  open_houses: "You're invited! Join us this [day] for an open house..." | "This weekend only! Tour this gorgeous home..."
  just_listed: "Exciting new listing! This [beds]bd/[baths]ba home features..." | "Just hit the market! [address] — won't last long..."
  just_sold: "SOLD! Congratulations to the new owners..." | "Another successful closing! Ready to make your move?"
  buyer_tips: "Get pre-approved before house hunting..." | "First-time buyer? Here are key things to consider..."
  seller_tips: "Proper staging can increase your home's value 5-10%..." | "Thinking of selling? Let's chat about pricing strategy..."

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
    }

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
        return this.getFallbackContentPlan(serviceAreas, marketData, weeks, businessType);
      }

      const allPlatforms = ['facebook', 'instagram', 'linkedin', 'x', 'tiktok'];
      const validPlatforms = (isIndustryType && blueprint) ? blueprint.focusPlatforms : allPlatforms;
      const realEstateTypes = ['local_market', 'neighborhood_spotlight', 'buyer_tips', 'seller_tips', 'community'];
      const validTypes = (isIndustryType && blueprint) ? blueprint.postTypes : realEstateTypes;

      const validatedPosts: InsertScheduledPost[] = posts.map((p, index) => {
        if (!p.platform || !p.postType || !p.content) {
          throw new Error(`Invalid post at index ${index}: missing required fields`);
        }

        if (!allPlatforms.includes(p.platform)) {
          p.platform = validPlatforms[0] || 'facebook';
        } else if (isIndustryType && !validPlatforms.includes(p.platform)) {
          p.platform = validPlatforms[0] || 'facebook';
        }
        if (!validTypes.includes(p.postType)) {
          p.postType = validTypes[0];
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
            businessType,
          },
        };
      });

      console.log(`✅ AI generated ${weeks}-week calendar with ${validatedPosts.length} posts (${businessType}) for user ${this.userId}`);

      return {
        posts: validatedPosts,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: 'gemini-2.5-flash',
          planDuration: `${weeks} weeks (${days} days)`,
          userContext: `Business: ${businessType}, Service areas: ${serviceAreas.join(', ')}`,
        },
      };
    } catch (error) {
      console.error('❌ AI content calendar generation failed:', error);
      console.log('🔄 Using fallback content plan...');
      return this.getFallbackContentPlan(serviceAreas, marketData, weeks, businessType);
    }
  }

  async generate30DayPlan(
    serviceAreas: string[],
    marketData: MarketData[],
    targetAudience?: string,
    specialties?: string[]
  ): Promise<GeneratedContentPlan> {
    return this.generateContentPlan(serviceAreas, marketData, targetAudience, specialties, 4);
  }

  getFallbackContentPlan(serviceAreas: string[], marketData: MarketData[], weeks: number = 4, businessType: string = 'real_estate'): GeneratedContentPlan {
    const areas = serviceAreas.length > 0 ? serviceAreas : ['your area'];
    const today = new Date();
    const days = weeks * 7;

    const blueprint = INDUSTRY_CALENDAR_BLUEPRINTS[businessType];
    const isIndustryType = businessType !== 'real_estate' && blueprint;

    if (isIndustryType) {
      return this.getIndustryFallbackPlan(areas, blueprint, weeks, today);
    }

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

  private getIndustryFallbackPlan(
    areas: string[],
    blueprint: typeof INDUSTRY_CALENDAR_BLUEPRINTS[string],
    weeks: number,
    today: Date
  ): GeneratedContentPlan {
    const days = weeks * 7;

    const fallbackPosts: InsertScheduledPost[] = [];

    for (let day = 0; day < days; day++) {
      const date = new Date(today);
      date.setDate(today.getDate() + day + 1);
      const dayOfWeek = date.getDay();
      const weekIndex = Math.floor(day / 7) % 2;

      const weekPosts = weekIndex === 0 ? blueprint.week1 : blueprint.week2;
      const matchingPost = weekPosts.find(p => DAY_NAME_TO_NUMBER[p.day] === dayOfWeek);

      if (matchingPost) {
        matchingPost.platforms.forEach((platform, pIdx) => {
          const scheduleDate = new Date(date);
          scheduleDate.setHours(9 + (pIdx * 3), 0, 0, 0);

          fallbackPosts.push({
            userId: this.userId,
            platform,
            postType: matchingPost.contentType,
            content: `${matchingPost.description} — serving ${areas[day % areas.length]} and surrounding areas.`,
            hashtags: platform === 'instagram' ? ['SmallBusiness', 'LocalBusiness'] : [],
            scheduledFor: scheduleDate,
            status: 'pending',
            isEdited: false,
            isAiGenerated: false,
            originalContent: matchingPost.description,
            neighborhood: areas[day % areas.length],
            seoScore: 70,
            metadata: {
              aiGenerated: false,
              fallback: true,
              blueprintContentType: matchingPost.contentType,
            },
          });
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
