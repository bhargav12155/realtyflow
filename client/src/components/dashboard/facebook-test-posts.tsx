import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { RefreshCw, Send } from "lucide-react";
import { useMemo, useRef, useState } from "react";

interface MockFacebookPost {
  id: string;
  headline: string;
  body: string;
}

interface FacebookPostResponse {
  success: boolean;
  postId: string;
  message?: string;
  pageId?: string;
  usedSampleImage?: boolean;
  permalinkHint?: string;
}

interface FacebookPostPayload extends MockFacebookPost {}

const fbHooks = [
  "Weekend open house:",
  "Neighborhood highlight:",
  "Fresh MLS drop:",
  "Buyer interest alert:",
  "Under-the-radar stunner:",
];

const fbAngles = [
  "sunlit kitchen with updated quartz surfaces",
  "tree-lined corner lot with wraparound porch",
  "vaulted ceilings and double-sided fireplace",
  "heated three-stall garage and workshop",
  "walkable access to local cafes and parks",
];

const fbNeighborhoods = [
  "Dundee",
  "Aksarben Village",
  "Elkhorn",
  "Papillion",
  "Old Market",
  "Bennington",
];

const fbSocialProof = [
  "Over 120 Omaha families served since 2010",
  "Top 1% producer with Berkshire Hathaway",
  "In-house media team for listing launches",
  "Dedicated buyer concierge team",
];

const fbCTAs = [
  "DM me for the spec sheet",
  "Text me for a same-day tour",
  "Curious what your home could fetch? Let's chat",
  "Want the designer mood board? I'll send it over",
];

function buildMockFacebookPost(seed: number): MockFacebookPost {
  const pick = <T,>(items: T[]): T => items[seed % items.length];

  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(395000 + (seed % 5) * 28000);

  const headline = `${pick(fbHooks)} ${pick(fbNeighborhoods)}`;
  const body = [
    `${headline} • ${price}`,
    "",
    `• ${pick(fbAngles)}`,
    `• ${3 + (seed % 2)} beds | ${2 + (seed % 3)} baths | ${(
      2_000 +
      seed * 12
    ).toLocaleString()} sqft`,
    `• ${pick(fbSocialProof)}`,
    "",
    `${pick(fbCTAs)}`,
  ].join("\n");

  return {
    id: `fb-mock-${seed}`,
    headline,
    body,
  };
}

export function FacebookTestPosts() {
  const { toast } = useToast();
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 500));
  const [pageId, setPageId] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [useSampleImage, setUseSampleImage] = useState(false);
  const [lastPost, setLastPost] = useState<{
    headline: string;
    postId: string;
    pageId?: string;
    usedSampleImage?: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const posts = useMemo(() => {
    return Array.from({ length: 3 }, (_, index) =>
      buildMockFacebookPost(seed + index)
    );
  }, [seed]);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedPhoto(file);
  };

  const clearPhoto = () => {
    setSelectedPhoto(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const postMutation = useMutation({
    mutationFn: async (payload: FacebookPostPayload) => {
      const formData = new FormData();
      formData.append("content", payload.body);

      if (pageId.trim()) {
        formData.append("pageId", pageId.trim());
      }

      if (selectedPhoto) {
        formData.append("photo", selectedPhoto);
      } else if (useSampleImage) {
        formData.append("useSampleImage", "true");
      }

      const response = await fetch("/api/facebook/post", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Failed to post to Facebook");
      }

      return data as FacebookPostResponse;
    },
    onSuccess: (data, variables) => {
      setLastPost({
        headline: variables.headline,
        postId: data.postId,
        pageId: data.pageId,
        usedSampleImage: data.usedSampleImage,
      });
      toast({
        title: "Facebook post sent",
        description: data.message || "Check your Page feed to verify.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Facebook post failed",
        description: error.message || "Unable to post mock content.",
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg">Facebook Quick Test Posts</CardTitle>
          <p className="text-sm text-muted-foreground">
            Send a fast update to your connected Facebook Page.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSeed(Math.floor(Math.random() * 500))}
          aria-label="Refresh mock posts"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="facebook-page-id">
                Facebook Page ID (optional)
              </Label>
              <Input
                id="facebook-page-id"
                placeholder="6158..."
                value={pageId}
                onChange={(event) => setPageId(event.target.value)}
                disabled={postMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to use your saved Page from the Facebook connect
                flow.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="facebook-photo">Optional photo upload</Label>
              <Input
                ref={fileInputRef}
                id="facebook-photo"
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                disabled={postMutation.isPending}
              />
              {selectedPhoto && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Selected: {selectedPhoto.name} (
                    {(selectedPhoto.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={clearPhoto}
                    disabled={postMutation.isPending}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="facebook-sample-image"
              checked={useSampleImage}
              onCheckedChange={setUseSampleImage}
              disabled={postMutation.isPending || !!selectedPhoto}
            />
            <Label
              htmlFor="facebook-sample-image"
              className="text-sm text-muted-foreground"
            >
              Use RealtyFlow sample listing photo
            </Label>
          </div>
        </div>
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
                onClick={() => postMutation.mutate(post)}
                disabled={postMutation.isPending}
              >
                <Send className="mr-2 h-4 w-4" />
                {postMutation.isPending ? "Posting..." : "Post to Facebook"}
              </Button>
            </div>
            <Textarea
              value={post.body}
              readOnly
              className="min-h-[140px] text-sm"
            />
          </div>
        ))}
        {lastPost && (
          <div className="rounded-md border border-border bg-muted/50 p-4 text-sm">
            <p className="font-medium">
              Last post:{" "}
              <span className="font-semibold">{lastPost.headline}</span>
            </p>
            <div className="mt-2 space-y-1">
              <p>Post ID: {lastPost.postId}</p>
              {lastPost.pageId && <p>Page ID: {lastPost.pageId}</p>}
              {lastPost.usedSampleImage && (
                <p className="text-muted-foreground">
                  ✅ Used RealtyFlow sample image
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
