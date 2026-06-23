import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAuthToken } from "@/lib/authToken";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Maximize2,
  Mic,
  Pause,
  Play,
  RefreshCw,
  Smartphone,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Video,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { QRCodeSVG } from "qrcode.react";

const MOTION_TEMPLATES = [
  { 
    id: "talking_naturally", 
    name: "Talking Naturally", 
    description: "Natural speaking motion with subtle head movements and expressions",
    prompt: "Person speaking naturally with subtle head movements, gentle nodding, natural blinks, and relaxed facial expressions as if having a friendly conversation"
  },
  { 
    id: "expert_presentation", 
    name: "Expert Presentation", 
    description: "Confident, authoritative presentation style",
    prompt: "Professional presenter speaking confidently with purposeful hand gestures, direct eye contact, and authoritative body language as if explaining an important topic"
  },
  { 
    id: "dynamic_announcement", 
    name: "Dynamic Announcement", 
    description: "Energetic, attention-grabbing delivery",
    prompt: "Energetic person making an exciting announcement with animated expressions, wider gestures, raised eyebrows, and enthusiastic body language"
  },
  { 
    id: "keynote_speaker", 
    name: "Keynote Speaker", 
    description: "Polished, inspiring speaker on stage",
    prompt: "Polished keynote speaker with measured movements, inspiring expressions, confident posture, and engaging eye contact as if addressing a large audience"
  },
  { 
    id: "thoughtful_conversation", 
    name: "Thoughtful Conversation", 
    description: "Reflective, empathetic speaking style",
    prompt: "Person having a thoughtful conversation with reflective pauses, understanding nods, empathetic expressions, and calm, measured movements"
  },
  { 
    id: "telling_story", 
    name: "Telling a Funny Story", 
    description: "Animated storytelling with humor",
    prompt: "Animated storyteller with expressive face, playful gestures, raised eyebrows for emphasis, smiles, and varied expressions as if telling an entertaining story"
  },
];

const KLING_VOICES = [
  { id: "female_calm", name: "Female - Calm" },
  { id: "female_energetic", name: "Female - Energetic" },
  { id: "male_calm", name: "Male - Calm" },
  { id: "male_energetic", name: "Male - Energetic" },
];

interface VideoAvatar {
  id: string;
  avatarName: string;
  heygenAvatarId: string;
  trainingVideoUrl: string;
  consentVideoUrl: string;
  voiceId: string | null;
  status: "in_progress" | "complete" | "failed";
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
  thumbnailUrl?: string;
  previewVideoUrl?: string;
}

