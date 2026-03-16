import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Bug,
  Camera,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit,
  Image,
  Shirt,
  Loader2,
  Mic,
  MicOff,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Terminal,
  Upload,
  UserPlus,
  Users,
  MoreVertical,
  Trash2,
  Video,
  Wand2,
  X,
  ZoomIn,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { AvatarPhotoGallery } from "./avatar-photo-gallery";
import { VoiceLibraryManager } from "./voice-library-manager";

// Large Avatar Card Component for HeyGen-style display
function LargeAvatarCard({
  groupId,
  groupName,
  onOpenGallery,
  onChangeOutfit,
  onDelete,
}: {
  groupId: string;
  groupName: string;
  onOpenGallery: () => void;
  onChangeOutfit: () => void;
  onDelete: () => void;
}) {
  const confirm = useConfirm();
  const { data: photoData } = useQuery<any>({
    queryKey: [`/api/photo-avatars/groups/${groupId}/photos`],
    enabled: !!groupId,
  });

  const photos = photoData?.photos || [];
  const firstPhoto = photos[0];

  if (!firstPhoto) return null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenGallery}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenGallery(); } }}
      className="relative group rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-300 bg-white w-full cursor-pointer"
      data-testid={`large-avatar-${groupId}`}
    >
      <div className="aspect-[3/4] w-full">
        <img
          src={firstPhoto.url}
          alt={firstPhoto.name || groupName}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Three-dot menu - Always visible */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="absolute top-2 right-2 w-7 h-7 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center z-20 transition-colors"
            onClick={(e) => e.stopPropagation()}
            data-testid={`button-menu-avatar-${groupId}`}
          >
            <MoreVertical className="h-4 w-4 text-white" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onChangeOutfit();
            }}
            data-testid={`button-menu-outfit-avatar-${groupId}`}
          >
            <Shirt className="h-4 w-4 mr-2" />
            Change Outfit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={async (e) => {
              e.stopPropagation();
              const confirmed = await confirm({
                title: "Delete Avatar Group",
                description: "Delete this avatar group? This cannot be undone.",
                confirmText: "Delete",
                variant: "destructive",
              });
              if (confirmed) {
                onDelete();
              }
            }}
            className="text-red-600 focus:text-red-600"
            data-testid={`button-menu-delete-avatar-${groupId}`}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Name Overlay at Bottom - Always Visible */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <p className="text-white text-sm font-medium truncate">
          {firstPhoto.name || groupName}
        </p>
      </div>

      {/* Hover Actions Overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
        <div className="flex gap-2 text-white">
          <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
            <ZoomIn className="w-5 h-5" />
          </div>
          {firstPhoto.motion_preview_url && (
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
              <Play className="w-5 h-5" />
            </div>
          )}
        </div>
      </div>

      {/* Video Badge */}
      {firstPhoto.motion_preview_url && (
        <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
          <Play className="w-3 h-3" />
          Video
        </div>
      )}
    </div>
  );
}

const OUTFIT_PRESETS = [
  { label: "Business Suit", prompt: "wearing a tailored navy blue business suit with white dress shirt and silk tie, professional office setting", icon: "👔" },
  { label: "Casual Polo", prompt: "wearing a fitted casual polo shirt in solid color, relaxed professional look", icon: "👕" },
  { label: "Real Estate Blazer", prompt: "wearing a stylish modern blazer over crisp button-down shirt, professional real estate agent look", icon: "🧥" },
  { label: "Smart Casual", prompt: "wearing smart casual outfit with quarter-zip sweater over collared shirt, approachable professional look", icon: "👔" },
  { label: "Formal Dress", prompt: "wearing elegant formal business dress or blouse with professional styling, confident real estate professional", icon: "👗" },
  { label: "Outdoor/Active", prompt: "wearing clean outdoor casual attire, quarter-zip jacket, ready for property showings and open houses", icon: "🧤" },
];

// Professional HeyGen Voices
const PROFESSIONAL_VOICES = [
  {
    id: "92c93dc0dff2428ab0bea258ba68f173",
    name: "Professional Male - Confident",
  },
  { id: "f577da968446491289b53bceb77e5092", name: "Professional Male - Warm" },
  {
    id: "73c0b6a2e29d4d38aca41454bf58c955",
    name: "Professional Female - Clear",
  },
  {
    id: "1c7c897eeb2d4b5fb17d3c6c70250b24",
    name: "Professional Female - Friendly",
  },
  { id: "119caed25533477ba63822d5d1552d25", name: "Neutral - Balanced" },
  { id: "9f2e8c4a7b5d4f6e8a1c3d5b7e9f2a4c", name: "Energetic - Enthusiastic" },
];

interface AvatarGroup {
  group_id: string;
  name: string;
  status: "pending" | "processing" | "ready" | "failed";
  created_at: string;
  avatar_count?: number;
  training_progress?: number;
}

interface PhotoGenerationRequest {
  name: string;
  age:
    | "Young Adult"
    | "Early Middle Age"
    | "Late Middle Age"
    | "Senior"
    | "Unspecified";
  gender: "Man" | "Woman" | "Person";
  ethnicity: string;
  orientation: "horizontal" | "vertical";
  pose: "full_body" | "half_body" | "close_up";
  style:
    | "Realistic"
    | "Pixar"
    | "Cinematic"
    | "Vintage"
    | "Noir"
    | "Cyberpunk"
    | "Unspecified";
  appearance: string;
}

