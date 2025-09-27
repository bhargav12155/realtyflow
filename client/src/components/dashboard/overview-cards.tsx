import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Edit, Search, Heart } from "lucide-react";

interface OverviewData {
  monthly_leads: number;
  content_published: number;
  seo_ranking: number;
  social_engagement: number;
}

const cards = [
  {
    title: "Monthly Leads",
    key: "monthly_leads" as keyof OverviewData,
    icon: Users,
    color: "text-chart-1",
    bgColor: "bg-chart-1/10",
    change: "+12.5%",
    changeLabel: "vs last month",
  },
  {
    title: "Content Published",
    key: "content_published" as keyof OverviewData,
    icon: Edit,
    color: "text-chart-2",
    bgColor: "bg-chart-2/10",
    change: "+8.3%",
    changeLabel: "vs last month",
  },
  {
    title: "SEO Ranking",
    key: "seo_ranking" as keyof OverviewData,
    icon: Search,
    color: "text-chart-3",
    bgColor: "bg-chart-3/10",
    change: "+0.8",
    changeLabel: "avg position",
    format: (value: number) => (value / 10).toFixed(1),
  },
  {
    title: "Social Engagement",
    key: "social_engagement" as keyof OverviewData,
    icon: Heart,
    color: "text-chart-4",
    bgColor: "bg-chart-4/10",
    change: "+15.2%",
    changeLabel: "this week",
    format: (value: number) => `${(value / 1000).toFixed(1)}K`,
  },
];

export function OverviewCards() {
  const { data: overview, isLoading } = useQuery<OverviewData>({
    queryKey: ["/api/dashboard/overview"],
  });

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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card) => {
        const value = overview?.[card.key] || 0;
        const formattedValue = card.format ? card.format(value) : value.toLocaleString();
        
        // Determine color based on positive/negative change
        const getChangeColor = (change: string) => {
          if (change.startsWith('+')) {
            return 'text-green-600';
          } else if (change.startsWith('-')) {
            return 'text-red-600';
          }
          return 'text-chart-3'; // fallback for neutral
        };
        
        return (
          <Card key={card.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                  <p className="text-2xl font-bold text-foreground" data-testid={`metric-${card.key.replace('_', '-')}`}>
                    {formattedValue}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[#304652] bg-[#2d4450]">
                  <card.icon className={`${card.color} h-4 w-4`} />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className={`${getChangeColor(card.change)} font-medium`}>{card.change}</span>
                <span className="text-muted-foreground ml-1">{card.changeLabel}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
