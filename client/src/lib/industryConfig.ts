import type { BusinessType } from "./businessContext";

export interface IndustryMetric {
  key: string;
  label: string;
  format: "currency" | "number" | "percent" | "text";
}

export interface IndustryConfig {
  marketTitle: string;
  marketSubtitle: string;
  metrics: IndustryMetric[];
  trendingLabel: string;
  trendingItemLabel: string;
  opportunityContext: string;
  showRealEstateData: boolean;
}

const configs: Record<BusinessType, IndustryConfig> = {
  real_estate: {
    marketTitle: "Local Market Intelligence",
    marketSubtitle: "AI-powered real estate market data",
    metrics: [
      { key: "avgPrice", label: "Avg. Home Price", format: "currency" },
      { key: "daysOnMarket", label: "Days on Market", format: "number" },
      { key: "inventory", label: "Inventory", format: "text" },
      { key: "priceGrowth", label: "Price Growth", format: "percent" },
    ],
    trendingLabel: "Trending Neighborhoods",
    trendingItemLabel: "neighborhood",
    opportunityContext: "real estate agent",
    showRealEstateData: true,
  },
  restaurant: {
    marketTitle: "Restaurant Marketing Hub",
    marketSubtitle: "AI-powered content for your restaurant",
    metrics: [
      { key: "peakHours", label: "Peak Dining Hours", format: "text" },
      { key: "avgCheckSize", label: "Avg. Check Size", format: "currency" },
      { key: "tableOccupancy", label: "Table Occupancy", format: "percent" },
      { key: "repeatCustomers", label: "Repeat Customers", format: "percent" },
    ],
    trendingLabel: "Top Dishes & Trends",
    trendingItemLabel: "dish",
    opportunityContext: "restaurant owner",
    showRealEstateData: false,
  },
  home_services: {
    marketTitle: "Local Services Hub",
    marketSubtitle: "AI-powered content for home services",
    metrics: [
      { key: "jobsCompleted", label: "Jobs / Month", format: "number" },
      { key: "avgJobValue", label: "Avg. Job Value", format: "currency" },
      { key: "responseTime", label: "Avg. Response Time", format: "text" },
      { key: "repeatRate", label: "Repeat Customer Rate", format: "percent" },
    ],
    trendingLabel: "Popular Services",
    trendingItemLabel: "service",
    opportunityContext: "home services professional",
    showRealEstateData: false,
  },
  retail: {
    marketTitle: "Retail Marketing Hub",
    marketSubtitle: "AI-powered content for your store",
    metrics: [
      { key: "dailyVisitors", label: "Daily Visitors", format: "number" },
      { key: "avgOrderValue", label: "Avg. Order Value", format: "currency" },
      { key: "conversionRate", label: "Conversion Rate", format: "percent" },
      { key: "inventoryTurnover", label: "Inventory Turnover", format: "text" },
    ],
    trendingLabel: "Top Products & Categories",
    trendingItemLabel: "product",
    opportunityContext: "retail business owner",
    showRealEstateData: false,
  },
  professional_services: {
    marketTitle: "Professional Services Hub",
    marketSubtitle: "AI-powered content for your practice",
    metrics: [
      { key: "newClients", label: "New Clients / Month", format: "number" },
      { key: "avgEngagement", label: "Avg. Engagement Value", format: "currency" },
      { key: "clientRetention", label: "Client Retention", format: "percent" },
      { key: "referralRate", label: "Referral Rate", format: "percent" },
    ],
    trendingLabel: "In-Demand Services",
    trendingItemLabel: "service",
    opportunityContext: "professional services provider",
    showRealEstateData: false,
  },
  general: {
    marketTitle: "Business Marketing Hub",
    marketSubtitle: "AI-powered content for your business",
    metrics: [
      { key: "monthlyReach", label: "Monthly Reach", format: "number" },
      { key: "engagement", label: "Avg. Engagement", format: "percent" },
      { key: "newCustomers", label: "New Customers", format: "number" },
      { key: "satisfaction", label: "Customer Satisfaction", format: "percent" },
    ],
    trendingLabel: "Trending Topics",
    trendingItemLabel: "topic",
    opportunityContext: "business owner",
    showRealEstateData: false,
  },
};

export function getIndustryConfig(businessType: BusinessType): IndustryConfig {
  return configs[businessType] ?? configs.general;
}
