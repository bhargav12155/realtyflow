export interface PlatformConfig {
  name: string;
  maxCharacters: number;
  optimalCharacters: { min: number; max: number };
  truncatesAt: number;
  hashtagRecommendation: string;
  notes: string;
  prompt: string;
  engagementTip: string;
}

export const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  facebook: {
    name: "Facebook",
    maxCharacters: 63206,
    optimalCharacters: { min: 40, max: 80 },
    truncatesAt: 140,
    hashtagRecommendation: "2-3 hashtags, but posts often perform better without any",
    notes: "Posts under 50 characters get 66% more engagement",
    engagementTip: "Lead with a compelling hook - users spend only 2.5 seconds on posts",
    prompt: `You are a Facebook marketing expert for real estate. Create an engaging Facebook post that:
- Is between 40-80 characters for optimal engagement (posts under 50 chars get 66% more engagement)
- Leads with an attention-grabbing hook in the first line (users spend only 2.5 seconds scanning)
- Avoids hashtag overuse (Facebook posts often perform better without hashtags)
- Uses emojis sparingly to add visual interest
- Includes a clear call-to-action
- Feels conversational and authentic
- Remember: text truncates after ~140 characters, so put the most important info first`
  },

  instagram: {
    name: "Instagram",
    maxCharacters: 2200,
    optimalCharacters: { min: 1, max: 50 },
    truncatesAt: 125,
    hashtagRecommendation: "1-2 hashtags (21% better engagement than 3+)",
    notes: "Truncates at 125 characters; shorter captions drive more interactions",
    engagementTip: "The first 125 characters are critical - that's all users see before 'more'",
    prompt: `You are an Instagram content specialist for real estate. Create a captivating Instagram caption that:
- Keeps the most engaging content in the first 1-50 characters (optimal for engagement)
- Remembers captions truncate at 125 characters - put the hook FIRST
- Uses 1-2 relevant hashtags only (21% better engagement than 3+)
- Creates visual storytelling that complements imagery
- Uses line breaks strategically for readability
- Includes a compelling call-to-action
- Feels authentic and on-brand
- Uses emojis thoughtfully to enhance the message without overwhelming`
  },

  x: {
    name: "X (Twitter)",
    maxCharacters: 280,
    optimalCharacters: { min: 70, max: 100 },
    truncatesAt: 280,
    hashtagRecommendation: "1-2 hashtags maximum",
    notes: "Sweet spot of 70-100 characters gets 36% more engagement",
    engagementTip: "Tweets with 240-259 characters get the most likes and replies",
    prompt: `You are an X (Twitter) expert for real estate marketing. Create a punchy, engaging tweet that:
- Aims for 70-100 characters for optimal engagement (36% more interaction)
- Maximum 280 characters (hard limit)
- Leads with the most compelling point immediately
- Uses 1-2 relevant hashtags maximum
- Creates urgency or curiosity
- Is easily shareable and quotable
- Feels authentic, not salesy
- Includes a clear hook that stops the scroll`
  },

  linkedin: {
    name: "LinkedIn",
    maxCharacters: 3000,
    optimalCharacters: { min: 80, max: 120 },
    truncatesAt: 140,
    hashtagRecommendation: "3-5 industry-relevant hashtags",
    notes: "Truncates after 140 characters with 'See More'; articles perform best at 1,900-2,000 words",
    engagementTip: "~100 characters (25 words or less) for posts; article titles 40-49 chars get highest views",
    prompt: `You are a LinkedIn marketing strategist for real estate professionals. Create a professional LinkedIn post that:
- Keeps the hook in the first ~100 characters (truncates at 140 with 'See More')
- Uses a professional yet approachable tone
- Provides genuine value or insight
- Positions the agent as a thought leader
- Uses 3-5 industry-relevant hashtags
- Encourages professional engagement and discussion
- Tells a story or shares an insight that resonates with the professional audience
- Remember: first 140 characters are critical - make them count!`
  },

  tiktok: {
    name: "TikTok",
    maxCharacters: 4000,
    optimalCharacters: { min: 100, max: 150 },
    truncatesAt: 150,
    hashtagRecommendation: "3-5 trending hashtags relevant to real estate",
    notes: "Strong hook in opening is critical; first 100-150 characters appear before 'see more'",
    engagementTip: "The first 2 seconds of your caption need to hook viewers immediately",
    prompt: `You are a TikTok content creator specializing in real estate. Create an engaging TikTok caption that:
- Hooks viewers in the first 100-150 characters (that's what shows before 'see more')
- Uses trending language and phrases that resonate with TikTok's audience
- Includes 3-5 relevant trending hashtags
- Feels authentic and casual, not corporate
- Creates curiosity or urgency to watch
- Speaks directly to the viewer ('you', 'your')
- Uses emojis strategically to catch attention
- Maximum 4000 characters but front-load the hook!`
  },

  threads: {
    name: "Threads",
    maxCharacters: 500,
    optimalCharacters: { min: 200, max: 300 },
    truncatesAt: 500,
    hashtagRecommendation: "Minimal hashtags; Threads favors natural conversation",
    notes: "Meta's text platform; visual content still drives engagement",
    engagementTip: "Conversational, authentic content performs best - this is a text-first platform",
    prompt: `You are a Threads content creator for real estate. Create an engaging Threads post that:
- Aims for 200-300 characters for optimal engagement
- Maximum 500 characters
- Feels conversational and authentic
- Encourages discussion and replies
- Uses minimal or no hashtags (Threads favors natural conversation)
- Provides value, insight, or sparks curiosity
- Feels personal and genuine, not promotional`
  },

  pinterest: {
    name: "Pinterest",
    maxCharacters: 500,
    optimalCharacters: { min: 40, max: 50 },
    truncatesAt: 50,
    hashtagRecommendation: "2-5 relevant hashtags in description",
    notes: "Only first 50 characters visible initially; focus on keywords for searchability",
    engagementTip: "Pinterest is a search engine - use keywords naturally in your first 50 characters",
    prompt: `You are a Pinterest strategist for real estate. Create an optimized Pinterest pin description that:
- Front-loads the most important keywords in the first 50 characters (that's what shows initially)
- Maximum 500 characters for the full description
- Is keyword-rich for Pinterest's search algorithm
- Includes 2-5 relevant hashtags
- Describes the content in a way that inspires saves and clicks
- Uses aspirational language that resonates with Pinterest's planning-focused audience
- Focuses on lifestyle and inspiration, not just features`
  },

  youtube: {
    name: "YouTube",
    maxCharacters: 5000,
    optimalCharacters: { min: 200, max: 300 },
    truncatesAt: 100,
    hashtagRecommendation: "3-5 hashtags; tags have 500 character combined limit",
    notes: "Title should be descriptive and keyword-rich; first 100 characters of description show in search",
    engagementTip: "YouTube is the second largest search engine - optimize for discoverability",
    prompt: `You are a YouTube content strategist for real estate. Create an optimized YouTube video description that:
- Puts the most important information in the first 100 characters (visible in search results)
- Is keyword-rich for YouTube's search algorithm
- Includes relevant timestamps if applicable
- Uses 3-5 relevant hashtags
- Includes a clear call-to-action (subscribe, like, comment)
- Provides value and context for the video content
- Optimal length: 200-300 characters for the above-the-fold section
- Can expand to 5000 characters with additional details below`
  }
};

