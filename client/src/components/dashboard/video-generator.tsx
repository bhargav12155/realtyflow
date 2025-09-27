import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AvatarCreator } from "./avatar-creator";
import { OmahaVideoTemplates } from "./omaha-video-templates";
import { ObjectUploader } from "@/components/ObjectUploader";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Play, 
  Video, 
  Edit2, 
  Upload,
  User,
  Clock,
  Youtube,
  Wand2,
  Camera,
  FileVideo,
  Sparkles,
  X,
  Eye
} from "lucide-react";

interface Avatar {
  id: string;
  name: string;
  description: string;
  style: string;
  gender: string;
  isActive: boolean;
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
  { value: "youtube", label: "YouTube", icon: "🎥", description: "Long-form educational content (1-10 minutes)" },
  { value: "reels", label: "Reels", icon: "📱", description: "Short vertical videos (15-90 seconds)" },
  { value: "story", label: "Story", icon: "📸", description: "Quick updates & behind-the-scenes (15 seconds)" },
];

const neighborhoods = [
  "Dundee", "Aksarben", "Old Market", "Blackstone", "Benson"
];

export function VideoGenerator() {
  const [selectedAvatar, setSelectedAvatar] = useState<string>("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoTopic, setVideoTopic] = useState("");
  const [selectedNeighborhood, setSelectedNeighborhood] = useState("");
  const [selectedVideoType, setSelectedVideoType] = useState("");
  const [selectedVideoPlatform, setSelectedVideoPlatform] = useState("youtube");
  const [duration, setDuration] = useState("60");
  const [generatedScript, setGeneratedScript] = useState("");
  const [editingVideo, setEditingVideo] = useState<VideoContent | null>(null);
  const [watchingVideo, setWatchingVideo] = useState<VideoContent | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<string | null>(null);
  const [uploadVideoTitle, setUploadVideoTitle] = useState("");
  const [uploadVideoDescription, setUploadVideoDescription] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: avatars } = useQuery<Avatar[]>({
    queryKey: ["/api/avatars"],
  });

  const { data: videos } = useQuery<VideoContent[]>({
    queryKey: ["/api/videos"],
    refetchInterval: 30000, // Refresh every 30 seconds for status updates
  });

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

  const createVideoMutation = useMutation({
    mutationFn: async (videoData: any) => {
      const response = await apiRequest("POST", "/api/videos", videoData);
      return response.json();
    },
    onSuccess: (newVideo) => {
      toast({
        title: "Video Created!",
        description: "Your video project has been created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
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
    mutationFn: async ({ videoId, topic, neighborhood, videoType, duration }: any) => {
      const response = await apiRequest("POST", `/api/videos/${videoId}/generate-script`, {
        topic,
        neighborhood,
        videoType,
        duration: parseInt(duration)
      });
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedScript(data.script);
      toast({
        title: "Script Generated!",
        description: "AI has created your video script",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
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
    mutationFn: async ({ videoId, avatarId }: { videoId: string; avatarId: string }) => {
      const response = await apiRequest("POST", `/api/videos/${videoId}/generate-video`, {
        avatarId
      });
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
      const response = await apiRequest("POST", `/api/videos/${videoId}/upload-youtube`, {
        title,
        description,
        tags,
        privacy: "public"
      });
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

    createVideoMutation.mutate({
      title: videoTitle,
      script: generatedScript || `This is a video about ${videoTopic}`,
      topic: videoTopic,
      neighborhood: selectedNeighborhood || null,
      videoType: selectedVideoType || "market_update",
      platform: selectedVideoPlatform,
      duration: parseInt(duration),
      avatarId: selectedAvatar || null,
      tags: ["OmahaRealEstate", "RealEstate", selectedNeighborhood, selectedVideoType, selectedVideoPlatform].filter(Boolean),
      status: "draft"
    });
  };

  const handleGenerateScript = (videoId: string) => {
    generateScriptMutation.mutate({
      videoId,
      topic: videoTopic,
      neighborhood: selectedNeighborhood,
      videoType: selectedVideoType,
      platform: selectedVideoPlatform,
      duration
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-100 text-gray-700";
      case "ready": return "bg-green-100 text-green-700";
      case "generating": return "bg-blue-100 text-blue-700 animate-pulse";
      case "uploaded": return "bg-purple-100 text-purple-700";
      case "failed": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "draft": return <Edit2 className="h-3 w-3" />;
      case "ready": return <Play className="h-3 w-3" />;
      case "generating": return <Wand2 className="h-3 w-3" />;
      case "uploaded": return <Youtube className="h-3 w-3" />;
      case "failed": return <X className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
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
        <Tabs defaultValue="templates" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="templates">Omaha Templates</TabsTrigger>
            <TabsTrigger value="create">Create Custom</TabsTrigger>
            <TabsTrigger value="upload">Upload Video</TabsTrigger>
            <TabsTrigger value="avatars">AI Avatars</TabsTrigger>
            <TabsTrigger value="manage">Manage Videos</TabsTrigger>
          </TabsList>
          
          <TabsContent value="templates" className="space-y-4">
            <OmahaVideoTemplates />
          </TabsContent>
          
          <TabsContent value="upload" className="space-y-4">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Upload Your Own Video</h3>
                <p className="text-sm text-muted-foreground">
                  Upload your existing real estate videos to manage and share them through the platform
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
                      <Label htmlFor="upload-video-title" className="text-sm font-medium">Video Title</Label>
                      <Input
                        id="upload-video-title"
                        value={uploadVideoTitle}
                        onChange={(e) => setUploadVideoTitle(e.target.value)}
                        placeholder="e.g., Virtual Tour of Dundee Home"
                        data-testid="input-upload-video-title"
                      />
                    </div>
                    <div>
                      <Label htmlFor="upload-video-description" className="text-sm font-medium">Description</Label>
                      <Input
                        id="upload-video-description"
                        value={uploadVideoDescription}
                        onChange={(e) => setUploadVideoDescription(e.target.value)}
                        placeholder="Brief description of your video"
                        data-testid="input-upload-video-description"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <p className="text-sm text-green-600 font-medium">Video uploaded successfully!</p>
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
                          // Handle saving the uploaded video
                          toast({
                            title: "Video Saved!",
                            description: "Your uploaded video has been added to your video library",
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
                    maxFileSize={104857600} // 100MB for video files
                    onGetUploadParameters={async () => {
                      const response = await apiRequest("POST", "/api/objects/upload", {});
                      const data = await response.json();
                      return {
                        method: "PUT" as const,
                        url: data.uploadURL,
                      };
                    }}
                    onComplete={(uploadedFileUrl: string) => {
                      // Convert Google Cloud Storage URL to local /objects/ endpoint
                      const fileName = uploadedFileUrl.split('/').pop();
                      const localVideoUrl = `/objects/${fileName}`;
                      setUploadedVideo(localVideoUrl);
                      toast({
                        title: "Video Uploaded",
                        description: "Your video is ready! Add a title and description below.",
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
                          Supports MP4, MOV, AVI files up to 100MB
                        </p>
                      </div>
                    </div>
                  </ObjectUploader>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="avatars" className="space-y-4">
            <AvatarCreator />
          </TabsContent>
          
          <TabsContent value="create" className="space-y-4">
            {/* Avatar Selection */}
            <div>
              <Label htmlFor="avatar-select" className="text-sm font-medium">Select Your Avatar</Label>
              <Select onValueChange={setSelectedAvatar} data-testid="select-avatar">
                <SelectTrigger>
                  <SelectValue placeholder="Choose an avatar that looks like you" />
                </SelectTrigger>
                <SelectContent>
                  {avatars?.map((avatar) => (
                    <SelectItem key={avatar.id} value={avatar.id}>
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4" />
                        <span>{avatar.name} ({avatar.style})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Video Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="video-title" className="text-sm font-medium">Video Title</Label>
                <Input
                  id="video-title"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="e.g., Why Dundee is Perfect for Families"
                  data-testid="input-video-title"
                />
              </div>
              <div>
                <Label htmlFor="video-type" className="text-sm font-medium">Video Type</Label>
                <Select onValueChange={setSelectedVideoType} data-testid="select-video-type">
                  <SelectTrigger>
                    <SelectValue placeholder="Choose video type" />
                  </SelectTrigger>
                  <SelectContent>
                    {videoTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <span>{type.icon} {type.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Video Platform */}
            <div>
              <Label htmlFor="video-platform" className="text-sm font-medium">Video Platform</Label>
              <Select onValueChange={setSelectedVideoPlatform} defaultValue="youtube" data-testid="select-video-platform">
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
                        <span className="text-xs text-muted-foreground">{platform.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="video-topic" className="text-sm font-medium">Topic/Content Focus</Label>
                <Input
                  id="video-topic"
                  value={videoTopic}
                  onChange={(e) => setVideoTopic(e.target.value)}
                  placeholder="e.g., Best family amenities in Dundee"
                  data-testid="input-video-topic"
                />
              </div>
              <div>
                <Label htmlFor="neighborhood" className="text-sm font-medium">Neighborhood (Optional)</Label>
                <Select onValueChange={setSelectedNeighborhood} data-testid="select-neighborhood">
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
              <Label htmlFor="duration" className="text-sm font-medium">Video Duration (seconds)</Label>
              <Select onValueChange={setDuration} value={duration} data-testid="select-duration">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectedVideoPlatform === "story" && (
                    <>
                      <SelectItem value="15">15 seconds - Quick update</SelectItem>
                    </>
                  )}
                  {selectedVideoPlatform === "reels" && (
                    <>
                      <SelectItem value="15">15 seconds - Quick tip</SelectItem>
                      <SelectItem value="30">30 seconds - Short explanation</SelectItem>
                      <SelectItem value="60">60 seconds - Detailed overview</SelectItem>
                      <SelectItem value="90">90 seconds - Full explanation</SelectItem>
                    </>
                  )}
                  {selectedVideoPlatform === "youtube" && (
                    <>
                      <SelectItem value="60">1 minute - Quick overview</SelectItem>
                      <SelectItem value="120">2 minutes - Detailed explanation</SelectItem>
                      <SelectItem value="180">3 minutes - Comprehensive guide</SelectItem>
                      <SelectItem value="300">5 minutes - In-depth analysis</SelectItem>
                      <SelectItem value="600">10 minutes - Complete tutorial</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Generated Script Display */}
            {generatedScript && (
              <div>
                <Label className="text-sm font-medium">Generated Script Preview</Label>
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
                disabled={createVideoMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="button-create-video"
              >
                <FileVideo className="mr-2 h-4 w-4" />
                {createVideoMutation.isPending ? "Creating..." : "Create Video Project"}
              </Button>

              {videoTopic && (
                <Button
                  onClick={() => handleGenerateScript("temp")}
                  disabled={generateScriptMutation.isPending}
                  variant="outline"
                  data-testid="button-generate-script"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {generateScriptMutation.isPending ? "Generating..." : "Generate AI Script"}
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="manage" className="space-y-4">
            {videos?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Video className="mx-auto h-8 w-8 mb-2" />
                <p>No videos created yet</p>
                <p className="text-xs">Switch to "Create New Video" tab to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {videos?.map((video) => (
                  <div key={video.id} className="p-4 border rounded-lg" data-testid={`video-${video.id}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium">{video.title}</h3>
                        <p className="text-sm text-muted-foreground">{video.topic}</p>
                        {video.neighborhood && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            📍 {video.neighborhood}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={`text-xs ${getStatusColor(video.status)}`}>
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
                          onClick={() => generateVideoMutation.mutate({ 
                            videoId: video.id, 
                            avatarId: selectedAvatar || video.avatarId || "" 
                          })}
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
                          onClick={() => uploadToYoutubeMutation.mutate({
                            videoId: video.id,
                            title: video.title,
                            description: `${video.topic} - Your Omaha Real Estate Expert`,
                            tags: video.tags
                          })}
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
                          onClick={() => window.open(video.youtubeUrl!, "_blank")}
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
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Watch Video Modal */}
      <Dialog open={watchingVideo !== null} onOpenChange={() => setWatchingVideo(null)}>
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
                  <h3 className="text-lg font-semibold">{watchingVideo.title}</h3>
                  <p className="text-sm text-muted-foreground">{watchingVideo.topic}</p>
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
                    <p className="text-sm opacity-75">The video may still be processing</p>
                  </div>
                )}
              </div>

              {/* Video Actions */}
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                {watchingVideo.videoUrl && watchingVideo.status !== "uploaded" && (
                  <Button
                    onClick={() => {
                      // Call upload to YouTube mutation
                      setWatchingVideo(null);
                      // You can trigger the upload from here if needed
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Youtube className="mr-2 h-4 w-4" />
                    Upload to YouTube
                  </Button>
                )}
                
                {watchingVideo.youtubeUrl && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(watchingVideo.youtubeUrl!, "_blank")}
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