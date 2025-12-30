import { ObjectUploader } from "@/components/ObjectUploader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Clock,
  Edit2,
  Eye,
  FileVideo,
  Hand,
  Image,
  Info,
  Play,
  Sparkles,
  Upload,
  User,
  Video,
  Wand2,
  X,
  Youtube,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { OmahaVideoTemplates } from "./omaha-video-templates";

interface Avatar {
  id: string;
  name: string;
  description: string;
  style: string;
  gender: string;
  isActive: boolean;
  supportsGestures?: boolean;
}

interface VideoContent {
  id: string;
  title: string;
  script: string;
  topic: string;
  neighborhood: string | null;
  videoType: string;
  duration: number | null;
  status: string;
  tags: string[];
  avatarId: string | null;
  videoUrl: string | null;
  youtubeUrl: string | null;
  createdAt: string;
}

const videoTypes = [
  { value: "market_update", label: "Market Update", icon: "📊" },
  { value: "neighborhood_tour", label: "Neighborhood Tour", icon: "🏘️" },
  { value: "buyer_tips", label: "Buyer Tips", icon: "💡" },
  { value: "seller_guide", label: "Seller Guide", icon: "🏠" },
  { value: "moving_guide", label: "Moving Guide", icon: "📦" },
];

const videoPlatforms = [
  {
    value: "youtube",
    label: "YouTube",
    icon: "🎥",
    description: "Long-form educational content (1-10 minutes)",
  },
  {
    value: "reels",
    label: "Reels",
    icon: "📱",
    description: "Short vertical videos (15-90 seconds)",
  },
  {
    value: "story",
    label: "Story",
    icon: "📸",
    description: "Quick updates & behind-the-scenes (15 seconds)",
  },
];

const neighborhoods = [
  "Dundee",
  "Aksarben",
  "Old Market",
  "Blackstone",
  "Benson",
];

