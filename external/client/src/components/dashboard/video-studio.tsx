import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, downloadFile } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CheckCircle,
  Clock,
  Download,
  Film,
  Image,
  Loader2,
  Mic,
  Play,
  Plus,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Video,
  Volume2,
  Wand2,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ComplianceChecker } from "@/components/shared/compliance-checker";

interface StudioAvatar {
  id: string;
  name: string;
  type: "preset" | "photo" | "custom";
  previewUrl?: string;
  thumbnailUrl?: string;
  isMotion?: boolean;
  motionPreviewUrl?: string;
  imageKey?: string; // For Avatar IV API
}

interface VideoStatus {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

interface SavedVideo {
  id: string;
  title: string;
  script: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  status: string;
  platform?: string;
  createdAt?: string;
  metadata?: any;
}

type Step = 1 | 2 | 3;
type View = "create" | "videos";

export function VideoStudio() {
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<View>("create");
  const [step, setStep] = useState<Step>(1);
  const [selectedAvatar, setSelectedAvatar] = useState<string>("");
  const [selectedImageKey, setSelectedImageKey] = useState<string>(""); // For Avatar IV API
  const [avatarType, setAvatarType] = useState<"avatar" | "talking_photo">("avatar");
  const [topic, setTopic] = useState("");
  const [script, setScript] = useState("");
  const [title, setTitle] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [avatarName, setAvatarName] = useState("");
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [selectedVideoForPlay, setSelectedVideoForPlay] = useState<SavedVideo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [voiceInputMode, setVoiceInputMode] = useState<"tts" | "record" | "upload">("tts");
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [customAudioUrl, setCustomAudioUrl] = useState<string>("");
  const [customAudioFile, setCustomAudioFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string>("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [hoveredAvatarId, setHoveredAvatarId] = useState<string | null>(null);
  const [debouncedScript, setDebouncedScript] = useState("");

  // Debounce script for compliance checker - only update after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedScript(script);
    }, 1000);
    return () => clearTimeout(timer);
  }, [script]);

  const { data: avatarsData, isLoading: avatarsLoading, refetch: refetchAvatars } = useQuery<{ avatars: StudioAvatar[] }>({
    queryKey: ["/api/studio/avatars"],
  });

  const { data: voicesData } = useQuery<{ voices: Array<{ voice_id: string; name: string }> }>({
    queryKey: ["/api/studio/voices"],
  });

  // Memoize voice options to prevent 2500+ items re-rendering on every keystroke
  const voiceOptions = useMemo(() => {
    return voicesData?.voices?.map((voice) => (
      <SelectItem key={voice.voice_id} value={voice.voice_id}>
        {voice.name}
      </SelectItem>
    )) || [];
  }, [voicesData]);

  const { data: savedVideosData, isLoading: videosLoading, refetch: refetchVideos } = useQuery<{ videos: SavedVideo[] }>({
    queryKey: ["/api/studio/videos"],
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("name", avatarName || "My Avatar");
      
      const res = await fetch("/api/studio/avatars", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.details || error.error || "Failed to upload");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSelectedAvatar(data.avatar.id);
      setSelectedImageKey(data.avatar.imageKey || data.avatar.id); // Avatar IV uses imageKey
      setAvatarType("talking_photo");
      setUploadPreview(null);
      setAvatarName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      refetchAvatars();
      toast({
        title: "Avatar Created!",
        description: "Your custom avatar is ready to use.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Avatar Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateScriptMutation = useMutation({
    mutationFn: async (topic: string) => {
      const res = await apiRequest("POST", "/api/studio/script", { topic, type: "marketing" });
      return res.json();
    },
    onSuccess: (data) => {
      setScript(data.script);
      toast({
        title: "Script Generated!",
        description: "Your AI-powered script is ready. Feel free to edit it.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Script Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateVideoMutation = useMutation({
    mutationFn: async () => {
      let audioUrl = "";
      if (voiceInputMode === "record" && recordedBlob) {
        const formData = new FormData();
        formData.append("audio", recordedBlob, "recording.webm");
        const uploadRes = await fetch("/api/kling/upload-audio", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!uploadRes.ok) throw new Error("Failed to upload audio");
        const uploadData = await uploadRes.json();
        audioUrl = uploadData.audioUrl;
      } else if (voiceInputMode === "upload" && customAudioFile) {
        const formData = new FormData();
        formData.append("audio", customAudioFile);
        const uploadRes = await fetch("/api/kling/upload-audio", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!uploadRes.ok) throw new Error("Failed to upload audio");
        const uploadData = await uploadRes.json();
        audioUrl = uploadData.audioUrl;
      }

      const res = await apiRequest("POST", "/api/studio/generate", {
        avatarId: selectedAvatar,
        imageKey: selectedImageKey || undefined, // Only pass imageKey if it's a valid Avatar IV key
        avatarType,
        script,
        title: title || topic || "My Video",
        aspectRatio,
        voiceMode: voiceInputMode,
        voiceId: voiceInputMode === "tts" ? selectedVoice : undefined,
        audioUrl: voiceInputMode !== "tts" ? audioUrl : undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setVideoId(data.videoId);
      setIsPolling(true);
      toast({
        title: "Video Generation Started!",
        description: "Your video is being created. This typically takes 3-5 minutes.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Video Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);

  const deleteVideoMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const res = await apiRequest("DELETE", `/api/videos/${videoId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Video Deleted",
        description: "The video has been removed from your library.",
      });
      refetchVideos();
      setDeletingVideoId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
      setDeletingVideoId(null);
    },
  });

  const handleDeleteVideo = (videoId: string) => {
    setDeletingVideoId(videoId);
    deleteVideoMutation.mutate(videoId);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getRecordingErrorMessage = (error: any): { title: string; description: string } => {
    const errorName = error?.name || "";
    const errorMessage = error?.message || "";
    
    console.error("Recording error details:", {
      name: errorName,
      message: errorMessage,
      toString: error?.toString?.() || "N/A"
    });

    switch (errorName) {
      case "NotAllowedError":
        return {
          title: "Microphone Access Denied",
          description: "Please allow microphone access: Click the lock/info icon in your browser's address bar, find 'Microphone', set it to 'Allow', then refresh the page."
        };
      case "NotFoundError":
        return {
          title: "No Microphone Found",
          description: "No microphone was detected. Please connect a microphone and try again."
        };
      case "NotReadableError":
        return {
          title: "Microphone In Use",
          description: "Your microphone may be in use by another application. Close other apps using the mic and try again."
        };
      case "OverconstrainedError":
        return {
          title: "Microphone Error",
          description: "The microphone settings are not supported. Try using a different microphone."
        };
      case "SecurityError":
        return {
          title: "Security Error",
          description: "Microphone access is blocked due to security settings. Make sure you're using HTTPS."
        };
      case "AbortError":
        return {
          title: "Recording Aborted",
          description: "The recording was aborted. Please try again."
        };
      default:
        return {
          title: "Recording Failed",
          description: errorMessage || `Could not access microphone (${errorName || "unknown error"}). Make sure you've granted microphone permission.`
        };
    }
  };

  const checkMicrophonePermission = async (): Promise<"granted" | "denied" | "prompt" | "unsupported"> => {
    try {
      if (!navigator.permissions || !navigator.permissions.query) {
        return "unsupported";
      }
      const result = await navigator.permissions.query({ name: "microphone" as PermissionName });
      return result.state as "granted" | "denied" | "prompt";
    } catch {
      return "unsupported";
    }
  };

  const startRecording = async () => {
    try {
      const permissionStatus = await checkMicrophonePermission();
      console.log("Microphone permission status:", permissionStatus);
      
      if (permissionStatus === "denied") {
        toast({
          title: "Microphone Access Blocked",
          description: "Microphone permission is blocked. Click the lock/info icon in your browser's address bar, find 'Microphone', set it to 'Allow', then refresh the page.",
          variant: "destructive",
        });
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error: any) {
      const { title, description } = getRecordingErrorMessage(error);
      toast({
        title,
        description,
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const clearRecording = () => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedBlob(null);
    setRecordedUrl("");
    setRecordingTime(0);
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCustomAudioFile(file);
      setCustomAudioUrl(URL.createObjectURL(file));
    }
  };

  const { data: videoStatus } = useQuery<VideoStatus>({
    queryKey: ["/api/studio/status", videoId],
    enabled: !!videoId && isPolling,
    refetchInterval: isPolling ? 5000 : false,
  });

  useEffect(() => {
    if (videoStatus?.status === "completed" || videoStatus?.status === "failed") {
      setIsPolling(false);
      if (videoStatus.status === "completed") {
        toast({
          title: "Video Ready!",
          description: "Your video has been generated successfully.",
        });
      } else if (videoStatus.status === "failed") {
        toast({
          title: "Video Generation Failed",
          description: videoStatus.error || "An error occurred",
          variant: "destructive",
        });
      }
    }
  }, [videoStatus, toast]);

  // Set default voice when voices data loads
  useEffect(() => {
    if (voicesData?.voices?.length && !selectedVoice) {
      setSelectedVoice(voicesData.voices[0].voice_id);
    }
  }, [voicesData, selectedVoice]);

  // Load script from Template Studio if available
  useEffect(() => {
    const templateScript = localStorage.getItem("templateScript");
    const templateTitle = localStorage.getItem("templateTitle");
    
    if (templateScript) {
      setScript(templateScript);
      localStorage.removeItem("templateScript");
      
      if (templateTitle) {
        setTitle(templateTitle);
        localStorage.removeItem("templateTitle");
      }
      
      // Stay on step 1 (avatar selection) - script is pre-filled for step 2
      toast({
        title: "Script Loaded",
        description: "Your template script is ready. Select an avatar to continue.",
      });
    }
  }, [toast]);

  const handleGenerateScript = () => {
    if (!topic.trim()) {
      toast({
        title: "Topic Required",
        description: "Please enter a topic to generate a script.",
        variant: "destructive",
      });
      return;
    }
    generateScriptMutation.mutate(topic);
  };

  const handleGenerateVideo = () => {
    if (!selectedAvatar) {
      toast({
        title: "Avatar Required",
        description: "Please select an avatar first.",
        variant: "destructive",
      });
      setStep(1);
      return;
    }
    
    // Script is required for TTS mode
    if (voiceInputMode === "tts" && !script.trim()) {
      toast({
        title: "Script Required",
        description: "Please enter or generate a script for text-to-speech.",
        variant: "destructive",
      });
      return;
    }
    
    // Audio is required for record/upload modes (check blob/file, not URL)
    if (voiceInputMode === "record" && !recordedBlob) {
      toast({
        title: "Recording Required",
        description: "Please record your voice first.",
        variant: "destructive",
      });
      return;
    }
    
    if (voiceInputMode === "upload" && !customAudioFile) {
      toast({
        title: "Audio Required",
        description: "Please upload an audio file first.",
        variant: "destructive",
      });
      return;
    }
    
    generateVideoMutation.mutate();
  };

  const resetStudio = () => {
    setStep(1);
    setSelectedAvatar("");
    setSelectedImageKey(""); // Reset Avatar IV imageKey
    setTopic("");
    setScript("");
    setTitle("");
    setVideoId(null);
    setIsPolling(false);
    refetchVideos();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Unknown date";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
      case "completed":
        return <Badge className="bg-green-500" data-testid="badge-status-ready">Ready</Badge>;
      case "generating":
      case "processing":
        return <Badge className="bg-yellow-500" data-testid="badge-status-processing">Processing</Badge>;
      case "failed":
        return <Badge className="bg-red-500" data-testid="badge-status-failed">Failed</Badge>;
      default:
        return <Badge variant="secondary" data-testid="badge-status-unknown">{status}</Badge>;
    }
  };

  const avatars = avatarsData?.avatars || [];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Video Studio</h1>
        <p className="text-muted-foreground">Create AI avatar videos in 3 simple steps</p>
      </div>

      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as View)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="create" data-testid="tab-create">
            <Plus className="w-4 h-4 mr-2" /> Create Video
          </TabsTrigger>
          <TabsTrigger value="videos" data-testid="tab-my-videos">
            <Film className="w-4 h-4 mr-2" /> My Videos
            {savedVideosData?.videos && savedVideosData.videos.length > 0 && (
              <Badge variant="secondary" className="ml-2">{savedVideosData.videos.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-4">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
                      step >= s
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                    data-testid={`step-indicator-${s}`}
                  >
                    {s}
                  </div>
                  {s < 3 && (
                    <div
                      className={`w-12 h-1 mx-2 ${
                        step > s ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center gap-4 mb-6 text-sm text-muted-foreground">
            <span className={step === 1 ? "text-primary font-medium" : ""}>
              <Upload className="inline-block w-4 h-4 mr-1" /> Upload
            </span>
            <span className={step === 2 ? "text-primary font-medium" : ""}>
              <Wand2 className="inline-block w-4 h-4 mr-1" /> Ask
            </span>
            <span className={step === 3 ? "text-primary font-medium" : ""}>
              <Video className="inline-block w-4 h-4 mr-1" /> Get It
            </span>
          </div>

          {step === 1 && (
        <Card data-testid="step-1-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Step 1: Choose Your Avatar
            </CardTitle>
            <CardDescription>
              Upload a photo to create a custom avatar or select from existing ones
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload" data-testid="tab-upload">
                  <Plus className="w-4 h-4 mr-2" /> Upload Photo
                </TabsTrigger>
                <TabsTrigger value="existing" data-testid="tab-existing">
                  <Image className="w-4 h-4 mr-2" /> Existing Avatars
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="upload" className="space-y-4 mt-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="avatar-upload"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const url = URL.createObjectURL(file);
                        setUploadPreview(url);
                      }
                    }}
                    data-testid="input-avatar-upload"
                  />
                  
                  {uploadPreview ? (
                    <div className="space-y-4">
                      <img 
                        src={uploadPreview} 
                        alt="Preview" 
                        className="w-32 h-32 object-cover rounded-full mx-auto border-4 border-primary"
                      />
                      <div className="max-w-xs mx-auto">
                        <Label htmlFor="avatar-name">Avatar Name</Label>
                        <Input
                          id="avatar-name"
                          value={avatarName}
                          onChange={(e) => setAvatarName(e.target.value)}
                          placeholder="Enter a name for your avatar"
                          className="mt-1"
                          data-testid="input-avatar-name"
                        />
                      </div>
                      <div className="flex gap-2 justify-center">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setUploadPreview(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          data-testid="button-cancel-upload"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => {
                            const file = fileInputRef.current?.files?.[0];
                            if (file) {
                              uploadAvatarMutation.mutate(file);
                            }
                          }}
                          disabled={uploadAvatarMutation.isPending}
                          data-testid="button-create-avatar"
                        >
                          {uploadAvatarMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              Create Avatar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <label htmlFor="avatar-upload" className="cursor-pointer block">
                      <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-lg font-medium mb-2">Upload a Photo</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        JPG, PNG or WebP (max 10MB). Use a clear, front-facing photo.
                      </p>
                      <Button variant="outline" type="button" data-testid="button-browse-files">
                        Browse Files
                      </Button>
                    </label>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="existing" className="mt-4">
                {avatarsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : avatars.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No avatars available yet.</p>
                    <p className="text-sm mt-2">Upload a photo to create your first avatar!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {avatars.map((avatar) => {
                      const hasMotion = avatar.isMotion && avatar.motionPreviewUrl;
                      const hasPreviewVideo = avatar.previewUrl && avatar.previewUrl.includes('.mp4');
                      const videoUrl = avatar.motionPreviewUrl || (hasPreviewVideo ? avatar.previewUrl : null);
                      const isHovered = hoveredAvatarId === avatar.id;
                      
                      return (
                        <div
                          key={avatar.id}
                          className={`relative border rounded-lg p-3 cursor-pointer transition-all hover:border-primary hover:scale-105 hover:shadow-lg ${
                            selectedAvatar === avatar.id
                              ? "border-primary ring-2 ring-primary/20"
                              : "border-border"
                          }`}
                          onClick={() => {
                            setSelectedAvatar(avatar.id);
                            setSelectedImageKey(avatar.imageKey || ""); // Only set if avatar has a valid imageKey
                            setAvatarType(avatar.type === "photo" ? "talking_photo" : "avatar");
                          }}
                          onMouseEnter={() => setHoveredAvatarId(avatar.id)}
                          onMouseLeave={() => setHoveredAvatarId(null)}
                          data-testid={`avatar-option-${avatar.id}`}
                        >
                          {/* Motion badge */}
                          {(hasMotion || hasPreviewVideo) && (
                            <div className="absolute top-1 left-1 bg-purple-600 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 z-10">
                              <Play className="h-2.5 w-2.5" />
                              Motion
                            </div>
                          )}
                          
                          {/* Image or Video on hover */}
                          {(hasMotion || hasPreviewVideo) && isHovered && videoUrl ? (
                            <video
                              src={videoUrl}
                              className="w-full aspect-square object-cover rounded-md mb-2"
                              autoPlay
                              loop
                              muted
                              playsInline
                            />
                          ) : avatar.thumbnailUrl ? (
                            <img
                              src={avatar.thumbnailUrl}
                              alt={avatar.name}
                              className="w-full aspect-square object-cover rounded-md mb-2"
                            />
                          ) : (
                            <div className="w-full aspect-square bg-muted rounded-md mb-2 flex items-center justify-center">
                              <Video className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                          <p className="text-sm font-medium truncate">{avatar.name}</p>
                          {selectedAvatar === avatar.id && (
                            <CheckCircle className="absolute top-2 right-2 w-5 h-5 text-primary" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex justify-end pt-4">
              <Button
                onClick={() => setStep(2)}
                disabled={!selectedAvatar}
                data-testid="step-1-next"
              >
                Next: Create Script
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card data-testid="step-2-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5" />
              Step 2: Create Your Script
            </CardTitle>
            <CardDescription>
              Tell us what the video is about, or write your own script
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topic">Topic (for AI script generation)</Label>
              <div className="flex gap-2">
                <Input
                  id="topic"
                  placeholder="e.g., Best neighborhoods for families in Omaha"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  data-testid="input-topic"
                />
                <Button
                  onClick={handleGenerateScript}
                  disabled={generateScriptMutation.isPending || !topic.trim()}
                  variant="secondary"
                  data-testid="button-generate-script"
                >
                  {generateScriptMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span className="ml-2">Generate</span>
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="script">Script</Label>
              <Textarea
                id="script"
                placeholder="Enter your script here or generate one using AI..."
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={8}
                className="resize-none"
                data-testid="textarea-script"
              />
              <p className="text-xs text-muted-foreground">
                {script.length}/1500 characters
              </p>
            </div>

            {debouncedScript.trim().length > 10 && (
              <ComplianceChecker
                content={debouncedScript}
                platform="video"
                hasMedia={false}
                hasVideo={true}
                onContentFix={(fixedContent) => setScript(fixedContent)}
                showGuidelines={false}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Video Title (optional)</Label>
                <Input
                  id="title"
                  placeholder="My Awesome Video"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="input-title"
                />
              </div>
              <div className="space-y-2">
                <Label>Aspect Ratio</Label>
                <Select value={aspectRatio} onValueChange={(v: any) => setAspectRatio(v)}>
                  <SelectTrigger data-testid="select-aspect-ratio">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16:9">Landscape (16:9) - YouTube</SelectItem>
                    <SelectItem value="9:16">Portrait (9:16) - Reels/TikTok</SelectItem>
                    <SelectItem value="1:1">Square (1:1) - Instagram</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <Label className="text-sm font-medium">How should your avatar speak?</Label>
              
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={voiceInputMode === "tts" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVoiceInputMode("tts")}
                  data-testid="button-voice-mode-tts"
                >
                  <Volume2 className="h-4 w-4 mr-1" />
                  Text to Speech
                </Button>
                <Button
                  type="button"
                  variant={voiceInputMode === "record" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVoiceInputMode("record")}
                  data-testid="button-voice-mode-record"
                >
                  <Mic className="h-4 w-4 mr-1" />
                  Record Voice
                </Button>
                <Button
                  type="button"
                  variant={voiceInputMode === "upload" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVoiceInputMode("upload")}
                  data-testid="button-voice-mode-upload"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Upload Audio
                </Button>
              </div>

              {voiceInputMode === "tts" && (
                <div className="space-y-3">
                  <Label className="text-sm">Select Voice</Label>
                  <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                    <SelectTrigger data-testid="select-voice">
                      <SelectValue placeholder="Choose a voice for your avatar" />
                    </SelectTrigger>
                    <SelectContent>
                      {voiceOptions}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Your script will be converted to speech using the selected voice.
                  </p>
                </div>
              )}

              {voiceInputMode === "record" && (
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-muted/50">
                  {!recordedUrl ? (
                    <>
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-all ${
                        isRecording ? "bg-red-500 animate-pulse" : "bg-primary/10"
                      }`}>
                        <Mic className={`h-8 w-8 ${isRecording ? "text-white" : "text-primary"}`} />
                      </div>
                      {isRecording && (
                        <div className="text-xl font-mono text-red-500 mb-4">
                          {formatTime(recordingTime)}
                        </div>
                      )}
                      <Button
                        type="button"
                        onClick={isRecording ? stopRecording : startRecording}
                        className={isRecording ? "bg-red-500 hover:bg-red-600" : ""}
                        data-testid={isRecording ? "button-stop-recording" : "button-start-recording"}
                      >
                        {isRecording ? (
                          <>
                            <Square className="h-4 w-4 mr-2" />
                            Stop Recording
                          </>
                        ) : (
                          <>
                            <Mic className="h-4 w-4 mr-2" />
                            Start Recording
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-3 text-center">
                        Record yourself speaking the script.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-green-600 mb-4">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">Recording saved ({formatTime(recordingTime)})</span>
                      </div>
                      <audio src={recordedUrl} controls className="w-full max-w-xs mb-4" data-testid="audio-recording" />
                      <Button type="button" variant="outline" onClick={clearRecording} data-testid="button-clear-recording">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Record Again
                      </Button>
                    </>
                  )}
                </div>
              )}

              {voiceInputMode === "upload" && (
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-muted/50">
                  {!customAudioUrl ? (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground mb-4" />
                      <Label htmlFor="audio-upload-video" className="cursor-pointer bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90">
                        Choose Audio File
                      </Label>
                      <input
                        id="audio-upload-video"
                        type="file"
                        accept="audio/*"
                        onChange={handleAudioUpload}
                        className="hidden"
                        data-testid="input-upload-audio"
                      />
                      <p className="text-xs text-muted-foreground mt-3 text-center">
                        Upload an MP3, WAV, or other audio file.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-green-600 mb-4">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">Audio uploaded: {customAudioFile?.name}</span>
                      </div>
                      <audio src={customAudioUrl} controls className="w-full max-w-xs mb-4" data-testid="audio-uploaded" />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => { setCustomAudioFile(null); setCustomAudioUrl(""); }}
                        data-testid="button-remove-audio"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)} data-testid="step-2-back">
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={
                  (voiceInputMode === "tts" && !script.trim()) ||
                  (voiceInputMode === "record" && !recordedBlob) ||
                  (voiceInputMode === "upload" && !customAudioFile)
                }
                data-testid="step-2-next"
              >
                Next: Generate Video
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card data-testid="step-3-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="w-5 h-5" />
              Step 3: Get Your Video
            </CardTitle>
            <CardDescription>
              Review and generate your AI avatar video
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium">Video Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Avatar:</span>{" "}
                  {avatars.find(a => a.id === selectedAvatar)?.name || selectedAvatar}
                </div>
                <div>
                  <span className="text-muted-foreground">Aspect Ratio:</span> {aspectRatio}
                </div>
                <div>
                  <span className="text-muted-foreground">Voice:</span>{" "}
                  {voiceInputMode === "tts" 
                    ? (voicesData?.voices?.find(v => v.voice_id === selectedVoice)?.name || "Default Voice")
                    : voiceInputMode === "record" 
                      ? "Recorded Voice"
                      : "Uploaded Audio"
                  }
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Title:</span>{" "}
                  {title || topic || "Untitled"}
                </div>
              </div>
              <div className="mt-2">
                <span className="text-muted-foreground text-sm">Script Preview:</span>
                <p className="text-sm mt-1 line-clamp-3">{script}</p>
              </div>
            </div>

            {videoId && videoStatus && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {videoStatus.status === "processing" && (
                    <>
                      <Clock className="w-5 h-5 text-yellow-500 animate-pulse" />
                      <span>Processing your video...</span>
                    </>
                  )}
                  {videoStatus.status === "completed" && (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span>Video ready!</span>
                    </>
                  )}
                  {videoStatus.status === "failed" && (
                    <>
                      <span className="text-red-500">Generation failed: {videoStatus.error}</span>
                    </>
                  )}
                </div>

                {videoStatus.status === "processing" && (
                  <Progress value={videoStatus.progress || 0} className="h-2" />
                )}

                {videoStatus.status === "completed" && videoStatus.videoUrl && (
                  <div className="space-y-4">
                    <video
                      src={videoStatus.videoUrl}
                      controls
                      className="w-full rounded-lg"
                      data-testid="video-player"
                    />
                    <div className="flex gap-2">
                      <Button 
                        className="flex-1" 
                        onClick={() => {
                          if (videoStatus.videoUrl) {
                            downloadFile(videoStatus.videoUrl, `video-${Date.now()}.mp4`);
                          }
                        }}
                        data-testid="button-download"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Video
                      </Button>
                      <Button variant="outline" onClick={resetStudio} data-testid="button-create-new">
                        Create Another
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!videoId && (
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(2)} data-testid="step-3-back">
                  Back
                </Button>
                <Button
                  onClick={handleGenerateVideo}
                  disabled={generateVideoMutation.isPending}
                  size="lg"
                  data-testid="button-generate-video"
                >
                  {generateVideoMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Video
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
        </TabsContent>

        <TabsContent value="videos" className="space-y-6">
          <Card data-testid="my-videos-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Film className="w-5 h-5" />
                My Videos
              </CardTitle>
              <CardDescription>
                Your generated videos from Video Studio
              </CardDescription>
            </CardHeader>
            <CardContent>
              {videosLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : !savedVideosData?.videos || savedVideosData.videos.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <Video className="w-12 h-12 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">No videos yet</p>
                  <Button onClick={() => setActiveView("create")} data-testid="button-create-first-video">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Video
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {savedVideosData.videos.map((video) => (
                    <Card key={video.id} className="overflow-hidden" data-testid={`video-card-${video.id}`}>
                      <div className="aspect-video bg-muted relative group">
                        {video.videoUrl && video.status === "ready" ? (
                          <>
                            {selectedVideoForPlay?.id === video.id ? (
                              <video
                                src={video.videoUrl}
                                controls
                                autoPlay
                                className="w-full h-full object-contain bg-black"
                                data-testid={`video-player-${video.id}`}
                              />
                            ) : (
                              <>
                                {video.thumbnailUrl ? (
                                  <img
                                    src={video.thumbnailUrl}
                                    alt={video.title}
                                    className="w-full h-full object-contain bg-black"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Video className="w-12 h-12 text-muted-foreground" />
                                  </div>
                                )}
                                <button
                                  onClick={() => setSelectedVideoForPlay(video)}
                                  className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
                                  data-testid={`button-play-${video.id}`}
                                >
                                  <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                                    <Play className="w-6 h-6 text-black ml-1" />
                                  </div>
                                </button>
                              </>
                            )}
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {video.status === "generating" || video.status === "processing" ? (
                              <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Processing...</span>
                              </div>
                            ) : (
                              <Video className="w-12 h-12 text-muted-foreground" />
                            )}
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium truncate" data-testid={`video-title-${video.id}`}>
                            {video.title}
                          </h3>
                          {getStatusBadge(video.status)}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3" data-testid={`video-date-${video.id}`}>
                          {formatDate(video.createdAt)}
                        </p>
                        <div className="flex gap-2">
                          {video.videoUrl && video.status === "ready" && (
                            <Button 
                              size="sm" 
                              className="flex-1" 
                              onClick={() => {
                                if (video.videoUrl) {
                                  downloadFile(video.videoUrl, `${video.title || 'video'}-${Date.now()}.mp4`);
                                }
                              }}
                              data-testid={`button-download-${video.id}`}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteVideo(video.id)}
                            disabled={deletingVideoId === video.id}
                            data-testid={`button-delete-${video.id}`}
                          >
                            {deletingVideoId === video.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
