import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Upload, Mic, Loader2, Check, CheckCircle, Clock, XCircle } from "lucide-react";
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
  status: 'pending' | 'ready' | 'failed';
  createdAt: string;
}

export function VoiceLibraryManager() {
  const { toast } = useToast();
  const [voiceName, setVoiceName] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});

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

    // Cleanup blob URLs when component unmounts or voices change
    return () => {
      Object.values(audioUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [voices]);

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

  // Delete voice mutation
  const deleteVoiceMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/custom-voices/${id}`, {
        method: "DELETE",
      });
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
      // Validate file type - only WAV and MP3 are supported by HeyGen
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
      toast({
        title: "Name Required",
        description: "Please enter a name for your voice",
        variant: "destructive",
      });
      return;
    }

    if (!audioFile) {
      toast({
        title: "File Required",
        description: "Please select an audio file",
        variant: "destructive",
      });
      return;
    }

    uploadVoiceMutation.mutate({
      name: voiceName.trim(),
      file: audioFile,
    });
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
    // Treat missing status as ready (legacy voices or voices uploaded before HeyGen integration)
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

  return (
    <div className="space-y-6">
      {/* Upload Section */}
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
              <p className="text-sm">Upload an audio file to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {voices.map((voice) => (
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
                    <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                      <span>Size: {formatFileSize(voice.fileSize)}</span>
                      {voice.duration && <span>Duration: {formatDuration(voice.duration)}</span>}
                      <span>
                        Added: {new Date(voice.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {audioUrls[voice.id] ? (
                      <audio
                        controls
                        className="h-10"
                        data-testid={`audio-player-${voice.id}`}
                        src={audioUrls[voice.id]}
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
