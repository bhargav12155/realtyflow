import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { Camera, RefreshCw, Send } from "lucide-react";
import { useMemo, useRef, useState } from "react";

interface MockInstagramPost {
  id: string;
  caption: string;
}

interface InstagramPostResponse {
  success: boolean;
  postId: string;
  message?: string;
  usedSampleImage?: boolean;
}

const igHooks = [
  "Morning walkthrough:",
  "Design detail drop:",
  "Market check-in:",
  "Behind the scenes:",
  "Offer update:",
];

const igAngles = [
  "sun-soaked living room",
  "chef's kitchen with waterfall island",
  "spa shower with skylight",
  "backyard retreat with pergola",
  "studio-ready home office",
];

const igHashtags = [
  "#OmahaRealEstate #NebraskaHomes #MikeBjork",
  "#HomeTour #RealtorLife #HouseGoals",
  "#ListingLove #MoveToOmaha #ModernOmaha",
  "#OmahaHomes #JustListed #DreamHome",
];

function buildMockInstagramPost(seed: number): MockInstagramPost {
  const pick = <T,>(items: T[]): T => items[seed % items.length];
  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(365000 + (seed % 5) * 31000);

  const caption = [
    `${pick(igHooks)} ${pick(igAngles)} in ${price} listing.`,
    "Swipe-ready moment from today's shoot.",
    pick(igHashtags),
  ].join("\n\n");

  return {
    id: `ig-mock-${seed}`,
    caption,
  };
}

export function InstagramTestPosts() {
  const { toast } = useToast();
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 500));
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [useSampleImage, setUseSampleImage] = useState(true);
  const [lastPost, setLastPost] = useState<{
    caption: string;
    postId: string;
    usedSampleImage?: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const posts = useMemo(() => {
    return Array.from({ length: 3 }, (_, index) =>
      buildMockInstagramPost(seed + index)
    );
  }, [seed]);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedPhoto(file);
    if (file) {
      setUseSampleImage(false);
    }
  };

  const clearPhoto = () => {
    setSelectedPhoto(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const postMutation = useMutation({
    mutationFn: async (payload: MockInstagramPost) => {
      const formData = new FormData();
      formData.append("content", payload.caption);

      if (selectedPhoto) {
        formData.append("photo", selectedPhoto);
      } else if (useSampleImage) {
        formData.append("useSampleImage", "true");
      }

      const response = await fetch("/api/instagram/post", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Failed to post to Instagram");
      }

      return data as InstagramPostResponse;
    },
    onSuccess: (data, variables) => {
      setLastPost({
        caption: variables.caption,
        postId: data.postId,
        usedSampleImage: data.usedSampleImage,
      });
      toast({
        title: "Instagram post sent",
        description: data.message || "Check Instagram within a few minutes.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Instagram post failed",
        description: error.message || "Unable to post mock content.",
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg">Instagram Quick Test Posts</CardTitle>
          <p className="text-sm text-muted-foreground">
            Ship a caption plus photo to your Instagram Business account.
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
          <div className="space-y-1">
            <Label htmlFor="instagram-photo">
              Upload square photo (optional)
            </Label>
            <Input
              ref={fileInputRef}
              id="instagram-photo"
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              disabled={postMutation.isPending}
            />
            {selectedPhoto ? (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Selected: {selectedPhoto.name} (
                  {(selectedPhoto.size / (1024 * 1024)).toFixed(2)} MB)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => {
                    clearPhoto();
                    setUseSampleImage(true);
                  }}
                  disabled={postMutation.isPending}
                >
                  Clear
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No image handy? Leave it blank and we'll use the RealtyFlow
                sample photo.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="instagram-sample-image"
              checked={useSampleImage}
              onCheckedChange={(checked) => {
                setUseSampleImage(checked);
                if (checked) {
                  clearPhoto();
                }
              }}
              disabled={postMutation.isPending}
            />
            <Label
              htmlFor="instagram-sample-image"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Camera className="h-4 w-4" />
              Use RealtyFlow sample listing shot
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
                  Caption #{post.id.slice(-2)}
                </span>
              </div>
              <Button
                size="sm"
                onClick={() => postMutation.mutate(post)}
                disabled={postMutation.isPending}
              >
                <Send className="mr-2 h-4 w-4" />
                {postMutation.isPending ? "Posting..." : "Post to Instagram"}
              </Button>
            </div>
            <Textarea
              value={post.caption}
              readOnly
              className="min-h-[140px] text-sm"
            />
          </div>
        ))}
        {lastPost && (
          <div className="rounded-md border border-border bg-muted/50 p-4 text-sm">
            <p className="font-medium">Last post:</p>
            <p className="line-clamp-2 text-muted-foreground">
              {lastPost.caption}
            </p>
            <div className="mt-2 space-y-1">
              <p>Post ID: {lastPost.postId}</p>
              {lastPost.usedSampleImage ? (
                <p className="text-muted-foreground">
                  ✅ Used RealtyFlow sample image
                </p>
              ) : (
                <p className="text-muted-foreground">Custom photo uploaded</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
