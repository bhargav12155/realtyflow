import {
  type ContentType,
  type AudiencePersona,
  type ContentIntent,
  type PropertyClass,
  type MarketSignals,
  type ContentProfile,
  type PlatformScore,
  type PlatformFit,
} from "@shared/schema";

interface GeneratedContent {
  content: string;
  wordCount: number;
  keywords?: string[];
}

const contentTypePatterns: Record<ContentType, RegExp[]> = {
  listing: [
    /listing|property (for sale|available)|beds?|baths?|square feet|sq\.?\s*ft/i,
    /\$\d{3},\d{3}|\d+k price/i,
  ],
  market_update: [
    /market (update|report|analysis|trends?)/i,
    /inventory|average price|median|sales? (data|statistics)/i,
  ],
  buyer_tips: [
    /buyer|buying (a )?home|first.?time (buyer|home)/i,
    /(tips|advice|guide) (for|to) buy/i,
  ],
  seller_tips: [
    /seller|selling (your )?home|list(ing)? (your )?home/i,
    /(tips|advice|guide) (for|to) sell/i,
  ],
  neighborhood: [
    /neighborhood|community|area|district/i,
    /(dundee|aksarben|benson|old market|blackstone|elkhorn|millard)/i,
  ],
  investment: [
    /investment|ROI|rental (property|income)|investor/i,
    /cash flow|appreciation|flip/i,
  ],
  testimonial: [/review|testimonial|client (said|says)|success story/i],
  general: [],
};

const audiencePersonaPatterns: Record<AudiencePersona, RegExp[]> = {
  first_time_buyer: [
    /first.?time (buyer|home|purchase)/i,
    /new (to|buyer|homeowner)/i,
  ],
  luxury_buyer: [
    /luxury|upscale|premium|high.?end|executive/i,
    /\$\d{3},\d{3}|\$[5-9]\d{2}k|million/i,
  ],
  seller: [/sell(ing|er)|list(ing)?/i, /ready to sell|thinking of selling/i],
  investor: [/invest(or|ment)|rental|portfolio|passive income/i],
  relocating: [/relocat(e|ing)|moving to|new to (omaha|the area)/i],
  general: [],
};

const contentIntentPatterns: Record<ContentIntent, RegExp[]> = {
  educate: [/learn|guide|tips|how to|understand|explained/i],
  convert: [
    /call (me|us|now)|contact|schedule|book|free consult|let's (talk|discuss)/i,
  ],
  engage: [/what do you think|share your|comment|let me know/i, /\?$/],
  inform: [/update|report|data|statistics|announcement/i],
  inspire: [/dream|imagine|your (future|perfect)|beautiful|stunning/i],
};

const propertyClassPatterns: Record<PropertyClass, RegExp[]> = {
  luxury: [/luxury|upscale|estate|executive|million/i, /\$[5-9]\d{2}k|million/i],
  mid_market: [/\$[2-4]\d{2}k|family home|suburban/i],
  starter: [/starter|first.?time|affordable|under \$200k/i],
  investment: [/investment|rental|flip|ROI/i],
  general: [],
};

export function classifyContent(content: GeneratedContent): ContentProfile {
  const text = content.content.toLowerCase();

  const detectType = (
    patterns: Record<string, RegExp[]>,
    defaultValue: string
  ): string => {
    for (const [key, regexes] of Object.entries(patterns)) {
      if (regexes.some((regex) => regex.test(text))) {
        return key;
      }
    }
    return defaultValue;
  };

  return {
    contentType: detectType(contentTypePatterns, "general") as ContentType,
    audiencePersona: detectType(
      audiencePersonaPatterns,
      "general"
    ) as AudiencePersona,
    intent: detectType(contentIntentPatterns, "inform") as ContentIntent,
    propertyClass: detectType(
      propertyClassPatterns,
      "general"
    ) as PropertyClass,
    hasEmojis: /[\uD83C-\uDBFF\uDC00-\uDFFF]|[\u2600-\u27FF]/.test(
      content.content
    ),
    hasHashtags: content.content.includes("#"),
    hasNumbers: /\d/.test(content.content),
    hasQuestions: content.content.includes("?"),
    hasCallToAction:
      /call|contact|schedule|visit|learn more|click|sign up/i.test(text),
    wordCount: content.wordCount,
  };
}

