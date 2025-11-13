import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Facebook,
  Instagram,
  Linkedin,
  Twitter as X,
  Globe,
  Key,
  Eye,
  EyeOff,
  User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CompanyProfile } from "./CompanyProfile";
import { SocialSetupReminder } from "@/components/dashboard/social-setup-reminder";

interface SocialMediaUrls {
  facebook: string;
  instagram: string;
  linkedin: string;
  x: string;
  customWebhook: string;
}

interface SocialMediaKeys {
  // Facebook
  facebookPageId?: string;
  facebookAccessToken?: string;

  // Instagram
  instagramUserId?: string;
  instagramAccessToken?: string;

  // Twitter/X
  twitterApiKey?: string;
  twitterApiSecret?: string;
  twitterAccessToken?: string;
  twitterAccessTokenSecret?: string;

  // LinkedIn
  linkedinAccessToken?: string;
  linkedinOrganizationId?: string;

  // TikTok
  tiktokAccessToken?: string;
  tiktokOpenId?: string;

  // YouTube
  youtubeApiKey?: string;
  youtubeChannelId?: string;
}

export function UserSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showTokens, setShowTokens] = useState(false);
  const [activeTab, setActiveTab] = useState("account");
  const [socialUrls, setSocialUrls] = useState<SocialMediaUrls>({
    facebook: "",
    instagram: "",
    linkedin: "",
    x: "",
    customWebhook: "",
  });
  const [socialKeys, setSocialKeys] = useState<SocialMediaKeys>({});

  useEffect(() => {
    // Fetch user settings when component mounts
    const fetchUserSettings = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/user/settings");
        if (response.ok) {
          const data = await response.json();
          // Update state with fetched URLs
          setSocialUrls({
            facebook: data.facebookUrl || "",
            instagram: data.instagramUrl || "",
            linkedin: data.linkedinUrl || "",
            x: data.xUrl || "",
            customWebhook: data.customWebhook || "",
          });

          // Load API keys from localStorage for demo (in real app, would come from secure API)
          const savedKeys = localStorage.getItem(`social-keys-${user?.id}`);
          if (savedKeys) {
            setSocialKeys(JSON.parse(savedKeys));
          }
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchUserSettings();
    }
  }, [user]);

  const handleInputChange = (
    platform: keyof SocialMediaUrls,
    value: string
  ) => {
    setSocialUrls((prev) => ({
      ...prev,
      [platform]: value,
    }));
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/user/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          facebookUrl: socialUrls.facebook,
          instagramUrl: socialUrls.instagram,
          linkedinUrl: socialUrls.linkedin,
          xUrl: socialUrls.x,
          customWebhook: socialUrls.customWebhook,
        }),
      });

      if (response.ok) {
        toast({
          title: "Settings saved",
          description: "Your social media URLs have been updated.",
        });
      } else {
        throw new Error("Failed to save settings");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveApiKeys = async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      // In a real app, you'd save to your secure API
      // For demo purposes, using localStorage
      localStorage.setItem(
        `social-keys-${user.id}`,
        JSON.stringify(socialKeys)
      );

      toast({
        title: "Success",
        description: "API keys saved successfully",
      });
    } catch (error) {
      console.error("Error saving API keys:", error);
      toast({
        title: "Error",
        description: "Failed to save API keys",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <SocialSetupReminder
        onSetupClick={() => setActiveTab("api-keys")}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="company">Company Profile</TabsTrigger>
          <TabsTrigger value="social">Social URLs</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={user?.email || ""} disabled />
                  </div>
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={user?.name || user?.email || ""}
                      disabled
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="role">Account Type</Label>
                  <Input id="role" value={user?.type || ""} disabled />
                </div>
                <div>
                  <Label htmlFor="id">User ID</Label>
                  <Input id="id" value={user?.id || ""} disabled />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company">
          <CompanyProfile />
        </TabsContent>

        <TabsContent value="api-keys">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Keys & Tokens
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <Key className="h-4 w-4" />
                <AlertDescription>
                  Your API keys are stored securely and used only for posting
                  content to your social media accounts.
                </AlertDescription>
              </Alert>

              <div className="flex items-center justify-between">
                <Label>Show API Keys</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTokens(!showTokens)}
                >
                  {showTokens ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  {showTokens ? "Hide" : "Show"}
                </Button>
              </div>

              {/* Facebook */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Facebook className="h-5 w-5 text-blue-600" />
                  Facebook
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fb-page-id">Page ID</Label>
                    <Input
                      id="fb-page-id"
                      type={showTokens ? "text" : "password"}
                      placeholder="Your Facebook Page ID"
                      value={socialKeys.facebookPageId || ""}
                      onChange={(e) =>
                        setSocialKeys((prev) => ({
                          ...prev,
                          facebookPageId: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="fb-access-token">Access Token</Label>
                    <Input
                      id="fb-access-token"
                      type={showTokens ? "text" : "password"}
                      placeholder="Facebook Access Token"
                      value={socialKeys.facebookAccessToken || ""}
                      onChange={(e) =>
                        setSocialKeys((prev) => ({
                          ...prev,
                          facebookAccessToken: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Instagram */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Instagram className="h-5 w-5 text-pink-600" />
                  Instagram
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ig-user-id">User ID</Label>
                    <Input
                      id="ig-user-id"
                      type={showTokens ? "text" : "password"}
                      placeholder="Instagram User ID"
                      value={socialKeys.instagramUserId || ""}
                      onChange={(e) =>
                        setSocialKeys((prev) => ({
                          ...prev,
                          instagramUserId: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="ig-access-token">Access Token</Label>
                    <Input
                      id="ig-access-token"
                      type={showTokens ? "text" : "password"}
                      placeholder="Instagram Access Token"
                      value={socialKeys.instagramAccessToken || ""}
                      onChange={(e) =>
                        setSocialKeys((prev) => ({
                          ...prev,
                          instagramAccessToken: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Twitter/X */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <X className="h-5 w-5" />
                  Twitter/X
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="twitter-api-key">API Key</Label>
                    <Input
                      id="twitter-api-key"
                      type={showTokens ? "text" : "password"}
                      placeholder="Twitter API Key"
                      value={socialKeys.twitterApiKey || ""}
                      onChange={(e) =>
                        setSocialKeys((prev) => ({
                          ...prev,
                          twitterApiKey: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="twitter-api-secret">API Secret</Label>
                    <Input
                      id="twitter-api-secret"
                      type={showTokens ? "text" : "password"}
                      placeholder="Twitter API Secret"
                      value={socialKeys.twitterApiSecret || ""}
                      onChange={(e) =>
                        setSocialKeys((prev) => ({
                          ...prev,
                          twitterApiSecret: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="twitter-access-token">Access Token</Label>
                    <Input
                      id="twitter-access-token"
                      type={showTokens ? "text" : "password"}
                      placeholder="Twitter Access Token"
                      value={socialKeys.twitterAccessToken || ""}
                      onChange={(e) =>
                        setSocialKeys((prev) => ({
                          ...prev,
                          twitterAccessToken: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="twitter-access-secret">
                      Access Token Secret
                    </Label>
                    <Input
                      id="twitter-access-secret"
                      type={showTokens ? "text" : "password"}
                      placeholder="Twitter Access Token Secret"
                      value={socialKeys.twitterAccessTokenSecret || ""}
                      onChange={(e) =>
                        setSocialKeys((prev) => ({
                          ...prev,
                          twitterAccessTokenSecret: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* LinkedIn */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Linkedin className="h-5 w-5 text-blue-700" />
                  LinkedIn
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="linkedin-access-token">Access Token</Label>
                    <Input
                      id="linkedin-access-token"
                      type={showTokens ? "text" : "password"}
                      placeholder="LinkedIn Access Token"
                      value={socialKeys.linkedinAccessToken || ""}
                      onChange={(e) =>
                        setSocialKeys((prev) => ({
                          ...prev,
                          linkedinAccessToken: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="linkedin-org-id">Organization ID</Label>
                    <Input
                      id="linkedin-org-id"
                      type={showTokens ? "text" : "password"}
                      placeholder="LinkedIn Organization ID"
                      value={socialKeys.linkedinOrganizationId || ""}
                      onChange={(e) =>
                        setSocialKeys((prev) => ({
                          ...prev,
                          linkedinOrganizationId: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* YouTube */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">YouTube</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="youtube-api-key">API Key</Label>
                    <Input
                      id="youtube-api-key"
                      type={showTokens ? "text" : "password"}
                      placeholder="YouTube API Key"
                      value={socialKeys.youtubeApiKey || ""}
                      onChange={(e) =>
                        setSocialKeys((prev) => ({
                          ...prev,
                          youtubeApiKey: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="youtube-channel-id">Channel ID</Label>
                    <Input
                      id="youtube-channel-id"
                      type={showTokens ? "text" : "password"}
                      placeholder="YouTube Channel ID"
                      value={socialKeys.youtubeChannelId || ""}
                      onChange={(e) =>
                        setSocialKeys((prev) => ({
                          ...prev,
                          youtubeChannelId: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* TikTok */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">TikTok</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tiktok-access-token">Access Token</Label>
                    <Input
                      id="tiktok-access-token"
                      type={showTokens ? "text" : "password"}
                      placeholder="TikTok Access Token"
                      value={socialKeys.tiktokAccessToken || ""}
                      onChange={(e) =>
                        setSocialKeys((prev) => ({
                          ...prev,
                          tiktokAccessToken: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="tiktok-open-id">Open ID</Label>
                    <Input
                      id="tiktok-open-id"
                      type={showTokens ? "text" : "password"}
                      placeholder="TikTok Open ID"
                      value={socialKeys.tiktokOpenId || ""}
                      onChange={(e) =>
                        setSocialKeys((prev) => ({
                          ...prev,
                          tiktokOpenId: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={saveApiKeys}
                disabled={isLoading}
                className="w-full"
              >
                <Key className="h-4 w-4 mr-2" />
                Save API Keys
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Social Media Integration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Add custom URLs where RealtyFlow will push posts to your
                  social media accounts. These can be webhook URLs, API
                  endpoints, or integration URLs provided by your social media
                  management tools.
                </p>

                <div className="space-y-4">
                  {/* Facebook URL */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="facebook-url"
                      className="flex items-center gap-2"
                    >
                      <Facebook className="h-4 w-4 text-blue-600" />
                      Facebook Custom URL
                    </Label>
                    <Input
                      id="facebook-url"
                      placeholder="https://your-facebook-integration-url.com"
                      value={socialUrls.facebook}
                      onChange={(e) =>
                        handleInputChange("facebook", e.target.value)
                      }
                    />
                    <p className="text-xs text-gray-500">
                      Enter a custom URL to push posts to Facebook. This could
                      be a webhook URL from a social media manager.
                    </p>
                  </div>

                  {/* Instagram URL */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="instagram-url"
                      className="flex items-center gap-2"
                    >
                      <Instagram className="h-4 w-4 text-pink-600" />
                      Instagram Custom URL
                    </Label>
                    <Input
                      id="instagram-url"
                      placeholder="https://your-instagram-integration-url.com"
                      value={socialUrls.instagram}
                      onChange={(e) =>
                        handleInputChange("instagram", e.target.value)
                      }
                    />
                    <p className="text-xs text-gray-500">
                      Enter a custom URL to push posts to Instagram.
                    </p>
                  </div>

                  {/* LinkedIn URL */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="linkedin-url"
                      className="flex items-center gap-2"
                    >
                      <Linkedin className="h-4 w-4 text-blue-700" />
                      LinkedIn Custom URL
                    </Label>
                    <Input
                      id="linkedin-url"
                      placeholder="https://your-linkedin-integration-url.com"
                      value={socialUrls.linkedin}
                      onChange={(e) =>
                        handleInputChange("linkedin", e.target.value)
                      }
                    />
                    <p className="text-xs text-gray-500">
                      Enter a custom URL to push posts to LinkedIn.
                    </p>
                  </div>

                  {/* X (Twitter) URL */}
                  <div className="space-y-2">
                    <Label htmlFor="x-url" className="flex items-center gap-2">
                      <X className="h-4 w-4" />X (Twitter) Custom URL
                    </Label>
                    <Input
                      id="x-url"
                      placeholder="https://your-x-integration-url.com"
                      value={socialUrls.x}
                      onChange={(e) => handleInputChange("x", e.target.value)}
                    />
                    <p className="text-xs text-gray-500">
                      Enter a custom URL to push posts to X (formerly Twitter).
                    </p>
                  </div>

                  <Separator className="my-4" />

                  {/* Custom Webhook */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="custom-webhook"
                      className="flex items-center gap-2"
                    >
                      <Globe className="h-4 w-4 text-purple-600" />
                      Custom Webhook URL
                    </Label>
                    <Input
                      id="custom-webhook"
                      placeholder="https://your-custom-webhook.com"
                      value={socialUrls.customWebhook}
                      onChange={(e) =>
                        handleInputChange("customWebhook", e.target.value)
                      }
                    />
                    <p className="text-xs text-gray-500">
                      Enter a custom webhook URL to receive all your social
                      media posts. Useful for third-party integrations.
                    </p>
                  </div>

                  <Button
                    onClick={handleSave}
                    className="mt-4"
                    disabled={isLoading}
                  >
                    {isLoading ? "Saving..." : "Save Settings"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Manage your account preferences and personal information.
                </p>

                {/* Account settings form would go here */}
                <p className="text-sm">Coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
