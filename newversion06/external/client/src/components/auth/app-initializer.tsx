import { useEffect, useState } from "react";
import { useLocation, useRouter } from "wouter";
import { SocialKeysOnboarding } from "./social-keys-onboarding";
import { useToast } from "@/hooks/use-toast";

interface AppInitializerProps {
  children: React.ReactNode;
}

export function AppInitializer({ children }: AppInitializerProps) {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isCheckingKeys, setIsCheckingKeys] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Check if user exists from parent app
  useEffect(() => {
    const checkUserAndKeys = async () => {
      try {
        // Check if user data exists in localStorage (from parent app)
        const storedUser = localStorage.getItem("aiseo_user");

        if (!storedUser) {
          // No user data - redirect to login
          if (location !== "/login") {
            setLocation("/login");
          }
          setIsCheckingKeys(false);
          return;
        }

        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);

        // If we got here, user exists - now check if they have social API keys configured
        try {
          const keysResponse = await fetch("/api/user/social-api-keys", {
            credentials: "include",
          });

          if (keysResponse.ok) {
            const keysData = await keysResponse.json();

            // If keys are not configured, show onboarding
            if (!keysData.configured) {
              setShowOnboarding(true);
            }
          } else if (keysResponse.status === 401) {
            // Unauthorized - redirect to login
            setLocation("/login");
          } else {
            // Keys might not exist yet, show onboarding
            setShowOnboarding(true);
          }
        } catch (error) {
          // Error checking keys - show onboarding anyway
          console.error("Error checking social API keys:", error);
          setShowOnboarding(true);
        }
      } catch (error) {
        console.error("Error during app initialization:", error);
      } finally {
        setIsCheckingKeys(false);
      }
    };

    checkUserAndKeys();
  }, []);

  const handleKeysSkipped = () => {
    setShowOnboarding(false);
    toast({
      title: "Setup Skipped",
      description: "You can configure social media keys anytime from settings.",
    });
  };

  const handleKeysSaved = () => {
    setShowOnboarding(false);
    toast({
      title: "Success",
      description: "Your social media API keys have been saved!",
    });
  };

  if (isCheckingKeys) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading your app...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {showOnboarding && (
        <SocialKeysOnboarding
          open={showOnboarding}
          onOpenChange={(open) => {
            if (!open) {
              handleKeysSkipped();
            }
          }}
          onSaved={handleKeysSaved}
        />
      )}
      {children}
    </>
  );
}
