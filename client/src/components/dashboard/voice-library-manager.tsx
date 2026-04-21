import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Upload, Mic, Loader2, Check, CheckCircle, Clock, XCircle, Search, Sparkles, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

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
  } = useQuery<HeygenVoicesPage>({
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
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to load HeyGen voices");
      }
      return res.json();
    },
  });

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

  // Design voice mutation
  const designVoiceMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/v3/voices/design", {
        name: designName.trim(),
        description: designDescription.trim(),
        language: designLanguage !== "any" ? designLanguage : undefined,
        gender: designGender !== "any" ? designGender : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-voices"] });
      toast({
        title: "Voice Designed",
        description: "Your new voice was created and saved to your library.",
      });
      setDesignName("");
      setDesignDescription("");
      setDesignLanguage("any");
      setDesignGender("any");
    },
    onError: (error: Error) => {
      toast({
        title: "Design Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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

  const handleDesign = () => {
    if (!designName.trim()) {
      toast({ title: "Name Required", description: "Please enter a name for your designed voice", variant: "destructive" });
      return;
    }
    if (!designDescription.trim()) {
      toast({ title: "Description Required", description: "Describe the voice you want HeyGen to create", variant: "destructive" });
      return;
    }
    designVoiceMutation.mutate();
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
                <div className="text-center py-8 text-destructive text-sm" data-testid="text-browse-error">
                  {(browseError as Error)?.message ?? "Failed to load HeyGen voices."}
                </div>
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
              <Button
                onClick={handleDesign}
                disabled={designVoiceMutation.isPending || !designName.trim() || !designDescription.trim()}
                data-testid="button-design-voice"
              >
                {designVoiceMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Designing…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Design Voice
                  </>
                )}
              </Button>
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
                        <h4 className="font-medium" data-testid={`text-voice-name-${voice.id}`}>
                          {voice.name}
                        </h4>
                        {getStatusBadge(voice.status)}
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
