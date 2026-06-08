import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn, getUserDisplayName, getUserInitials } from "@/lib/utils";
import { useBusinessType, BUSINESS_TYPE_OPTIONS, BusinessType } from "@/lib/businessContext";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Bot,
  CalendarClock,
  CalendarDays,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Home,
  LayoutGrid,
  MapPin,
  Menu,
  MessageSquare,
  Package,
  Palette,
  Plus,
  Radio,
  Search,
  Settings,
  Shield,
  Share2,
  Sparkles,
  Target,
  Video,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

const navigationItems = [
  { icon: Home, label: "Dashboard", href: "/dashboard", key: "dashboard", isPageLink: true },
  {
    icon: Bot,
    label: "AI Content Generator",
    href: "/dashboard#ai-content",
    key: "ai-content",
    isPageLink: true,
  },
  {
    icon: Package,
    label: "Catalog / Menu",
    href: "/menu-items",
    key: "menu-items",
    isPageLink: true,
  },
  {
    icon: Share2,
    label: "Quick Posts",
    href: "/dashboard#social",
    key: "social",
    isPageLink: true,
  },
  {
    icon: CalendarDays,
    label: "Content Calendar",
    href: "/calendar",
    key: "calendar",
    isPageLink: true,
  },
  {
    icon: CalendarClock,
    label: "Events",
    href: "/events",
    key: "events",
    isPageLink: true,
  },
  {
    icon: LayoutGrid,
    label: "Boards",
    href: "/boards",
    key: "boards",
    isPageLink: true,
    badge: "NEW",
  },
  {
    icon: Video,
    label: "Avatar & Video",
    key: "avatar-video",
    isCollapsible: true,
    subItems: [
      {
        icon: Camera,
        label: "Photo Avatars",
        href: "/dashboard#photo-avatars",
        key: "photo-avatars",
        isPageLink: true,
      },
      {
        icon: Sparkles,
        label: "Template Studio",
        href: "/templates",
        key: "templates",
        isPageLink: true,
        badge: "NEW",
      },
      {
        icon: Video,
        label: "Video Generation",
        href: "/dashboard#video-generation",
        key: "video-generation",
        isPageLink: true,
      },
      // HIDDEN: Streaming Avatar — re-enable when ready
      // {
      //   icon: Radio,
      //   label: "Streaming Avatar",
      //   href: "/dashboard#streaming-avatar",
      //   key: "streaming-avatar",
      //   isPageLink: true,
      // },
      {
        icon: Home,
        label: "Property Tours",
        href: "/dashboard#property-tour",
        key: "property-tour",
        isPageLink: true,
        badge: "NEW",
        showOnlyFor: ["real_estate"],
      },
    ],
  },
  { icon: Search, label: "SEO Optimizer", href: "/dashboard#seo", key: "seo", isPageLink: true },
  { icon: MapPin, label: "Local Market Tools", href: "/dashboard#market", key: "market", isPageLink: true },
  // HIDDEN: Brand Settings — re-enable when ready
  // {
  //   icon: Palette,
  //   label: "Brand Settings",
  //   href: "/dashboard#brand-settings",
  //   key: "brand-settings",
  //   isPageLink: true,
  // },
  { icon: BarChart3, label: "Analytics", href: "/dashboard#analytics", key: "analytics", isPageLink: true },
  {
    icon: AlertTriangle,
    label: "HeyGen Shape Drift",
    href: "/dashboard#heygen-incidents",
    key: "heygen-incidents",
    isPageLink: true,
    adminOnly: true,
  },
  {
    icon: AlertTriangle,
    label: "Infrastructure Alerts",
    href: "/admin/alerts",
    key: "admin-alerts",
    isPageLink: true,
    adminOnly: true,
  },
  // HIDDEN: Advanced Advertising — not yet functional, re-enable when ready
  // {
  //   icon: Target,
  //   label: "Advanced Advertising",
  //   href: "/dashboard#advertising",
  //   key: "advertising",
  //   isPageLink: true,
  // },
  {
    icon: Shield,
    label: "Admin",
    href: "/admin/settings",
    key: "admin-settings",
    isPageLink: true,
    adminOnly: true,
  },
  {
    icon: BookOpen,
    label: "Help & Guides",
    href: "/help",
    key: "help",
    isPageLink: true,
  },
];

