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
import { StreamingAvatarComponent } from "@/components/dashboard/streaming-avatar";
import { TemplateManager } from "@/components/dashboard/template-manager";
import VideoAvatarManager from "@/components/dashboard/video-avatar-manager";
import { VideoGenerationManager } from "@/components/dashboard/video-generation-manager";
import { VideoGenerator } from "@/components/dashboard/video-generator";
import { VideoTemplates } from "@/components/dashboard/video-templates";
import { Sidebar } from "@/components/layout/sidebar";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import { Button } from "@/components/ui/button";
import UserMenu from "@/components/UserMenu";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { VERSION_DISPLAY } from "@/lib/version";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");
  const [showSocialLinksPrompt, setShowSocialLinksPrompt] = useState(false);
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

  // Removed legacy social media setup modal - now using OAuth-only flow

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
        return <StreamingAvatarComponent />;
      case "photo-avatars":
        return <PhotoAvatarManager />;
      case "video-avatars":
        return <VideoAvatarManager />;
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
          <div className="space-y-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold mb-2">
                Analytics Dashboard
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Monitor your API usage, system health, and performance metrics
              </p>
            </div>
            <AISearchOptimizer />
            <APIKeyManager />
          </div>
        );
      default: // "dashboard"
        return (
          <>
            <OverviewCards />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="lg:col-span-2 w-full min-w-0">
                <AIContentGenerator isGenerating={isGenerating} />
              </div>
              <div className="w-full min-w-0 space-y-4 sm:space-y-6">
                <SocialMediaManager />
              </div>
            </div>

            <VideoGenerator />

            <AISearchOptimizer />

            <ScheduledPostsManager />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="w-full min-w-0">
                <SEOOptimizer />
              </div>
              <div className="w-full min-w-0">
                <ContentCalendar />
              </div>
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
        <header className="bg-card border-b border-border px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-semibold text-foreground truncate">
                <span className="hidden sm:inline">
                  AI SEO & Social Media Dashboard
                </span>
                <span className="sm:hidden">Dashboard</span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground hidden md:block">
                Automated content generation for Omaha real estate market
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              <div className="hidden lg:block text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                {VERSION_DISPLAY}
              </div>
              <Button
                onClick={handleGenerateContent}
                disabled={isGenerating}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                size="sm"
                aria-label={
                  isGenerating ? "Generating content..." : "Generate content"
                }
                data-testid="button-generate-content"
              >
                <Sparkles className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">
                  {isGenerating ? "Generating..." : "Generate Content"}
                </span>
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
        <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
          {renderActiveView()}
        </div>
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
