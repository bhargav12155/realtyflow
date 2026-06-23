import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X, ExternalLink, Settings, CheckCircle } from "lucide-react";

interface SocialSetupReminderProps {
  onSetupClick: () => void;
}

export function SocialSetupReminder({
  onSetupClick,
}: SocialSetupReminderProps) {
  const [dismissed, setDismissed] = useState(false);

  // Check if user has configured social media
  const { data: socialConfig, isLoading } = useQuery({
    queryKey: ["social-config-check"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/user/social-api-keys");
        if (!response.ok) return { hasSetup: false };
        const data = await response.json();

        // Check if user has at least one platform configured
        const platforms = [
          "facebookAccessToken",
          "instagramAccessToken",
          "twitterApiKey",
          "linkedinAccessToken",
        ];
        const hasSetup = platforms.some((platform) => data[platform]);

        return { hasSetup };
      } catch (error) {
        return { hasSetup: false };
      }
    },
  });

  // Don't show if loading, dismissed, or already configured
  if (isLoading || dismissed || socialConfig?.hasSetup) {
    return null;
  }

  return (
    <Card className="border-l-4 border-l-orange-500 bg-orange-50/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-orange-600" />
            Complete Your Social Media Setup
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDismissed(true)}
            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Alert className="border-orange-200 bg-orange-50">
          <AlertDescription>
            Set up your social media accounts to start automated posting and
            maximize your reach.
          </AlertDescription>
        </Alert>

        <div className="mt-4 flex gap-3">
          <Button onClick={onSetupClick} className="flex-1">
            <ExternalLink className="h-4 w-4 mr-2" />
            Set Up Social Media
          </Button>
          <Button
            variant="outline"
            onClick={() => setDismissed(true)}
            className="flex-1"
          >
            <Settings className="h-4 w-4 mr-2" />
            Setup Later
          </Button>
        </div>

        <div className="mt-3 text-sm text-gray-600">
          <p className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            You can always access this from Settings → API Keys
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
