import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  MapPin, 
  Home, 
  TrendingUp, 
  Users, 
  Car,
  GraduationCap,
  Snowflake,
  DollarSign,
  Play,
  Copy,
  Wand2
} from "lucide-react";

interface VideoTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: any;
  duration: number;
  neighborhood?: string;
  script: string;
  hooks: string[];
  callToAction: string;
  tags: string[];
}

const omahaVideoTemplates: VideoTemplate[] = [
  // Neighborhood Spotlights
  {
    id: "dundee-family",
    title: "Dundee: Perfect for Growing Families",
    description: "Showcase Dundee's family-friendly amenities and charm",
    category: "neighborhood",
    icon: Home,
    duration: 90,
    neighborhood: "Dundee",
    script: `Hi, I'm Mike Bjork with Berkshire Hathaway HomeServices. Today I want to talk about why Dundee is absolutely perfect for growing families.

Picture this: tree-lined streets where kids can safely ride bikes, walkable neighborhoods where you can stroll to local cafes, and a community that truly feels like home. That's Dundee.

What makes Dundee special? First, the schools. You're looking at some of Omaha's top-rated districts with excellent programs. Second, the parks - Elmwood Park is literally in your backyard with playgrounds, trails, and community events year-round.

But here's what really sets Dundee apart - the sense of community. Neighbors know each other. Local businesses thrive. And you're just minutes from downtown Omaha while feeling like you're in a small town.

Home values here have consistently appreciated, making it not just a great place to live, but a smart investment for your family's future.

Ready to explore what Dundee has to offer? Call me at 402-XXX-XXXX. I know this neighborhood inside and out, and I'd love to show you why families choose Dundee.`,
    hooks: [
      "What if I told you there's a neighborhood where kids still play outside?",
      "Looking for a place where neighbors actually know each other?",
      "Here's why smart families are choosing Dundee..."
    ],
    callToAction: "Ready to find your dream home in Dundee? Call Mike at 402-XXX-XXXX",
    tags: ["Dundee", "FamilyHomes", "OmahaNeighborhoods", "SafeForKids"]
  },
  {
    id: "aksarben-luxury",
    title: "Aksarben Village: Luxury Living Redefined",
    description: "Highlight Aksarben's modern amenities and lifestyle",
    category: "neighborhood",
    icon: TrendingUp,
    duration: 75,
    neighborhood: "Aksarben",
    script: `If you're looking for luxury living in Omaha, Aksarben Village is where it's happening.

This isn't just a neighborhood - it's a lifestyle. Imagine walking out your front door to world-class dining, shopping, and entertainment. The CHI Health Center, Baxter Arena, and some of Omaha's best restaurants are literally at your doorstep.

The homes here? Stunning. We're talking modern condos with floor-to-ceiling windows, luxury townhomes with rooftop decks, and amenities that feel like a five-star resort. Pool, fitness center, concierge services - it's all here.

And here's something most people don't know - Aksarben has some of the best appreciation rates in Omaha. You're not just buying a home, you're making a smart investment in one of the city's fastest-growing areas.

Whether you're a young professional, empty nester, or anyone who appreciates the finer things in life, Aksarben Village delivers luxury without compromise.

Want to see what luxury living really looks like? I'm Mike Bjork, and I'd love to show you around Aksarben Village. Call me today.`,
    hooks: [
      "What does $500K buy you in Omaha's hottest neighborhood?",
      "Here's where Omaha's professionals are choosing to live...",
      "Luxury living in Omaha just got an upgrade..."
    ],
    callToAction: "Experience Aksarben luxury. Call Mike at 402-XXX-XXXX for a private tour",
    tags: ["Aksarben", "LuxuryHomes", "ModernLiving", "CondoLife"]
  },
  
  // Moving to Omaha Guides
  {
    id: "moving-guide-overview",
    title: "Moving to Omaha: Your Complete Guide",
    description: "Comprehensive overview for people relocating to Omaha",
    category: "moving",
    icon: Users,
    duration: 120,
    script: `Thinking about moving to Omaha? You're making a smart choice, and I'm here to tell you why.

First, let's talk opportunity. Omaha is home to five Fortune 500 companies - Berkshire Hathaway, Union Pacific, ConAgra, Mutual of Omaha, and Kiewit. The job market is strong, unemployment is low, and there's room to grow your career.

Now, the cost of living - this is where Omaha really shines. Your dollar goes further here. The median home price is about 30% below the national average, but you're not sacrificing quality of life. We have world-class healthcare, excellent schools, and a thriving arts and culture scene.

Worried about harsh winters? Yes, we get snow, but the city handles it well, and there's something magical about Nebraska's four distinct seasons. Plus, summer festivals, farmer's markets, and outdoor activities make up for any winter blues.

The neighborhoods? Incredible variety. Want urban living? Check out downtown or Midtown. Family-oriented? Dundee, Benson, or West Omaha. Looking for luxury? Aksarben Village has you covered.

Here's the bottom line - Omaha offers big city opportunities with small town values, all at a price that won't break the bank.

Ready to make Omaha home? I'm Mike Bjork, your local expert who can help you navigate this transition seamlessly.`,
    hooks: [
      "Why are people leaving expensive cities for Omaha?",
      "Here's what $300K gets you in Omaha vs. other cities...",
      "The Omaha secret that's changing lives..."
    ],
    callToAction: "Ready to call Omaha home? Let's talk: 402-XXX-XXXX",
    tags: ["MovingToOmaha", "RelocationGuide", "CostOfLiving", "NewToOmaha"]
  },
  {
    id: "winter-guide",
    title: "Omaha Winters: What to Really Expect",
    description: "Honest guide about winter living in Omaha",
    category: "moving",
    icon: Snowflake,
    duration: 90,
    script: `Let's talk about the elephant in the room - Omaha winters. If you're moving here from warmer climates, you probably have questions.

Yes, it gets cold. Yes, we get snow. But here's what the weather apps don't tell you - Omaha handles winter beautifully.

The city's snow removal is top-notch. Main roads are cleared quickly, and neighborhoods follow close behind. Your commute isn't going to be derailed by every snowstorm.

Heating costs? With good insulation and efficient systems, most homes run $150-250 per month in the coldest months. Factor in our lower overall cost of living, and you're still ahead.

But here's the real truth about Omaha winters - the community comes alive. Ice skating at Turner Park, winter festivals downtown, cozy neighborhood coffee shops. There's something special about Nebraska hospitality in winter - neighbors help neighbors, and everyone looks out for each other.

And spring? When those first warm days hit in March, you appreciate them in a way you never did in warmer climates.

My advice? Invest in a good coat, embrace the seasons, and discover why so many people who move here for work end up staying for life.

Questions about winter living in Omaha? I've been here my whole life - call me and let's talk real talk about what to expect.`,
    hooks: [
      "Here's the truth about Omaha winters nobody tells you...",
      "Why winter might be your favorite season in Omaha...",
      "Scared of Nebraska winters? Watch this first..."
    ],
    callToAction: "Winter questions? Get honest answers from a local: 402-XXX-XXXX",
    tags: ["OmahaWinter", "MovingToOmaha", "WinterLiving", "SeasonalGuide"]
  },
  
  // Market Updates
  {
    id: "market-update-january",
    title: "Omaha Market Update - January 2025",
    description: "Current market trends and opportunities",
    category: "market",
    icon: TrendingUp,
    duration: 105,
    script: `It's January 2025, and the Omaha real estate market is telling an interesting story. Let me break down what you need to know.

First, inventory - we're sitting at about 2.1 months of supply, which is still a seller's market, but it's more balanced than we've seen in years. This means buyers have more choices, and sellers need to price strategically.

Home prices? The median sale price hit $285,000 last month, up 4.2% year over year. That's healthy appreciation without the crazy spikes we saw in 2021-2022.

Here's what's hot: Move-in ready homes under $350K are still moving fast. Luxury properties over $500K are taking longer but commanding top dollar when priced right.

Interest rates are hovering around 6.8%, which has definitely cooled some buyer activity, but here's the thing - rates always fluctuate. The home you buy today will outlast multiple rate cycles.

My prediction for 2025? Continued moderate appreciation, better selection for buyers, and opportunities for both sides if you work with an agent who knows the local market.

Whether you're buying or selling this year, timing and strategy matter more than ever. That's where having a local expert makes all the difference.

Want the inside scoop on your specific neighborhood or price range? Let's talk about your goals and how this market can work for you.`,
    hooks: [
      "What nobody's telling you about Omaha's 2025 market...",
      "Is now the right time to buy or sell in Omaha?",
      "Here's what changed in Omaha real estate this month..."
    ],
    callToAction: "Get your personalized market analysis: 402-XXX-XXXX",
    tags: ["MarketUpdate", "OmahaRealEstate", "January2025", "MarketTrends"]
  },
  
  // Buyer/Seller Education
  {
    id: "first-time-buyer",
    title: "First-Time Homebuyer Tips for Omaha",
    description: "Essential advice for first-time buyers in the Omaha market",
    category: "education",
    icon: GraduationCap,
    duration: 135,
    script: `Buying your first home in Omaha? Congratulations! This is one of the most exciting steps you'll ever take. Let me share some insider tips that'll save you time, money, and stress.

First, get pre-approved before you look at a single house. In this market, sellers want to see that letter. It shows you're serious and helps you understand your budget. In Omaha, you can find great starter homes from $180K-$280K.

Second, think beyond the mortgage payment. Budget for property taxes (Nebraska's are reasonable), insurance, utilities, and maintenance. In Omaha, expect about $200-300 monthly for taxes and insurance on a typical starter home.

Third, choose your neighborhood carefully. Commute times, school districts, and future development all impact your investment. West Omaha offers newer construction, Midtown has character and walkability, and up-and-coming areas like Benson offer great value.

Here's what I tell all my first-time buyers: Your first home doesn't have to be your forever home. Buy something you can afford, build equity for 3-5 years, then upgrade if needed.

And please, don't skip the inspection. Even new construction needs a professional once-over. It's $500 that could save you thousands.

Ready to start your home search? I work with amazing first-time buyers every day, and I'd love to help you navigate this process with confidence.`,
    hooks: [
      "What I wish every first-time buyer knew before starting...",
      "The first-time buyer mistakes that cost thousands...",
      "Here's how to buy your first home like a pro..."
    ],
    callToAction: "Ready to buy your first home? Let's start the journey: 402-XXX-XXXX",
    tags: ["FirstTimeBuyer", "Homebuying101", "OmahaHomes", "BuyerTips"]
  }
];

