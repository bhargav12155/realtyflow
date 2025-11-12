// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Upload,
  Camera,
  Users,
  Sparkles,
  Loader2,
  Check,
  X,
  AlertCircle,
  Image,
  UserPlus,
  Wand2,
  Mic,
  MicOff,
  Play,
  RotateCcw,
  Edit,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AvatarPhotoGallery } from "./avatar-photo-gallery";
import { VoiceLibraryManager } from "./voice-library-manager";

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

  // Query avatar groups
  const { data: avatarGroupsResponse, isLoading: isLoadingGroups } = useQuery({
    queryKey: ["/api/photo-avatars/groups"],
    refetchInterval: (data) => {
      // Refetch every 5 seconds if any group is processing
      if (!data || !data.avatar_group_list) return false;
      const hasProcessing = data.avatar_group_list.some(
        (g: any) => g.train_status === "processing"
      );
      return hasProcessing ? 5000 : false;
    },
  });

  // Extract avatar groups array from response
  const avatarGroups = avatarGroupsResponse?.avatar_group_list || [];

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
    onSuccess: (data) => {
      toast({
        title: "Photo Generation Started",
        description: `Generating 5 AI photos for ${generationForm.name}. This may take a few minutes.`,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/photo-avatars/groups"],
      });
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
      toast({
        title: "Photo Uploaded",
        description:
          "Photo uploaded successfully. You can now create an avatar group.",
      });
    },
    onError: () => {
      toast({
        title: "Upload Failed",
        description: "Failed to upload photo. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create avatar group
  const createGroupMutation = useMutation({
    mutationFn: ({ name, imageKey }: { name: string; imageKey: string }) =>
      apiRequest("POST", "/api/photo-avatars/groups", { name, imageKey }),
    onSuccess: () => {
      toast({
        title: "Avatar Group Created",
        description: "Avatar group has been created successfully.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/photo-avatars/groups"],
      });
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

  // Generate new looks
  const generateLooksMutation = useMutation({
    mutationFn: ({
      groupId,
      numLooks,
    }: {
      groupId: string;
      numLooks: number;
    }) =>
      apiRequest(
        "POST",
        `/api/photo-avatars/groups/${groupId}/generate-looks`,
        { numLooks }
      ),
    onSuccess: () => {
      toast({
        title: "Generating New Looks",
        description: "New avatar looks are being generated.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/photo-avatars/groups"],
      });
    },
    onError: (error: Error) => {
      const errorMessage = error.message.toLowerCase();
      const isModelNotFound =
        errorMessage.includes("model not found") ||
        errorMessage.includes("404") ||
        errorMessage.includes("400");

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

  // Edit look mutation
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
      apiRequest("POST", `/api/photo-avatars/groups/${groupId}/edit-look`, {
        prompt,
        orientation,
        pose,
        style,
      }),
    onSuccess: () => {
      toast({
        title: "Generating New Look",
        description:
          "Your custom look is being generated based on your description.",
      });
      setEditDialogOpen(false);
      setEditPrompt("");
      setEditOrientation("square");
      setEditPose("half_body");
      setEditStyle("Realistic");
      queryClient.invalidateQueries({
        queryKey: ["/api/photo-avatars/groups"],
      });
    },
    onError: (error: Error) => {
      const errorMessage = error.message.toLowerCase();
      const isModelNotFound =
        errorMessage.includes("model not found") ||
        errorMessage.includes("400");

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles(files);
  };

  const handleUploadFiles = async () => {
    try {
      // Upload all photos and collect their keys
      const uploadedKeys: string[] = [];
      for (const file of uploadedFiles) {
        const result = await uploadPhotoMutation.mutateAsync(file);
        uploadedKeys.push(result.imageKey);
      }

      // Ask for avatar group name
      const groupName = prompt("Enter a name for this avatar group:");
      if (!groupName) {
        toast({
          title: "Upload Cancelled",
          description: "Please provide a name for your avatar group.",
          variant: "destructive",
        });
        return;
      }

      // Create avatar group with uploaded photos
      const response = await fetch("/api/photo-avatars/create-from-uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName,
          imageKeys: uploadedKeys,
        }),
      });

      if (!response.ok) throw new Error("Failed to create avatar group");

      toast({
        title: "Avatar Group Created!",
        description: `Created "${groupName}" with ${uploadedKeys.length} photos. Training will start automatically.`,
      });

      queryClient.invalidateQueries({
        queryKey: ["/api/photo-avatars/groups"],
      });
      setUploadedFiles([]);
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
  const startRecording = async () => {
    try {
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
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast({
        title: "Recording Failed",
        description:
          "Could not access microphone. Please check your permissions.",
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

  return (
    <Card data-testid="card-photo-avatar-manager">
      <CardHeader>
        <CardTitle>Photo Avatar Groups</CardTitle>
        <CardDescription>
          Create and manage AI-powered avatar groups from photos for
          personalized video content
        </CardDescription>
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
              Upload Photos
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
                    <div
                      key={group.group_id}
                      id={`avatar-group-${group.group_id}`}
                      className="scroll-mt-24"
                    >
                      <AvatarPhotoGallery groupId={group.group_id} />
                    </div>
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

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
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
                <span className="text-sm text-gray-600">
                  Click to upload photos
                </span>
                <span className="text-xs text-gray-500 mt-1">
                  PNG, JPG up to 10MB each
                </span>
              </label>
            </div>

            {uploadedFiles.length > 0 && (
              <>
                <div className="space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <span className="text-sm">{file.name}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setUploadedFiles((files) =>
                            files.filter((_, i) => i !== index)
                          )
                        }
                        data-testid={`button-remove-${index}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={handleUploadFiles}
                  disabled={uploadPhotoMutation.isPending}
                  className="w-full"
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
                      {uploadedFiles.length > 1 ? "s" : ""}
                    </>
                  )}
                </Button>
              </>
            )}

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
                        .filter((g: AvatarGroup) => g.status === "ready")
                        .map((group: AvatarGroup) => (
                          <SelectItem
                            key={group.group_id}
                            value={group.group_id}
                          >
                            {group.name}
                          </SelectItem>
                        ))}
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

                {Array.isArray(avatarGroups) &&
                  avatarGroups.map((group: AvatarGroup) => (
                    <Card
                      key={group.group_id}
                      className="overflow-hidden border-2 border-[#D4AF37]/20"
                      data-testid={`card-group-${group.group_id}`}
                    >
                      <CardHeader className="bg-gradient-to-r from-[#D4AF37]/5 to-[#B8860B]/5 border-b border-[#D4AF37]/20">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-xl font-playfair">
                              {group.name}
                            </CardTitle>
                            <CardDescription>
                              Created:{" "}
                              {new Date(group.created_at).toLocaleDateString()}
                              {group.avatar_count &&
                                ` • ${group.avatar_count} photos`}
                            </CardDescription>
                          </div>
                          <Badge
                            className={`${getStatusColor(
                              group.status
                            )} text-white`}
                          >
                            {group.status}
                          </Badge>
                        </div>
                      </CardHeader>

                      <CardContent className="p-6 space-y-4">
                        {/* Training Progress and Gallery */}
                        <div className="space-y-4">
                          {/* Training Progress */}
                          {group.status === "processing" &&
                            group.training_progress && (
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="font-medium">
                                    Training Progress
                                  </span>
                                  <span className="text-[#D4AF37] font-semibold">
                                    {group.training_progress}%
                                  </span>
                                </div>
                                <Progress
                                  value={group.training_progress}
                                  className="h-2"
                                />
                                <p className="text-xs text-gray-500">
                                  Creating your custom avatar model...
                                </p>
                              </div>
                            )}

                          {/* Photo Gallery Component */}
                          <AvatarPhotoGallery groupId={group.group_id} />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-2 border-t border-gray-200">
                          {group.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={() =>
                                trainGroupMutation.mutate({
                                  groupId: group.group_id,
                                })
                              }
                              disabled={trainGroupMutation.isPending}
                              data-testid={`button-train-${group.group_id}`}
                              className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110"
                            >
                              <UserPlus className="w-4 h-4 mr-2" />
                              Start Training
                            </Button>
                          )}

                          {group.status === "ready" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() =>
                                  generateLooksMutation.mutate({
                                    groupId: group.group_id,
                                    numLooks: 3,
                                  })
                                }
                                disabled={generateLooksMutation.isPending}
                                data-testid={`button-looks-${group.group_id}`}
                                className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110"
                              >
                                <Wand2 className="w-4 h-4 mr-2" />
                                Generate New Looks
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedGroupForEdit(group);
                                  setEditDialogOpen(true);
                                }}
                                data-testid={`button-edit-look-${group.group_id}`}
                                className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10"
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Look
                              </Button>
                            </>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              deleteGroupMutation.mutate(group.group_id)
                            }
                            disabled={deleteGroupMutation.isPending}
                            data-testid={`button-delete-${group.group_id}`}
                            className="ml-auto border-red-300 text-red-600 hover:bg-red-50"
                          >
                            <X className="w-4 h-4 mr-1" />
                            Delete Group
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
              <Edit className="h-5 w-5 text-[#D4AF37]" />
              Edit Avatar Look
            </DialogTitle>
            <DialogDescription>
              Describe the edits you'd like to make to this avatar look. Be
              specific about changes to appearance, clothing, background, or
              style.
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
              <Label htmlFor="edit-prompt">
                Describe the edits you'd like to make
              </Label>
              <Textarea
                id="edit-prompt"
                placeholder="Example: professional business suit, office background, confident expression..."
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
                  Generate New Look
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