export const PLATFORM_QUICK_TIPS = {
  general: "Average attention span is just 1.7 seconds on mobile - lead with a strong hook!",
  facebook: "Posts under 50 characters get 66% more engagement",
  instagram: "1-2 hashtags = 21% better engagement than 3+",
  x: "70-100 character tweets get 36% more engagement",
  linkedin: "Article titles of 40-49 characters get highest views",
  tiktok: "Hook viewers in the first 2 seconds with your caption",
  threads: "Natural conversation beats promotional content",
  pinterest: "Think like a search engine - keywords matter!",
  youtube: "First 100 characters show in search - make them count"
};

export function getPlatformPrompt(platform: string, contentType?: string, additionalContext?: string): string {
  const config = PLATFORM_CONFIGS[platform.toLowerCase()];
  if (!config) {
    return "Create engaging social media content optimized for the target platform.";
  }

  let prompt = config.prompt;

  if (contentType) {
    prompt += `\n\nContent Type: ${contentType}`;
  }

  if (additionalContext) {
    prompt += `\n\nAdditional Context: ${additionalContext}`;
  }

  prompt += `\n\n📊 Platform Specs:
- Maximum characters: ${config.maxCharacters}
- Optimal for engagement: ${config.optimalCharacters.min}-${config.optimalCharacters.max} characters
- Content truncates at: ${config.truncatesAt} characters
- Hashtag recommendation: ${config.hashtagRecommendation}

💡 Pro Tip: ${config.engagementTip}`;

  return prompt;
}

export function getCharacterCountStatus(platform: string, text: string): {
  current: number;
  max: number;
  optimal: { min: number; max: number };
  status: 'optimal' | 'acceptable' | 'warning' | 'over';
  message: string;
} {
  const config = PLATFORM_CONFIGS[platform.toLowerCase()];
  if (!config) {
    return {
      current: text.length,
      max: 1000,
      optimal: { min: 50, max: 200 },
      status: 'acceptable',
      message: 'Unknown platform'
    };
  }

  const current = text.length;
  const { optimalCharacters, maxCharacters, truncatesAt } = config;

  let status: 'optimal' | 'acceptable' | 'warning' | 'over';
  let message: string;

  if (current > maxCharacters) {
    status = 'over';
    message = `Over limit by ${current - maxCharacters} characters`;
  } else if (current > truncatesAt && truncatesAt < maxCharacters) {
    status = 'warning';
    message = `Content will be truncated after ${truncatesAt} characters`;
  } else if (current >= optimalCharacters.min && current <= optimalCharacters.max) {
    status = 'optimal';
    message = `Optimal length for ${config.name} engagement!`;
  } else if (current < optimalCharacters.min) {
    status = 'acceptable';
    message = `Add ${optimalCharacters.min - current} more characters for optimal engagement`;
  } else {
    status = 'acceptable';
    message = `Good length, but ${optimalCharacters.min}-${optimalCharacters.max} characters performs best`;
  }

  return {
    current,
    max: maxCharacters,
    optimal: optimalCharacters,
    status,
    message
  };
}

export function getAllPlatforms(): string[] {
  return Object.keys(PLATFORM_CONFIGS);
}

export function getPlatformConfig(platform: string): PlatformConfig | null {
  return PLATFORM_CONFIGS[platform.toLowerCase()] || null;
}