export function VideoGenerator() {
  const [selectedAvatar, setSelectedAvatar] = useState<string>("");
  const [avatarType, setAvatarType] = useState<
    "public" | "talking_photo" | "custom"
  >("public");
  const [uploadedAvatarPhoto, setUploadedAvatarPhoto] = useState<string | null>(
    null
  );
  const [videoTitle, setVideoTitle] = useState("");
  const [videoTopic, setVideoTopic] = useState("");
  const [selectedNeighborhood, setSelectedNeighborhood] = useState("");
  const [selectedVideoType, setSelectedVideoType] = useState("");
  const [selectedVideoPlatform, setSelectedVideoPlatform] = useState("youtube");
  const [duration, setDuration] = useState("60");
  const [generatedScript, setGeneratedScript] = useState("");
  const [gestureIntensity, setGestureIntensity] = useState(0);
  const [editingVideo, setEditingVideo] = useState<VideoContent | null>(null);
  const [watchingVideo, setWatchingVideo] = useState<VideoContent | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<string | null>(null);
  const [uploadVideoTitle, setUploadVideoTitle] = useState("");
  const [uploadVideoDescription, setUploadVideoDescription] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const previousStatusesRef = useRef<Record<string, string>>({});
  const shownToastForVideoRef = useRef<Set<string>>(new Set());

  const { data: avatars } = useQuery<Avatar[]>({
    queryKey: ["/api/avatars"],
  });

  const { data: photoAvatarGroupsResponse } = useQuery({
    queryKey: ["/api/photo-avatars/groups"],
  });

  const { data: videoAvatars } = useQuery({
    queryKey: ["/api/video-avatars"],
  });

  const { data: videos } = useQuery<VideoContent[]>({
    queryKey: ["/api/videos"],
    refetchInterval: 30000, // Refresh every 30 seconds for status updates
  });

  // Combine photo avatar groups as custom avatars
  const photoAvatarGroups = photoAvatarGroupsResponse?.avatar_group_list || [];
  const readyPhotoAvatars = photoAvatarGroups.filter(
    (group: any) => group.status === "ready" && group.num_looks > 0
  );

  // Reset duration when platform changes
  useEffect(() => {
    if (selectedVideoPlatform === "story") {
      setDuration("15");
    } else if (selectedVideoPlatform === "reels") {
      setDuration("30");
    } else if (selectedVideoPlatform === "youtube") {
      setDuration("120");
    }
  }, [selectedVideoPlatform]);

  // Watch for video generation completion
  useEffect(() => {
    if (!videos) return;

    videos.forEach((video) => {
      const previousStatus = previousStatusesRef.current[video.id];
      const currentStatus = video.status;
      const alreadyShownToast = shownToastForVideoRef.current.has(video.id);

      // Detect when a video is ready (either just transitioned OR initially ready)
      const isReady = currentStatus === "ready";
      const justTransitioned = previousStatus && previousStatus !== "ready";
      const shouldShowToast =
        isReady && !alreadyShownToast && (!previousStatus || justTransitioned);

      if (shouldShowToast) {
        // Video is ready - show toast notification
        shownToastForVideoRef.current.add(video.id);

        toast({
          title: "🎉 Video Ready!",
          description: `Your video "${video.title}" has been generated successfully!`,
        });
      }

      // Update the status tracker
      previousStatusesRef.current[video.id] = currentStatus;
    });
  }, [videos, toast]);

  const createVideoMutation = useMutation({
    mutationFn: async (videoData: any) => {
      const response = await apiRequest("POST", "/api/videos", videoData);
      return response.json();
    },
    onSuccess: async (newVideo) => {
      toast({
        title: "Video Project Created!",
        description: "Now generating video with HeyGen...",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });

      // Automatically trigger video generation if avatar is selected
      if (selectedAvatar) {
        try {
          console.log("🎬 Auto-generating video:", {
            videoId: newVideo.id,
            avatarId: selectedAvatar,
            avatarType: avatarType,
            gestureIntensity: gestureIntensity,
          });

          await generateVideoMutation.mutateAsync({
            videoId: newVideo.id,
            avatarId: selectedAvatar,
            avatarType: avatarType === "custom" ? "talking_photo" : "avatar",
            uploadedAvatarPhoto: null,
            gestureIntensity: avatarType === "custom" ? gestureIntensity : 0,
          });
        } catch (error) {
          console.error("❌ Auto-generation failed:", error);
          toast({
            title: "Generation Error",
            description:
              "Video created but generation failed. Try generating manually.",
            variant: "destructive",
          });
        }
      }

      // Reset form
      setVideoTitle("");
      setVideoTopic("");
      setSelectedNeighborhood("");
      setSelectedVideoType("");
      setSelectedVideoPlatform("youtube");
      setGeneratedScript("");
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create video",
        variant: "destructive",
      });
    },
  });

  const generateScriptMutation = useMutation({
    mutationFn: async ({ topic, neighborhood, videoType, duration }: any) => {
      // Generate script via OpenAI without needing a video ID
      const response = await apiRequest("POST", "/api/generate-script", {
        topic,
        neighborhood,
        videoType,
        platform: selectedVideoPlatform,
        duration: parseInt(duration),
      });
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedScript(data.script);
      toast({
        title: "Script Generated!",
        description: "AI has created your video script",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate script",
        variant: "destructive",
      });
    },
  });

  const generateVideoMutation = useMutation({
    mutationFn: async ({
      videoId,
      avatarId,
      avatarType: type,
      uploadedAvatarPhoto: photoUrl,
      gestureIntensity: intensity,
    }: {
      videoId: string;
      avatarId?: string;
      avatarType?: string;
      uploadedAvatarPhoto?: string | null;
      gestureIntensity?: number;
    }) => {
      const response = await apiRequest(
        "POST",
        `/api/videos/${videoId}/generate-video`,
        {
          avatarId,
          avatarType: type,
          uploadedAvatarPhoto: photoUrl,
          gestureIntensity: intensity,
        }
      );
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Video Generation Started!",
        description: `Your AI video is being created. Estimated time: ${data.estimatedTime}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to start video generation",
        variant: "destructive",
      });
    },
  });

  const uploadToYoutubeMutation = useMutation({
    mutationFn: async ({ videoId, title, description, tags }: any) => {
      const response = await apiRequest(
        "POST",
        `/api/videos/${videoId}/upload-youtube`,
        {
          title,
          description,
          tags,
          privacy: "public",
        }
      );
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Uploaded to YouTube!",
        description: "Your video is now live on YouTube",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload to YouTube",
        variant: "destructive",
      });
    },
  });

  const handleCreateVideo = () => {
    if (!videoTitle || !videoTopic) {
      toast({
        title: "Missing Information",
        description: "Please provide a title and topic for your video",
        variant: "destructive",
      });
      return;
    }

    // Check avatar selection - must have either public or custom avatar
    const hasPublicAvatar = avatarType === "public" && selectedAvatar;
    const hasCustomAvatar = avatarType === "custom" && selectedAvatar;

    if (!hasPublicAvatar && !hasCustomAvatar) {
      toast({
        title: "Avatar Required",
        description: `Please select a ${
          avatarType === "public" ? "public" : "custom photo"
        } avatar to generate the video`,
        variant: "destructive",
      });
      return;
    }

    createVideoMutation.mutate({
      title: videoTitle,
      script: generatedScript || `This is a video about ${videoTopic}`,
      topic: videoTopic,
      neighborhood: selectedNeighborhood || null,
      videoType: selectedVideoType || "market_update",
      platform: selectedVideoPlatform,
      duration: parseInt(duration),
      avatarId: selectedAvatar, // This is either a public avatar ID or photo avatar group_id
      tags: [
        "OmahaRealEstate",
        "RealEstate",
        selectedNeighborhood,
        selectedVideoType,
        selectedVideoPlatform,
      ].filter(Boolean),
      status: "generating", // Send to HeyGen immediately
    });
  };

  const handleGenerateScript = () => {
    if (!videoTopic) {
      toast({
        title: "Topic Required",
        description: "Please enter a topic for your video",
        variant: "destructive",
      });
      return;
    }

    generateScriptMutation.mutate({
      topic: videoTopic,
      neighborhood: selectedNeighborhood,
      videoType: selectedVideoType,
      duration,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-700";
      case "ready":
        return "bg-green-100 text-green-700";
      case "generating":
        return "bg-blue-100 text-blue-700 animate-pulse";
      case "uploaded":
        return "bg-purple-100 text-purple-700";
      case "failed":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "draft":
        return <Edit2 className="h-3 w-3" />;
      case "ready":
        return <Play className="h-3 w-3" />;
      case "generating":
        return <Wand2 className="h-3 w-3" />;
      case "uploaded":
        return <Youtube className="h-3 w-3" />;
      case "failed":
        return <X className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-foreground flex items-center">
          <Camera className="mr-2 h-5 w-5" />
          AI Video Generator
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Create professional real estate videos with AI avatars for YouTube
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Quick Navigation Buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const element = document.getElementById("templates-section");
                element?.scrollIntoView({ behavior: "smooth" });
              }}
              data-testid="button-templates"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Templates
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const element = document.getElementById("custom-creation");
                element?.scrollIntoView({ behavior: "smooth" });
              }}
              data-testid="button-manual-creation"
            >
              <Edit2 className="mr-2 h-4 w-4" />
              Manual Creation
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const element = document.getElementById("upload-section");
                element?.scrollIntoView({ behavior: "smooth" });
              }}
              data-testid="button-upload-video"
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Video
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const element = document.getElementById("manage-videos");
                element?.scrollIntoView({ behavior: "smooth" });
              }}
              data-testid="button-manage-videos"
            >
              <Video className="mr-2 h-4 w-4" />
              Manage Videos
            </Button>
          </div>

          {/* Video Templates - Top Section */}
          <div
            id="templates-section"
            className="border rounded-lg p-6 bg-gradient-to-r from-primary/5 to-purple-500/5 scroll-mt-4"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Quick Start: Choose a Template
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Select a pre-designed template and customize it for instant
                  video creation
                </p>
              </div>
            </div>
            <OmahaVideoTemplates />
          </div>

          {/* Manual Creation Section */}
          <div
            id="custom-creation"
            className="border rounded-lg p-6 scroll-mt-4"
          >
            <div className="mb-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-primary" />
                Or Create Custom Video
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Build your video from scratch with full control over every
                detail
              </p>
            </div>

            <div className="space-y-4">
              {/* Avatar Selection with Three Options */}
              <div className="space-y-4">
                <Label className="text-sm font-medium">
                  Choose Avatar Type
                </Label>

                {/* Informational Alert */}
                <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertTitle className="text-blue-900 dark:text-blue-100">
                    Avatar Animation Options
                  </AlertTitle>
                  <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                    Choose how your avatar will move:
                    <ul className="mt-2 space-y-1 list-disc list-inside">
                      <li>
                        <strong>Public Avatars</strong>: Professional lip-sync
                        only (quick & easy)
                      </li>
                      <li>
                        <strong>Talking Photo</strong>: Upload your photo for
                        subtle head/body movements
                      </li>
                      <li>
                        <strong>Custom Avatar</strong>: Film yourself with
                        gestures for hand movements & full animation
                      </li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <Tabs
                  value={avatarType}
                  onValueChange={(value) => setAvatarType(value as any)}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger
                      value="public"
                      className="flex items-center gap-2"
                      data-testid="tab-public-avatar"
                    >
                      <User className="h-4 w-4" />
                      Public
                    </TabsTrigger>
                    <TabsTrigger
                      value="talking_photo"
                      className="flex items-center gap-2"
                      data-testid="tab-talking-photo"
                    >
                      <Image className="h-4 w-4" />
                      Photo
                    </TabsTrigger>
                    <TabsTrigger
                      value="custom"
                      className="flex items-center gap-2"
                      data-testid="tab-custom-avatar"
                    >
                      <Hand className="h-4 w-4" />
                      Custom
                    </TabsTrigger>
                    <TabsTrigger
                      value="video_avatar"
                      className="flex items-center gap-2"
                    >
                      <Video className="h-4 w-4" />
                      Video
                    </TabsTrigger>
                  </TabsList>

                  {/* Public Avatars Tab */}
                  <TabsContent value="public" className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Professional avatars with accurate lip-sync. Perfect for
                        quick professional videos.
                      </p>
                      <Select
                        onValueChange={setSelectedAvatar}
                        value={selectedAvatar}
                        data-testid="select-avatar"
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a public avatar" />
                        </SelectTrigger>
                        <SelectContent>
                          {avatars
                            ?.filter((a) => !a.description?.includes("custom"))
                            ?.map((avatar) => (
                              <SelectItem key={avatar.id} value={avatar.id}>
                                <div className="flex items-center space-x-2">
                                  <User className="h-4 w-4" />
                                  <span>
                                    {avatar.name} ({avatar.style})
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>

                  {/* Talking Photo Tab */}
                  <TabsContent value="talking_photo" className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Upload a photo to create an AI avatar with subtle head
                        and body movements. Great for personalized content.
                      </p>
                      <div className="border-2 border-dashed rounded-lg p-6 text-center">
                        {uploadedAvatarPhoto ? (
                          <div className="space-y-3">
                            <div className="relative inline-block">
                              <img
                                src={uploadedAvatarPhoto}
                                alt="Avatar preview"
                                className="w-32 h-32 rounded-full object-cover mx-auto"
                              />
                              <Button
                                variant="destructive"
                                size="icon"
                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                                onClick={() => setUploadedAvatarPhoto(null)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                              Photo uploaded! Your talking photo avatar is
                              ready.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <Camera className="h-12 w-12 mx-auto text-muted-foreground" />
                            <div>
                              <p className="font-medium">Upload Your Photo</p>
                              <p className="text-sm text-muted-foreground">
                                For best results: Clear headshot, well-lit,
                                neutral background
                              </p>
                            </div>
                            <ObjectUploader
                              acceptedFileTypes="image/*"
                              onGetUploadParameters={async () => {
                                const response = await apiRequest(
                                  "GET",
                                  "/api/upload/signed-url?fileType=image/jpeg"
                                );
                                const data = await response.json();
                                return {
                                  method: "PUT" as const,
                                  url: data.url,
                                };
                              }}
                              onComplete={(url: string) => {
                                setUploadedAvatarPhoto(url);
                                toast({
                                  title: "Photo Uploaded!",
                                  description:
                                    "Your talking photo avatar is ready to use.",
                                });
                              }}
                              data-testid="upload-avatar-photo"
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Choose Photo
                            </ObjectUploader>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  {/* Custom Avatar Tab - Show photo avatars */}
                  <TabsContent value="custom" className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Use custom photo avatars you've created with full
                        gesture support and body movements.
                      </p>

                      {readyPhotoAvatars.length > 0 ? (
                        <div className="space-y-3">
                          <Select
                            onValueChange={setSelectedAvatar}
                            value={selectedAvatar}
                            data-testid="select-custom-avatar"
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a custom photo avatar" />
                            </SelectTrigger>
                            <SelectContent>
                              {readyPhotoAvatars.map((group: any) => (
                                <SelectItem
                                  key={group.group_id}
                                  value={group.group_id}
                                >
                                  <div className="flex items-center space-x-2">
                                    <Hand className="h-4 w-4 text-purple-600" />
                                    <span>
                                      {group.name} ({group.num_looks} looks) ✨
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            {readyPhotoAvatars.length} custom photo avatar
                            {readyPhotoAvatars.length !== 1 ? "s" : ""}{" "}
                            available • ✨ = Gesture support
                          </p>
                        </div>
                      ) : (
                        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <AlertTitle className="text-blue-900 dark:text-blue-100">
                            No Custom Avatars Yet
                          </AlertTitle>
                          <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                            Create a custom photo avatar in the "Photo Avatar"
                            tab to use gesture-enabled avatars with hand
                            movements and body animation.
                          </AlertDescription>
                        </Alert>
                      )}

                      <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 mt-4">
                        <Hand className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <AlertTitle className="text-amber-900 dark:text-amber-100">
                          Gesture Support
                        </AlertTitle>
                        <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                          Custom photo avatars support natural hand gestures and
                          body movements. Use the gesture intensity slider below
                          to control animation level.
                        </AlertDescription>
                      </Alert>
                    </div>
                  </TabsContent>

                  {/* Video Avatar Tab */}
                  <TabsContent value="video_avatar" className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-3">
                        High-fidelity video avatars created from training
                        footage (Enterprise feature)
                      </p>
                      {videoAvatars && videoAvatars.length > 0 ? (
                        <div className="space-y-3">
                          <Select
                            onValueChange={setSelectedAvatar}
                            value={selectedAvatar}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a video avatar" />
                            </SelectTrigger>
                            <SelectContent>
                              {videoAvatars
                                .filter((va: any) => va.status === "complete")
                                .map((avatar: any) => (
                                  <SelectItem
                                    key={avatar.heygenAvatarId}
                                    value={avatar.heygenAvatarId}
                                  >
                                    <div className="flex items-center space-x-2">
                                      <Video className="h-4 w-4" />
                                      <span>{avatar.avatarName}</span>
                                      <Badge
                                        variant="secondary"
                                        className="ml-2 text-xs"
                                      >
                                        Video Avatar
                                      </Badge>
                                    </div>
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            {
                              videoAvatars.filter(
                                (va: any) => va.status === "complete"
                              ).length
                            }{" "}
                            video avatar
                            {videoAvatars.filter(
                              (va: any) => va.status === "complete"
                            ).length !== 1
                              ? "s"
                              : ""}{" "}
                            available
                          </p>
                        </div>
                      ) : (
                        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <AlertTitle className="text-blue-900 dark:text-blue-100">
                            No Video Avatars Yet
                          </AlertTitle>
                          <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                            Create a video avatar from training footage in the
                            "Video Avatars" section. Video avatars provide the
                            most realistic and high-fidelity results.
                          </AlertDescription>
                        </Alert>
                      )}

                      <Alert className="bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800 mt-4">
                        <Video className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        <AlertTitle className="text-purple-900 dark:text-purple-100">
                          Enterprise Feature
                        </AlertTitle>
                        <AlertDescription className="text-purple-800 dark:text-purple-200 text-sm">
                          Video avatars are created from 2+ minutes of training
                          footage and provide the highest quality, most
                          realistic results with natural gestures and
                          expressions.
                        </AlertDescription>
                      </Alert>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Gesture Controls - Show for custom avatars or gesture-enabled public avatars */}
              {(() => {
                const selectedAvatarData = avatars?.find(
                  (a) => a.id === selectedAvatar
                );
                const showGestureControls =
                  avatarType === "custom" ||
                  selectedAvatarData?.supportsGestures;

                if (!showGestureControls) return null;

                return (
                  <div className="space-y-3 border rounded-lg p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
                    <div className="flex items-center gap-2">
                      <Hand className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <Label className="text-base font-semibold text-purple-900 dark:text-purple-100">
                        Gesture & Expressiveness Controls
                      </Label>
                      <Badge
                        variant="secondary"
                        className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100"
                      >
                        Gesture-Enabled
                      </Badge>
                    </div>

                    <p className="text-sm text-purple-800 dark:text-purple-200">
                      Control how animated and expressive your avatar will be.
                      Higher values add more natural hand gestures and body
                      movements.
                    </p>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium text-purple-900 dark:text-purple-100">
                          Gesture Intensity
                        </Label>
                        <span className="text-sm font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900 px-3 py-1 rounded-full">
                          {gestureIntensity === 0
                            ? "Off"
                            : gestureIntensity === 1
                            ? "Subtle"
                            : gestureIntensity === 2
                            ? "Moderate"
                            : "Expressive"}
                        </span>
                      </div>

                      <Slider
                        min={0}
                        max={3}
                        step={1}
                        value={[gestureIntensity]}
                        onValueChange={(value) => setGestureIntensity(value[0])}
                        className="cursor-pointer"
                        data-testid="slider-gesture-intensity"
                      />

                      <div className="flex justify-between text-xs text-purple-700 dark:text-purple-300 mt-1">
                        <span>Off</span>
                        <span>Subtle</span>
                        <span>Moderate</span>
                        <span>Expressive</span>
                      </div>
                    </div>

                    <Alert className="bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800">
                      <Info className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <AlertDescription className="text-purple-800 dark:text-purple-200 text-xs">
                        <strong>How it works:</strong> Gesture intensity
                        controls how frequently and prominently your avatar uses
                        hand movements and body language. "Off" = traditional
                        lip-sync only. "Expressive" = maximum natural gestures
                        and movements.
                      </AlertDescription>
                    </Alert>
                  </div>
                );
              })()}

              {/* Video Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="video-title" className="text-sm font-medium">
                    Video Title
                  </Label>
                  <Input
                    id="video-title"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    placeholder="e.g., Why Dundee is Perfect for Families"
                    data-testid="input-video-title"
                  />
                </div>
                <div>
                  <Label htmlFor="video-type" className="text-sm font-medium">
                    Video Type
                  </Label>
                  <Select
                    onValueChange={setSelectedVideoType}
                    data-testid="select-video-type"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose video type" />
                    </SelectTrigger>
                    <SelectContent>
                      {videoTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <span>
                            {type.icon} {type.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Video Platform */}
              <div>
                <Label htmlFor="video-platform" className="text-sm font-medium">
                  Video Platform
                </Label>
                <Select
                  onValueChange={setSelectedVideoPlatform}
                  defaultValue="youtube"
                  data-testid="select-video-platform"
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {videoPlatforms.map((platform) => (
                      <SelectItem key={platform.value} value={platform.value}>
                        <div className="flex flex-col items-start">
                          <span className="flex items-center gap-2">
                            <span>{platform.icon}</span>
                            <span>{platform.label}</span>
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {platform.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="video-topic" className="text-sm font-medium">
                    Topic/Content Focus
                  </Label>
                  <Input
                    id="video-topic"
                    value={videoTopic}
                    onChange={(e) => setVideoTopic(e.target.value)}
                    placeholder="e.g., Best family amenities in Dundee"
                    data-testid="input-video-topic"
                  />
                </div>
                <div>
                  <Label htmlFor="neighborhood" className="text-sm font-medium">
                    Neighborhood (Optional)
                  </Label>
                  <Select
                    onValueChange={setSelectedNeighborhood}
                    data-testid="select-neighborhood"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select neighborhood" />
                    </SelectTrigger>
                    <SelectContent>
                      {neighborhoods.map((neighborhood) => (
                        <SelectItem key={neighborhood} value={neighborhood}>
                          {neighborhood}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="duration" className="text-sm font-medium">
                  Video Duration (seconds)
                </Label>
                <Select
                  onValueChange={setDuration}
                  value={duration}
                  data-testid="select-duration"
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedVideoPlatform === "story" && (
                      <>
                        <SelectItem value="15">
                          15 seconds - Quick update
                        </SelectItem>
                      </>
                    )}
                    {selectedVideoPlatform === "reels" && (
                      <>
                        <SelectItem value="15">
                          15 seconds - Quick tip
                        </SelectItem>
                        <SelectItem value="30">
                          30 seconds - Short explanation
                        </SelectItem>
                        <SelectItem value="60">
                          60 seconds - Detailed overview
                        </SelectItem>
                        <SelectItem value="90">
                          90 seconds - Full explanation
                        </SelectItem>
                      </>
                    )}
                    {selectedVideoPlatform === "youtube" && (
                      <>
                        <SelectItem value="60">
                          1 minute - Quick overview
                        </SelectItem>
                        <SelectItem value="120">
                          2 minutes - Detailed explanation
                        </SelectItem>
                        <SelectItem value="180">
                          3 minutes - Comprehensive guide
                        </SelectItem>
                        <SelectItem value="300">
                          5 minutes - In-depth analysis
                        </SelectItem>
                        <SelectItem value="600">
                          10 minutes - Complete tutorial
                        </SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Generated Script Display */}
              {generatedScript && (
                <div>
                  <Label className="text-sm font-medium">
                    Generated Script Preview
                  </Label>
                  <Textarea
                    value={generatedScript}
                    onChange={(e) => setGeneratedScript(e.target.value)}
                    rows={6}
                    className="mt-2"
                    placeholder="AI-generated script will appear here..."
                    data-testid="textarea-script"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleCreateVideo}
                  disabled={
                    createVideoMutation.isPending ||
                    generateVideoMutation.isPending
                  }
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  data-testid="button-create-video"
                >
                  <FileVideo className="mr-2 h-4 w-4" />
                  {createVideoMutation.isPending
                    ? "Creating & Generating..."
                    : generateVideoMutation.isPending
                    ? "Sending to HeyGen..."
                    : "Create & Generate Video"}
                </Button>

                {videoTopic && (
                  <Button
                    onClick={handleGenerateScript}
                    disabled={generateScriptMutation.isPending}
                    variant="outline"
                    data-testid="button-generate-script"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    {generateScriptMutation.isPending
                      ? "Generating..."
                      : "Generate AI Script"}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Upload Section */}
          <div
            id="upload-section"
            className="border rounded-lg p-6 scroll-mt-4"
          >
            <div className="mb-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Upload Your Own Video
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Upload your existing real estate videos to manage and share them
                through the platform
              </p>
            </div>

            {uploadedVideo ? (
              <div className="space-y-4">
                <div className="border rounded-lg overflow-hidden">
                  <video
                    controls
                    className="w-full max-h-64"
                    data-testid="uploaded-video-preview"
                  >
                    <source src={uploadedVideo} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label
                      htmlFor="upload-video-title"
                      className="text-sm font-medium"
                    >
                      Video Title
                    </Label>
                    <Input
                      id="upload-video-title"
                      value={uploadVideoTitle}
                      onChange={(e) => setUploadVideoTitle(e.target.value)}
                      placeholder="e.g., Virtual Tour of Dundee Home"
                      data-testid="input-upload-video-title"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="upload-video-description"
                      className="text-sm font-medium"
                    >
                      Description
                    </Label>
                    <Input
                      id="upload-video-description"
                      value={uploadVideoDescription}
                      onChange={(e) =>
                        setUploadVideoDescription(e.target.value)
                      }
                      placeholder="Brief description of your video"
                      data-testid="input-upload-video-description"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <p className="text-sm text-green-600 font-medium">
                    Video uploaded successfully!
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setUploadedVideo(null);
                        setUploadVideoTitle("");
                        setUploadVideoDescription("");
                      }}
                      data-testid="button-remove-video"
                    >
                      Remove Video
                    </Button>
                    <Button
                      onClick={() => {
                        toast({
                          title: "Video Saved!",
                          description:
                            "Your uploaded video has been added to your video library",
                        });
                        setUploadedVideo(null);
                        setUploadVideoTitle("");
                        setUploadVideoDescription("");
                      }}
                      data-testid="button-save-uploaded-video"
                    >
                      Save to Library
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={209715200}
                  acceptedFileTypes="video/*"
                  onGetUploadParameters={async () => {
                    const response = await apiRequest(
                      "POST",
                      "/api/objects/upload",
                      {}
                    );
                    const data = await response.json();
                    return {
                      method: "PUT" as const,
                      url: data.uploadURL,
                    };
                  }}
                  onComplete={(uploadedFileUrl: string) => {
                    const fileName = uploadedFileUrl.split("/").pop();
                    const localVideoUrl = `/objects/${fileName}`;
                    setUploadedVideo(localVideoUrl);
                    toast({
                      title: "Video Uploaded",
                      description:
                        "Your video is ready! Add a title and description below.",
                    });
                  }}
                  buttonClassName="w-full min-h-32"
                >
                  <div className="flex flex-col items-center justify-center gap-3 py-8">
                    <div className="p-3 rounded-full bg-muted">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium">Upload Video File</p>
                      <p className="text-sm text-muted-foreground">
                        Supports MP4, MOV, WEBM, MKV (up to 200MB)
                      </p>
                    </div>
                  </div>
                </ObjectUploader>
              </div>
            )}
          </div>

          {/* Manage Videos Section */}
          <div id="manage-videos" className="border rounded-lg p-6 scroll-mt-4">
            <div className="mb-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Video className="h-5 w-5 text-primary" />
                Manage Your Videos
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                View and manage all your created videos
              </p>
            </div>

            {videos?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Video className="mx-auto h-8 w-8 mb-2" />
                <p>No videos created yet</p>
                <p className="text-xs">
                  Use the templates or manual creation above to get started
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {videos?.map((video) => (
                  <div
                    key={video.id}
                    className="p-4 border rounded-lg"
                    data-testid={`video-${video.id}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium">{video.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {video.topic}
                        </p>
                        {video.neighborhood && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            📍 {video.neighborhood}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge
                          className={`text-xs ${getStatusColor(video.status)}`}
                        >
                          {getStatusIcon(video.status)}
                          {video.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3">
                      {video.status === "draft" && (
                        <Button
                          size="sm"
                          onClick={() => handleGenerateScript(video.id)}
                          disabled={generateScriptMutation.isPending}
                          data-testid={`generate-script-${video.id}`}
                        >
                          <Wand2 className="mr-1 h-3 w-3" />
                          Generate Script
                        </Button>
                      )}

                      {video.status === "ready" && (
                        <Button
                          size="sm"
                          onClick={() => {
                            // Validate tab-specific requirements
                            if (avatarType === "public" && !selectedAvatar) {
                              toast({
                                title: "Avatar Required",
                                description:
                                  "Please select a public avatar before generating the video.",
                                variant: "destructive",
                              });
                              return;
                            }
                            if (
                              avatarType === "talking_photo" &&
                              !uploadedAvatarPhoto
                            ) {
                              toast({
                                title: "Photo Required",
                                description:
                                  "Please upload a photo before generating the video.",
                                variant: "destructive",
                              });
                              return;
                            }
                            if (avatarType === "custom") {
                              toast({
                                title: "Custom Avatar Not Yet Available",
                                description:
                                  "Custom gesture-enabled avatars must be created on HeyGen platform first. Once created, they'll appear in the Public Avatars tab.",
                                variant: "destructive",
                              });
                              return;
                            }

                            generateVideoMutation.mutate({
                              videoId: video.id,
                              avatarId:
                                avatarType === "public"
                                  ? selectedAvatar || video.avatarId || ""
                                  : undefined,
                              avatarType,
                              uploadedAvatarPhoto:
                                avatarType === "talking_photo"
                                  ? uploadedAvatarPhoto
                                  : undefined,
                              gestureIntensity,
                            });
                          }}
                          disabled={generateVideoMutation.isPending}
                          data-testid={`generate-video-${video.id}`}
                        >
                          <Play className="mr-1 h-3 w-3" />
                          Generate Video
                        </Button>
                      )}

                      {video.videoUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setWatchingVideo(video)}
                          data-testid={`watch-video-${video.id}`}
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          Watch Video
                        </Button>
                      )}

                      {video.videoUrl && video.status !== "uploaded" && (
                        <Button
                          size="sm"
                          onClick={() =>
                            uploadToYoutubeMutation.mutate({
                              videoId: video.id,
                              title: video.title,
                              description: `${video.topic} - Your Omaha Real Estate Expert`,
                              tags: video.tags,
                            })
                          }
                          disabled={uploadToYoutubeMutation.isPending}
                          className="bg-red-600 hover:bg-red-700 text-white"
                          data-testid={`upload-youtube-${video.id}`}
                        >
                          <Youtube className="mr-1 h-3 w-3" />
                          Upload to YouTube
                        </Button>
                      )}

                      {video.youtubeUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            window.open(video.youtubeUrl!, "_blank")
                          }
                          data-testid={`view-youtube-${video.id}`}
                        >
                          <Youtube className="mr-1 h-3 w-3" />
                          View on YouTube
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>

      {/* Watch Video Modal */}
      <Dialog
        open={watchingVideo !== null}
        onOpenChange={() => setWatchingVideo(null)}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Preview Video</DialogTitle>
            <DialogDescription>
              Watch your generated video before posting or uploading to YouTube.
            </DialogDescription>
          </DialogHeader>
          {watchingVideo && (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">
                    {watchingVideo.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {watchingVideo.topic}
                  </p>
                  {watchingVideo.neighborhood && (
                    <Badge variant="outline" className="mt-2">
                      📍 {watchingVideo.neighborhood}
                    </Badge>
                  )}
                </div>
                <Badge className={`${getStatusColor(watchingVideo.status)}`}>
                  {getStatusIcon(watchingVideo.status)}
                  {watchingVideo.status}
                </Badge>
              </div>

              {/* Video Player */}
              <div className="bg-gray-900 rounded-lg p-6 text-center">
                {watchingVideo.videoUrl ? (
                  <video
                    controls
                    className="w-full max-h-96 rounded-lg"
                    data-testid={`video-player-${watchingVideo.id}`}
                  >
                    <source src={watchingVideo.videoUrl} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="py-12 text-white">
                    <Video className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>Video URL not available</p>
                    <p className="text-sm opacity-75">
                      The video may still be processing
                    </p>
                  </div>
                )}
              </div>

              {/* Video Actions */}
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                {watchingVideo.videoUrl &&
                  watchingVideo.status !== "uploaded" && (
                    <Button
                      onClick={() => {
                        uploadToYoutubeMutation.mutate({
                          videoId: watchingVideo.id,
                          title: watchingVideo.title,
                          description: watchingVideo.topic,
                          tags: watchingVideo.tags,
                        });
                      }}
                      disabled={uploadToYoutubeMutation.isPending}
                      className="bg-red-600 hover:bg-red-700 text-white"
                      data-testid={`upload-youtube-modal-${watchingVideo.id}`}
                    >
                      <Youtube className="mr-2 h-4 w-4" />
                      {uploadToYoutubeMutation.isPending
                        ? "Uploading..."
                        : "Upload to YouTube"}
                    </Button>
                  )}

                {watchingVideo.youtubeUrl && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      window.open(watchingVideo.youtubeUrl!, "_blank")
                    }
                  >
                    <Youtube className="mr-2 h-4 w-4" />
                    View on YouTube
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() => setWatchingVideo(null)}
                >
                  Close Preview
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