export function OmahaVideoTemplates() {
  const [selectedTemplate, setSelectedTemplate] = useState<VideoTemplate | null>(null);
  const [customScript, setCustomScript] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createVideoFromTemplate = useMutation({
    mutationFn: async (videoData: any) => {
      const response = await apiRequest("POST", "/api/videos", videoData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Video Created!",
        description: "Your video has been created from the template",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      setSelectedTemplate(null);
      setCustomScript("");
      setCustomTitle("");
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create video from template",
        variant: "destructive",
      });
    },
  });

  const handleUseTemplate = (template: VideoTemplate) => {
    setSelectedTemplate(template);
    setCustomScript(template.script);
    setCustomTitle(template.title);
  };

  const handleCreateFromTemplate = () => {
    if (!selectedTemplate) return;

    createVideoFromTemplate.mutate({
      title: customTitle,
      script: customScript,
      topic: selectedTemplate.description,
      neighborhood: selectedTemplate.neighborhood || null,
      videoType: selectedTemplate.category === "neighborhood" ? "neighborhood_tour" : 
                 selectedTemplate.category === "moving" ? "moving_guide" :
                 selectedTemplate.category === "market" ? "market_update" : "buyer_tips",
      duration: selectedTemplate.duration,
      tags: selectedTemplate.tags,
      status: "ready"
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Script copied to clipboard",
    });
  };

  const categorizedTemplates = {
    neighborhood: omahaVideoTemplates.filter(t => t.category === "neighborhood"),
    moving: omahaVideoTemplates.filter(t => t.category === "moving"),
    market: omahaVideoTemplates.filter(t => t.category === "market"),
    education: omahaVideoTemplates.filter(t => t.category === "education"),
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground flex items-center">
          <MapPin className="mr-2 h-5 w-5" />
          Omaha Video Templates
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Pre-built video scripts tailored to the Omaha real estate market
        </p>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="neighborhood" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="neighborhood">Neighborhoods</TabsTrigger>
            <TabsTrigger value="moving">Moving Guide</TabsTrigger>
            <TabsTrigger value="market">Market Updates</TabsTrigger>
            <TabsTrigger value="education">Education</TabsTrigger>
          </TabsList>
          
          <TabsContent value="neighborhood" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categorizedTemplates.neighborhood.map((template) => (
                <TemplateCard key={template.id} template={template} onUse={handleUseTemplate} />
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="moving" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categorizedTemplates.moving.map((template) => (
                <TemplateCard key={template.id} template={template} onUse={handleUseTemplate} />
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="market" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categorizedTemplates.market.map((template) => (
                <TemplateCard key={template.id} template={template} onUse={handleUseTemplate} />
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="education" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categorizedTemplates.education.map((template) => (
                <TemplateCard key={template.id} template={template} onUse={handleUseTemplate} />
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Template Dialog */}
        <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
          <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-900 border border-border shadow-lg">
            <DialogHeader>
              <DialogTitle>{selectedTemplate?.title}</DialogTitle>
            </DialogHeader>
            
            {selectedTemplate && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="custom-title" className="text-sm font-medium">Video Title</Label>
                    <Input
                      id="custom-title"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      data-testid="input-custom-title"
                    />
                  </div>
                  <div className="flex items-end">
                    <Badge className="bg-blue-100 text-blue-700">
                      {selectedTemplate.duration} seconds
                    </Badge>
                    {selectedTemplate.neighborhood && (
                      <Badge className="ml-2 bg-green-100 text-green-700">
                        📍 {selectedTemplate.neighborhood}
                      </Badge>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">Video Script</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(customScript)}
                      data-testid="button-copy-script"
                    >
                      <Copy className="mr-2 h-3 w-3" />
                      Copy
                    </Button>
                  </div>
                  <Textarea
                    value={customScript}
                    onChange={(e) => setCustomScript(e.target.value)}
                    rows={15}
                    className="text-sm"
                    data-testid="textarea-custom-script"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedTemplate(null)}
                    data-testid="button-cancel-template"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateFromTemplate}
                    disabled={createVideoFromTemplate.isPending}
                    data-testid="button-create-from-template"
                  >
                    <Wand2 className="mr-2 h-4 w-4" />
                    {createVideoFromTemplate.isPending ? "Creating..." : "Create Video"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function TemplateCard({ template, onUse }: { template: VideoTemplate; onUse: (template: VideoTemplate) => void }) {
  const Icon = template.icon;
  
  return (
    <div className="border rounded-lg p-4 space-y-3" data-testid={`template-${template.id}`}>
      <div className="flex items-start space-x-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-sm">{template.title}</h3>
          <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          <Badge className="text-xs bg-blue-100 text-blue-700">
            {template.duration}s
          </Badge>
          {template.neighborhood && (
            <Badge className="text-xs bg-green-100 text-green-700">
              📍 {template.neighborhood}
            </Badge>
          )}
        </div>
        
        <Button
          size="sm"
          onClick={() => onUse(template)}
          className="text-xs h-7"
          data-testid={`use-template-${template.id}`}
        >
          <Play className="mr-1 h-3 w-3" />
          Use Template
        </Button>
      </div>
      
      <div className="text-xs text-muted-foreground">
        Tags: {template.tags.slice(0, 3).join(", ")}
        {template.tags.length > 3 && "..."}
      </div>
    </div>
  );
}