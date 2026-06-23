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
import { ComplianceChecker } from "@/components/shared/compliance-checker";
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
  Mail,
  Copy,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBusinessType } from "@/lib/businessContext";
import { getIndustryContent } from "@shared/industryContent";
import { Hash } from "lucide-react";

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
  email: { icon: Mail, color: "text-emerald-600", label: "Email" },
};

const ALWAYS_AVAILABLE_PLATFORMS = ["email"];

export function PostComposer({ open, onOpenChange }: PostComposerProps) {
  const { businessType } = useBusinessType();
  const industryContent = getIndustryContent(businessType);
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
  const [aiTopic, setAiTopic] = useState("");
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
      // Parse the error message for platform-specific issues
      let errorTitle = "Publishing Failed";
      let errorDescription = error.message || "Failed to publish post";
      
      // Check for TikTok-specific errors
      if (errorDescription.toLowerCase().includes("tiktok")) {
        errorTitle = "TikTok Posting Failed";
        if (errorDescription.includes("verified domain")) {
          errorDescription = "TikTok requires domain verification for video posts. Please verify your domain in the TikTok Developer Portal first.";
        } else if (errorDescription.includes("video")) {
          errorDescription = "TikTok requires a video file to post. Please attach a video from your Media Library.";
        } else if (errorDescription.includes("expired") || errorDescription.includes("authentication")) {
          errorDescription = "Your TikTok connection has expired. Please reconnect your TikTok account in Settings.";
        }
      }
      
      // Check for multi-platform partial failure
      if (errorDescription.includes("Posted to 0")) {
        errorTitle = "No Posts Published";
        errorDescription = "None of the selected platforms were able to publish. Please check your account connections and try again.";
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
    },
  });

  const aiGenerateMutation = useMutation({
    mutationFn: async (topic: string) => {
      const hasEmail = selectedPlatforms.includes("email");
      const contentType = hasEmail ? "email_campaign" : "social_media_post";
      const emailPrompt = hasEmail
        ? "Format the output as an email marketing message. Start with 'Subject: ' on the first line followed by the subject line, then a blank line, then the email body with a professional greeting, compelling content, and a clear call-to-action."
        : "";
      const response = await apiRequest("POST", "/api/content/generate", {
        type: contentType,
        topic: topic || "marketing content",
        aiPrompt: emailPrompt || undefined,
      });
      return await response.json();
    },
    onSuccess: (data: any) => {
      if (data.content) {
        setPostText(data.content);
        toast({ title: "Content Generated!", description: "AI-generated content has been added to your post" });
      }
    },
    onError: () => {
      toast({ title: "Generation Failed", description: "Failed to generate content. Please try again.", variant: "destructive" });
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

  // Check if TikTok is selected without a video
  const tiktokNeedsVideo = selectedPlatforms.includes("tiktok") && 
    (!selectedMedia.type || selectedMedia.type !== "video" || !selectedMedia.url);

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

    // TikTok requires a video - show specific error
    if (tiktokNeedsVideo) {
      toast({
        title: "TikTok Requires Video",
        description: "TikTok doesn't support text-only posts. Please attach a video from your Media Library, or remove TikTok from selected platforms.",
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
      email: 10000,
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

              <div className="flex items-center gap-2">
                <Input
                  placeholder={selectedPlatforms.includes("email") ? "Enter topic for email content..." : "Enter topic to generate with AI..."}
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  className="flex-1"
                  data-testid="input-ai-topic"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => aiGenerateMutation.mutate(aiTopic)}
                  disabled={aiGenerateMutation.isPending}
                  data-testid="button-ai-generate"
                >
                  {aiGenerateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-1.5" />
                  )}
                  {selectedPlatforms.includes("email") ? "Generate Email" : "AI Assist"}
                </Button>
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Suggested Hashtags</span>
                </div>
                <div
                  className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin"
                  data-testid="hashtag-suggestions"
                >
                  {industryContent.hashtags.map((tag) => {
                    const isUsed = postText.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                          isUsed
                            ? "bg-primary/15 text-primary border border-primary/30"
                            : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-transparent"
                        }`}
                        onClick={() => {
                          if (!isUsed) {
                            const separator = postText.endsWith(" ") || postText === "" ? "" : " ";
                            setPostText(postText + separator + tag);
                          }
                        }}
                        disabled={isUsed}
                        data-testid={`hashtag-chip-${tag.replace("#", "")}`}
                      >
                        {tag}
                        {isUsed && <CheckCircle className="ml-1 h-3 w-3" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {postText.trim().length > 10 && (
                <ComplianceChecker
                  content={postText}
                  platform={selectedPlatforms[0] || "general"}
                  hasMedia={!!selectedMedia.id}
                  hasVideo={selectedMedia.type === "video"}
                  onContentFix={(fixedContent) => setPostText(fixedContent)}
                  showGuidelines={true}
                />
              )}

              <div>
                <Label>Select Platforms</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                  {Object.entries(platformIcons).map(([platform, config]) => {
                    const Icon = config.icon;
                    const isAlwaysAvailable = ALWAYS_AVAILABLE_PLATFORMS.includes(platform);
                    const isConnected = isAlwaysAvailable || connectedPlatforms.includes(platform);
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

                {/* TikTok Video Requirement Warning */}
                {tiktokNeedsVideo && (
                  <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg text-sm text-orange-700 dark:text-orange-300 flex items-start gap-2" data-testid="warning-tiktok-video">
                    <Video className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">TikTok requires a video</p>
                      <p className="mt-1">TikTok doesn't support text-only posts. Go to the "Attach Media" tab and select a video from your library, or remove TikTok from your selected platforms.</p>
                    </div>
                  </div>
                )}
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
                      const isEmail = platform === "email";
                      const emailSubject = isEmail && postText ? (postText.match(/^Subject:\s*(.+?)(?:\n|$)/i)?.[1] || "") : "";
                      const emailBody = isEmail && postText ? postText.replace(/^Subject:\s*.+?\n?/i, "").trim() : postText;

                      return (
                        <div
                          key={platform}
                          className="border rounded-lg p-4"
                          data-testid={`preview-${platform}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center">
                              <Icon className={`h-5 w-5 mr-2 ${config.color}`} />
                              <span className="font-semibold">{config.label}</span>
                            </div>
                            {isEmail && postText && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (navigator.clipboard?.writeText) {
                                    navigator.clipboard.writeText(postText).then(() => {
                                      toast({ title: "Copied!", description: "Email content copied to clipboard" });
                                    }).catch(() => {
                                      toast({ title: "Copy Failed", description: "Please select and copy the text manually", variant: "destructive" });
                                    });
                                  } else {
                                    toast({ title: "Copy Failed", description: "Please select and copy the text manually", variant: "destructive" });
                                  }
                                }}
                                data-testid="button-copy-email"
                              >
                                <Copy className="h-3.5 w-3.5 mr-1.5" />
                                Copy
                              </Button>
                            )}
                          </div>

                          {isEmail && emailSubject && (
                            <div className="mb-3 p-2.5 bg-muted/50 rounded-md border" data-testid="email-subject-preview">
                              <span className="text-xs font-medium text-muted-foreground">Subject:</span>
                              <p className="font-semibold text-sm mt-0.5">{emailSubject}</p>
                            </div>
                          )}

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
                            {(isEmail ? emailBody : postText) || (
                              <span className="text-muted-foreground italic">
                                {isEmail ? "Write your email content. Start with \"Subject: Your Subject\" on the first line..." : "Your post content will appear here..."}
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