const baseContentFitMatrix: Record<
  string,
  Record<ContentType, number>
> = {
  Instagram: {
    listing: 35,
    market_update: 15,
    buyer_tips: 30,
    seller_tips: 25,
    neighborhood: 40,
    investment: 20,
    testimonial: 35,
    general: 25,
  },
  Facebook: {
    listing: 30,
    market_update: 35,
    buyer_tips: 35,
    seller_tips: 35,
    neighborhood: 30,
    investment: 25,
    testimonial: 40,
    general: 30,
  },
  LinkedIn: {
    listing: 25,
    market_update: 45,
    buyer_tips: 35,
    seller_tips: 35,
    neighborhood: 30,
    investment: 50,
    testimonial: 35,
    general: 35,
  },
  "X (Twitter)": {
    listing: 25,
    market_update: 40,
    buyer_tips: 30,
    seller_tips: 30,
    neighborhood: 25,
    investment: 30,
    testimonial: 20,
    general: 30,
  },
  TikTok: {
    listing: 40,
    market_update: 25,
    buyer_tips: 35,
    seller_tips: 30,
    neighborhood: 45,
    investment: 20,
    testimonial: 30,
    general: 30,
  },
  YouTube: {
    listing: 30,
    market_update: 30,
    buyer_tips: 40,
    seller_tips: 40,
    neighborhood: 35,
    investment: 35,
    testimonial: 25,
    general: 30,
  },
};

export function calculateMarketSignals(
  marketData?: any[]
): MarketSignals {
  if (!marketData || !Array.isArray(marketData) || marketData.length === 0) {
    return {
      inventoryHeat: "balanced",
      priceMomentum: "stable",
      daysOnMarketTrend: "normal",
    };
  }

  const inventoryValues = marketData
    .map((m) => {
      if (!m.inventory) return 0;
      const match = m.inventory.match(/([\d.]+)/);
      return match ? parseFloat(match[1]) : 0;
    })
    .filter((v) => !isNaN(v) && v > 0);

  const avgInventory =
    inventoryValues.length > 0
      ? inventoryValues.reduce((sum, v) => sum + v, 0) / inventoryValues.length
      : 3;

  const priceChanges = marketData
    .map((m) => {
      if (!m.priceGrowth) return 0;
      const match = m.priceGrowth.match(/([+-]?[\d.]+)/);
      return match ? parseFloat(match[1]) : 0;
    })
    .filter((v) => !isNaN(v));

  const avgPriceChange =
    priceChanges.length > 0
      ? priceChanges.reduce((sum, v) => sum + v, 0) / priceChanges.length
      : 0;

  const daysOnMarketValues = marketData
    .map((m) => m.daysOnMarket || 0)
    .filter((v) => !isNaN(v) && v > 0);

  const avgDaysOnMarket =
    daysOnMarketValues.length > 0
      ? daysOnMarketValues.reduce((sum, v) => sum + v, 0) /
        daysOnMarketValues.length
      : 30;

  return {
    inventoryHeat:
      avgInventory < 3 ? "hot" : avgInventory < 6 ? "balanced" : "cold",
    priceMomentum:
      avgPriceChange > 2 ? "rising" : avgPriceChange < -2 ? "falling" : "stable",
    daysOnMarketTrend:
      avgDaysOnMarket < 20 ? "fast" : avgDaysOnMarket < 40 ? "normal" : "slow",
  };
}

function getFitLevel(score: number): PlatformFit {
  if (score >= 80) return "excellent";
  if (score >= 60) return "very-good";
  if (score >= 40) return "good";
  return "fair";
}

