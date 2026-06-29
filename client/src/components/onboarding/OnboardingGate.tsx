import { useEffect, useState } from "react";
import { OnboardingCarousel } from "@/components/onboarding/OnboardingCarousel";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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

  // Fetch current user
  const { data: user } = useQuery<User>({
    queryKey: ["user", "me"],
    queryFn: async () => {
      const response = await fetch("/api/users/me", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
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
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
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
    if (user !== undefined) {
      setIsLoading(false);
      if (!user?.hasCompletedOnboarding) {
        setShowOnboarding(true);
      } else {
        setShowOnboarding(false);
      }
    }
  }, [user]);

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
