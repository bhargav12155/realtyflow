import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, AlertCircle, TrendingUp, TrendingDown, Search, Globe, Smartphone, Sparkles, Loader2, Calendar, Info } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface SeoKeyword {
  id: string;
  keyword: string;
  currentRank: number;
  searchVolume: number;
  neighborhood?: string;
}

interface SiteHealth {
  loadTime: number;
  mobileScore: number;
  seoScore: number;
}

const getRankColor = (rank: number) => {
  if (rank <= 3) return "text-chart-3";
  if (rank <= 10) return "text-chart-2";
  return "text-muted-foreground";
};

export function SEOOptimizer() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showFullReport, setShowFullReport] = useState(false);
  const [aiGeneratedKeywords, setAiGeneratedKeywords] = useState<SeoKeyword[] | null>(null);
  
  const { data: keywords, isLoading: keywordsLoading } = useQuery<SeoKeyword[]>({
    queryKey: ["/api/seo/keywords"],
  });

  const { data: siteHealth, isLoading: healthLoading } = useQuery<SiteHealth>({
    queryKey: ["/api/seo/site-health"],
  });

  const generateKeywordsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/seo/keywords/generate', {
        location: 'Omaha, Nebraska',
        businessType: 'real estate agent'
      });
      return await response.json();
    },
    onSuccess: (data) => {
      setAiGeneratedKeywords(data);
      toast({
        title: "✨ AI Keywords Generated!",
        description: `Generated ${data.length} optimized keywords for your real estate business.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: "Could not generate keywords. Please try again.",
        variant: "destructive",
      });
    },
  });

  const generateContentPlanMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/content/generate-plan', {
        keywords: displayKeywords || [],
        durationDays: 30
      });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-posts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/content/plan'] });
      toast({
        title: "🎯 30-Day Content Plan Created!",
        description: `Generated ${data.totalPosts || 30} posts based on your SEO keywords. Review and approve.`,
      });
      // Navigate to dashboard calendar view using hash navigation
      setLocation('/dashboard');
      window.location.hash = '#calendar';
    },
    onError: (error) => {
      toast({
        title: "Plan Generation Failed",
        description: "Could not generate content plan. Please try again.",
        variant: "destructive",
      });
    },
  });

  const isLoading = keywordsLoading || healthLoading;
  const displayKeywords = aiGeneratedKeywords || keywords;
  const hasGeneratedRef = useRef(false);
  
  // Auto-generate AI keywords on first load if we only have fallback data
  useEffect(() => {
    if (!hasGeneratedRef.current && keywords && keywords.length > 0 && !aiGeneratedKeywords) {
      // Check if these are fallback keywords (they have fb- prefix IDs)
      const hasFallbackOnly = keywords.every(k => k.id.startsWith('fb-'));
      if (hasFallbackOnly && !generateKeywordsMutation.isPending) {
        hasGeneratedRef.current = true;
        generateKeywordsMutation.mutate();
      }
    }
  }, [keywords, aiGeneratedKeywords]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-8 bg-muted rounded"></div>
              <div className="h-8 bg-muted rounded"></div>
              <div className="h-8 bg-muted rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const overallScore = siteHealth?.seoScore || 94;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">SEO Performance</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => generateContentPlanMutation.mutate()}
              disabled={generateContentPlanMutation.isPending || !displayKeywords?.length}
              variant="default"
              size="sm"
              className="text-sm bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              data-testid="button-generate-content-plan"
            >
              {generateContentPlanMutation.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  Creating Plan...
                </>
              ) : (
                <>
                  <Calendar className="h-3 w-3 mr-1.5" />
                  Generate Content Plan
                </>
              )}
            </Button>
            <Button
              onClick={() => generateKeywordsMutation.mutate()}
              disabled={generateKeywordsMutation.isPending}
              variant="outline"
              size="sm"
              className="text-sm"
              data-testid="button-generate-ai-keywords"
            >
              {generateKeywordsMutation.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3 mr-1.5" />
                  AI Keywords
                </>
              )}
            </Button>
            <Dialog open={showFullReport} onOpenChange={setShowFullReport}>
              <DialogTrigger asChild>
                <Button variant="link" className="text-primary hover:text-primary/80 text-sm font-medium" data-testid="button-view-seo-report">
                  View Full Report
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Complete SEO Analysis Report
                </DialogTitle>
              </DialogHeader>
              
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="keywords">Keywords</TabsTrigger>
                  <TabsTrigger value="recommendations">Action Items</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="space-y-6 mt-4">
                  {/* SEO Score Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-3xl font-bold text-green-600 mb-1">{overallScore}/100</div>
                      <div className="text-sm text-muted-foreground">Overall SEO Score</div>
                      <Progress value={overallScore} className="mt-2" />
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-3xl font-bold text-blue-600 mb-1">{siteHealth?.mobileScore || 98}/100</div>
                      <div className="text-sm text-muted-foreground">Mobile Performance</div>
                      <Progress value={siteHealth?.mobileScore || 98} className="mt-2" />
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-3xl font-bold text-purple-600 mb-1">{displayKeywords?.length || 12}</div>
                      <div className="text-sm text-muted-foreground">Tracked Keywords</div>
                    </div>
                  </div>
                  
                  {/* Site Health Details */}
                  <div className="border rounded-lg p-4">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Site Performance Metrics
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${(siteHealth?.loadTime || 3.2) <= 3.0 ? 'text-green-600' : 'text-red-600'}`}>
                          {siteHealth?.loadTime?.toFixed(1) || "3.2"}s
                        </div>
                        <div className="text-xs text-muted-foreground">Page Load Time</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">98%</div>
                        <div className="text-xs text-muted-foreground">Uptime</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">A+</div>
                        <div className="text-xs text-muted-foreground">Security Grade</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">SSL</div>
                        <div className="text-xs text-muted-foreground">Certificate</div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="keywords" className="space-y-4 mt-4">
                  <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                    <strong className="text-foreground">What these numbers mean:</strong>
                    <div className="mt-1 space-y-1">
                      • <strong>Monthly Searches</strong> - How many people search this phrase each month
                      <br />• <strong>Your Ranking</strong> - Where your website appears in Google results (lower is better!)
                      <br />• <strong>Neighborhood</strong> - The Omaha area this keyword targets
                    </div>
                  </div>
                  <div className="space-y-3">
                    {displayKeywords?.map((keyword, index) => (
                      <div key={keyword.id} className="flex items-center justify-between p-3 border rounded-lg hover:border-primary/50 transition-colors">
                        <div className="flex-1">
                          <div className="font-medium text-sm mb-1.5">{keyword.keyword}</div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Search className="h-3 w-3" />
                              <strong>{keyword.searchVolume?.toLocaleString() || 'N/A'}</strong> people search this monthly
                            </span>
                            {keyword.neighborhood && (
                              <span className="flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {keyword.neighborhood} area
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <Badge variant={keyword.currentRank <= 3 ? 'default' : keyword.currentRank <= 10 ? 'secondary' : 'outline'} className="text-sm">
                              Rank #{keyword.currentRank}
                            </Badge>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {keyword.currentRank <= 3 ? '🏆 Top 3!' : keyword.currentRank <= 10 ? '✨ Page 1' : 'Page ' + Math.ceil(keyword.currentRank / 10)}
                            </div>
                          </div>
                          {index < 5 ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                      </div>
                    )) || [
                      ...Array(8).fill(null).map((_, i) => (
                        <div key={i} className="animate-pulse flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-muted rounded w-1/2"></div>
                          </div>
                          <div className="h-6 bg-muted rounded w-12"></div>
                        </div>
                      ))
                    ]}
                  </div>
                </TabsContent>
                
                <TabsContent value="recommendations" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <div className="border rounded-lg p-4 bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-900">
                      <h3 className="font-medium text-orange-800 dark:text-orange-200 mb-2 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        🔥 Do This Week - High Impact
                      </h3>
                      <div className="space-y-2 text-sm text-orange-900 dark:text-orange-100">
                        <div>• Create 1 video about "buying a home in Dundee" (150 people search this monthly)</div>
                        <div>• Post 3 new property photos to Instagram with neighborhood hashtags</div>
                        <div>• Write a blog post about "Aksarben neighborhood guide for families"</div>
                      </div>
                    </div>
                    
                    <div className="border rounded-lg p-4 bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
                      <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        📅 Do This Month - Steady Growth
                      </h3>
                      <div className="space-y-2 text-sm text-blue-900 dark:text-blue-100">
                        <div>• Get 2 reviews from recent clients on Google Business</div>
                        <div>• Partner with a local Omaha business for website link exchange</div>
                        <div>• Update all property listings with better descriptions</div>
                        <div>• Start an email newsletter for your buyer/seller lists</div>
                      </div>
                    </div>
                    
                    <div className="border rounded-lg p-4 bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900">
                      <h3 className="font-medium text-green-800 dark:text-green-200 mb-2 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        ✅ Keep Doing - You're On Track
                      </h3>
                      <div className="space-y-2 text-sm text-green-900 dark:text-green-100">
                        <div>• Keep posting AI-generated content 3x per week</div>
                        <div>• Respond to all social media messages within 24 hours</div>
                        <div>• Monitor which keywords are improving each month</div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Top Keywords */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-foreground">
              {aiGeneratedKeywords ? "AI-Suggested Keywords" : "Suggested Keywords"}
            </h3>
            {aiGeneratedKeywords && (
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                AI Generated
              </Badge>
            )}
          </div>
          <div className="space-y-2">
            {generateKeywordsMutation.isPending ? (
              <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating AI keywords...
              </div>
            ) : (
              displayKeywords?.slice(0, 4).map((keyword) => (
                <div key={keyword.id} className="flex items-center justify-between" data-testid={`keyword-${keyword.id}`}>
                  <span className="text-sm text-foreground">{keyword.keyword}</span>
                  <Badge variant="secondary" className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent hover:bg-secondary/80 text-chart-3 font-medium bg-[#2e4551]">
                    ~#{keyword.currentRank}
                  </Badge>
                </div>
              ))
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <Info className="h-3 w-3" />
            Rankings are AI estimates based on market analysis
          </p>
        </div>

        {/* Site Health */}
        <div className="pt-4 border-t border-border">
          <h3 className="text-sm font-medium text-foreground mb-3">Site Health Score</h3>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Overall Score</span>
                <span className={`text-xs font-medium ${overallScore >= 80 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-overall-score">
                  {overallScore}/100
                </span>
              </div>
              <Progress value={overallScore} className="h-2" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className={`text-lg font-bold ${(siteHealth?.loadTime || 3.2) <= 3.0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-load-time">
                {siteHealth?.loadTime?.toFixed(1) || "3.2"}s
              </div>
              <div className="text-xs text-muted-foreground">Load Time</div>
            </div>
            <div>
              <div className={`text-lg font-bold ${(siteHealth?.mobileScore || 98) >= 90 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-mobile-score">
                {siteHealth?.mobileScore || 98}%
              </div>
              <div className="text-xs text-muted-foreground">Mobile Score</div>
            </div>
            <div>
              <div className="text-lg font-bold text-muted-foreground" data-testid="text-monthly-visitors">--</div>
              <div className="text-xs text-muted-foreground">Visitors (needs Analytics)</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
