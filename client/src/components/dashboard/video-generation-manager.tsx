import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Play,
  Video,
  Wand2,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Download,
  RefreshCw,
  User,
  MessageSquare,
  Mic,
  Trash2,
} from "lucide-react";

// Professional HeyGen Voices
const PROFESSIONAL_VOICES = [
  { id: "92c93dc0dff2428ab0bea258ba68f173", name: "Professional Male - Confident" },
  { id: "f577da968446491289b53bceb77e5092", name: "Professional Male - Warm" },
  { id: "73c0b6a2e29d4d38aca41454bf58c955", name: "Professional Female - Clear" },
  { id: "1c7c897eeb2d4b5fb17d3c6c70250b24", name: "Professional Female - Friendly" },
  { id: "119caed25533477ba63822d5d1552d25", name: "Neutral - Balanced" },
  { id: "9f2e8c4a7b5d4f6e8a1c3d5b7e9f2a4c", name: "Energetic - Enthusiastic" },
];

interface PhotoAvatarGroup {
  group_id: string;
  name: string;
  status: string;
  created_at: string;
  avatar_count?: number;
  looks?: Array<{
    id: string;
    image_url: string;
    status: string;
  }>;
}

interface VideoGeneration {
  video_id: string;
  status: string;
  video_url?: string;
  thumbnail_url?: string;
  error?: string;
}

