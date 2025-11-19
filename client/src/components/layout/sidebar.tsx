import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn, getUserDisplayName, getUserInitials } from "@/lib/utils";
import {
  BarChart3,
  Bot,
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  Home,
  MapPin,
  Menu,
  Palette,
  Plus,
  Radio,
  Search,
  Settings,
  Share2,
  Target,
  Video,
} from "lucide-react";
import { useEffect, useState } from "react";
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
    icon: Camera,
    label: "Photo Avatars",
    href: "#photo-avatars",
    key: "photo-avatars",
  },
  {
    icon: Video,
    label: "Video Avatars",
    href: "#video-avatars",
    key: "video-avatars",
  },
  {
    icon: Video,
    label: "Video Generation",
    href: "#video-generation",
    key: "video-generation",
  },
  {
    icon: Radio,
    label: "Streaming Avatar",
    href: "#streaming-avatar",
    key: "streaming-avatar",
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

interface SidebarContentProps {
  activeView?: string;
  isCollapsed?: boolean;
  isMobile?: boolean;
  onClose?: () => void;
}

function SidebarContent({
  activeView = "dashboard",
  isCollapsed = false,
  isMobile = false,
  onClose,
}: SidebarContentProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  const handleAdvancedAdvertisingClick = (e: React.MouseEvent) => {
    e.preventDefault();
    toast({
      title: "Coming Soon",
      description:
        "Advanced Advertising features are currently in development and will be available soon!",
    });
  };

  const handleNavClick = () => {
    if (isMobile && onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Header */}
      <div
        className={cn("border-b border-border", isCollapsed ? "p-4" : "p-6")}
      >
        <div
          className={cn(
            "flex items-center",
            isCollapsed ? "justify-center" : "space-x-3"
          )}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
            <img
              src="/my-golden-brick-logo.png"
              alt="My Golden Brick LLC Logo"
              className="w-8 h-8 object-contain"
            />
          </div>
          {!isCollapsed && (
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
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 overflow-y-auto">
        <div className="space-y-1">
          {navigationItems.map((item) => {
            const isActive = activeView === item.key;
            const isAdvancedAdvertising = item.key === "advertising";

            return (
              <Button
                key={item.label}
                variant={isActive ? "default" : "ghost"}
                className={cn(
                  "w-full text-sm font-medium transition-all",
                  isCollapsed ? "justify-center px-2" : "justify-start",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
                data-testid={`nav-${item.label
                  .toLowerCase()
                  .replace(/\s+/g, "-")}`}
                onClick={(e) => {
                  if (isAdvancedAdvertising) {
                    handleAdvancedAdvertisingClick(e);
                  }
                  handleNavClick();
                }}
                asChild={!isAdvancedAdvertising}
                title={isCollapsed ? item.label : undefined}
              >
                {isAdvancedAdvertising ? (
                  <>
                    <item.icon
                      className={cn("h-4 w-4", !isCollapsed && "mr-3")}
                    />
                    {!isCollapsed && (
                      <span className="flex items-center gap-2 flex-1">
                        {item.label}
                      </span>
                    )}
                  </>
                ) : (
                  <a href={item.href} className="flex items-center flex-1">
                    <item.icon
                      className={cn("h-4 w-4", !isCollapsed && "mr-3")}
                    />
                    {!isCollapsed && (
                      <span className="flex items-center gap-2 flex-1">
                        {item.label}
                        {item.label === "Video Avatars" && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                          >
                            ENTERPRISE
                          </Badge>
                        )}
                      </span>
                    )}
                  </a>
                )}
              </Button>
            );
          })}
        </div>

        {!isCollapsed && (
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
                  onClick={handleNavClick}
                >
                  <action.icon className="mr-3 h-4 w-4" />
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* User Profile */}
      <div
        className={cn("border-t border-border", isCollapsed ? "p-2" : "p-4")}
      >
        <div
          className={cn(
            "flex items-center",
            isCollapsed ? "justify-center flex-col space-y-2" : "space-x-3"
          )}
        >
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-primary-foreground text-sm font-medium">
              {user ? getUserInitials(user.name, user.email) : "U"}
            </span>
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user ? getUserDisplayName(user.name, user.email) : "User"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.type === "agent" ? "Agent" : "User"}
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-settings"
            asChild
            title={isCollapsed ? "Settings" : undefined}
          >
            <Link href="/settings">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}

export function Sidebar({ activeView = "dashboard" }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    return stored === "true" ? true : false;
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", isCollapsed.toString());
  }, [isCollapsed]);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden fixed top-4 left-4 z-50 bg-card border border-border shadow-md"
            data-testid="button-mobile-menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation Menu</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col h-full bg-card">
            <SidebarContent
              activeView={activeView}
              isCollapsed={false}
              isMobile={true}
              onClose={() => setIsMobileOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col bg-card border-r border-border transition-all duration-300 ease-in-out relative",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        <SidebarContent activeView={activeView} isCollapsed={isCollapsed} />

        {/* Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapse}
          className="absolute -right-3 top-6 z-10 h-6 w-6 rounded-full border border-border bg-card shadow-md hover:bg-secondary"
          data-testid="button-toggle-sidebar"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </aside>
    </>
  );
}
