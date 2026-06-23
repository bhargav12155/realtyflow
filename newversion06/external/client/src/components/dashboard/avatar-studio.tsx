import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useDemo } from "@/contexts/DemoContext";
import demoMotionVideo from "@assets/preview_video_target_(1)_1765290240595.mp4";
import demoFinalVideo from "@assets/preview_video_target_(1)_1765291235450.mp4";
import demoEditLookResult from "@assets/demo-edit-look-result.jpg";
import {
  User,
  Mic,
  Video,
  Check,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Upload,
  Play,
  Pause,
  Loader2,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Clock,
  Wand2,
  Volume2,
  X,
  Square,
  Hash,
  Trash2,
  Download,
  Terminal,
  MoreHorizontal,
  MoreVertical,
  Shirt,
  Edit2,
  Copy,
  Heart,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";

const PROFESSIONAL_VOICES = [
  { id: "92c93dc0dff2428ab0bea258ba68f173", name: "Professional Male - Confident" },
  { id: "f577da968446491289b53bceb77e5092", name: "Professional Male - Warm" },
  { id: "73c0b6a2e29d4d38aca41454bf58c955", name: "Professional Female - Clear" },
  { id: "1c7c897eeb2d4b5fb17d3c6c70250b24", name: "Professional Female - Friendly" },
  { id: "119caed25533477ba63822d5d1552d25", name: "Neutral - Balanced" },
  { id: "9f2e8c4a7b5d4f6e8a1c3d5b7e9f2a4c", name: "Energetic - Enthusiastic" },
];

const KLING_VOICES = [
  { id: "female_calm", name: "Female - Calm (The Reader)" },
  { id: "male_calm", name: "Male - Calm (Businessman)" },
  { id: "female_professional", name: "Female - Professional (Commercial Lady)" },
  { id: "male_professional", name: "Male - Professional (Businessman)" },
  { id: "female_warm", name: "Female - Warm (Sweet Girl)" },
  { id: "male_warm", name: "Male - Warm (Rock)" },
];

interface PhotoAvatarGroup {
  group_id: string;
  name: string;
  status: string;
  train_status?: string;
  num_looks?: number;
  created_at: string;
  avatar_count?: number;
  preview_image?: string;
}

interface AvatarLook {
  id: string;
  avatar_id?: string;
  image_url: string;
  image?: string;
  status: string;
  is_motion?: boolean;
  motion_preview_url?: string;
  name?: string;
}

interface CustomVoice {
  id: string;
  name: string;
  audioUrl: string;
  status?: string;
  duration?: number;
  heygenAudioAssetId?: string | null;
  heygenVoiceId?: string | null;
  language?: string | null;
  gender?: string | null;
  sampleAudioUrl?: string | null;
}

interface VideoGeneration {
  video_id: string;
  id?: string;
  status: string;
  video_url?: string;
  videoUrl?: string;
  thumbnail_url?: string;
  error?: string;
}

interface LookGenerationJob {
  id: string;
  userId: string;
  groupId: string;
  heygenGenerationId: string;
  lookLabel: string;
  lookName: string;
  prompt: string;
  status: string;
  resultAvatarId?: string | null;
  resultImageUrl?: string | null;
  errorMessage?: string | null;
  createdAt?: string | null;
  completedAt?: string | null;
}

const STEPS = [
  { id: 1, title: "Select Avatar", icon: User },
  { id: 2, title: "Choose Voice", icon: Mic },
  { id: 3, title: "Create Video", icon: Video },
];

const PLATFORM_OPTIONS = [
  { id: "instagram_reel", name: "Instagram Reel", duration: 30, description: "15-30 sec optimal" },
  { id: "facebook_story", name: "Facebook Story", duration: 20, description: "15-20 sec optimal" },
  { id: "facebook_post", name: "Facebook Post", duration: 90, description: "1-2 min optimal" },
  { id: "twitter", name: "Twitter/X", duration: 45, description: "30-60 sec optimal" },
  { id: "youtube_short", name: "YouTube Short", duration: 30, description: "15-30 sec optimal" },
  { id: "tiktok", name: "TikTok", duration: 30, description: "21-34 sec optimal" },
  { id: "linkedin", name: "LinkedIn", duration: 90, description: "1-2 min optimal" },
  { id: "custom", name: "Custom Length", duration: 60, description: "Set your own duration" },
];

const OUTFIT_PRESETS = [
  { label: "Business Suit", prompt: "wearing a tailored navy blue business suit with white dress shirt and silk tie, professional office setting", icon: "👔" },
  { label: "Casual Polo", prompt: "wearing a fitted casual polo shirt in solid color, relaxed professional look", icon: "👕" },
  { label: "Real Estate Blazer", prompt: "wearing a stylish modern blazer over crisp button-down shirt, professional real estate agent look", icon: "🧥" },
  { label: "Smart Casual", prompt: "wearing smart casual outfit with quarter-zip sweater over collared shirt, approachable professional look", icon: "👔" },
  { label: "Formal Dress", prompt: "wearing elegant formal business dress or blouse with professional styling, confident real estate professional", icon: "👗" },
  { label: "Outdoor/Active", prompt: "wearing clean outdoor casual attire, quarter-zip jacket, ready for property showings and open houses", icon: "🧤" },
];

export function AvatarStudio() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { isDemo } = useDemo();
  const { user, isAuthenticated } = useAuth();

  // Subscribe to real-time voice clone updates so the My Voices badges
  // flip from "Cloning…" to "Cloned" / "Clone Failed" without needing
  // a manual refresh.
  useWebSocket({
    userId: user?.id?.toString() || undefined,
    autoConnect: isAuthenticated && !!user?.id,
    showToast: false,
    onMessage: (message) => {
      if (
        message.type === "voice_clone_complete" ||
        message.type === "voice_clone_failed"
      ) {
        queryClient.invalidateQueries({ queryKey: ["/api/custom-voices"] });
        const voiceName = message.data?.voiceName ?? "Voice";
        if (message.type === "voice_clone_complete") {
          toast({
            title: "Voice Cloned!",
            description: `"${voiceName}" is ready to narrate avatar videos.`,
          });
        } else {
          toast({
            title: "Clone Failed",
            description:
              message.data?.error ||
              `"${voiceName}" could not be cloned. You can retry from "My Voices".`,
            variant: "destructive",
          });
        }
      }
    },
  });
  
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedAvatarGroup, setSelectedAvatarGroup] = useState<string>("");
  const [selectedAvatarLook, setSelectedAvatarLook] = useState<string>("");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("119caed25533477ba63822d5d1552d25");
  const [script, setScript] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [currentVideo, setCurrentVideo] = useState<VideoGeneration | null>(null);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [showQuickUpload, setShowQuickUpload] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [hoveredLookId, setHoveredLookId] = useState<string | null>(null);
  
  // Motion generation state
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
  const [uploadName, setUploadName] = useState("");
  
  // Motion dialog step: "motion" -> "voice" -> "final"
  const [motionDialogStep, setMotionDialogStep] = useState<"motion" | "voice" | "final">("motion");
  const [motionVoiceScript, setMotionVoiceScript] = useState("");
  const [selectedMotionVoice, setSelectedMotionVoice] = useState<string>("female_calm");
  const [voiceProvider, setVoiceProvider] = useState<"elevenlabs" | "kling">("kling");
  const [isGeneratingLipSync, setIsGeneratingLipSync] = useState(false);
  const [lipSyncTaskId, setLipSyncTaskId] = useState<string | null>(null);
  const [lipSyncStatus, setLipSyncStatus] = useState<string>("");
  const [lipSyncProgress, setLipSyncProgress] = useState(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  
  // Voice input mode for motion dialog: "tts" | "record" | "upload"
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
  
  // Upload motion video state (skip to voice step)
  const [uploadedMotionFile, setUploadedMotionFile] = useState<File | null>(null);
  const [uploadedMotionUrl, setUploadedMotionUrl] = useState<string>("");
  
  // Edit look result dialog (demo mode)
  const [showEditLookResult, setShowEditLookResult] = useState(false);
  
  // Motion templates based on HeyGen's offerings
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [voiceAudioUrls, setVoiceAudioUrls] = useState<Record<string, string>>({});
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string>("");
  const [recordingTime, setRecordingTime] = useState(0);
  const [voiceName, setVoiceName] = useState("");
  const [voiceLanguage, setVoiceLanguage] = useState("");
  const [voiceGender, setVoiceGender] = useState("");
  const [renamingVoiceId, setRenamingVoiceId] = useState<string | null>(null);
  const [renamingVoiceName, setRenamingVoiceName] = useState("");
  const renameSubmittedRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // HeyGen voice ID state
  const [heygenVoiceId, setHeygenVoiceId] = useState("");
  const [voiceTab, setVoiceTab] = useState("professional");
  
  // AI script generation settings
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("instagram_reel");
  
  // Activity log state for step-by-step visibility
  const [activityLogs, setActivityLogs] = useState<Array<{
    id: string;
    timestamp: string;
    step: 'upload' | 'group_created' | 'waiting' | 'training_started' | 'training_progress' | 'training_complete' | 'generating_looks' | 'looks_complete' | 'polling' | 'complete' | 'error';
    message: string;
    groupName?: string;
    details?: string;
    previewImage?: string;
  }>>([]);
  const [showActivityPanel, setShowActivityPanel] = useState(true);
  const activityLogRef = useRef<HTMLDivElement>(null);
  
  // Upload dialog tab state
  const [uploadDialogTab, setUploadDialogTab] = useState<"quick" | "upload-looks">("quick");
  
  // Upload Looks form state (for uploading multiple photos as different looks)
  const [uploadLooksFiles, setUploadLooksFiles] = useState<File[]>([]);
  const [uploadLooksNames, setUploadLooksNames] = useState<string[]>(["", "", "", ""]);
  const [uploadLooksAvatarName, setUploadLooksAvatarName] = useState("");
  const [uploadLooksStatus, setUploadLooksStatus] = useState<"idle" | "uploading" | "training" | "complete" | "error">("idle");
  const [uploadLooksResult, setUploadLooksResult] = useState<{
    group_id?: string;
    avatar_name?: string;
    message?: string;
    error?: string;
  } | null>(null);
  
  // Legacy generate looks state (kept for backwards compatibility)
  const [generateLooksFile, setGenerateLooksFile] = useState<File | null>(null);
  const [generateLooksName, setGenerateLooksName] = useState("");
  const [generateLooksPrompt, setGenerateLooksPrompt] = useState("");
  const [generateLooksOrientation, setGenerateLooksOrientation] = useState<"square" | "horizontal" | "vertical">("square");
  const [generateLooksPose, setGenerateLooksPose] = useState<"half_body" | "close_up" | "full_body">("half_body");
  const [generateLooksStyle, setGenerateLooksStyle] = useState<"Realistic" | "Pixar" | "Cinematic">("Realistic");
  const [generateLooksStatus, setGenerateLooksStatus] = useState<"idle" | "creating" | "training" | "generating" | "polling" | "complete" | "error">("idle");
  const [generateLooksResult, setGenerateLooksResult] = useState<{
    group_id?: string;
    avatar_name?: string;
    looks?: { count?: number; list?: Array<{ id?: string; image_url?: string; name?: string }> };
    percent_complete?: number;
    message?: string;
    error?: string;
  } | null>(null);
  
  const [changeStyleDialogOpen, setChangeStyleDialogOpen] = useState(false);
  const [changeStylePrompt, setChangeStylePrompt] = useState("");
  const [changeStyleOrientation, setChangeStyleOrientation] = useState("square");
  const [changeStylePose, setChangeStylePose] = useState("half_body");
  const [changeStyleStyle, setChangeStyleStyle] = useState("Realistic");
  
  // Ref to track previous group train statuses for detecting changes
  const previousGroupStatusRef = useRef<Record<string, string>>({});
  // Track groups that have already triggered look generation
  const looksTriggeredRef = useRef<Set<string>>(new Set());

  const { data: avatarGroupsResponse, isLoading: groupsLoading } = useQuery<{
    avatar_group_list?: PhotoAvatarGroup[];
  }>({
    queryKey: ["/api/photo-avatars/groups"],
    // Poll when there are groups NOT ready (empty, pending, processing) 
    // to detect training start and completion
    refetchInterval: (query) => {
      const groups = query.state.data?.avatar_group_list ?? [];
      const hasNonReady = groups.some((g: PhotoAvatarGroup) => {
        const trainStatus = (g.train_status || "").toLowerCase();
        const status = (g.status || "").toLowerCase();
        const numLooks = g.num_looks || 0;
        // Poll if group is not fully ready (empty, pending, processing, or ready with no looks)
        return trainStatus !== 'ready' || (trainStatus === 'ready' && numLooks === 0) ||
               status === 'processing' || status === 'pending';
      });
      return hasNonReady ? 5000 : false;
    },
  });

  const avatarGroups: PhotoAvatarGroup[] = avatarGroupsResponse?.avatar_group_list ?? [];
  
  const readyAvatarGroups = avatarGroups.filter((group) => {
    const status = (group.status || "").toLowerCase();
    const trainStatus = (group.train_status || "").toLowerCase();
    return status === "ready" || trainStatus === "ready" || (group.num_looks || 0) > 0;
  });

  const { data: selectedGroupLooks } = useQuery<{
    avatar_list?: AvatarLook[];
  }>({
    queryKey: ["/api/photo-avatars/groups", selectedAvatarGroup, "looks"],
    enabled: !!selectedAvatarGroup,
    refetchInterval: selectedAvatarGroup ? 7000 : false,
  });

  const availableLooks = (selectedGroupLooks?.avatar_list || []).filter((look) => {
    const status = (look.status || "").toLowerCase();
    return status === "completed" || status === "ready";
  });

  // Look generation jobs polling - poll when group is selected to check for pending jobs
  const { data: lookJobsData } = useQuery<{ jobs: LookGenerationJob[] }>({
    queryKey: ["/api/photo-avatars/groups", selectedAvatarGroup, "look-jobs"],
    enabled: !!selectedAvatarGroup,
    refetchInterval: (query) => {
      const jobs = query.state.data?.jobs ?? [];
      const hasPending = jobs.some((job) => job.status === "pending" || job.status === "processing");
      return hasPending ? 5000 : false; // Poll every 5 seconds if there are pending jobs
    },
  });

  const lookGenerationJobs = lookJobsData?.jobs ?? [];
  const pendingLookJobs = lookGenerationJobs.filter(
    (job) => job.status === "pending" || job.status === "processing"
  );
  const hasActiveLookGeneration = pendingLookJobs.length > 0;

  // Auto-refresh looks list when all jobs complete
  useEffect(() => {
    if (lookGenerationJobs.length > 0 && pendingLookJobs.length === 0) {
      // All jobs completed, refresh the looks list
      queryClient.invalidateQueries({ 
        queryKey: ["/api/photo-avatars/groups", selectedAvatarGroup, "looks"] 
      });
    }
  }, [pendingLookJobs.length, lookGenerationJobs.length, selectedAvatarGroup]);

  const { data: customVoicesData = [] } = useQuery<CustomVoice[]>({
    queryKey: ["/api/custom-voices"],
  });

  // Show all user's voices - they can still use audio_url even if HeyGen upload failed
  const customVoices = customVoicesData;

  // ElevenLabs voices query
  interface ElevenLabsVoice {
    id: string;
    name: string;
    category?: string;
    description?: string;
    previewUrl?: string;
  }
  const { data: elevenLabsData } = useQuery<{
    configured: boolean;
    voices: ElevenLabsVoice[];
  }>({
    queryKey: ["/api/elevenlabs/voices"],
  });
  const elevenLabsConfigured = elevenLabsData?.configured ?? false;
  const elevenLabsVoices = elevenLabsData?.voices ?? [];

  // Load script from Template Studio if available
  useEffect(() => {
    const templateScript = localStorage.getItem("templateScript");
    const templateTitle = localStorage.getItem("templateTitle");
    
    if (templateScript) {
      setScript(templateScript);
      localStorage.removeItem("templateScript");
      
      if (templateTitle) {
        setVideoTitle(templateTitle);
        localStorage.removeItem("templateTitle");
      }
      
      // Auto-advance to step 3 if script is loaded
      setCurrentStep(3);
      
      toast({
        title: "Script Loaded",
        description: "Your template script has been loaded. Select an avatar and voice to create your video.",
      });
    }
  }, []);

  useEffect(() => {
    if (customVoices.length === 0) return;

    const fetchAudioUrls = async () => {
      const urls: Record<string, string> = {};
      
      for (const voice of customVoices) {
        try {
          const response = await fetch(`/api/custom-voices/${voice.id}/audio`, {
            credentials: "include",
          });
          
          if (response.ok) {
            const blob = await response.blob();
            urls[voice.id] = URL.createObjectURL(blob);
          }
        } catch (error) {
          console.error(`Failed to load audio for voice ${voice.id}:`, error);
        }
      }
      
      setVoiceAudioUrls(urls);
    };

    fetchAudioUrls();

    return () => {
      Object.values(voiceAudioUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [customVoices.length]);

  // Effect to detect training completion and auto-trigger look generation
  useEffect(() => {
    if (!avatarGroups || avatarGroups.length === 0) return;

    const triggerLookGeneration = async (groupId: string, groupName: string, previewImage?: string) => {
      if (looksTriggeredRef.current.has(groupId)) {
        console.log(`⏭️ Looks already triggered for group ${groupId}, skipping`);
        return;
      }
      
      looksTriggeredRef.current.add(groupId);
      
      addActivityLog({
        step: 'generating_looks',
        message: 'Generating professional looks...',
        groupName: groupName,
        details: 'Creating professional and casual avatar looks',
        previewImage: previewImage
      });
      
      try {
        console.log(`🎨 Auto-triggering look generation for group ${groupId}`);
        const lookPrompts = [
          "Professional executive in a navy business suit, confident and approachable",
          "Friendly real estate agent in smart casual blazer, warm and welcoming smile",
          "Outdoor property tour guide in clean casual attire, natural setting",
          "Modern professional in contemporary business wear, sleek and polished",
        ];
        for (const prompt of lookPrompts) {
          try {
            await apiRequest(
              "POST",
              `/api/photo-avatars/groups/${groupId}/proxy-generate-look`,
              { prompt, orientation: "square", pose: "half_body", style: "Realistic" }
            );
          } catch (e: any) {
            console.warn(`Look generation failed for prompt "${prompt}":`, e?.message);
          }
        }
        
        toast({
          title: "Generating Looks",
          description: "Creating professional looks for your avatar. This may take a few minutes.",
        });
        
        queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups"] });
        queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups", groupId, "looks"] });

        const pollInterval = setInterval(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups"] });
          queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups", groupId, "looks"] });
        }, 5000);
        setTimeout(() => clearInterval(pollInterval), 180000);
      } catch (error: any) {
        console.error("Look generation failed:", error);
        looksTriggeredRef.current.delete(groupId);
        
        addActivityLog({
          step: 'error',
          message: 'Look generation failed',
          groupName: groupName,
          details: error?.message || 'Unknown error',
          previewImage: previewImage
        });
      }
    };

    avatarGroups.forEach((group) => {
      const groupId = group.group_id;
      const currentTrainStatus = (group.train_status || group.status || "").toLowerCase();
      const previousStatus = previousGroupStatusRef.current[groupId];
      const numLooks = group.num_looks || 0;
      const previewImage = group.preview_image;
      
      // Detect training started: status changed to processing
      if (previousStatus && previousStatus !== "processing" && currentTrainStatus === "processing") {
        console.log(`🎓 Training started for group ${groupId}: ${group.name}`);
        
        addActivityLog({
          step: 'training_progress',
          message: 'Training in progress...',
          groupName: group.name,
          details: 'HeyGen is processing your avatar (~5-15 min)',
          previewImage: previewImage
        });
        
        toast({
          title: "Training Started!",
          description: `${group.name} is now training. This takes 5-15 minutes.`,
          duration: 5000,
        });
      }
      
      // Detect training completion: status changed from processing to ready
      if (previousStatus === "processing" && currentTrainStatus === "ready") {
        console.log(`✅ Training completed for group ${groupId}: ${group.name}`);
        
        addActivityLog({
          step: 'training_complete',
          message: 'Training complete!',
          groupName: group.name,
          details: 'Avatar is ready. Now generating professional looks...',
          previewImage: previewImage
        });
        
        toast({
          title: "Training Complete!",
          description: `${group.name} is ready. Generating professional looks...`,
          duration: 5000,
        });
        
        // Auto-trigger look generation
        triggerLookGeneration(groupId, group.name, previewImage);
      }
      
      // Note: Removed auto-trigger on page load to prevent repeated API calls
      // Users can manually trigger look generation via "Regenerate Looks" button if needed
      // Auto-generation only happens on actual training completion (processing→ready transition above)
      
      // Detect when new looks are generated (num_looks increases from 0 or 1)
      if (currentTrainStatus === "ready" && numLooks > 1) {
        const prevLooksCount = parseInt(previousGroupStatusRef.current[`${groupId}_looks`] || "0", 10);
        if (prevLooksCount <= 1 && numLooks > prevLooksCount) {
          addActivityLog({
            step: 'looks_complete',
            message: 'Looks generated successfully!',
            groupName: group.name,
            details: `${numLooks} look(s) are now available`,
            previewImage: previewImage
          });
          
          toast({
            title: "Looks Ready!",
            description: `${numLooks} professional look(s) created for ${group.name}`,
          });
        }
      }
      previousGroupStatusRef.current[`${groupId}_looks`] = String(numLooks);
      
      // Update previous status for next comparison
      previousGroupStatusRef.current[groupId] = currentTrainStatus;
    });
  }, [avatarGroups, toast]);

  const uploadPhotoMutation = useMutation({
    mutationFn: async ({ file, name }: { file: File; name: string }) => {
      addActivityLog({
        step: 'upload',
        message: 'Uploading photo...',
        groupName: name,
        details: `File: ${file.name}`
      });
      
      const formData = new FormData();
      formData.append("photo", file);

      const uploadResponse = await fetch("/api/photo-avatars/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!uploadResponse.ok) throw new Error("Upload failed");
      const uploadData = await uploadResponse.json();

      addActivityLog({
        step: 'waiting',
        message: 'Creating avatar group...',
        groupName: name,
        details: 'Photo uploaded, now creating your avatar'
      });

      const createResponse = await fetch("/api/photo-avatars/create-from-uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          imageKeys: [uploadData.imageKey],
        }),
      });

      if (!createResponse.ok) throw new Error("Failed to create avatar group");
      return createResponse.json();
    },
    onSuccess: async (data) => {
      const groupId = data?.group?.group_id || data?.groupId || data?.group_id || data?.id;
      const groupName = data?.group?.name || data?.name || uploadName || "Avatar";
      
      addActivityLog({
        step: 'group_created',
        message: 'Avatar group created!',
        groupName: groupName,
        details: 'Your avatar is ready for training'
      });
      
      toast({
        title: "Photo Uploaded",
        description: "Avatar group created. Starting training automatically...",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups"] });
      setShowQuickUpload(false);
      setUploadedFile(null);
      setUploadName("");
      
      if (groupId) {
        setSelectedAvatarGroup(groupId);
        
        addActivityLog({
          step: 'training_started',
          message: 'Training will start shortly...',
          groupName: groupName,
          details: 'HeyGen needs ~20 seconds to process your image before training begins'
        });
        
        toast({
          title: "Avatar Created!",
          description: "Training will start automatically in ~20 seconds. This process takes 5-15 minutes.",
          duration: 8000,
        });
        
        queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups"] });
      }
    },
    onError: (error: Error) => {
      addActivityLog({
        step: 'error',
        message: 'Upload failed',
        details: error.message
      });
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Retrain avatar mutation with activity log integration
  const retrainMutation = useMutation({
    mutationFn: async ({ groupId, groupName, previewImage }: { groupId: string; groupName: string; previewImage?: string }) => {
      addActivityLog({
        step: 'training_started',
        message: 'Retraining avatar...',
        groupName: groupName,
        details: 'Starting avatar retraining (~5-15 minutes)',
        previewImage: previewImage
      });
      
      const response = await apiRequest(
        "POST",
        `/api/photo-avatars/groups/${groupId}/train`,
        {}
      );
      return { response: await response.json(), groupId, groupName, previewImage };
    },
    onSuccess: ({ groupName, previewImage }) => {
      addActivityLog({
        step: 'training_progress',
        message: 'Retraining in progress...',
        groupName: groupName,
        details: 'HeyGen is processing your avatar (~5-15 min)',
        previewImage: previewImage
      });
      
      toast({
        title: "Retraining Started",
        description: "Your avatar is being retrained. This takes 5-15 minutes.",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups"] });
    },
    onError: (error: any, variables) => {
      addActivityLog({
        step: 'error',
        message: 'Retrain failed',
        groupName: variables.groupName,
        details: error?.message || 'Unknown error',
        previewImage: variables.previewImage
      });
      
      toast({
        title: "Retrain Failed",
        description: error?.message || "Failed to retrain avatar",
        variant: "destructive",
      });
    },
  });

  // Regenerate looks mutation with activity log integration
  const regenerateLooksMutation = useMutation({
    mutationFn: async ({ groupId, groupName, previewImage }: { groupId: string; groupName: string; previewImage?: string }) => {
      addActivityLog({
        step: 'generating_looks',
        message: 'Regenerating professional looks...',
        groupName: groupName,
        details: 'Creating new avatar looks (this may take a few minutes)',
        previewImage: previewImage
      });
      
      const lookPrompts = [
        "Professional executive in a navy business suit, confident and approachable",
        "Friendly real estate agent in smart casual blazer, warm and welcoming smile",
        "Outdoor property tour guide in clean casual attire, natural setting",
        "Modern professional in contemporary business wear, sleek and polished",
      ];
      for (const prompt of lookPrompts) {
        try {
          await apiRequest(
            "POST",
            `/api/photo-avatars/groups/${groupId}/proxy-generate-look`,
            { prompt, orientation: "square", pose: "half_body", style: "Realistic" }
          );
        } catch (e: any) {
          console.warn(`Look generation failed for prompt "${prompt}":`, e?.message);
        }
      }
      return { groupName, previewImage, groupId };
    },
    onSuccess: ({ groupName, previewImage, groupId }) => {
      addActivityLog({
        step: 'looks_complete',
        message: 'New looks generation started!',
        groupName: groupName,
        details: 'This takes 3-5 minutes. Come back and check shortly!',
        previewImage: previewImage
      });
      
      toast({
        title: "New Looks Generation Started!",
        description: `Creating new professional looks for "${groupName}". This takes 3-5 minutes - come back and check shortly!`,
        duration: 8000,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups"] });
      if (selectedAvatarGroup) {
        queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups", selectedAvatarGroup, "looks"] });
      }

      const pollInterval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups"] });
        queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups", groupId, "looks"] });
      }, 5000);
      setTimeout(() => clearInterval(pollInterval), 180000);
    },
    onError: (error: any, variables) => {
      addActivityLog({
        step: 'error',
        message: 'Look generation failed',
        groupName: variables.groupName,
        details: error?.message || 'Unknown error',
        previewImage: variables.previewImage
      });
      
      toast({
        title: "Generation Failed",
        description: error?.message || "Failed to generate looks",
        variant: "destructive",
      });
    },
  });

  const changeStyleMutation = useMutation({
    mutationFn: async ({ groupId, prompt, orientation, pose, style }: { groupId: string; prompt: string; orientation?: string; pose?: string; style?: string }) => {
      const response = await apiRequest(
        "POST",
        `/api/photo-avatars/groups/${groupId}/proxy-generate-look`,
        { prompt, orientation, pose, style, numLooks: 1 }
      );
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Style Change Started!",
        description: "Your new look is being generated. It will appear in 30-60 seconds.",
        duration: 6000,
      });
      setChangeStyleDialogOpen(false);
      setChangeStylePrompt("");
      if (selectedAvatarGroup) {
        queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups", selectedAvatarGroup, "looks"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups"] });
    },
    onError: (error: any) => {
      toast({
        title: "Style Change Failed",
        description: error?.message || "Failed to change style. Make sure the avatar is trained first.",
        variant: "destructive",
      });
    },
  });

  // Delete avatar group mutation
  const deleteGroupMutation = useMutation({
    mutationFn: async ({ groupId, groupName }: { groupId: string; groupName: string }) => {
      const response = await apiRequest(
        "DELETE",
        `/api/photo-avatars/groups/${groupId}`,
        {}
      );
      return { groupId, groupName };
    },
    onSuccess: ({ groupName }) => {
      toast({
        title: "Avatar Deleted",
        description: `"${groupName}" has been removed.`,
      });
      
      // Clear selection if deleted group was selected
      if (selectedAvatarGroup) {
        setSelectedAvatarGroup("");
        setSelectedAvatarLook("");
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups"] });
    },
    onError: (error: any, variables) => {
      toast({
        title: "Delete Failed",
        description: error?.message || "Failed to delete avatar",
        variant: "destructive",
      });
    },
  });

  // Persist all avatar images to permanent storage
  const persistImagesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        "POST",
        "/api/photo-avatars/persist-all-images",
        {}
      );
      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Images Fixed!",
        description: `${data.persisted}/${data.total} avatar images saved permanently.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Fix Images",
        description: error?.message || "Could not persist images",
        variant: "destructive",
      });
    },
  });

  // Copy avatar ID to clipboard
  const copyAvatarId = (groupId: string) => {
    navigator.clipboard.writeText(groupId);
    toast({
      title: "Copied!",
      description: "Avatar ID copied to clipboard",
    });
  };

  // Create avatar with looks mutation (one-step workflow)
  const createWithLooksMutation = useMutation({
    mutationFn: async (data: {
      file: File;
      name: string;
      prompt?: string;
      orientation: "square" | "horizontal" | "vertical";
      pose: "half_body" | "close_up" | "full_body";
      style: "Realistic" | "Pixar" | "Cinematic";
    }) => {
      setGenerateLooksStatus("creating");
      
      addActivityLog({
        step: 'upload',
        message: 'Creating avatar with looks...',
        groupName: data.name,
        details: 'Uploading photo and starting automated workflow'
      });
      
      const formData = new FormData();
      formData.append("image", data.file);
      formData.append("name", data.name);
      if (data.prompt) formData.append("prompt", data.prompt);
      formData.append("orientation", data.orientation);
      formData.append("pose", data.pose);
      formData.append("style", data.style);

      const response = await fetch("/api/photo-avatars/create-with-looks", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create avatar with looks");
      }

      return response.json();
    },
    onSuccess: (data) => {
      const groupId = data.group_id;
      
      // Show initial success - workflow started
      setGenerateLooksStatus("polling");
      setGenerateLooksResult({ ...data, percent_complete: 0 });
      
      addActivityLog({
        step: 'training_started',
        message: 'Avatar workflow started!',
        groupName: data.avatar_name || generateLooksName,
        details: 'Training and look generation in progress (~6-8 minutes)'
      });
      
      toast({
        title: "Avatar Workflow Started!",
        description: "Training started. Polling for progress every 30 seconds...",
      });
      
      // Start polling status every 30 seconds (as per heygen-wrapper.md)
      if (groupId) {
        const pollInterval = setInterval(async () => {
          try {
            const statusResponse = await fetch(`/api/photo-avatars/status/${groupId}`, {
              credentials: "include",
            });
            
            if (!statusResponse.ok) {
              console.error("Status poll failed:", statusResponse.status);
              return;
            }
            
            const statusData = await statusResponse.json();
            const percentComplete = statusData.workflow_status?.percent_complete || 0;
            const isComplete = statusData.training?.is_complete && statusData.looks?.count > 0;
            
            // Update progress
            setGenerateLooksResult((prev: any) => ({
              ...prev,
              ...statusData,
              percent_complete: percentComplete,
            }));
            
            addActivityLog({
              step: 'polling',
              message: `Progress: ${percentComplete}%`,
              groupName: data.avatar_name || generateLooksName,
              details: isComplete ? `${statusData.looks?.count} looks ready!` : 'Training in progress...'
            });
            
            // Check if workflow is complete (100% with looks)
            if (isComplete || percentComplete >= 100) {
              clearInterval(pollInterval);
              setGenerateLooksStatus("complete");
              
              addActivityLog({
                step: 'complete',
                message: 'Avatar with looks ready!',
                groupName: data.avatar_name || generateLooksName,
                details: `${statusData.looks?.count || 4} professional looks generated`
              });
              
              toast({
                title: "Avatar Complete!",
                description: `Your avatar with ${statusData.looks?.count || 4} looks is ready to use.`,
              });
              
              queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups"] });
              
              // Reset form after completion
              setTimeout(() => {
                setGenerateLooksFile(null);
                setGenerateLooksName("");
                setGenerateLooksPrompt("");
                setGenerateLooksOrientation("square");
                setGenerateLooksPose("half_body");
                setGenerateLooksStyle("Realistic");
                setShowQuickUpload(false);
                setGenerateLooksStatus("idle");
                setGenerateLooksResult(null);
              }, 3000);
            }
          } catch (pollError) {
            console.error("Status polling error:", pollError);
          }
        }, 30000); // Poll every 30 seconds as per heygen-wrapper.md
        
        // Stop polling after 15 minutes max (safety timeout)
        setTimeout(() => {
          clearInterval(pollInterval);
          if (generateLooksStatus === "polling") {
            setGenerateLooksStatus("complete");
            queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups"] });
            toast({
              title: "Processing continues in background",
              description: "Check your avatars list - your avatar may still be processing.",
            });
          }
        }, 15 * 60 * 1000);
      } else {
        // No group_id returned, just show complete
        setGenerateLooksStatus("complete");
        queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups"] });
      }
    },
    onError: (error: any) => {
      setGenerateLooksStatus("error");
      // Store error separately, clear any stale success data
      setGenerateLooksResult({ error: error?.message || "Failed to create avatar. Please try again." });
      
      addActivityLog({
        step: 'error',
        message: 'Failed to create avatar',
        groupName: generateLooksName,
        details: error?.message || 'Unknown error'
      });
      
      toast({
        title: "Creation Failed",
        description: error?.message || "Failed to create avatar with looks. Please try again.",
        variant: "destructive",
      });
    },
  });

  const generateVideoMutation = useMutation({
    mutationFn: async (data: {
      avatarId: string;
      script: string;
      title: string;
      voiceId: string;
      voiceLibraryId?: string;
    }) => {
      const response = await apiRequest("POST", "/api/videos/generate", {
        avatarId: data.avatarId,
        script: data.script,
        title: data.title,
        voiceId: data.voiceLibraryId ? "voice_library" : data.voiceId,
        voiceLibraryId: data.voiceLibraryId,
        isTalkingPhoto: true,
        test: false,
        voiceSpeed: 1.0,
      });
      return response.json();
    },
    onSuccess: (result) => {
      setCurrentVideo(result.data || result);
      setShowVideoDialog(true);
      toast({
        title: "Video Generation Started!",
        description: "Your AI avatar video is being created. This may take a few minutes.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error?.message || "Failed to start video generation",
        variant: "destructive",
      });
    },
  });

  const checkStatusMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const response = await apiRequest("GET", `/api/videos/${videoId}/status`);
      return response.json();
    },
    onSuccess: (result) => {
      setCurrentVideo((prev) => (prev ? { ...prev, ...result } : result));
    },
  });

  const generateScriptMutation = useMutation({
    mutationFn: async () => {
      const platform = PLATFORM_OPTIONS.find(p => p.id === selectedPlatform);
      const response = await apiRequest("POST", "/api/generate-script", {
        topic: videoTitle || "professional real estate introduction",
        videoType: "introduction",
        platform: platform?.name || "Instagram Reel",
        duration: platform?.duration || 30,
        customPrompt: customPrompt || undefined,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setScript(data.script || "");
      toast({
        title: "Script Generated!",
        description: `Created a ${PLATFORM_OPTIONS.find(p => p.id === selectedPlatform)?.duration || 30}-second script for ${PLATFORM_OPTIONS.find(p => p.id === selectedPlatform)?.name || 'your video'}.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error?.message || "Failed to generate script",
        variant: "destructive",
      });
    },
  });

  const uploadVoiceMutation = useMutation({
    mutationFn: async ({
      blob,
      name,
      language,
      gender,
    }: {
      blob: Blob;
      name: string;
      language?: string;
      gender?: string;
    }) => {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      formData.append("name", name);
      if (language) formData.append("language", language);
      if (gender) formData.append("gender", gender);

      const response = await fetch("/api/custom-voices", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload voice");
      }
      return response.json();
    },
    onSuccess: (data: CustomVoice & { cloneError?: string }) => {
      if (data.cloneError) {
        toast({
          title: "Voice Saved (Clone Failed)",
          description: `${data.cloneError} You can retry the clone from "My Voices".`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Cloning Voice…",
          description:
            "Your voice was saved and is now being cloned. We'll let you know the moment it's ready.",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/custom-voices"] });
      setSelectedVoiceId(`voice_library_${data.id}`);
      setRecordedBlob(null);
      setRecordedUrl("");
      setVoiceName("");
      setVoiceLanguage("");
      setVoiceGender("");
      setVoiceTab("custom");
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const renameVoiceMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await fetch(`/api/custom-voices/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to rename voice");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Voice Renamed" });
      queryClient.invalidateQueries({ queryKey: ["/api/custom-voices"] });
      setRenamingVoiceId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Rename Failed",
        description: error.message,
        variant: "destructive",
      });
      setRenamingVoiceId(null);
    },
  });

  const retryCloneMutation = useMutation({
    mutationFn: async (voiceId: string) => {
      const response = await fetch(`/api/custom-voices/${voiceId}/retry-clone`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to retry voice clone");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Cloning Voice…",
        description:
          "We're cloning your voice again. We'll let you know the moment it's ready.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/custom-voices"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Clone Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteVoiceMutation = useMutation({
    mutationFn: async (voiceId: string) => {
      const response = await fetch(`/api/custom-voices/${voiceId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete voice");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Voice Deleted",
        description: "Your custom voice has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/custom-voices"] });
      if (selectedVoiceId.startsWith("voice_library_")) {
        setSelectedVoiceId("119caed25533477ba63822d5d1552d25");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Deletion Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteAvatarLookMutation = useMutation({
    mutationFn: async (avatarId: string) => {
      const response = await fetch(`/api/photo-avatars/${avatarId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete avatar look");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Avatar Look Deleted",
        description: "The avatar look has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/photo-avatar-groups", selectedAvatarGroup, "looks"] });
      if (selectedAvatarLook && deleteAvatarLookMutation.variables === selectedAvatarLook) {
        setSelectedAvatarLook("");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Deletion Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Motion video generation using HeyGen API
  const handleGenerateMotion = async () => {
    if (!motionPrompt.trim()) {
      toast({
        title: "Enter a prompt",
        description: "Please describe how you want your avatar to move.",
        variant: "destructive",
      });
      return;
    }

    const currentLook = availableLooks.find(look => (look.avatar_id || look.id) === selectedAvatarLook) || availableLooks[0];
    const avatarId = currentLook?.id || currentLook?.avatar_id;
    
    if (!avatarId) {
      toast({
        title: "No avatar selected",
        description: "Please select an avatar look first.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingMotion(true);
    setMotionStatus("starting");
    setMotionProgress(0);
    setMotionVideoUrl(null);

    // Demo mode: use pre-recorded video with simulated progress
    if (isDemo) {
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 10;
        setMotionProgress(Math.min(progress, 90));
        setMotionStatus("processing");
      }, 200);

      setTimeout(() => {
        clearInterval(progressInterval);
        setMotionVideoUrl(demoMotionVideo);
        setMotionStatus("completed");
        setMotionProgress(100);
        setIsGeneratingMotion(false);
        setMotionDialogStep("voice");
        toast({
          title: "Motion Video Ready!",
          description: "Demo: Now add your voice to make your avatar speak.",
        });
      }, 2500);
      return;
    }

    try {
      // Use HeyGen's add_motion API instead of Kling
      const response = await fetch(`/api/photo-avatars/${avatarId}/add-motion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          prompt: motionPrompt,
          motionType: "consistent",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.details || "Failed to start motion generation");
      }

      // HeyGen returns a motion job ID, poll for completion
      setMotionTaskId(avatarId);
      setMotionStatus("processing");
      pollHeyGenMotionStatus(avatarId);
    } catch (error) {
      console.error("Motion generation error:", error);
      setMotionStatus("failed");
      setIsGeneratingMotion(false);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate motion video",
        variant: "destructive",
      });
    }
  };

  // Poll HeyGen avatar status for motion completion
  const pollHeyGenMotionStatus = async (avatarId: string) => {
    const maxPolls = 60;
    let pollCount = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/photo-avatars/${avatarId}/status`, {
          credentials: "include",
        });

        const result = await response.json();
        pollCount++;

        setMotionProgress(Math.min(95, Math.round((pollCount / maxPolls) * 100)));

        // Check if motion is ready and has preview URL
        if (result.is_motion && result.motion_preview_url) {
          setMotionVideoUrl(result.motion_preview_url);
          setMotionStatus("completed");
          setMotionProgress(100);
          setIsGeneratingMotion(false);
          setMotionDialogStep("voice");
          // Refresh avatar looks to update UI
          queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups", selectedAvatarGroup, "looks"] });
          toast({
            title: "Motion Video Ready!",
            description: "Now add your voice to make your avatar speak.",
          });
          return;
        }

        if (result.status === "failed" || result.error) {
          setMotionStatus("failed");
          setIsGeneratingMotion(false);
          toast({
            title: "Generation Failed",
            description: result.error || "Video generation failed",
            variant: "destructive",
          });
          return;
        }

        // If motion not ready yet, keep polling
        if (pollCount < maxPolls && !result.is_motion) {
          setMotionStatus("processing");
          setTimeout(poll, 3000);
        } else if (pollCount >= maxPolls) {
          setMotionStatus("timeout");
          setIsGeneratingMotion(false);
          toast({
            title: "Generation Timeout",
            description: "Video is still processing. Please check back later.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Poll error:", error);
        setMotionStatus("failed");
        setIsGeneratingMotion(false);
      }
    };

    poll();
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
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
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

  const startMotionRecording = async () => {
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
    } catch (error: any) {
      const { title, description } = getRecordingErrorMessage(error);
      toast({
        title,
        description,
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleUseHeygenVoice = () => {
    if (heygenVoiceId.trim()) {
      setSelectedVoiceId(heygenVoiceId.trim());
      toast({
        title: "HeyGen Voice Selected",
        description: `Using voice ID: ${heygenVoiceId.trim()}`,
      });
    }
  };

  useEffect(() => {
    if (showVideoDialog && currentVideo?.video_id) {
      const interval = setInterval(() => {
        checkStatusMutation.mutate(currentVideo.video_id);
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [showVideoDialog, currentVideo?.video_id]);

  const canProceedToStep2 = !!selectedAvatarLook;
  const canProceedToStep3 = !!selectedVoiceId;
  const canGenerateVideo = !!selectedAvatarLook && !!selectedVoiceId && script.trim().length > 0;

  const handleNext = () => {
    if (currentStep === 1 && !canProceedToStep2) {
      toast({
        title: "Avatar Required",
        description: "Please select an avatar look to proceed.",
        variant: "destructive",
      });
      return;
    }
    if (currentStep === 2 && !canProceedToStep3) {
      toast({
        title: "Voice Required",
        description: "Please select a voice to proceed.",
        variant: "destructive",
      });
      return;
    }
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleGenerateVideo = () => {
    if (!canGenerateVideo) {
      toast({
        title: "Missing Information",
        description: "Please complete all steps before generating.",
        variant: "destructive",
      });
      return;
    }

    // Extract voice library ID if using a custom voice
    let voiceLibraryId: string | undefined;
    let finalVoiceId = selectedVoiceId;
    
    if (selectedVoiceId.startsWith("voice_library_")) {
      voiceLibraryId = selectedVoiceId.replace("voice_library_", "");
      finalVoiceId = "voice_library";
    }

    generateVideoMutation.mutate({
      avatarId: selectedAvatarLook,
      script: script.trim(),
      title: videoTitle.trim() || "AI Avatar Video",
      voiceId: finalVoiceId,
      voiceLibraryId,
    });
  };

  const handlePlayVoice = (voiceId: string, audioUrl?: string) => {
    if (playingVoiceId === voiceId) {
      audioRef.current?.pause();
      setPlayingVoiceId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.onended = () => setPlayingVoiceId(null);
      audio.play();
      audioRef.current = audio;
      setPlayingVoiceId(voiceId);
    }
  };

  const selectedGroup = avatarGroups.find((g) => g.group_id === selectedAvatarGroup);

  // Helper to add activity log entry
  const addActivityLog = (log: Omit<typeof activityLogs[0], 'id' | 'timestamp'>) => {
    const timestamp = new Date().toLocaleTimeString();
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setActivityLogs(prev => [...prev.slice(-30), { ...log, id, timestamp }]);
    setTimeout(() => {
      if (activityLogRef.current) {
        activityLogRef.current.scrollTop = activityLogRef.current.scrollHeight;
      }
    }, 100);
  };
  
  // Helper to get step icon and color
  const getStepStyle = (step: typeof activityLogs[0]['step']) => {
    switch (step) {
      case 'upload':
        return { icon: Upload, color: 'text-blue-500', bg: 'bg-blue-50' };
      case 'group_created':
        return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' };
      case 'waiting':
        return { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-50' };
      case 'training_started':
        return { icon: Sparkles, color: 'text-purple-500', bg: 'bg-purple-50' };
      case 'training_progress':
        return { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-50' };
      case 'training_complete':
        return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' };
      case 'generating_looks':
        return { icon: Wand2, color: 'text-purple-500', bg: 'bg-purple-50' };
      case 'looks_complete':
        return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' };
      case 'error':
        return { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50' };
      default:
        return { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-50' };
    }
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

  return (
    <div className="flex gap-4" data-testid="avatar-studio">
      {/* Main Content */}
      <div className="flex-1 space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-[#D4AF37]" />
                Avatar Studio
              </CardTitle>
              <CardDescription>
                Create professional AI avatar videos in 3 simple steps
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowActivityPanel(!showActivityPanel)}
              className="flex items-center gap-1"
              data-testid="button-toggle-activity-log"
            >
              <Terminal className="w-4 h-4" />
              {showActivityPanel ? 'Hide' : 'Show'} Curious
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-8 px-4">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              const isClickable = step.id < currentStep || 
                (step.id === 2 && canProceedToStep2) || 
                (step.id === 3 && canProceedToStep2 && canProceedToStep3);

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
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Select Your Avatar</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => persistImagesMutation.mutate()}
                    disabled={persistImagesMutation.isPending}
                    className="border-gray-300 text-gray-600 hover:bg-gray-100"
                    data-testid="button-fix-images"
                  >
                    {persistImagesMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Fix Images
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowQuickUpload(true)}
                    className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10"
                    data-testid="button-quick-upload"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Quick Upload
                  </Button>
                </div>
              </div>

              {groupsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
                </div>
              ) : readyAvatarGroups.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <User className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500 mb-4">No trained avatars available yet.</p>
                  <Button
                    onClick={() => setShowQuickUpload(true)}
                    className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white"
                    data-testid="button-upload-first-avatar"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Your First Photo
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {readyAvatarGroups.map((group) => (
                    <div
                      key={group.group_id}
                      onClick={() => {
                        setSelectedAvatarGroup(group.group_id);
                        setSelectedAvatarLook("");
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedAvatarGroup(group.group_id);
                          setSelectedAvatarLook("");
                        }
                      }}
                      className={`relative p-3 rounded-xl border-2 transition-all text-left cursor-pointer ${
                        selectedAvatarGroup === group.group_id
                          ? "border-[#D4AF37] bg-[#D4AF37]/5 shadow-lg"
                          : "border-gray-200 dark:border-gray-700 hover:border-[#D4AF37]/50"
                      }`}
                      data-testid={`avatar-group-${group.group_id}`}
                    >
                      {/* Top action bar */}
                      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                        {selectedAvatarGroup === group.group_id && (
                          <div className="w-6 h-6 bg-[#D4AF37] rounded-full flex items-center justify-center">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 bg-white/80 dark:bg-gray-900/80 hover:bg-white dark:hover:bg-gray-900 rounded-full shadow-sm"
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`button-avatar-menu-${group.group_id}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAvatarGroup(group.group_id);
                                toast({
                                  title: "Starting Look Generation...",
                                  description: "Please wait while we begin creating new looks.",
                                });
                                regenerateLooksMutation.mutate({
                                  groupId: group.group_id,
                                  groupName: group.name,
                                  previewImage: group.preview_image
                                });
                              }}
                              disabled={regenerateLooksMutation.isPending}
                              data-testid={`menu-edit-${group.group_id}`}
                            >
                              <Edit2 className="h-4 w-4 mr-2" />
                              Generate New Looks
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={async (e) => {
                                e.stopPropagation();
                                const confirmed = await confirm({
                                  title: "Delete Group",
                                  description: `Delete "${group.name}"? This cannot be undone.`,
                                  confirmText: "Delete",
                                  variant: "destructive",
                                });
                                if (confirmed) {
                                  deleteGroupMutation.mutate({
                                    groupId: group.group_id,
                                    groupName: group.name
                                  });
                                }
                              }}
                              className="text-red-600 focus:text-red-600"
                              data-testid={`menu-delete-${group.group_id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                copyAvatarId(group.group_id);
                              }}
                              data-testid={`menu-copy-id-${group.group_id}`}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Copy Avatar ID
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                retrainMutation.mutate({
                                  groupId: group.group_id,
                                  groupName: group.name,
                                  previewImage: group.preview_image
                                });
                              }}
                              disabled={retrainMutation.isPending || group.train_status === "processing"}
                              data-testid={`menu-retrain-${group.group_id}`}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Retrain
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                        {group.preview_image ? (
                          <img 
                            src={group.preview_image} 
                            alt={group.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <User className={`h-12 w-12 text-gray-400 ${group.preview_image ? 'hidden' : ''}`} />
                      </div>
                      <p className="font-medium text-sm truncate" data-testid={`text-group-name-${group.group_id}`}>
                        {group.name}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <Badge
                          variant={group.train_status === "ready" ? "default" : "secondary"}
                          className="text-xs"
                          data-testid={`badge-status-${group.group_id}`}
                        >
                          {group.train_status || group.status || "pending"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Regenerate Looks button for selected group */}
              {selectedAvatarGroup && selectedGroup && selectedGroup.train_status === "ready" && (
                <div className="mt-4 flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      regenerateLooksMutation.mutate({
                        groupId: selectedAvatarGroup,
                        groupName: selectedGroup.name,
                        previewImage: selectedGroup.preview_image
                      });
                    }}
                    disabled={regenerateLooksMutation.isPending}
                    className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10"
                    data-testid="button-regenerate-looks"
                  >
                    {regenerateLooksMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Regenerate Looks
                      </>
                    )}
                  </Button>
                  <span className="text-xs text-gray-500">
                    Generate new professional looks for this avatar
                  </span>
                </div>
              )}

              {selectedAvatarGroup && availableLooks.length > 0 && (
                <div className="mt-6">
                  <Label className="text-sm font-medium mb-3 block">
                    Select an Avatar Look <span className="text-gray-400 font-normal">(hover for preview, click to select)</span>
                  </Label>
                  
                  
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {availableLooks.map((look, index) => {
                      const lookId = look.avatar_id || look.id;
                      const imageUrl = look.image_url || look.image || "";
                      const hasMotion = look.is_motion && look.motion_preview_url;
                      const isHovered = hoveredLookId === lookId;
                      
                      return (
                        <div
                          key={lookId}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setSelectedAvatarLook(lookId);
                            toast({
                              title: "Avatar Selected",
                              description: "Now proceed to choose a voice for your video.",
                            });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedAvatarLook(lookId);
                              toast({
                                title: "Avatar Selected",
                                description: "Now proceed to choose a voice for your video.",
                              });
                            }
                          }}
                          onMouseEnter={() => setHoveredLookId(lookId)}
                          onMouseLeave={() => setHoveredLookId(null)}
                          className={`relative group rounded-lg overflow-hidden border-2 transition-all duration-200 cursor-pointer ${
                            selectedAvatarLook === lookId
                              ? "border-[#D4AF37] ring-2 ring-[#D4AF37]/30"
                              : "border-gray-200 dark:border-gray-700 hover:border-[#D4AF37]/50"
                          } ${isHovered ? "scale-[2] z-50 shadow-2xl" : "hover:shadow-lg"}`}
                          data-testid={`avatar-look-${lookId}`}
                        >
                          {/* Selected indicator */}
                          {selectedAvatarLook === lookId && (
                            <div className="absolute bottom-1 left-1 w-5 h-5 bg-[#D4AF37] rounded-full flex items-center justify-center z-10">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                          
                          {/* Motion badge */}
                          {hasMotion && (
                            <div className="absolute top-1 left-1 bg-purple-600 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 z-10">
                              <Play className="h-2.5 w-2.5" />
                              Motion
                            </div>
                          )}
                          
                          {/* Three-dot menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="absolute top-1 right-1 w-6 h-6 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center z-20 transition-colors"
                                data-testid={`button-menu-look-${lookId}`}
                              >
                                <MoreVertical className="h-3.5 w-3.5 text-white" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setChangeStyleDialogOpen(true);
                                }}
                                data-testid={`button-change-style-${lookId}`}
                              >
                                <Shirt className="h-4 w-4 mr-2" />
                                Change Style
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const confirmed = await confirm({
                                    title: "Delete Avatar Look",
                                    description: "Delete this avatar look? This cannot be undone.",
                                    confirmText: "Delete",
                                    variant: "destructive",
                                  });
                                  if (confirmed) {
                                    deleteAvatarLookMutation.mutate(lookId);
                                  }
                                }}
                                className="text-red-600 focus:text-red-600"
                                data-testid={`button-delete-look-${lookId}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          
                          {/* Image or Video on hover */}
                          {hasMotion && isHovered ? (
                            <video
                              src={look.motion_preview_url}
                              className="w-full aspect-square object-cover"
                              autoPlay
                              loop
                              muted
                              playsInline
                            />
                          ) : (
                            <img
                              src={imageUrl}
                              alt={look.name || `Look ${lookId}`}
                              className="w-full aspect-square object-cover"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {hasActiveLookGeneration && (
                <div className="mt-4 p-4 bg-gradient-to-r from-[#D4AF37]/10 to-[#D4AF37]/5 border border-[#D4AF37]/30 rounded-lg" data-testid="look-generation-progress">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-[#D4AF37]" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#D4AF37]">
                        Generating {pendingLookJobs.length} new look{pendingLookJobs.length !== 1 ? 's' : ''}...
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        This may take 2-5 minutes. Looks will appear automatically when ready.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    {pendingLookJobs.map((job) => (
                      <div key={job.id} className="flex items-center gap-2 text-xs text-gray-500">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#D4AF37] animate-pulse" />
                        <span>{job.lookName}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {job.status === 'processing' ? 'Processing' : 'Queued'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedAvatarGroup && availableLooks.length === 0 && !hasActiveLookGeneration && (
                <div className="text-center py-6 text-gray-500 border rounded-lg mt-4">
                  {selectedGroup?.train_status === "ready" ? (
                    <>
                      <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                      <p>No looks found for this avatar. Try refreshing or check HeyGen dashboard.</p>
                    </>
                  ) : selectedGroup?.train_status === "processing" || selectedGroup?.train_status === "training" ? (
                    <>
                      <Clock className="h-8 w-8 mx-auto mb-2 animate-pulse" />
                      <p>Training in progress. Looks will appear when complete.</p>
                    </>
                  ) : (
                    <>
                      <Clock className="h-8 w-8 mx-auto mb-2" />
                      <p>Loading looks...</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6" data-testid="step-2-content">
              <h3 className="text-lg font-semibold">Choose Your Voice</h3>

              <Tabs value={voiceTab} onValueChange={setVoiceTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="professional" className="text-xs sm:text-sm" data-testid="tab-professional">
                    <Volume2 className="h-4 w-4 mr-1 hidden sm:inline" />
                    Professional
                  </TabsTrigger>
                  <TabsTrigger value="custom" className="text-xs sm:text-sm" data-testid="tab-custom">
                    <Mic className="h-4 w-4 mr-1 hidden sm:inline" />
                    My Voices
                  </TabsTrigger>
                  <TabsTrigger value="record" className="text-xs sm:text-sm" data-testid="tab-record" title="Clone a new voice (record or upload)">
                    <Mic className="h-4 w-4 mr-1 hidden sm:inline" />
                    Record
                  </TabsTrigger>
                  <TabsTrigger value="heygen" className="text-xs sm:text-sm" data-testid="tab-heygen">
                    <Hash className="h-4 w-4 mr-1 hidden sm:inline" />
                    Voice ID
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="professional" className="space-y-3 mt-4">
                  <p className="text-sm text-gray-500">Select from our professional voice library</p>
                  <div className="grid gap-2">
                    {PROFESSIONAL_VOICES.map((voice) => (
                      <button
                        key={voice.id}
                        onClick={() => setSelectedVoiceId(voice.id)}
                        className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                          selectedVoiceId === voice.id
                            ? "border-[#D4AF37] bg-[#D4AF37]/5"
                            : "border-gray-200 dark:border-gray-700 hover:border-[#D4AF37]/50"
                        }`}
                        data-testid={`voice-professional-${voice.id}`}
                      >
                        {selectedVoiceId === voice.id && (
                          <div className="w-5 h-5 bg-[#D4AF37] rounded-full flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                        <Volume2 className="h-5 w-5 text-gray-500" />
                        <span className="font-medium">{voice.name}</span>
                      </button>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="custom" className="space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      {customVoices.length > 0 ? "Your saved custom voices" : "You don't have any cloned voices yet"}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setVoiceTab("record")}
                      data-testid="button-clone-new-voice"
                    >
                      <Mic className="h-4 w-4 mr-2" />
                      Clone a new voice
                    </Button>
                  </div>
                  {customVoices.length > 0 ? (
                    <>
                      <div className="grid gap-2">
                        {customVoices.map((voice) => (
                          <div
                            key={voice.id}
                            onClick={() => setSelectedVoiceId(`voice_library_${voice.id}`)}
                            className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all cursor-pointer ${
                              selectedVoiceId === `voice_library_${voice.id}`
                                ? "border-[#D4AF37] bg-[#D4AF37]/5"
                                : "border-gray-200 dark:border-gray-700 hover:border-[#D4AF37]/50"
                            }`}
                            data-testid={`voice-custom-${voice.id}`}
                          >
                            <div className="flex items-center gap-3">
                              {selectedVoiceId === `voice_library_${voice.id}` && (
                                <div className="w-5 h-5 bg-[#D4AF37] rounded-full flex items-center justify-center">
                                  <Check className="h-3 w-3 text-white" />
                                </div>
                              )}
                              <Mic className="h-5 w-5 text-[#D4AF37]" />
                              {renamingVoiceId === voice.id ? (
                                <Input
                                  autoFocus
                                  value={renamingVoiceName}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => setRenamingVoiceName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      renameSubmittedRef.current = true;
                                      const trimmed = renamingVoiceName.trim();
                                      if (trimmed && trimmed !== voice.name) {
                                        renameVoiceMutation.mutate({ id: voice.id, name: trimmed });
                                      } else {
                                        setRenamingVoiceId(null);
                                      }
                                      (e.currentTarget as HTMLInputElement).blur();
                                    } else if (e.key === "Escape") {
                                      e.preventDefault();
                                      renameSubmittedRef.current = true;
                                      setRenamingVoiceId(null);
                                      (e.currentTarget as HTMLInputElement).blur();
                                    }
                                  }}
                                  onBlur={() => {
                                    if (renameSubmittedRef.current || renameVoiceMutation.isPending) {
                                      renameSubmittedRef.current = false;
                                      return;
                                    }
                                    const trimmed = renamingVoiceName.trim();
                                    if (trimmed && trimmed !== voice.name) {
                                      renameVoiceMutation.mutate({ id: voice.id, name: trimmed });
                                    } else {
                                      setRenamingVoiceId(null);
                                    }
                                  }}
                                  className="h-8 w-48"
                                  data-testid={`input-rename-voice-${voice.id}`}
                                />
                              ) : (
                                <button
                                  type="button"
                                  className="font-medium text-left hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRenamingVoiceId(voice.id);
                                    setRenamingVoiceName(voice.name);
                                  }}
                                  title="Click to rename"
                                  data-testid={`button-rename-voice-${voice.id}`}
                                >
                                  {voice.name}
                                </button>
                              )}
                              {voice.status === "ready" && voice.heygenVoiceId ? (
                                <Badge className="text-xs bg-[#D4AF37]/15 text-[#8a6d10] dark:text-[#D4AF37] border border-[#D4AF37]/30">Cloned</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">Custom</Badge>
                              )}
                              {voice.status === "ready" && !voice.heygenVoiceId && voice.heygenAudioAssetId && (
                                <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Ready</Badge>
                              )}
                              {voice.status === "cloning" && (
                                <Badge className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Cloning…</Badge>
                              )}
                              {voice.status === "failed" && (
                                <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">Clone Failed</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {voice.status === "failed" && voice.heygenAudioAssetId && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    retryCloneMutation.mutate(voice.id);
                                  }}
                                  disabled={retryCloneMutation.isPending}
                                  data-testid={`button-retry-clone-${voice.id}`}
                                >
                                  {retryCloneMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Retry clone"
                                  )}
                                </Button>
                              )}
                              {voiceAudioUrls[voice.id] && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePlayVoice(voice.id, voiceAudioUrls[voice.id]);
                                  }}
                                  data-testid={`button-play-custom-voice-${voice.id}`}
                                >
                                  {playingVoiceId === voice.id ? (
                                    <Pause className="h-4 w-4" />
                                  ) : (
                                    <Play className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                              {voice.status === "ready" && voice.sampleAudioUrl && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePlayVoice(`preview_${voice.id}`, voice.sampleAudioUrl ?? undefined);
                                  }}
                                  title="Preview cloned voice"
                                  data-testid={`button-preview-cloned-voice-${voice.id}`}
                                >
                                  {playingVoiceId === `preview_${voice.id}` ? (
                                    <>
                                      <Pause className="h-4 w-4 mr-1" />
                                      <span className="text-xs">Preview</span>
                                    </>
                                  ) : (
                                    <>
                                      <Play className="h-4 w-4 mr-1" />
                                      <span className="text-xs">Preview</span>
                                    </>
                                  )}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const confirmed = await confirm({
                                    title: "Delete Voice",
                                    description: `Delete "${voice.name}"? This cannot be undone.`,
                                    confirmText: "Delete",
                                    variant: "destructive",
                                  });
                                  if (confirmed) {
                                    deleteVoiceMutation.mutate(voice.id);
                                  }
                                }}
                                disabled={deleteVoiceMutation.isPending}
                                data-testid={`button-delete-custom-voice-${voice.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                      <Mic className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500 mb-2">No custom voices yet</p>
                      <p className="text-sm text-gray-400">Record a voice in the "Record" tab to create one</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="record" className="space-y-4 mt-4">
                  <p className="text-sm text-gray-500">Record your own voice for the avatar</p>
                  
                  <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg space-y-4">
                    {!recordedBlob ? (
                      <>
                        <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                          isRecording 
                            ? "bg-red-500 animate-pulse" 
                            : "bg-gray-100 dark:bg-gray-800"
                        }`}>
                          <Mic className={`h-10 w-10 ${isRecording ? "text-white" : "text-gray-400"}`} />
                        </div>
                        
                        {isRecording && (
                          <div className="text-2xl font-mono text-red-500">
                            {formatTime(recordingTime)}
                          </div>
                        )}
                        
                        <Button
                          size="lg"
                          onClick={isRecording ? stopRecording : startRecording}
                          className={isRecording 
                            ? "bg-red-500 hover:bg-red-600" 
                            : "bg-[#D4AF37] hover:bg-[#D4AF37]/90"
                          }
                          data-testid={isRecording ? "button-stop-recording" : "button-start-recording"}
                        >
                          {isRecording ? (
                            <>
                              <Square className="h-5 w-5 mr-2" />
                              Stop Recording
                            </>
                          ) : (
                            <>
                              <Mic className="h-5 w-5 mr-2" />
                              Start Recording
                            </>
                          )}
                        </Button>
                        
                        <p className="text-xs text-gray-500">
                          Record at least 30 seconds of clear speech for best results
                        </p>

                        <div className="flex items-center gap-2 w-full">
                          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                          <span className="text-xs text-gray-400 uppercase">or</span>
                          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                        </div>

                        <input
                          id="voice-audio-upload"
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          data-testid="input-upload-voice-file"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const url = URL.createObjectURL(file);
                            setRecordedBlob(file);
                            setRecordedUrl(url);
                            setRecordingTime(0);
                            e.target.value = "";
                          }}
                        />
                        <Button
                          variant="outline"
                          onClick={() => document.getElementById("voice-audio-upload")?.click()}
                          data-testid="button-upload-voice-file"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload an audio file
                        </Button>
                        <p className="text-xs text-gray-400">
                          MP3, WAV, M4A, or any common audio format. 30+ seconds recommended.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="w-full space-y-4">
                          <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => {
                                const audio = new Audio(recordedUrl);
                                audio.play();
                              }}
                              data-testid="button-play-recording"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <div className="flex-1">
                              <p className="font-medium">Recording Complete</p>
                              <p className="text-sm text-gray-500">{formatTime(recordingTime)} recorded</p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setRecordedBlob(null);
                                setRecordedUrl("");
                                setRecordingTime(0);
                              }}
                              data-testid="button-discard-recording"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="voice-name">Voice Name</Label>
                            <Input
                              id="voice-name"
                              value={voiceName}
                              onChange={(e) => setVoiceName(e.target.value)}
                              placeholder="e.g., My Professional Voice"
                              data-testid="input-voice-name"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="voice-language">Language (optional)</Label>
                              <Select value={voiceLanguage || "auto"} onValueChange={(v) => setVoiceLanguage(v === "auto" ? "" : v)}>
                                <SelectTrigger id="voice-language" data-testid="select-voice-language">
                                  <SelectValue placeholder="Auto detect" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="auto">Auto detect</SelectItem>
                                  <SelectItem value="en">English</SelectItem>
                                  <SelectItem value="es">Spanish</SelectItem>
                                  <SelectItem value="fr">French</SelectItem>
                                  <SelectItem value="de">German</SelectItem>
                                  <SelectItem value="pt">Portuguese</SelectItem>
                                  <SelectItem value="zh">Chinese</SelectItem>
                                  <SelectItem value="ja">Japanese</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="voice-gender">Gender (optional)</Label>
                              <Select value={voiceGender || "unspecified"} onValueChange={(v) => setVoiceGender(v === "unspecified" ? "" : v)}>
                                <SelectTrigger id="voice-gender" data-testid="select-voice-gender">
                                  <SelectValue placeholder="Unspecified" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unspecified">Unspecified</SelectItem>
                                  <SelectItem value="female">Female</SelectItem>
                                  <SelectItem value="male">Male</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <p className="text-xs text-gray-500">
                            We'll clone your voice with HeyGen so you can use it as the narrator for any future avatar video.
                          </p>

                          <Button
                            className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90"
                            disabled={!voiceName.trim() || uploadVoiceMutation.isPending}
                            onClick={() => {
                              if (recordedBlob && voiceName.trim()) {
                                uploadVoiceMutation.mutate({
                                  blob: recordedBlob,
                                  name: voiceName.trim(),
                                  language: voiceLanguage || undefined,
                                  gender: voiceGender || undefined,
                                });
                              }
                            }}
                            data-testid="button-save-voice"
                          >
                            {uploadVoiceMutation.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Cloning your voice...
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4 mr-2" />
                                Save & Clone Voice
                              </>
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="heygen" className="space-y-4 mt-4">
                  <p className="text-sm text-gray-500">Enter a HeyGen voice ID to use a specific voice</p>
                  
                  <div className="space-y-4 p-4 border rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor="heygen-voice-id">HeyGen Voice ID</Label>
                      <Input
                        id="heygen-voice-id"
                        value={heygenVoiceId}
                        onChange={(e) => setHeygenVoiceId(e.target.value)}
                        placeholder="e.g., 1bd001e7e50f421d891986aad5158bc8"
                        className="font-mono text-sm"
                        data-testid="input-heygen-voice-id"
                      />
                      <p className="text-xs text-gray-500">
                        Find voice IDs in your HeyGen dashboard under Voices
                      </p>
                    </div>
                    
                    <Button
                      onClick={handleUseHeygenVoice}
                      disabled={!heygenVoiceId.trim()}
                      className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90"
                      data-testid="button-use-heygen-voice"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Use This Voice
                    </Button>
                    
                    {selectedVoiceId && !selectedVoiceId.startsWith("voice_library_") && 
                     !PROFESSIONAL_VOICES.find(v => v.id === selectedVoiceId) && (
                      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-700 dark:text-green-400">
                          Using voice ID: {selectedVoiceId}
                        </span>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6" data-testid="step-3-content">
              <h3 className="text-lg font-semibold">Create Your Video</h3>

              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Selected:</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-[#D4AF37]" />
                    <span className="font-medium">{selectedGroup?.name || "Avatar"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4 text-[#D4AF37]" />
                    <span className="font-medium">
                      {PROFESSIONAL_VOICES.find((v) => v.id === selectedVoiceId)?.name ||
                        customVoices.find((v) => `voice_library_${v.id}` === selectedVoiceId)?.name ||
                        "Voice"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="video-title">Video Title</Label>
                <Input
                  id="video-title"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="e.g., Welcome to Our Agency"
                  data-testid="input-video-title"
                />
              </div>

              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5 text-[#D4AF37]" />
                  <h4 className="font-medium">AI Script Generator</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="platform-select">Platform</Label>
                    <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                      <SelectTrigger id="platform-select" data-testid="select-platform">
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                      <SelectContent>
                        {PLATFORM_OPTIONS.map((platform) => (
                          <SelectItem key={platform.id} value={platform.id}>
                            <div className="flex flex-col">
                              <span>{platform.name}</span>
                              <span className="text-xs text-gray-500">{platform.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-gray-500">Target Duration</Label>
                    <div className="h-10 flex items-center px-3 border rounded-md bg-white dark:bg-gray-700 text-sm">
                      {PLATFORM_OPTIONS.find(p => p.id === selectedPlatform)?.duration || 30} seconds
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="custom-prompt">Custom Instructions (optional)</Label>
                  <Textarea
                    id="custom-prompt"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="e.g., Focus on luxury homes in West Omaha, mention our 20 years of experience..."
                    rows={2}
                    className="resize-none"
                    data-testid="input-custom-prompt"
                  />
                </div>
                
                <Button
                  onClick={() => generateScriptMutation.mutate()}
                  disabled={generateScriptMutation.isPending}
                  className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white"
                  data-testid="button-ai-assist"
                >
                  {generateScriptMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Script...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Generate Script with AI
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="script">Script</Label>
                <Textarea
                  id="script"
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="Enter what your avatar will say, or use AI to generate a script above..."
                  rows={6}
                  className="resize-none"
                  data-testid="textarea-script"
                />
                <div className="flex justify-between text-sm text-gray-500">
                  <span>{script.length}/1500 characters</span>
                  {script.length > 1500 && (
                    <span className="text-red-500">Script too long</span>
                  )}
                </div>
              </div>

              <div className="pt-4">
                <Button
                  size="lg"
                  onClick={handleGenerateVideo}
                  disabled={!canGenerateVideo || generateVideoMutation.isPending || script.length > 1500}
                  className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white"
                  data-testid="button-generate-video"
                >
                  {generateVideoMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Starting Generation...
                    </>
                  ) : (
                    <>
                      <Video className="h-5 w-5 mr-2" />
                      Generate Video
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8 pt-6 border-t">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
              data-testid="button-back"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            {currentStep < 3 ? (
              <Button
                onClick={handleNext}
                className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white"
                data-testid="button-next"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <div />
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showQuickUpload} onOpenChange={(open) => {
        setShowQuickUpload(open);
        if (!open) {
          setUploadDialogTab("quick");
          setGenerateLooksStatus("idle");
          setGenerateLooksResult(null);
        }
      }}>
        <DialogContent className="max-w-lg" data-testid="dialog-quick-upload">
          <DialogHeader>
            <DialogTitle>Create Avatar</DialogTitle>
            <DialogDescription>
              Upload a photo to create a new avatar
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={uploadDialogTab} onValueChange={(v) => setUploadDialogTab(v as "quick" | "upload-looks")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="quick" data-testid="tab-quick-upload">
                <Upload className="h-4 w-4 mr-2" />
                Quick Upload
              </TabsTrigger>
              <TabsTrigger value="upload-looks" data-testid="tab-upload-looks">
                <Upload className="h-4 w-4 mr-2" />
                Upload Looks
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="quick" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="upload-name">Avatar Name</Label>
                <Input
                  id="upload-name"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="e.g., My Professional Avatar"
                  data-testid="input-upload-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="upload-file">Photo</Label>
                <Input
                  id="upload-file"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                  data-testid="input-upload-file"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowQuickUpload(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (uploadedFile && uploadName.trim()) {
                      uploadPhotoMutation.mutate({
                        file: uploadedFile,
                        name: uploadName.trim(),
                      });
                    }
                  }}
                  disabled={!uploadedFile || !uploadName.trim() || uploadPhotoMutation.isPending}
                  className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white"
                  data-testid="button-confirm-upload"
                >
                  {uploadPhotoMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Upload
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="upload-looks" className="space-y-4 mt-4">
              {uploadLooksStatus === "complete" && uploadLooksResult && !uploadLooksResult.error ? (
                <div className="space-y-4 text-center py-4">
                  <div className="relative">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Looks Added!</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {uploadLooksResult.message || "Your looks have been added to the avatar."}
                    </p>
                  </div>
                  <Button 
                    onClick={() => {
                      setShowQuickUpload(false);
                      setUploadLooksStatus("idle");
                      setUploadLooksResult(null);
                      setUploadLooksFiles([]);
                      setUploadLooksNames(["", "", "", ""]);
                      setUploadLooksAvatarName("");
                      queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups"] });
                    }}
                    className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white"
                  >
                    Done
                  </Button>
                </div>
              ) : uploadLooksStatus === "error" ? (
                <div className="space-y-4 text-center py-4">
                  <AlertCircle className="h-12 w-12 mx-auto text-red-500" />
                  <div>
                    <h3 className="font-semibold text-lg text-red-600">Upload Failed</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {uploadLooksResult?.error || "Something went wrong. Please try again."}
                    </p>
                  </div>
                  <Button 
                    onClick={() => {
                      setUploadLooksStatus("idle");
                      setUploadLooksResult(null);
                    }}
                    variant="outline"
                  >
                    Try Again
                  </Button>
                </div>
              ) : (
                <>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Upload actual photos of yourself in different settings or outfits to create multiple looks for your avatar. Each look will preserve your face while showing you in different styles.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="upload-looks-group">Select Avatar *</Label>
                    <Select
                      value={uploadLooksAvatarName}
                      onValueChange={(v) => setUploadLooksAvatarName(v)}
                      disabled={uploadLooksStatus === "uploading"}
                    >
                      <SelectTrigger data-testid="select-upload-looks-group">
                        <SelectValue placeholder="Select an avatar to add looks to" />
                      </SelectTrigger>
                      <SelectContent>
                        {readyAvatarGroups.length === 0 ? (
                          <SelectItem value="_none" disabled>No avatars available - create one first</SelectItem>
                        ) : (
                          readyAvatarGroups.map((group) => (
                            <SelectItem key={group.group_id} value={group.group_id}>
                              {group.name} ({group.num_looks || 0} looks)
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label>Upload Photos (1-4)</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {[0, 1, 2, 3].map((index) => (
                        <div key={index} className="space-y-2 p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              Look {index + 1}
                            </span>
                            {uploadLooksFiles[index] && (
                              <Badge variant="secondary" className="text-xs">
                                Selected
                              </Badge>
                            )}
                          </div>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              const newFiles = [...uploadLooksFiles];
                              if (file) {
                                newFiles[index] = file;
                              } else {
                                delete newFiles[index];
                              }
                              setUploadLooksFiles(newFiles.filter(Boolean));
                            }}
                            disabled={uploadLooksStatus === "uploading"}
                            data-testid={`input-upload-looks-file-${index}`}
                            className="text-sm"
                          />
                          <Input
                            placeholder={["Executive", "Casual", "Outdoor", "Modern"][index] || `Look ${index + 1}`}
                            value={uploadLooksNames[index]}
                            onChange={(e) => {
                              const newNames = [...uploadLooksNames];
                              newNames[index] = e.target.value;
                              setUploadLooksNames(newNames);
                            }}
                            disabled={uploadLooksStatus === "uploading"}
                            data-testid={`input-upload-looks-name-${index}`}
                            className="text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {uploadLooksStatus === "uploading" && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm font-medium">Uploading looks...</span>
                      </div>
                      <p className="text-xs text-blue-500 mt-1">
                        This may take a moment depending on file sizes.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowQuickUpload(false)}
                      disabled={uploadLooksStatus === "uploading"}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={async () => {
                        if (!uploadLooksAvatarName || uploadLooksFiles.length === 0) return;
                        
                        setUploadLooksStatus("uploading");
                        
                        try {
                          const formData = new FormData();
                          uploadLooksFiles.forEach((file) => {
                            formData.append("photos", file);
                          });
                          formData.append("names", JSON.stringify(
                            uploadLooksNames.filter((_, i) => uploadLooksFiles[i])
                          ));
                          
                          const response = await fetch(
                            `/api/photo-avatars/groups/${uploadLooksAvatarName}/upload-looks`,
                            {
                              method: "POST",
                              body: formData,
                              credentials: "include",
                            }
                          );
                          
                          const result = await response.json();
                          
                          if (response.ok && result.success) {
                            setUploadLooksResult(result);
                            setUploadLooksStatus("complete");
                          } else {
                            setUploadLooksResult({ error: result.error || "Upload failed" });
                            setUploadLooksStatus("error");
                          }
                        } catch (error) {
                          setUploadLooksResult({ error: "Network error. Please try again." });
                          setUploadLooksStatus("error");
                        }
                      }}
                      disabled={!uploadLooksAvatarName || uploadLooksFiles.length === 0 || uploadLooksStatus === "uploading"}
                      className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white"
                      data-testid="button-upload-looks"
                    >
                      {uploadLooksStatus === "uploading" ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Upload {uploadLooksFiles.length > 0 ? `${uploadLooksFiles.length} Look${uploadLooksFiles.length > 1 ? 's' : ''}` : 'Looks'}
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={showVideoDialog} onOpenChange={setShowVideoDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-video-status">
          <DialogHeader>
            <DialogTitle>Video Generation Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {currentVideo && (
              <>
                <div className="flex items-center gap-3">
                  {getStatusIcon(currentVideo.status)}
                  <span className="font-medium capitalize">
                    {currentVideo.status === "completed" || currentVideo.status === "ready"
                      ? "Video Ready!"
                      : currentVideo.status === "processing" || currentVideo.status === "generating"
                      ? "Generating your video..."
                      : currentVideo.status === "failed"
                      ? "Generation failed"
                      : "Processing..."}
                  </span>
                </div>

                {(currentVideo.status === "processing" || currentVideo.status === "generating" || currentVideo.status === "pending") && (
                  <div className="space-y-2">
                    <Progress value={undefined} className="animate-pulse" />
                    <p className="text-sm text-gray-500 text-center">
                      This usually takes 2-5 minutes. We'll update automatically.
                    </p>
                  </div>
                )}

                {(currentVideo.status === "completed" || currentVideo.status === "ready") && (currentVideo.video_url || currentVideo.videoUrl) && (
                  <div className="space-y-4">
                    <video
                      controls
                      className="w-full rounded-lg"
                      src={currentVideo.video_url || currentVideo.videoUrl}
                      data-testid="video-player"
                    />
                    <div className="flex justify-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          const url = currentVideo.video_url || currentVideo.videoUrl;
                          if (url) window.open(url, "_blank");
                        }}
                        data-testid="button-download-video"
                      >
                        Download
                      </Button>
                      <Button
                        onClick={() => {
                          setShowVideoDialog(false);
                          setCurrentVideo(null);
                          setScript("");
                          setVideoTitle("");
                          setCurrentStep(1);
                        }}
                        className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white"
                        data-testid="button-create-another"
                      >
                        Create Another
                      </Button>
                    </div>
                  </div>
                )}

                {currentVideo.status === "failed" && (
                  <div className="text-center py-6">
                    <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
                    <p className="text-red-500 mb-4">
                      {currentVideo.error || "Video generation failed. Please try again."}
                    </p>
                    <Button
                      onClick={() => {
                        setShowVideoDialog(false);
                        setCurrentVideo(null);
                      }}
                      variant="outline"
                    >
                      Close
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>


      {/* Motion Generation Dialog - Multi-step: Motion → Voice → Final */}
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
              {motionDialogStep === "motion" && "Transform your image into a video with natural motion."}
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

          {/* STEP 1: Motion Selection */}
          {motionDialogStep === "motion" && (
            <>
              <div className="flex gap-6 py-4">
                {/* Left side: Avatar Preview */}
                <div className="flex-shrink-0">
                  <div className="w-48 h-64 rounded-lg overflow-hidden border-2 border-cyan-400 shadow-lg bg-gradient-to-b from-cyan-50 to-white dark:from-cyan-950/30 dark:to-gray-900">
                    <img
                      src={(availableLooks.find(look => (look.avatar_id || look.id) === selectedAvatarLook) || availableLooks[0])?.image_url || (availableLooks.find(look => (look.avatar_id || look.id) === selectedAvatarLook) || availableLooks[0])?.image || ""}
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
                        className="data-[state=active]:text-cyan-600 data-[state=active]:border-b-2 data-[state=active]:border-cyan-500"
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
                                  ? "bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800"
                                  : "hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent"
                              }`}
                              onClick={() => {
                                setSelectedMotionTemplate(template.id);
                                setMotionPrompt(template.prompt);
                              }}
                              data-testid={`template-${template.id}`}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{template.name}</span>
                                  {template.id === "talking_naturally" && (
                                    <span className="text-xs text-gray-500">(Default)</span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">{template.description}</p>
                              </div>
                              {selectedMotionTemplate === template.id && (
                                <CheckCircle className="h-5 w-5 text-cyan-500 flex-shrink-0" />
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="custom" className="mt-0">
                      <Textarea
                        id="motion-prompt"
                        placeholder="Describe how you want your avatar to move..."
                        value={motionPrompt}
                        onChange={(e) => {
                          setMotionPrompt(e.target.value);
                          setSelectedMotionTemplate("");
                        }}
                        className="min-h-[180px]"
                        disabled={isGeneratingMotion || motionStatus === "processing"}
                        data-testid="input-motion-prompt"
                      />
                    </TabsContent>

                    <TabsContent value="upload" className="mt-0">
                      <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-gray-50 dark:bg-gray-900 min-h-[180px]">
                        {!uploadedMotionUrl ? (
                          <>
                            <Video className="h-12 w-12 text-gray-400 mb-4" />
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">
                              Already have a motion video?
                              <br />Upload it and skip directly to adding voice.
                            </p>
                            <Label 
                              htmlFor="motion-video-upload" 
                              className="cursor-pointer bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-md flex items-center gap-2"
                            >
                              <Upload className="h-4 w-4" />
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
                            <p className="text-xs text-gray-500 mt-3">
                              Supports MP4, WebM, MOV formats
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 text-green-600 mb-4">
                              <CheckCircle className="h-5 w-5" />
                              <span className="font-medium">Video uploaded: {uploadedMotionFile?.name}</span>
                            </div>
                            <video 
                              src={uploadedMotionUrl} 
                              controls 
                              className="w-full max-w-xs rounded-lg mb-4"
                              data-testid="video-uploaded-motion"
                            />
                            <Button
                              variant="outline"
                              onClick={() => {
                                setUploadedMotionFile(null);
                                setUploadedMotionUrl("");
                                setMotionVideoUrl(null);
                              }}
                              data-testid="button-remove-motion-video"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove & Choose Another
                            </Button>
                          </>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="flex items-center gap-4 pt-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-gray-600">Duration</Label>
                      <Select
                        value={motionDuration}
                        onValueChange={(value) => setMotionDuration(value as "5" | "10")}
                        disabled={isGeneratingMotion || motionStatus === "processing"}
                      >
                        <SelectTrigger className="w-28 h-8 text-sm" data-testid="select-motion-duration">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 sec</SelectItem>
                          <SelectItem value="10">10 sec</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress indicator */}
              {(isGeneratingMotion || motionStatus === "processing" || motionStatus === "pending") && (
                <div className="space-y-2 px-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {motionStatus === "starting" && "Starting generation..."}
                      {motionStatus === "pending" && "Queued for processing..."}
                      {motionStatus === "processing" && "Creating motion video..."}
                    </span>
                    <span className="text-purple-600 font-medium">{motionProgress}%</span>
                  </div>
                  <Progress value={motionProgress} className="h-2" />
                  <p className="text-xs text-gray-500 text-center">
                    This may take 1-3 minutes. Please wait...
                  </p>
                </div>
              )}

              {/* Error state */}
              {motionStatus === "failed" && (
                <div className="flex items-center gap-2 p-3 mx-2 bg-red-50 dark:bg-red-950/30 rounded-lg">
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
                    {/* Voice Provider Toggle */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Voice Provider</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={voiceProvider === "elevenlabs" ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setVoiceProvider("elevenlabs");
                            if (elevenLabsVoices.length > 0) {
                              setSelectedMotionVoice(elevenLabsVoices[0].id);
                            }
                          }}
                          className={voiceProvider === "elevenlabs" ? "bg-blue-600 hover:bg-blue-700" : ""}
                          data-testid="button-voice-elevenlabs"
                        >
                          <Volume2 className="h-4 w-4 mr-1" />
                          ElevenLabs {elevenLabsConfigured && "(Connected)"}
                        </Button>
                        <Button
                          variant={voiceProvider === "kling" ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setVoiceProvider("kling");
                            setSelectedMotionVoice(KLING_VOICES[0].id);
                          }}
                          data-testid="button-voice-kling"
                        >
                          <Mic className="h-4 w-4 mr-1" />
                          Built-in
                        </Button>
                      </div>
                      {voiceProvider === "elevenlabs" && !elevenLabsConfigured && (
                        <p className="text-xs text-amber-600">
                          ElevenLabs API key is being configured. Using default voices.
                        </p>
                      )}
                    </div>

                    {/* Voice Selection */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Select Voice</Label>
                      <Select value={selectedMotionVoice} onValueChange={setSelectedMotionVoice}>
                        <SelectTrigger data-testid="select-motion-voice">
                          <SelectValue placeholder="Choose a voice" />
                        </SelectTrigger>
                        <SelectContent>
                          {voiceProvider === "elevenlabs" ? (
                            <>
                              {elevenLabsVoices.map((voice) => (
                                <SelectItem key={voice.id} value={voice.id}>
                                  {voice.name} {voice.description ? `- ${voice.description}` : ""}
                                </SelectItem>
                              ))}
                            </>
                          ) : (
                            <>
                              {KLING_VOICES.map((voice) => (
                                <SelectItem key={voice.id} value={voice.id}>
                                  {voice.name}
                                </SelectItem>
                              ))}
                            </>
                          )}
                          {customVoices?.map((voice: CustomVoice) => (
                            <SelectItem key={voice.id} value={voice.heygenAudioAssetId || voice.id}>
                              {voice.name} (Custom)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Script Input */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">What should your avatar say?</Label>
                      <Textarea
                        placeholder="Enter the script for your avatar to speak... For best results, keep it under 100 words for a 5-10 second video."
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
                          <p className="text-xs text-gray-500 mt-3 text-center">
                            Record your voice speaking what you want the avatar to say.
                            <br />Keep it under 30 seconds for best results.
                          </p>
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
                            <br />This will be synced to your avatar's lip movements.
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
                      // Validate based on voice input mode
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
                          description: "Please generate a motion video first before adding voice.",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      setIsGeneratingLipSync(true);
                      setLipSyncStatus("processing");
                      setLipSyncProgress(10);
                      
                      console.log("🎤 Starting lip-sync request with:", {
                        videoUrl: typeof motionVideoUrl === 'string' ? motionVideoUrl.substring(0, 50) : motionVideoUrl,
                        text: voiceInputMode === "tts" ? motionVoiceScript?.substring(0, 50) : "(audio mode)",
                        voiceInputMode,
                        voiceProvider,
                      });
                      
                      // Demo mode: skip API calls and use demo video
                      if (isDemo) {
                        let progress = 10;
                        const progressInterval = setInterval(() => {
                          progress += 15;
                          setLipSyncProgress(Math.min(progress, 90));
                        }, 300);

                        setTimeout(() => {
                          clearInterval(progressInterval);
                          setFinalVideoUrl(demoFinalVideo);
                          setLipSyncStatus("completed");
                          setLipSyncProgress(100);
                          setIsGeneratingLipSync(false);
                          setMotionDialogStep("final");
                          toast({
                            title: "Video Ready!",
                            description: "Demo: Your avatar is now speaking with your voice.",
                          });
                        }, 2000);
                        return;
                      }
                      
                      try {
                        let audioUrl: string | undefined;
                        
                        // Handle different voice input modes
                        if (voiceInputMode === "record" && motionRecordedBlob) {
                          console.log("🎙️ Uploading recorded audio...");
                          setLipSyncProgress(15);
                          
                          const formData = new FormData();
                          formData.append("audio", motionRecordedBlob, "recording.webm");
                          
                          const uploadResponse = await fetch("/api/kling/upload-audio", {
                            method: "POST",
                            credentials: "include",
                            body: formData,
                          });
                          
                          const uploadResult = await uploadResponse.json();
                          console.log("🎙️ Audio upload result:", uploadResult);
                          
                          if (!uploadResponse.ok || !uploadResult.audioUrl) {
                            throw new Error(uploadResult.error || "Failed to upload recorded audio");
                          }
                          
                          audioUrl = uploadResult.audioUrl;
                          setLipSyncProgress(30);
                          console.log("✅ Recorded audio uploaded:", audioUrl);
                        } else if (voiceInputMode === "upload" && uploadedAudioFile) {
                          console.log("🎙️ Uploading audio file...");
                          setLipSyncProgress(15);
                          
                          const formData = new FormData();
                          formData.append("audio", uploadedAudioFile);
                          
                          const uploadResponse = await fetch("/api/kling/upload-audio", {
                            method: "POST",
                            credentials: "include",
                            body: formData,
                          });
                          
                          const uploadResult = await uploadResponse.json();
                          console.log("🎙️ Audio upload result:", uploadResult);
                          
                          if (!uploadResponse.ok || !uploadResult.audioUrl) {
                            throw new Error(uploadResult.error || "Failed to upload audio file");
                          }
                          
                          audioUrl = uploadResult.audioUrl;
                          setLipSyncProgress(30);
                          console.log("✅ Audio file uploaded:", audioUrl);
                        } else if (voiceInputMode === "tts" && voiceProvider === "elevenlabs") {
                          console.log("🎙️ Generating ElevenLabs audio first...");
                          setLipSyncProgress(15);
                          
                          const ttsResponse = await fetch("/api/elevenlabs/tts", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({
                              text: motionVoiceScript,
                              voiceId: selectedMotionVoice,
                            }),
                          });
                          
                          const ttsResult = await ttsResponse.json();
                          console.log("🎙️ ElevenLabs TTS result:", ttsResult);
                          
                          if (!ttsResponse.ok || !ttsResult.audioUrl) {
                            throw new Error(ttsResult.error || "Failed to generate audio with ElevenLabs");
                          }
                          
                          audioUrl = ttsResult.audioUrl;
                          setLipSyncProgress(30);
                          console.log("✅ ElevenLabs audio generated:", audioUrl);
                        }
                        
                        console.log("🎤 Sending fetch request to /api/kling/lip-sync");
                        
                        // If motionVideoUrl is a blob URL (from direct upload), we need to upload it to S3 first
                        let finalVideoUrl = motionVideoUrl;
                        if (motionVideoUrl?.startsWith("blob:") && uploadedMotionFile) {
                          console.log("🎬 Uploading motion video to S3 (blob URL detected)...");
                          setLipSyncProgress(35);
                          
                          const videoFormData = new FormData();
                          videoFormData.append("video", uploadedMotionFile);
                          
                          const videoUploadResponse = await fetch("/api/kling/upload-video", {
                            method: "POST",
                            credentials: "include",
                            body: videoFormData,
                          });
                          
                          const videoUploadResult = await videoUploadResponse.json();
                          console.log("🎬 Video upload result:", videoUploadResult);
                          
                          if (!videoUploadResponse.ok || !videoUploadResult.videoUrl) {
                            throw new Error(videoUploadResult.error || "Failed to upload motion video");
                          }
                          
                          finalVideoUrl = videoUploadResult.videoUrl;
                          setLipSyncProgress(45);
                          console.log("✅ Motion video uploaded to S3:", finalVideoUrl);
                        }
                        
                        const lipSyncBody: Record<string, unknown> = {
                          videoUrl: finalVideoUrl,
                        };
                        
                        // Use audio2video mode for record, upload, or ElevenLabs TTS
                        if (audioUrl) {
                          lipSyncBody.mode = "audio2video";
                          lipSyncBody.audioUrl = audioUrl;
                        } else {
                          // Fall back to Kling TTS (text2video mode)
                          lipSyncBody.mode = "text2video";
                          lipSyncBody.text = motionVoiceScript.trim();
                          lipSyncBody.voiceId = selectedMotionVoice || "female_calm";
                        }
                        
                        console.log("🎤 Lip-sync request body:", lipSyncBody);
                        
                        const response = await fetch("/api/kling/lip-sync", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify(lipSyncBody),
                        });
                        
                        console.log("🎤 Response status:", response.status, response.statusText);
                        const result = await response.json();
                        console.log("🎤 Response result:", result);
                        
                        if (!response.ok) {
                          throw new Error(result.error || "Failed to add voice");
                        }
                        
                        if (result.videoUrl) {
                          setFinalVideoUrl(result.videoUrl);
                          setLipSyncStatus("completed");
                          setIsGeneratingLipSync(false);
                          setMotionDialogStep("final");
                          toast({
                            title: "Video Ready!",
                            description: "Your avatar is now speaking with your voice.",
                          });
                        } else if (result.taskId) {
                          setLipSyncTaskId(result.taskId);
                          let pollCount = 0;
                          const maxPolls = 60;
                          
                          const pollInterval = setInterval(async () => {
                            try {
                              pollCount++;
                              const statusRes = await fetch(`/api/kling/lip-sync/${result.taskId}`, {
                                credentials: "include",
                              });
                              const statusData = await statusRes.json();
                              
                              if (statusData.status === "completed" && statusData.videoUrl) {
                                clearInterval(pollInterval);
                                setFinalVideoUrl(statusData.videoUrl);
                                setLipSyncStatus("completed");
                                setLipSyncProgress(100);
                                setIsGeneratingLipSync(false);
                                setMotionDialogStep("final");
                                toast({
                                  title: "Video Ready!",
                                  description: "Your avatar is now speaking with your voice.",
                                });
                              } else if (statusData.status === "failed") {
                                clearInterval(pollInterval);
                                setLipSyncStatus("failed");
                                setIsGeneratingLipSync(false);
                                toast({
                                  title: "Voice Generation Failed",
                                  description: statusData.error || "Failed to add voice to video.",
                                  variant: "destructive",
                                });
                              } else if (pollCount >= maxPolls) {
                                clearInterval(pollInterval);
                                setLipSyncStatus("failed");
                                setIsGeneratingLipSync(false);
                                toast({
                                  title: "Generation Timeout",
                                  description: "Voice generation is taking too long. Please try again.",
                                  variant: "destructive",
                                });
                              } else {
                                setLipSyncProgress((prev) => Math.min(prev + 5, 90));
                              }
                            } catch (e) {
                              console.error("Polling error:", e);
                              clearInterval(pollInterval);
                              setLipSyncStatus("failed");
                              setIsGeneratingLipSync(false);
                              toast({
                                title: "Connection Error",
                                description: "Lost connection while generating voice.",
                                variant: "destructive",
                              });
                            }
                          }, 3000);
                        } else {
                          setIsGeneratingLipSync(false);
                        }
                      } catch (error: any) {
                        console.error("Lip sync error:", error);
                        console.error("Lip sync error message:", error?.message);
                        console.error("Lip sync error stack:", error?.stack);
                        setLipSyncStatus("failed");
                        setIsGeneratingLipSync(false);
                        const errorMessage = error?.message || (typeof error === 'string' ? error : "Failed to add voice");
                        toast({
                          title: "Voice Generation Failed",
                          description: errorMessage,
                          variant: "destructive",
                        });
                      }
                    }}
                    disabled={isGeneratingLipSync || (voiceInputMode === "tts" && !motionVoiceScript.trim()) || (voiceInputMode === "record" && !motionRecordedBlob) || (voiceInputMode === "upload" && !uploadedAudioFile)}
                    data-testid="button-add-voice"
                  >
                    {isGeneratingLipSync ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding Voice...
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-4 w-4 mr-2" />
                        Add Voice & Continue
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
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Your video is ready!</span>
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

      {/* Edit Look Result Dialog (Demo Mode) */}
      <Dialog open={showEditLookResult} onOpenChange={setShowEditLookResult}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-[#D4AF37]" />
              Look Edited Successfully
            </DialogTitle>
            <DialogDescription>
              Your avatar look has been updated with the new style.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="rounded-lg overflow-hidden border-2 border-[#D4AF37] shadow-lg">
              <img
                src={demoEditLookResult}
                alt="Edited Look Result"
                className="w-full h-auto object-cover"
                data-testid="img-edit-look-result"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowEditLookResult(false)}
              data-testid="button-close-edit-result"
            >
              Close
            </Button>
            <Button
              className="btn-golden"
              onClick={() => {
                setShowEditLookResult(false);
                toast({
                  title: "Look Applied",
                  description: "Your edited look is now ready to use.",
                });
              }}
              data-testid="button-use-edited-look"
            >
              <Check className="h-4 w-4 mr-2" />
              Use This Look
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={changeStyleDialogOpen} onOpenChange={setChangeStyleDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shirt className="h-5 w-5 text-[#D4AF37]" />
              Change Style
            </DialogTitle>
            <DialogDescription>
              Choose a preset outfit or describe what you'd like your avatar to wear.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Quick Outfit Presets</Label>
              <div className="grid grid-cols-3 gap-2">
                {OUTFIT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setChangeStylePrompt(preset.prompt)}
                    className={`p-2 rounded-lg border text-left transition-all hover:border-[#D4AF37] hover:bg-[#D4AF37]/5 ${
                      changeStylePrompt === preset.prompt ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-gray-200 dark:border-gray-700'
                    }`}
                    data-testid={`button-preset-${preset.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <span className="text-lg">{preset.icon}</span>
                    <p className="text-xs font-medium mt-1">{preset.label}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 my-2">
              <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
              <span className="text-xs text-gray-400">or describe your own</span>
              <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="change-style-prompt">Describe the outfit</Label>
              <Textarea
                id="change-style-prompt"
                placeholder="Describe the outfit: e.g., navy blazer with white shirt, or casual polo with khakis..."
                value={changeStylePrompt}
                onChange={(e) => setChangeStylePrompt(e.target.value)}
                rows={3}
                className="resize-none"
                data-testid="textarea-change-style-prompt"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Orientation</Label>
                <Select value={changeStyleOrientation} onValueChange={setChangeStyleOrientation}>
                  <SelectTrigger data-testid="select-change-style-orientation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="square">Square</SelectItem>
                    <SelectItem value="landscape">Landscape</SelectItem>
                    <SelectItem value="portrait">Portrait</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pose</Label>
                <Select value={changeStylePose} onValueChange={setChangeStylePose}>
                  <SelectTrigger data-testid="select-change-style-pose">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="half_body">Half Body</SelectItem>
                    <SelectItem value="full_body">Full Body</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Style</Label>
                <Select value={changeStyleStyle} onValueChange={setChangeStyleStyle}>
                  <SelectTrigger data-testid="select-change-style-style">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Realistic">Realistic</SelectItem>
                    <SelectItem value="Cinematic">Cinematic</SelectItem>
                    <SelectItem value="Pixar">Pixar</SelectItem>
                    <SelectItem value="Vintage">Vintage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setChangeStyleDialogOpen(false);
                setChangeStylePrompt("");
              }}
              data-testid="button-cancel-change-style"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedAvatarGroup && changeStylePrompt.trim()) {
                  changeStyleMutation.mutate({
                    groupId: selectedAvatarGroup,
                    prompt: changeStylePrompt.trim(),
                    orientation: changeStyleOrientation,
                    pose: changeStylePose,
                    style: changeStyleStyle,
                  });
                }
              }}
              disabled={!changeStylePrompt.trim() || changeStyleMutation.isPending}
              className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110"
              data-testid="button-generate-style"
            >
              {changeStyleMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Generate Outfit
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>

      
    </div>
  );
}
