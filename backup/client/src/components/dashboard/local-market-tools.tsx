import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface MarketData {
  id: string;
  neighborhood: string;
  avgPrice: number;
  daysOnMarket: number;
  inventory: string;
  priceGrowth: string;
  trend: "hot" | "rising" | "steady" | "cooling";
  lastUpdated?: Date | string;
}

interface ContentOpportunity {
  id: string;
  userId: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  neighborhood: string | null;
  keywordId: string | null;
  trendSource: "market" | "keyword" | "trend";
  searchSignal: number;
  metadata: any;
  generatedAt: Date | string;
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "high":
      return "bg-primary/10 text-primary border-primary/20";
    case "medium":
      return "bg-accent/10 text-accent border-accent/20";
    case "low":
      return "bg-muted/50 text-muted-foreground border-muted";
    default:
      return "bg-muted/50 text-muted-foreground border-muted";
  }
};

const getTrendColor = (trend: string) => {
  switch (trend) {
    case "hot":
      return "text-chart-3";
    case "rising":
      return "text-primary";
    case "steady":
      return "text-accent";
    default:
      return "text-muted-foreground";
  }
};

const getTrendIcon = (trend: string) => {
  switch (trend) {
    case "hot":
      return "↗ Hot";
    case "rising":
      return "↗ Rising";
    case "steady":
      return "→ Steady";
    default:
      return "↘ Cooling";
  }
};

export function LocalMarketTools() {
  const { toast } = useToast();
  
  const { data: marketData, isLoading } = useQuery<MarketData[]>({
    queryKey: ["/api/market/data"],
  });

  const { data: contentOpportunities = [], isLoading: opportunitiesLoading } = useQuery<ContentOpportunity[]>({
    queryKey: ["/api/ai/opportunities"],
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/market/refresh");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market/data"] });
      toast({
        title: "Market Data Refreshed",
        description: "AI has generated fresh market statistics for Omaha neighborhoods.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Refresh Failed",
        description: error.message || "Could not refresh market data. Please try again.",
        variant: "destructive",
      });
    },
  });

  const refreshOpportunitiesMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/ai/opportunities/generate");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/opportunities"] });
      toast({
        title: "Content Opportunities Generated",
        description: "AI has created fresh content suggestions based on market data.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Could not generate content opportunities. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="h-16 bg-muted rounded"></div>
              </div>
              <div className="space-y-2">
                <div className="h-16 bg-muted rounded"></div>
              </div>
              <div className="space-y-2">
                <div className="h-16 bg-muted rounded"></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate market overview from data
  const avgPrice = marketData ? Math.round(marketData.reduce((sum, d) => sum + d.avgPrice, 0) / marketData.length / 1000) : 285;
  const avgDaysOnMarket = marketData ? Math.round(marketData.reduce((sum, d) => sum + d.daysOnMarket, 0) / marketData.length) : 23;

  // Get the most recent lastUpdated timestamp from market data
  const recordsWithTimestamps = marketData?.filter(d => d.lastUpdated) || [];
  const lastUpdated = recordsWithTimestamps.length > 0
    ? new Date(Math.max(...recordsWithTimestamps.map(d => new Date(d.lastUpdated!).getTime())))
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold text-foreground">Local Market Intelligence</CardTitle>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground">
                Last updated: {format(lastUpdated, "MMM d, yyyy 'at' h:mm a")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-accent/10 text-accent">
              AI Generated
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              data-testid="button-refresh-market"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
              {refreshMutation.isPending ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Market Stats */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">Market Overview</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Avg. Home Price</span>
                <span className="text-sm font-medium text-foreground" data-testid="text-avg-price">
                  ${avgPrice}K
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Days on Market</span>
                <span className="text-sm font-medium text-foreground" data-testid="text-days-on-market">
                  {avgDaysOnMarket} days
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Inventory</span>
                <span className="text-sm font-medium text-destructive" data-testid="text-inventory">
                  1.2 months
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Price Growth</span>
                <span className="text-sm font-medium text-green-600" data-testid="text-price-growth">
                  +8.4% YoY
                </span>
              </div>
            </div>
          </div>

          {/* Hot Neighborhoods */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">Trending Neighborhoods</h3>
            <div className="space-y-2">
              {marketData?.slice(0, 3).map((neighborhood) => (
                <div key={neighborhood.id} className="p-2 bg-muted rounded-md" data-testid={`neighborhood-${neighborhood.neighborhood.toLowerCase()}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{neighborhood.neighborhood}</span>
                    <span className={`text-xs ${getTrendColor(neighborhood.trend)}`}>
                      {getTrendIcon(neighborhood.trend)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {neighborhood.trend === "hot" && "15% above avg price"}
                    {neighborhood.trend === "rising" && "Low inventory"}
                    {neighborhood.trend === "steady" && "First-time buyers"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Content Opportunities */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                Content Opportunities
                <Badge variant="secondary" className="text-xs">AI Generated</Badge>
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refreshOpportunitiesMutation.mutate()}
                disabled={refreshOpportunitiesMutation.isPending}
                className="h-7 px-2"
                data-testid="button-refresh-opportunities"
              >
                <RefreshCw className={`h-3 w-3 ${refreshOpportunitiesMutation.isPending ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <div className="space-y-2">
              {opportunitiesLoading ? (
                <div className="space-y-2">
                  <div className="h-12 bg-muted rounded animate-pulse"></div>
                  <div className="h-12 bg-muted rounded animate-pulse"></div>
                  <div className="h-12 bg-muted rounded animate-pulse"></div>
                </div>
              ) : contentOpportunities.length > 0 ? (
                contentOpportunities.slice(0, 5).map((opportunity) => (
                  <Button
                    key={opportunity.id}
                    variant="ghost"
                    className={`w-full p-3 ${getPriorityColor(opportunity.priority)} rounded-lg text-left justify-start hover:opacity-80 transition-opacity border`}
                    data-testid={`opportunity-${opportunity.id}`}
                  >
                    <div className="text-left w-full">
                      <div className="text-sm font-medium flex items-center justify-between">
                        <span>{opportunity.title}</span>
                        {opportunity.searchSignal >= 70 && (
                          <Badge variant="secondary" className="text-xs ml-2">High demand</Badge>
                        )}
                      </div>
                      <div className="text-xs opacity-80 mt-1">{opportunity.description}</div>
                    </div>
                  </Button>
                ))
              ) : (
                <div className="text-center py-6 px-4 border-2 border-dashed rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground mb-3">No content opportunities yet</p>
                  <Button
                    onClick={() => refreshOpportunitiesMutation.mutate()}
                    disabled={refreshOpportunitiesMutation.isPending}
                    size="sm"
                    data-testid="button-generate-first-opportunities"
                  >
                    {refreshOpportunitiesMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      "Generate Opportunities"
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