export default function VideoAvatarManager() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  // Form state
  const [avatarName, setAvatarName] = useState("");
  const [trainingVideoUrl, setTrainingVideoUrl] = useState("");
  const [consentVideoUrl, setConsentVideoUrl] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [audioAssetId, setAudioAssetId] = useState<string | null>(null);
  const [uploadingTraining, setUploadingTraining] = useState(false);
  const [uploadingConsent, setUploadingConsent] = useState(false);
  const [showConsentScript, setShowConsentScript] = useState(false);

  // QR code state for mobile uploads
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [qrUploadType, setQrUploadType] = useState<"training" | "consent">("training");
  const [qrPolling, setQrPolling] = useState(false);

  // Hover and popup state for avatar cards
  const [hoveredAvatarId, setHoveredAvatarId] = useState<string | null>(null);
  const [showAvatarPopup, setShowAvatarPopup] = useState(false);
  const [popupAvatarIndex, setPopupAvatarIndex] = useState(0);
  const [, setLocation] = useLocation();

  // Motion generation state (Kling AI)
  const [showMotionDialog, setShowMotionDialog] = useState(false);
  const [motionPrompt, setMotionPrompt] = useState("");
  const [motionDuration, setMotionDuration] = useState<"5" | "10">("5");
  const [isGeneratingMotion, setIsGeneratingMotion] = useState(false);
  const [motionTaskId, setMotionTaskId] = useState<string | null>(null);
  const [motionStatus, setMotionStatus] = useState<string>("");
  const [motionVideoUrl, setMotionVideoUrl] = useState<string | null>(null);
  const [motionProgress, setMotionProgress] = useState(0);
  const [motionTab, setMotionTab] = useState<"templates" | "custom" | "upload">("templates");
  const [selectedMotionTemplate, setSelectedMotionTemplate] = useState<string>("talking_naturally");
  
  // Motion dialog step: "motion" -> "voice" -> "final"
  const [motionDialogStep, setMotionDialogStep] = useState<"motion" | "voice" | "final">("motion");
  const [motionVoiceScript, setMotionVoiceScript] = useState("");
  const [selectedMotionVoice, setSelectedMotionVoice] = useState<string>("female_calm");
  const [voiceProvider, setVoiceProvider] = useState<"elevenlabs" | "kling">("kling");
  const [isGeneratingLipSync, setIsGeneratingLipSync] = useState(false);
  const [lipSyncStatus, setLipSyncStatus] = useState<string>("");
  const [lipSyncProgress, setLipSyncProgress] = useState(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  
  // Voice input mode for motion dialog
  const [voiceInputMode, setVoiceInputMode] = useState<"tts" | "record" | "upload">("tts");
  const [motionRecordedBlob, setMotionRecordedBlob] = useState<Blob | null>(null);
  const [motionRecordedUrl, setMotionRecordedUrl] = useState<string>("");
  const [motionRecordingTime, setMotionRecordingTime] = useState(0);
  const [isMotionRecording, setIsMotionRecording] = useState(false);
  const [uploadedAudioFile, setUploadedAudioFile] = useState<File | null>(null);
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string>("");
  const motionMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const motionChunksRef = useRef<Blob[]>([]);
  const motionRecordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Upload motion video state
  const [uploadedMotionFile, setUploadedMotionFile] = useState<File | null>(null);
  const [uploadedMotionUrl, setUploadedMotionUrl] = useState<string>("");

  // Video preview controls for popup
  const [isPopupVideoPlaying, setIsPopupVideoPlaying] = useState(true);
  const [isPopupVideoMuted, setIsPopupVideoMuted] = useState(true);
  const popupVideoRef = useRef<HTMLVideoElement | null>(null);

  // Fetch video avatars
  const { data: avatars = [], isLoading: isLoadingAvatars } = useQuery<
    VideoAvatar[]
  >({
    queryKey: ["/api/video-avatars"],
    refetchInterval: (query) => {
      // Auto-refresh if any avatar is in progress
      const data = query.state.data;
      const hasInProgress = data?.some(
        (a: VideoAvatar) => a.status === "in_progress"
      );
      return hasInProgress ? 10000 : false; // Poll every 10s if in progress
    },
  });

  // Create video avatar mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      trainingVideoUrl: string;
      consentVideoUrl: string;
      voiceId?: string;
      audioAssetId?: string;
    }) => {
      const res = await fetch("/api/video-avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(
          error.details || error.error || "Failed to create video avatar"
        );
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-avatars"] });
      toast({
        title: "Video Avatar Creation Started",
        description:
          "This may take several hours. We'll notify you when complete.",
      });
      // Reset form
      setAvatarName("");
      setTrainingVideoUrl("");
      setConsentVideoUrl("");
      setVoiceId("");
      setAudioAssetId(null);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: error.message,
      });
    },
  });

  // Delete video avatar mutation
  const deleteMutation = useMutation({
    mutationFn: async (avatarId: string) => {
      const res = await fetch(`/api/video-avatars/${avatarId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete video avatar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-avatars"] });
      toast({
        title: "Video Avatar Deleted",
        description: "The video avatar has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: error.message,
      });
    },
  });

  // Helper function to check video duration
  const checkVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      
      video.onerror = () => {
        reject(new Error("Could not load video metadata"));
      };
      
      video.src = URL.createObjectURL(file);
    });
  };

  // Handle file upload to S3 (you'll need to implement this endpoint)
  const handleFileUpload = async (file: File, type: "training" | "consent") => {
    const setUploading =
      type === "training" ? setUploadingTraining : setUploadingConsent;
    const setUrl =
      type === "training" ? setTrainingVideoUrl : setConsentVideoUrl;

    try {
      setUploading(true);

      // Validate file type
      if (!file.type.startsWith("video/")) {
        throw new Error("Please upload a video file");
      }

      // Check video duration for training footage (max 2 minutes)
      if (type === "training") {
        try {
          const duration = await checkVideoDuration(file);
          const maxDuration = 120; // 2 minutes in seconds
          
          if (duration > maxDuration) {
            toast({
              variant: "destructive",
              title: "Video Too Long",
              description: `Training footage must be under 2 minutes. Your video is ${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')} long.`,
            });
            setUploading(false);
            return;
          }
          
          if (duration < 30) {
            toast({
              variant: "destructive", 
              title: "Video Too Short",
              description: "Training footage should be at least 30 seconds to capture enough movements and voice.",
            });
            setUploading(false);
            return;
          }
        } catch (durationError) {
          console.warn("Could not check video duration:", durationError);
          // Continue with upload anyway if duration check fails
        }
      }

      const formData = new FormData();
      formData.append("video", file);
      formData.append("type", type);

      const res = await fetch("/api/upload/video-avatar-footage", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.details || "Upload failed");
      }

      const data = await res.json();
      setUrl(data.url);
      
      // If training footage, capture the audio asset ID for voice
      if (type === "training" && data.audioAssetId) {
        setAudioAssetId(data.audioAssetId);
        toast({
          title: "Upload Successful",
          description: "Training video uploaded and voice extracted successfully!",
        });
      } else {
        toast({
          title: "Upload Successful",
          description: `${
            type === "training" ? "Training" : "Consent"
          } video uploaded`,
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message,
      });
    } finally {
      setUploading(false);
    }
  };

  // Create mobile upload session for QR code functionality
  const createMobileSession = async (type: "training" | "consent") => {
    const res = await fetch("/api/mobile-upload/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ type }),
    });
    if (!res.ok) throw new Error("Failed to create session");
    const data = await res.json();
    return data.sessionId;
  };

  // Handle "Upload from Phone" button click
  const handlePhoneUpload = async (type: "training" | "consent") => {
    setQrUploadType(type);
    try {
      const sessionId = await createMobileSession(type);
      setQrSessionId(sessionId);
      setQrDialogOpen(true);
      setQrPolling(true);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate QR code. Please try again.",
      });
    }
  };

  // Polling effect for mobile upload completion
  useEffect(() => {
    if (!qrPolling || !qrSessionId) return;
    
    const pollInterval = setInterval(async () => {
      try {
        const token = getAuthToken();
        const headers: Record<string, string> = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        
        const res = await fetch(`/api/mobile-upload/${qrSessionId}/status`, {
          credentials: "include",
          headers,
        });
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.complete && data.url) {
          if (qrUploadType === "training") {
            setTrainingVideoUrl(data.url);
          } else {
            setConsentVideoUrl(data.url);
          }
          setQrPolling(false);
          setQrDialogOpen(false);
          toast({
            title: "Upload Complete!",
            description: `${qrUploadType === "training" ? "Training" : "Consent"} video uploaded from your phone.`,
          });
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 2000);
    
    return () => clearInterval(pollInterval);
  }, [qrPolling, qrSessionId, qrUploadType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!avatarName || !trainingVideoUrl || !consentVideoUrl) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide avatar name and upload both videos",
      });
      return;
    }

    createMutation.mutate({
      name: avatarName,
      trainingVideoUrl,
      consentVideoUrl,
      voiceId: voiceId || undefined,
      audioAssetId: audioAssetId || undefined,
    });
  };

  const getStatusBadge = (status: VideoAvatar["status"]) => {
    switch (status) {
      case "in_progress":
        return (
          <Badge variant="secondary">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" /> In Progress
          </Badge>
        );
      case "complete":
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" /> Failed
          </Badge>
        );
    }
  };

  // Motion generation functions
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleGenerateMotion = async () => {
    if (!motionPrompt.trim()) {
      toast({
        title: "Enter a prompt",
        description: "Please describe how you want your avatar to move.",
        variant: "destructive",
      });
      return;
    }

    const currentAvatar = completeAvatars[popupAvatarIndex];
    const imageUrl = currentAvatar?.thumbnailUrl;
    
    if (!imageUrl) {
      toast({
        title: "No image available",
        description: "This avatar doesn't have a thumbnail image for motion generation.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingMotion(true);
    setMotionStatus("starting");
    setMotionProgress(0);
    setMotionVideoUrl(null);

    try {
      const response = await fetch("/api/kling/generate-motion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          imageUrl,
          prompt: motionPrompt,
          duration: motionDuration,
          waitForCompletion: false,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to start motion generation");
      }

      if (result.videoUrl) {
        setMotionVideoUrl(result.videoUrl);
        setMotionStatus("completed");
        setMotionProgress(100);
        setMotionDialogStep("voice");
        toast({
          title: "Motion Video Ready!",
          description: "Now add your voice to make your avatar speak.",
        });
      } else if (result.taskId) {
        setMotionTaskId(result.taskId);
        setMotionStatus("processing");
        pollMotionStatus(result.taskId);
      }
    } catch (error) {
      console.error("Motion generation error:", error);
      setMotionStatus("failed");
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate motion video",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingMotion(false);
    }
  };

  const pollMotionStatus = async (taskId: string) => {
    const maxPolls = 60;
    let pollCount = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/kling/status/${taskId}`, {
          credentials: "include",
        });

        const result = await response.json();
        pollCount++;

        setMotionProgress(Math.min(95, Math.round((pollCount / maxPolls) * 100)));

        if (result.status === "completed" && result.videoUrl) {
          setMotionVideoUrl(result.videoUrl);
          setMotionStatus("completed");
          setMotionProgress(100);
          setMotionDialogStep("voice");
          toast({
            title: "Motion Video Ready!",
            description: "Now add your voice to make your avatar speak.",
          });
          return;
        }

        if (result.status === "failed") {
          setMotionStatus("failed");
          toast({
            title: "Generation Failed",
            description: result.error || "Video generation failed",
            variant: "destructive",
          });
          return;
        }

        if (pollCount < maxPolls && (result.status === "pending" || result.status === "processing")) {
          setMotionStatus(result.status);
          setTimeout(poll, 5000);
        } else if (pollCount >= maxPolls) {
          setMotionStatus("timeout");
          toast({
            title: "Generation Timeout",
            description: "Video is still processing. Please check back later.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Poll error:", error);
        setMotionStatus("failed");
      }
    };

    poll();
  };

  const startMotionRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      motionMediaRecorderRef.current = mediaRecorder;
      motionChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          motionChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(motionChunksRef.current, { type: "audio/webm" });
        setMotionRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setMotionRecordedUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsMotionRecording(true);
      setMotionRecordingTime(0);

      motionRecordingIntervalRef.current = setInterval(() => {
        setMotionRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      toast({
        title: "Microphone Access Denied",
        description: "Please allow microphone access to record your voice.",
        variant: "destructive",
      });
    }
  };

  const stopMotionRecording = () => {
    if (motionMediaRecorderRef.current && isMotionRecording) {
      motionMediaRecorderRef.current.stop();
      setIsMotionRecording(false);
      if (motionRecordingIntervalRef.current) {
        clearInterval(motionRecordingIntervalRef.current);
        motionRecordingIntervalRef.current = null;
      }
    }
  };

  const clearMotionRecording = () => {
    setMotionRecordedBlob(null);
    setMotionRecordedUrl("");
    setMotionRecordingTime(0);
  };

  const handleUploadMotionVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("video/")) {
        toast({
          title: "Invalid File",
          description: "Please upload a video file (MP4, WebM, etc.)",
          variant: "destructive",
        });
        return;
      }
      setUploadedMotionFile(file);
      const url = URL.createObjectURL(file);
      setUploadedMotionUrl(url);
      setMotionVideoUrl(url);
      setMotionDialogStep("voice");
      toast({
        title: "Motion Video Uploaded",
        description: "Now add your voice to make your avatar speak.",
      });
    }
  };

  const handleUploadAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("audio/")) {
        toast({
          title: "Invalid File",
          description: "Please upload an audio file (MP3, WAV, etc.)",
          variant: "destructive",
        });
        return;
      }
      setUploadedAudioFile(file);
      const url = URL.createObjectURL(file);
      setUploadedAudioUrl(url);
      toast({
        title: "Audio Uploaded",
        description: "Your audio file is ready to use.",
      });
    }
  };

  const openMotionDialog = () => {
    setShowMotionDialog(true);
    setMotionDialogStep("motion");
    setMotionPrompt("");
    setMotionVideoUrl(null);
    setMotionStatus("");
    setMotionProgress(0);
    setMotionVoiceScript("");
    setFinalVideoUrl(null);
    setLipSyncStatus("");
    setLipSyncProgress(0);
    setVoiceInputMode("tts");
    setMotionRecordedBlob(null);
    setMotionRecordedUrl("");
    setUploadedAudioFile(null);
    setUploadedAudioUrl("");
    setSelectedMotionTemplate("talking_naturally");
    const template = MOTION_TEMPLATES.find(t => t.id === "talking_naturally");
    if (template) {
      setMotionPrompt(template.prompt);
    }
  };

  const inProgressAvatars = avatars.filter((a) => a.status === "in_progress");
  const completeAvatars = avatars.filter((a) => a.status === "complete");
  const failedAvatars = avatars.filter((a) => a.status === "failed");

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-3xl font-bold">Video Avatar Manager</h1>
        <Badge
          variant="secondary"
          className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-3 py-1"
        >
          ENTERPRISE ONLY
        </Badge>
      </div>
      <p className="text-muted-foreground mb-4">
        Create high-fidelity video avatars from training footage
      </p>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Requirements:</strong> Training footage must be under 2 minutes
          (30 seconds to 2 minutes is ideal for capturing movements and voice),
          720p or higher, MP4 format. You must also provide a consent video with
          the required statement.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="create" className="w-full">
        <TabsList>
          <TabsTrigger value="create">Create New Avatar</TabsTrigger>
          <TabsTrigger value="library">
            My Video Avatars ({completeAvatars.length})
          </TabsTrigger>
          {inProgressAvatars.length > 0 && (
            <TabsTrigger value="progress">
              In Progress ({inProgressAvatars.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Create Video Avatar</CardTitle>
              <CardDescription>
                Upload training footage and consent video to create a custom
                video avatar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="avatarName">Avatar Name *</Label>
                  <Input
                    id="avatarName"
                    value={avatarName}
                    onChange={(e) => setAvatarName(e.target.value)}
                    placeholder="e.g., Professional Sarah"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trainingVideo">Training Footage *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="trainingVideo"
                      type="file"
                      accept="video/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, "training");
                      }}
                      disabled={uploadingTraining}
                    />
                    {uploadingTraining && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                  </div>
                  {trainingVideoUrl && (
                    <p className="text-sm text-green-600">
                      ✓ Training video uploaded
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Under 2 minutes (ideal for capturing movements and voice), 720p or higher, clear speaking footage
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handlePhoneUpload("training")}
                    data-testid="button-phone-upload-training"
                  >
                    <Smartphone className="w-4 h-4 mr-2" />
                    Upload from Phone
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="consentVideo">Consent Video *</Label>
                    <Button
                      type="button"
                      onClick={() => setShowConsentScript(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all"
                      data-testid="button-read-consent-script"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Read Script
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="consentVideo"
                      type="file"
                      accept="video/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, "consent");
                      }}
                      disabled={uploadingConsent}
                    />
                    {uploadingConsent && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                  </div>
                  {consentVideoUrl && (
                    <p className="text-sm text-green-600">
                      ✓ Consent video uploaded
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Record yourself reading the HeyGen consent statement
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handlePhoneUpload("consent")}
                    data-testid="button-phone-upload-consent"
                  >
                    <Smartphone className="w-4 h-4 mr-2" />
                    Upload from Phone
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="voiceId">Voice ID (Optional)</Label>
                  <Input
                    id="voiceId"
                    value={voiceId}
                    onChange={(e) => setVoiceId(e.target.value)}
                    placeholder="Leave empty to use default"
                  />
                  <p className="text-sm text-muted-foreground">
                    Specify a HeyGen voice ID for this avatar
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending ||
                    !trainingVideoUrl ||
                    !consentVideoUrl
                  }
                  className="w-full"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Avatar...
                    </>
                  ) : (
                    <>
                      <Video className="w-4 h-4 mr-2" />
                      Create Video Avatar
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="library">
          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/video-avatars"] });
                toast({
                  title: "Syncing Avatars",
                  description: "Refreshing avatars from HeyGen...",
                });
              }}
              disabled={isLoadingAvatars}
              data-testid="button-sync-avatars"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingAvatars ? 'animate-spin' : ''}`} />
              Sync from HeyGen
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {isLoadingAvatars ? (
              <div className="col-span-full text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                <p className="text-muted-foreground">
                  Loading video avatars...
                </p>
              </div>
            ) : completeAvatars.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Video className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No video avatars yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your first video avatar from training footage
                </p>
              </div>
            ) : (
              completeAvatars.map((avatar, index) => {
                const isHovered = hoveredAvatarId === avatar.id;
                const hasPreviewVideo = !!avatar.previewVideoUrl;
                
                return (
                  <button
                    key={avatar.id}
                    onClick={() => {
                      setPopupAvatarIndex(index);
                      setShowAvatarPopup(true);
                    }}
                    onMouseEnter={() => setHoveredAvatarId(avatar.id)}
                    onMouseLeave={() => setHoveredAvatarId(null)}
                    className="relative rounded-xl overflow-hidden border-2 transition-all hover:scale-105 hover:shadow-lg border-gray-200 dark:border-gray-700 hover:border-[#D4AF37]/50 text-left bg-white dark:bg-gray-900"
                    data-testid={`card-avatar-${avatar.id}`}
                  >
                    <div className="aspect-square relative bg-muted">
                      {/* Motion badge */}
                      {hasPreviewVideo && (
                        <div className="absolute top-2 left-2 bg-purple-600 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 z-10">
                          <Play className="h-2.5 w-2.5" />
                          Video
                        </div>
                      )}
                      
                      {/* Hover-to-play video or show thumbnail */}
                      {hasPreviewVideo && isHovered ? (
                        <video
                          src={avatar.previewVideoUrl}
                          className="w-full h-full object-cover"
                          autoPlay
                          loop
                          muted
                          playsInline
                        />
                      ) : avatar.thumbnailUrl ? (
                        <img
                          src={avatar.thumbnailUrl}
                          alt={avatar.avatarName}
                          className="w-full h-full object-cover"
                          data-testid={`img-avatar-${avatar.id}`}
                          onError={(e) => {
                            const parent = e.currentTarget.parentElement;
                            if (parent) {
                              e.currentTarget.style.display = 'none';
                              const fallback = parent.querySelector('.fallback-icon');
                              if (fallback) (fallback as HTMLElement).style.display = 'flex';
                            }
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-muted">
                          <Video className="w-16 h-16 text-muted-foreground" />
                        </div>
                      )}
                      
                      {/* Delete button on hover */}
                      {isHovered && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const confirmed = await confirm({
                              title: "Delete Video Avatar",
                              description: "Delete this video avatar? This cannot be undone.",
                              confirmText: "Delete",
                              variant: "destructive",
                            });
                            if (confirmed) {
                              deleteMutation.mutate(avatar.heygenAvatarId);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className="absolute bottom-2 right-2 w-7 h-7 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center z-10 transition-colors"
                          data-testid={`button-delete-avatar-${avatar.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-white" />
                        </button>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm truncate">
                            {avatar.avatarName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(avatar.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        {getStatusBadge(avatar.status)}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </TabsContent>

        {inProgressAvatars.length > 0 && (
          <TabsContent value="progress">
            <div className="space-y-4">
              {inProgressAvatars.map((avatar) => (
                <Card key={avatar.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{avatar.avatarName}</CardTitle>
                        <CardDescription>
                          Started {new Date(avatar.createdAt).toLocaleString()}
                        </CardDescription>
                      </div>
                      {getStatusBadge(avatar.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">
                          Creating avatar...
                        </span>
                        <span className="text-muted-foreground">
                          This may take several hours
                        </span>
                      </div>
                      <Progress value={undefined} className="h-2" />
                    </div>
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        Video avatar creation is processing. You can close this
                        page and come back later. The page will auto-refresh
                        every 10 seconds.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {failedAvatars.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Failed Avatars</CardTitle>
            <CardDescription>
              These avatar creations encountered errors
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {failedAvatars.map((avatar) => (
              <div
                key={avatar.id}
                className="flex items-start justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{avatar.avatarName}</p>
                    {getStatusBadge(avatar.status)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {new Date(avatar.createdAt).toLocaleDateString()}
                  </p>
                  {avatar.errorMessage && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertDescription className="text-sm">
                        {avatar.errorMessage}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMutation.mutate(avatar.heygenAvatarId)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={showConsentScript} onOpenChange={setShowConsentScript}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              HeyGen Consent Statement
            </DialogTitle>
            <DialogDescription>
              Record yourself reading this statement clearly while looking at the camera
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-6 rounded-lg border-2 border-dashed">
              <p className="text-lg leading-relaxed font-medium text-center">
                "I, <span className="text-primary underline">[state your full name]</span>, am aware that my voice and likeness will be used to create an AI-generated avatar. I authorize HeyGen to use this recording to train and generate synthetic videos featuring my digital likeness and voice."
              </p>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Recording Tips:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Look directly at the camera while speaking</li>
                <li>Speak clearly and at a natural pace</li>
                <li>Ensure good lighting on your face</li>
                <li>Record in a quiet environment</li>
                <li>Say your actual full legal name where indicated</li>
              </ul>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setShowConsentScript(false)}>
                Got it
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={qrDialogOpen} onOpenChange={(open) => {
        setQrDialogOpen(open);
        if (!open) setQrPolling(false);
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              Upload from Phone
            </DialogTitle>
            <DialogDescription>
              Scan this QR code with your phone to upload your {qrUploadType} video
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrSessionId && (
              <div className="bg-white p-4 rounded-lg">
                <QRCodeSVG 
                  value={`${window.location.origin}/mobile-upload/${qrSessionId}`}
                  size={200}
                  level="H"
                />
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Waiting for upload...
            </div>
            <p className="text-xs text-center text-muted-foreground max-w-xs">
              The QR code expires in 15 minutes. This dialog will close automatically when upload completes.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Avatar Popup Dialog */}
      <Dialog open={showAvatarPopup} onOpenChange={setShowAvatarPopup}>
        <DialogContent 
          className="max-w-lg p-0 gap-0 overflow-hidden bg-white dark:bg-gray-900 rounded-2xl"
          data-testid="dialog-video-avatar-popup"
        >
          {completeAvatars.length > 0 && completeAvatars[popupAvatarIndex] && (
            <>
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <DialogTitle className="text-lg font-semibold">
                  {completeAvatars[popupAvatarIndex].avatarName}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Video avatar options
                </DialogDescription>
              </div>

              <div className="relative flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                {completeAvatars.length > 1 && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const newIndex = popupAvatarIndex === 0 ? completeAvatars.length - 1 : popupAvatarIndex - 1;
                      setPopupAvatarIndex(newIndex);
                    }}
                    className="absolute left-4 z-10 h-10 w-10 rounded-full bg-white dark:bg-gray-800 shadow-lg border-gray-200"
                    data-testid="button-prev-avatar"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                )}

                <div className="p-6">
                  <div className="w-72 h-96 mx-auto rounded-xl overflow-hidden shadow-lg border-2 border-gray-100 dark:border-gray-700 relative group">
                    {/* Video badge */}
                    {completeAvatars[popupAvatarIndex]?.previewVideoUrl && (
                      <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 z-10">
                        <Play className="h-3 w-3" />
                        Video Avatar
                      </div>
                    )}
                    
                    {/* Show preview video if available, otherwise show thumbnail */}
                    {completeAvatars[popupAvatarIndex]?.previewVideoUrl ? (
                      <>
                        <video
                          ref={popupVideoRef}
                          src={completeAvatars[popupAvatarIndex].previewVideoUrl}
                          className="w-full h-full object-cover cursor-pointer"
                          autoPlay
                          loop
                          muted={isPopupVideoMuted}
                          playsInline
                          onClick={() => {
                            if (popupVideoRef.current) {
                              if (popupVideoRef.current.paused) {
                                popupVideoRef.current.play();
                                setIsPopupVideoPlaying(true);
                              } else {
                                popupVideoRef.current.pause();
                                setIsPopupVideoPlaying(false);
                              }
                            }
                          }}
                          data-testid="video-popup-avatar"
                        />
                        
                        {/* Video controls overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-white hover:bg-white/20"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (popupVideoRef.current) {
                                  if (popupVideoRef.current.paused) {
                                    popupVideoRef.current.play();
                                    setIsPopupVideoPlaying(true);
                                  } else {
                                    popupVideoRef.current.pause();
                                    setIsPopupVideoPlaying(false);
                                  }
                                }
                              }}
                              data-testid="button-toggle-play"
                            >
                              {isPopupVideoPlaying ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-white hover:bg-white/20"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsPopupVideoMuted(!isPopupVideoMuted);
                              }}
                              data-testid="button-toggle-mute"
                            >
                              {isPopupVideoMuted ? (
                                <VolumeX className="h-4 w-4" />
                              ) : (
                                <Volume2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-white hover:bg-white/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(completeAvatars[popupAvatarIndex].previewVideoUrl, "_blank");
                            }}
                            data-testid="button-fullscreen"
                          >
                            <Maximize2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        {/* Play indicator when paused */}
                        {!isPopupVideoPlaying && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                              <Play className="h-8 w-8 text-gray-800 ml-1" />
                            </div>
                          </div>
                        )}
                      </>
                    ) : completeAvatars[popupAvatarIndex]?.thumbnailUrl ? (
                      <img
                        src={completeAvatars[popupAvatarIndex].thumbnailUrl}
                        alt={completeAvatars[popupAvatarIndex].avatarName}
                        className="w-full h-full object-cover"
                        data-testid="img-popup-avatar"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <Video className="w-16 h-16 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>

                {completeAvatars.length > 1 && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const newIndex = popupAvatarIndex === completeAvatars.length - 1 ? 0 : popupAvatarIndex + 1;
                      setPopupAvatarIndex(newIndex);
                    }}
                    className="absolute right-4 z-10 h-10 w-10 rounded-full bg-white dark:bg-gray-800 shadow-lg border-gray-200"
                    data-testid="button-next-avatar"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-center gap-3 px-6 py-4 border-t bg-white dark:bg-gray-900">
                <Button
                  variant="outline"
                  className="flex items-center gap-2 border-purple-300 hover:bg-purple-50 text-purple-700"
                  onClick={() => {
                    setShowAvatarPopup(false);
                    openMotionDialog();
                  }}
                  data-testid="button-add-motion"
                >
                  <Sparkles className="h-4 w-4" />
                  Add Motion
                </Button>
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={() => {
                    toast({
                      title: "Coming Soon",
                      description: "Look editing will be available in a future update.",
                    });
                  }}
                  data-testid="button-edit-look"
                >
                  <RefreshCw className="h-4 w-4" />
                  Edit Look
                </Button>
                <Button
                  className="btn-golden flex items-center gap-2 relative overflow-hidden bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white"
                  onClick={() => {
                    setShowAvatarPopup(false);
                    setLocation("/avatar-studio");
                    toast({
                      title: "Avatar Selected",
                      description: "Opening AI Studio to create your video.",
                    });
                  }}
                  data-testid="button-create-with-ai"
                >
                  <Video className="h-4 w-4" />
                  Create with AI Studio
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Motion Generation Dialog */}
      <Dialog open={showMotionDialog} onOpenChange={setShowMotionDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              {motionDialogStep === "motion" && "Step 1: Add Motion"}
              {motionDialogStep === "voice" && "Step 2: Add Voice"}
              {motionDialogStep === "final" && "Step 3: Preview Video"}
            </DialogTitle>
            <DialogDescription>
              {motionDialogStep === "motion" && "Transform your video avatar into a video with natural motion."}
              {motionDialogStep === "voice" && "Add your voice and script to bring your avatar to life."}
              {motionDialogStep === "final" && "Your talking avatar video is ready!"}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 py-2">
            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
              motionDialogStep === "motion" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"
            }`}>
              {motionDialogStep !== "motion" ? <CheckCircle className="h-3 w-3" /> : <span className="w-4 h-4 rounded-full bg-purple-500 text-white flex items-center justify-center text-[10px]">1</span>}
              Motion
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
              motionDialogStep === "voice" ? "bg-purple-100 text-purple-700" : 
              motionDialogStep === "final" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}>
              {motionDialogStep === "final" ? <CheckCircle className="h-3 w-3" /> : <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                motionDialogStep === "voice" ? "bg-purple-500 text-white" : "bg-gray-300 text-gray-600"
              }`}>2</span>}
              Voice
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
              motionDialogStep === "final" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500"
            }`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                motionDialogStep === "final" ? "bg-purple-500 text-white" : "bg-gray-300 text-gray-600"
              }`}>3</span>
              Preview
            </div>
          </div>

          {/* STEP 1: Motion Generation */}
          {motionDialogStep === "motion" && (
            <>
              <div className="flex gap-6 py-4">
                {/* Left side: Avatar Preview */}
                <div className="flex-shrink-0">
                  <div className="w-48 h-64 rounded-lg overflow-hidden border-2 border-purple-400 shadow-lg bg-gradient-to-b from-purple-50 to-white dark:from-purple-950/30 dark:to-gray-900">
                    <img
                      src={completeAvatars[popupAvatarIndex]?.thumbnailUrl || ""}
                      alt="Selected Avatar"
                      className="w-full h-full object-cover"
                      data-testid="img-motion-preview"
                    />
                  </div>
                </div>

                {/* Right side: Options */}
                <div className="flex-1 space-y-4">
                  <Tabs value={motionTab} onValueChange={(v) => setMotionTab(v as "templates" | "custom" | "upload")} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                      <TabsTrigger 
                        value="templates" 
                        className="data-[state=active]:text-purple-600 data-[state=active]:border-b-2 data-[state=active]:border-purple-500"
                        data-testid="tab-motion-templates"
                      >
                        Templates
                      </TabsTrigger>
                      <TabsTrigger 
                        value="custom"
                        data-testid="tab-custom-prompt"
                      >
                        Custom
                      </TabsTrigger>
                      <TabsTrigger 
                        value="upload"
                        data-testid="tab-upload-motion"
                      >
                        Upload Video
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="templates" className="mt-0">
                      <ScrollArea className="h-[200px] pr-4">
                        <div className="space-y-2">
                          {MOTION_TEMPLATES.map((template) => (
                            <div
                              key={template.id}
                              className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                                selectedMotionTemplate === template.id
                                  ? "bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800"
                                  : "bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent"
                              }`}
                              onClick={() => {
                                setSelectedMotionTemplate(template.id);
                                setMotionPrompt(template.prompt);
                              }}
                              data-testid={`motion-template-${template.id}`}
                            >
                              <div>
                                <p className="font-medium text-sm">{template.name}</p>
                                <p className="text-xs text-gray-500">{template.description}</p>
                              </div>
                              {selectedMotionTemplate === template.id && (
                                <CheckCircle className="h-5 w-5 text-purple-500" />
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="custom" className="mt-0">
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Custom Motion Prompt</Label>
                        <Textarea
                          placeholder="Describe how you want your avatar to move... e.g., 'Speaking enthusiastically with hand gestures and nodding'"
                          value={motionPrompt}
                          onChange={(e) => setMotionPrompt(e.target.value)}
                          className="min-h-[120px]"
                          data-testid="input-custom-motion-prompt"
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="upload" className="mt-0">
                      <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-gray-50 dark:bg-gray-900">
                        {!uploadedMotionUrl ? (
                          <>
                            <Upload className="h-10 w-10 text-gray-400 mb-4" />
                            <Label 
                              htmlFor="motion-video-upload" 
                              className="cursor-pointer bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-md"
                            >
                              Choose Video File
                            </Label>
                            <input
                              id="motion-video-upload"
                              type="file"
                              accept="video/*"
                              onChange={handleUploadMotionVideo}
                              className="hidden"
                              data-testid="input-upload-motion-video"
                            />
                            <p className="text-xs text-gray-500 mt-3 text-center">
                              Upload a motion video (MP4, WebM) to skip generation
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 text-green-600 mb-4">
                              <CheckCircle className="h-5 w-5" />
                              <span className="font-medium">Video uploaded</span>
                            </div>
                            <video 
                              src={uploadedMotionUrl} 
                              controls 
                              className="w-full max-h-32 rounded-lg"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setUploadedMotionFile(null);
                                setUploadedMotionUrl("");
                                setMotionVideoUrl(null);
                              }}
                              className="mt-3"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove
                            </Button>
                          </>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>

                  {/* Duration selection */}
                  {motionTab !== "upload" && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Video Duration</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={motionDuration === "5" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setMotionDuration("5")}
                          className={motionDuration === "5" ? "bg-purple-600 hover:bg-purple-700" : ""}
                          data-testid="button-duration-5"
                        >
                          5 seconds
                        </Button>
                        <Button
                          variant={motionDuration === "10" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setMotionDuration("10")}
                          className={motionDuration === "10" ? "bg-purple-600 hover:bg-purple-700" : ""}
                          data-testid="button-duration-10"
                        >
                          10 seconds
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress indicator */}
              {(isGeneratingMotion || motionStatus === "processing" || motionStatus === "pending") && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Generating motion video...
                    </span>
                    <span className="text-purple-600 font-medium">{motionProgress}%</span>
                  </div>
                  <Progress value={motionProgress} className="h-2" />
                </div>
              )}

              {motionStatus === "failed" && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <span className="text-sm text-red-700 dark:text-red-400">
                    Video generation failed. Please try again with a different prompt.
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowMotionDialog(false)}
                  data-testid="button-cancel-motion"
                >
                  Cancel
                </Button>
                <Button
                  className="bg-purple-500 hover:bg-purple-600 text-white"
                  onClick={handleGenerateMotion}
                  disabled={isGeneratingMotion || motionStatus === "processing" || motionStatus === "pending" || !motionPrompt.trim()}
                  data-testid="button-generate-motion"
                >
                  {isGeneratingMotion || motionStatus === "processing" || motionStatus === "pending" ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Motion
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* STEP 2: Voice Selection */}
          {motionDialogStep === "voice" && (
            <>
              <div className="space-y-4 py-4">
                {/* Motion video preview (small) */}
                <div className="flex gap-4 items-start">
                  <div className="w-32 h-20 rounded-lg overflow-hidden border bg-black flex-shrink-0">
                    <video
                      src={motionVideoUrl || ""}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      autoPlay
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-green-600 text-sm">
                      <CheckCircle className="h-4 w-4" />
                      Motion video ready
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Now add your voice to make your avatar speak.</p>
                  </div>
                </div>

                {/* Voice Input Mode Toggle */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">How do you want to add voice?</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={voiceInputMode === "tts" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setVoiceInputMode("tts")}
                      className={voiceInputMode === "tts" ? "bg-purple-600 hover:bg-purple-700" : ""}
                      data-testid="button-voice-mode-tts"
                    >
                      <Volume2 className="h-4 w-4 mr-1" />
                      Text to Speech
                    </Button>
                    <Button
                      variant={voiceInputMode === "record" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setVoiceInputMode("record")}
                      className={voiceInputMode === "record" ? "bg-purple-600 hover:bg-purple-700" : ""}
                      data-testid="button-voice-mode-record"
                    >
                      <Mic className="h-4 w-4 mr-1" />
                      Record Voice
                    </Button>
                    <Button
                      variant={voiceInputMode === "upload" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setVoiceInputMode("upload")}
                      className={voiceInputMode === "upload" ? "bg-purple-600 hover:bg-purple-700" : ""}
                      data-testid="button-voice-mode-upload"
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      Upload Audio
                    </Button>
                  </div>
                </div>

                {/* TTS Mode */}
                {voiceInputMode === "tts" && (
                  <>
                    {/* Voice Selection */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Select Voice</Label>
                      <Select value={selectedMotionVoice} onValueChange={setSelectedMotionVoice}>
                        <SelectTrigger data-testid="select-motion-voice">
                          <SelectValue placeholder="Choose a voice" />
                        </SelectTrigger>
                        <SelectContent>
                          {KLING_VOICES.map((voice) => (
                            <SelectItem key={voice.id} value={voice.id}>
                              {voice.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Script Input */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">What should your avatar say?</Label>
                      <Textarea
                        placeholder="Enter the script for your avatar to speak..."
                        value={motionVoiceScript}
                        onChange={(e) => setMotionVoiceScript(e.target.value)}
                        className="min-h-[120px]"
                        disabled={isGeneratingLipSync}
                        data-testid="input-motion-script"
                      />
                      <p className="text-xs text-gray-500">
                        {motionVoiceScript.split(/\s+/).filter(Boolean).length} words
                      </p>
                    </div>
                  </>
                )}

                {/* Record Mode */}
                {voiceInputMode === "record" && (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-gray-50 dark:bg-gray-900">
                      {!motionRecordedUrl ? (
                        <>
                          <div 
                            className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all ${
                              isMotionRecording 
                                ? "bg-red-500 animate-pulse" 
                                : "bg-purple-100 dark:bg-purple-900"
                            }`}
                          >
                            <Mic className={`h-10 w-10 ${isMotionRecording ? "text-white" : "text-purple-600"}`} />
                          </div>
                          {isMotionRecording && (
                            <div className="text-2xl font-mono text-red-500 mb-4">
                              {formatTime(motionRecordingTime)}
                            </div>
                          )}
                          <Button
                            onClick={isMotionRecording ? stopMotionRecording : startMotionRecording}
                            className={isMotionRecording 
                              ? "bg-red-500 hover:bg-red-600" 
                              : "bg-purple-500 hover:bg-purple-600"}
                            data-testid={isMotionRecording ? "button-stop-motion-recording" : "button-start-motion-recording"}
                          >
                            {isMotionRecording ? (
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
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 text-green-600 mb-4">
                            <CheckCircle className="h-5 w-5" />
                            <span className="font-medium">Recording saved ({formatTime(motionRecordingTime)})</span>
                          </div>
                          <audio 
                            src={motionRecordedUrl} 
                            controls 
                            className="w-full max-w-xs mb-4"
                            data-testid="audio-motion-recording"
                          />
                          <Button
                            variant="outline"
                            onClick={clearMotionRecording}
                            data-testid="button-clear-motion-recording"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Record Again
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Upload Audio Mode */}
                {voiceInputMode === "upload" && (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-gray-50 dark:bg-gray-900">
                      {!uploadedAudioUrl ? (
                        <>
                          <Upload className="h-10 w-10 text-gray-400 mb-4" />
                          <Label 
                            htmlFor="audio-upload" 
                            className="cursor-pointer bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-md"
                          >
                            Choose Audio File
                          </Label>
                          <input
                            id="audio-upload"
                            type="file"
                            accept="audio/*"
                            onChange={handleUploadAudio}
                            className="hidden"
                            data-testid="input-upload-audio"
                          />
                          <p className="text-xs text-gray-500 mt-3 text-center">
                            Upload an MP3, WAV, or other audio file.
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 text-green-600 mb-4">
                            <CheckCircle className="h-5 w-5" />
                            <span className="font-medium">Audio uploaded: {uploadedAudioFile?.name}</span>
                          </div>
                          <audio 
                            src={uploadedAudioUrl} 
                            controls 
                            className="w-full max-w-xs mb-4"
                            data-testid="audio-uploaded"
                          />
                          <Button
                            variant="outline"
                            onClick={() => {
                              setUploadedAudioFile(null);
                              setUploadedAudioUrl("");
                            }}
                            data-testid="button-remove-audio"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove & Choose Another
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Lip-sync progress */}
                {(isGeneratingLipSync || lipSyncStatus === "processing" || lipSyncStatus === "pending") && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        Adding voice to video...
                      </span>
                      <span className="text-purple-600 font-medium">{lipSyncProgress}%</span>
                    </div>
                    <Progress value={lipSyncProgress} className="h-2" />
                  </div>
                )}

                {lipSyncStatus === "failed" && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <span className="text-sm text-red-700 dark:text-red-400">
                      Failed to add voice. Please try again.
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-between gap-3 pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => setMotionDialogStep("motion")}
                  data-testid="button-back-to-motion"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <div className="flex gap-2">
                  {/* Save Motion Video - allows saving without voice */}
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (motionVideoUrl) {
                        const link = document.createElement("a");
                        link.href = motionVideoUrl;
                        link.download = `motion-avatar-${Date.now()}.mp4`;
                        link.target = "_blank";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        toast({
                          title: "Download Started",
                          description: "Your motion video is being downloaded.",
                        });
                      }
                    }}
                    data-testid="button-save-motion"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Save Motion
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setMotionDialogStep("final");
                      setFinalVideoUrl(motionVideoUrl);
                    }}
                    data-testid="button-skip-voice"
                  >
                    Skip Voice
                  </Button>
                  <Button
                    className="bg-purple-500 hover:bg-purple-600 text-white"
                    onClick={async () => {
                      if (voiceInputMode === "tts" && !motionVoiceScript.trim()) {
                        toast({
                          title: "Enter a script",
                          description: "Please write what you want your avatar to say.",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      if (voiceInputMode === "record" && !motionRecordedBlob) {
                        toast({
                          title: "Record your voice",
                          description: "Please record your voice before continuing.",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      if (voiceInputMode === "upload" && !uploadedAudioFile) {
                        toast({
                          title: "Upload an audio file",
                          description: "Please upload an audio file before continuing.",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      if (!motionVideoUrl) {
                        toast({
                          title: "No motion video",
                          description: "Please generate a motion video first.",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      setIsGeneratingLipSync(true);
                      setLipSyncStatus("processing");
                      setLipSyncProgress(10);
                      
                      try {
                        let audioUrl: string | undefined;
                        
                        if (voiceInputMode === "record" && motionRecordedBlob) {
                          setLipSyncProgress(15);
                          const formData = new FormData();
                          formData.append("audio", motionRecordedBlob, "recording.webm");
                          
                          const uploadResponse = await fetch("/api/kling/upload-audio", {
                            method: "POST",
                            credentials: "include",
                            body: formData,
                          });
                          
                          const uploadResult = await uploadResponse.json();
                          if (!uploadResponse.ok || !uploadResult.audioUrl) {
                            throw new Error(uploadResult.error || "Failed to upload recorded audio");
                          }
                          audioUrl = uploadResult.audioUrl;
                          setLipSyncProgress(30);
                        } else if (voiceInputMode === "upload" && uploadedAudioFile) {
                          setLipSyncProgress(15);
                          const formData = new FormData();
                          formData.append("audio", uploadedAudioFile);
                          
                          const uploadResponse = await fetch("/api/kling/upload-audio", {
                            method: "POST",
                            credentials: "include",
                            body: formData,
                          });
                          
                          const uploadResult = await uploadResponse.json();
                          if (!uploadResponse.ok || !uploadResult.audioUrl) {
                            throw new Error(uploadResult.error || "Failed to upload audio file");
                          }
                          audioUrl = uploadResult.audioUrl;
                          setLipSyncProgress(30);
                        }
                        
                        let finalVideoForLipSync = motionVideoUrl;
                        if (motionVideoUrl?.startsWith("blob:") && uploadedMotionFile) {
                          setLipSyncProgress(35);
                          const videoFormData = new FormData();
                          videoFormData.append("video", uploadedMotionFile);
                          
                          const videoUploadResponse = await fetch("/api/kling/upload-video", {
                            method: "POST",
                            credentials: "include",
                            body: videoFormData,
                          });
                          
                          const videoUploadResult = await videoUploadResponse.json();
                          if (!videoUploadResponse.ok || !videoUploadResult.videoUrl) {
                            throw new Error(videoUploadResult.error || "Failed to upload motion video");
                          }
                          finalVideoForLipSync = videoUploadResult.videoUrl;
                          setLipSyncProgress(45);
                        }
                        
                        const lipSyncBody: Record<string, unknown> = {
                          videoUrl: finalVideoForLipSync,
                        };
                        
                        if (audioUrl) {
                          lipSyncBody.mode = "audio2video";
                          lipSyncBody.audioUrl = audioUrl;
                        } else {
                          lipSyncBody.mode = "text2video";
                          lipSyncBody.text = motionVoiceScript.trim();
                          lipSyncBody.voiceId = selectedMotionVoice || "female_calm";
                        }
                        
                        const response = await fetch("/api/kling/lip-sync", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify(lipSyncBody),
                        });
                        
                        const result = await response.json();
                        
                        if (!response.ok) {
                          throw new Error(result.error || "Failed to add voice");
                        }
                        
                        if (result.videoUrl) {
                          setFinalVideoUrl(result.videoUrl);
                          setLipSyncStatus("completed");
                          setLipSyncProgress(100);
                          setMotionDialogStep("final");
                          toast({
                            title: "Video Complete!",
                            description: "Your talking avatar video is ready.",
                          });
                        } else if (result.taskId) {
                          // Poll for completion
                          const pollLipSync = async () => {
                            const maxPolls = 60;
                            let pollCount = 0;
                            
                            const poll = async () => {
                              try {
                                const statusRes = await fetch(`/api/kling/status/${result.taskId}`, {
                                  credentials: "include",
                                });
                                const statusResult = await statusRes.json();
                                pollCount++;
                                
                                setLipSyncProgress(Math.min(95, 50 + Math.round((pollCount / maxPolls) * 50)));
                                
                                if (statusResult.status === "completed" && statusResult.videoUrl) {
                                  setFinalVideoUrl(statusResult.videoUrl);
                                  setLipSyncStatus("completed");
                                  setLipSyncProgress(100);
                                  setMotionDialogStep("final");
                                  toast({
                                    title: "Video Complete!",
                                    description: "Your talking avatar video is ready.",
                                  });
                                  return;
                                }
                                
                                if (statusResult.status === "failed") {
                                  throw new Error(statusResult.error || "Lip sync failed");
                                }
                                
                                if (pollCount < maxPolls && (statusResult.status === "pending" || statusResult.status === "processing")) {
                                  setTimeout(poll, 5000);
                                }
                              } catch (error) {
                                console.error("Lip sync poll error:", error);
                                setLipSyncStatus("failed");
                              }
                            };
                            
                            poll();
                          };
                          pollLipSync();
                        }
                      } catch (error) {
                        console.error("Lip sync error:", error);
                        setLipSyncStatus("failed");
                        toast({
                          title: "Voice Addition Failed",
                          description: error instanceof Error ? error.message : "Failed to add voice",
                          variant: "destructive",
                        });
                      } finally {
                        setIsGeneratingLipSync(false);
                      }
                    }}
                    disabled={isGeneratingLipSync || lipSyncStatus === "processing"}
                    data-testid="button-add-voice"
                  >
                    {isGeneratingLipSync || lipSyncStatus === "processing" ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-4 w-4 mr-2" />
                        Add Voice
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* STEP 3: Final Preview */}
          {motionDialogStep === "final" && (
            <>
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-center gap-2 text-green-600 mb-4">
                  <CheckCircle className="h-6 w-6" />
                  <span className="font-medium text-lg">Your video is ready!</span>
                </div>
                
                <div className="rounded-lg overflow-hidden border shadow-md bg-black">
                  <video
                    src={finalVideoUrl || motionVideoUrl || ""}
                    controls
                    autoPlay
                    className="w-full max-h-80 object-contain"
                    data-testid="video-final-result"
                  />
                </div>

                <div className="flex justify-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(finalVideoUrl || motionVideoUrl || "", "_blank")}
                    data-testid="button-download-final"
                  >
                    <Video className="h-4 w-4 mr-2" />
                    Open in New Tab
                  </Button>
                </div>
              </div>

              <div className="flex justify-between gap-3 pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => setMotionDialogStep("voice")}
                  data-testid="button-back-to-voice"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <Button
                  onClick={() => setShowMotionDialog(false)}
                  className="bg-green-500 hover:bg-green-600 text-white"
                  data-testid="button-done"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Done
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