export function scorePlatform(
  platform: string,
  profile: ContentProfile,
  signals: MarketSignals
): PlatformScore {
  let score =
    baseContentFitMatrix[platform]?.[profile.contentType] || 25;
  const reasons: string[] = [];

  if (platform === "Instagram") {
    if (profile.hasEmojis) {
      score += 15;
      reasons.push("Visual engagement with emojis");
    }
    if (profile.hasHashtags) {
      score += 15;
      reasons.push("Hashtag discovery potential");
    }
    if (profile.wordCount <= 150) {
      score += 10;
      reasons.push("Concise format ideal for Instagram");
    }
    if (signals.inventoryHeat === "hot") {
      score += 10;
      reasons.push("Hot market = visual urgency works on Instagram");
    }
  } else if (platform === "Facebook") {
    if (profile.intent === "engage") {
      score += 15;
      reasons.push("Engagement-focused content fits Facebook community");
    }
    if (profile.wordCount >= 100 && profile.wordCount <= 300) {
      score += 10;
      reasons.push("Optimal length for Facebook posts");
    }
    if (profile.hasQuestions) {
      score += 10;
      reasons.push("Questions drive Facebook engagement");
    }
    if (profile.contentType === "neighborhood") {
      score += 10;
      reasons.push("Local content performs well in Facebook groups");
    }
  } else if (platform === "LinkedIn") {
    if (profile.audiencePersona === "luxury_buyer" || profile.audiencePersona === "investor") {
      score += 20;
      reasons.push("Professional audience aligns with LinkedIn");
    }
    if (profile.intent === "educate" || profile.intent === "inform") {
      score += 15;
      reasons.push("Educational content valued on LinkedIn");
    }
    if (profile.wordCount >= 100) {
      score += 15;
      reasons.push("Detailed content performs well on LinkedIn");
    }
    if (profile.contentType === "market_update" || profile.contentType === "neighborhood") {
      score += 10;
      reasons.push("Market insights and local expertise valued on LinkedIn");
    }
    if (profile.hasNumbers) {
      score += 10;
      reasons.push("Data-driven content builds credibility on LinkedIn");
    }
    score += 5;
    reasons.push("Professional real estate content fits LinkedIn");
  } else if (platform === "X (Twitter)") {
    if (profile.wordCount <= 200) {
      score += 15;
      reasons.push("Concise format perfect for Twitter");
    }
    if (profile.hasHashtags) {
      score += 15;
      reasons.push("Hashtags essential for Twitter discovery");
    }
    if (profile.contentType === "market_update") {
      score += 10;
      reasons.push("Real-time market updates fit Twitter's fast pace");
    }
  } else if (platform === "TikTok") {
    if (profile.wordCount <= 150) {
      score += 15;
      reasons.push("Short-form content ideal for TikTok captions");
    }
    if (profile.hasEmojis) {
      score += 15;
      reasons.push("Emojis increase TikTok engagement");
    }
    if (
      profile.contentType === "listing" ||
      profile.contentType === "neighborhood"
    ) {
      score += 15;
      reasons.push("Visual property content performs well on TikTok");
    }
    if (profile.audiencePersona === "first_time_buyer") {
      score += 10;
      reasons.push("TikTok's younger audience matches first-time buyers");
    }
  } else if (platform === "YouTube") {
    if (profile.wordCount >= 300) {
      score += 15;
      reasons.push("Detailed description benefits YouTube SEO");
    }
    if (profile.intent === "educate") {
      score += 15;
      reasons.push("Educational content thrives on YouTube");
    }
    if (profile.hasNumbers) {
      score += 10;
      reasons.push("Data-driven content performs well on YouTube");
    }
  }

  score = Math.min(100, Math.max(0, score));

  let optimization = "";
  if (platform === "Instagram") {
    optimization = profile.hasHashtags
      ? "Add property photos or infographic"
      : "Add hashtags like #OmahaHomes #RealEstate";
  } else if (platform === "Facebook") {
    optimization = profile.hasQuestions
      ? "Share to local Omaha groups"
      : "Add engagement question at the end";
  } else if (platform === "LinkedIn") {
    optimization =
      "Frame as professional insight: 'As your Omaha real estate expert...'";
  } else if (platform === "X (Twitter)") {
    optimization = "Add trending local hashtags like #OmahaLife";
  } else if (platform === "TikTok") {
    optimization = "Create quick home tour or tip video with trending audio";
  } else if (platform === "YouTube") {
    optimization = "Create detailed walkthrough or market analysis video";
  }

  return {
    platform,
    score,
    fit: getFitLevel(score),
    reasons: reasons.length > 0 ? reasons : ["Good platform for this content"],
    optimization,
    confidence: Math.round(score / 10) / 10,
  };
}
