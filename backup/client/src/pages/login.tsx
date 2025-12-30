import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, User, ArrowRight } from "lucide-react";

interface LoginPageProps {
  onSuccess?: () => void;
}

export default function LoginPage({ onSuccess }: LoginPageProps) {
  const { universalLogin, error, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [userIdentifier, setUserIdentifier] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isAutoLogging, setIsAutoLogging] = useState(false);

  const handleLoginSuccess = () => {
    if (onSuccess) {
      onSuccess();
    } else {
      // Navigate to dashboard if no onSuccess callback provided
      setLocation("/");
    }
  };

  // Detect if we're in an iframe
  const isInIframe = () => {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true; // If we can't access window.top due to same-origin policy, we're likely in an iframe
    }
  };

  // Listen for postMessage from iMakePage parent window
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Validate origin for security (adjust allowed origins as needed)
      const allowedOrigins = [
        "https://www.imakepage.com",
        "https://imakepage.com",
      ];

      if (!allowedOrigins.includes(event.origin)) {
        return; // Ignore messages from untrusted origins
      }

      // Check if message contains iMakePage user data
      if (
        event.data &&
        event.data.source === "imakepage" &&
        event.data.userData
      ) {
        console.log("Received iMakePage user data via postMessage");
        setIsAutoLogging(true);

        try {
          const { userData } = event.data;

          // Extract identifier from iMakePage user data
          const identifier =
            userData.email ||
            userData.userEmail ||
            userData.profile?.email ||
            userData.user?.email;

          if (identifier) {
            setUserIdentifier(identifier);
            const loginResult = await universalLogin(identifier);

            if (loginResult.success) {
              setSuccess("Welcome from iMakePage!");
              setTimeout(() => handleLoginSuccess(), 1000);
            } else {
              setLocalError(
                "Auto-login failed. Please enter your identifier manually.",
              );
            }
          } else {
            setLocalError("Unable to extract user information from iMakePage.");
          }
        } catch (error) {
          console.error("iMakePage postMessage login error:", error);
          setLocalError(
            "Auto-login failed. Please enter your identifier manually.",
          );
        } finally {
          setIsAutoLogging(false);
        }
      }
    };

    // Add event listener for postMessage
    window.addEventListener("message", handleMessage);

    // Request user data from parent if in iframe
    if (isInIframe()) {
      console.log("In iframe - requesting user data from parent window");
      window.parent.postMessage(
        { source: "realtyflow", action: "requestUserData" },
        "*", // Will be validated by the parent
      );
    }

    // Cleanup
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [universalLogin, onSuccess]);

  // Check for auto-login from URL parameters (iMakePage or NebraskaHomeHub)
  useEffect(() => {
    const checkAutoLogin = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const userEmail = urlParams.get("userEmail");
      const autoLogin = urlParams.get("autoLogin");
      const source = urlParams.get("source");

      // Priority 1: iMakePage URL parameters
      if (autoLogin === "true" && userEmail && source === "imakepage") {
        console.log(
          "Auto-login detected from iMakePage URL params for:",
          userEmail,
        );
        setIsAutoLogging(true);
        setUserIdentifier(userEmail);

        try {
          const loginResult = await universalLogin(userEmail);

          if (loginResult.success) {
            setSuccess("Welcome from iMakePage!");
            setTimeout(() => handleLoginSuccess(), 1000);
          } else {
            setLocalError(
              loginResult.message ||
                "Auto-login failed. Please enter your identifier manually.",
            );
          }
        } catch (error) {
          console.error("Auto-login error:", error);
          setLocalError(
            "Auto-login failed. Please enter your identifier manually.",
          );
        } finally {
          setIsAutoLogging(false);
        }
        return;
      }

      // Priority 2: NebraskaHomeHub URL parameters
      if (autoLogin === "true" && userEmail && source === "nebraska-home-hub") {
        console.log("Auto-login detected from NebraskaHomeHub for:", userEmail);
        setIsAutoLogging(true);
        setUserIdentifier(userEmail);

        try {
          const loginResult = await universalLogin(userEmail);

          if (loginResult.success) {
            setSuccess("Welcome from NebraskaHomeHub!");
            setTimeout(() => handleLoginSuccess(), 1000);
          } else {
            setLocalError(
              loginResult.message ||
                "Auto-login failed. Please enter your identifier manually.",
            );
          }
        } catch (error) {
          console.error("Auto-login error:", error);
          setLocalError(
            "Auto-login failed. Please enter your identifier manually.",
          );
        } finally {
          setIsAutoLogging(false);
        }
      }
    };

    checkAutoLogin();
  }, [universalLogin, onSuccess]);

  // Handle universal login - determine user type automatically
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccess(null);

    if (!userIdentifier.trim()) {
      setLocalError("Please enter a user identifier");
      return;
    }

    const identifier = userIdentifier.trim();

    // Use the new universal login method
    const loginResult = await universalLogin(identifier);

    if (loginResult.success) {
      setSuccess("Welcome to RealtyFlow!");
      setTimeout(() => handleLoginSuccess(), 1000);
    } else {
      setLocalError(
        loginResult.message ||
          "Authentication failed. Please check your identifier.",
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">RealtyFlow</CardTitle>
          <CardDescription>Multi-User Real Estate Platform</CardDescription>
        </CardHeader>

        <CardContent>
          {/* Show errors/success */}
          {(error || localError) && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertDescription className="text-red-800">
                {error || localError}
              </AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4 border-green-200 bg-green-50">
              <AlertDescription className="text-green-800">
                {success}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="text-center mb-6">
              <User className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <h3 className="text-lg font-medium text-gray-900">Welcome</h3>
              <p className="text-sm text-gray-500 mt-1">
                Enter your identifier to continue
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="userIdentifier">User Identifier</Label>
              <Input
                id="userIdentifier"
                type="text"
                value={userIdentifier}
                onChange={(e) => setUserIdentifier(e.target.value)}
                placeholder="Enter your email or agent code"
                disabled={isLoading}
                className="text-center"
                autoFocus
              />
              <p className="text-xs text-gray-500 text-center">
                We'll automatically detect your access level
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || isAutoLogging}
            >
              {isLoading || isAutoLogging ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isAutoLogging
                    ? "Auto-signing you in..."
                    : "Signing you in..."}
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="text-center">
              <p className="text-xs text-gray-500">
                Use your email address for client access
                <br />
                or agent code for professional features
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
