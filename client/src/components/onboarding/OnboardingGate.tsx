import { useEffect, useState } from "react";
import { OnboardingCarousel } from "@/components/onboarding/OnboardingCarousel";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clearAuthToken, getAuthHeaders, getAuthToken } from "@/lib/authToken";

interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  hasCompletedOnboarding: boolean;
}

interface OnboardingGateProps {
  children: React.ReactNode;
}

export function OnboardingGate({ children }: OnboardingGateProps) {
  const queryClient = useQueryClient();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const authToken = getAuthToken();

  // Fetch current user
  const { data: user, isError, isFetched } = useQuery<User>({
    queryKey: ["user", "me"],
    enabled: !!authToken,
    retry: false,
    queryFn: async () => {
      const response = await fetch("/api/users/me", {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (response.status === 401) {
        clearAuthToken();
      }
      if (!response.ok) throw new Error("Failed to fetch user");
      return response.json();
    },
  });

  // Mark onboarding as complete
  const completeOnboarding = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/users/onboarding/complete", {
        method: "POST",
        credentials: "include",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) throw new Error("Failed to complete onboarding");
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
      setShowOnboarding(false);
    },
  });

  useEffect(() => {
    // If user is not logged in, do not block app render behind onboarding.
    if (!authToken) {
      setIsLoading(false);
      setShowOnboarding(false);
      return;
    }

    // Fail open on auth/query failure to avoid infinite loading loops.
    if (isError) {
      setIsLoading(false);
      setShowOnboarding(false);
      return;
    }

    if (user !== undefined) {
      setIsLoading(false);
      if (!user?.hasCompletedOnboarding) {
        setShowOnboarding(true);
      } else {
        setShowOnboarding(false);
      }
    }
  }, [authToken, isError, isFetched, user]);

  if (isLoading) {
    // Show a loading state while fetching user data
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <>
      {showOnboarding && (
        <OnboardingCarousel
          onComplete={() => completeOnboarding.mutate()}
        />
      )}
      {children}
    </>
  );
}