export function PhotoAvatarManager() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [selectedTab, setSelectedTab] = useState("generate");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedGroupForVoice, setSelectedGroupForVoice] = useState<
    string | null
  >(null);
  const [showTrainAllDialog, setShowTrainAllDialog] = useState(false);
  const [trainAllVoiceId, setTrainAllVoiceId] = useState<string>("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedGroupForEdit, setSelectedGroupForEdit] =
    useState<AvatarGroup | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editOrientation, setEditOrientation] = useState<
    "square" | "landscape" | "portrait"
  >("square");
  const [editPose, setEditPose] = useState<"half_body" | "full_body">(
    "half_body"
  );
  const [editStyle, setEditStyle] = useState("Realistic");
  const [openGalleryGroupId, setOpenGalleryGroupId] = useState<string | null>(
    null
  );
  const [addMotionDialogOpen, setAddMotionDialogOpen] = useState(false);
  const [selectedAvatarForMotion, setSelectedAvatarForMotion] = useState<{
    avatarId: string;
    groupName: string;
  } | null>(null);
  const [motionPrompt, setMotionPrompt] = useState("");
  const [motionType, setMotionType] = useState<string>("consistent");
  const [showGroupNameDialog, setShowGroupNameDialog] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [generationForm, setGenerationForm] = useState<PhotoGenerationRequest>({
    name: "Mike Bjork Professional Avatar",
    age: "Early Middle Age",
    gender: "Man",
    ethnicity: "White",
    orientation: "vertical",
    pose: "half_body",
    style: "Realistic",
    appearance:
      "Professional real estate agent, well-groomed, confident smile, business attire",
  });

  const [aiLookDialogOpen, setAiLookDialogOpen] = useState(false);
  const [aiLookSource, setAiLookSource] = useState<"upload" | "existing">("upload");
  const [aiLookFile, setAiLookFile] = useState<File | null>(null);
  const [aiLookFilePreview, setAiLookFilePreview] = useState<string | null>(null);
  const [aiLookName, setAiLookName] = useState("");
  const [aiLookPrompt, setAiLookPrompt] = useState("");
  const [aiLookOrientation, setAiLookOrientation] = useState<"square" | "horizontal" | "vertical">("square");
  const [aiLookPose, setAiLookPose] = useState<"half_body" | "close_up" | "full_body">("half_body");
  const [aiLookStyle, setAiLookStyle] = useState("Realistic");
  const [aiLookSelectedGroup, setAiLookSelectedGroup] = useState<string>("");
  const [aiLookGenerating, setAiLookGenerating] = useState(false);
  const aiLookFileRef = useRef<HTMLInputElement>(null);

  // Query avatar groups
  const { data: avatarGroupsResponse, isLoading: isLoadingGroups } = useQuery({
    queryKey: ["/api/photo-avatars/groups"],
    refetchInterval: (data) => {
      // Refetch every 5 seconds if any group is processing OR has avatars but not trained yet
      if (!data || !data.avatar_group_list) return false;
      const needsPolling = data.avatar_group_list.some(
        (g: any) =>
          g.train_status === "processing" ||
          (g.status === "ready" &&
            g.train_status === "empty" &&
            g.num_looks >= 1)
      );
      return needsPolling ? 5000 : false;
    },
  });

  // Extract avatar groups array from response
  const avatarGroups = avatarGroupsResponse?.avatar_group_list || [];

  const { data: allLooksResponse, isLoading: isLoadingAllLooks } = useQuery({
    queryKey: ["/api/photo-avatars/all-looks"],
  });
  const allLooks = allLooksResponse?.looks || [];

  // Track previous avatar group statuses to detect training completion
  const prevStatusesRef = useRef<Record<string, string>>({});
  // Track groups that have auto-generated looks to avoid duplicates
  const autoGeneratedLooksRef = useRef<Set<string>>(new Set());
  // Track groups that have auto-started training to avoid duplicates
  const autoTrainedRef = useRef<Set<string>>(new Set());
  // Track active look generation status
  const [lookGenerationStatus, setLookGenerationStatus] = useState<Record<string, {
    status: 'generating' | 'completed' | 'failed';
    progress: number;
    looks: Array<{ label: string; name: string }>;
  }>>({});

  // Debug logging state
  const [debugLogs, setDebugLogs] = useState<Array<{
    timestamp: string;
    type: 'request' | 'response' | 'info' | 'error';
    endpoint?: string;
    payload?: any;
    response?: any;
    message?: string;
  }>>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  
  // Activity log for step-by-step visibility (user-friendly version)
  const [activityLogs, setActivityLogs] = useState<Array<{
    id: string;
    timestamp: string;
    step: 'upload' | 'group_created' | 'waiting' | 'training_started' | 'training_progress' | 'training_complete' | 'generating_looks' | 'looks_complete' | 'error';
    message: string;
    groupName?: string;
    details?: string;
  }>>([]);
  const [showActivityPanel, setShowActivityPanel] = useState(true);
  const activityLogRef = useRef<HTMLDivElement>(null);
  
  // Helper to add activity log
  const addActivityLog = (log: Omit<typeof activityLogs[0], 'id' | 'timestamp'>) => {
    const timestamp = new Date().toLocaleTimeString();
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setActivityLogs(prev => [...prev.slice(-30), { ...log, id, timestamp }]);
    // Auto-scroll to bottom
    setTimeout(() => {
      if (activityLogRef.current) {
        activityLogRef.current.scrollTop = activityLogRef.current.scrollHeight;
      }
    }, 100);
  };
  
  // Helper to add debug log
  const addDebugLog = (log: Omit<typeof debugLogs[0], 'timestamp'>) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev.slice(-50), { ...log, timestamp }]); // Keep last 50 logs
    console.log(`[DEBUG ${timestamp}]`, log);
  };

  // FULL AUTOMATION: Auto-train untrained avatars, then auto-generate looks when trained
  useEffect(() => {
    if (!avatarGroups || avatarGroups.length === 0) return;

    // Log all avatar groups on every render for debugging
    console.log("🔍 [AUTO-WORKFLOW] Checking", avatarGroups.length, "avatar groups:");
    
    avatarGroups.forEach(async (group: any) => {
      const groupId = group.group_id;
      const currentTrainStatus = group.train_status;
      const previousTrainStatus = prevStatusesRef.current[groupId];
      // Use num_looks (count of generated looks) - this is reliably returned from the API
      const numLooks = group.num_looks ?? group.avatar_count ?? 0;
      const alreadyProcessedLooks = autoGeneratedLooksRef.current.has(groupId);
      const alreadyStartedTraining = autoTrainedRef.current.has(groupId);

      // Log each group's status (including group.status for debugging)
      console.log(`  📦 "${group.name}" (${groupId.slice(0,8)}...):`, {
        trainStatus: currentTrainStatus,
        groupStatus: group.status, // This may be undefined from HeyGen API
        prevStatus: previousTrainStatus || 'none',
        numLooks,
        alreadyStartedTraining,
        alreadyProcessedLooks
      });

      // STEP 1: AUTO-TRAIN - If avatar group is created but not trained, start training
      // Backend may map some groups to status "ready" even when train_status is still "empty".
      // We should auto-train for any non-pending group that is still untrained.
      // Note: If status is undefined/missing, assume upload is processed since avatar group exists in the list
      const isUploadProcessed = !group.status || group.status === "completed" || group.status === "ready";
      
      if (currentTrainStatus === "empty" && !alreadyStartedTraining && isUploadProcessed) {
        console.log(`    🎓 AUTO-TRAINING: Starting training for "${group.name}"...`);
        autoTrainedRef.current.add(groupId);
        
        addActivityLog({
          step: 'training_started',
          message: 'Training avatar...',
          groupName: group.name,
          details: 'HeyGen is processing your photo. This takes 5-15 minutes.'
        });
        
        addDebugLog({
          type: 'info',
          message: `Auto-starting training for "${group.name}" (status: empty → training)`
        });

        toast({
          title: "🎓 Training Started!",
          description: `Avatar "${group.name}" is now training (~5-15 min). Looks will be generated automatically when complete.`,
          duration: 8000,
        });

        try {
          await apiRequest(
            "POST",
            `/api/photo-avatars/groups/${groupId}/train`,
            {}
          );
          console.log(`    ✅ Training request sent for "${group.name}"`);
          
          addActivityLog({
            step: 'training_progress',
            message: 'Training in progress...',
            groupName: group.name,
            details: 'Please wait while HeyGen trains your avatar.'
          });
          
          // Refresh to pick up the new training status
          queryClient.invalidateQueries({
            queryKey: ["/api/photo-avatars/groups"],
          });
        } catch (trainError) {
          console.error(`    ❌ Failed to start training for "${group.name}":`, trainError);
          addActivityLog({
            step: 'error',
            message: 'Training failed',
            groupName: group.name,
            details: String(trainError)
          });
          addDebugLog({
            type: 'error',
            message: `Failed to auto-train "${group.name}": ${trainError}`
          });
        }
        
        // Update ref and continue - looks will be generated when training completes
        prevStatusesRef.current[groupId] = currentTrainStatus;
        return;
      }

      // STEP 2: AUTO-GENERATE LOOKS - If trained but has < 3 looks
      // Note: HeyGen returns "completed" or "ready" for trained avatars - accept both!
      const isTrainedStatus = currentTrainStatus === "ready" || currentTrainStatus === "completed";
      const wasNotTrained = previousTrainStatus !== "ready" && previousTrainStatus !== "completed";
      const trainingJustCompleted = previousTrainStatus && wasNotTrained && isTrainedStatus;
      const alreadyTrainedWithFewLooks = !previousTrainStatus && isTrainedStatus && numLooks < 3;
      
      const shouldAutoGenerate = (trainingJustCompleted || alreadyTrainedWithFewLooks) && 
                                  !alreadyProcessedLooks;

      // Log the decision
      if (currentTrainStatus === "processing") {
        console.log(`    ⏳ WAITING: Training in progress...`);
      } else if (!isTrainedStatus) {
        console.log(`    ⚠️ SKIPPED: Not trained yet (status: "${currentTrainStatus}")`);
      } else if (numLooks >= 3) {
        console.log(`    ✅ COMPLETE: Already has ${numLooks} looks`);
      } else if (alreadyProcessedLooks) {
        console.log(`    ⏭️ SKIPPED: Already processed looks in this session`);
      } else if (shouldAutoGenerate) {
        console.log(`    🚀 TRIGGERING: Auto-generating 3 looks!`);
      }

      if (shouldAutoGenerate) {
        // Log the trigger reason
        addActivityLog({
          step: 'training_complete',
          message: 'Training completed!',
          groupName: group.name,
          details: 'Avatar trained successfully. Now generating professional looks...'
        });
        
        addDebugLog({
          type: 'info',
          message: trainingJustCompleted 
            ? `Training completed for "${group.name}". Triggering auto-look generation...`
            : `Already trained avatar "${group.name}" with only ${numLooks} looks. Triggering auto-look generation...`
        });

        toast({
          title: trainingJustCompleted ? "🎉 Training Complete!" : "🎨 Generating Looks",
          description: `Avatar "${group.name}" - Now auto-generating 3 professional looks...`,
          duration: 8000,
        });

        // Auto-trigger look generation
        autoGeneratedLooksRef.current.add(groupId);
        // Also mark as trained to prevent re-triggering training
        autoTrainedRef.current.add(groupId);
        
        // Update status to show generation is starting (3 professional styles)
        addActivityLog({
          step: 'generating_looks',
          message: 'Generating 3 professional looks...',
          groupName: group.name,
          details: 'Executive, Friendly Agent, Property Tour'
        });
        
        setLookGenerationStatus(prev => ({
          ...prev,
          [groupId]: {
            status: 'generating',
            progress: 10,
            looks: [
              { label: 'professional-executive', name: 'Executive' },
              { label: 'professional-friendly', name: 'Friendly Agent' },
              { label: 'professional-outdoor', name: 'Property Tour' }
            ]
          }
        }));

        try {
          const lookPrompts = [
            "Professional executive in a navy business suit, confident and approachable",
            "Friendly real estate agent in smart casual blazer, warm and welcoming smile",
            "Outdoor property tour guide in clean casual attire, natural setting",
          ];
          
          console.log("🎨 Auto-generating looks via proxy...");
          
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
          
          setLookGenerationStatus(prev => ({
            ...prev,
            [groupId]: {
              ...prev[groupId],
              progress: 50,
            }
          }));

          toast({
            title: "🎨 Generating Looks",
            description: `Generating 3 professional looks for "${group.name}". This takes 2-5 minutes.`,
            duration: 8000,
          });

          const pollInterval = setInterval(() => {
            queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups"] });
            queryClient.invalidateQueries({ queryKey: [`/api/photo-avatars/groups/${groupId}/photos`] });
          }, 5000);

          setTimeout(() => {
            clearInterval(pollInterval);
            setLookGenerationStatus(prev => ({
              ...prev,
              [groupId]: { ...prev[groupId], progress: 100, status: 'completed' }
            }));
            addActivityLog({
              step: 'looks_complete',
              message: 'Look generation completed!',
              groupName: group.name,
              details: '3 professional looks generated.'
            });
          }, 180000);
        } catch (error) {
          console.error("Failed to auto-generate looks:", error);
          setLookGenerationStatus(prev => ({
            ...prev,
            [groupId]: { ...prev[groupId], status: 'failed' }
          }));
          toast({
            title: "Look Generation Failed",
            description: "Failed to auto-generate looks. You can try manually from the avatar menu.",
            variant: "destructive",
          });
        }
      }

      // Update ref with current train_status
      prevStatusesRef.current[groupId] = currentTrainStatus;
    });
  }, [avatarGroups, toast]);

  const handleAiLookGenerate = async () => {
    setAiLookGenerating(true);
    try {
      if (aiLookSource === "existing" && aiLookSelectedGroup) {
        const userPrompt = aiLookPrompt.trim() || "Professional look";
        const lookPrompts = [
          userPrompt,
          `${userPrompt}, friendly and welcoming variation`,
          `${userPrompt}, outdoor natural setting variation`,
          `${userPrompt}, modern contemporary variation`,
        ];
        
        let successCount = 0;
        for (const prompt of lookPrompts) {
          try {
            await apiRequest("POST", `/api/photo-avatars/groups/${aiLookSelectedGroup}/proxy-generate-look`, {
              prompt,
              orientation: aiLookOrientation,
              pose: aiLookPose,
              style: aiLookStyle,
            });
            successCount++;
          } catch (e: any) {
            console.warn(`Look generation failed for prompt "${prompt}":`, e?.message);
          }
        }
        
        if (successCount > 0) {
          toast({
            title: "Look Generation Started",
            description: `Generating ${successCount} AI-enhanced looks. This takes 2-3 minutes.`,
            duration: 8000,
          });
          setAiLookDialogOpen(false);
          setAiLookSelectedGroup("");
          setAiLookPrompt("");
          queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups"] });

          const pollInterval = setInterval(() => {
            queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups"] });
            queryClient.invalidateQueries({ queryKey: [`/api/photo-avatars/groups/${aiLookSelectedGroup}/photos`] });
          }, 5000);
          setTimeout(() => clearInterval(pollInterval), 180000);
        } else {
          toast({ title: "Generation Failed", description: "Could not start look generation", variant: "destructive" });
        }
      } else if (aiLookSource === "upload" && aiLookFile) {
        const formData = new FormData();
        formData.append("image", aiLookFile);
        if (aiLookName.trim()) formData.append("name", aiLookName.trim());
        if (aiLookPrompt.trim()) formData.append("prompt", aiLookPrompt.trim());
        formData.append("orientation", aiLookOrientation);
        formData.append("pose", aiLookPose);
        formData.append("style", aiLookStyle);

        const res = await fetch("/api/photo-avatars/create-with-looks", {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        const data = await res.json();

        if (res.ok && data.group_id) {
          toast({
            title: "Avatar Processing Started",
            description: `${data.message || "Training and look generation will complete in ~6-8 minutes."}`,
            duration: 8000,
          });
          setAiLookDialogOpen(false);
          setAiLookFile(null);
          setAiLookFilePreview(null);
          setAiLookName("");
          setAiLookPrompt("");
          setAiLookOrientation("square");
          setAiLookPose("half_body");
          setAiLookStyle("Realistic");
          queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups"] });
        } else {
          toast({ title: "Generation Failed", description: data.error || "Could not start avatar generation", variant: "destructive" });
        }
      }
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Could not connect to avatar service",
        variant: "destructive",
      });
    } finally {
      setAiLookGenerating(false);
    }
  };

  // Generate AI photos
  const generatePhotosMutation = useMutation({
    mutationFn: async (data: PhotoGenerationRequest) => {
      const res = await apiRequest(
        "POST",
        "/api/photo-avatars/generate-photos",
        data
      );
      return res.json();
    },
    onSuccess: async (data, variables) => {
      const generationId = data.generation_id;
      const avatarName = variables.name;

      toast({
        title: "Photo Generation Started",
        description: `Generating 5 AI photos for ${avatarName}. This may take a few minutes.`,
      });

      // Poll for generation completion and auto-create avatar group
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await apiRequest(
            "GET",
            `/api/photo-avatars/generation/${generationId}`
          );
          const statusData = await statusRes.json();

          if (
            statusData.status === "success" &&
            statusData.image_key_list &&
            statusData.image_key_list.length > 0
          ) {
            clearInterval(pollInterval);

            // Automatically create avatar group from generated photos
            try {
              await apiRequest("POST", "/api/photo-avatars/groups", {
                name: avatarName,
                imageKey: statusData.image_key_list,
              });

              toast({
                title: "✅ Photos Ready!",
                description: `${statusData.image_key_list.length} AI photos for "${avatarName}" are now in your avatar gallery!`,
                duration: 8000,
              });

              queryClient.invalidateQueries({
                queryKey: ["/api/photo-avatars/groups"],
              });
            } catch (error) {
              console.error("Failed to create avatar group:", error);
              toast({
                title: "Group Creation Failed",
                description:
                  "Photos were generated but failed to create avatar group. Please try manually.",
                variant: "destructive",
              });
            }
          } else if (statusData.status === "failed") {
            clearInterval(pollInterval);
            toast({
              title: "Generation Failed",
              description: "Photo generation failed. Please try again.",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error("Error polling generation status:", error);
        }
      }, 5000); // Poll every 5 seconds

      // Stop polling after 5 minutes (timeout)
      setTimeout(() => {
        clearInterval(pollInterval);
      }, 300000);
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Failed to start photo generation. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Upload custom photos
  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      addActivityLog({
        step: 'upload',
        message: 'Uploading photo...',
        details: `File: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`
      });
      
      const formData = new FormData();
      formData.append("photo", file);

      const response = await fetch("/api/photo-avatars/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");
      return response.json();
    },
    onSuccess: (data) => {
      addActivityLog({
        step: 'group_created',
        message: 'Photo uploaded to HeyGen',
        details: 'Now creating avatar group...'
      });
      
      toast({
        title: "Photo Uploaded",
        description:
          "Photo uploaded successfully. You can now create an avatar group.",
      });
    },
    onError: () => {
      addActivityLog({
        step: 'error',
        message: 'Upload failed',
        details: 'Please check your file and try again.'
      });
      
      toast({
        title: "Upload Failed",
        description: "Failed to upload photo. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create avatar group (auto-triggers training)
  const createGroupMutation = useMutation({
    mutationFn: ({ name, imageKey }: { name: string; imageKey: string }) => {
      addActivityLog({
        step: 'group_created',
        message: 'Creating avatar group...',
        groupName: name,
        details: 'Setting up your avatar in HeyGen...'
      });
      return apiRequest("POST", "/api/photo-avatars/groups", { name, imageKey });
    },
    onSuccess: async (data: any) => {
      const responseData = await data.json?.() || data;
      const groupId = responseData?.group_id || responseData?.id;
      const groupName = responseData?.name || 'New Avatar';
      
      addActivityLog({
        step: 'waiting',
        message: 'Avatar group created!',
        groupName,
        details: 'Waiting 20 seconds for HeyGen to process...'
      });
      
      toast({
        title: "Avatar Created!",
        description: "Avatar group created. Starting training automatically...",
      });
      
      queryClient.invalidateQueries({
        queryKey: ["/api/photo-avatars/groups"],
      });
      
      // Auto-trigger training after group creation
      if (groupId) {
        try {
          console.log(`🚀 Auto-starting training for group ${groupId}`);
          
          addActivityLog({
            step: 'training_started',
            message: 'Training started!',
            groupName,
            details: 'HeyGen is training your avatar. This takes 5-15 minutes.'
          });
          
          await apiRequest(
            "POST",
            `/api/photo-avatars/groups/${groupId}/train`,
            {}
          );
          
          toast({
            title: "🎓 Training Started!",
            description: "Avatar is now training (~5-15 min). Professional & Casual looks will be generated automatically when complete.",
            duration: 8000,
          });
          
          queryClient.invalidateQueries({
            queryKey: ["/api/photo-avatars/groups"],
          });
        } catch (trainError: any) {
          console.error("Auto-training failed:", trainError);
          if (!trainError?.message?.includes("already in progress")) {
            addActivityLog({
              step: 'error',
              message: 'Training not started',
              groupName,
              details: 'You can start training manually from the Manage tab.'
            });
            toast({
              title: "Training Not Started",
              description: "Avatar created but training didn't start. You can start it manually.",
              variant: "default",
            });
          }
        }
      }
    },
  });

  // Train avatar group
  const trainGroupMutation = useMutation({
    mutationFn: ({ groupId, voiceId }: { groupId: string; voiceId?: string }) =>
      apiRequest(
        "POST",
        `/api/photo-avatars/groups/${groupId}/train`,
        voiceId ? { defaultVoiceId: voiceId } : undefined
      ),
    onSuccess: () => {
      toast({
        title: "Training Started",
        description:
          "Avatar training has started. This process will take 15-30 minutes.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/photo-avatars/groups"],
      });
    },
    onError: (error: any) => {
      // Check if training is already in progress
      if (
        error?.code === "TRAINING_IN_PROGRESS" ||
        error?.error?.includes("already in progress")
      ) {
        toast({
          title: "Training Already in Progress",
          description:
            "This avatar is already being trained. Please wait for it to complete.",
          variant: "default",
        });
      } else {
        toast({
          title: "Training Failed",
          description:
            error?.message || error?.error || "Failed to start training",
          variant: "destructive",
        });
      }
    },
  });

  // Train all pending avatars with the same voice
  const trainAllMutation = useMutation({
    mutationFn: async (voiceId: string) => {
      const pendingGroups = avatarGroups.filter(
        (g: any) => g.train_status === "empty" && g.num_looks >= 1
      );

      const results = await Promise.allSettled(
        pendingGroups.map((group: any) =>
          apiRequest(
            "POST",
            `/api/photo-avatars/groups/${group.group_id}/train`,
            { defaultVoiceId: voiceId }
          )
        )
      );

      return {
        total: pendingGroups.length,
        successful: results.filter((r) => r.status === "fulfilled").length,
        failed: results.filter((r) => r.status === "rejected").length,
      };
    },
    onSuccess: (data) => {
      toast({
        title: "Bulk Training Started",
        description: `Training started for ${
          data.successful
        } avatar group(s). ${data.failed > 0 ? `${data.failed} failed.` : ""}`,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/photo-avatars/groups"],
      });
      setShowTrainAllDialog(false);
      setTrainAllVoiceId("");
    },
    onError: () => {
      toast({
        title: "Training Failed",
        description: "Failed to start bulk training. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Add motion to avatar
  const addMotionMutation = useMutation({
    mutationFn: ({
      avatarId,
      prompt,
      motionType,
    }: {
      avatarId: string;
      prompt?: string;
      motionType?: string;
    }) =>
      apiRequest("POST", `/api/photo-avatars/${avatarId}/add-motion`, {
        prompt,
        motionType,
      }),
    onSuccess: (data) => {
      toast({
        title: "Motion Added!",
        description:
          "Animated version is being generated. This may take a few minutes.",
      });
      setAddMotionDialogOpen(false);
      setMotionPrompt("");
      setMotionType("consistent");
      queryClient.invalidateQueries({
        queryKey: ["/api/photo-avatars/groups"],
      });
    },
    onError: (error: any) => {
      toast({
        title: "Motion Generation Failed",
        description: error?.message || "Failed to add motion to avatar",
        variant: "destructive",
      });
    },
  });

  // Generate new looks
  const generateLooksMutation = useMutation({
    mutationFn: async ({
      groupId,
      numLooks,
    }: {
      groupId: string;
      numLooks: number;
    }) => {
      const defaultPrompts = [
        "Professional executive in a navy business suit, confident and approachable",
        "Friendly real estate agent in smart casual blazer, warm and welcoming smile",
        "Outdoor property tour guide in clean casual attire, natural setting",
        "Modern professional in contemporary business wear, sleek and polished",
      ];
      const prompts = defaultPrompts.slice(0, numLooks);
      
      addDebugLog({
        type: 'request',
        endpoint: `/api/photo-avatars/groups/${groupId}/proxy-generate-look`,
        payload: { numLooks, prompts },
        message: `Generating ${numLooks} looks for group ${groupId} via proxy`
      });
      
      let successCount = 0;
      for (const prompt of prompts) {
        try {
          await apiRequest("POST", `/api/photo-avatars/groups/${groupId}/proxy-generate-look`, {
            prompt,
            orientation: "square",
            pose: "half_body",
            style: "Realistic",
          });
          successCount++;
        } catch (e: any) {
          console.warn(`Look generation failed for prompt "${prompt}":`, e?.message);
        }
      }
      
      addDebugLog({
        type: 'response',
        endpoint: `/api/photo-avatars/groups/${groupId}/proxy-generate-look`,
        response: { successCount, total: prompts.length },
        message: `${successCount}/${prompts.length} look generation requests sent`
      });
      
      return { successCount, groupId };
    },
    onSuccess: (data: any, variables) => {
      toast({
        title: "🎨 Generating New Looks",
        description: `Started generating ${data.successCount} looks. They'll appear in a few minutes.`,
        duration: 6000,
      });
      
      addDebugLog({
        type: 'info',
        message: `Look generation started successfully for group ${variables.groupId}. ${data.successCount} requests sent.`
      });

      const pollInterval = setInterval(() => {
        queryClient.invalidateQueries({
          queryKey: [`/api/photo-avatars/groups/${variables.groupId}/photos`],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/photo-avatars/groups"],
        });
      }, 5000);

      setTimeout(() => {
        clearInterval(pollInterval);
      }, 180000);
    },
    onError: (error: Error) => {
      const errorMessage = error.message.toLowerCase();
      const isModelNotFound =
        errorMessage.includes("model not found") ||
        errorMessage.includes("404") ||
        errorMessage.includes("400");

      addDebugLog({
        type: 'error',
        message: `Look generation failed: ${error.message}`,
        response: { error: error.message, isModelNotFound }
      });

      toast({
        title: "Training Required",
        description: isModelNotFound
          ? "⚠️ This avatar group must be TRAINED before you can generate new looks. Click the 'Start Training' button first, wait for training to complete (status changes to 'ready'), then try again."
          : error.message,
        variant: "destructive",
        duration: 8000,
      });
    },
  });

  // Delete avatar group
  const deleteGroupMutation = useMutation({
    mutationFn: (groupId: string) =>
      apiRequest("DELETE", `/api/photo-avatars/groups/${groupId}`),
    onSuccess: () => {
      toast({
        title: "Group Deleted",
        description: "Avatar group has been deleted.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/photo-avatars/groups"],
      });
    },
  });

  // Edit look mutation - uses external service proxy
  const editLookMutation = useMutation({
    mutationFn: ({
      groupId,
      prompt,
      orientation,
      pose,
      style,
    }: {
      groupId: string;
      prompt: string;
      orientation?: string;
      pose?: string;
      style?: string;
    }) =>
      apiRequest("POST", `/api/photo-avatars/groups/${groupId}/proxy-generate-look`, {
        prompt,
        orientation,
        pose,
        style,
        numLooks: 1,
      }),
    onSuccess: (data: any, variables) => {
      toast({
        title: "Generating New Look",
        description:
          "Your custom look is being generated in the background. It will appear when ready (2-3 minutes).",
        duration: 6000,
      });
      setEditDialogOpen(false);
      setEditPrompt("");
      setEditOrientation("square");
      setEditPose("half_body");
      setEditStyle("Realistic");

      const pollInterval = setInterval(() => {
        queryClient.invalidateQueries({
          queryKey: [`/api/photo-avatars/groups/${variables.groupId}/photos`],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/photo-avatars/groups"],
        });
      }, 5000);

      setTimeout(() => {
        clearInterval(pollInterval);
      }, 180000);
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Could not generate new look. Please try again.",
        variant: "destructive",
        duration: 8000,
      });
    },
  });

  const [, setLocation] = useLocation();
  const [useLookPendingId, setUseLookPendingId] = useState<string | null>(null);

  const useLookForVideoMutation = useMutation({
    mutationFn: async (look: any) => {
      setUseLookPendingId(look.id);
      const response = await apiRequest("POST", "/api/avatar-iv/use-look-image", {
        imageUrl: look.photoUrl,
        lookName: look.poseType || "AI Generated Look",
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      setUseLookPendingId(null);
      toast({
        title: "Look Ready for Video!",
        description: "Redirecting to Video Studio. Your look is selected — write your script and generate!",
      });
      window.location.hash = "photo-avatars";
    },
    onError: (error: any) => {
      setUseLookPendingId(null);
      toast({
        title: "Failed to prepare look",
        description: error?.message || "Could not prepare this look for video. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles((prev) => [...prev, ...files]);
    if (e.target) e.target.value = "";
  };

  const handleUploadFiles = async () => {
    if (uploadedFiles.length === 0) {
      toast({
        title: "No Files Selected",
        description: "Please select at least one photo to upload.",
        variant: "destructive",
      });
      return;
    }
    setShowGroupNameDialog(true);
  };

  const handleConfirmGroupName = async () => {
    if (!groupNameInput.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for your avatar group.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Upload all photos and collect their keys
      const uploadedKeys: string[] = [];
      for (const file of uploadedFiles) {
        const result = await uploadPhotoMutation.mutateAsync(file);
        uploadedKeys.push(result.imageKey);
      }

      // Create avatar group with uploaded photos
      const response = await fetch("/api/photo-avatars/create-from-uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupNameInput.trim(),
          imageKeys: uploadedKeys,
        }),
      });

      if (!response.ok) throw new Error("Failed to create avatar group");

      toast({
        title: "Avatar Group Created!",
        description: `Created "${groupNameInput.trim()}" with ${uploadedKeys.length} photos. Training will start automatically.`,
      });

      queryClient.invalidateQueries({
        queryKey: ["/api/photo-avatars/groups"],
      });
      setUploadedFiles([]);
      setGroupNameInput("");
      setShowGroupNameDialog(false);
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to create avatar group. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Voice recording functions
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
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setRecordedAudio(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };

      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      const startTime = Date.now();
      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setRecordingTime(elapsed);

        // Auto-stop after 15 seconds
        if (elapsed >= 15) {
          stopRecording();
        }
      }, 100);

      recorder.onstop = () => {
        clearInterval(timer);
        const blob = new Blob(chunks, { type: "audio/webm" });
        setRecordedAudio(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };
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
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
    }
  };

  const playRecording = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };

  const resetRecording = () => {
    setRecordedAudio(null);
    setAudioUrl(null);
    setRecordingTime(0);
  };

  const saveVoiceToGroup = async () => {
    console.log("🎤 saveVoiceToGroup called", {
      hasRecordedAudio: !!recordedAudio,
      selectedGroupForVoice,
      recordedAudioType: recordedAudio?.type,
      recordedAudioSize: recordedAudio?.size,
    });

    if (!recordedAudio || !selectedGroupForVoice) {
      console.error("❌ Missing data:", {
        recordedAudio,
        selectedGroupForVoice,
      });
      toast({
        title: "Missing Data",
        description: "Please select an avatar group and record a voice sample.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("voiceRecording", recordedAudio, "voice.webm");
    formData.append("groupId", selectedGroupForVoice);

    console.log(
      "📤 Sending voice save request to:",
      `/api/photo-avatars/groups/${selectedGroupForVoice}/voice`
    );

    try {
      const response = await fetch(
        `/api/photo-avatars/groups/${selectedGroupForVoice}/voice`,
        {
          method: "POST",
          body: formData,
        }
      );

      console.log("📨 Response received:", {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Voice saved successfully:", result);
        toast({
          title: "Voice Saved",
          description: "Voice recording has been saved to the avatar group.",
        });
        resetRecording();
        setSelectedGroupForVoice(null);
      } else {
        const errorText = await response.text();
        console.error(
          "❌ Save failed with status:",
          response.status,
          errorText
        );
        throw new Error("Failed to save voice");
      }
    } catch (error) {
      console.error("❌ Error saving voice:", error);
      toast({
        title: "Save Failed",
        description: "Failed to save voice recording. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ready":
        return "bg-green-500";
      case "processing":
        return "bg-yellow-500";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  // Helper function to get step icon and color
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

  return (
    <div className="space-y-4">
    <div className="flex gap-4">
      {/* Main Content */}
      <Card data-testid="card-photo-avatar-manager" className="flex-1">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Photo Avatar Groups</CardTitle>
              <CardDescription>
                Create and manage AI-powered avatar groups from photos for
                personalized video content
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
              {showActivityPanel ? 'Hide' : 'Show'} Log
            </Button>
          </div>
        </CardHeader>
        <CardContent>
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="generate" data-testid="tab-generate">
              <Sparkles className="w-4 h-4 mr-2" />
              Generate AI Photos
            </TabsTrigger>
            <TabsTrigger value="upload" data-testid="tab-upload">
              <Upload className="w-4 h-4 mr-2" />
              Upload Avatars
            </TabsTrigger>
            <TabsTrigger value="voice" data-testid="tab-voice">
              <Mic className="w-4 h-4 mr-2" />
              Voice Recording
            </TabsTrigger>
            <TabsTrigger value="voice-library" data-testid="tab-voice-library">
              <Mic className="w-4 h-4 mr-2" />
              Voice Library
            </TabsTrigger>
            <TabsTrigger value="manage" data-testid="tab-manage">
              <Users className="w-4 h-4 mr-2" />
              Manage Groups
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={generationForm.name}
                  onChange={(e) =>
                    setGenerationForm({
                      ...generationForm,
                      name: e.target.value,
                    })
                  }
                  placeholder="Avatar name..."
                  data-testid="input-avatar-name"
                />
              </div>

              <div>
                <Label>Age Range</Label>
                <Select
                  value={generationForm.age}
                  onValueChange={(value) =>
                    setGenerationForm({ ...generationForm, age: value as any })
                  }
                >
                  <SelectTrigger data-testid="select-age">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Young Adult">Young Adult</SelectItem>
                    <SelectItem value="Early Middle Age">
                      Early Middle Age
                    </SelectItem>
                    <SelectItem value="Late Middle Age">
                      Late Middle Age
                    </SelectItem>
                    <SelectItem value="Senior">Senior</SelectItem>
                    <SelectItem value="Unspecified">Unspecified</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Gender</Label>
                <Select
                  value={generationForm.gender}
                  onValueChange={(value) =>
                    setGenerationForm({
                      ...generationForm,
                      gender: value as any,
                    })
                  }
                >
                  <SelectTrigger data-testid="select-gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Man">Man</SelectItem>
                    <SelectItem value="Woman">Woman</SelectItem>
                    <SelectItem value="Person">Person</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Ethnicity</Label>
                <Select
                  value={generationForm.ethnicity}
                  onValueChange={(value) =>
                    setGenerationForm({ ...generationForm, ethnicity: value })
                  }
                >
                  <SelectTrigger data-testid="select-ethnicity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="White">White</SelectItem>
                    <SelectItem value="Black">Black</SelectItem>
                    <SelectItem value="Asian American">
                      Asian American
                    </SelectItem>
                    <SelectItem value="East Asian">East Asian</SelectItem>
                    <SelectItem value="South East Asian">
                      South East Asian
                    </SelectItem>
                    <SelectItem value="South Asian">South Asian</SelectItem>
                    <SelectItem value="Middle Eastern">
                      Middle Eastern
                    </SelectItem>
                    <SelectItem value="Pacific">Pacific</SelectItem>
                    <SelectItem value="Hispanic">Hispanic</SelectItem>
                    <SelectItem value="Unspecified">Unspecified</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Orientation</Label>
                <Select
                  value={generationForm.orientation}
                  onValueChange={(value) =>
                    setGenerationForm({
                      ...generationForm,
                      orientation: value as any,
                    })
                  }
                >
                  <SelectTrigger data-testid="select-orientation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="horizontal">Horizontal</SelectItem>
                    <SelectItem value="vertical">Vertical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Pose</Label>
                <Select
                  value={generationForm.pose}
                  onValueChange={(value) =>
                    setGenerationForm({ ...generationForm, pose: value as any })
                  }
                >
                  <SelectTrigger data-testid="select-pose">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_body">Full Body</SelectItem>
                    <SelectItem value="half_body">Half Body</SelectItem>
                    <SelectItem value="close_up">Close Up</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Style</Label>
                <Select
                  value={generationForm.style}
                  onValueChange={(value) =>
                    setGenerationForm({
                      ...generationForm,
                      style: value as any,
                    })
                  }
                >
                  <SelectTrigger data-testid="select-style">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Realistic">Realistic</SelectItem>
                    <SelectItem value="Pixar">Pixar</SelectItem>
                    <SelectItem value="Cinematic">Cinematic</SelectItem>
                    <SelectItem value="Vintage">Vintage</SelectItem>
                    <SelectItem value="Noir">Noir</SelectItem>
                    <SelectItem value="Cyberpunk">Cyberpunk</SelectItem>
                    <SelectItem value="Unspecified">Unspecified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Appearance Description</Label>
              <Textarea
                value={generationForm.appearance}
                onChange={(e) =>
                  setGenerationForm({
                    ...generationForm,
                    appearance: e.target.value,
                  })
                }
                placeholder="Describe the appearance in detail..."
                rows={3}
                data-testid="textarea-appearance"
              />
            </div>

            <Button
              onClick={() => generatePhotosMutation.mutate(generationForm)}
              disabled={generatePhotosMutation.isPending}
              className="w-full"
              data-testid="button-generate"
            >
              {generatePhotosMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Photos...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  Generate 5 AI Photos
                </>
              )}
            </Button>

            {/* Progress Status for Processing Avatars */}
            {avatarGroups &&
              avatarGroups.length > 0 &&
              avatarGroups.some(
                (g: any) => g.train_status === "processing"
              ) && (
                <Alert className="mt-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-semibold">
                        Avatar Training in Progress...
                      </p>
                      <p className="text-sm">
                        {
                          avatarGroups.filter(
                            (g: any) => g.train_status === "processing"
                          ).length
                        }{" "}
                        avatar group(s) are being trained by HeyGen. This
                        typically takes 2-3 minutes. The page will auto-refresh
                        every 5 seconds.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

            {/* Circular Avatar Thumbnails - Compact Like HeyGen */}
            {avatarGroups && avatarGroups.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <h3 className="text-sm font-semibold mb-3 text-gray-700">
                  My Avatars
                </h3>

                {/* Circular thumbnails row */}
                <div className="flex gap-3 overflow-x-auto pb-3 mb-4">
                  {avatarGroups.map((group: any) => (
                    <button
                      key={group.group_id}
                      onClick={() => {
                        const element = document.getElementById(
                          `avatar-group-${group.group_id}`
                        );
                        if (element) {
                          element.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                        }
                      }}
                      className="flex flex-col items-center min-w-[70px] focus:outline-none group"
                      data-testid={`avatar-thumb-${group.group_id}`}
                    >
                      <div className="relative">
                        <img
                          src={group.preview_image}
                          alt={group.name}
                          className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 group-hover:border-[#D4AF37] transition-all cursor-pointer"
                        />
                        {group.num_looks > 1 && (
                          <div className="absolute -top-0.5 -right-0.5 bg-[#D4AF37] text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-semibold">
                            {group.num_looks}
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] mt-1.5 text-center font-medium text-gray-600 truncate w-16">
                        {group.name}
                      </p>
                    </button>
                  ))}
                </div>

                {/* Large Avatar Images Grid - HeyGen Style */}
                <h4 className="text-xs font-medium text-gray-500 mb-3">
                  All avatar looks
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {avatarGroups.map((group: any) => (
                    <LargeAvatarCard
                      key={group.group_id}
                      groupId={group.group_id}
                      groupName={group.name}
                      onOpenGallery={() =>
                        setOpenGalleryGroupId(group.group_id)
                      }
                      onChangeOutfit={() => {
                        setSelectedGroupForEdit(group);
                        setEditDialogOpen(true);
                      }}
                      onDelete={() => deleteGroupMutation.mutate(group.group_id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {isLoadingGroups && (
              <div className="mt-6 flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-600">
                  Loading your avatars...
                </span>
              </div>
            )}
          </TabsContent>

          <TabsContent value="upload" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Upload 5-20 high-quality photos of the same person from
                different angles for best results. Photos should be clear,
                well-lit, and show the face clearly.
              </AlertDescription>
            </Alert>

            <div className="border-2 border-dashed border-gray-300 hover:border-[#D4AF37] rounded-lg p-6 text-center transition-colors">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="photo-upload"
              />
              <label
                htmlFor="photo-upload"
                className="cursor-pointer flex flex-col items-center"
                data-testid="label-upload"
              >
                <Image className="w-12 h-12 text-gray-400 mb-2" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Click to select multiple photos
                </span>
                <span className="text-xs text-gray-500 mt-1">
                  Hold Ctrl (or Cmd on Mac) to select multiple files at once
                </span>
                <span className="text-xs text-gray-400 mt-0.5">
                  PNG, JPG up to 10MB each
                </span>
              </label>
            </div>

            {uploadedFiles.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {uploadedFiles.length} photo{uploadedFiles.length > 1 ? "s" : ""} selected
                  </p>
                  <label
                    htmlFor="photo-upload"
                    className="text-xs text-[#D4AF37] hover:underline cursor-pointer"
                  >
                    + Add more
                  </label>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {uploadedFiles.map((file, index) => {
                    const previewUrl = URL.createObjectURL(file);
                    return (
                    <div
                      key={`${file.name}-${file.size}-${index}`}
                      className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
                    >
                      <img
                        src={previewUrl}
                        alt={file.name}
                        className="w-full h-full object-cover"
                        onLoad={() => URL.revokeObjectURL(previewUrl)}
                      />
                      <button
                        onClick={() =>
                          setUploadedFiles((files) =>
                            files.filter((_, i) => i !== index)
                          )
                        }
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`button-remove-${index}`}
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                    );
                  })}
                </div>

                <Button
                  onClick={handleUploadFiles}
                  disabled={uploadPhotoMutation.isPending}
                  className="w-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110 text-white"
                  data-testid="button-upload-files"
                >
                  {uploadPhotoMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload {uploadedFiles.length} Photo
                      {uploadedFiles.length > 1 ? "s" : ""} & Create Avatar
                    </>
                  )}
                </Button>
              </>
            )}

            {/* Group Name Dialog */}
            <Dialog open={showGroupNameDialog} onOpenChange={setShowGroupNameDialog}>
              <DialogContent data-testid="dialog-group-name">
                <DialogHeader>
                  <DialogTitle>Name Your Avatar Group</DialogTitle>
                  <DialogDescription>
                    Enter a name for your new avatar group
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="e.g., Professional Avatar, Business Headshot"
                    value={groupNameInput}
                    onChange={(e) => setGroupNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleConfirmGroupName();
                      }
                    }}
                    data-testid="input-group-name"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowGroupNameDialog(false);
                        setGroupNameInput("");
                      }}
                      data-testid="button-cancel-group"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleConfirmGroupName}
                      disabled={!groupNameInput.trim()}
                      data-testid="button-confirm-group"
                    >
                      Create Avatar Group
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Upload History - Grid Layout */}
            {avatarGroups && avatarGroups.length > 0 && (
              <div className="mt-6 border-t pt-4">
                <h3 className="text-sm font-semibold mb-3 text-gray-700 flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Upload History
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  {avatarGroups.length} avatar{" "}
                  {avatarGroups.length === 1 ? "group" : "groups"} created
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {avatarGroups.map((group: any) => (
                    <div
                      key={group.group_id}
                      className="group relative border rounded-lg overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                      onClick={() => {
                        const element = document.getElementById(
                          `avatar-group-${group.group_id}`
                        );
                        if (element) {
                          const generateTab =
                            document.querySelector('[value="generate"]');
                          if (generateTab) {
                            (generateTab as HTMLElement).click();
                          }
                          setTimeout(() => {
                            element.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            });
                          }, 100);
                        }
                      }}
                      data-testid={`upload-history-${group.group_id}`}
                    >
                      <div className="aspect-square relative">
                        <img
                          src={group.preview_image}
                          alt={group.name}
                          className="w-full h-full object-cover"
                        />
                        {group.num_looks > 1 && (
                          <div className="absolute top-2 right-2 bg-[#D4AF37] text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                            {group.num_looks}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              const element = document.getElementById(
                                `avatar-group-${group.group_id}`
                              );
                              if (element) {
                                const generateTab =
                                  document.querySelector('[value="generate"]');
                                if (generateTab) {
                                  (generateTab as HTMLElement).click();
                                }
                                setTimeout(() => {
                                  element.scrollIntoView({
                                    behavior: "smooth",
                                    block: "center",
                                  });
                                }, 100);
                              }
                            }}
                            data-testid={`button-view-${group.group_id}`}
                          >
                            View
                          </Button>
                        </div>
                      </div>
                      <div className="p-2 bg-white">
                        <h4 className="text-xs font-medium text-gray-800 truncate">
                          {group.name}
                        </h4>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {new Date(group.created_at * 1000).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" }
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="voice" className="space-y-4">
            <Alert>
              <Mic className="h-4 w-4" />
              <AlertDescription>
                Record a custom voice for your photo avatars. Your voice will be
                used to generate personalized video content.
              </AlertDescription>
            </Alert>

            {/* Select Avatar Group */}
            {avatarGroups && avatarGroups.length > 0 && (
              <div>
                <Label>Select Avatar Group for Voice</Label>
                <Select
                  value={selectedGroupForVoice || ""}
                  onValueChange={setSelectedGroupForVoice}
                >
                  <SelectTrigger data-testid="select-avatar-group-voice">
                    <SelectValue placeholder="Choose an avatar group" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(avatarGroups) &&
                      avatarGroups
                        .filter((g: AvatarGroup) => g.status !== "failed")
                        .map((group: AvatarGroup) => {
                          const statusLabel =
                            group.status === "pending"
                              ? "Processing"
                              : group.status === "completed"
                              ? "Ready"
                              : group.status === "ready" &&
                                (group as any).train_status === "ready"
                              ? "Trained"
                              : group.status === "ready"
                              ? "Ready to Train"
                              : group.status;

                          return (
                            <SelectItem
                              key={group.group_id}
                              value={group.group_id}
                            >
                              <span className="flex items-center justify-between w-full">
                                <span className="font-medium">
                                  {group.name}
                                </span>
                                <span className="text-xs text-gray-500 ml-2">
                                  ({statusLabel})
                                </span>
                              </span>
                            </SelectItem>
                          );
                        })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Recording Interface */}
            <div className="border rounded-lg p-6 space-y-4 bg-gray-50 dark:bg-gray-900">
              <div className="text-center">
                {!isRecording && !recordedAudio && (
                  <>
                    <Mic className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Record a 5-15 second voice sample for your avatar
                    </p>
                    <Button
                      onClick={startRecording}
                      size="lg"
                      className="w-full max-w-xs"
                      data-testid="button-start-recording"
                    >
                      <Mic className="w-4 h-4 mr-2" />
                      Start Recording
                    </Button>
                  </>
                )}

                {isRecording && (
                  <>
                    <div className="relative w-16 h-16 mx-auto mb-4">
                      <div className="absolute inset-0 bg-red-500 rounded-full animate-pulse opacity-75"></div>
                      <div className="relative flex items-center justify-center w-16 h-16 bg-red-500 rounded-full">
                        <MicOff className="w-8 h-8 text-white" />
                      </div>
                    </div>
                    <p className="text-lg font-semibold mb-2">
                      Recording... {recordingTime}s
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                      Speak clearly into your microphone
                    </p>
                    <Button
                      onClick={stopRecording}
                      variant="destructive"
                      size="lg"
                      className="w-full max-w-xs"
                      data-testid="button-stop-recording"
                    >
                      <MicOff className="w-4 h-4 mr-2" />
                      Stop Recording
                    </Button>
                  </>
                )}

                {recordedAudio && !isRecording && (
                  <>
                    <Check className="w-12 h-12 mx-auto mb-4 text-green-500" />
                    <p className="text-sm font-semibold mb-4">
                      Voice Recording Complete!
                    </p>
                    <div className="flex gap-2 justify-center mb-4">
                      <Button
                        onClick={playRecording}
                        variant="outline"
                        data-testid="button-play-recording"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Play Recording
                      </Button>
                      <Button
                        onClick={resetRecording}
                        variant="outline"
                        data-testid="button-re-record"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Re-record
                      </Button>
                    </div>
                    {selectedGroupForVoice && (
                      <Button
                        onClick={saveVoiceToGroup}
                        className="w-full max-w-xs"
                        data-testid="button-save-voice"
                      >
                        Save Voice to Avatar Group
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {!avatarGroups ||
              (avatarGroups.length === 0 && (
                <Alert>
                  <AlertDescription>
                    Create an avatar group first before recording a custom
                    voice.
                  </AlertDescription>
                </Alert>
              ))}
          </TabsContent>

          <TabsContent value="voice-library" className="space-y-4">
            <VoiceLibraryManager />
          </TabsContent>

          <TabsContent value="manage" className="space-y-4">
            {/* Info Alert for HeyGen Portal Training */}
            {!isLoadingGroups &&
              avatarGroups &&
              avatarGroups.some(
                (g: any) => g.train_status === "empty" && g.num_looks >= 1
              ) && (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-sm text-blue-800">
                    <strong>Tip:</strong> If you trained avatars in the HeyGen
                    portal, click "Refresh Status" to sync the latest training
                    status.
                  </AlertDescription>
                </Alert>
              )}

            {/* Refresh Button */}
            {!isLoadingGroups && avatarGroups && avatarGroups.length > 0 && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    queryClient.invalidateQueries({
                      queryKey: ["/api/photo-avatars/groups"],
                    })
                  }
                  className="text-xs"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Refresh Status
                </Button>
              </div>
            )}

            {isLoadingGroups ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                <p className="text-sm text-gray-500 mt-2">
                  Loading avatar groups...
                </p>
              </div>
            ) : !avatarGroups || avatarGroups.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No avatar groups found. Generate AI photos or upload your own
                  to get started.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-6">
                {/* Train All Pending Avatars Button */}
                {avatarGroups.filter(
                  (g: any) => g.train_status === "empty" && g.num_looks >= 1
                ).length > 0 && (
                  <div className="sticky top-0 z-10 bg-white border-2 border-[#D4AF37] rounded-lg p-4 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-[#D4AF37]">
                          {
                            avatarGroups.filter(
                              (g: any) =>
                                g.train_status === "empty" && g.num_looks >= 1
                            ).length
                          }{" "}
                          Avatar Groups Need Training
                        </h3>
                        <p className="text-sm text-gray-600">
                          Train all pending avatars at once with the same
                          professional voice
                        </p>
                      </div>
                      <Button
                        onClick={() => setShowTrainAllDialog(true)}
                        className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110"
                        data-testid="button-train-all-pending"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Train All Pending Avatars
                      </Button>
                    </div>
                  </div>
                )}

                {/* Train All Dialog */}
                {showTrainAllDialog && (
                  <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    onClick={() => setShowTrainAllDialog(false)}
                  >
                    <div
                      className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h3 className="text-xl font-semibold mb-4">
                        Select Voice for All Avatars
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Choose a professional voice that will be used for all{" "}
                        {
                          avatarGroups.filter(
                            (g: any) =>
                              g.train_status === "empty" && g.num_looks >= 1
                          ).length
                        }{" "}
                        pending avatar groups.
                      </p>
                      <div className="space-y-4">
                        <div>
                          <Label>Professional Voice</Label>
                          <Select
                            value={trainAllVoiceId}
                            onValueChange={setTrainAllVoiceId}
                          >
                            <SelectTrigger data-testid="select-train-all-voice">
                              <SelectValue placeholder="Choose a voice" />
                            </SelectTrigger>
                            <SelectContent>
                              {PROFESSIONAL_VOICES.map((voice) => (
                                <SelectItem key={voice.id} value={voice.id}>
                                  {voice.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() =>
                              trainAllMutation.mutate(trainAllVoiceId)
                            }
                            disabled={
                              !trainAllVoiceId || trainAllMutation.isPending
                            }
                            className="flex-1 bg-gradient-to-r from-[#D4AF37] to-[#B8860B]"
                            data-testid="button-confirm-train-all"
                          >
                            {trainAllMutation.isPending ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Training...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4 mr-2" />
                                Start Training All
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={() => {
                              setShowTrainAllDialog(false);
                              setTrainAllVoiceId("");
                            }}
                            variant="outline"
                            disabled={trainAllMutation.isPending}
                            data-testid="button-cancel-train-all"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Generate AI Enhanced Look Banner */}
                <div 
                  className="mb-6 cursor-pointer"
                  onClick={() => setAiLookDialogOpen(true)}
                  data-testid="banner-ai-enhanced-look"
                >
                  <div className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] rounded-xl p-4 flex items-center justify-between hover:brightness-110 transition-all shadow-lg">
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-6 w-6 text-black" />
                      <div>
                        <p className="font-semibold text-black text-base">Generate AI Enhanced Look</p>
                        <p className="text-black/70 text-sm">2-3 min processing • {avatarGroups.length}/∞ used</p>
                      </div>
                    </div>
                    <div className="text-black">
                      <ChevronDown className="h-5 w-5 rotate-[-90deg]" />
                    </div>
                  </div>
                </div>

                {Array.isArray(avatarGroups) &&
                  avatarGroups.map((group: AvatarGroup) => (
                    <Card
                      key={group.group_id}
                      className="overflow-hidden border border-gray-200"
                      data-testid={`card-group-${group.group_id}`}
                    >
                      <CardContent className="p-3 space-y-2">
                        {/* Compact Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-600 mb-1.5">
                              {group.name}
                            </p>
                            <div className="flex items-center gap-1.5">
                              {group.status === "ready" && (
                                <div
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${
                                    (group as any).train_status === "ready"
                                      ? "bg-green-100 text-green-700"
                                      : (group as any).train_status ===
                                        "processing"
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {(group as any).train_status === "ready" ? (
                                    <CheckCircle className="w-3 h-3" />
                                  ) : (group as any).train_status ===
                                    "processing" ? (
                                    <Clock className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <UserPlus className="w-3 h-3" />
                                  )}
                                  <span className="text-[9px] font-semibold">
                                    {(group as any).train_status === "ready"
                                      ? "Trained & Ready"
                                      : (group as any).train_status ===
                                        "processing"
                                      ? "Training..."
                                      : "Ready to Train"}
                                  </span>
                                </div>
                              )}
                              {group.status === "pending" && (
                                <div className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                  <Clock className="w-3 h-3" />
                                  <span className="text-[9px] font-semibold">
                                    Processing Images
                                  </span>
                                </div>
                              )}
                              {group.status === "completed" && (
                                <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                  <UserPlus className="w-3 h-3" />
                                  <span className="text-[9px] font-semibold">
                                    {!group.avatar_count ||
                                    group.avatar_count < 2
                                      ? "Need More Photos"
                                      : "Ready to Train"}
                                  </span>
                                </div>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400">
                              {new Date(group.created_at).toLocaleDateString(
                                "en-US",
                                { month: "short", day: "numeric" }
                              )}
                              {group.avatar_count &&
                                ` • ${group.avatar_count} photos`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge
                              className={`${getStatusColor(
                                group.status
                              )} text-white text-[9px] px-1.5 py-0.5`}
                            >
                              {group.status}
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="w-6 h-6 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
                                  data-testid={`button-menu-group-${group.group_id}`}
                                >
                                  <MoreVertical className="h-3.5 w-3.5 text-gray-500" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedGroupForEdit(group);
                                    setEditDialogOpen(true);
                                  }}
                                  data-testid={`button-menu-outfit-${group.group_id}`}
                                >
                                  <Shirt className="h-4 w-4 mr-2" />
                                  Change Outfit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={async () => {
                                    const confirmed = await confirm({
                                      title: "Delete Avatar Group",
                                      description: "Delete this avatar group? This cannot be undone.",
                                      confirmText: "Delete",
                                      variant: "destructive",
                                    });
                                    if (confirmed) {
                                      deleteGroupMutation.mutate(group.group_id);
                                    }
                                  }}
                                  className="text-red-600 focus:text-red-600"
                                  data-testid={`button-menu-delete-${group.group_id}`}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Training Progress - Compact */}
                        {group.status === "processing" &&
                          group.training_progress && (
                            <div className="space-y-1">
                              <Progress
                                value={group.training_progress}
                                className="h-1"
                              />
                              <p className="text-[9px] text-gray-400">
                                Training: {group.training_progress}%
                              </p>
                            </div>
                          )}

                        {/* Photo Gallery Component */}
                        <AvatarPhotoGallery groupId={group.group_id} />

                        {/* Compact Action Buttons */}
                        <div className="flex gap-1.5 pt-1">
                          {group.status === "pending" && (
                            <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-1 rounded text-[10px]">
                              <Clock className="w-3 h-3 animate-spin" />
                              <span>HeyGen is processing images...</span>
                            </div>
                          )}

                          {(group.status === "completed" ||
                            (group.status === "ready" &&
                              (group as any).train_status !== "ready")) && (
                            <>
                              {!group.avatar_count || group.avatar_count < 2 ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-1 rounded text-[10px]">
                                        <Upload className="w-3 h-3" />
                                        <span>
                                          Upload{" "}
                                          {group.avatar_count === 1
                                            ? "2-4 more photos"
                                            : "at least 2 photos"}{" "}
                                          to train
                                        </span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>
                                        Training requires multiple diverse
                                        photos (different angles, expressions,
                                        outfits)
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          trainGroupMutation.mutate({
                                            groupId: group.group_id,
                                          })
                                        }
                                        disabled={trainGroupMutation.isPending}
                                        data-testid={`button-train-${group.group_id}`}
                                        className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110 h-7 text-[10px] px-2"
                                      >
                                        <UserPlus className="w-3 h-3 mr-1" />
                                        {trainGroupMutation.isPending
                                          ? "Training..."
                                          : `Train Avatar (${group.avatar_count} photos)`}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>
                                        Train this avatar to generate custom
                                        variations and looks
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </>
                          )}

                          {group.status === "ready" &&
                            (group as any).train_status === "ready" && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    generateLooksMutation.mutate({
                                      groupId: group.group_id,
                                      numLooks: 4,
                                    })
                                  }
                                  disabled={generateLooksMutation.isPending}
                                  data-testid={`button-looks-${group.group_id}`}
                                  className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110 h-7 text-[10px] px-2"
                                >
                                  <Wand2 className="w-3 h-3 mr-1" />
                                  Generate 4 Looks
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedGroupForEdit(group);
                                    setEditDialogOpen(true);
                                  }}
                                  data-testid={`button-change-outfit-${group.group_id}`}
                                  className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10 h-7 text-[10px] px-2"
                                >
                                  <Shirt className="w-3 h-3 mr-1" />
                                  Change Outfit
                                </Button>
                              </>
                            )}

                          {/* Add Motion button - available for any group with avatars */}
                          {group.avatar_count && group.avatar_count > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedAvatarForMotion({
                                  avatarId: group.group_id,
                                  groupName: group.name,
                                });
                                setAddMotionDialogOpen(true);
                              }}
                              data-testid={`button-motion-${group.group_id}`}
                              className="border-purple-300 text-purple-600 hover:bg-purple-50 h-7 text-[10px] px-2"
                            >
                              <Play className="w-3 h-3 mr-1" />
                              Add Motion
                            </Button>
                          )}

                          {group.status === "ready" &&
                            (group as any).train_status === "ready" && <></>}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              deleteGroupMutation.mutate(group.group_id)
                            }
                            disabled={deleteGroupMutation.isPending}
                            data-testid={`button-delete-${group.group_id}`}
                            className="ml-auto border-red-300 text-red-600 hover:bg-red-50 h-7 text-[10px] px-2"
                          >
                            <X className="w-3 h-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Edit Look Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shirt className="h-5 w-5 text-[#D4AF37]" />
              Change Outfit
            </DialogTitle>
            <DialogDescription>
              Choose a preset outfit or describe what you'd like your avatar to wear. HeyGen will generate a new look with the selected clothing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Avatar Group: {selectedGroupForEdit?.name}</Label>
              <Badge variant="outline" className="ml-2">
                {selectedGroupForEdit?.group_id}
              </Badge>
            </div>

            <div className="space-y-2">
              <Label>Quick Outfit Presets</Label>
              <div className="grid grid-cols-3 gap-2">
                {OUTFIT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setEditPrompt(preset.prompt)}
                    className={`p-2 rounded-lg border text-left transition-all hover:border-[#D4AF37] hover:bg-[#D4AF37]/5 ${
                      editPrompt === preset.prompt ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-gray-200 dark:border-gray-700'
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
              <Label htmlFor="edit-prompt">
                Describe the outfit
              </Label>
              <Textarea
                id="edit-prompt"
                placeholder="Describe the outfit: e.g., navy blazer with white shirt, or casual polo with khakis..."
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                rows={4}
                className="resize-none"
                data-testid="textarea-edit-prompt"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-orientation">Orientation</Label>
                <Select
                  value={editOrientation}
                  onValueChange={(value: any) => setEditOrientation(value)}
                >
                  <SelectTrigger data-testid="select-edit-orientation">
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
                <Label htmlFor="edit-pose">Pose</Label>
                <Select
                  value={editPose}
                  onValueChange={(value: any) => setEditPose(value)}
                >
                  <SelectTrigger data-testid="select-edit-pose">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="half_body">Half Body</SelectItem>
                    <SelectItem value="full_body">Full Body</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-style">Style</Label>
                <Select value={editStyle} onValueChange={setEditStyle}>
                  <SelectTrigger data-testid="select-edit-style">
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

            <p className="text-xs text-muted-foreground">
              Be specific about what you want to change. This will generate a
              new look variation based on your description.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setEditPrompt("");
              }}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedGroupForEdit && editPrompt.trim()) {
                  editLookMutation.mutate({
                    groupId: selectedGroupForEdit.group_id,
                    prompt: editPrompt.trim(),
                    orientation: editOrientation,
                    pose: editPose,
                    style: editStyle,
                  });
                }
              }}
              disabled={!editPrompt.trim() || editLookMutation.isPending}
              className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110"
              data-testid="button-generate-edit"
            >
              {editLookMutation.isPending ? (
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

      {/* Generate AI Enhanced Look Dialog */}
      <Dialog open={aiLookDialogOpen} onOpenChange={(open) => {
        setAiLookDialogOpen(open);
        if (!open) {
          setAiLookFile(null);
          setAiLookFilePreview(null);
        }
      }}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#D4AF37]" />
              Generate New Look
            </DialogTitle>
            <DialogDescription>
              Create a new appearance for your selected avatar with different outfits and styles
            </DialogDescription>
          </DialogHeader>

          <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg p-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#D4AF37]" />
            <span className="text-sm"><strong>Processing time:</strong> 2-3 minutes. You can close this modal and continue working.</span>
          </div>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="font-semibold">Source</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={aiLookSource === "upload" ? "default" : "outline"}
                  onClick={() => setAiLookSource("upload")}
                  className={aiLookSource === "upload" ? "bg-[#D4AF37] hover:bg-[#B8860B] text-black" : ""}
                  data-testid="button-source-upload"
                >
                  Use staged photo
                </Button>
                <Button
                  type="button"
                  variant={aiLookSource === "existing" ? "default" : "outline"}
                  onClick={() => setAiLookSource("existing")}
                  className={aiLookSource === "existing" ? "bg-[#D4AF37] hover:bg-[#B8860B] text-black" : ""}
                  data-testid="button-source-existing"
                >
                  Use existing avatar
                </Button>
              </div>
            </div>

            {aiLookSource === "upload" ? (
              <div className="space-y-2">
                <input
                  type="file"
                  ref={aiLookFileRef}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  data-testid="input-ai-look-file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setAiLookFile(file);
                      const reader = new FileReader();
                      reader.onload = () => setAiLookFilePreview(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                {aiLookFilePreview ? (
                  <div className="relative">
                    <img src={aiLookFilePreview} alt="Preview" className="w-full h-40 object-cover rounded-lg border" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 h-6 w-6 p-0 bg-black/50 hover:bg-black/70 text-white rounded-full"
                      onClick={() => { setAiLookFile(null); setAiLookFilePreview(null); }}
                      data-testid="button-remove-ai-look-file"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-[#D4AF37] transition-colors"
                    onClick={() => aiLookFileRef.current?.click()}
                    data-testid="dropzone-ai-look"
                  >
                    <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-muted-foreground">Click to upload a photo</p>
                    <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, WebP • Max 50MB</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Using your latest staged photo by default.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Select Avatar Group</Label>
                <Select value={aiLookSelectedGroup} onValueChange={setAiLookSelectedGroup}>
                  <SelectTrigger data-testid="select-ai-look-group">
                    <SelectValue placeholder="Choose an avatar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {avatarGroups.map((group: AvatarGroup) => (
                      <SelectItem key={group.group_id} value={group.group_id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="font-semibold">Describe the Look</Label>
              <Input
                placeholder="e.g., White shirt front-facing, Professional attire, Casual outfit"
                value={aiLookPrompt}
                onChange={(e) => setAiLookPrompt(e.target.value)}
                data-testid="input-ai-look-prompt"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Orientation</Label>
              <Select value={aiLookOrientation} onValueChange={(v: any) => setAiLookOrientation(v)}>
                <SelectTrigger data-testid="select-ai-look-orientation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="square">Square</SelectItem>
                  <SelectItem value="horizontal">Horizontal</SelectItem>
                  <SelectItem value="vertical">Vertical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Pose</Label>
              <Select value={aiLookPose} onValueChange={(v: any) => setAiLookPose(v)}>
                <SelectTrigger data-testid="select-ai-look-pose">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="half_body">Half Body</SelectItem>
                  <SelectItem value="close_up">Close Up</SelectItem>
                  <SelectItem value="full_body">Full Body</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Style</Label>
              <Select value={aiLookStyle} onValueChange={setAiLookStyle}>
                <SelectTrigger data-testid="select-ai-look-style">
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

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setAiLookDialogOpen(false);
                setAiLookFile(null);
                setAiLookFilePreview(null);
              }}
              data-testid="button-cancel-ai-look"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAiLookGenerate}
              disabled={aiLookGenerating || (aiLookSource === "upload" && !aiLookFile) || (aiLookSource === "existing" && !aiLookSelectedGroup)}
              className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110 text-black"
              data-testid="button-ok-ai-look"
            >
              {aiLookGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "OK"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Motion Dialog */}
      <Dialog open={addMotionDialogOpen} onOpenChange={setAddMotionDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-purple-600" />
              Add Motion to Avatar
            </DialogTitle>
            <DialogDescription>
              Animate your avatar with natural motion to bring it to life. This
              creates a short animated video from your still image.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Avatar: {selectedAvatarForMotion?.groupName}</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="motion-prompt">
                Motion Description (Optional)
              </Label>
              <Textarea
                id="motion-prompt"
                placeholder="Example: subtle head nod and smile, gentle breathing motion..."
                value={motionPrompt}
                onChange={(e) => setMotionPrompt(e.target.value)}
                rows={3}
                className="resize-none"
                data-testid="textarea-motion-prompt"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank for automatic natural motion
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="motion-type">Motion Engine</Label>
              <Select value={motionType} onValueChange={setMotionType}>
                <SelectTrigger data-testid="select-motion-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consistent">
                    Consistent (Recommended)
                  </SelectItem>
                  <SelectItem value="expressive">Expressive</SelectItem>
                  <SelectItem value="consistent_gen_3">
                    Consistent Gen 3
                  </SelectItem>
                  <SelectItem value="hailuo_2">Hailuo 2</SelectItem>
                  <SelectItem value="veo2">Veo 2</SelectItem>
                  <SelectItem value="seedance_lite">Seedance Lite</SelectItem>
                  <SelectItem value="kling">Kling</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Different engines produce varying styles of motion
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setAddMotionDialogOpen(false);
                setMotionPrompt("");
                setMotionType("consistent");
              }}
              data-testid="button-cancel-motion"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedAvatarForMotion) {
                  addMotionMutation.mutate({
                    avatarId: selectedAvatarForMotion.avatarId,
                    prompt: motionPrompt.trim() || undefined,
                    motionType,
                  });
                }
              }}
              disabled={addMotionMutation.isPending}
              className="bg-gradient-to-r from-purple-600 to-purple-800 hover:brightness-110"
              data-testid="button-add-motion"
            >
              {addMotionMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding Motion...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Add Motion
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Gallery Dialog */}
      <Dialog
        open={!!openGalleryGroupId}
        onOpenChange={() => setOpenGalleryGroupId(null)}
      >
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-playfair text-2xl">
              Avatar Gallery
            </DialogTitle>
            <DialogDescription>
              Click on any avatar to view full-size and play videos
            </DialogDescription>
          </DialogHeader>
          {openGalleryGroupId && (
            <AvatarPhotoGallery groupId={openGalleryGroupId} />
          )}
        </DialogContent>
      </Dialog>

      {/* Debug Panel - Collapsible */}
      <div className="mt-4 border-t pt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDebugPanel(!showDebugPanel)}
          className="flex items-center gap-2 text-xs"
          data-testid="button-toggle-debug"
        >
          <Bug className="w-4 h-4" />
          {showDebugPanel ? "Hide" : "Show"} Debug Panel
          {showDebugPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {debugLogs.length > 0 && (
            <Badge variant="secondary" className="ml-2">{debugLogs.length}</Badge>
          )}
        </Button>

        {showDebugPanel && (
          <div className="mt-3 bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-xs overflow-auto max-h-[400px]">
            <div className="flex justify-between items-center mb-3">
              <span className="text-green-400 flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                API Debug Console
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDebugLogs([])}
                className="text-gray-400 hover:text-white h-6 px-2"
              >
                <X className="w-3 h-3 mr-1" />
                Clear
              </Button>
            </div>

            {debugLogs.length === 0 ? (
              <div className="text-gray-500 py-4 text-center">
                No API calls logged yet. Click "Generate 4 Looks" to see the debug output.
              </div>
            ) : (
              <div className="space-y-2">
                {debugLogs.map((log, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded border-l-2 ${
                      log.type === 'error' 
                        ? 'border-red-500 bg-red-900/20' 
                        : log.type === 'request' 
                        ? 'border-blue-500 bg-blue-900/20'
                        : log.type === 'response'
                        ? 'border-green-500 bg-green-900/20'
                        : 'border-yellow-500 bg-yellow-900/20'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-gray-400">[{log.timestamp}]</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          log.type === 'error' ? 'text-red-400 border-red-400' :
                          log.type === 'request' ? 'text-blue-400 border-blue-400' :
                          log.type === 'response' ? 'text-green-400 border-green-400' :
                          'text-yellow-400 border-yellow-400'
                        }`}
                      >
                        {log.type.toUpperCase()}
                      </Badge>
                      {log.endpoint && (
                        <span className="text-cyan-400">{log.endpoint}</span>
                      )}
                    </div>
                    {log.message && (
                      <div className="text-gray-300 mb-1">{log.message}</div>
                    )}
                    {log.payload && (
                      <div className="mt-1">
                        <span className="text-gray-500">Payload: </span>
                        <pre className="text-orange-300 whitespace-pre-wrap">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.response && (
                      <div className="mt-1">
                        <span className="text-gray-500">Response: </span>
                        <pre className="text-green-300 whitespace-pre-wrap">
                          {JSON.stringify(log.response, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>

      {/* Activity Log Panel - Right Side */}
      {showActivityPanel && (
        <Card className="w-80 flex-shrink-0 h-fit max-h-[600px] sticky top-4" data-testid="activity-log-panel">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                Activity Log
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActivityLogs([])}
                className="h-6 px-2 text-xs"
                data-testid="button-clear-activity-log"
              >
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div
              ref={activityLogRef}
              className="space-y-2 overflow-y-auto max-h-[480px] pr-1"
            >
              {activityLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No activity yet</p>
                  <p className="text-xs mt-1">Upload a photo to get started</p>
                </div>
              ) : (
                activityLogs.map((log) => {
                  const style = getStepStyle(log.step);
                  const IconComponent = style.icon;
                  return (
                    <div
                      key={log.id}
                      className={`p-2 rounded-lg ${style.bg} border border-gray-100`}
                      data-testid={`activity-log-${log.id}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 ${style.color}`}>
                          <IconComponent className={`w-4 h-4 ${log.step === 'training_progress' ? 'animate-spin' : ''}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-sm text-gray-800 truncate">
                              {log.message}
                            </p>
                            <span className="text-[10px] text-gray-400 flex-shrink-0">
                              {log.timestamp}
                            </span>
                          </div>
                          {log.groupName && (
                            <p className="text-xs text-gray-600 truncate">
                              {log.groupName}
                            </p>
                          )}
                          {log.details && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {log.details}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>

    {allLooks.length > 0 && (
      <Card data-testid="card-generated-looks">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="w-5 h-5 text-[#D4AF37]" />
            Generated Looks
          </CardTitle>
          <CardDescription>
            All AI-generated avatar looks across your groups
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAllLooks ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto" />
              <p className="text-sm text-gray-500 mt-2">Loading looks...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {allLooks.map((look: any) => (
                <div
                  key={look.id}
                  className="group relative rounded-lg overflow-hidden border border-gray-200 hover:border-[#D4AF37] transition-colors"
                  data-testid={`card-look-${look.id}`}
                >
                  <div className="aspect-square bg-gray-100">
                    <img
                      src={look.photoUrl}
                      alt={look.poseType || "Avatar look"}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-800 truncate">
                      {look.poseType || "Look"}
                    </p>
                    <p className="text-[10px] text-gray-500 truncate">
                      {look.groupName || look.groupId}
                    </p>
                    {look.processingStatus && (
                      <Badge
                        variant={look.processingStatus === "completed" ? "default" : "secondary"}
                        className="mt-1 text-[10px] px-1 py-0"
                        data-testid={`badge-status-${look.id}`}
                      >
                        {look.processingStatus}
                      </Badge>
                    )}
                    {look.photoUrl && look.processingStatus === "completed" && (
                      <Button
                        size="sm"
                        className="w-full mt-2 bg-[#D4AF37] hover:bg-[#C4A030] text-white text-[10px] h-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          useLookForVideoMutation.mutate(look);
                        }}
                        disabled={useLookForVideoMutation.isPending && useLookPendingId === look.id}
                        data-testid={`button-use-look-video-${look.id}`}
                      >
                        {useLookForVideoMutation.isPending && useLookPendingId === look.id ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Preparing...
                          </>
                        ) : (
                          <>
                            <Video className="h-3 w-3 mr-1" />
                            Use for Video
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    )}

    </div>
  );
}
