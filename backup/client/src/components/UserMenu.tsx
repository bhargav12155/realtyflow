import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Power } from "lucide-react";

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

  return (
    <div className={className}>
      <Button
        onClick={handleLogout}
        disabled={isLoggingOut}
        variant="ghost"
        size="icon"
        className="hover:bg-amber-50 transition-colors group"
        title="Sign out"
      >
        <Power
          className={`w-5 h-5 transition-colors ${
            isLoggingOut
              ? "text-red-600 animate-pulse"
              : "text-amber-600 group-hover:text-amber-700"
          }`}
        />
      </Button>
    </div>
  );
}
