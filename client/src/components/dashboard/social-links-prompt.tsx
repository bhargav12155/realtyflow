import { useState, useEffect } from "react";
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
import {
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  Globe,
  Music,
  Youtube,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_SOCIAL_LINKS = {
  facebookUrl: "https://www.facebook.com/profile.php?id=61581294927027#",
  twitterUrl: "https://x.com/GoldenB93877",
  linkedinUrl:
    "https://www.linkedin.com/in/mygolden-brick-697253388/recent-activity/all/",
  instagramUrl: "https://instagram.com/bjorkgroup",
  youtubeUrl: "https://www.youtube.com/feed/playlists",
  tiktokUrl: "https://tiktok.com/@bjorkgroup",
};

interface SocialLinksPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

export function SocialLinksPrompt({
  open,
  onOpenChange,
  onSave,
}: SocialLinksPromptProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [socialLinks, setSocialLinks] = useState(DEFAULT_SOCIAL_LINKS);

  useEffect(() => {
    // Fetch existing social links if any
    if (open) {
      fetchSocialLinks();
    }
  }, [open]);

  const fetchSocialLinks = async () => {
    try {
      const response = await fetch("/api/user/social-links", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setSocialLinks({
          facebookUrl: data.facebookUrl || DEFAULT_SOCIAL_LINKS.facebookUrl,
          twitterUrl: data.xUrl || DEFAULT_SOCIAL_LINKS.twitterUrl,
          linkedinUrl: data.linkedinUrl || DEFAULT_SOCIAL_LINKS.linkedinUrl,
          instagramUrl: data.instagramUrl || DEFAULT_SOCIAL_LINKS.instagramUrl,
          youtubeUrl: data.youtubeUrl || DEFAULT_SOCIAL_LINKS.youtubeUrl,
          tiktokUrl: data.tiktokUrl || DEFAULT_SOCIAL_LINKS.tiktokUrl,
        });
      }
    } catch (error) {
      console.error("Error fetching social links:", error);
    }
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/user/social-links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          facebookUrl: socialLinks.facebookUrl,
          instagramUrl: socialLinks.instagramUrl,
          linkedinUrl: socialLinks.linkedinUrl,
          xUrl: socialLinks.twitterUrl,
          youtubeUrl: socialLinks.youtubeUrl,
          tiktokUrl: socialLinks.tiktokUrl,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Your social links have been saved!",
        });
        onSave?.();
        onClose();
      } else {
        throw new Error("Failed to save social links");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save social links. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setSocialLinks((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const socialPlatforms = [
    {
      key: "facebookUrl",
      label: "Facebook",
      icon: Facebook,
      color: "text-blue-600",
    },
    {
      key: "instagramUrl",
      label: "Instagram",
      icon: Instagram,
      color: "text-pink-600",
    },
    {
      key: "linkedinUrl",
      label: "LinkedIn",
      icon: Linkedin,
      color: "text-blue-700",
    },
    {
      key: "twitterUrl",
      label: "X (Twitter)",
      icon: Twitter,
      color: "text-black",
    },
    {
      key: "youtubeUrl",
      label: "YouTube",
      icon: Youtube,
      color: "text-red-600",
    },
    {
      key: "tiktokUrl",
      label: "TikTok",
      icon: Music,
      color: "text-black",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Connect Your Social Media</DialogTitle>
          <DialogDescription>
            Add your social media links so your audience can find you easily.
            You can update these anytime in settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-96 overflow-y-auto py-4">
          {socialPlatforms.map(({ key, label, icon: Icon, color }) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key} className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${color}`} />
                {label}
              </Label>
              <Input
                id={key}
                placeholder={`Enter your ${label} URL...`}
                value={socialLinks[key as keyof typeof socialLinks]}
                onChange={(e) => handleChange(key, e.target.value)}
                className="w-full"
              />
            </div>
          ))}
        </div>

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
            disabled={isLoading}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isLoading ? "Saving..." : "Save Links"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