export function VideoGenerationManager() {
  const [selectedAvatarGroup, setSelectedAvatarGroup] = useState<string>("");
  const [selectedAvatarLook, setSelectedAvatarLook] = useState<string>("");
  const [script, setScript] = useState("");
  const [title, setTitle] = useState("");
  const [isTestMode, setIsTestMode] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState<string>("1.0"); // Store as string for Select
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("119caed25533477ba63822d5d1552d25"); // Default: Neutral - Balanced
  const [manualVoiceId, setManualVoiceId] = useState<string>(""); // Manual Voice ID override
  const [currentVideo, setCurrentVideo] = useState<VideoGeneration | null>(
    null
  );
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [selectedLibraryVideo, setSelectedLibraryVideo] = useState<any | null>(null);
  const [showLibraryVideoDialog, setShowLibraryVideoDialog] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<{ id: string; title: string } | null>(null);

  const { toast } = useToast();

  // Fetch user's custom recorded voices from regular avatars
  const { data: customAvatarsData } = useQuery<any[]>({
    queryKey: ["/api/avatars"],
  });

  // Fetch photo avatar groups to check for custom voices
  const { data: photoAvatarGroupsData } = useQuery<{
    avatar_group_list?: any[];
  }>({
    queryKey: ["/api/photo-avatars/groups"],
  });

  // Fetch custom voices from Voice Library
  const { data: voiceLibraryVoices = [] } = useQuery<Array<{
    id: string;
    name: string;
    audioUrl: string;
    userId: string;
    createdAt: string;
  }>>({
    queryKey: ["/api/custom-voices"],
  });

  // Combine all custom voices for the voice selector
  const customVoices = [
    // Regular avatars with custom voices
    ...(customAvatarsData || [])
      .filter((avatar: any) => avatar.metadata?.hasCustomVoice && avatar.metadata?.voiceRecordingUrl)
      .map((avatar: any) => ({
        id: `custom_avatar_${avatar.id}`,
        name: `${avatar.name} (My Voice)`,
        avatarId: avatar.id,
        voiceUrl: avatar.metadata.voiceRecordingUrl,
        isCustom: true,
        type: 'avatar',
      })),
    // Photo avatar groups with custom voices (default_voice_id set)
    ...(photoAvatarGroupsData?.avatar_group_list || [])
      .filter((group: any) => group.default_voice_id && group.default_voice_id !== 'null')
      .map((group: any) => ({
        id: `custom_group_${group.id}`,
        name: `${group.name} (Group Voice)`,
        groupId: group.id,
        voiceId: group.default_voice_id,
        isCustom: true,
        type: 'photo_group',
      })),
    // Voice Library voices - standalone saved voices
    ...(voiceLibraryVoices || [])
      .filter((voice: any) => !voice.status || voice.status === 'ready') // Show ready voices and legacy voices without status
      .map((voice: any) => ({
        id: `voice_library_${voice.id}`,
        name: `${voice.name} (Voice Library)`,
        audioUrl: voice.audioUrl,
        voiceLibraryId: voice.id,
        isCustom: true,
        type: 'voice_library',
      })),
  ];

  // Fetch photo avatar groups
  // API returns an object: { avatar_group_list: [...] }
  const { data: avatarGroupsResponse, isLoading: groupsLoading } = useQuery<{
    avatar_group_list?: PhotoAvatarGroup[];
  }>({
    queryKey: ["/api/photo-avatars/groups"],
    // Smart polling: only poll when there are groups in processing state
    refetchInterval: (query) => {
      const groups = query.state.data?.avatar_group_list ?? [];
      const hasProcessing = groups.some((g: PhotoAvatarGroup) => 
        g.status === 'processing' || g.train_status === 'processing'
      );
      return hasProcessing ? 5000 : false; // Poll every 5s only when needed
    },
  });
  const avatarGroups: PhotoAvatarGroup[] =
    avatarGroupsResponse?.avatar_group_list ?? [];

  // Fetch selected group's details (metadata only)
  const { data: selectedGroupDetails } = useQuery<PhotoAvatarGroup>({
    queryKey: ["/api/photo-avatars/groups", selectedAvatarGroup],
    enabled: !!selectedAvatarGroup,
    refetchInterval: selectedAvatarGroup ? 10000 : false,
  });

  // Fetch looks for the selected group
  const { data: selectedGroupLooks, isLoading: looksLoading, isFetching: looksFetching } = useQuery<{
    avatar_list?: Array<{ id: string; image_url: string; status: string }>;
  }>({
    queryKey: ["/api/photo-avatars/groups", selectedAvatarGroup, "looks"],
    enabled: !!selectedAvatarGroup,
    refetchInterval: selectedAvatarGroup ? 7000 : false,
    staleTime: 5000, // Consider fresh for 5 seconds to reduce flicker
  });

  // Fetch ALL user videos (including processing ones)
  const { data: allVideos = [] } = useQuery<Array<{
    id: string;
    title: string;
    videoUrl: string;
    thumbnailUrl?: string;
    status: string;
    createdAt?: string;
    script?: string;
    duration?: number;
  }>>({
    queryKey: ["/api/videos"],
    // Smart polling: only poll when there are videos being processed
    refetchInterval: (query) => {
      const videos = query.state.data ?? [];
      const hasProcessing = videos.some((v: any) => 
        v.status === "processing" || v.status === "generating" || v.status === "pending"
      );
      return hasProcessing ? 5000 : false; // Poll every 5s only when needed
    },
  });

  // Separate ready and processing videos
  const completedVideos = (allVideos ?? []).filter((v: any) => 
    v.status === "ready" || v.status === "uploaded" || v.status === "completed"
  );
  const processingVideos = (allVideos ?? []).filter((v: any) => 
    v.status === "processing" || v.status === "generating" || v.status === "pending"
  );

  // Delete video mutation
  const deleteVideoMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const response = await apiRequest("DELETE", `/api/videos/${videoId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Video Deleted",
        description: "The video has been removed from your library.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      setVideoToDelete(null);
      setShowLibraryVideoDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error?.message || "Failed to delete the video",
        variant: "destructive",
      });
    },
  });

  // Generate video mutation
  const generateVideoMutation = useMutation({
    mutationFn: async (data: {
      avatarId: string;
      script: string;
      title: string;
      test: boolean;
      isTalkingPhoto?: boolean;
      voiceSpeed?: number;
      voiceId?: string;
      customVoiceAvatarId?: string;
    }) => {
      console.log("🎬 Frontend: Generating video with data:", data);
      const response = await apiRequest("POST", "/api/videos/generate", data);
      return response.json();
    },
    onSuccess: (result) => {
      console.log("✅ Frontend: Video generation started:", result);
      setCurrentVideo(result.data || result);
      setShowVideoDialog(true);
      toast({
        title: "Video Generation Started!",
        description:
          "Your AI avatar video is being created. This may take a few minutes.",
      });
    },
    onError: (error: any) => {
      console.error("❌ Frontend: Video generation failed:", error);
      toast({
        title: "Generation Failed",
        description: error?.message || "Failed to start video generation",
        variant: "destructive",
      });
    },
  });

  // Check video status mutation
  const checkStatusMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const response = await apiRequest("GET", `/api/videos/${videoId}/status`);
      return response.json();
    },
    onSuccess: (result) => {
      console.log("📊 Frontend: Video status:", result);
      setCurrentVideo((prev) => (prev ? { ...prev, ...result } : result));
    },
    onError: (error: any) => {
      console.error("❌ Frontend: Status check failed:", error);
    },
  });

  // Auto-refresh video status when dialog is open
  useEffect(() => {
    if (showVideoDialog && currentVideo?.video_id) {
      const interval = setInterval(() => {
        checkStatusMutation.mutate(currentVideo.video_id);
      }, 5000); // Check every 5 seconds

      return () => clearInterval(interval);
    }
  }, [showVideoDialog, currentVideo?.video_id]);

  const handleGenerateVideo = () => {
    if (!selectedAvatarLook) {
      toast({
        title: "No Avatar Selected",
        description: "Please select an avatar look to use for the video",
        variant: "destructive",
      });
      return;
    }

    if (!script.trim()) {
      toast({
        title: "Script Required",
        description: "Please provide a script for your avatar to speak",
        variant: "destructive",
      });
      return;
    }

    // Check if using manual Voice ID override first
    let finalVoiceId: string;
    let voiceLibraryId: string | undefined;
    let customVoiceAvatarId: string | undefined;

    if (manualVoiceId.trim()) {
      // Manual Voice ID takes priority
      finalVoiceId = manualVoiceId.trim();
      console.log("🎤 Using manual Voice ID:", finalVoiceId);
    } else {
      // Check if using a custom voice from dropdown
      const isCustomVoice = selectedVoiceId.startsWith('custom_') || selectedVoiceId.startsWith('voice_library_');
      const customVoice = isCustomVoice 
        ? customVoices.find((v: any) => v.id === selectedVoiceId)
        : null;

      // Determine the voice ID to use
      finalVoiceId = selectedVoiceId;

      if (customVoice) {
        if (customVoice.type === 'voice_library') {
          // Voice Library voice - use special marker and pass library ID
          finalVoiceId = 'voice_library';
          voiceLibraryId = customVoice.voiceLibraryId;
        } else if (customVoice.type === 'photo_group') {
          // Use the group's default voice ID directly
          finalVoiceId = customVoice.voiceId;
        } else {
          // Regular avatar custom voice - use 'custom_voice' marker
          finalVoiceId = 'custom_voice';
        }
        customVoiceAvatarId = customVoice?.avatarId;
      }
    }

    generateVideoMutation.mutate({
      avatarId: selectedAvatarLook,
      script: script.trim(),
      title: title.trim() || "AI Avatar Video",
      test: isTestMode,
      // Photo avatar looks are talking photos in HeyGen's API
      isTalkingPhoto: true,
      voiceSpeed: parseFloat(voiceSpeed),
      voiceId: finalVoiceId,
      customVoiceAvatarId,
      voiceLibraryId,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
      case "ready":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "processing":
      case "generating":
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
      case "ready":
        return "Ready";
      case "processing":
      case "generating":
        return "Generating...";
      case "failed":
        return "Failed";
      default:
        return "Pending";
    }
  };

  const selectedGroup = avatarGroups?.find(
    (g) => g.group_id === selectedAvatarGroup
  );
  const availableLooks =
    (selectedGroupLooks?.avatar_list || []).filter((look) => {
      const status = (look.status || "").toLowerCase();
      return status === "completed" || status === "ready";
    }) || [];

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-foreground flex items-center">
          <Video className="mr-2 h-5 w-5" />
          Video Generation with Photo Avatars
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Create talking videos using your trained photo avatars
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar Group Selection */}
        <div>
          <Label htmlFor="avatar-group-select" className="text-sm font-medium">
            Select Photo Avatar Group
          </Label>
          <Select
            onValueChange={setSelectedAvatarGroup}
            value={selectedAvatarGroup}
          >
            <SelectTrigger id="avatar-group-select" data-testid="select-avatar-group">
              <SelectValue placeholder="Choose a trained avatar group" />
            </SelectTrigger>
            <SelectContent>
              {groupsLoading ? (
                <SelectItem value="loading" disabled>
                  Loading...
                </SelectItem>
              ) : avatarGroups.length === 0 ? (
                <SelectItem value="no-groups" disabled>
                  No avatar groups found. Create and train a photo avatar first.
                </SelectItem>
              ) : (
                avatarGroups.map((group) => {
                  const isReady =
                    ["completed", "ready"].includes(
                      (group.status || "").toLowerCase()
                    ) || (group.avatar_count || 0) > 0;
                  const statusText =
                    (group.avatar_count || 0) > 0
                      ? `ready (${group.avatar_count})`
                      : group.status || "pending";
                  return (
                    <SelectItem
                      key={group.group_id}
                      value={group.group_id}
                      disabled={!isReady}
                    >
                      {group.name} - {statusText}
                    </SelectItem>
                  );
                })
              )}
            </SelectContent>
          </Select>
          
          {/* Avatar Group Preview */}
          {selectedGroup && (
            <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <p className="text-xs font-semibold text-gray-600 mb-3">Selected Avatar Group</p>
              <div className="flex items-center gap-4">
                {availableLooks.length > 0 && (
                  <img
                    src={(availableLooks[0] as any).image_url || (availableLooks[0] as any).image}
                    alt={selectedGroup.name}
                    className="w-16 h-16 rounded-lg object-cover border border-gray-300"
                  />
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedGroup.name}</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    {availableLooks.length} look{availableLooks.length !== 1 ? 's' : ''} available
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Avatar Look Selection */}
        {selectedAvatarGroup && (
          <div>
            <Label htmlFor="avatar-look-select" className="text-sm font-medium">
              Select Avatar Look
            </Label>
            {looksLoading ? (
              /* Loading skeletons for avatar looks */
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="border-2 rounded-lg p-2 border-muted animate-pulse"
                  >
                    <div className="w-full h-20 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 mx-auto" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-2">
                {availableLooks.map((look) => {
                  const lookId = (look as any).avatar_id || (look as any).id;
                  const imageUrl =
                    (look as any).image_url || (look as any).image || "";
                  return (
                    <div
                      key={lookId}
                      data-testid={`avatar-look-${lookId}`}
                      className={`border-2 rounded-lg p-2 cursor-pointer transition-all ${
                        selectedAvatarLook === lookId
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-primary/50"
                      }`}
                      onClick={() => setSelectedAvatarLook(lookId)}
                    >
                      <img
                        src={imageUrl}
                        alt={`Avatar look ${lookId}`}
                        className="w-full h-20 object-cover rounded mb-2"
                      />
                      <p className="text-xs text-center text-muted-foreground">
                        Look {String(lookId).slice(-4)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
            {!looksLoading && availableLooks.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                No completed avatar looks available. Training may still be in
                progress.
              </p>
            )}
          </div>
        )}

        {/* Video Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="video-title" className="text-sm font-medium">
              Video Title
            </Label>
            <Input
              id="video-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Welcome to Our Agency"
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="test-mode"
              checked={isTestMode}
              onChange={(e) => setIsTestMode(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="test-mode" className="text-sm font-medium">
              Test Mode (shorter video)
            </Label>
          </div>
        </div>

        {/* Voice Selection */}
        <div>
          <Label htmlFor="voice-select" className="text-sm font-medium flex items-center gap-2">
            <Mic className="w-4 h-4 text-[#D4AF37]" />
            Voice Selection
          </Label>
          <Select
            value={selectedVoiceId}
            onValueChange={setSelectedVoiceId}
          >
            <SelectTrigger id="voice-select" data-testid="select-voice-id">
              <SelectValue placeholder="Choose a voice" />
            </SelectTrigger>
            <SelectContent>
              {/* My Custom Voices Section */}
              {customVoices.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-[#D4AF37] bg-[#D4AF37]/10">
                    🎤 My Recorded Voices
                  </div>
                  {customVoices.map((voice: any) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {voice.name}
                    </SelectItem>
                  ))}
                  <div className="border-t my-1" />
                </>
              )}

              {/* Professional Voices Section */}
              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">
                🎭 Professional Voices
              </div>
              {PROFESSIONAL_VOICES.map((voice) => (
                <SelectItem key={voice.id} value={voice.id}>
                  {voice.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {customVoices.length === 0 && (
            <p className="text-xs text-gray-500 mt-1">
              💡 Tip: Record your voice in the Avatar Creator to use your own voice!
            </p>
          )}
        </div>

        {/* Manual Voice ID Override */}
        <div>
          <Label htmlFor="manual-voice-id" className="text-sm font-medium flex items-center gap-2">
            <Mic className="w-4 h-4 text-blue-500" />
            Voice ID Override (Optional)
          </Label>
          <Input
            id="manual-voice-id"
            data-testid="input-manual-voice-id"
            value={manualVoiceId}
            onChange={(e) => setManualVoiceId(e.target.value)}
            placeholder="e.g., 119caed25533477ba63822d5d1552d25"
            className={`font-mono text-sm ${manualVoiceId.trim() && manualVoiceId.trim().length < 32 ? 'border-yellow-500' : ''}`}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {manualVoiceId.trim() 
              ? manualVoiceId.trim().length >= 32
                ? "✓ Using manual Voice ID - dropdown selection will be ignored"
                : "⚠️ HeyGen Voice IDs are typically 32 characters"
              : "Leave empty to use dropdown selection above. Get Voice IDs from HeyGen dashboard."}
          </p>
        </div>

        {/* Voice Speed Control */}
        <div>
          <Label htmlFor="voice-speed" className="text-sm font-medium">
            Voice Speed
          </Label>
          <Select
            value={voiceSpeed}
            onValueChange={setVoiceSpeed}
          >
            <SelectTrigger id="voice-speed" data-testid="select-voice-speed">
              <SelectValue placeholder="Select voice speed" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.5">0.5x (Slow)</SelectItem>
              <SelectItem value="0.75">0.75x (Slower)</SelectItem>
              <SelectItem value="1.0">1.0x (Normal)</SelectItem>
              <SelectItem value="1.25">1.25x (Faster)</SelectItem>
              <SelectItem value="1.5">1.5x (Fast)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Script Input */}
        <div>
          <Label
            htmlFor="video-script"
            className="text-sm font-medium flex items-center"
          >
            <MessageSquare className="mr-1 h-4 w-4" />
            Script (what your avatar will say)
          </Label>
          <Textarea
            id="video-script"
            data-testid="input-video-script"
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="Enter the script for your avatar to speak. Keep it under 1500 characters for best results."
            rows={6}
            className="mt-2"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {script.length}/1500 characters
          </p>
        </div>

        {/* Generate Button */}
        <div className="flex flex-col items-center space-y-2">
          {(!selectedAvatarLook || !script.trim()) && (
            <div className="text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-md">
              {!selectedAvatarLook && !script.trim() && "⚠️ Please select an avatar look and enter a script"}
              {!selectedAvatarLook && script.trim() && "⚠️ Please select an avatar look above"}
              {selectedAvatarLook && !script.trim() && "⚠️ Please enter a script"}
            </div>
          )}
          <Button
            onClick={handleGenerateVideo}
            disabled={
              generateVideoMutation.isPending ||
              !selectedAvatarLook ||
              !script.trim()
            }
            size="lg"
            data-testid="button-generate-video"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Wand2 className="mr-2 h-5 w-5" />
            {generateVideoMutation.isPending
              ? "Starting Generation..."
              : "Generate Video"}
          </Button>
        </div>

        {/* Sample Scripts */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium mb-2">Sample Scripts</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              data-testid="button-sample-welcome"
              onClick={() =>
                setScript(
                  "Hello! I'm your local real estate expert. I'd love to help you find your dream home in Omaha. What are you looking for?"
                )
              }
            >
              Welcome Message
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-sample-market"
              onClick={() =>
                setScript(
                  "The Omaha real estate market is hot right now! Homes in desirable neighborhoods are selling quickly. Contact me today to start your home search."
                )
              }
            >
              Market Update
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-sample-consultation"
              onClick={() =>
                setScript(
                  "Looking to buy or sell in Omaha? I've helped hundreds of families find their perfect home. Let's schedule a consultation to discuss your real estate goals."
                )
              }
            >
              Agent Introduction
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setScript(
                  "Thank you for considering me as your real estate agent. I look forward to working with you to achieve your real estate dreams!"
                )
              }
            >
              Closing Message
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Video Generation Status Dialog */}
      <Dialog open={showVideoDialog} onOpenChange={setShowVideoDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Video Generation Status</DialogTitle>
            <DialogDescription>
              Your AI avatar video is being created. This process typically
              takes 2-5 minutes.
            </DialogDescription>
          </DialogHeader>

          {currentVideo && (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-center space-x-2 p-4 border rounded-lg">
                {getStatusIcon(currentVideo.status)}
                <span className="font-medium">
                  {getStatusText(currentVideo.status)}
                </span>
              </div>

              {/* Video Preview */}
              {currentVideo.video_url && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Generated Video</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <video
                      controls
                      className="w-full max-h-64"
                      src={currentVideo.video_url}
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        window.open(currentVideo.video_url, "_blank")
                      }
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      Open in New Tab
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = currentVideo.video_url!;
                        link.download = `${title || "avatar-video"}.mp4`;
                        link.click();
                      }}
                    >
                      <Download className="mr-1 h-3 w-3" />
                      Download
                    </Button>
                  </div>
                </div>
              )}

              {/* Thumbnail Preview */}
              {currentVideo.thumbnail_url && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Thumbnail Preview</Label>
                  <div className="border-2 border-[#D4AF37]/30 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
                    <img
                      src={currentVideo.thumbnail_url}
                      alt="Video thumbnail"
                      className="w-full max-h-96 object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Error Message */}
              {currentVideo.error && (
                <div className="p-3 border border-red-200 rounded-lg bg-red-50">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-700 font-medium">
                      Generation Failed
                    </span>
                  </div>
                  <p className="text-sm text-red-600 mt-1">
                    {currentVideo.error}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() =>
                    checkStatusMutation.mutate(currentVideo.video_id)
                  }
                  disabled={checkStatusMutation.isPending}
                >
                  <RefreshCw
                    className={`mr-1 h-3 w-3 ${
                      checkStatusMutation.isPending ? "animate-spin" : ""
                    }`}
                  />
                  Refresh Status
                </Button>
                <Button onClick={() => setShowVideoDialog(false)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>

    {/* Processing Videos Section */}
    {processingVideos.length > 0 && (
      <Card className="mt-6 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground flex items-center">
            <RefreshCw className="mr-2 h-5 w-5 text-blue-500 animate-spin" />
            Processing Videos
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Videos currently being generated
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {processingVideos.map((video) => (
              <div
                key={video.id}
                className="relative bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden border-2 border-blue-200 dark:border-blue-700"
                data-testid={`video-processing-${video.id}`}
              >
                {/* Thumbnail Placeholder */}
                <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                  <div className="text-center">
                    <RefreshCw className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-2" />
                    <p className="text-xs text-gray-400">Generating...</p>
                  </div>

                  {/* Status Badge */}
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs">
                      Processing
                    </Badge>
                  </div>
                </div>

                {/* Video Info */}
                <div className="p-3 space-y-2">
                  <h4 className="font-medium text-sm line-clamp-1 text-left">
                    {video.title || 'Untitled Video'}
                  </h4>
                  {video.createdAt && (
                    <p className="text-xs text-gray-500">
                      Started: {new Date(video.createdAt).toLocaleString()}
                    </p>
                  )}
                  {/* Delete Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                    onClick={() => setVideoToDelete({ id: video.id, title: video.title || 'Untitled Video' })}
                    data-testid={`button-delete-processing-${video.id}`}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Cancel & Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )}

    {/* My Generated Videos Section */}
    {completedVideos.length > 0 && (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground flex items-center">
            <Play className="mr-2 h-5 w-5 text-[#D4AF37]" />
            My Generated Videos
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Previously generated avatar videos
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {completedVideos.map((video) => (
              <div
                key={video.id}
                className="group relative bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 hover:border-[#D4AF37] transition-all"
                data-testid={`video-thumbnail-${video.id}`}
              >
                {/* Thumbnail - Clickable */}
                <button
                  onClick={() => {
                    setSelectedLibraryVideo(video);
                    setShowLibraryVideoDialog(true);
                  }}
                  className="w-full cursor-pointer"
                >
                  <div className="relative aspect-video bg-black">
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://ui-avatars.com/api/?name=Video&background=D4AF37&color=fff&size=400';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                        <Video className="w-12 h-12 text-gray-600" />
                      </div>
                    )}

                    {/* Play Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="bg-[#D4AF37] rounded-full p-3">
                        <Play className="w-6 h-6 text-white fill-white" />
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
                        Ready
                      </Badge>
                    </div>
                  </div>
                </button>

                {/* Video Info */}
                <div className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm line-clamp-1 text-left flex-1">
                      {video.title || 'Untitled Video'}
                    </h4>
                    {/* Delete Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setVideoToDelete({ id: video.id, title: video.title || 'Untitled Video' });
                      }}
                      data-testid={`button-delete-video-${video.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {video.createdAt && (
                    <p className="text-xs text-gray-500">
                      {new Date(video.createdAt).toLocaleDateString()}
                    </p>
                  )}
                  {video.duration && (
                    <p className="text-xs text-gray-500">
                      {Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, '0')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )}

    {/* Library Video Player Dialog */}
    <Dialog open={showLibraryVideoDialog} onOpenChange={setShowLibraryVideoDialog}>
      <DialogContent className="max-w-3xl p-4 gap-3">
        <DialogHeader className="pb-2">
          <DialogTitle className="font-playfair text-xl">
            {selectedLibraryVideo?.title || 'Video Preview'}
          </DialogTitle>
          <DialogDescription className="text-sm">
            Generated on {selectedLibraryVideo?.createdAt ? new Date(selectedLibraryVideo.createdAt).toLocaleDateString() : 'N/A'}
          </DialogDescription>
        </DialogHeader>

        {selectedLibraryVideo && (
          <div className="space-y-3">
            {/* Video Player - auto-sizing container */}
            <div className="flex justify-center rounded-lg overflow-hidden bg-black">
              <video
                controls
                className="max-w-full max-h-[60vh] w-auto h-auto"
                src={selectedLibraryVideo.videoUrl}
                autoPlay
              >
                Your browser does not support the video tag.
              </video>
            </div>

            {/* Video Details */}
            {selectedLibraryVideo.script && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <h4 className="text-xs font-semibold mb-1">Script</h4>
                <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-3">
                  {selectedLibraryVideo.script}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-between pt-1">
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                onClick={() => {
                  if (selectedLibraryVideo) {
                    setVideoToDelete({ id: selectedLibraryVideo.id, title: selectedLibraryVideo.title || 'Untitled Video' });
                  }
                }}
                data-testid="button-delete-library-video"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedLibraryVideo?.videoUrl) {
                      window.open(selectedLibraryVideo.videoUrl, '_blank');
                    }
                  }}
                  className="border-[#D4AF37]/30 hover:bg-[#D4AF37]/10"
                  data-testid="button-download-library-video"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowLibraryVideoDialog(false)}
                  className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={!!videoToDelete} onOpenChange={(open) => !open && setVideoToDelete(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Video?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{videoToDelete?.title}"? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700"
            onClick={() => {
              if (videoToDelete) {
                deleteVideoMutation.mutate(videoToDelete.id);
              }
            }}
            disabled={deleteVideoMutation.isPending}
          >
            {deleteVideoMutation.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
