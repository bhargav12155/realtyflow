import { useState, useRef, useEffect, useMemo, useCallback, memo, forwardRef, useImperativeHandle } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import heic2any from "heic2any";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient, downloadFile } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useLocation } from "wouter";
import {
  Upload,
  Wand2,
  Play,
  Loader2,
  Check,
  Download,
  RefreshCw,
  Image,
  FileText,
  Video,
  ChevronRight,
  ChevronLeft,
  X,
  Volume2,
  Mic,
  Square,
  Trash2,
  Share2,
  Clock,
  ExternalLink,
  Sparkles,
  RotateCcw,
  Search,
  Save,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Voice {
  voice_id: string;
  name: string;
  language: string;
  gender: string;
  preview_audio?: string;
  is_custom?: boolean;
  custom_voice_id?: string;
}

interface PhotoAsset {
  id: string;
  url: string;
  thumbnailUrl?: string;
  title?: string;
  metadata?: {
    imageKey: string;
    heygenAssetId: string;
  };
  createdAt?: string;
}

const FALLBACK_VOICES: Voice[] = [
  { voice_id: "119caed25533477ba63822d5d1552d25", name: "Default Voice", language: "English", gender: "female" },
];

const MOTION_PROMPTS = [
  { id: "natural", label: "Natural", prompt: "nodding and smiling naturally while speaking, making gentle hand gestures" },
  { id: "professional", label: "Professional", prompt: "professional business presenter with confident posture" },
  { id: "enthusiastic", label: "Enthusiastic", prompt: "enthusiastic and energetic with expressive hand gestures" },
  { id: "calm", label: "Calm", prompt: "calm and thoughtful, speaking slowly" },
  { id: "friendly", label: "Friendly", prompt: "friendly customer service representative" },
];

const SCRIPT_STYLES = [
  { id: "property_tour", label: "Property Tour", description: "Showcase property features and highlights" },
  { id: "listing_spotlight", label: "Listing Spotlight", description: "Quick attention-grabbing listing preview" },
  { id: "market_update", label: "Market Update", description: "Local real estate market insights" },
  { id: "agent_intro", label: "Agent Introduction", description: "Professional self-introduction" },
  { id: "neighborhood_guide", label: "Neighborhood Guide", description: "Area highlights and amenities" },
];

const STEPS = [
  { id: 1, title: "Upload Photo", icon: Image },
  { id: 2, title: "Write Script", icon: FileText },
  { id: 3, title: "Generate Video", icon: Video },
];

// Isolated input components to prevent parent re-renders on typing
interface IsolatedInputHandle {
  getValue: () => string;
  setValue: (value: string) => void;
}

const IsolatedInput = memo(forwardRef<IsolatedInputHandle, {
  initialValue: string;
  onBlur: (value: string) => void;
  placeholder?: string;
  className?: string;
  testId?: string;
}>(({ initialValue, onBlur, placeholder, className, testId }, ref) => {
  const [localValue, setLocalValue] = useState(initialValue);
  
  useImperativeHandle(ref, () => ({
    getValue: () => localValue,
    setValue: (value: string) => setLocalValue(value),
  }));
  
  return (
    <input
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => onBlur(localValue)}
      placeholder={placeholder}
      className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className || ''}`}
      data-testid={testId}
    />
  );
}));

const IsolatedTextarea = memo(forwardRef<IsolatedInputHandle, {
  initialValue: string;
  onBlur: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}>(({ initialValue, onBlur, placeholder, maxLength = 1500 }, ref) => {
  const [localValue, setLocalValue] = useState(initialValue);
  
  useImperativeHandle(ref, () => ({
    getValue: () => localValue,
    setValue: (value: string) => setLocalValue(value),
  }));
  
  return (
    <div>
      <textarea
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value.slice(0, maxLength))}
        onBlur={() => onBlur(localValue)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="flex min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="input-script"
      />
      <p className="text-xs text-gray-400 mt-1">
        {localValue.length}/{maxLength} characters
      </p>
    </div>
  );
}));

interface VideoStatus {
  video_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  error?: string;
}

interface VideoJob {
  id: number;
  videoId: string;
  title: string;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: string;
  videoUrl?: string;
}

export function AvatarIVStudio() {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(true);
  const [isConvertingHeic, setIsConvertingHeic] = useState(false);
  
  const [videoTitle, setVideoTitle] = useState("");
  const [script, setScript] = useState("");
  const [scriptStyle, setScriptStyle] = useState(SCRIPT_STYLES[0].id);
  const videoTitleRef = useRef<IsolatedInputHandle>(null);
  const scriptTextareaRef = useRef<IsolatedInputHandle>(null);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [voiceSearch, setVoiceSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<"all" | "female" | "male">("all");
  const [selectedMotion, setSelectedMotion] = useState(MOTION_PROMPTS[0].id);
  const [videoOrientation, setVideoOrientation] = useState<"landscape" | "portrait">("landscape");
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);
  
  // Background generation mode
  const [runInBackground, setRunInBackground] = useState(false);
  
  // Audio recording state
  const [inputMode, setInputMode] = useState<"text" | "audio">("text");
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const [generatingVideoId, setGeneratingVideoId] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<VideoStatus | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  // WebSocket for background job notifications
  const handleWebSocketMessage = (message: any) => {
    if (message.type === "video_generation_complete") {
      const { videoId, title, videoUrl } = message.data;
      queryClient.invalidateQueries({ queryKey: ["/api/video-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quick-posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/generated-videos"] });
      toast({
        title: "🎉 Video Ready!",
        description: `"${title || 'Your video'}" has finished generating.`,
        action: (
          <Button
            size="sm"
            onClick={() => setLocation(`/dashboard?tab=video-generator&videoId=${videoId}`)}
            data-testid="toast-view-video"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            View Video
          </Button>
        ),
        duration: 10000,
      });
    } else if (message.type === "video_generation_failed") {
      const { title, error } = message.data;
      queryClient.invalidateQueries({ queryKey: ["/api/video-jobs"] });
      toast({
        title: "Video Generation Failed",
        description: `"${title || 'Your video'}" failed: ${error || 'Unknown error'}`,
        variant: "destructive",
        duration: 8000,
      });
    }
  };

  const { isConnected } = useWebSocket({
    userId: user?.id?.toString() || undefined,
    onMessage: handleWebSocketMessage,
    autoConnect: isAuthenticated && !!user?.id,
    showToast: false,
  });

  // Fetch active video jobs
  const { data: videoJobsData, isLoading: jobsLoading } = useQuery<{ jobs: VideoJob[] }>({
    queryKey: ["/api/video-jobs"],
    refetchInterval: 30000,
    enabled: isAuthenticated,
  });

  const activeJobs = videoJobsData?.jobs?.filter(
    (job) => job.status === "pending" || job.status === "processing"
  ) || [];

  // Fetch photo library
  const { data: photosData, isLoading: photosLoading, refetch: refetchPhotos } = useQuery<{ photos: PhotoAsset[] }>({
    queryKey: ["/api/avatar-iv/photos"],
  });

  const photoLibrary = photosData?.photos || [];

  // Fetch available voices from HeyGen
  const { data: voicesData, isLoading: voicesLoading } = useQuery<{ voices: Voice[] }>({
    queryKey: ["/api/avatar-iv/voices"],
  });

  const voices = voicesData?.voices || FALLBACK_VOICES;
  
  // Filter voices based on search and gender
  const filteredVoices = useMemo(() => {
    return voices.filter((voice) => {
      // Gender filter
      if (genderFilter !== "all") {
        const voiceGender = voice.gender?.toLowerCase() || "";
        if (voiceGender !== genderFilter) return false;
      }
      // Text search
      if (voiceSearch.trim()) {
        const searchLower = voiceSearch.toLowerCase();
        const nameMatch = voice.name?.toLowerCase().includes(searchLower);
        const languageMatch = voice.language?.toLowerCase().includes(searchLower);
        if (!nameMatch && !languageMatch) return false;
      }
      return true;
    });
  }, [voices, genderFilter, voiceSearch]);
  
  // Set default voice when voices load
  useEffect(() => {
    if (voices.length > 0 && !selectedVoice) {
      setSelectedVoice(voices[0].voice_id);
    }
  }, [voices, selectedVoice]);

  // Sync values from refs when needed
  const syncFromRefs = useCallback(() => {
    if (videoTitleRef.current) {
      setVideoTitle(videoTitleRef.current.getValue());
    }
    if (scriptTextareaRef.current) {
      setScript(scriptTextareaRef.current.getValue());
    }
  }, []);

  // Select photo from library
  const selectFromLibrary = (photo: PhotoAsset) => {
    if (photo.metadata?.imageKey) {
      setImageKey(photo.metadata.imageKey);
      setImagePreview(photo.url);
      toast({
        title: "Photo Selected",
        description: "Using photo from your library. Now write your script.",
      });
      setCurrentStep(2);
    } else {
      toast({
        title: "Invalid Photo",
        description: "This photo is missing required data. Please upload a new one.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollInterval]);

  const playVoicePreview = (previewUrl: string, voiceId: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (playingPreview === voiceId) {
      setPlayingPreview(null);
      return;
    }
    audioRef.current = new Audio(previewUrl);
    audioRef.current.play();
    setPlayingPreview(voiceId);
    audioRef.current.onended = () => setPlayingPreview(null);
  };

  // Audio recording functions - detect best supported format
  const getSupportedMimeType = () => {
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
      "audio/wav",
      ""  // Fallback to browser default
    ];
    for (const type of types) {
      if (type === "" || MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return "";
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
      const mimeType = getSupportedMimeType();
      console.log("Using audio format:", mimeType || "browser default");
      
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const recordedMime = mediaRecorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: recordedMime });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast({
        title: "Recording Started",
        description: "Speak now. Click stop when finished.",
      });
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
    }
  };

  const clearRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setUploadedAudioUrl(null);
  };

  // Upload recorded audio
  const audioUploadMutation = useMutation({
    mutationFn: async (blob: Blob) => {
      const formData = new FormData();
      // Determine file extension from mime type
      let ext = "webm";
      if (blob.type.includes("mp4") || blob.type.includes("m4a")) ext = "m4a";
      else if (blob.type.includes("ogg")) ext = "ogg";
      else if (blob.type.includes("wav")) ext = "wav";
      formData.append("audio", blob, `recording.${ext}`);

      const response = await fetch("/api/avatar-iv/upload-audio", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Audio upload failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setUploadedAudioUrl(data.audioUrl);
      toast({
        title: "Audio Uploaded",
        description: "Your recording is ready for video generation.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error?.message || "Could not upload audio",
        variant: "destructive",
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/avatar-iv/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setImageKey(data.imageKey);
      setImagePreview(data.imageUrl);
      queryClient.invalidateQueries({ queryKey: ["/api/avatar-iv/photos"] });
      toast({
        title: "Photo Uploaded!",
        description: "Your photo is ready and saved to your library. Now write your script.",
      });
      setCurrentStep(2);
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error?.message || "Could not upload photo",
        variant: "destructive",
      });
    },
  });

  // AI Script generation mutation
  const generateScriptMutation = useMutation({
    mutationFn: async () => {
      const trimmedTitle = videoTitle.trim();
      if (!trimmedTitle) {
        throw new Error("Please enter a video title first");
      }
      if (!imageKey) {
        throw new Error("Please upload or select a photo first");
      }
      const response = await apiRequest("POST", "/api/generate-script", {
        topic: trimmedTitle,
        neighborhood: "Omaha",
        videoType: scriptStyle,
        platform: "Social Media",
        duration: 30,
      });
      return response.json();
    },
    onSuccess: (data) => {
      const generatedScript = data.script?.slice(0, 1500) || "";
      setScript(generatedScript);
      // Update the textarea ref with the new script
      if (scriptTextareaRef.current) {
        scriptTextareaRef.current.setValue(generatedScript);
      }
      toast({
        title: "Script Generated!",
        description: "AI has created a script for your video. Feel free to edit it.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Script Generation Failed",
        description: error.message || "Could not generate script",
        variant: "destructive",
      });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const motionPrompt = MOTION_PROMPTS.find(m => m.id === selectedMotion)?.prompt;
      
      // Build payload based on input mode
      const payload: any = {
        imageKey,
        videoTitle: videoTitle || "My Video",
        videoOrientation,
        fit: "cover",
        customMotionPrompt: motionPrompt,
        enhanceCustomMotionPrompt: true,
        runInBackground,
      };

      if (inputMode === "audio" && uploadedAudioUrl) {
        payload.audioUrl = uploadedAudioUrl;
      } else {
        payload.script = script;
        payload.voiceId = selectedVoice;
      }
      
      const response = await apiRequest("POST", "/api/avatar-iv/generate", payload);
      return response.json();
    },
    onSuccess: (data: any) => {
      console.log("Generate response:", data);
      const videoId = data.videoId;
      if (!videoId) {
        toast({
          title: "Generation Error",
          description: "No video ID returned from server",
          variant: "destructive",
        });
        return;
      }
      
      // Handle background mode differently
      if (runInBackground) {
        queryClient.invalidateQueries({ queryKey: ["/api/video-jobs"] });
        toast({
          title: "Video Generation Started!",
          description: "You'll receive a notification when it's ready. Feel free to continue working.",
          duration: 5000,
        });
        // Reset form but stay on step 2 for quick new generations
        setVideoTitle("");
        setScript("");
        setAudioBlob(null);
        setAudioUrl(null);
        setUploadedAudioUrl(null);
      } else {
        // Foreground mode - show polling UI
        setGeneratingVideoId(videoId);
        setVideoStatus({ video_id: videoId, status: "pending" });
        toast({
          title: "Video Generation Started!",
          description: "Your video is being created. This usually takes 1-3 minutes.",
        });
        setCurrentStep(3);
        startPolling(videoId, videoTitle || "My Video", inputMode === "audio" ? "(Audio recording)" : script);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error?.message || "Could not start video generation",
        variant: "destructive",
      });
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      await apiRequest("DELETE", `/api/avatar-iv/photos/${photoId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/avatar-iv/photos"] });
      toast({ title: "Photo deleted", description: "Photo removed from your library." });
    },
    onError: (error: any) => {
      toast({ title: "Delete failed", description: error.message || "Could not delete photo", variant: "destructive" });
    },
  });

  const startPolling = (videoId: string, vidTitle?: string, vidScript?: string) => {
    if (!videoId) {
      console.error("Cannot start polling without a video ID");
      return;
    }
    if (pollInterval) clearInterval(pollInterval);
    
    console.log("Starting status polling for video:", videoId);
    
    const interval = setInterval(async () => {
      try {
        // Pass title and script as query params for saving to library
        const params = new URLSearchParams();
        if (vidTitle) params.set("title", vidTitle);
        if (vidScript) params.set("script", vidScript);
        const queryString = params.toString();
        
        const response = await fetch(`/api/avatar-iv/status/${videoId}${queryString ? `?${queryString}` : ""}`, {
          credentials: "include",
        });
        
        if (!response.ok) return;
        
        const status: VideoStatus = await response.json();
        setVideoStatus(status);
        
        if (status.status === "completed" || status.status === "failed") {
          clearInterval(interval);
          setPollInterval(null);
          
          if (status.status === "completed") {
            // Invalidate quick posts library so video appears there
            queryClient.invalidateQueries({ queryKey: ["/api/quick-posts"] });
            queryClient.invalidateQueries({ queryKey: ["/api/generated-videos"] });
            toast({
              title: "Video Ready!",
              description: "Your video has been generated and saved to your library.",
            });
          } else {
            toast({
              title: "Generation Failed",
              description: status.error || "Video generation failed",
              variant: "destructive",
            });
          }
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    }, 5000);
    
    setPollInterval(interval);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log("File selected:", file?.name, file?.type, file?.size);
    if (!file) return;

    const isHeic = file.type === "image/heic" || file.type === "image/heif" || 
                   file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif");

    if (!file.type.startsWith("image/") && !isHeic) {
      toast({
        title: "Invalid File",
        description: "Please select an image file (JPG, PNG, HEIC)",
        variant: "destructive",
      });
      return;
    }

    setUploadedImage(file);

    if (isHeic) {
      try {
        setIsConvertingHeic(true);
        console.log("Converting HEIC to JPEG for preview...");
        const convertedBlob = await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.8,
        });
        const jpegBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          console.log("HEIC converted preview length:", result?.length);
          setImagePreview(result);
          setIsConvertingHeic(false);
        };
        reader.onerror = (err) => {
          console.error("FileReader error after HEIC conversion:", err);
          setIsConvertingHeic(false);
        };
        reader.readAsDataURL(jpegBlob);
      } catch (err) {
        console.error("HEIC conversion error:", err);
        setIsConvertingHeic(false);
        toast({
          title: "Preview Failed",
          description: "Could not preview HEIC file, but you can still upload it.",
          variant: "destructive",
        });
      }
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        console.log("FileReader result length:", result?.length);
        setImagePreview(result);
      };
      reader.onerror = (err) => {
        console.error("FileReader error:", err);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = () => {
    if (uploadedImage) {
      uploadMutation.mutate(uploadedImage);
    }
  };

  const resetStudio = () => {
    setCurrentStep(1);
    setUploadedImage(null);
    setImagePreview(null);
    setImageKey(null);
    setVideoTitle("");
    setScript("");
    if (videoTitleRef.current) {
      videoTitleRef.current.setValue("");
    }
    if (scriptTextareaRef.current) {
      scriptTextareaRef.current.setValue("");
    }
    setGeneratingVideoId(null);
    setVideoStatus(null);
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
  };

  const canProceedToStep2 = !!imageKey;
  const canProceedToStep3 = canProceedToStep2 && script.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Active Background Jobs Section */}
      {activeJobs.length > 0 && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-blue-600 animate-pulse" />
              <span>Background Jobs</span>
              <Badge variant="secondary" className="ml-auto">
                {activeJobs.length} generating
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {activeJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border"
                  data-testid={`job-item-${job.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{job.title}</p>
                      <p className="text-xs text-gray-500 capitalize">{job.status}</p>
                    </div>
                  </div>
                  <Badge variant={job.status === "processing" ? "default" : "secondary"}>
                    {job.status === "processing" ? "Processing..." : "Queued"}
                  </Badge>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">
              You'll receive a notification when each video is ready
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-[#D4AF37]" />
            Quick Video Creator
          </CardTitle>
          <CardDescription>
            Create AI-powered talking videos in 3 simple steps
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-8">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              const isClickable = step.id < currentStep || 
                (step.id === 2 && canProceedToStep2) || 
                (step.id === 3 && canProceedToStep3);

              return (
                <div key={step.id} className="flex items-center flex-1">
                  <button
                    onClick={() => isClickable && setCurrentStep(step.id)}
                    disabled={!isClickable}
                    className={`flex flex-col items-center flex-1 ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                    data-testid={`step-${step.id}`}
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all ${
                        isActive
                          ? "bg-[#D4AF37] text-white shadow-lg"
                          : isCompleted
                          ? "bg-green-500 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="h-6 w-6" />
                      ) : (
                        <StepIcon className="h-6 w-6" />
                      )}
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        isActive ? "text-[#D4AF37]" : isCompleted ? "text-green-600" : "text-gray-500"
                      }`}
                    >
                      {step.title}
                    </span>
                  </button>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`h-1 flex-1 mx-2 rounded ${
                        currentStep > step.id ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <Progress 
            value={(currentStep / 3) * 100} 
            className="mb-6 h-2"
            data-testid="progress-indicator"
          />

          {currentStep === 1 && (
            <div className="space-y-6" data-testid="step-1-content">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Select Your Photo</h3>
                <p className="text-gray-500 text-sm mb-4">
                  Choose from your library or upload a new photo
                </p>
              </div>

              <div className="flex justify-center gap-2 mb-4">
                <Button
                  variant={showLibrary ? "default" : "outline"}
                  onClick={() => setShowLibrary(true)}
                  className={showLibrary ? "bg-[#D4AF37] hover:bg-[#D4AF37]/90" : ""}
                  data-testid="tab-library"
                >
                  <Image className="h-4 w-4 mr-2" />
                  My Library ({photoLibrary.length})
                </Button>
                <Button
                  variant={!showLibrary ? "default" : "outline"}
                  onClick={() => setShowLibrary(false)}
                  className={!showLibrary ? "bg-[#D4AF37] hover:bg-[#D4AF37]/90" : ""}
                  data-testid="tab-upload"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload New
                </Button>
              </div>

              {showLibrary ? (
                <div className="space-y-4">
                  {photosLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
                    </div>
                  ) : photoLibrary.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-xl">
                      <Image className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500 mb-2">No photos in your library yet</p>
                      <Button
                        variant="outline"
                        onClick={() => setShowLibrary(false)}
                        data-testid="button-upload-first"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Your First Photo
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                      {photoLibrary.map((photo) => (
                        <div
                          key={photo.id}
                          onClick={() => selectFromLibrary(photo)}
                          className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all hover:border-[#D4AF37] hover:shadow-lg ${
                            imageKey === photo.metadata?.imageKey
                              ? "border-[#D4AF37] ring-2 ring-[#D4AF37]"
                              : "border-gray-200 dark:border-gray-700"
                          }`}
                          data-testid={`photo-library-${photo.id}`}
                        >
                          <img
                            src={photo.thumbnailUrl || photo.url}
                            alt={photo.title || "Photo"}
                            className="w-full aspect-square object-cover"
                          />
                          {imageKey === photo.metadata?.imageKey && (
                            <div className="absolute inset-0 bg-[#D4AF37]/20 flex items-center justify-center">
                              <Check className="h-8 w-8 text-[#D4AF37]" />
                            </div>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="absolute top-1 right-1 w-6 h-6 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center z-20 transition-colors"
                                data-testid={`button-menu-photo-${photo.id}`}
                              >
                                <MoreVertical className="h-3.5 w-3.5 text-white" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm("Delete this photo? This cannot be undone.")) {
                                    deletePhotoMutation.mutate(photo.id);
                                  }
                                }}
                                className="text-red-600 focus:text-red-600"
                                data-testid={`button-delete-photo-${photo.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {isConvertingHeic ? (
                    <div className="border-2 border-dashed rounded-xl p-12 text-center">
                      <Loader2 className="h-12 w-12 mx-auto text-[#D4AF37] mb-4 animate-spin" />
                      <p className="text-gray-500 mb-2">Converting HEIC image...</p>
                      <p className="text-xs text-gray-400">This may take a few seconds</p>
                    </div>
                  ) : !imagePreview ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-[#D4AF37] hover:bg-[#D4AF37]/5 transition-all"
                      data-testid="upload-dropzone"
                    >
                      <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500 mb-2">Click to upload or drag and drop</p>
                      <p className="text-xs text-gray-400">PNG, JPG, HEIC up to 10MB</p>
                    </div>
                  ) : (
                    <div className="relative max-w-md mx-auto">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full rounded-xl shadow-lg"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          setUploadedImage(null);
                          setImagePreview(null);
                          setImageKey(null);
                        }}
                        data-testid="button-remove-image"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {uploadedImage && !imageKey && (
                    <div className="flex justify-center">
                      <Button
                        onClick={handleUpload}
                        disabled={uploadMutation.isPending}
                        className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white px-8"
                        data-testid="button-upload"
                      >
                        {uploadMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Photo
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                className="hidden"
                onChange={handleFileSelect}
                data-testid="input-file"
              />

              {imageKey && (
                <div className="flex justify-center">
                  <Button
                    onClick={() => setCurrentStep(2)}
                    className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white px-8"
                    data-testid="button-next-step-1"
                  >
                    Continue to Script
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6" data-testid="step-2-content">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold mb-2">Add Your Voice</h3>
                <p className="text-gray-500 text-sm">
                  Type a script or record your own voice
                </p>
              </div>

              {/* Input Mode Toggle */}
              <div className="flex justify-center gap-2 mb-4">
                <Button
                  variant={inputMode === "text" ? "default" : "outline"}
                  onClick={() => setInputMode("text")}
                  className={inputMode === "text" ? "bg-[#D4AF37] hover:bg-[#D4AF37]/90" : ""}
                  data-testid="button-text-mode"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Type Script
                </Button>
                <Button
                  variant={inputMode === "audio" ? "default" : "outline"}
                  onClick={() => setInputMode("audio")}
                  className={inputMode === "audio" ? "bg-[#D4AF37] hover:bg-[#D4AF37]/90" : ""}
                  data-testid="button-audio-mode"
                >
                  <Mic className="h-4 w-4 mr-2" />
                  Record Audio
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="videoTitle">Video Title</Label>
                    <IsolatedInput
                      ref={videoTitleRef}
                      initialValue={videoTitle}
                      onBlur={(value) => setVideoTitle(value)}
                      placeholder="My Marketing Video"
                      className="mt-1"
                      testId="input-video-title"
                    />
                  </div>

                  {inputMode === "text" ? (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="scriptStyle">Script Style</Label>
                        <Select value={scriptStyle} onValueChange={setScriptStyle}>
                          <SelectTrigger className="mt-1" data-testid="select-script-style">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SCRIPT_STYLES.map((style) => (
                              <SelectItem key={style.id} value={style.id}>
                                <div className="flex flex-col">
                                  <span>{style.label}</span>
                                  <span className="text-xs text-gray-500">{style.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <Label htmlFor="script">Script (max 1500 characters)</Label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              syncFromRefs();
                              generateScriptMutation.mutate();
                            }}
                            disabled={generateScriptMutation.isPending || !videoTitle.trim() || !imageKey}
                            title={!imageKey ? "Upload a photo first" : !videoTitle.trim() ? "Enter a video title first" : "Generate script with AI"}
                            data-testid="button-ai-generate-script"
                          >
                            {generateScriptMutation.isPending ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3 w-3 mr-1" />
                                AI Generate
                              </>
                            )}
                          </Button>
                        </div>
                        <IsolatedTextarea
                          ref={scriptTextareaRef}
                          initialValue={script}
                          onBlur={(value) => setScript(value)}
                          placeholder="Hello! Welcome to my video. I'm excited to share..."
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Label>Record Your Voice</Label>
                      
                      {!audioBlob ? (
                        <div className="flex flex-col items-center gap-4 p-6 border-2 border-dashed rounded-lg">
                          {isRecording ? (
                            <>
                              <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center animate-pulse">
                                <Mic className="h-8 w-8 text-white" />
                              </div>
                              <p className="text-sm text-gray-500">Recording...</p>
                              <Button
                                onClick={stopRecording}
                                variant="destructive"
                                data-testid="button-stop-recording"
                              >
                                <Square className="h-4 w-4 mr-2" />
                                Stop Recording
                              </Button>
                            </>
                          ) : (
                            <>
                              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                                <Mic className="h-8 w-8 text-gray-400" />
                              </div>
                              <p className="text-sm text-gray-500">Click to start recording</p>
                              <Button
                                onClick={startRecording}
                                className="bg-[#D4AF37] hover:bg-[#D4AF37]/90"
                                data-testid="button-start-recording"
                              >
                                <Mic className="h-4 w-4 mr-2" />
                                Start Recording
                              </Button>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                              <Check className="h-5 w-5 text-green-600" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">Recording Ready</p>
                              <p className="text-sm text-gray-500">
                                {uploadedAudioUrl ? "Uploaded and ready" : "Click upload to continue"}
                              </p>
                            </div>
                          </div>
                          
                          {audioUrl && (
                            <audio controls src={audioUrl} className="w-full" data-testid="audio-preview" />
                          )}
                          
                          <div className="flex gap-2">
                            {!uploadedAudioUrl && (
                              <Button
                                onClick={() => audioBlob && audioUploadMutation.mutate(audioBlob)}
                                disabled={audioUploadMutation.isPending}
                                className="bg-[#D4AF37] hover:bg-[#D4AF37]/90"
                                data-testid="button-upload-audio"
                              >
                                {audioUploadMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Upload className="h-4 w-4 mr-2" />
                                )}
                                Upload Recording
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              onClick={clearRecording}
                              data-testid="button-retake-recording"
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Retake
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {inputMode === "text" && (
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        Voice
                        {voicesLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                        <Badge variant="secondary" className="text-xs">
                          {filteredVoices.length} of {voices.length}
                        </Badge>
                      </Label>
                      
                      {/* Search and Gender Filter */}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="Search voices..."
                            value={voiceSearch}
                            onChange={(e) => setVoiceSearch(e.target.value)}
                            className="pl-9"
                            data-testid="input-voice-search"
                          />
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant={genderFilter === "all" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setGenderFilter("all")}
                            data-testid="button-filter-all"
                          >
                            All
                          </Button>
                          <Button
                            variant={genderFilter === "female" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setGenderFilter("female")}
                            data-testid="button-filter-female"
                          >
                            Female
                          </Button>
                          <Button
                            variant={genderFilter === "male" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setGenderFilter("male")}
                            data-testid="button-filter-male"
                          >
                            Male
                          </Button>
                        </div>
                      </div>
                      
                      {/* Voice List */}
                      <ScrollArea className="h-[250px] border rounded-md p-2">
                        {filteredVoices.length === 0 ? (
                          <p className="text-center text-gray-500 py-4">No voices match your search</p>
                        ) : (
                          <div className="space-y-1">
                            {filteredVoices.map((voice) => (
                              <div
                                key={voice.voice_id}
                                className={`flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                                  selectedVoice === voice.voice_id ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700" : ""
                                }`}
                                onClick={() => setSelectedVoice(voice.voice_id)}
                                data-testid={`voice-option-${voice.voice_id}`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-sm">{voice.name}</span>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      {voice.language && voice.language !== "unknown" && (
                                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                                          {voice.language}
                                        </Badge>
                                      )}
                                      {voice.gender && voice.gender !== "unknown" && (
                                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                                          {voice.gender}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {voice.preview_audio && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        playVoicePreview(voice.preview_audio!, voice.voice_id);
                                      }}
                                      data-testid={`button-preview-${voice.voice_id}`}
                                    >
                                      <Volume2 className={`h-4 w-4 ${playingPreview === voice.voice_id ? "text-blue-500 animate-pulse" : ""}`} />
                                    </Button>
                                  )}
                                  {selectedVoice === voice.voice_id && (
                                    <Check className="h-4 w-4 text-blue-500" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </div>
                  )}

                  <div>
                    <Label>Motion Style</Label>
                    <Select value={selectedMotion} onValueChange={setSelectedMotion}>
                      <SelectTrigger className="mt-1" data-testid="select-motion">
                        <SelectValue placeholder="Select motion style" />
                      </SelectTrigger>
                      <SelectContent>
                        {MOTION_PROMPTS.map((motion) => (
                          <SelectItem key={motion.id} value={motion.id}>
                            {motion.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Video Orientation</Label>
                    <Select 
                      value={videoOrientation} 
                      onValueChange={(v) => setVideoOrientation(v as "landscape" | "portrait")}
                    >
                      <SelectTrigger className="mt-1" data-testid="select-orientation">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="landscape">Landscape (16:9)</SelectItem>
                        <SelectItem value="portrait">Portrait (9:16)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {imagePreview && (
                    <div>
                      <Label>Your Photo</Label>
                      <img
                        src={imagePreview}
                        alt="Selected"
                        className="mt-1 w-24 h-24 object-cover rounded-lg"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Background Generation Toggle */}
              <div className="flex items-center justify-center gap-3 py-4 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <Switch
                  id="background-mode"
                  checked={runInBackground}
                  onCheckedChange={setRunInBackground}
                  data-testid="switch-background-mode"
                />
                <Label htmlFor="background-mode" className="flex items-center gap-2 cursor-pointer">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">Generate in Background</span>
                </Label>
                {runInBackground && (
                  <Badge variant="secondary" className="text-xs">
                    You can navigate away
                  </Badge>
                )}
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  data-testid="button-back-step-2"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={() => generateMutation.mutate()}
                  disabled={
                    generateMutation.isPending || 
                    (inputMode === "text" && !script.trim()) ||
                    (inputMode === "audio" && !uploadedAudioUrl)
                  }
                  className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white px-8"
                  data-testid="button-generate"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : runInBackground ? (
                    <>
                      <Clock className="h-4 w-4 mr-2" />
                      Start Background Generation
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Generate Video
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6" data-testid="step-3-content">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Your Video</h3>
                <p className="text-gray-500 text-sm">
                  {videoStatus?.status === "completed" 
                    ? "Your video is ready!" 
                    : "Video generation in progress..."}
                </p>
              </div>

              <div className="max-w-2xl mx-auto">
                {videoStatus?.status === "completed" && videoStatus.video_url ? (
                  <div className="space-y-4">
                    <video
                      src={videoStatus.video_url}
                      controls
                      className="w-full rounded-xl shadow-lg"
                      data-testid="video-player"
                    />
                    <div className="flex flex-wrap justify-center gap-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (videoStatus.video_url) {
                            const filename = `${videoTitle || 'video'}-${Date.now()}.mp4`;
                            downloadFile(videoStatus.video_url, filename);
                            toast({
                              title: "Downloading...",
                              description: "Your video will be saved shortly.",
                            });
                          }
                        }}
                        data-testid="button-download"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                      <Button
                        onClick={() => {
                          // Navigate to content generator with video pre-selected
                          const videoUrl = encodeURIComponent(videoStatus.video_url || "");
                          const title = encodeURIComponent(videoTitle || "My Video");
                          setLocation(`/dashboard?quickPost=video&videoUrl=${videoUrl}&videoTitle=${title}`);
                          toast({
                            title: "Ready to Post",
                            description: "Your video is ready for quick posting!",
                          });
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        data-testid="button-quick-post"
                      >
                        <Share2 className="h-4 w-4 mr-2" />
                        Quick Post
                      </Button>
                      <Button
                        onClick={resetStudio}
                        className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white"
                        data-testid="button-create-new"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Create New
                      </Button>
                    </div>
                  </div>
                ) : videoStatus?.status === "failed" ? (
                  <div className="text-center py-12 border rounded-xl">
                    <X className="h-12 w-12 mx-auto text-red-500 mb-4" />
                    <p className="text-red-500 font-medium mb-2">Generation Failed</p>
                    <p className="text-gray-500 text-sm mb-4">{videoStatus.error || "Something went wrong"}</p>
                    <Button
                      onClick={() => setCurrentStep(2)}
                      variant="outline"
                      data-testid="button-try-again"
                    >
                      Try Again
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-12 border rounded-xl">
                    <Loader2 className="h-12 w-12 mx-auto text-[#D4AF37] mb-4 animate-spin" />
                    <p className="font-medium mb-2">Generating Your Video...</p>
                    <p className="text-gray-500 text-sm mb-4">
                      This usually takes 1-3 minutes
                    </p>
                    <Badge variant="secondary" className="text-sm">
                      Status: {videoStatus?.status || "pending"}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
