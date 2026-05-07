import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Brain, 
  Search, 
  Star, 
  MapPin, 
  CheckCircle,
  AlertCircle,
  TrendingUp,
  FileText,
  Users,
  Award,
  Target,
  Lightbulb,
  Loader2
} from "lucide-react";

interface AIOptimizationScore {
  overall: number;
  factors: {
    entityOptimization: number;
    structuredData: number;
    authoritySignals: number;
    conversationalContent: number;
    localRelevance: number;
  };
}

interface AISearchTip {
  category: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  implemented: boolean;
  action: string;
}

const aiSearchTips: AISearchTip[] = [
  {
    category: "Entity Optimization",
    title: "Establish Clear Business Entity",
    description: "AI searches look for clear entity relationships. Make sure your name, business, and location are consistently mentioned together.",
    impact: "high",
    implemented: false,
    action: "Include '[Your Name], [Your Brokerage], Omaha' in every piece of content"
  },
  {
    category: "Conversational Content",
    title: "Answer Questions Directly",
    description: "AI searches favor content that directly answers questions people ask about real estate.",
    impact: "high",
    implemented: false,
    action: "Start content with 'If you're wondering...' or 'Here's what you need to know about...'"
  },
  {
    category: "Local Authority",
    title: "Hyperlocal Expertise",
    description: "AI gives preference to content that demonstrates deep local knowledge and expertise.",
    impact: "high",
    implemented: false,
    action: "Mention specific streets, schools, businesses, and local events in your content"
  },
  {
    category: "Structured Data",
    title: "Schema Markup Implementation",
    description: "AI search engines rely heavily on structured data to understand your content.",
    impact: "high",
    implemented: false,
    action: "Add LocalBusiness, RealEstateAgent, and FAQPage schema to your website"
  },
  {
    category: "Authority Signals",
    title: "Professional Credentials",
    description: "AI searches look for expertise indicators and professional qualifications.",
    impact: "medium",
    implemented: false,
    action: "Always mention your licenses, certifications, and years of experience"
  },
  {
    category: "Conversational Content",
    title: "FAQ Format Content",
    description: "AI searches love FAQ-style content that matches how people ask questions.",
    impact: "high",
    implemented: false,
    action: "Create content in Q&A format: 'What's the best neighborhood in Omaha for families?'"
  },
  {
    category: "Local Authority",
    title: "Market Data Citations",
    description: "AI gives credibility to content that cites specific, current market data.",
    impact: "medium",
    implemented: false,
    action: "Include recent sale prices, market trends, and neighborhood statistics"
  },
  {
    category: "Entity Optimization",
    title: "Neighborhood Entity Building",
    description: "Build strong entity relationships between you and specific Omaha neighborhoods.",
    impact: "high",
    implemented: false,
    action: "Consistently create content about the same 5-7 neighborhoods you specialize in"
  },
  {
    category: "Structured Data",
    title: "Advanced Review Schema",
    description: "AI platforms heavily weight customer reviews and ratings in search results.",
    impact: "high",
    implemented: false,
    action: "Implement Review and AggregateRating schema with client testimonials"
  },
  {
    category: "Conversational Content",
    title: "Video Content with Transcripts",
    description: "AI searches now index video content through transcripts and captions.",
    impact: "high",
    implemented: false,
    action: "Add AI-readable transcripts to all video tours and market updates"
  },
  {
    category: "Structured Data",
    title: "Featured Snippet Optimization",
    description: "Structure content for zero-click searches and AI-powered answer boxes.",
    impact: "high",
    implemented: false,
    action: "Use tables, lists, and step-by-step formats for complex topics"
  },
  {
    category: "Entity Optimization",
    title: "Knowledge Graph Integration",
    description: "Build comprehensive entity relationships across all major platforms.",
    impact: "high",
    implemented: false,
    action: "Ensure consistent NAP (Name, Address, Phone) across 50+ directories"
  }
];

