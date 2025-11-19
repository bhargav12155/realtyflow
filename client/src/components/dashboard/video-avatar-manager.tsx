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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Trash2,
  Video,
  XCircle,
} from "lucide-react";
import { useState } from "react";

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
}

export default function VideoAvatarManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [avatarName, setAvatarName] = useState("");
  const [trainingVideoUrl, setTrainingVideoUrl] = useState("");
  const [consentVideoUrl, setConsentVideoUrl] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [uploadingTraining, setUploadingTraining] = useState(false);
  const [uploadingConsent, setUploadingConsent] = useState(false);

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

  // Handle file upload to S3 (you'll need to implement this endpoint)
  const handleFileUpload = async (file: File, type: "training" | "consent") => {
    const setUploading =
      type === "training" ? setUploadingTraining : setUploadingConsent;
    const setUrl =
      type === "training" ? setTrainingVideoUrl : setConsentVideoUrl;

    try {
      setUploading(true);

      // Validate file
      if (!file.type.startsWith("video/")) {
        throw new Error("Please upload a video file");
      }

      if (type === "training" && file.size < 10 * 1024 * 1024) {
        // Less than 10MB
        toast({
          variant: "destructive",
          title: "Video Too Short",
          description:
            "Training footage should be at least 2 minutes long (typically 10MB+)",
        });
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

      const { url } = await res.json();
      setUrl(url);

      toast({
        title: "Upload Successful",
        description: `${
          type === "training" ? "Training" : "Consent"
        } video uploaded`,
      });
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

      <Alert className="bg-amber-50 border-amber-200">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-900">
          <strong>Enterprise Feature:</strong> This feature requires HeyGen
          Enterprise API access. Contact HeyGen support to enable Video Avatar
          API for your account.
        </AlertDescription>
      </Alert>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Requirements:</strong> Training footage must be 2+ minutes,
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
                    2+ minutes, 720p or higher, clear speaking footage
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="consentVideo">Consent Video *</Label>
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
              completeAvatars.map((avatar) => (
                <Card key={avatar.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {avatar.avatarName}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {new Date(avatar.createdAt).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      {getStatusBadge(avatar.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">
                          Avatar ID:
                        </span>
                        <p className="font-mono text-xs truncate">
                          {avatar.heygenAvatarId}
                        </p>
                      </div>
                      {avatar.voiceId && (
                        <div>
                          <span className="text-muted-foreground">
                            Voice ID:
                          </span>
                          <p className="font-mono text-xs truncate">
                            {avatar.voiceId}
                          </p>
                        </div>
                      )}
                      {avatar.completedAt && (
                        <div>
                          <span className="text-muted-foreground">
                            Completed:
                          </span>
                          <p className="text-xs">
                            {new Date(avatar.completedAt).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full mt-4"
                      onClick={() =>
                        deleteMutation.mutate(avatar.heygenAvatarId)
                      }
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-3 h-3 mr-2" />
                      Delete Avatar
                    </Button>
                  </CardContent>
                </Card>
              ))
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
    </div>
  );
}
