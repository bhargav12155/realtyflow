import { useToast } from "@/hooks/use-toast";
import {
  type HeygenShapeDriftDetails,
  shapeDriftToast,
  tryParseShapeDriftBody,
} from "@/components/dashboard/heygen-shape-drift-alert";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  Sparkles,
  Upload as UploadIcon,
  Wand2,
} from "lucide-react";
import type {
  ActivityLog,
  AvatarGroup,
  AvatarLook,
  DebugLog,
  PhotoGenerationRequest,
} from "./types";

interface AvatarGroupsResponse {
  avatar_group_list?: AvatarGroup[];
}

interface AllLooksResponse {
  looks?: AvatarLook[];
}

export function usePhotoAvatarManager() {
  const { toast } = useToast();
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
  // HeyGen v3 consent capture for the Upload tab.
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const [consentVideoUrl, setConsentVideoUrl] = useState("");
  // Shape-drift envelope returned by `/api/v3/photo-avatars` when
  // HeyGen replies with a payload that doesn't match our schema. Held
  // in state so the create dialog can surface a dedicated retry alert
  // (without forcing the user to re-pick files / re-enter the name)
  // alongside the destructive toast.
  const [createShapeDrift, setCreateShapeDrift] =
    useState<HeygenShapeDriftDetails | null>(null);
  // True while a retry kicked off from the shape-drift alert is in
  // flight, so the alert button can show a spinner.
  const [isRetryingCreate, setIsRetryingCreate] = useState(false);
  // V3 Looks browser — tracks which group's panel is currently open.
  const [openLooksGroupId, setOpenLooksGroupId] = useState<string | null>(null);
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
  const { data: avatarGroupsResponse, isLoading: isLoadingGroups } = useQuery<AvatarGroupsResponse>({
    queryKey: ["/api/photo-avatars/groups"],
    refetchInterval: (query) => {
      const data = (query as unknown as { state?: { data?: AvatarGroupsResponse } }).state?.data;
      if (!data || !data.avatar_group_list) return false;
      const needsPolling = data.avatar_group_list.some(
        (g) =>
          g.train_status === "processing" ||
          (g.status === "ready" &&
            g.train_status === "empty" &&
            (g.num_looks ?? 0) >= 1)
      );
      return needsPolling ? 5000 : false;
    },
  });

  const avatarGroups: AvatarGroup[] = avatarGroupsResponse?.avatar_group_list ?? [];

  const { data: allLooksResponse, isLoading: isLoadingAllLooks } = useQuery<AllLooksResponse>({
    queryKey: ["/api/photo-avatars/all-looks"],
  });
  const allLooks: AvatarLook[] = allLooksResponse?.looks ?? [];

  const prevStatusesRef = useRef<Record<string, string>>({});
  const autoGeneratedLooksRef = useRef<Set<string>>(new Set());
  const autoTrainedRef = useRef<Set<string>>(new Set());
  const [lookGenerationStatus, setLookGenerationStatus] = useState<Record<string, {
    status: 'generating' | 'completed' | 'failed';
    progress: number;
    looks: Array<{ label: string; name: string }>;
  }>>({});

  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const debugEnabled = typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("debug") === "1";

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [showActivityPanel, setShowActivityPanel] = useState(true);
  const activityLogRef = useRef<HTMLDivElement>(null);

  const addActivityLog = (log: Omit<ActivityLog, 'id' | 'timestamp'>) => {
    const timestamp = new Date().toLocaleTimeString();
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setActivityLogs(prev => [...prev.slice(-30), { ...log, id, timestamp }]);
    setTimeout(() => {
      if (activityLogRef.current) {
        activityLogRef.current.scrollTop = activityLogRef.current.scrollHeight;
      }
    }, 100);
  };

  const addDebugLog = (log: Omit<DebugLog, 'timestamp'>) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev.slice(-50), { ...log, timestamp }]);
    console.log(`[DEBUG ${timestamp}]`, log);
  };

  // FULL AUTOMATION: Auto-train untrained avatars, then auto-generate looks when trained
  useEffect(() => {
    if (!avatarGroups || avatarGroups.length === 0) return;

    if (debugEnabled) {
      console.log("🔍 [AUTO-WORKFLOW] Checking", avatarGroups.length, "avatar groups:");
    }

    avatarGroups.forEach(async (group: AvatarGroup) => {
      const groupId = group.group_id;
      const currentTrainStatus = group.train_status;
      const previousTrainStatus = prevStatusesRef.current[groupId];
      const numLooks = group.num_looks ?? group.avatar_count ?? 0;
      const alreadyProcessedLooks = autoGeneratedLooksRef.current.has(groupId);
      const alreadyStartedTraining = autoTrainedRef.current.has(groupId);

      if (debugEnabled) {
        console.log(`  📦 "${group.name}" (${groupId.slice(0,8)}...):`, {
          trainStatus: currentTrainStatus,
          groupStatus: group.status,
          prevStatus: previousTrainStatus || 'none',
          numLooks,
          alreadyStartedTraining,
          alreadyProcessedLooks
        });
      }

      const isUploadProcessed = !group.status || group.status === "completed" || group.status === "ready";

      if (currentTrainStatus === "empty" && !alreadyStartedTraining && isUploadProcessed) {
        if (debugEnabled) {
          console.log(`    🎓 AUTO-TRAINING: Starting training for "${group.name}"...`);
        }
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
          if (debugEnabled) {
            console.log(`    ✅ Training request sent for "${group.name}"`);
          }

          addActivityLog({
            step: 'training_progress',
            message: 'Training in progress...',
            groupName: group.name,
            details: 'Please wait while HeyGen trains your avatar.'
          });

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

        prevStatusesRef.current[groupId] = currentTrainStatus;
        return;
      }

      const isTrainedStatus = currentTrainStatus === "ready" || currentTrainStatus === "completed";
      const wasNotTrained = previousTrainStatus !== "ready" && previousTrainStatus !== "completed";
      const trainingJustCompleted = previousTrainStatus && wasNotTrained && isTrainedStatus;
      const alreadyTrainedWithFewLooks = !previousTrainStatus && isTrainedStatus && numLooks < 3;

      const shouldAutoGenerate = (trainingJustCompleted || alreadyTrainedWithFewLooks) &&
                                  !alreadyProcessedLooks;

      if (debugEnabled) {
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
      }

      if (shouldAutoGenerate) {
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

        autoGeneratedLooksRef.current.add(groupId);
        autoTrainedRef.current.add(groupId);

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

          if (debugEnabled) {
            console.log("🎨 Auto-generating looks via proxy...");
          }

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

      if (currentTrainStatus) {
        prevStatusesRef.current[groupId] = currentTrainStatus;
      }
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
      }, 5000);

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
    onSuccess: (_data) => {
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

      if (groupId) {
        try {
          if (debugEnabled) {
            console.log(`🚀 Auto-starting training for group ${groupId}`);
          }

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

  const trainAllMutation = useMutation({
    mutationFn: async (voiceId: string) => {
      const pendingGroups = avatarGroups.filter(
        (g) => g.train_status === "empty" && (g.num_looks ?? 0) >= 1
      );

      const results = await Promise.allSettled(
        pendingGroups.map((group) =>
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
    onSuccess: () => {
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
    onSuccess: (_data: any, variables) => {
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

  // -----------------------------------------------------------------
  // Subscribe to v3 photo-avatar status updates (training, look ready,
  // consent change). The server broadcasts these from
  // server/routes/heygen-v3.ts; on receipt we invalidate the affected
  // queries so the UI refreshes without polling.
  // -----------------------------------------------------------------
  const { user } = useAuth();
  useWebSocket({
    userId: user?.id ? String(user.id) : undefined,
    autoConnect: !!user?.id,
    showToast: false,
    onMessage: (msg) => {
      if (msg.type !== "photo_avatar_status_update") return;
      const groupId = (msg.data as { groupId?: string } | undefined)?.groupId;
      queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/all-looks"] });
      if (groupId) {
        queryClient.invalidateQueries({
          queryKey: [`/api/photo-avatars/groups/${groupId}/photos`],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/v3/photo-avatars", groupId, "looks"],
        });
      }
    },
  });
  void setLocation;
  const [useLookPendingId, setUseLookPendingId] = useState<string | null>(null);

  const useLookForVideoMutation = useMutation({
    mutationFn: async (look: AvatarLook) => {
      setUseLookPendingId(look.id);
      const response = await apiRequest("POST", "/api/avatar-iv/use-look-image", {
        imageUrl: look.photoUrl,
        lookName: look.poseType || "AI Generated Look",
      });
      return response.json();
    },
    onSuccess: (_data: any) => {
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

    if (!consentAcknowledged) {
      toast({
        title: "Consent Required",
        description:
          "You must confirm you have permission to use this likeness before creating an avatar.",
        variant: "destructive",
      });
      return;
    }

    // Clear any prior shape-drift alert before re-attempting so the
    // retry button shows a clean state.
    setCreateShapeDrift(null);
    try {
      // Upload all photos and collect their HeyGen image_key + s3 url.
      // The v3 createAvatar call uses a single image key, so we send the
      // first one to HeyGen and remember the rest for context.
      const uploads: Array<{ imageKey: string; s3Url?: string; imageHash?: string }> = [];
      for (const file of uploadedFiles) {
        const result = await uploadPhotoMutation.mutateAsync(file);
        uploads.push({
          imageKey: result.imageKey,
          s3Url: result.s3Url,
          imageHash: result.imageHash,
        });
      }

      const primary = uploads[0];
      const response = await fetch("/api/v3/photo-avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: groupNameInput.trim(),
          imageKey: primary.imageKey,
          imageHash: primary.imageHash,
          s3ImageUrl: primary.s3Url,
          consentAcknowledged: true,
          consentVideoUrl: consentVideoUrl.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        // If HeyGen returned an unexpected response shape we attach
        // the parsed envelope to the thrown Error so the catch below
        // can surface endpoint + issuePaths in the destructive toast.
        const drift = tryParseShapeDriftBody(errBody);
        const e: Error & { shapeDrift?: HeygenShapeDriftDetails } = new Error(
          errBody?.message || errBody?.error || "Failed to create avatar group",
        );
        if (drift) e.shapeDrift = drift;
        throw e;
      }

      toast({
        title: "Avatar Group Created!",
        description: `Created "${groupNameInput.trim()}" via HeyGen v3. Consent recorded as pending — looks will appear shortly.`,
      });

      queryClient.invalidateQueries({
        queryKey: ["/api/photo-avatars/groups"],
      });
      setUploadedFiles([]);
      setGroupNameInput("");
      setConsentAcknowledged(false);
      setConsentVideoUrl("");
      setShowGroupNameDialog(false);
    } catch (error: unknown) {
      console.error("Upload error:", error);
      const drift = (error as { shapeDrift?: HeygenShapeDriftDetails })
        ?.shapeDrift;
      if (drift) {
        // Surface the drift as both a toast (immediate notice) and an
        // inline alert with a Retry button — the dialog stays open so
        // the user keeps their files / name / consent and can re-run
        // the create call without rebuilding the form.
        setCreateShapeDrift(drift);
        toast({
          ...shapeDriftToast(drift),
          variant: "destructive",
        });
        return;
      }
      const message =
        error instanceof Error
          ? error.message
          : "Failed to create avatar group. Please try again.";
      toast({
        title: "Upload Failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  // One-click retry for the create-avatar call after a HeyGen
  // shape-drift error. Reuses the existing handler so the user's
  // selected files, group name, and consent inputs are reused without
  // any extra work.
  const retryConfirmGroupName = async () => {
    setIsRetryingCreate(true);
    try {
      await handleConfirmGroupName();
    } finally {
      setIsRetryingCreate(false);
    }
  };

  // Wrap the dialog close handler so dismissing the dialog also
  // dismisses any lingering shape-drift alert.
  const closeGroupNameDialog = () => {
    setShowGroupNameDialog(false);
    setCreateShapeDrift(null);
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

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
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

      const startTime = Date.now();
      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setRecordingTime(elapsed);

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

  const getStepStyle = (step: ActivityLog['step']) => {
    switch (step) {
      case 'upload':
        return { icon: UploadIcon, color: 'text-blue-500', bg: 'bg-blue-50' };
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

  return {
    // tabs
    selectedTab, setSelectedTab,
    // upload
    uploadedFiles, setUploadedFiles,
    handleFileUpload, handleUploadFiles, handleConfirmGroupName,
    retryConfirmGroupName, closeGroupNameDialog,
    createShapeDrift, isRetryingCreate,
    showGroupNameDialog, setShowGroupNameDialog,
    groupNameInput, setGroupNameInput,
    // v3 consent + looks browser
    consentAcknowledged, setConsentAcknowledged,
    consentVideoUrl, setConsentVideoUrl,
    openLooksGroupId, setOpenLooksGroupId,
    // recording
    isRecording, recordedAudio, audioUrl, recordingTime,
    selectedGroupForVoice, setSelectedGroupForVoice,
    startRecording, stopRecording, playRecording, resetRecording, saveVoiceToGroup,
    // train all
    showTrainAllDialog, setShowTrainAllDialog,
    trainAllVoiceId, setTrainAllVoiceId,
    // edit dialog
    editDialogOpen, setEditDialogOpen,
    selectedGroupForEdit, setSelectedGroupForEdit,
    editPrompt, setEditPrompt,
    editOrientation, setEditOrientation,
    editPose, setEditPose,
    editStyle, setEditStyle,
    // photo gallery
    openGalleryGroupId, setOpenGalleryGroupId,
    // motion
    addMotionDialogOpen, setAddMotionDialogOpen,
    selectedAvatarForMotion, setSelectedAvatarForMotion,
    motionPrompt, setMotionPrompt,
    motionType, setMotionType,
    // generation form
    generationForm, setGenerationForm,
    // ai look
    aiLookDialogOpen, setAiLookDialogOpen,
    aiLookSource, setAiLookSource,
    aiLookFile, setAiLookFile,
    aiLookFilePreview, setAiLookFilePreview,
    aiLookName, setAiLookName,
    aiLookPrompt, setAiLookPrompt,
    aiLookOrientation, setAiLookOrientation,
    aiLookPose, setAiLookPose,
    aiLookStyle, setAiLookStyle,
    aiLookSelectedGroup, setAiLookSelectedGroup,
    aiLookGenerating,
    aiLookFileRef,
    handleAiLookGenerate,
    // queries
    avatarGroups, isLoadingGroups,
    allLooks, isLoadingAllLooks,
    // mutations
    generatePhotosMutation,
    uploadPhotoMutation,
    createGroupMutation,
    trainGroupMutation,
    trainAllMutation,
    addMotionMutation,
    generateLooksMutation,
    deleteGroupMutation,
    editLookMutation,
    useLookForVideoMutation,
    useLookPendingId,
    // logs
    debugLogs, setDebugLogs,
    showDebugPanel, setShowDebugPanel,
    debugEnabled,
    activityLogs, setActivityLogs,
    showActivityPanel, setShowActivityPanel,
    activityLogRef,
    lookGenerationStatus,
    // helpers
    getStatusColor,
    getStepStyle,
  };
}

export type PhotoAvatarManagerState = ReturnType<typeof usePhotoAvatarManager>;
