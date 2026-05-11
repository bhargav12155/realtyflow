import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Upload, Mic, Loader2, Check, CheckCircle, Clock, XCircle, Search, Sparkles, Plus, Pencil, X, AlertCircle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  HeygenShapeDriftAlert,
  type HeygenShapeDriftDetails,
  parseShapeDriftFromApiError,
  tryParseShapeDriftBody,
} from "@/components/dashboard/heygen-shape-drift-alert";

interface CustomVoice {
  id: string;
  userId: string;
  name: string;
  audioUrl: string;
  duration: number | null;
  fileSize: number | null;
  heygenAudioAssetId: string | null;
  heygenVoiceId: string | null;
  language: string | null;
  gender: string | null;
  sampleAudioUrl: string | null;
  status: 'pending' | 'ready' | 'failed';
  createdAt: string;
}

interface HeygenVoice {
  voice_id?: string;
  id?: string;
  name?: string;
  display_name?: string;
  language?: string;
  gender?: string;
  preview_audio?: string;
  preview_url?: string;
  sample_audio_url?: string;
}

interface HeygenVoicesPage {
  data: HeygenVoice[];
  nextCursor: string | null;
}

const LANGUAGES = [
  { value: "any", label: "Any language" },
  { value: "English", label: "English" },
  { value: "Spanish", label: "Spanish" },
  { value: "French", label: "French" },
  { value: "German", label: "German" },
  { value: "Italian", label: "Italian" },
  { value: "Portuguese", label: "Portuguese" },
  { value: "Japanese", label: "Japanese" },
  { value: "Chinese", label: "Chinese" },
  { value: "Korean", label: "Korean" },
];

const GENDERS = [
  { value: "any", label: "Any gender" },
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
];

function pickVoiceId(v: HeygenVoice): string {
  return v.voice_id ?? v.id ?? "";
}

function pickVoiceName(v: HeygenVoice): string {
  return v.display_name ?? v.name ?? pickVoiceId(v);
}

function pickPreview(v: HeygenVoice): string | undefined {
  return v.preview_audio ?? v.preview_url ?? v.sample_audio_url;
}

// Parse the `${status}: ${body}` string apiRequest throws on a non-2xx
// response, extracting the typed `error` code and `message` the
// HeyGen voice-design route returns. Falls back gracefully when the
// body isn't JSON (e.g. plain HTML 502 from a proxy).
function parseDesignError(err: unknown): { code: string | null; message: string } {
  if (!(err instanceof Error)) return { code: null, message: "Unknown error" };
  const m = err.message.match(/^(\d+):\s*([\s\S]*)$/);
  const rest = m ? m[2] : err.message;
  try {
    const body = JSON.parse(rest) as { error?: unknown; message?: unknown };
    return {
      code: typeof body.error === "string" ? body.error : null,
      message:
        typeof body.message === "string" && body.message ? body.message : err.message,
    };
  } catch {
    return { code: null, message: rest || err.message };
  }
}

// Map a typed HeyGen voice-design error code to friendly toast copy.
// Anything we don't have a mapping for falls back to the upstream
// message so we still tell the user *something* useful.
function friendlyDesignError(err: unknown): { title: string; description: string; code: string | null } {
  const { code, message } = parseDesignError(err);
  switch (code) {
    case "voice_design_rate_limited":
      return {
        code,
        title: "Too many requests",
        description:
          "HeyGen is rate-limiting voice design right now. Wait a moment and try again.",
      };
    case "voice_design_invalid_description":
      return {
        code,
        title: "Description not accepted",
        description:
          "HeyGen couldn't synthesise a voice from that description. Try rewording it — be more specific about tone, age, and accent, and avoid disallowed content.",
      };
    case "voice_design_quota_exceeded":
      return {
        code,
        title: "Voice quota reached",
        description:
          "You've hit HeyGen's voice quota. Delete an unused voice or upgrade your HeyGen plan to design more.",
      };
    case "voice_design_unauthorized":
      return {
        code,
        title: "HeyGen credentials rejected",
        description:
          "Our HeyGen API key was rejected. An operator needs to refresh it before voice design will work.",
      };
    case "voice_design_unavailable":
      return {
        code,
        title: "Voice designer unavailable",
        description:
          "HeyGen's voice designer is temporarily unavailable. Try again in a few minutes.",
      };
    default:
      return {
        code,
        title: "Voice design failed",
        description: message || "Something went wrong while designing your voice.",
      };
  }
}