export function AISearchOptimizer() {
  const [selectedNeighborhood, setSelectedNeighborhood] = useState("");
  const [optimizationGoal, setOptimizationGoal] = useState("");
  const [customQuestion, setCustomQuestion] = useState("");
  
  const { toast} = useToast();
  const queryClient = useQueryClient();

  // Fetch company profile for dynamic content
  const { data: companyProfile } = useQuery<{
    agentName?: string;
    brokerageName?: string;
    phone?: string;
    address?: string;
    neighborhoods?: string[];
    website?: string;
  }>({
    queryKey: ["/api/company/profile"],
  });

  // Get agent name and brokerage with smart defaults
  const agentName = companyProfile?.agentName || "[Your Name]";
  const brokerageName = companyProfile?.brokerageName || "[Your Brokerage]";

  // Calculate real optimization score based on profile completeness
  const hasAgentName = agentName !== "[Your Name]";
  const hasBrokerage = brokerageName !== "[Your Brokerage]";
  const hasPhone = !!companyProfile?.phone;
  const hasAddress = !!companyProfile?.address;
  const hasNeighborhoods = !!companyProfile?.neighborhoods?.length;
  const hasWebsite = !!companyProfile?.website;
  
  // Calculate real score based on what's actually configured
  const completedItems = [hasAgentName, hasBrokerage, hasPhone, hasAddress, hasNeighborhoods, hasWebsite].filter(Boolean).length;
  const totalItems = 6;
  const calculatedScore = Math.round((completedItems / totalItems) * 100);
  
  const realScore: AIOptimizationScore = {
    overall: calculatedScore,
    factors: {
      entityOptimization: hasAgentName && hasBrokerage ? 80 : 20,
      structuredData: hasWebsite ? 60 : 20,
      authoritySignals: hasPhone && hasAddress ? 70 : 30,
      conversationalContent: 50, // Base score - they can improve with content
      localRelevance: hasNeighborhoods ? 90 : 30
    }
  };

  const generateAIOptimizedContent = useMutation({
    mutationFn: async (data: { neighborhood: string; goal: string; question?: string }) => {
      const response = await apiRequest("POST", "/api/content/ai-optimized", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "AI-Optimized Content Created!",
        description: "Your content has been optimized for AI search engines",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate AI-optimized content",
        variant: "destructive",
      });
    },
  });

  const handleGenerateContent = () => {
    if (!selectedNeighborhood || !optimizationGoal) {
      toast({
        title: "Missing Information",
        description: "Please select a neighborhood and optimization goal",
        variant: "destructive",
      });
      return;
    }

    generateAIOptimizedContent.mutate({
      neighborhood: selectedNeighborhood,
      goal: optimizationGoal,
      question: customQuestion || undefined
    });
  };

  const omahaNeighborhoods = [
    "Dundee", "Aksarben Village", "Blackstone District", "Benson", 
    "Midtown Crossing", "West Omaha", "Millard", "Papillion", 
    "Elkhorn", "Downtown Omaha"
  ];

  const optimizationGoals = [
    "Best neighborhoods for families",
    "Luxury homes and properties", 
    "First-time homebuyer advice",
    "Investment property opportunities",
    "Moving to Omaha guide",
    "Market trends and analysis",
    "School district information",
    "Local amenities and lifestyle"
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground flex items-center">
          <Brain className="mr-2 h-5 w-5" />
          AI Search Optimization
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Optimize your content to rank #1 in AI-powered search results like ChatGPT, Perplexity, and Google AI
        </p>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="score" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="score">AI Search Score</TabsTrigger>
            <TabsTrigger value="optimize">Content Optimizer</TabsTrigger>
            <TabsTrigger value="tips">Implementation Guide</TabsTrigger>
          </TabsList>
          
          <TabsContent value="score" className="space-y-4 mt-4">
            <div className="grid gap-4">
              {/* Overall Score - Based on profile completeness */}
              <div className={`text-center p-6 border rounded-lg ${calculatedScore >= 80 ? 'bg-gradient-to-br from-green-50 to-emerald-50' : calculatedScore >= 50 ? 'bg-gradient-to-br from-yellow-50 to-orange-50' : 'bg-gradient-to-br from-red-50 to-pink-50'}`}>
                <div className={`text-3xl font-bold mb-2 ${calculatedScore >= 80 ? 'text-green-600' : calculatedScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {realScore.overall}%
                </div>
                <p className="text-sm text-muted-foreground">Profile Completeness Score</p>
                <Progress value={realScore.overall} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  Complete your profile to improve AI search visibility
                </p>
              </div>

              {/* Setup Checklist */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-3 flex items-center">
                  <Target className="h-4 w-4 mr-2" />
                  Setup Checklist
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center text-sm">
                    {hasAgentName ? <CheckCircle className="h-4 w-4 mr-2 text-green-500" /> : <AlertCircle className="h-4 w-4 mr-2 text-yellow-500" />}
                    <span className={hasAgentName ? 'text-green-700' : ''}>Agent name configured</span>
                  </div>
                  <div className="flex items-center text-sm">
                    {hasBrokerage ? <CheckCircle className="h-4 w-4 mr-2 text-green-500" /> : <AlertCircle className="h-4 w-4 mr-2 text-yellow-500" />}
                    <span className={hasBrokerage ? 'text-green-700' : ''}>Brokerage name set</span>
                  </div>
                  <div className="flex items-center text-sm">
                    {hasPhone ? <CheckCircle className="h-4 w-4 mr-2 text-green-500" /> : <AlertCircle className="h-4 w-4 mr-2 text-yellow-500" />}
                    <span className={hasPhone ? 'text-green-700' : ''}>Phone number added</span>
                  </div>
                  <div className="flex items-center text-sm">
                    {hasAddress ? <CheckCircle className="h-4 w-4 mr-2 text-green-500" /> : <AlertCircle className="h-4 w-4 mr-2 text-yellow-500" />}
                    <span className={hasAddress ? 'text-green-700' : ''}>Business address set</span>
                  </div>
                  <div className="flex items-center text-sm">
                    {hasNeighborhoods ? <CheckCircle className="h-4 w-4 mr-2 text-green-500" /> : <AlertCircle className="h-4 w-4 mr-2 text-yellow-500" />}
                    <span className={hasNeighborhoods ? 'text-green-700' : ''}>Target neighborhoods selected</span>
                  </div>
                  <div className="flex items-center text-sm">
                    {hasWebsite ? <CheckCircle className="h-4 w-4 mr-2 text-green-500" /> : <AlertCircle className="h-4 w-4 mr-2 text-yellow-500" />}
                    <span className={hasWebsite ? 'text-green-700' : ''}>Website URL added</span>
                  </div>
                </div>
                {calculatedScore < 100 && (
                  <p className="text-xs text-muted-foreground mt-3 flex items-center">
                    <Lightbulb className="h-3 w-3 mr-1" />
                    Go to Brand Settings to complete your profile
                  </p>
                )}
              </div>

              {/* Factor Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2 text-blue-500" />
                      <span className="text-sm">Entity Optimization</span>
                    </div>
                    <div className="flex items-center">
                      <Progress value={realScore.factors.entityOptimization} className="w-16 mr-2" />
                      <span className="text-xs font-medium">{realScore.factors.entityOptimization}%</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-red-500" />
                      <span className="text-sm">Structured Data</span>
                    </div>
                    <div className="flex items-center">
                      <Progress value={realScore.factors.structuredData} className="w-16 mr-2" />
                      <span className="text-xs font-medium">{realScore.factors.structuredData}%</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Award className="h-4 w-4 mr-2 text-yellow-500" />
                      <span className="text-sm">Authority Signals</span>
                    </div>
                    <div className="flex items-center">
                      <Progress value={realScore.factors.authoritySignals} className="w-16 mr-2" />
                      <span className="text-xs font-medium">{realScore.factors.authoritySignals}%</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Brain className="h-4 w-4 mr-2 text-purple-500" />
                      <span className="text-sm">Conversational Content</span>
                    </div>
                    <div className="flex items-center">
                      <Progress value={realScore.factors.conversationalContent} className="w-16 mr-2" />
                      <span className="text-xs font-medium">{realScore.factors.conversationalContent}%</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-2 text-green-500" />
                      <span className="text-sm">Local Relevance</span>
                    </div>
                    <div className="flex items-center">
                      <Progress value={realScore.factors.localRelevance} className="w-16 mr-2" />
                      <span className="text-xs font-medium">{realScore.factors.localRelevance}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="optimize" className="space-y-4 mt-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Target Neighborhood</Label>
                  <select 
                    className="w-full mt-1 p-2 border rounded-md"
                    value={selectedNeighborhood}
                    onChange={(e) => setSelectedNeighborhood(e.target.value)}
                    data-testid="select-neighborhood"
                  >
                    <option value="">Select neighborhood...</option>
                    {omahaNeighborhoods.map((neighborhood) => (
                      <option key={neighborhood} value={neighborhood}>
                        {neighborhood}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Optimization Goal</Label>
                  <select 
                    className="w-full mt-1 p-2 border rounded-md"
                    value={optimizationGoal}
                    onChange={(e) => setOptimizationGoal(e.target.value)}
                    data-testid="select-optimization-goal"
                  >
                    <option value="">Select goal...</option>
                    {optimizationGoals.map((goal) => (
                      <option key={goal} value={goal}>
                        {goal}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="custom-question" className="text-sm font-medium">
                  Specific Question to Target (Optional)
                </Label>
                <Input
                  id="custom-question"
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  placeholder="e.g., What's the best family neighborhood in Omaha?"
                  data-testid="input-custom-question"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Target a specific question that people ask AI search engines
                </p>
              </div>
              
              <Button
                onClick={handleGenerateContent}
                disabled={generateAIOptimizedContent.isPending}
                className="w-full"
                data-testid="button-generate-ai-content"
              >
                {generateAIOptimizedContent.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Generate AI-Optimized Content
                  </>
                )}
              </Button>
              
              {/* AI Optimization Preview */}
              <div className="border rounded-lg p-4 bg-blue-50">
                <h3 className="font-medium mb-2 flex items-center">
                  <Lightbulb className="h-4 w-4 mr-2 text-blue-500" />
                  AI Search Optimization Preview
                </h3>
                <div className="text-sm space-y-2">
                  <p><strong>Entity Focus:</strong> {agentName} + {selectedNeighborhood || "Omaha"} + Real Estate</p>
                  <p><strong>Question Format:</strong> Direct answers to "{customQuestion || optimizationGoal}"</p>
                  <p><strong>Local Authority:</strong> Specific neighborhood insights and market data</p>
                  <p><strong>Conversational Tone:</strong> Natural language that matches how people ask AI</p>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="tips" className="space-y-4 mt-4">
            <div className="space-y-4">
              {aiSearchTips.map((tip, index) => (
                <div key={index} className="border rounded-lg p-4" data-testid={`ai-tip-${index}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center mb-1">
                        <Badge 
                          className={`text-xs mr-2 ${
                            tip.impact === 'high' ? 'bg-red-100 text-red-700' :
                            tip.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {tip.impact.toUpperCase()} IMPACT
                        </Badge>
                        <span className="text-xs text-muted-foreground">{tip.category}</span>
                      </div>
                      <h3 className="font-medium text-sm">{tip.title}</h3>
                    </div>
                    
                    <div className="flex items-center">
                      {tip.implemented ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                      )}
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-3">
                    {tip.description}
                  </p>
                  
                  <div className="bg-gray-50 rounded p-3">
                    <p className="text-xs font-medium text-gray-700 mb-1">Action Required:</p>
                    <p className="text-xs text-gray-600">{tip.action}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
              <h3 className="font-medium mb-2 flex items-center">
                <Lightbulb className="h-4 w-4 mr-2 text-blue-500" />
                How to Use These Tips
              </h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Work through these recommendations to improve how AI search engines find and recommend your content:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li><strong>High Impact</strong> tips should be prioritized first</li>
                  <li>Complete your Brand Settings to unlock personalized tips</li>
                  <li>Focus on 2-3 tips per week for sustainable progress</li>
                  <li>Use the Content Optimizer tab to generate AI-ready content</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}