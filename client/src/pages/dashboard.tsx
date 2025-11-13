import { AIContentGenerator } from "@/components/dashboard/ai-content-generator";
import { AISearchOptimizer } from "@/components/dashboard/ai-search-optimizer";
import { APIKeyManager } from "@/components/dashboard/api-key-manager";
import { BrandSettings } from "@/components/dashboard/brand-settings";
import { ContentCalendar } from "@/components/dashboard/content-calendar";
import { LocalMarketTools } from "@/components/dashboard/local-market-tools";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { PhotoAvatarManager } from "@/components/dashboard/photo-avatar-manager";
import { ScheduledPostsManager } from "@/components/dashboard/scheduled-posts-manager";
import { SEOOptimizer } from "@/components/dashboard/seo-optimizer";
import { SocialLinksPrompt } from "@/components/dashboard/social-links-prompt";
import { SocialMediaManager } from "@/components/dashboard/social-media-manager";
import { StreamingAvatar } from "@/components/dashboard/streaming-avatar";
import { TemplateManager } from "@/components/dashboard/template-manager";
import { TwitterTestPosts } from "@/components/dashboard/twitter-test-posts";
import { VideoGenerationManager } from "@/components/dashboard/video-generation-manager";
import { VideoGenerator } from "@/components/dashboard/video-generator";
import { VideoTemplates } from "@/components/dashboard/video-templates";
import { Sidebar } from "@/components/layout/sidebar";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import { SocialMediaSetup } from "@/components/setup/social-media-setup";
import { Button } from "@/components/ui/button";
import UserMenu from "@/components/UserMenu";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");
  const [showSocialLinksPrompt, setShowSocialLinksPrompt] = useState(false);
  const [showSocialMediaSetup, setShowSocialMediaSetup] = useState(false);
  const { user, isAuthenticated } = useAuth();

  // Connect to WebSocket for real-time updates
  const { isConnected, lastMessage } = useWebSocket({
    userId: user?.id?.toString() || undefined,
    autoConnect: isAuthenticated && !!user?.id,
    showToast: true,
  });

  const handleGenerateContent = () => {
    setIsGenerating(true);
    // This will be handled by the AI Content Generator component
    setTimeout(() => setIsGenerating(false), 2000);
  };

  // Check if coming from NebraskaHomeHub
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const source = urlParams.get("source");
    const domain = urlParams.get("domain");
    const showSetup = urlParams.get("showSetup");

    // Only show setup modal if explicitly requested via URL parameter
    if (showSetup === "true" && (source === "nebraska-home-hub" || domain)) {
      setShowSocialMediaSetup(true);
    }
  }, []);

  // Handle hash navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1); // Remove the '#'
      if (hash) {
        setActiveView(hash);
      } else {
        setActiveView("dashboard");
      }
    };

    // Set initial view from URL hash
    handleHashChange();

    // Listen for hash changes
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  // Show social links prompt on first visit (only if not coming from NebraskaHomeHub)
  useEffect(() => {
    const hasSeenPrompt = localStorage.getItem("socialLinksPromptShown");
    const urlParams = new URLSearchParams(window.location.search);
    const isFromNebraska = urlParams.get("source") === "nebraska-home-hub";

    if (!hasSeenPrompt && !isFromNebraska) {
      setShowSocialLinksPrompt(true);
    }
  }, []);

  const renderActiveView = () => {
    switch (activeView) {
      case "ai-content":
        return <AIContentGenerator isGenerating={isGenerating} />;
      case "ai-video":
        return <VideoGenerator />;
      case "streaming-avatar":
        return <StreamingAvatar />;
      case "photo-avatars":
        return <PhotoAvatarManager />;
      case "video-generation":
        return <VideoGenerationManager />;
      case "templates":
        return <TemplateManager />;
      case "video-templates":
        return <VideoTemplates />;
      case "social":
        return <SocialMediaManager />;
      case "seo":
        return <SEOOptimizer />;
      case "calendar":
        return <ContentCalendar />;
      case "market":
        return <LocalMarketTools />;
      case "brand-settings":
        return <BrandSettings />;
      case "analytics":
        return (
          <div className="p-6">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold mb-2">
                  Analytics Dashboard
                </h2>
                <p className="text-muted-foreground">
                  Monitor your API usage, system health, and performance metrics
                </p>
              </div>
              <AISearchOptimizer />
              <APIKeyManager />
            </div>
          </div>
        );
      default: // "dashboard"
        return (
          <>
            <OverviewCards />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <AIContentGenerator isGenerating={isGenerating} />
              </div>
              <div className="space-y-6">
                <SocialMediaManager />
                <TwitterTestPosts />
              </div>
            </div>

            <VideoGenerator />

            <AISearchOptimizer />

            <ScheduledPostsManager />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SEOOptimizer />
              <ContentCalendar />
            </div>

            <LocalMarketTools />
          </>
        );
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                AI SEO & Social Media Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                Automated content generation for Omaha real estate market
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                onClick={handleGenerateContent}
                disabled={isGenerating}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="button-generate-content"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {isGenerating ? "Generating..." : "Generate Content"}
              </Button>
              <NotificationPanel
                userId={user?.id?.toString()}
                lastMessage={lastMessage}
              />
              <UserMenu />
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-6 space-y-6">{renderActiveView()}</div>
      </main>

      {/* Social Links Prompt Modal */}
      {showSocialLinksPrompt && (
        <SocialLinksPrompt
          open={showSocialLinksPrompt}
          onOpenChange={(open) => {
            setShowSocialLinksPrompt(open);
            if (!open) {
              localStorage.setItem("socialLinksPromptShown", "true");
            }
          }}
        />
      )}

      {/* Social Media Setup Modal (for NebraskaHomeHub users) */}
      {showSocialMediaSetup && (
        <SocialMediaSetup
          isOpen={showSocialMediaSetup}
          onClose={() => setShowSocialMediaSetup(false)}
          onComplete={(config) => {
            console.log("Social media setup completed:", config);
            setShowSocialMediaSetup(false);
            // Optionally redirect to social media manager
            setActiveView("social");
          }}
        />
      )}

      {/* Loading Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg border border-border shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span className="text-foreground font-medium">
                Generating AI content...
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
