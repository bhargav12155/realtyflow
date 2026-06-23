import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/authToken";
import { Loader2, X, MapPin, Users, Sparkles, Camera, User } from "lucide-react";

interface UserPreferences {
  serviceArea?: string;
  communities?: string[];
  aiProvider?: string;
  agentPhotoUrl?: string;
  onboardingCompleted?: boolean;
}

const NEBRASKA_COMMUNITIES = [
  "Dundee",
  "Benson",
  "Aksarben",
  "Elkhorn",
  "Gretna",
  "Papillion",
  "Bellevue",
  "La Vista",
  "Bennington",
  "Westside",
];

function isNebraskaArea(area: string): boolean {
  if (!area) return false;
  const lower = area.toLowerCase();
  return lower.includes("nebraska") || lower.includes(", ne") || lower.endsWith(" ne") || lower === "ne";
}

export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  return { showOnboarding, setShowOnboarding };
}

interface OnboardingDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function OnboardingDialog({ open: controlledOpen, onOpenChange }: OnboardingDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [serviceArea, setServiceArea] = useState("");
  const [communities, setCommunities] = useState<string[]>([]);
  const [communityInput, setCommunityInput] = useState("");
  const [aiProvider, setAiProvider] = useState<string>("auto");
  const [agentPhotoUrl, setAgentPhotoUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange : setInternalOpen;

  const fetchPreferences = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

      const [prefRes, profileRes] = await Promise.all([
        fetch("/api/user/preferences", { method: "GET", headers, credentials: "include" }),
        fetch("/api/company/profile", { method: "GET", headers, credentials: "include" }),
      ]);

      let resolvedServiceArea = "";
      let shouldShow = false;

      if (prefRes.ok) {
        const data: UserPreferences = await prefRes.json();
        const dismissed = localStorage.getItem("onboarding_dismissed") === "true";
        if (!dismissed && (data.onboardingCompleted === false || !data.onboardingCompleted)) {
          shouldShow = true;
          if (data.serviceArea) resolvedServiceArea = data.serviceArea;
          if (data.communities) setCommunities(data.communities);
          if (data.aiProvider) setAiProvider(data.aiProvider);
          if (data.agentPhotoUrl) setAgentPhotoUrl(data.agentPhotoUrl);
        }
      } else if (prefRes.status === 404) {
        const dismissed = localStorage.getItem("onboarding_dismissed") === "true";
        if (!dismissed) shouldShow = true;
      }

      // Pre-populate service area from company profile if not set
      if (!resolvedServiceArea && profileRes.ok) {
        const profile = await profileRes.json();
        const city = profile?.city || "";
        const state = profile?.state || "";
        if (city && state) {
          resolvedServiceArea = `${city}, ${state}`;
        } else if (state) {
          resolvedServiceArea = state;
        } else if (city) {
          resolvedServiceArea = city;
        }
      }

      if (resolvedServiceArea) setServiceArea(resolvedServiceArea);
      if (shouldShow) setOpen?.(true);
    } catch (error) {
      console.error("Error fetching preferences:", error);
    } finally {
      setIsLoading(false);
    }
  }, [setOpen]);

  useEffect(() => {
    if (!isControlled) {
      fetchPreferences();
    }
  }, [fetchPreferences, isControlled]);

  const addCommunity = (community: string) => {
    const trimmed = community.trim();
    if (trimmed && !communities.includes(trimmed)) {
      setCommunities([...communities, trimmed]);
    }
    setCommunityInput("");
  };

  const removeCommunity = (community: string) => {
    setCommunities(communities.filter((c) => c !== community));
  };

  const handleCommunityInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const values = communityInput.split(",").map((v) => v.trim()).filter(Boolean);
      values.forEach(addCommunity);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload an image smaller than 50MB. Large images are auto-compressed.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const token = getAuthToken();
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/user/photo", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setAgentPhotoUrl(data.url);
        toast({
          title: "Photo Uploaded",
          description: "Your photo has been uploaded successfully.",
        });
      } else {
        throw new Error("Failed to upload photo");
      }
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload photo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const token = getAuthToken();
      if (!token) {
        toast({
          title: "Error",
          description: "You must be logged in to save preferences.",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          serviceArea,
          communities,
          aiProvider,
          agentPhotoUrl: agentPhotoUrl || undefined,
          onboardingCompleted: true,
        }),
      });

      if (response.ok) {
        toast({
          title: "Setup Complete!",
          description: "Your preferences have been saved successfully.",
        });
        setOpen?.(false);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to save preferences");
      }
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save preferences. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !isControlled) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) localStorage.setItem("onboarding_dismissed", "true");
      setOpen?.(val);
    }}>
      <DialogContent
        className="sm:max-w-[500px] bg-white dark:bg-gray-900"
        data-testid="dialog-onboarding"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-gray-900 dark:text-white">
            <Sparkles className="h-5 w-5 text-primary" />
            Welcome! Let's personalize your experience
          </DialogTitle>
          <DialogDescription className="text-gray-500 dark:text-gray-400">
            Set up your preferences to get the most out of the platform.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" />
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Your Photo (Optional)
              </label>
            </div>
            <div className="flex items-center gap-4">
              <div
                className="relative w-20 h-20 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-upload-photo"
              >
                {isUploadingPhoto ? (
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                ) : agentPhotoUrl ? (
                  <img
                    src={agentPhotoUrl}
                    alt="Agent photo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="h-8 w-8 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  data-testid="button-choose-photo"
                >
                  {isUploadingPhoto ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Uploading...
                    </>
                  ) : agentPhotoUrl ? (
                    "Change Photo"
                  ) : (
                    "Upload Photo"
                  )}
                </Button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Add your photo for video intros
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
                data-testid="input-photo-file"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Service Area
              </label>
            </div>
            <Input
              value={serviceArea}
              onChange={(e) => setServiceArea(e.target.value)}
              placeholder="e.g., Omaha, NE"
              className="bg-white dark:bg-gray-800"
              data-testid="input-service-area"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              What area do you primarily serve?
            </p>
          </div>

          {isNebraskaArea(serviceArea) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <label className="text-sm font-medium text-gray-900 dark:text-white">
                  Communities/Neighborhoods
                </label>
              </div>
              <Input
                value={communityInput}
                onChange={(e) => setCommunityInput(e.target.value)}
                onKeyDown={handleCommunityInputKeyDown}
                onBlur={() => {
                  if (communityInput.trim()) {
                    addCommunity(communityInput);
                  }
                }}
                placeholder="Type and press Enter to add"
                className="bg-white dark:bg-gray-800"
                data-testid="input-community"
              />

              {communities.length > 0 && (
                <div className="flex flex-wrap gap-2" data-testid="community-tags">
                  {communities.map((community) => (
                    <Badge
                      key={community}
                      variant="secondary"
                      className="flex items-center gap-1 px-2 py-1"
                    >
                      {community}
                      <button
                        type="button"
                        onClick={() => removeCommunity(community)}
                        className="ml-1 hover:text-destructive"
                        data-testid={`button-remove-community-${community}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Suggested communities:
                </p>
                <div className="flex flex-wrap gap-1">
                  {NEBRASKA_COMMUNITIES.filter(
                    (c) => !communities.includes(c)
                  ).map((community) => (
                    <Badge
                      key={community}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary/10 text-xs"
                      onClick={() => addCommunity(community)}
                      data-testid={`button-add-suggested-${community}`}
                    >
                      + {community}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSubmit}
            disabled={isSaving}
            className="min-w-[140px]"
            data-testid="button-complete-setup"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              "Complete Setup"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
