import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { RefreshCw, Send } from "lucide-react";
import { useMemo, useState } from "react";

interface MockPost {
  id: string;
  headline: string;
  content: string;
  hashtags: string[];
}

const neighborhoods = [
  "Dundee",
  "Aksarben Village",
  "Elkhorn",
  "Old Market",
  "Benson",
  "Midtown",
  "Papillion",
];

const hooks = [
  "Just toured",
  "Market spotlight:",
  "Sneak peek:",
  "Luxury alert:",
  "Fresh on the market:",
  "Weekend watch:",
  "Neighborhood gem:",
];

const sellingPoints = [
  "floor-to-ceiling windows",
  "chef-inspired kitchen",
  "sunlit home office",
  "walkable amenities",
  "tree-lined streets",
  "heated three-stall garage",
  "expansive backyard",
];

const callsToAction = [
  "DM for a private tour",
  "Text me for pricing",
  "Want the full photo set? Let me know",
  "Open house info available",
  "Ready for a move-up home?",
  "Curious what your home could fetch?",
];

const hashSets = [
  ["#OmahaRealEstate", "#JustListed", "#MikeBjork"],
  ["#HomeGoals", "#NebraskaHomes", "#LuxuryLiving"],
  ["#MoveToOmaha", "#RealEstateAgent", "#MarketWatch"],
  ["#HouseHunting", "#DreamHome", "#RealtorLife"],
];

function buildRandomPost(seed: number): MockPost {
  const randomFrom = <T,>(arr: T[]): T =>
    arr[Math.floor(Math.random() * arr.length)];

  const neighborhood = randomFrom(neighborhoods);
  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(425000 + (seed % 6) * 25000);

  const headline = `${randomFrom(hooks)} ${neighborhood}`;
  const feature = randomFrom(sellingPoints);
  const cta = randomFrom(callsToAction);
  const hashtags = randomFrom(hashSets);

  const content = [
    `${headline}! ${price} and loaded with ${feature}.`,
    "\n",
    `• Beds/Baths: ${3 + (seed % 2)} / ${2 + (seed % 2)} | ${
      2_200 + seed * 15
    } sqft`,
    `• Walk Score: ${70 + (seed % 10)} | Listed by Mike Bjork`,
    "\n",
    `${cta}`,
    hashtags.join(" "),
  ].join("\n");

  return {
    id: `mock-${seed}`,
    headline,
    content,
    hashtags,
  };
}

export function TwitterTestPosts() {
  const { toast } = useToast();
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1000));

  const posts = useMemo(() => {
    return Array.from({ length: 3 }, (_, index) =>
      buildRandomPost(seed + index)
    );
  }, [seed]);

  const postMutation = useMutation({
    mutationFn: async (content: string) => {
      const formData = new FormData();
      formData.append("content", content);

      const response = await fetch("/api/twitter/post", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Failed to post to Twitter");
      }

      return data;
    },
    onSuccess: () => {
      toast({
        title: "Tweet sent",
        description: "Posted mock content to X/Twitter.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Twitter post failed",
        description: error.message || "Unable to post mock content.",
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg">Twitter Quick Test Posts</CardTitle>
          <p className="text-sm text-muted-foreground">
            Use these ready-to-send samples to verify the Twitter integration.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSeed(Math.floor(Math.random() * 1000))}
          aria-label="Refresh mock posts"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {posts.map((post) => (
          <div
            key={post.id}
            className="rounded-md border border-dashed border-border bg-muted/30 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Mock</Badge>
                <span className="font-medium text-foreground">
                  {post.headline}
                </span>
              </div>
              <Button
                size="sm"
                onClick={() => postMutation.mutate(post.content)}
                disabled={postMutation.isPending}
              >
                <Send className="mr-2 h-4 w-4" />
                {postMutation.isPending ? "Posting..." : "Post to X"}
              </Button>
            </div>
            <Textarea
              value={post.content}
              readOnly
              className="min-h-[140px] text-sm"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
