import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Facebook,
  Instagram,
  Music,
  Twitter,
  Youtube,
  Linkedin,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SocialKeysOnboardingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function SocialKeysOnboarding({
  open,
  onOpenChange,
  onSaved,
}: SocialKeysOnboardingProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("facebook");
  const [keys, setKeys] = useState({
    facebookAppId: "",
    facebookAppSecret: "",
    instagramToken: "",
    instagramBusinessAccountId: "",
    tiktokApiKey: "",
    tiktokApiSecret: "",
    tiktokAccessToken: "",
    twitterApiKey: "",
    twitterApiSecret: "",
    twitterAccessToken: "",
    twitterAccessTokenSecret: "",
    twitterBearerToken: "",
    youtubeApiKey: "",
    youtubeChannelId: "",
    linkedinAccessToken: "",
    linkedinOrganizationId: "",
  });

  const handleSave = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/user/social-api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(keys),
      });

      if (!response.ok) {
        throw new Error("Failed to save keys");
      }

      const data = await response.json();

      toast({
        title: "Success",
        description: data.configured
          ? "Your social media keys have been saved!"
          : "API keys saved. You can still use the app without social features.",
      });

      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving keys:", error);
      toast({
        title: "Error",
        description: "Failed to save API keys. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setKeys((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const isAnyKeyConfigured = Object.values(keys).some(
    (value) => value && value.trim() !== ""
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Setup Social Media Integration</DialogTitle>
          <DialogDescription>
            Connect your social media accounts to start posting across multiple
            platforms. You can skip this and configure later.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">
              Need help finding your API keys?
            </p>
            <p>
              Each platform has different steps to generate API keys. Check the
              help icons next to each field for specific instructions.
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
            <TabsTrigger value="facebook" className="text-xs sm:text-sm">
              <Facebook className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Facebook</span>
            </TabsTrigger>
            <TabsTrigger value="instagram" className="text-xs sm:text-sm">
              <Instagram className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Instagram</span>
            </TabsTrigger>
            <TabsTrigger value="tiktok" className="text-xs sm:text-sm">
              <Music className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">TikTok</span>
            </TabsTrigger>
            <TabsTrigger value="twitter" className="text-xs sm:text-sm">
              <Twitter className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">X</span>
            </TabsTrigger>
            <TabsTrigger value="youtube" className="text-xs sm:text-sm">
              <Youtube className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">YouTube</span>
            </TabsTrigger>
            <TabsTrigger value="linkedin" className="text-xs sm:text-sm">
              <Linkedin className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">LinkedIn</span>
            </TabsTrigger>
          </TabsList>

          {/* Facebook Tab */}
          <TabsContent value="facebook" className="space-y-4">
            <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
              <h3 className="font-semibold text-sm">
                Facebook App Credentials
              </h3>

              <div className="space-y-2">
                <Label htmlFor="facebookAppId">
                  Facebook App ID
                  <a
                    href="https://developers.facebook.com/apps/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 ml-2 hover:underline"
                  >
                    (Get it here)
                  </a>
                </Label>
                <Input
                  id="facebookAppId"
                  placeholder="123456789..."
                  value={keys.facebookAppId}
                  onChange={(e) =>
                    handleChange("facebookAppId", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="facebookAppSecret">
                  Facebook App Secret
                  <span className="text-xs text-red-600 ml-2">
                    (Keep this private)
                  </span>
                </Label>
                <Input
                  id="facebookAppSecret"
                  type="password"
                  placeholder="Your app secret..."
                  value={keys.facebookAppSecret}
                  onChange={(e) =>
                    handleChange("facebookAppSecret", e.target.value)
                  }
                />
              </div>
            </div>
          </TabsContent>

          {/* Instagram Tab */}
          <TabsContent value="instagram" className="space-y-4">
            <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
              <h3 className="font-semibold text-sm">Instagram Credentials</h3>

              <div className="space-y-2">
                <Label htmlFor="instagramToken">
                  Instagram Access Token
                  <a
                    href="https://developers.instagram.com/docs/instagram-basic-display-api/get-started"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 ml-2 hover:underline"
                  >
                    (Get it here)
                  </a>
                </Label>
                <Input
                  id="instagramToken"
                  type="password"
                  placeholder="Your Instagram token..."
                  value={keys.instagramToken}
                  onChange={(e) =>
                    handleChange("instagramToken", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instagramBusinessAccountId">
                  Instagram Business Account ID (Optional)
                </Label>
                <Input
                  id="instagramBusinessAccountId"
                  placeholder="123456789..."
                  value={keys.instagramBusinessAccountId}
                  onChange={(e) =>
                    handleChange("instagramBusinessAccountId", e.target.value)
                  }
                />
              </div>
            </div>
          </TabsContent>

          {/* TikTok Tab */}
          <TabsContent value="tiktok" className="space-y-4">
            <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
              <h3 className="font-semibold text-sm">TikTok Credentials</h3>

              <div className="space-y-2">
                <Label htmlFor="tiktokApiKey">
                  TikTok API Key
                  <a
                    href="https://developers.tiktok.com/doc/login-kit-get-started"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 ml-2 hover:underline"
                  >
                    (Get it here)
                  </a>
                </Label>
                <Input
                  id="tiktokApiKey"
                  placeholder="Your TikTok API key..."
                  value={keys.tiktokApiKey}
                  onChange={(e) => handleChange("tiktokApiKey", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tiktokApiSecret">
                  TikTok API Secret
                  <span className="text-xs text-red-600 ml-2">
                    (Keep this private)
                  </span>
                </Label>
                <Input
                  id="tiktokApiSecret"
                  type="password"
                  placeholder="Your TikTok API secret..."
                  value={keys.tiktokApiSecret}
                  onChange={(e) =>
                    handleChange("tiktokApiSecret", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tiktokAccessToken">
                  TikTok Access Token (Optional)
                </Label>
                <Input
                  id="tiktokAccessToken"
                  type="password"
                  placeholder="Your TikTok access token..."
                  value={keys.tiktokAccessToken}
                  onChange={(e) =>
                    handleChange("tiktokAccessToken", e.target.value)
                  }
                />
              </div>
            </div>
          </TabsContent>

          {/* Twitter Tab */}
          <TabsContent value="twitter" className="space-y-4">
            <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
              <h3 className="font-semibold text-sm">X (Twitter) Credentials</h3>

              <div className="space-y-2">
                <Label htmlFor="twitterApiKey">
                  X API Key
                  <a
                    href="https://developer.twitter.com/en/portal/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 ml-2 hover:underline"
                  >
                    (Get it here)
                  </a>
                </Label>
                <Input
                  id="twitterApiKey"
                  placeholder="Your X API key..."
                  value={keys.twitterApiKey}
                  onChange={(e) =>
                    handleChange("twitterApiKey", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitterApiSecret">
                  X API Secret
                  <span className="text-xs text-red-600 ml-2">
                    (Keep this private)
                  </span>
                </Label>
                <Input
                  id="twitterApiSecret"
                  type="password"
                  placeholder="Your X API secret..."
                  value={keys.twitterApiSecret}
                  onChange={(e) =>
                    handleChange("twitterApiSecret", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitterBearerToken">
                  X Bearer Token (Optional)
                </Label>
                <Input
                  id="twitterBearerToken"
                  type="password"
                  placeholder="Your X Bearer token..."
                  value={keys.twitterBearerToken}
                  onChange={(e) =>
                    handleChange("twitterBearerToken", e.target.value)
                  }
                />
              </div>
            </div>
          </TabsContent>

          {/* YouTube Tab */}
          <TabsContent value="youtube" className="space-y-4">
            <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
              <h3 className="font-semibold text-sm">YouTube Credentials</h3>

              <div className="space-y-2">
                <Label htmlFor="youtubeApiKey">
                  YouTube API Key
                  <a
                    href="https://console.cloud.google.com/apis/library"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 ml-2 hover:underline"
                  >
                    (Get it here)
                  </a>
                </Label>
                <Input
                  id="youtubeApiKey"
                  type="password"
                  placeholder="Your YouTube API key..."
                  value={keys.youtubeApiKey}
                  onChange={(e) =>
                    handleChange("youtubeApiKey", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="youtubeChannelId">
                  YouTube Channel ID (Optional)
                </Label>
                <Input
                  id="youtubeChannelId"
                  placeholder="UC..."
                  value={keys.youtubeChannelId}
                  onChange={(e) =>
                    handleChange("youtubeChannelId", e.target.value)
                  }
                />
              </div>
            </div>
          </TabsContent>

          {/* LinkedIn Tab */}
          <TabsContent value="linkedin" className="space-y-4">
            <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
              <h3 className="font-semibold text-sm">LinkedIn Credentials</h3>

              <div className="space-y-2">
                <Label htmlFor="linkedinAccessToken">
                  LinkedIn Access Token
                  <a
                    href="https://www.linkedin.com/developers/apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 ml-2 hover:underline"
                  >
                    (Get it here)
                  </a>
                </Label>
                <Input
                  id="linkedinAccessToken"
                  type="password"
                  placeholder="Your LinkedIn access token..."
                  value={keys.linkedinAccessToken}
                  onChange={(e) =>
                    handleChange("linkedinAccessToken", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="linkedinOrganizationId">
                  LinkedIn Organization ID (Optional)
                </Label>
                <Input
                  id="linkedinOrganizationId"
                  placeholder="Your organization ID..."
                  value={keys.linkedinOrganizationId}
                  onChange={(e) =>
                    handleChange("linkedinOrganizationId", e.target.value)
                  }
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Skip for Now
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading || !isAnyKeyConfigured}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isLoading ? "Saving..." : "Save API Keys"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