export function VoiceLibraryManager() {
  const { toast } = useToast();
  const [voiceName, setVoiceName] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});

  // Browse tab state
  const [browseSearch, setBrowseSearch] = useState("");
  const [browseSearchInput, setBrowseSearchInput] = useState("");
  const [browseLanguage, setBrowseLanguage] = useState("any");
  const [browseGender, setBrowseGender] = useState("any");
  const [browseCursor, setBrowseCursor] = useState<string | undefined>(undefined);

  // Design tab state
  const [designName, setDesignName] = useState("");
  const [designDescription, setDesignDescription] = useState("");
  const [designLanguage, setDesignLanguage] = useState("any");
  const [designGender, setDesignGender] = useState("any");
  const [designPreview, setDesignPreview] = useState<{
    heygenVoiceId: string;
    previewUrl: string | null;
    language: string | null;
    gender: string | null;
  } | null>(null);
  // Inline error shown in the Design tab when the preview call fails.
  // Surfaced *next to the form* so the user keeps their description /
  // name / language / gender selections and can retry without re-typing.
  const [designPreviewError, setDesignPreviewError] = useState<
    { title: string; description: string; code: string | null } | null
  >(null);
  // Held separately so the dedicated shape-drift alert (with copy
  // button + endpoint/issuePaths) can render in place of the friendly
  // retry block when HeyGen sends back a payload that doesn't match
  // our zod schema.
  const [designShapeDrift, setDesignShapeDrift] =
    useState<HeygenShapeDriftDetails | null>(null);

  // Fetch custom voices
  const { data: voices = [], isLoading } = useQuery<CustomVoice[]>({
    queryKey: ["/api/custom-voices"],
  });

  // Fetch audio blobs with credentials and create blob URLs
  useEffect(() => {
    if (voices.length === 0) return;

    const fetchAudioUrls = async () => {
      const urls: Record<string, string> = {};

      for (const voice of voices) {
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

      setAudioUrls(urls);
    };

    fetchAudioUrls();

    return () => {
      Object.values(audioUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [voices]);

  // Browse: list HeyGen voices
  const browseQueryKey = [
    "/api/v3/voices",
    {
      search: browseSearch || undefined,
      language: browseLanguage !== "any" ? browseLanguage : undefined,
      gender: browseGender !== "any" ? browseGender : undefined,
      cursor: browseCursor,
    },
  ] as const;

  const {
    data: browsePage,
    isLoading: isBrowseLoading,
    isError: isBrowseError,
    error: browseError,
    refetch: refetchBrowse,
    isFetching: isBrowseFetching,
  } = useQuery<HeygenVoicesPage, Error & { shapeDrift?: HeygenShapeDriftDetails }>({
    queryKey: browseQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (browseSearch) params.set("search", browseSearch);
      if (browseLanguage !== "any") params.set("language", browseLanguage);
      if (browseGender !== "any") params.set("gender", browseGender);
      if (browseCursor) params.set("cursor", browseCursor);
      const qs = params.toString();
      const res = await fetch(`/api/v3/voices${qs ? `?${qs}` : ""}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const drift = tryParseShapeDriftBody(body);
        const message =
          (body as { message?: string } | null)?.message ||
          "Failed to load HeyGen voices";
        const err: Error & { shapeDrift?: HeygenShapeDriftDetails } = new Error(
          message,
        );
        if (drift) err.shapeDrift = drift;
        throw err;
      }
      return res.json();
    },
  });
  const browseShapeDrift = (browseError as
    | (Error & { shapeDrift?: HeygenShapeDriftDetails })
    | null
    | undefined)?.shapeDrift;

  // Upload voice mutation
  const uploadVoiceMutation = useMutation({
    mutationFn: async (data: { name: string; file: File }) => {
      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("audio", data.file);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-voices"] });
      toast({
        title: "Voice Saved",
        description: "Your custom voice has been saved successfully.",
      });
      setVoiceName("");
      setAudioFile(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Use HeyGen voice mutation
  const useVoiceMutation = useMutation({
    mutationFn: async (v: HeygenVoice) => {
      return apiRequest("POST", "/api/v3/voices/use", {
        heygenVoiceId: pickVoiceId(v),
        name: pickVoiceName(v),
        language: v.language ?? null,
        gender: v.gender ?? null,
        sampleAudioUrl: pickPreview(v) ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-voices"] });
      toast({
        title: "Voice Added",
        description: "The HeyGen voice was added to your library.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Add Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Preview-only design call: synthesises a HeyGen voice but does not
  // persist it. The resulting preview is stashed in `designPreview` so
  // the user can listen and decide whether to keep it.
  const previewDesignMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/v3/voices/design", {
        description: designDescription.trim(),
        language: designLanguage !== "any" ? designLanguage : undefined,
        gender: designGender !== "any" ? designGender : undefined,
        save: false,
      });
      return (await res.json()) as {
        preview: {
          heygenVoiceId: string;
          previewUrl: string | null;
          language: string | null;
          gender: string | null;
        };
      };
    },
    onSuccess: (data) => {
      setDesignPreview(data.preview);
      setDesignPreviewError(null);
      setDesignShapeDrift(null);
      toast({
        title: "Preview Ready",
        description: "Listen to your designed voice and save it if you like it.",
      });
    },
    onError: (error: Error) => {
      // If HeyGen returned a payload that didn't match our schema we
      // surface the dedicated shape-drift alert (with endpoint +
      // issuePaths) instead of the friendly retry block.
      const drift = parseShapeDriftFromApiError(error);
      if (drift) {
        setDesignShapeDrift(drift);
        setDesignPreviewError(null);
        toast({
          title: "HeyGen returned an unexpected response shape",
          description: drift.message,
          variant: "destructive",
        });
        return;
      }
      const friendly = friendlyDesignError(error);
      // Mirror the friendly copy into both the toast and the inline
      // retry block. The inline block is what the user keeps looking at
      // after the toast disappears, and it carries the retry button so
      // they don't have to re-fill the form.
      setDesignPreviewError(friendly);
      setDesignShapeDrift(null);
      toast({
        title: friendly.title,
        description: friendly.description,
        variant: "destructive",
      });
    },
  });

  // Save the previewed voice into the user's library. We pass the
  // preview's heygenVoiceId back to the server so it persists exactly
  // the voice the user listened to instead of synthesising a new one.
  const savePreviewMutation = useMutation({
    mutationFn: async () => {
      if (!designPreview) throw new Error("Generate a preview first");
      return apiRequest("POST", "/api/v3/voices/design", {
        name: designName.trim(),
        previewVoiceId: designPreview.heygenVoiceId,
        previewUrl: designPreview.previewUrl ?? undefined,
        language: designLanguage !== "any" ? designLanguage : undefined,
        gender: designGender !== "any" ? designGender : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-voices"] });
      toast({
        title: "Voice Saved",
        description: "Your designed voice was added to your library.",
      });
      setDesignName("");
      setDesignDescription("");
      setDesignLanguage("any");
      setDesignGender("any");
      setDesignPreview(null);
    },
    onError: (error: Error) => {
      const friendly = friendlyDesignError(error);
      toast({
        title: friendly.title === "Voice design failed" ? "Save Failed" : friendly.title,
        description: friendly.description,
        variant: "destructive",
      });
    },
  });

  // Rename voice state + mutation
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const renameVoiceMutation = useMutation({
    mutationFn: async (data: { id: string; name: string }) => {
      return apiRequest("PATCH", `/api/custom-voices/${data.id}`, { name: data.name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-voices"] });
      toast({
        title: "Voice Renamed",
        description: "The voice name has been updated.",
      });
      setRenamingId(null);
      setRenameDraft("");
    },
    onError: (error: Error) => {
      toast({
        title: "Rename Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const startRename = (voice: CustomVoice) => {
    setRenamingId(voice.id);
    setRenameDraft(voice.name);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameDraft("");
  };

  const submitRename = (voiceId: string) => {
    const trimmed = renameDraft.trim();
    if (!trimmed) {
      toast({ title: "Name Required", description: "Voice name cannot be empty", variant: "destructive" });
      return;
    }
    if (trimmed.length > 100) {
      toast({ title: "Name Too Long", description: "Voice name must be 100 characters or fewer", variant: "destructive" });
      return;
    }
    renameVoiceMutation.mutate({ id: voiceId, name: trimmed });
  };

  // Delete voice mutation
  const deleteVoiceMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/custom-voices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-voices"] });
      toast({
        title: "Voice Deleted",
        description: "Custom voice has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid File Format",
          description: "HeyGen only supports WAV and MP3 files. Please convert your audio file first.",
          variant: "destructive",
        });
        return;
      }
      setAudioFile(file);
    }
  };

  const handleUpload = () => {
    if (!voiceName.trim()) {
      toast({ title: "Name Required", description: "Please enter a name for your voice", variant: "destructive" });
      return;
    }
    if (!audioFile) {
      toast({ title: "File Required", description: "Please select an audio file", variant: "destructive" });
      return;
    }
    uploadVoiceMutation.mutate({ name: voiceName.trim(), file: audioFile });
  };

  const handlePreviewDesign = () => {
    if (!designDescription.trim()) {
      toast({ title: "Description Required", description: "Describe the voice you want HeyGen to create", variant: "destructive" });
      return;
    }
    previewDesignMutation.mutate();
  };

  const handleSavePreview = () => {
    if (!designName.trim()) {
      toast({ title: "Name Required", description: "Please enter a name before saving the voice", variant: "destructive" });
      return;
    }
    savePreviewMutation.mutate();
  };

  const handleTryAgain = () => {
    setDesignPreview(null);
    setDesignPreviewError(null);
  };

  const handleRetryPreview = () => {
    setDesignPreviewError(null);
    previewDesignMutation.mutate();
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "Unknown";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusBadge = (status: string | undefined | null) => {
    if (!status || status === 'ready') {
      return (
        <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white">
          <CheckCircle className="h-3 w-3 mr-1" />
          Ready for Video
        </Badge>
      );
    }
    switch (status) {
      case 'pending':
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1 animate-pulse" />
            Processing...
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Upload Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  const submitBrowseSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setBrowseCursor(undefined);
    setBrowseSearch(browseSearchInput.trim());
  };

  const browseVoices = browsePage?.data ?? [];

  return (
    <div className="space-y-6">
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-xl" data-testid="tabs-voice-library">
          <TabsTrigger value="upload" data-testid="tab-voice-upload">
            <Mic className="h-4 w-4 mr-2" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="browse" data-testid="tab-voice-browse">
            <Search className="h-4 w-4 mr-2" />
            Browse
          </TabsTrigger>
          <TabsTrigger value="design" data-testid="tab-voice-design">
            <Sparkles className="h-4 w-4 mr-2" />
            Design
          </TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload" className="mt-4">
          <Card data-testid="card-voice-upload">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Add Custom Voice
              </CardTitle>
              <CardDescription>
                Upload an audio recording of your voice to use in video generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="voice-name">Voice Name</Label>
                <Input
                  id="voice-name"
                  data-testid="input-voice-name"
                  placeholder="e.g., My Professional Voice"
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="voice-file">Audio File</Label>
                <div className="flex gap-2">
                  <Input
                    id="voice-file"
                    data-testid="input-voice-file"
                    type="file"
                    accept=".wav,.mp3,audio/wav,audio/x-wav,audio/mpeg,audio/mp3"
                    onChange={handleFileChange}
                  />
                  {audioFile && (
                    <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                      <Check className="h-4 w-4 mr-1" />
                      {audioFile.name}
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Supported formats: WAV, MP3 only
                </p>
              </div>

              <Button
                data-testid="button-upload-voice"
                onClick={handleUpload}
                disabled={uploadVoiceMutation.isPending || !voiceName.trim() || !audioFile}
              >
                {uploadVoiceMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Save Voice
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Browse Tab */}
        <TabsContent value="browse" className="mt-4">
          <Card data-testid="card-voice-browse">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Browse HeyGen Voices
              </CardTitle>
              <CardDescription>
                Search the full HeyGen catalogue and add a voice to your library.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={submitBrowseSearch} className="grid gap-3 md:grid-cols-4">
                <Input
                  placeholder="Search by name…"
                  value={browseSearchInput}
                  onChange={(e) => setBrowseSearchInput(e.target.value)}
                  data-testid="input-browse-search"
                  className="md:col-span-2"
                />
                <Select
                  value={browseLanguage}
                  onValueChange={(v) => {
                    setBrowseLanguage(v);
                    setBrowseCursor(undefined);
                  }}
                >
                  <SelectTrigger data-testid="select-browse-language">
                    <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value} data-testid={`option-browse-language-${l.value}`}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={browseGender}
                  onValueChange={(v) => {
                    setBrowseGender(v);
                    setBrowseCursor(undefined);
                  }}
                >
                  <SelectTrigger data-testid="select-browse-gender">
                    <SelectValue placeholder="Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((g) => (
                      <SelectItem key={g.value} value={g.value} data-testid={`option-browse-gender-${g.value}`}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="submit" className="md:col-span-4" data-testid="button-browse-search">
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </form>

              {isBrowseLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : isBrowseError ? (
                browseShapeDrift ? (
                  <HeygenShapeDriftAlert
                    details={browseShapeDrift}
                    scope="voices-browse"
                    action="loading HeyGen voices"
                    onRetry={() => {
                      void refetchBrowse();
                    }}
                    isRetrying={isBrowseFetching}
                  />
                ) : (
                  <div className="text-center py-8 text-destructive text-sm" data-testid="text-browse-error">
                    {(browseError as Error)?.message ?? "Failed to load HeyGen voices."}
                  </div>
                )
              ) : browseVoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-browse-empty">
                  No voices match those filters.
                </div>
              ) : (
                <div className="space-y-2">
                  {browseVoices.map((v) => {
                    const id = pickVoiceId(v);
                    const preview = pickPreview(v);
                    return (
                      <div
                        key={id || pickVoiceName(v)}
                        className="flex flex-wrap items-center justify-between gap-3 p-3 border rounded-lg"
                        data-testid={`browse-voice-${id}`}
                      >
                        <div className="flex-1 min-w-[180px]">
                          <div className="font-medium" data-testid={`text-browse-voice-name-${id}`}>
                            {pickVoiceName(v)}
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-1">
                            {v.language && <span>{v.language}</span>}
                            {v.gender && <span>{v.gender}</span>}
                          </div>
                        </div>
                        {preview && (
                          <audio
                            controls
                            src={preview}
                            className="h-9"
                            data-testid={`audio-browse-preview-${id}`}
                          />
                        )}
                        <Button
                          size="sm"
                          onClick={() => useVoiceMutation.mutate(v)}
                          disabled={useVoiceMutation.isPending || !id}
                          data-testid={`button-use-voice-${id}`}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Use this voice
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-between pt-2">
                <div className="text-xs text-muted-foreground">
                  {browsePage?.nextCursor ? "More results available" : null}
                </div>
                <div className="flex gap-2">
                  {browseCursor && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBrowseCursor(undefined)}
                      data-testid="button-browse-reset"
                    >
                      First page
                    </Button>
                  )}
                  {browsePage?.nextCursor && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBrowseCursor(browsePage.nextCursor ?? undefined)}
                      data-testid="button-browse-next"
                    >
                      Next page
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Design Tab */}
        <TabsContent value="design" className="mt-4">
          <Card data-testid="card-voice-design">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Design a New Voice
              </CardTitle>
              <CardDescription>
                Describe the voice you want and HeyGen will synthesise a brand-new one for you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="design-name">Voice Name</Label>
                <Input
                  id="design-name"
                  data-testid="input-design-name"
                  placeholder="e.g., Warm Narrator"
                  value={designName}
                  onChange={(e) => setDesignName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="design-description">Description</Label>
                <Textarea
                  id="design-description"
                  data-testid="textarea-design-description"
                  placeholder="A calm middle-aged woman with a warm, slightly raspy storyteller's voice…"
                  rows={4}
                  value={designDescription}
                  onChange={(e) => setDesignDescription(e.target.value)}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select value={designLanguage} onValueChange={setDesignLanguage}>
                    <SelectTrigger data-testid="select-design-language">
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l.value} value={l.value} data-testid={`option-design-language-${l.value}`}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select value={designGender} onValueChange={setDesignGender}>
                    <SelectTrigger data-testid="select-design-gender">
                      <SelectValue placeholder="Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((g) => (
                        <SelectItem key={g.value} value={g.value} data-testid={`option-design-gender-${g.value}`}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {!designPreview ? (
                <div className="space-y-3">
                  <Button
                    onClick={handlePreviewDesign}
                    disabled={previewDesignMutation.isPending || !designDescription.trim()}
                    data-testid="button-preview-design-voice"
                  >
                    {previewDesignMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating preview…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Preview Voice
                      </>
                    )}
                  </Button>
                  {designShapeDrift && (
                    <HeygenShapeDriftAlert
                      details={designShapeDrift}
                      scope="voice-design"
                      action="designing your voice"
                    />
                  )}
                  {designPreviewError && !designShapeDrift && (
                    <div
                      className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-3"
                      data-testid="card-design-preview-error"
                      role="alert"
                    >
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
                        <div className="space-y-1">
                          <div
                            className="text-sm font-medium text-destructive"
                            data-testid="text-design-preview-error-title"
                          >
                            {designPreviewError.title}
                          </div>
                          <div
                            className="text-sm text-destructive/90"
                            data-testid="text-design-preview-error-message"
                          >
                            {designPreviewError.description}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRetryPreview}
                        disabled={previewDesignMutation.isPending}
                        data-testid="button-retry-design-preview"
                      >
                        {previewDesignMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Retrying…
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Retry
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="space-y-3 rounded-lg border p-4"
                  data-testid="card-design-preview"
                >
                  <div className="text-sm font-medium">Preview</div>
                  {designPreview.previewUrl ? (
                    <audio
                      controls
                      className="w-full"
                      src={designPreview.previewUrl}
                      data-testid="audio-design-preview"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      HeyGen did not return a preview clip for this voice.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={handleSavePreview}
                      disabled={savePreviewMutation.isPending || !designName.trim()}
                      data-testid="button-save-design-voice"
                    >
                      {savePreviewMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Save to library
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleTryAgain}
                      disabled={savePreviewMutation.isPending || previewDesignMutation.isPending}
                      data-testid="button-try-again-design-voice"
                    >
                      Try again
                    </Button>
                  </div>
                  {!designName.trim() && (
                    <p className="text-xs text-muted-foreground">
                      Add a name above before saving this voice to your library.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Voices List */}
      <Card data-testid="card-voices-list">
        <CardHeader>
          <CardTitle>Your Custom Voices</CardTitle>
          <CardDescription>
            {voices.length} {voices.length === 1 ? "voice" : "voices"} saved
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : voices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mic className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No custom voices yet</p>
              <p className="text-sm">Upload, browse, or design a voice to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {voices.map((voice) => {
                const previewSrc = audioUrls[voice.id] || voice.sampleAudioUrl || undefined;
                return (
                  <div
                    key={voice.id}
                    data-testid={`voice-item-${voice.id}`}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {renamingId === voice.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              value={renameDraft}
                              onChange={(e) => setRenameDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  submitRename(voice.id);
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  cancelRename();
                                }
                              }}
                              autoFocus
                              maxLength={100}
                              className="h-8 max-w-xs"
                              data-testid={`input-rename-voice-${voice.id}`}
                            />
                            <Button
                              size="sm"
                              variant="default"
                              className="h-8"
                              onClick={() => submitRename(voice.id)}
                              disabled={renameVoiceMutation.isPending}
                              data-testid={`button-save-rename-${voice.id}`}
                            >
                              {renameVoiceMutation.isPending && renameVoiceMutation.variables?.id === voice.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8"
                              onClick={cancelRename}
                              disabled={renameVoiceMutation.isPending}
                              data-testid={`button-cancel-rename-${voice.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <h4 className="font-medium" data-testid={`text-voice-name-${voice.id}`}>
                              {voice.name}
                            </h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => startRename(voice)}
                              disabled={renameVoiceMutation.isPending}
                              data-testid={`button-rename-voice-${voice.id}`}
                              aria-label="Rename voice"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {getStatusBadge(voice.status)}
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-1">
                        {voice.fileSize !== null && voice.fileSize !== undefined && (
                          <span>Size: {formatFileSize(voice.fileSize)}</span>
                        )}
                        {voice.duration && <span>Duration: {formatDuration(voice.duration)}</span>}
                        {voice.language && <span>{voice.language}</span>}
                        {voice.gender && <span>{voice.gender}</span>}
                        <span>Added: {new Date(voice.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {previewSrc ? (
                        <audio
                          controls
                          className="h-10"
                          data-testid={`audio-player-${voice.id}`}
                          src={previewSrc}
                        />
                      ) : (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Loading audio...
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`button-delete-voice-${voice.id}`}
                        onClick={() => deleteVoiceMutation.mutate(voice.id)}
                        disabled={deleteVoiceMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
