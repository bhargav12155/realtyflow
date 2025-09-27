import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MarketData {
  id: string;
  neighborhood: string;
  avgPrice: number;
  daysOnMarket: number;
  inventory: string;
  priceGrowth: string;
  trend: "hot" | "rising" | "steady" | "cooling";
}

const contentOpportunities = [
  {
    id: 1,
    title: "Aksarben Market Update",
    description: "High search volume",
    priority: "high",
    color: "bg-primary/10 text-primary",
  },
  {
    id: 2,
    title: "First-Time Buyer Guide",
    description: "Trending topic",
    priority: "medium",
    color: "bg-accent/10 text-accent",
  },
  {
    id: 3,
    title: "Luxury Home Features",
    description: "Seasonal interest",
    priority: "medium",
    color: "bg-chart-3/10 text-black",
  },
];

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
  const { data: marketData, isLoading } = useQuery<MarketData[]>({
    queryKey: ["/api/market/data"],
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Local Market Intelligence</CardTitle>
          <Badge variant="secondary" className="bg-accent/10 text-accent">
            Live Data
          </Badge>
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
            <h3 className="text-sm font-medium text-foreground mb-3">Content Opportunities</h3>
            <div className="space-y-2">
              {contentOpportunities.map((opportunity) => (
                <Button
                  key={opportunity.id}
                  variant="ghost"
                  className={`w-full p-2 ${opportunity.color} rounded-md text-left justify-start hover:opacity-80 transition-opacity`}
                  data-testid={`opportunity-${opportunity.id}`}
                >
                  <div className="text-left">
                    <div className="text-sm font-medium">{opportunity.title}</div>
                    <div className="text-xs opacity-80">{opportunity.description}</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
