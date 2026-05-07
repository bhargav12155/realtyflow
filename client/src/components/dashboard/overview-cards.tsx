import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Edit, Search, Heart, ExternalLink, CheckCircle, Loader2, Clock, CheckCircle2, XCircle } from "lucide-react";
import { SiFacebook, SiInstagram, SiLinkedin, SiTiktok, SiYoutube, SiWhatsapp } from "react-icons/si";
import { FaXTwitter } from "react-icons/fa6";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface OverviewData {
  monthly_leads: number;
  monthly_leads_change?: number;
  content_published: number;
  content_published_change?: number;
  posts_by_platform?: Record<string, number>;
  seo_ranking: number;
  social_engagement: number;
}

interface SearchConsoleStatus {
  connected: boolean;
  sites?: string[];
  connectedAt?: string;
}

interface AdminStatus {
  isAdmin: boolean;
}

const cards = [
  {
    title: "Monthly Leads",
    key: "monthly_leads" as keyof OverviewData,
    changeKey: "monthly_leads_change" as keyof OverviewData,
    icon: Users,
    color: "text-chart-1",
    bgColor: "bg-chart-1/10",
    changeLabel: "vs last month",
    isConnected: true,
    connectHint: "Engagement tracking active",
  },
  {
    title: "Content Published",
    key: "content_published" as keyof OverviewData,
    changeKey: "content_published_change" as keyof OverviewData,
    icon: Edit,
    color: "text-chart-2",
    bgColor: "bg-chart-2/10",
    changeLabel: "vs last month",
    isConnected: true,
    connectHint: "Post content to track",
  },
  {
    title: "SEO Ranking",
    key: "seo_ranking" as keyof OverviewData,
    icon: Search,
    color: "text-chart-3",
    bgColor: "bg-chart-3/10",
    changeLabel: "avg position",
    format: (value: number) => (value / 10).toFixed(1),
    isConnected: false,
    connectHint: "Connect Search Console",
    connectAction: "search_console",
  },
  {
    title: "Social Engagement",
    key: "social_engagement" as keyof OverviewData,
    icon: Heart,
    color: "text-chart-4",
    bgColor: "bg-chart-4/10",
    changeLabel: "total interactions",
    format: (value: number) => value >= 1000 ? `${(value / 1000).toFixed(1)}K` : String(value),
    isConnected: true,
    connectHint: "Connect socials",
  },
];

