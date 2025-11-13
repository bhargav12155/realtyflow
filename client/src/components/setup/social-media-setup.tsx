import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  Music2,
  Linkedin,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Key,
  Globe,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";

interface SocialConfig {
  // Social URLs from NebraskaHomeHub
  facebookUrl?: string;
  twitterUrl?: string;
  linkedinUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  tiktokUrl?: string;

  // API Keys for posting (stored in RealtyFlow)
  facebookPageId?: string;
  facebookAccessToken?: string;
  instagramUserId?: string;
  instagramAccessToken?: string;
  twitterApiKey?: string;
  twitterApiSecret?: string;
  twitterAccessToken?: string;
  twitterAccessTokenSecret?: string;
  linkedinClientId?: string;
  linkedinClientSecret?: string;
  linkedinAccessToken?: string;
  youtubeApiKey?: string;
  youtubeAccessToken?: string;
  tiktokAccessToken?: string;
}

interface SocialMediaSetupProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (config: SocialConfig) => void;
}

const platformConfig = [
  {
    key: "facebook",
    name: "Facebook",
    icon: Facebook,
    color: "bg-blue-600",
    description: "Connect your Facebook Page for automated posting",
    fields: [
      {
        key: "facebookPageId",
        label: "Page ID",
        type: "text",
        placeholder: "123456789012345",
      },
      {
        key: "facebookAccessToken",
        label: "Page Access Token",
        type: "password",
        placeholder: "EAAxx...",
      },
    ],
    instructions: [
      "Go to Facebook Developer Console",
      "Create an app with Pages permissions",
      "Get your Page ID and Page Access Token",
      "Make sure your token has 'pages_manage_posts' permission",
    ],
  },
  {
    key: "instagram",
    name: "Instagram",
    icon: Instagram,
    color: "bg-pink-600",
    description: "Connect your Instagram Business account",
    fields: [
      {
        key: "instagramUserId",
        label: "Instagram User ID",
        type: "text",
        placeholder: "17841400...",
      },
      {
        key: "instagramAccessToken",
        label: "Access Token",
        type: "password",
        placeholder: "IGQVJx...",
      },
    ],
    instructions: [
      "Convert to Instagram Business Account",
      "Connect to Facebook Page",
      "Use Facebook Graph API to get User ID",
      "Generate long-lived access token",
    ],
  },
  {
    key: "twitter",
    name: "Twitter/X",
    icon: Twitter,
    color: "bg-black",
    description: "Connect your Twitter/X account for posting",
    fields: [
      {
        key: "twitterApiKey",
        label: "API Key",
        type: "password",
        placeholder: "abc123...",
      },
      {
        key: "twitterApiSecret",
        label: "API Secret",
        type: "password",
        placeholder: "def456...",
      },
      {
        key: "twitterAccessToken",
        label: "Access Token",
        type: "password",
        placeholder: "ghi789...",
      },
      {
        key: "twitterAccessTokenSecret",
        label: "Access Token Secret",
        type: "password",
        placeholder: "jkl012...",
      },
    ],
    instructions: [
      "Apply for Twitter Developer Account",
      "Create a new app in Developer Portal",
      "Generate API Keys and Access Tokens",
      "Ensure app has write permissions",
    ],
  },
  {
    key: "linkedin",
    name: "LinkedIn",
    icon: Linkedin,
    color: "bg-blue-700",
    description: "Connect your LinkedIn profile with one click - no manual setup required!",
    fields: [],
    instructions: [
      "✨ LinkedIn uses automatic OAuth connection",
      "Go to Social Media Manager",
      "Click the 'Connect' button next to LinkedIn",
      "Authorize RealtyFlow to post on your behalf",
      "That's it! No manual credentials needed",
    ],
  },
  {
    key: "youtube",
    name: "YouTube",
    icon: Youtube,
    color: "bg-red-600",
    description: "Connect your YouTube channel",
    fields: [
      {
        key: "youtubeApiKey",
        label: "API Key",
        type: "password",
        placeholder: "AIza...",
      },
      {
        key: "youtubeAccessToken",
        label: "Access Token",
        type: "password",
        placeholder: "ya29...",
      },
    ],
    instructions: [
      "Enable YouTube Data API v3",
      "Create credentials in Google Cloud Console",
      "Complete OAuth for channel access",
      "Get channel-specific access token",
    ],
  },
  {
    key: "tiktok",
    name: "TikTok",
    icon: Music2,
    color: "bg-black",
    description: "Connect your TikTok for Business account",
    fields: [
      {
        key: "tiktokAccessToken",
        label: "Access Token",
        type: "password",
        placeholder: "act.xxx...",
      },
    ],
    instructions: [
      "Apply for TikTok for Business",
      "Register in TikTok Developer Portal",
      "Complete business verification",
      "Generate API access token",
    ],
  },
];

