import { useEffect, useState } from "react";
import { OnboardingCarousel } from "@/components/onboarding/OnboardingCarousel";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/authToken";

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

  // Fetch current user
  const { data: user, isLoading, isError } = useQuery<User>({
    queryKey: ["user", "me"],
    retry: false,
    queryFn: async () => {
      const response = await fetch("/api/users/me", {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch user");
      return response.json();
    },
  });

  // Mark onboarding as complete
  const completeOnboarding = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/users/onboarding/complete", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        credentials: "include",
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
    if (isError) {
      setShowOnboarding(false);
      return;
    }

    if (user) {
      setShowOnboarding(!user.hasCompletedOnboarding);
    } else {
      setShowOnboarding(false);
    }
  }, [user, isError]);

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
