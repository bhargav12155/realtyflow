import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  Facebook,
  Instagram,
  Linkedin,
  Music2,
  Video,
  Twitter as X,
  Youtube,
} from "lucide-react";
import { useMemo } from "react";

interface VideoPlatformScorecardProps {
  videoId?: string;
  heygenVideoId?: string;
  className?: string;
}

interface PlatformScore {
  platform: string;
  score: number;
  tier: "strong" | "good" | "emerging";
  recommendation: string;
  reasons?: string[];
  connected?: boolean;
  factors: {
    engagementWeight: number;
    durationFit: number;
    pastPerformance: number;
  };
}

interface PlatformScoreResponse {
  videoId: string | null;
  heygenVideoId: string | null;
  durationSeconds: number;
  durationSource: "exact" | "estimated" | string;
  platformScores: PlatformScore[];
}

const platformIcons: Record<string, LucideIcon> = {
  instagram: Instagram,
  tiktok: Music2,
  facebook: Facebook,
  youtube: Youtube,
  linkedin: Linkedin,
  x: X,
};

const tierBadges: Record<
  PlatformScore["tier"],
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  strong: { label: "Best fit", variant: "default" },
  good: { label: "Solid", variant: "secondary" },
  emerging: { label: "Test it", variant: "outline" },
};

export function VideoPlatformScorecard({
  videoId,
  heygenVideoId,
  className,
}: VideoPlatformScorecardProps) {
  const enabled = Boolean(videoId || heygenVideoId);

  const { data, isLoading, isError } = useQuery<PlatformScoreResponse>({
    queryKey: ["platform-scores", videoId, heygenVideoId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (videoId) params.set("videoId", videoId);
      if (heygenVideoId) params.set("heygenVideoId", heygenVideoId);
      const response = await fetch(
        `/api/social/platform-scores?${params.toString()}`
      );
      if (!response.ok) {
        throw new Error("Failed to load platform guidance");
      }
      return response.json();
    },
    enabled,
    staleTime: 60_000,
  });

  const topScores = useMemo(() => data?.platformScores ?? [], [data]);

  if (!enabled) {
    return null;
  }

  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-lg border p-4 text-sm text-muted-foreground",
          className
        )}
      >
        Scoring platforms for this clip...
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className={cn(
          "rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700",
          className
        )}
      >
        Unable to score platforms right now. Try refreshing once the video is
        ready.
      </div>
    );
  }

  if (!topScores.length) {
    return (
      <div
        className={cn(
          "rounded-lg border p-4 text-sm text-muted-foreground",
          className
        )}
      >
        Connect at least one social platform to see tailored posting
        suggestions.
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border bg-card p-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Best Fit Suggestions</p>
          <p className="text-xs text-muted-foreground">
            {Math.round(data?.durationSeconds ?? 0)}s clip ·{" "}
            {data?.durationSource === "exact" ? "Exact duration" : "Estimated"}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {topScores.map((score) => {
          const Icon = platformIcons[score.platform] ?? Video;
          const badgeMeta = tierBadges[score.tier];
          return (
            <div key={score.platform} className="rounded-lg border px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-muted p-2 text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium capitalize">
                      {score.platform}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {score.reasons?.slice(0, 2).join(" • ") ||
                        score.recommendation}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 text-right">
                  <Badge variant={badgeMeta.variant}>{badgeMeta.label}</Badge>
                  <div className="text-xs font-semibold">{score.score}/100</div>
                  {!score.connected && (
                    <Badge
                      variant="outline"
                      className="text-amber-700 border-amber-300"
                    >
                      Connect to post
                    </Badge>
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-1">
                <Progress value={score.score} className="h-1.5" />
                <div className="grid grid-cols-3 text-[10px] text-muted-foreground">
                  <span>
                    Engagement {Math.round(score.factors.engagementWeight)}
                  </span>
                  <span>Duration {Math.round(score.factors.durationFit)}</span>
                  <span>
                    History {Math.round(score.factors.pastPerformance)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
