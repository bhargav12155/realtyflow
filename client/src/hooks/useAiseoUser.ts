import { useEffect, useState } from "react";

interface AiseoUser {
  id: string;
  email: string;
  name?: string;
  sourceApp?: string; // e.g., "acai-freeman"
  [key: string]: any;
}

/**
 * Hook to manage user data passed from parent app (Açaí Freeman)
 * Parent app should call:
 * 1. Via localStorage: localStorage.setItem('aiseo_user', JSON.stringify(userData))
 * 2. Via postMessage: window.postMessage({ type: 'AISEO_USER', user: userData }, '*')
 * 3. Via URL params: ?user=base64encodedJSON
 */
export function useAiseoUser() {
  const [user, setUser] = useState<AiseoUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeUser = () => {
      try {
        // Check localStorage first
        const storedUser = localStorage.getItem("aiseo_user");
        if (storedUser) {
          setUser(JSON.parse(storedUser));
          setIsLoading(false);
          return;
        }

        // Check URL params
        const params = new URLSearchParams(window.location.search);
        const userParam = params.get("user");
        if (userParam) {
          try {
            const decodedUser = JSON.parse(atob(userParam));
            setUser(decodedUser);
            localStorage.setItem("aiseo_user", JSON.stringify(decodedUser));
            setIsLoading(false);
            return;
          } catch (e) {
            console.error("Failed to parse user from URL:", e);
          }
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Error initializing user:", error);
        setIsLoading(false);
      }
    };

    // Listen for postMessage from parent app
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "AISEO_USER" && event.data.user) {
        setUser(event.data.user);
        localStorage.setItem("aiseo_user", JSON.stringify(event.data.user));
      }
    };

    window.addEventListener("message", handleMessage);
    initializeUser();

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const logout = () => {
    setUser(null);
    localStorage.removeItem("aiseo_user");
    // In a real app, also clear JWT tokens here
  };

  return { user, isLoading, logout };
}