export function OverviewCards() {
  const { toast } = useToast();
  const { data: overview, isLoading } = useQuery<OverviewData>({
    queryKey: ["/api/dashboard/overview"],
  });

  // Check if user is admin
  const { data: adminStatus } = useQuery<AdminStatus>({
    queryKey: ["/api/user/is-admin"],
  });

  // Check if Search Console is connected platform-wide
  const { data: scStatus } = useQuery<SearchConsoleStatus>({
    queryKey: ["/api/search-console/status"],
  });

  const isAdmin = adminStatus?.isAdmin ?? false;
  const isSearchConsoleConnected = scStatus?.connected ?? false;

  const connectSearchConsoleMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/search-console/connect", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to initiate connection");
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleConnect = (action: string) => {
    if (action === "search_console") {
      connectSearchConsoleMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <Card key={card.title} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-16 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {cards.map((card) => {
        const value = overview?.[card.key] || 0;
        const formattedValue = card.format ? card.format(value) : value.toLocaleString();
        
        // Get change value (either from API or show connect hint)
        let changeText = "";
        let changeValue: number | undefined;
        let showConnectHint = false;
        
        if (card.changeKey && overview) {
          changeValue = overview[card.changeKey] as number | undefined;
          if (changeValue !== undefined) {
            const prefix = changeValue > 0 ? '+' : '';
            changeText = `${prefix}${changeValue.toFixed(1)}%`;
          } else if (value === 0) {
            changeText = "No data";
          }
        } else if (!card.isConnected) {
          showConnectHint = true;
        }
        
        // Determine color based on positive/negative change
        const getChangeColor = (change: string, numValue?: number) => {
          if (change === "No data") {
            return 'text-muted-foreground';
          }
          if (numValue !== undefined) {
            if (numValue > 0) return 'text-green-600';
            if (numValue < 0) return 'text-red-600';
            return 'text-muted-foreground';
          }
          if (change.startsWith('+')) {
            return 'text-green-600';
          } else if (change.startsWith('-')) {
            return 'text-red-600';
          }
          return 'text-chart-3';
        };
        
        return (
          <Card key={card.title} className="min-w-0">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{card.title}</p>
                  <p className="text-xl sm:text-2xl font-bold text-foreground truncate" data-testid={`metric-${card.key.replace('_', '-')}`}>
                    {(card.isConnected || ((card as any).connectAction === "search_console" && isSearchConsoleConnected)) ? formattedValue : '--'}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[#304652] bg-[#2d4450] flex-shrink-0">
                  <card.icon className={`${card.color} h-4 w-4`} />
                </div>
              </div>
              <div className="mt-3 sm:mt-4 flex items-center text-xs sm:text-sm">
                {showConnectHint ? (
                  (card as any).connectAction === "search_console" ? (
                    isSearchConsoleConnected ? (
                      <span className="text-green-600 font-medium flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Connected
                      </span>
                    ) : isAdmin ? (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-amber-600 hover:text-amber-700 font-medium"
                        onClick={() => handleConnect((card as any).connectAction)}
                        disabled={connectSearchConsoleMutation.isPending}
                        data-testid={`button-connect-${card.key}`}
                      >
                        {connectSearchConsoleMutation.isPending ? (
                          <>
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            {card.connectHint}
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </>
                        )}
                      </Button>
                    ) : (
                      <span className="text-muted-foreground font-medium truncate">Admin connects this</span>
                    )
                  ) : (card as any).connectAction ? (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-amber-600 hover:text-amber-700 font-medium"
                      onClick={() => handleConnect((card as any).connectAction)}
                      disabled={connectSearchConsoleMutation.isPending}
                      data-testid={`button-connect-${card.key}`}
                    >
                      {connectSearchConsoleMutation.isPending ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          {card.connectHint}
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </>
                      )}
                    </Button>
                  ) : (
                    <span className="text-amber-600 font-medium truncate">{card.connectHint}</span>
                  )
                ) : (
                  <>
                    <span className={`${getChangeColor(changeText, changeValue)} font-medium`}>{changeText}</span>
                    <span className="text-muted-foreground ml-1 truncate">{card.changeLabel}</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

interface RecentPost {
  id: string;
  platform: string;
  content: string;
  status: string;
  scheduledFor: string | null;
  metadata: any;
  updatedAt: string;
}

const platformIcons: Record<string, any> = {
  facebook: SiFacebook,
  instagram: SiInstagram,
  linkedin: SiLinkedin,
  tiktok: SiTiktok,
  youtube: SiYoutube,
  whatsapp: SiWhatsapp,
  x: FaXTwitter,
  twitter: FaXTwitter,
};

const platformColors: Record<string, string> = {
  facebook: "text-blue-600",
  instagram: "text-pink-500",
  linkedin: "text-blue-700",
  tiktok: "text-foreground",
  youtube: "text-red-600",
  whatsapp: "text-green-500",
  x: "text-foreground",
  twitter: "text-foreground",
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function RecentPostActivity() {
  const { data: recentPosts, isLoading } = useQuery<RecentPost[]>({
    queryKey: ["/api/dashboard/recent-posts"],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recent Post Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-3">
                <div className="w-8 h-8 bg-muted rounded-full" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-2 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!recentPosts || recentPosts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recent Post Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground" data-testid="text-no-recent-posts">
            No posts sent yet. Schedule content from the calendar or post directly from the social media manager.
          </p>
        </CardContent>
      </Card>
    );
  }

  const sentCount = recentPosts.filter(p => p.status === "posted").length;
  const failedCount = recentPosts.length - sentCount;

  const platformBgColors: Record<string, string> = {
    facebook: "bg-[#1877F2]",
    facebook_page: "bg-[#1877F2]",
    instagram: "bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF]",
    twitter: "bg-black dark:bg-white/10",
    linkedin: "bg-[#0A66C2]",
    tiktok: "bg-black dark:bg-white/10",
    youtube: "bg-[#FF0000]",
    whatsapp: "bg-[#25D366]",
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            Recent Post Activity
          </CardTitle>
          <div className="flex items-center gap-2">
            {sentCount > 0 && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                {sentCount} sent
              </span>
            )}
            {failedCount > 0 && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                {failedCount} failed
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-2" data-testid="list-recent-posts">
          {recentPosts.map((post, index) => {
            const PlatformIcon = platformIcons[post.platform.toLowerCase()] || Edit;
            const publishedAt = post.metadata?.publishedAt || post.updatedAt;
            const isPosted = post.status === "posted";
            const bgColor = platformBgColors[post.platform.toLowerCase()] || "bg-muted";

            return (
              <div
                key={post.id}
                className={`group flex items-start gap-2 px-2.5 py-2 rounded-xl border transition-all duration-200 hover:bg-muted/60 hover:shadow-sm ${index === 0 ? 'bg-muted/30' : 'border-border/40'}`}
                data-testid={`recent-post-${post.id}`}
              >
                <div className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center shadow-sm ${bgColor}`}>
                  <PlatformIcon className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold capitalize truncate">{post.platform.replace('_', ' ')}</span>
                    {isPosted ? (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-green-600 dark:text-green-400" data-testid={`badge-status-${post.id}`}>
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Delivered
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-red-500 dark:text-red-400" data-testid={`badge-status-${post.id}`}>
                        <XCircle className="h-2.5 w-2.5" />
                        Failed
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                    {post.content?.substring(0, 80) || "No content"}
                  </p>
                  <span className="text-[9px] text-muted-foreground/60 tabular-nums">
                    {formatTimeAgo(publishedAt)}
                  </span>
                  {!isPosted && post.metadata?.error && (
                    <p className="text-[9px] text-red-500/80 mt-0.5 line-clamp-1 bg-red-50 dark:bg-red-950/20 px-1.5 py-0.5 rounded">
                      {post.metadata.error}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