// Tutorial Videos Section Component
function TutorialVideosSection({ category, subcategory }: { category: string; subcategory: string }) {
  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["/api/tutorial-videos", category, subcategory],
    queryFn: async () => {
      const params = new URLSearchParams({ category, subcategory });
      const response = await fetch(`/api/tutorial-videos?${params}`);
      if (!response.ok) throw new Error("Failed to fetch tutorial videos");
      return await response.json();
    },
  });

  if (isLoading) {
    return <div className="text-center text-muted-foreground">Loading tutorials...</div>;
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-2">No tutorial videos available yet.</p>
        <p className="text-sm text-muted-foreground">Check back soon for helpful guides!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {videos.map((video: any) => (
        <Card key={video.id} className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Youtube className="h-4 w-4 text-amber-600" />
              {video.title}
            </CardTitle>
            {video.description && (
              <p className="text-sm text-muted-foreground">{video.description}</p>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="aspect-video bg-black relative group">
              <video
                controls
                controlsList="nodownload"
                className="w-full h-full object-contain"
                data-testid={`video-${video.id}`}
                preload="metadata"
              >
                <source src={video.videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="px-6 py-3 bg-muted/50">
              <p className="text-xs text-muted-foreground flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Youtube className="h-3 w-3" />
                  Tutorial Video
                </span>
                {video.duration && (
                  <span>
                    Duration: {Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, '0')}
                  </span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function SocialMediaSetup({
  isOpen,
  onClose,
  onComplete,
}: SocialMediaSetupProps) {
  const [config, setConfig] = useState<SocialConfig>({});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<
    Record<string, boolean>
  >({});
  const { toast } = useToast();

  // Check if we're coming from NebraskaHomeHub
  const sourceApp = new URLSearchParams(window.location.search).get("source");
  const nebraskaDomain = new URLSearchParams(window.location.search).get(
    "domain"
  );

  // Fetch social URLs from NebraskaHomeHub if available
  const { data: socialUrls, isLoading: loadingSocialUrls } = useQuery({
    queryKey: ["social-urls", nebraskaDomain],
    queryFn: async () => {
      if (!nebraskaDomain || sourceApp !== "nebraska-home-hub") return null;

      try {
        // Call NebraskaHomeHub API to get social URLs
        // Use development URLs for local development
        const baseUrl =
          nebraskaDomain === "localhost" || nebraskaDomain === "localhost:5173"
            ? "http://localhost:3001"
            : `https://${nebraskaDomain}`;

        const response = await fetch(`${baseUrl}/api/template`, {
          credentials: "include", // Include cookies for auth
        });

        if (!response.ok) {
          // Try public endpoint as fallback
          const publicResponse = await fetch(`${baseUrl}/api/template/public`);
          if (!publicResponse.ok)
            throw new Error("Failed to fetch social URLs");
          return await publicResponse.json();
        }

        return await response.json();
      } catch (error) {
        console.error("Error fetching social URLs:", error);
        return null;
      }
    },
    enabled: !!(nebraskaDomain && sourceApp === "nebraska-home-hub"),
  });

  // Load existing configuration
  const { data: existingConfig } = useQuery({
    queryKey: ["social-config"],
    queryFn: async () => {
      const response = await fetch("/api/user/social-api-keys");
      if (!response.ok) return {};
      return await response.json();
    },
  });

  // Save configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (newConfig: SocialConfig) => {
      const response = await fetch("/api/user/social-api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });

      if (!response.ok) {
        throw new Error("Failed to save configuration");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuration Saved",
        description: "Your social media setup has been saved successfully.",
      });
      onComplete(config);
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save configuration",
        variant: "destructive",
      });
    },
  });

  // Initialize config from existing data and social URLs
  useEffect(() => {
    const initialConfig: SocialConfig = {
      ...existingConfig,
    };

    if (socialUrls) {
      initialConfig.facebookUrl = socialUrls.facebookUrl;
      initialConfig.twitterUrl = socialUrls.twitterUrl;
      initialConfig.linkedinUrl = socialUrls.linkedinUrl;
      initialConfig.instagramUrl = socialUrls.instagramUrl;
      initialConfig.youtubeUrl = socialUrls.youtubeUrl;
      initialConfig.tiktokUrl = socialUrls.tiktokUrl;
    }

    setConfig(initialConfig);
  }, [existingConfig, socialUrls]);

  const handleFieldChange = (field: string, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const togglePasswordVisibility = (field: string) => {
    setShowPassword((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const validateConnection = async (platform: string) => {
    setIsValidating(true);
    try {
      const response = await fetch(`/api/${platform}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const result = await response.json();
      setValidationResults((prev) => ({ ...prev, [platform]: result.valid }));

      toast({
        title: result.valid ? "Connection Valid" : "Connection Failed",
        description: result.message,
        variant: result.valid ? "default" : "destructive",
      });
    } catch (error) {
      setValidationResults((prev) => ({ ...prev, [platform]: false }));
      toast({
        title: "Validation Error",
        description: "Failed to validate connection",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = () => {
    saveConfigMutation.mutate(config);
  };

  const renderPlatformTab = (platform: (typeof platformConfig)[0]) => (
    <TabsContent key={platform.key} value={platform.key} className="space-y-6">
      <div className="flex items-center space-x-4">
        <div className={`p-3 rounded-lg ${platform.color} text-white`}>
          <platform.icon className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">{platform.name}</h3>
          <p className="text-sm text-muted-foreground">
            {platform.description}
          </p>
        </div>
        {validationResults[platform.key] !== undefined && (
          <Badge
            variant={
              validationResults[platform.key] ? "default" : "destructive"
            }
          >
            {validationResults[platform.key] ? (
              <CheckCircle className="h-3 w-3 mr-1" />
            ) : (
              <AlertCircle className="h-3 w-3 mr-1" />
            )}
            {validationResults[platform.key] ? "Connected" : "Failed"}
          </Badge>
        )}
      </div>

      {/* Social URL (read-only from NebraskaHomeHub) */}
      {config[`${platform.key}Url` as keyof SocialConfig] && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Profile URL (from NebraskaHomeHub)
          </Label>
          <div className="flex gap-2">
            <Input
              value={
                config[`${platform.key}Url` as keyof SocialConfig] as string
              }
              readOnly
              className="bg-muted"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(
                  config[`${platform.key}Url` as keyof SocialConfig] as string,
                  "_blank"
                )
              }
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* API Keys and Configuration */}
      <div className="space-y-4">
        {platform.fields.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              {field.label}
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPassword[field.key] ? "text" : field.type}
                  placeholder={field.placeholder}
                  value={
                    (config[field.key as keyof SocialConfig] as string) || ""
                  }
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                />
                {field.type === "password" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => togglePasswordVisibility(field.key)}
                  >
                    {showPassword[field.key] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Setup Instructions */}
      <div className="bg-muted p-4 rounded-lg">
        <h4 className="font-medium mb-2">Setup Instructions:</h4>
        <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
          {platform.instructions.map((instruction, index) => (
            <li key={index}>{instruction}</li>
          ))}
        </ol>
      </div>

      {/* Test Connection */}
      <Button
        onClick={() => validateConnection(platform.key)}
        disabled={
          isValidating ||
          !platform.fields.some(
            (field) => config[field.key as keyof SocialConfig]
          )
        }
        variant="outline"
        className="w-full"
      >
        {isValidating ? (
          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <CheckCircle className="h-4 w-4 mr-2" />
        )}
        Test Connection
      </Button>
    </TabsContent>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Social Media Setup
          </DialogTitle>
        </DialogHeader>

        {sourceApp === "nebraska-home-hub" && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Connected from NebraskaHomeHub! Your social media URLs will be
              automatically imported. You can set this up now or access it later
              from Settings → API Keys.
              {loadingSocialUrls && " Loading your social media URLs..."}
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="tutorials" className="w-full">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger
              value="tutorials"
              className="flex items-center gap-1"
            >
              <Youtube className="h-4 w-4" />
              <span className="hidden sm:inline">Tutorials</span>
            </TabsTrigger>
            {platformConfig.map((platform) => (
              <TabsTrigger
                key={platform.key}
                value={platform.key}
                className="flex items-center gap-1"
              >
                <platform.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{platform.name}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Tutorial Videos Tab */}
          <TabsContent value="tutorials" className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white">
                <Youtube className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Tutorial Videos</h3>
                <p className="text-sm text-muted-foreground">
                  Learn how to connect your social media accounts step-by-step
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <TutorialVideosSection 
                category="RealtyFlow Tutorials" 
                subcategory="Add Social Keys" 
              />
            </div>
          </TabsContent>

          {platformConfig.map(renderPlatformTab)}
        </Tabs>

        <div className="flex justify-between pt-4 border-t">
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Skip for now
            </Button>
            <Button variant="ghost" onClick={onClose} className="text-gray-500">
              Cancel
            </Button>
          </div>
          <Button onClick={handleSave} disabled={saveConfigMutation.isPending}>
            {saveConfigMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Configuration
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
