import { cn } from "@/lib/utils";
import { CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PlatformConfig {
  name: string;
  maxCharacters: number;
  optimalCharacters: { min: number; max: number };
  truncatesAt: number;
  hashtagRecommendation: string;
  notes: string;
  engagementTip: string;
}

const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  facebook: {
    name: "Facebook",
    maxCharacters: 63206,
    optimalCharacters: { min: 40, max: 80 },
    truncatesAt: 140,
    hashtagRecommendation: "2-3 hashtags, but posts often perform better without any",
    notes: "Posts under 50 characters get 66% more engagement",
    engagementTip: "Lead with a compelling hook - users spend only 2.5 seconds on posts",
  },
  instagram: {
    name: "Instagram",
    maxCharacters: 2200,
    optimalCharacters: { min: 1, max: 50 },
    truncatesAt: 125,
    hashtagRecommendation: "1-2 hashtags (21% better engagement than 3+)",
    notes: "Truncates at 125 characters; shorter captions drive more interactions",
    engagementTip: "The first 125 characters are critical - that's all users see before 'more'",
  },
  x: {
    name: "X (Twitter)",
    maxCharacters: 280,
    optimalCharacters: { min: 70, max: 100 },
    truncatesAt: 280,
    hashtagRecommendation: "1-2 hashtags maximum",
    notes: "Sweet spot of 70-100 characters gets 36% more engagement",
    engagementTip: "Tweets with 240-259 characters get the most likes and replies",
  },
  twitter: {
    name: "X (Twitter)",
    maxCharacters: 280,
    optimalCharacters: { min: 70, max: 100 },
    truncatesAt: 280,
    hashtagRecommendation: "1-2 hashtags maximum",
    notes: "Sweet spot of 70-100 characters gets 36% more engagement",
    engagementTip: "Tweets with 240-259 characters get the most likes and replies",
  },
  linkedin: {
    name: "LinkedIn",
    maxCharacters: 3000,
    optimalCharacters: { min: 80, max: 120 },
    truncatesAt: 140,
    hashtagRecommendation: "3-5 industry-relevant hashtags",
    notes: "Truncates after 140 characters with 'See More'",
    engagementTip: "~100 characters (25 words or less) for posts",
  },
  tiktok: {
    name: "TikTok",
    maxCharacters: 4000,
    optimalCharacters: { min: 100, max: 150 },
    truncatesAt: 150,
    hashtagRecommendation: "3-5 trending hashtags relevant to real estate",
    notes: "Strong hook in opening is critical",
    engagementTip: "The first 2 seconds of your caption need to hook viewers immediately",
  },
  threads: {
    name: "Threads",
    maxCharacters: 500,
    optimalCharacters: { min: 200, max: 300 },
    truncatesAt: 500,
    hashtagRecommendation: "Minimal hashtags; Threads favors natural conversation",
    notes: "Meta's text platform; visual content still drives engagement",
    engagementTip: "Conversational, authentic content performs best",
  },
  pinterest: {
    name: "Pinterest",
    maxCharacters: 500,
    optimalCharacters: { min: 40, max: 50 },
    truncatesAt: 50,
    hashtagRecommendation: "2-5 relevant hashtags in description",
    notes: "Only first 50 characters visible initially",
    engagementTip: "Pinterest is a search engine - use keywords naturally in your first 50 characters",
  },
  youtube: {
    name: "YouTube",
    maxCharacters: 5000,
    optimalCharacters: { min: 200, max: 300 },
    truncatesAt: 100,
    hashtagRecommendation: "3-5 hashtags; tags have 500 character combined limit",
    notes: "First 100 characters of description show in search",
    engagementTip: "YouTube is the second largest search engine - optimize for discoverability",
  },
};

interface CharacterCounterProps {
  platform: string;
  text: string;
  showTip?: boolean;
  className?: string;
}

export function CharacterCounter({
  platform,
  text,
  showTip = true,
  className,
}: CharacterCounterProps) {
  const config = PLATFORM_CONFIGS[platform.toLowerCase()];
  if (!config) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        {text.length} characters
      </div>
    );
  }

  const current = text.length;
  const { optimalCharacters, maxCharacters, truncatesAt } = config;

  let status: "optimal" | "acceptable" | "warning" | "over";
  let message: string;
  let StatusIcon: typeof CheckCircle;
  let statusColor: string;

  if (current > maxCharacters) {
    status = "over";
    message = `Over limit by ${current - maxCharacters} characters`;
    StatusIcon = XCircle;
    statusColor = "text-red-500";
  } else if (current > truncatesAt && truncatesAt < maxCharacters) {
    status = "warning";
    message = `Will be truncated after ${truncatesAt} characters`;
    StatusIcon = AlertTriangle;
    statusColor = "text-amber-500";
  } else if (current >= optimalCharacters.min && current <= optimalCharacters.max) {
    status = "optimal";
    message = `Optimal length for ${config.name} engagement!`;
    StatusIcon = CheckCircle;
    statusColor = "text-green-500";
  } else if (current < optimalCharacters.min) {
    status = "acceptable";
    message = `Add ${optimalCharacters.min - current} more for optimal engagement`;
    StatusIcon = Info;
    statusColor = "text-blue-500";
  } else {
    status = "acceptable";
    message = `Good, but ${optimalCharacters.min}-${optimalCharacters.max} chars performs best`;
    StatusIcon = Info;
    statusColor = "text-blue-500";
  }

  const progressPercent = Math.min(100, (current / maxCharacters) * 100);
  const optimalStart = (optimalCharacters.min / maxCharacters) * 100;
  const optimalEnd = (optimalCharacters.max / maxCharacters) * 100;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5">
          <StatusIcon className={cn("h-4 w-4", statusColor)} />
          <span className={cn("font-medium", statusColor)}>
            {current} / {maxCharacters}
          </span>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground cursor-help underline decoration-dotted">
                Optimal: {optimalCharacters.min}-{optimalCharacters.max}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-2">
                <p className="font-medium">{config.name} Best Practices</p>
                <p className="text-xs">{config.notes}</p>
                <p className="text-xs text-muted-foreground">{config.hashtagRecommendation}</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="absolute h-full bg-green-200 dark:bg-green-900/50"
          style={{
            left: `${optimalStart}%`,
            width: `${optimalEnd - optimalStart}%`,
          }}
        />
        <div
          className={cn(
            "absolute h-full rounded-full transition-all",
            status === "optimal" && "bg-green-500",
            status === "acceptable" && "bg-blue-500",
            status === "warning" && "bg-amber-500",
            status === "over" && "bg-red-500"
          )}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {showTip && (
        <p className={cn("text-xs", statusColor)}>{message}</p>
      )}
    </div>
  );
}

export function PlatformTip({ platform }: { platform: string }) {
  const config = PLATFORM_CONFIGS[platform.toLowerCase()];
  if (!config) return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
      <div className="flex items-start gap-2">
        <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-blue-700 dark:text-blue-300">
            {config.name} Tip
          </p>
          <p className="text-blue-600 dark:text-blue-400 text-xs mt-1">
            {config.engagementTip}
          </p>
        </div>
      </div>
    </div>
  );
}

export function getPlatformConfig(platform: string): PlatformConfig | null {
  return PLATFORM_CONFIGS[platform.toLowerCase()] || null;
}

export { PLATFORM_CONFIGS };
