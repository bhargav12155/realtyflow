export interface BlueprintPost {
  day: string;
  contentType: string;
  description: string;
  platforms: string[];
}

export interface IndustryCalendarBlueprint {
  focusPlatforms: string[];
  tone: string;
  contentMix: string;
  week1: BlueprintPost[];
  week2: BlueprintPost[];
  postTypes: string[];
}

export interface PlatformOptimization {
  optimalFrequency: string;
  idealCharacterCount: string;
  strategyFocus: string;
}

export const PLATFORM_OPTIMIZATION_CHEATSHEET: Record<string, PlatformOptimization> = {
  instagram: {
    optimalFrequency: "3-5 In-feed/Reels weekly, 2+ Stories daily",
    idealCharacterCount: "138-150 chars (keeps text above the 'more' button)",
    strategyFocus: "Visual storytelling, high-quality video, behind-the-scenes",
  },
  facebook: {
    optimalFrequency: "1-2 times per day",
    idealCharacterCount: "40-80 chars (short text gets the highest engagement)",
    strategyFocus: "Community building, event updates, direct links, local reach",
  },
  linkedin: {
    optimalFrequency: "1 time per day (Mon-Fri)",
    idealCharacterCount: "50-100 chars for links; up to 1,500 for storytelling",
    strategyFocus: "Professional networking, thought leadership, company culture",
  },
  x: {
    optimalFrequency: "2-5 times per day",
    idealCharacterCount: "71-100 chars (leaves room for easy quote-reposting)",
    strategyFocus: "Real-time updates, customer service, industry news",
  },
  tiktok: {
    optimalFrequency: "1-3 times per day",
    idealCharacterCount: "~100 chars (keep captions brief; let the video speak)",
    strategyFocus: "Short-form video, trends, educational hooks, entertainment",
  },
};