// HIDDEN: Quick Actions — not yet functional, re-enable when ready
// const quickActions = [
//   { icon: Plus, label: "New Blog Post", href: "/dashboard?type=blog#ai-content", contentType: "blog" },
//   { icon: Camera, label: "Social Post", href: "/dashboard?type=social#ai-content", contentType: "social" },
//   { icon: Home, label: "Property Feature", href: "/dashboard?type=property_feature#ai-content", contentType: "property_feature" },
// ];

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
  const [, setLocation] = useLocation();
  const [expandedMenus, setExpandedMenus] = useState<string[]>(["avatar-video"]);
  const { businessType, setBusinessType } = useBusinessType();
  const { data: adminStatus } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/user/is-admin"],
  });
  const isAdmin = adminStatus?.isAdmin ?? false;

  const currentBusinessOption = BUSINESS_TYPE_OPTIONS.find((o) => o.value === businessType) || BUSINESS_TYPE_OPTIONS[0];

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

  const navigateTo = (href: string, e: React.MouseEvent) => {
    e.preventDefault();
    
    // Parse the href to extract path, query params, and hash
    const hashIndex = href.indexOf('#');
    const queryIndex = href.indexOf('?');
    
    let path = href;
    let queryString = '';
    let hash = '';
    
    if (hashIndex !== -1) {
      hash = href.substring(hashIndex + 1);
      path = href.substring(0, hashIndex);
    }
    
    if (queryIndex !== -1) {
      const endOfQuery = hashIndex !== -1 ? hashIndex : href.length;
      queryString = href.substring(queryIndex, endOfQuery);
      path = href.substring(0, queryIndex);
    }
    
    const currentPath = window.location.pathname;
    const fullPath = path + queryString;
    
    if (hash) {
      if (currentPath === path || (currentPath === '/' && path === '/dashboard')) {
        // Same page, just update query and hash
        if (queryString) {
          window.history.pushState({}, '', fullPath + '#' + hash);
          window.dispatchEvent(new Event('popstate'));
        }
        window.location.hash = hash;
      } else {
        // Navigate to new page with query params, then set hash
        setLocation(fullPath);
        setTimeout(() => {
          window.location.hash = hash;
        }, 50);
      }
    } else {
      // Navigating to a path without hash (e.g., Dashboard)
      // If we're on the same path but with a hash, clear the hash and force refresh
      if ((currentPath === path || (currentPath === '/' && path === '/dashboard')) && window.location.hash) {
        // Clear hash using replaceState and notify both Wouter and dashboard's hash listener
        window.history.replaceState({}, '', fullPath);
        // Dispatch popstate to notify Wouter of the URL change
        window.dispatchEvent(new Event('popstate'));
        // Dispatch hashchange for dashboard's activeView listener (using Event for Safari compatibility)
        window.dispatchEvent(new Event('hashchange'));
      } else if (currentPath !== path && !(currentPath === '/' && path === '/dashboard')) {
        // Only navigate if we're not already on this page (prevents scroll-to-top on re-click)
        setLocation(fullPath);
      }
    }
    
    handleNavClick();
  };

  const toggleMenu = (key: string) => {
    setExpandedMenus((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const isMenuExpanded = (key: string) => expandedMenus.includes(key);

  const isSubItemActive = (item: any) => {
    if (!item.subItems) return false;
    return item.subItems.some((sub: any) => sub.key === activeView);
  };

  return (
    <>
      {/* Header */}
      <div
        className={cn("border-b border-border", isCollapsed ? "p-4" : "p-4 px-5")}
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

        {/* Business Type Switcher */}
        {!isCollapsed && (
          <div className="mt-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="button-business-type-switcher"
                  className="w-full justify-between text-xs h-8 border-yellow-500/30 hover:border-yellow-500/60"
                >
                  <span className="flex items-center gap-1.5">
                    <span>{currentBusinessOption.icon}</span>
                    <span>{currentBusinessOption.label}</span>
                  </span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-xs text-gray-500">Switch Business Type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {BUSINESS_TYPE_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    data-testid={`menu-item-business-type-${opt.value}`}
                    onClick={() => setBusinessType(opt.value as BusinessType)}
                    className={cn(
                      "cursor-pointer",
                      businessType === opt.value && "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                    )}
                  >
                    <span className="mr-2">{opt.icon}</span>
                    {opt.label}
                    {businessType === opt.value && (
                      <span className="ml-auto text-xs text-amber-500">✓</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 overflow-y-auto">
        <div className="space-y-1">
          {navigationItems.map((item: any) => {
            if (item.showOnlyFor && !item.showOnlyFor.includes(businessType)) {
              return null;
            }
            if (item.adminOnly && !isAdmin) {
              return null;
            }

            const isActive = activeView === item.key;
            const isAdvancedAdvertising = item.key === "advertising";
            const hasSubItems = item.isCollapsible && item.subItems;
            const isExpanded = isMenuExpanded(item.key);
            const hasActiveSubItem = isSubItemActive(item);

            if (hasSubItems) {
              return (
                <div key={item.label}>
                  <Button
                    variant={hasActiveSubItem ? "default" : "ghost"}
                    className={cn(
                      "w-full text-sm font-medium transition-all",
                      isCollapsed ? "justify-center px-2" : "justify-between",
                      hasActiveSubItem
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                    data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                    onClick={() => toggleMenu(item.key)}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <span className="flex items-center">
                      <item.icon className={cn("h-4 w-4", !isCollapsed && "mr-3")} />
                      {!isCollapsed && item.label}
                    </span>
                    {!isCollapsed && (
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          isExpanded && "rotate-180"
                        )}
                      />
                    )}
                  </Button>
                  {!isCollapsed && isExpanded && (
                    <div className="ml-4 mt-1 space-y-1 border-l border-border pl-3">
                      {item.subItems.filter((subItem: any) => !subItem.showOnlyFor || subItem.showOnlyFor.includes(businessType)).map((subItem: any) => {
                        const isSubActive = activeView === subItem.key;
                        return (
                          <Button
                            key={subItem.label}
                            variant={isSubActive ? "default" : "ghost"}
                            className={cn(
                              "w-full text-sm font-medium transition-all justify-start",
                              isSubActive
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                            )}
                            data-testid={`nav-${subItem.label.toLowerCase().replace(/\s+/g, "-")}`}
                            onClick={(e) => navigateTo(subItem.href, e)}
                          >
                            <subItem.icon className="h-4 w-4 mr-3" />
                            <span className="flex items-center gap-2 flex-1">
                              {subItem.label}
                              {subItem.badge && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                                >
                                  {subItem.badge}
                                </Badge>
                              )}
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

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
                  } else {
                    navigateTo(item.href, e);
                  }
                }}
                title={isCollapsed ? item.label : undefined}
              >
                <item.icon
                  className={cn("h-4 w-4", !isCollapsed && "mr-3")}
                />
                {!isCollapsed && (
                  <span className="flex items-center gap-2 flex-1">
                    {item.label}
                    {item.badge && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </span>
                )}
              </Button>
            );
          })}
        </div>

{/* HIDDEN: Quick Actions section — re-enable when ready
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
                  onClick={(e) => navigateTo(action.href, e)}
                >
                  <action.icon className="mr-3 h-4 w-4" />
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        )}
*/}
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
          "hidden lg:flex flex-col bg-card border-r border-border transition-all duration-300 ease-in-out relative flex-shrink-0",
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
