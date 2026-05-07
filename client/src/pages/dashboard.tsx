import { BoardsHomeOverlay } from "@/components/boards/BoardsHomeOverlay";
import { OnboardingDialog } from "@/components/onboarding/onboarding-dialog";
import { AIContentGenerator } from "@/components/dashboard/ai-content-generator";
import { AISearchOptimizer } from "@/components/dashboard/ai-search-optimizer";
import { APIKeyManager } from "@/components/dashboard/api-key-manager";
import { AvatarIVStudio } from "@/components/dashboard/avatar-iv-studio";
import { BrandSettings } from "@/components/dashboard/brand-settings";
import { ContentCalendar } from "@/components/dashboard/content-calendar";
import { LocalMarketTools } from "@/components/dashboard/local-market-tools";
import { OverviewCards, RecentPostActivity } from "@/components/dashboard/overview-cards";
import { HeygenShapeDriftDashboard } from "@/components/dashboard/heygen-shape-drift-incidents";
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
import { VideoStudio } from "@/components/dashboard/video-studio";
import { VideoTemplates } from "@/components/dashboard/video-templates";
import { PropertyTourStudio } from "@/components/dashboard/property-tour-studio";
import { Sidebar } from "@/components/layout/sidebar";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import { Button } from "@/components/ui/button";
import UserMenu from "@/components/UserMenu";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useBusinessType } from "@/lib/businessContext";
import { VERSION_DISPLAY } from "@/lib/version";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const VIEW_FEATURE_GATE: Record<string, string> = {
  "ai-content": "aiContentGenerator",
  "property-tour": "propertyTours",
};

export default function Dashboard() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");
  const [showSocialLinksPrompt, setShowSocialLinksPrompt] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [boardsOverlayOpen, setBoardsOverlayOpen] = useState(false);
  const { businessType, terms } = useBusinessType();

  // Connect to WebSocket for real-time updates
  const { isConnected, lastMessage } = useWebSocket({
    userId: user?.id?.toString() || undefined,
    autoConnect: isAuthenticated && !!user?.id,
    showToast: true,
  });

  const handleGenerateContent = () => {
    setBoardsOverlayOpen(true);
  };

  // Removed legacy social media setup modal - now using OAuth-only flow

  // Handle hash navigation using Wouter's location and hashchange event
  useEffect(() => {
    const updateViewFromHash = () => {
      const hash = window.location.hash.slice(1); // Remove the '#'
      if (hash) {
        setActiveView(hash);
      } else {
        setActiveView("dashboard");
      }
    };

    // Set initial view from URL hash
    updateViewFromHash();

    // Also listen for hashchange events (for same-page navigation)
    window.addEventListener("hashchange", updateViewFromHash);

    return () => {
      window.removeEventListener("hashchange", updateViewFromHash);
    };
  }, [location]); // Re-run when Wouter location changes

  useEffect(() => {
    const featureKey = VIEW_FEATURE_GATE[activeView];
    if (featureKey && !(terms.features as any)[featureKey]) {
      window.location.hash = "";
      setActiveView("dashboard");
    }
  }, [businessType, activeView, terms]);

  // Don't auto-show social links prompt on first visit - users can access it in settings
  useEffect(() => {
    const hasSeenPrompt = localStorage.getItem("socialLinksPromptShown");
    if (!hasSeenPrompt) {
      // Mark as seen so it never auto-shows
      localStorage.setItem("socialLinksPromptShown", "true");
    }
  }, []);

  const renderActiveView = () => {
    const featureKey = VIEW_FEATURE_GATE[activeView];
    const viewIsRestricted = featureKey && !(terms.features as any)[featureKey];
    if (viewIsRestricted) {
      return (
        <>
          <OverviewCards />
          <RecentPostActivity />
          <ScheduledPostsManager />
        </>
      );
    }

    switch (activeView) {
      case "ai-content":
        return <AIContentGenerator isGenerating={isGenerating} />;
      case "ai-video":
        return <VideoGenerator />;
      case "streaming-avatar":
        return <StreamingAvatarComponent />;
      case "photo-avatars":
        return <AvatarIVStudio />;
      case "video-avatars":
        return <VideoAvatarManager />;
      case "video-generation":
        return <VideoStudio />;
      case "templates":
        return <TemplateManager />;
      case "video-templates":
        return <VideoTemplates />;
      case "property-tour":
        return <PropertyTourStudio />;
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
      case "heygen-incidents":
        return <HeygenShapeDriftDashboard />;
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
            <RecentPostActivity />
            <ScheduledPostsManager />
          </>
        );
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar activeView={activeView} />

      <main className="flex-1 min-w-0 overflow-auto">
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
                {terms.dashboardSubtitle}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              <Button
                onClick={handleGenerateContent}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                size="sm"
                aria-label="Generate content"
                data-testid="button-generate-content"
              >
                <Sparkles className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Generate Content</span>
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
        <div key={businessType} className="p-3 sm:p-6 space-y-4 sm:space-y-6">
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

      {/* Boards Home Overlay (replaces legacy AI Assistant Dialog) */}
      <BoardsHomeOverlay
        open={boardsOverlayOpen}
        onOpenChange={setBoardsOverlayOpen}
      />

      {/* First-time User Onboarding Dialog */}
      <OnboardingDialog />
    </div>
  );
}
