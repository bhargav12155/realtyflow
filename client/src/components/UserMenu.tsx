import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LogOut, UserCheck, Users, ChevronDown } from "lucide-react";

interface UserMenuProps {
  className?: string;
}

export default function UserMenu({ className = "" }: UserMenuProps) {
  const { user, logout, isLoading } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!user) {
    return null;
  }

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    setIsLoggingOut(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getUserTypeIcon = () => {
    return user.type === "agent" ? (
      <UserCheck className="w-4 h-4" />
    ) : (
      <Users className="w-4 h-4" />
    );
  };

  const getUserTypeBadge = () => {
    return user.type === "agent" ? (
      <Badge variant="default" className="bg-blue-100 text-blue-800">
        Agent
      </Badge>
    ) : (
      <Badge variant="secondary" className="bg-green-100 text-green-800">
        Client
      </Badge>
    );
  };

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center gap-2 h-auto p-2 hover:bg-gray-100"
            disabled={isLoading}
          >
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-medium">
                {getInitials(user.name || user.email)}
              </AvatarFallback>
            </Avatar>

            <div className="flex flex-col items-start min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate max-w-32">
                  {user.name || user.email}
                </span>
                {getUserTypeBadge()}
              </div>
              {user.type === "public" && user.agentSlug && (
                <span className="text-xs text-gray-500 truncate max-w-32">
                  via @{user.agentSlug}
                </span>
              )}
            </div>

            <ChevronDown className="w-4 h-4 text-gray-400" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex items-center gap-2">
            {getUserTypeIcon()}
            User Account
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <div className="px-2 py-2">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{user.name || "User"}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
              {user.type === "agent" && user.username && (
                <p className="text-xs text-gray-500">@{user.username}</p>
              )}
              {user.type === "public" && user.agentSlug && (
                <p className="text-xs text-gray-500">
                  Agent: @{user.agentSlug}
                </p>
              )}
            </div>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-600"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <LogOut className="w-4 h-4" />
            {isLoggingOut ? "Signing out..." : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
