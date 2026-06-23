import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import LoginPage from "@/pages/login";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
  requireAgent?: boolean;
  requirePublic?: boolean;
  fallback?: ReactNode;
}

export default function ProtectedRoute({
  children,
  requireAuth = true,
  requireAgent = false,
  requirePublic = false,
  fallback,
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // If authentication is required but user is not logged in
  if (requireAuth && !user) {
    return fallback || <LoginPage />;
  }

  // If specific user type is required
  if (requireAgent && (!user || user.type !== "agent")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.99-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Agent Access Required
          </h2>
          <p className="text-gray-600 mb-4">
            This page is restricted to registered real estate agents only.
          </p>
          <button
            onClick={() => (window.location.href = "/login")}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            Login as Agent
          </button>
        </div>
      </div>
    );
  }

  if (requirePublic && (!user || user.type !== "public")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.99-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Client Access Required
          </h2>
          <p className="text-gray-600 mb-4">
            This page requires client access through an agent portal.
          </p>
          <button
            onClick={() => (window.location.href = "/login")}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            Access Client Portal
          </button>
        </div>
      </div>
    );
  }

  // If all checks pass, render the protected content
  return <>{children}</>;
}
