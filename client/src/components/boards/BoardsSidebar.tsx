import { Link, useLocation } from "wouter";
import { Bell, Share2, Compass, Users, Gauge, ChevronDown, LayoutGrid, ArrowLeft, Moon, Sun, type LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useBoardsTheme } from "@/hooks/useBoardsTheme";

interface BoardsSidebarProps {
  active: "boards" | "discover" | "team" | "usage";
}

export function BoardsSidebar({ active }: BoardsSidebarProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { theme, toggle } = useBoardsTheme();

  const NavLink = ({
    icon: Icon,
    label,
    href,
    isActive,
    testId,
  }: {
    icon: LucideIcon;
    label: string;
    href?: string;
    isActive?: boolean;
    testId: string;
  }) => {
    const className = `w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md ${
      isActive
        ? "bg-neutral-200/80 text-neutral-900 font-medium dark:bg-neutral-800 dark:text-neutral-100"
        : "hover:bg-neutral-200/60 text-neutral-700 dark:hover:bg-neutral-800/60 dark:text-neutral-300"
    }`;
    if (href) {
      return (
        <Link href={href}>
          <a className={className} data-testid={testId}>
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </a>
        </Link>
      );
    }
    return (
      <button className={className} data-testid={testId}>
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </button>
    );
  };

  const initial = (user?.name || user?.email || "U").trim().charAt(0).toUpperCase();
  const displayName = user?.name || user?.email || "Workspace";

  return (
    <aside
      className="w-[220px] flex-shrink-0 bg-white/60 backdrop-blur-sm border-r border-neutral-200/80 flex flex-col dark:bg-neutral-900/60 dark:border-neutral-800"
      data-overlay-keep
    >
      <div className="p-3">
        <button
          className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60"
          data-testid="button-boards-workspace"
          onClick={() => setLocation("/dashboard")}
          title="Back to dashboard"
        >
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-violet-400 to-fuchsia-400 flex items-center justify-center text-white text-xs font-semibold">
            {initial}
          </div>
          <span className="font-medium flex-1 text-left truncate text-[13px] dark:text-neutral-100">{displayName}</span>
          <ChevronDown className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
        </button>
      </div>

      <div className="px-3 pb-2 space-y-0.5">
        <button
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-neutral-200/60 text-neutral-700 text-[13px] dark:hover:bg-neutral-800/60 dark:text-neutral-300"
          data-testid="button-back-to-app"
          onClick={() => setLocation("/dashboard")}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to app</span>
        </button>
        <button className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-neutral-200/60 text-neutral-700 text-[13px] dark:hover:bg-neutral-800/60 dark:text-neutral-300" data-testid="button-shared">
          <Share2 className="w-4 h-4" />
          <span>Shared with you</span>
        </button>
        <button className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-neutral-200/60 text-neutral-700 text-[13px] dark:hover:bg-neutral-800/60 dark:text-neutral-300" data-testid="button-notifications">
          <Bell className="w-4 h-4" />
          <span>Notifications</span>
        </button>
      </div>

      <nav className="px-3 mt-1 space-y-0.5 text-[13px]">
        <NavLink icon={LayoutGrid} label="Boards" href="/boards" isActive={active === "boards"} testId="nav-boards" />
        <NavLink icon={Compass} label="Discover" href="/boards/discover" isActive={active === "discover"} testId="nav-discover" />
        <NavLink icon={Users} label="Team" isActive={active === "team"} testId="nav-team" />
        <NavLink icon={Gauge} label="Usage" isActive={active === "usage"} testId="nav-usage" />
      </nav>

      <div className="mt-auto p-3 flex items-center justify-between gap-2">
        <span className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate">My Golden Brick · Boards</span>
        <button
          type="button"
          onClick={toggle}
          aria-label={theme === "dark" ? "Switch Boards to light mode" : "Switch Boards to dark mode"}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
          className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-600 hover:bg-neutral-200/60 dark:text-neutral-300 dark:hover:bg-neutral-800/60"
          data-overlay-keep
          data-testid="button-toggle-boards-theme"
        >
          {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>
      </div>
    </aside>
  );
}