export const INDUSTRY_CALENDAR_BLUEPRINTS: Record<string, IndustryCalendarBlueprint> = {
  restaurant: {
    focusPlatforms: ["instagram", "tiktok", "facebook"],
    tone: "Fun, mouth-watering, short and punchy. Visuals and cravings drive engagement.",
    contentMix: "30% menu highlights & food visuals, 25% behind-the-scenes kitchen content, 20% promotions & weekend specials, 15% community & team spotlights, 10% user-generated content & customer features",
    postTypes: ["menu_highlight", "behind_the_scenes", "weekend_promo", "supplier_feature", "team_spotlight", "user_generated_content"],
    week1: [
      { day: "Monday", contentType: "menu_highlight", description: "Close-up video of a popular dish", platforms: ["instagram", "tiktok"] },
      { day: "Wednesday", contentType: "behind_the_scenes", description: "Quick clip of the chef preparing a meal or kitchen banter", platforms: ["instagram", "tiktok"] },
      { day: "Friday", contentType: "weekend_promo", description: "High-energy photo of a cocktail or special to drive weekend foot traffic", platforms: ["facebook", "instagram"] },
    ],
    week2: [
      { day: "Tuesday", contentType: "supplier_feature", description: "Tag the local bakery or farm you get ingredients from", platforms: ["instagram", "facebook"] },
      { day: "Thursday", contentType: "team_spotlight", description: "A photo of a bartender or server with a quick, fun fact about them", platforms: ["instagram", "facebook"] },
      { day: "Saturday", contentType: "user_generated_content", description: "Repost a great photo a customer took (with permission)", platforms: ["instagram"] },
    ],
  },

  home_services: {
    focusPlatforms: ["facebook", "instagram", "tiktok"],
    tone: "Trustworthy, expert, helpful. Show the transformation and the people doing the work.",
    contentMix: "30% before & after transformations, 25% tips & maintenance advice, 20% customer reviews & testimonials, 15% team & crew spotlights, 10% seasonal checklists & myth-busting",
    postTypes: ["before_after", "maintenance_tip", "customer_review", "meet_the_crew", "myth_busted", "seasonal_checklist"],
    week1: [
      { day: "Monday", contentType: "before_after", description: "Carousel post showing a messy yard/broken pipe vs. the clean, finished result", platforms: ["facebook", "instagram"] },
      { day: "Wednesday", contentType: "maintenance_tip", description: "Short video explaining how to change a filter or prep a lawn", platforms: ["instagram", "tiktok"] },
      { day: "Friday", contentType: "customer_review", description: "A graphic featuring a 5-star review from a happy client", platforms: ["facebook", "instagram"] },
    ],
    week2: [
      { day: "Tuesday", contentType: "meet_the_crew", description: "A photo of the team standing by the work trucks. Builds safety and trust", platforms: ["facebook", "instagram"] },
      { day: "Thursday", contentType: "myth_busted", description: "Common myth busted, e.g. 'Do you really need to leave your AC running all day?'", platforms: ["facebook", "instagram"] },
      { day: "Saturday", contentType: "seasonal_checklist", description: "A simple graphic listing 3 things homeowners should do this month", platforms: ["facebook"] },
    ],
  },

  retail: {
    focusPlatforms: ["instagram", "tiktok", "facebook"],
    tone: "Aesthetic, urgent, exciting. Show the product in action. Aesthetics and urgency drive retail.",
    contentMix: "30% new arrivals & product drops, 25% tutorials & styling content, 20% flash sales & weekend deals, 15% customer spotlights & reviews, 10% behind-the-scenes & staff picks",
    postTypes: ["new_arrival", "styling_tutorial", "flash_sale", "customer_spotlight", "packaging_bts", "staff_picks"],
    week1: [
      { day: "Monday", contentType: "new_arrival", description: "High-quality carousel or video of new inventory", platforms: ["instagram", "tiktok"] },
      { day: "Wednesday", contentType: "styling_tutorial", description: "How to wear a piece or style an item in a living room", platforms: ["instagram", "tiktok"] },
      { day: "Friday", contentType: "flash_sale", description: "A short, urgent post driving traffic to the site or store", platforms: ["facebook", "instagram"] },
    ],
    week2: [
      { day: "Tuesday", contentType: "customer_spotlight", description: "Share a photo of a customer wearing or using your product", platforms: ["instagram", "facebook"] },
      { day: "Thursday", contentType: "packaging_bts", description: "A satisfying, fast-paced video of packing an order", platforms: ["tiktok", "instagram"] },
      { day: "Saturday", contentType: "staff_picks", description: "A graphic or short video showing what the employees are buying right now", platforms: ["instagram", "facebook"] },
    ],
  },

  professional_services: {
    focusPlatforms: ["linkedin", "facebook", "instagram"],
    tone: "Authoritative, educational, personable. Educate your audience and humanize your brand.",
    contentMix: "30% market updates & industry news, 25% case studies & client wins, 20% office culture & team content, 15% FAQs & educational content, 10% personal storytelling & data visuals",
    postTypes: ["market_update", "case_study", "office_culture", "faq_answered", "data_infographic", "personal_why"],
    week1: [
      { day: "Monday", contentType: "market_update", description: "A breakdown of a current trend and what it means for the client", platforms: ["linkedin", "facebook"] },
      { day: "Wednesday", contentType: "case_study", description: "Highlighting a recent client win and the strategy used to get it", platforms: ["linkedin", "instagram"] },
      { day: "Friday", contentType: "office_culture", description: "A casual photo of the team at lunch or celebrating a milestone", platforms: ["instagram", "facebook"] },
    ],
    week2: [
      { day: "Tuesday", contentType: "faq_answered", description: "A short video answering the most common question from new clients", platforms: ["instagram", "linkedin"] },
      { day: "Thursday", contentType: "data_infographic", description: "A clean chart showing relevant stats", platforms: ["linkedin", "facebook"] },
      { day: "Friday", contentType: "personal_why", description: "A text-heavy storytelling post about why you started in this industry", platforms: ["linkedin"] },
    ],
  },

  general: {
    focusPlatforms: ["linkedin", "x", "facebook"],
    tone: "Value-driven, thought leadership focused. Focus on solving problems for your audience.",
    contentMix: "30% product/service deep dives, 25% articles & educational content, 20% company news & updates, 15% how-to tutorials & guides, 10% testimonials & motivation",
    postTypes: ["product_deep_dive", "article_share", "company_news", "how_to_tutorial", "client_testimonial", "leadership_tip"],
    week1: [
      { day: "Monday", contentType: "product_deep_dive", description: "Highlighting one specific feature that solves a major pain point", platforms: ["linkedin", "x"] },
      { day: "Wednesday", contentType: "article_share", description: "Link to a helpful piece of content with a 2-sentence summary", platforms: ["linkedin", "x"] },
      { day: "Friday", contentType: "company_news", description: "Announcing a new hire, a software update, or an upcoming event", platforms: ["linkedin", "facebook"] },
    ],
    week2: [
      { day: "Tuesday", contentType: "how_to_tutorial", description: "A quick screen-recording or graphic showing how to achieve a specific result", platforms: ["linkedin", "x"] },
      { day: "Thursday", contentType: "client_testimonial", description: "A quote graphic from a business owner who saved time or money using your service", platforms: ["linkedin", "facebook"] },
      { day: "Friday", contentType: "leadership_tip", description: "A short, punchy insight on management or business growth", platforms: ["linkedin", "x"] },
    ],
  },
};

export function getIndustryBlueprint(businessType: string): IndustryCalendarBlueprint | null {
  return INDUSTRY_CALENDAR_BLUEPRINTS[businessType] || null;
}

export function getPlatformOptimization(platform: string): PlatformOptimization | null {
  return PLATFORM_OPTIMIZATION_CHEATSHEET[platform.toLowerCase()] || null;
}
