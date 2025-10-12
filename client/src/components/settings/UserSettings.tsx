import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Facebook,
  Instagram,
  Linkedin,
  Twitter as X,
  Globe,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SocialMediaUrls {
  facebook: string;
  instagram: string;
  linkedin: string;
  x: string;
  customWebhook: string;
}

export function UserSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [socialUrls, setSocialUrls] = useState<SocialMediaUrls>({
    facebook: "",
    instagram: "",
    linkedin: "",
    x: "",
    customWebhook: "",
  });

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
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserSettings();
  }, []);

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

  return (
    <div className="space-y-6">
      <Tabs defaultValue="social">
        <TabsList className="mb-4">
          <TabsTrigger value="social">Social Media</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

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
