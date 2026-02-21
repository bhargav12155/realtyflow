import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Edit, Search, Heart, ExternalLink, CheckCircle, Loader2 } from "lucide-react";
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
