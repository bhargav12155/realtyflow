import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart3,
  Bot,
  Calendar,
  Camera,
  FileVideo,
  Home,
  MapPin,
  Palette,
  Plus,
  Radio,
  Search,
  Settings,
  Share2,
  Target,
  Users,
  Video,
} from "lucide-react";
import { Link } from "wouter";

const navigationItems = [
  { icon: Home, label: "Dashboard", href: "#", key: "dashboard" },
  {
    icon: Bot,
    label: "AI Content Generator",
    href: "#ai-content",
    key: "ai-content",
  },
  {
    icon: Share2,
    label: "Social Media Manager",
    href: "#social",
    key: "social",
  },
  { icon: Search, label: "SEO Optimizer", href: "#seo", key: "seo" },
  {
    icon: Calendar,
    label: "Content Calendar",
    href: "#calendar",
    key: "calendar",
  },
  { icon: MapPin, label: "Local Market Tools", href: "#market", key: "market" },
  {
    icon: Palette,
    label: "Brand Settings",
    href: "#brand-settings",
    key: "brand-settings",
  },
  { icon: BarChart3, label: "Analytics", href: "#analytics", key: "analytics" },
  {
    icon: Video,
    label: "AI Video Generator",
    href: "#ai-video",
    key: "ai-video",
  },
  {
    icon: Radio,
    label: "Streaming Avatar",
    href: "#streaming-avatar",
    key: "streaming-avatar",
  },
  {
    icon: Users,
    label: "Photo Avatars",
    href: "#photo-avatars",
    key: "photo-avatars",
  },
  {
    icon: Video,
    label: "Video Generation",
    href: "#video-generation",
    key: "video-generation",
  },
  {
    icon: FileVideo,
    label: "Video Templates",
    href: "#templates",
    key: "templates",
  },
  {
    icon: Target,
    label: "Advanced Advertising",
    href: "#advertising",
    key: "advertising",
  },
];

const quickActions = [
  { icon: Plus, label: "New Blog Post", href: "#new-blog" },
  { icon: Camera, label: "Social Post", href: "#new-social" },
  { icon: Home, label: "Property Feature", href: "#new-property" },
];

interface SidebarProps {
  activeView?: string;
}

export function Sidebar({ activeView = "dashboard" }: SidebarProps) {
  const { toast } = useToast();

  const handleAdvancedAdvertisingClick = (e: React.MouseEvent) => {
    e.preventDefault();
    toast({
      title: "Coming Soon",
      description:
        "Advanced Advertising features are currently in development and will be available soon!",
    });
  };

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center">
            <img
              src="/my-golden-brick-logo.png"
              alt="My Golden Brick LLC Logo"
              className="w-8 h-8 object-contain"
            />
          </div>
          <div>
            <h1
              className="font-bold text-xl bg-gradient-to-b from-yellow-300 via-yellow-500 to-yellow-600 bg-clip-text text-transparent"
              style={{
                textShadow: "1px 1px 2px rgba(0,0,0,0.3)",
              }}
            >
              My Golden Brick LLC
            </h1>
          </div>
        </div>
      </div>
      {/* Navigation */}
      <nav className="flex-1 px-4 py-6">
        <div className="space-y-1">
          {navigationItems.map((item) => {
            const isActive = activeView === item.key;
            const isAdvancedAdvertising = item.key === "advertising";

            return (
              <Button
                key={item.label}
                variant={isActive ? "default" : "ghost"}
                className={`w-full justify-start text-sm font-medium ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
                data-testid={`nav-${item.label
                  .toLowerCase()
                  .replace(/\s+/g, "-")}`}
                onClick={
                  isAdvancedAdvertising
                    ? handleAdvancedAdvertisingClick
                    : undefined
                }
                asChild={!isAdvancedAdvertising}
              >
                {isAdvancedAdvertising ? (
                  <>
                    <item.icon className="mr-3 h-4 w-4" />
                    {item.label}
                  </>
                ) : (
                  <a href={item.href}>
                    <item.icon className="mr-3 h-4 w-4" />
                    {item.label}
                  </a>
                )}
              </Button>
            );
          })}
        </div>

        <div className="mt-8">
          <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Quick Actions
          </h3>
          <div className="space-y-1">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                variant="ghost"
                className="w-full justify-start text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary"
                data-testid={`quick-${action.label
                  .toLowerCase()
                  .replace(/\s+/g, "-")}`}
              >
                <action.icon className="mr-3 h-4 w-4" />
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      </nav>
      {/* User Profile */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <span className="text-primary-foreground text-sm font-medium">
              MB
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              Mike Bjork
            </p>
            <p className="text-xs text-muted-foreground truncate">Team Lead</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-settings"
            asChild
          >
            <Link href="/settings">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </aside>
  );
}
