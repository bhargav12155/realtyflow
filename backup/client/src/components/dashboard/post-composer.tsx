import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Facebook,
  Instagram,
  Linkedin,
  Music,
  Send,
  Twitter as X,
  Video,
  Eye,
  Upload,
  Sparkles,
  Image as ImageIcon,
  PlayCircle,
  User,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Avatar {
  id: string;
  name: string;
  thumbnailUrl?: string | null;
  photoUrl?: string | null;
  videoUrl?: string | null;
  status: string;
  createdAt: string;
}

interface VideoContent {
  id: string;
  title: string;
  topic: string;
  neighborhood?: string | null;
  status: string;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  duration?: string | null;
  tags?: string[];
  createdAt: string;
}

interface PostComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const platformIcons = {
  facebook: { icon: Facebook, color: "text-blue-600", label: "Facebook" },
  instagram: { icon: Instagram, color: "text-pink-600", label: "Instagram" },
  linkedin: { icon: Linkedin, color: "text-blue-700", label: "LinkedIn" },
  x: { icon: X, color: "text-black dark:text-white", label: "X (Twitter)" },
  tiktok: { icon: Music, color: "text-red-500", label: "TikTok" },
  youtube: { icon: Video, color: "text-red-600", label: "YouTube" },
};

export function PostComposer({ open, onOpenChange }: PostComposerProps) {
  const [postText, setPostText] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<{
    type: "avatar" | "video" | null;
    id: string | null;
    url: string | null;
    thumbnailUrl: string | null;
  }>({
    type: null,
    id: null,
    url: null,
    thumbnailUrl: null,
  });
  const [activeTab, setActiveTab] = useState("compose");
  const [showAvatarCreator, setShowAvatarCreator] = useState(false);
  const [showVideoCreator, setShowVideoCreator] = useState(false);
  const { toast } = useToast();

  // Fetch social accounts
  const { data: socialAccounts } = useQuery<any[]>({
    queryKey: ["/api/social/accounts"],
  });

  // Fetch avatars
  const { data: avatars } = useQuery<Avatar[]>({
    queryKey: ["/api/avatars"],
  });

  // Fetch videos
  const { data: videos } = useQuery<VideoContent[]>({
    queryKey: ["/api/videos"],
  });

  // Get connected platforms
  const connectedPlatforms =
    socialAccounts?.filter((acc) => acc.isConnected).map((acc) => acc.platform) ||
    [];

  // Post mutation
  const postMutation = useMutation({
    mutationFn: async (postData: {
      text: string;
      platforms: string[];
      mediaType?: string;
      mediaId?: string;
    }) => {
      const response = await apiRequest("POST", "/api/social/post", postData);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Post Published!",
        description: `Your post has been published to ${selectedPlatforms.length} platform(s)`,
      });
      // Reset form
      setPostText("");
      setSelectedPlatforms([]);
      setSelectedMedia({ type: null, id: null, url: null, thumbnailUrl: null });
      setActiveTab("compose");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Publishing Failed",
        description: error.message || "Failed to publish post",
        variant: "destructive",
      });
    },
  });

  const handleMediaSelect = (
    type: "avatar" | "video",
    id: string,
    url: string | null,
    thumbnailUrl: string | null,
  ) => {
    setSelectedMedia({ type, id, url, thumbnailUrl });
    setActiveTab("preview");
  };

  const handlePublish = () => {
    if (!postText.trim()) {
      toast({
        title: "Missing Content",
        description: "Please write some text for your post",
        variant: "destructive",
      });
      return;
    }

    if (selectedPlatforms.length === 0) {
      toast({
        title: "No Platforms Selected",
        description: "Please select at least one platform to post to",
        variant: "destructive",
      });
      return;
    }

    if (hasExceededLimit) {
      const exceededPlatforms = selectedPlatforms.filter(
        (p) => postText.length > getCharacterLimit(p)
      );
      toast({
        title: "Character Limit Exceeded",
        description: `Your post exceeds the character limit for: ${exceededPlatforms.join(", ")}. Please shorten your message.`,
        variant: "destructive",
      });
      return;
    }

    postMutation.mutate({
      text: postText,
      platforms: selectedPlatforms,
      mediaType: selectedMedia.type || undefined,
      mediaId: selectedMedia.id || undefined,
    });
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform],
    );
  };

  const getCharacterLimit = (platform: string): number => {
    const limits: Record<string, number> = {
      x: 280,
      facebook: 63206,
      linkedin: 3000,
      instagram: 2200,
      youtube: 5000,
      tiktok: 2200,
    };
    return limits[platform] || 5000;
  };

  const remainingChars = selectedPlatforms.length > 0
    ? Math.min(
        ...selectedPlatforms.map(
          (p) => getCharacterLimit(p) - postText.length,
        ),
      )
    : 5000;

  const hasExceededLimit = selectedPlatforms.length > 0 && remainingChars < 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Create Post</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="compose" data-testid="tab-compose">
              <Sparkles className="mr-2 h-4 w-4" />
              Compose
            </TabsTrigger>
            <TabsTrigger value="media" data-testid="tab-media">
              <ImageIcon className="mr-2 h-4 w-4" />
              Attach Media
            </TabsTrigger>
            <TabsTrigger value="create" data-testid="tab-create">
              <PlayCircle className="mr-2 h-4 w-4" />
              Create New
            </TabsTrigger>
            <TabsTrigger value="preview" data-testid="tab-preview">
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          {/* Compose Tab */}
          <TabsContent value="compose" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="post-text">Post Content</Label>
                <Textarea
                  id="post-text"
                  placeholder="Write your post here..."
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  rows={8}
                  className="resize-none"
                  data-testid="input-post-text"
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm text-muted-foreground">
                    {postText.length} characters
                  </span>
                  {selectedPlatforms.length > 0 && (
                    <span
                      className={`text-sm ${hasExceededLimit ? "text-red-500 font-semibold" : remainingChars < 50 ? "text-yellow-500" : "text-muted-foreground"}`}
                    >
                      {remainingChars} remaining
                    </span>
                  )}
                </div>
                {hasExceededLimit && (
                  <div className="mt-2 p-3 bg-red-50 dark:bg-red-950 rounded-lg text-sm text-red-600 dark:text-red-400 flex items-center">
                    <XCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                    Your post exceeds the character limit for{" "}
                    {selectedPlatforms
                      .filter((p) => postText.length > getCharacterLimit(p))
                      .join(", ")}
                    . Please shorten your message.
                  </div>
                )}
              </div>

              <div>
                <Label>Select Platforms</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                  {Object.entries(platformIcons).map(([platform, config]) => {
                    const Icon = config.icon;
                    const isConnected = connectedPlatforms.includes(platform);
                    const isSelected = selectedPlatforms.includes(platform);

                    return (
                      <div
                        key={platform}
                        className={`flex items-center space-x-2 p-3 border rounded-lg cursor-pointer transition-all ${
                          !isConnected
                            ? "opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-900"
                            : isSelected
                              ? "border-primary bg-primary/5"
                              : "hover:border-primary/50"
                        }`}
                        onClick={() => isConnected && togglePlatform(platform)}
                        data-testid={`platform-${platform}`}
                      >
                        <Checkbox
                          checked={isSelected}
                          disabled={!isConnected}
                          data-testid={`checkbox-${platform}`}
                        />
                        <Icon className={`h-5 w-5 ${config.color}`} />
                        <span className="font-medium">{config.label}</span>
                        {!isConnected && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            Not connected
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Attach Media Tab */}
          <TabsContent value="media" className="space-y-4">
            <Tabs defaultValue="avatars" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="avatars">
                  <User className="mr-2 h-4 w-4" />
                  AI Avatars
                </TabsTrigger>
                <TabsTrigger value="videos">
                  <Video className="mr-2 h-4 w-4" />
                  AI Videos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="avatars">
                <ScrollArea className="h-[400px] pr-4">
                  {!avatars || avatars.length === 0 ? (
                    <div className="text-center py-12">
                      <User className="mx-auto h-12 w-12 text-muted-foreground" />
                      <p className="mt-2 text-muted-foreground">
                        No avatars created yet
                      </p>
                      <Button
                        className="mt-4"
                        variant="outline"
                        onClick={() => setActiveTab("create")}
                        data-testid="button-create-first-avatar"
                      >
                        Create Your First Avatar
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {avatars
                        .filter((avatar) => avatar.status === "ready")
                        .map((avatar) => (
                          <Card
                            key={avatar.id}
                            className={`cursor-pointer transition-all hover:shadow-lg ${
                              selectedMedia.id === avatar.id
                                ? "ring-2 ring-primary"
                                : ""
                            }`}
                            onClick={() =>
                              handleMediaSelect(
                                "avatar",
                                avatar.id,
                                avatar.videoUrl ?? null,
                                avatar.thumbnailUrl ?? null,
                              )
                            }
                            data-testid={`avatar-card-${avatar.id}`}
                          >
                            <CardContent className="p-4">
                              {avatar.thumbnailUrl ? (
                                <img
                                  src={avatar.thumbnailUrl}
                                  alt={avatar.name}
                                  className="w-full h-32 object-cover rounded-lg"
                                />
                              ) : (
                                <div className="w-full h-32 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                                  <User className="h-12 w-12 text-muted-foreground" />
                                </div>
                              )}
                              <p className="mt-2 font-medium text-sm truncate">
                                {avatar.name}
                              </p>
                              {selectedMedia.id === avatar.id && (
                                <Badge className="mt-2 w-full justify-center">
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  Selected
                                </Badge>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="videos">
                <ScrollArea className="h-[400px] pr-4">
                  {!videos || videos.length === 0 ? (
                    <div className="text-center py-12">
                      <Video className="mx-auto h-12 w-12 text-muted-foreground" />
                      <p className="mt-2 text-muted-foreground">
                        No videos created yet
                      </p>
                      <Button
                        className="mt-4"
                        variant="outline"
                        onClick={() => setActiveTab("create")}
                        data-testid="button-create-first-video"
                      >
                        Create Your First Video
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {videos
                        .filter((video) => video.status === "ready")
                        .map((video) => (
                          <Card
                            key={video.id}
                            className={`cursor-pointer transition-all hover:shadow-lg ${
                              selectedMedia.id === video.id
                                ? "ring-2 ring-primary"
                                : ""
                            }`}
                            onClick={() =>
                              handleMediaSelect(
                                "video",
                                video.id,
                                video.videoUrl ?? null,
                                video.thumbnailUrl ?? null,
                              )
                            }
                            data-testid={`video-card-${video.id}`}
                          >
                            <CardContent className="p-4">
                              {video.thumbnailUrl ? (
                                <div className="relative">
                                  <img
                                    src={video.thumbnailUrl}
                                    alt={video.title}
                                    className="w-full h-32 object-cover rounded-lg"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <PlayCircle className="h-12 w-12 text-white drop-shadow-lg" />
                                  </div>
                                </div>
                              ) : (
                                <div className="w-full h-32 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                                  <Video className="h-12 w-12 text-muted-foreground" />
                                </div>
                              )}
                              <p className="mt-2 font-medium text-sm truncate">
                                {video.title}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {video.topic}
                              </p>
                              {selectedMedia.id === video.id && (
                                <Badge className="mt-2 w-full justify-center">
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  Selected
                                </Badge>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Create New Tab */}
          <TabsContent value="create" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card
                className="cursor-pointer hover:shadow-lg transition-all"
                onClick={() => setShowAvatarCreator(true)}
                data-testid="card-create-avatar"
              >
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <User className="mr-2 h-6 w-6 text-primary" />
                    Create AI Avatar
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Upload a photo and voice recording to create a personalized AI
                    avatar for your videos
                  </p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:shadow-lg transition-all"
                onClick={() => setShowVideoCreator(true)}
                data-testid="card-create-video"
              >
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Video className="mr-2 h-6 w-6 text-primary" />
                    Generate AI Video
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Use your AI avatar to generate professional marketing videos
                    with custom scripts
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                💡 <strong>Tip:</strong> After creating your avatar or video, it
                will automatically appear in the "Attach Media" tab for you to
                select and attach to your post.
              </p>
            </div>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Post Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedPlatforms.length === 0 ? (
                  <div className="text-center py-8">
                    <Eye className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-2 text-muted-foreground">
                      Select platforms to see preview
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {selectedPlatforms.map((platform) => {
                      const config = platformIcons[platform as keyof typeof platformIcons];
                      const Icon = config.icon;

                      return (
                        <div
                          key={platform}
                          className="border rounded-lg p-4"
                          data-testid={`preview-${platform}`}
                        >
                          <div className="flex items-center mb-3">
                            <Icon className={`h-5 w-5 mr-2 ${config.color}`} />
                            <span className="font-semibold">{config.label}</span>
                          </div>

                          {selectedMedia.type && selectedMedia.thumbnailUrl && (
                            <div className="mb-3">
                              <img
                                src={selectedMedia.thumbnailUrl}
                                alt="Post media"
                                className="w-full max-h-64 object-contain rounded-lg bg-gray-100 dark:bg-gray-800"
                              />
                            </div>
                          )}

                          <div className="whitespace-pre-wrap text-sm">
                            {postText || (
                              <span className="text-muted-foreground italic">
                                Your post content will appear here...
                              </span>
                            )}
                          </div>

                          {postText.length > getCharacterLimit(platform) && (
                            <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded text-sm text-red-600 dark:text-red-400 flex items-center">
                              <XCircle className="h-4 w-4 mr-2" />
                              Post exceeds {platform} character limit (
                              {getCharacterLimit(platform)} chars)
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {selectedPlatforms.length > 0 && (
              <span>
                Publishing to {selectedPlatforms.length} platform(s)
                {selectedMedia.type && ` with ${selectedMedia.type}`}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePublish}
              disabled={
                postMutation.isPending ||
                !postText.trim() ||
                selectedPlatforms.length === 0 ||
                hasExceededLimit
              }
              data-testid="button-publish"
            >
              {postMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Publish Post
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Inline Avatar Creator Dialog */}
      {showAvatarCreator && (
        <Dialog open={showAvatarCreator} onOpenChange={setShowAvatarCreator}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create AI Avatar</DialogTitle>
            </DialogHeader>
            <div className="p-4">
              <p className="text-muted-foreground mb-4">
                Avatar creation feature will be embedded here. For now, please use
                the Avatar Manager tab in the main dashboard.
              </p>
              <Button
                variant="outline"
                onClick={() => setShowAvatarCreator(false)}
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Inline Video Creator Dialog */}
      {showVideoCreator && (
        <Dialog open={showVideoCreator} onOpenChange={setShowVideoCreator}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Generate AI Video</DialogTitle>
            </DialogHeader>
            <div className="p-4">
              <p className="text-muted-foreground mb-4">
                Video generation feature will be embedded here. For now, please use
                the Video Generator tab in the main dashboard.
              </p>
              <Button
                variant="outline"
                onClick={() => setShowVideoCreator(false)}
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
