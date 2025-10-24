import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { SocialMediaSetup } from "@/components/setup/social-media-setup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  ExternalLink,
  CheckCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export default function IntegrationPage() {
  const { user, isLoading, universalLogin } = useAuth();
  const [, setLocation] = useLocation();
  const [showSetup, setShowSetup] = useState(false);
  const [isAutoLogging, setIsAutoLogging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for auto-login parameters from NebraskaHomeHub
  useEffect(() => {
    const checkAutoLogin = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const userEmail = urlParams.get("userEmail");
      const autoLogin = urlParams.get("autoLogin");
      const source = urlParams.get("source");

      // If coming from NebraskaHomeHub with auto-login
      if (autoLogin === "true" && userEmail && source === "nebraska-home-hub") {
        setIsAutoLogging(true);
        setError(null);

        try {
          const loginResult = await universalLogin(userEmail);

          if (loginResult.success) {
            // Successful auto-login, show setup
            setShowSetup(true);
          } else {
            // Auto-login failed, but still show public access
            setError(
              "Auto-login failed, but you can still access the tools below."
            );
            setShowSetup(true); // Allow public access to setup
          }
        } catch (error) {
          console.error("Auto-login error:", error);
          setError("Connection issue. You can still access the tools below.");
          setShowSetup(true); // Allow public access
        } finally {
          setIsAutoLogging(false);
        }
      } else if (source === "nebraska-home-hub") {
        // Coming from NebraskaHomeHub without auto-login
        setShowSetup(true);
      }
    };

    checkAutoLogin();
  }, [universalLogin]);

  const handleGoToDashboard = () => {
    setLocation("/");
  };

  const handleSetupComplete = () => {
    setShowSetup(false);
    setLocation("/");
  };

  const handleSkipSetup = () => {
    setShowSetup(false);
    setLocation("/");
  };

  // Loading state
  if (isLoading || isAutoLogging) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-blue-600" />
            <h3 className="text-lg font-semibold mb-2">
              {isAutoLogging
                ? "Connecting from NebraskaHomeHub..."
                : "Loading..."}
            </h3>
            <p className="text-gray-600">
              Setting up your AI-SEO and Social Media tools...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Sparkles className="w-10 h-10 text-blue-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900">
              RealtyFlow AI-SEO
            </h1>
          </div>
          <p className="text-xl text-gray-600 mb-2">
            Social Media & Content Management
          </p>
          <p className="text-sm text-gray-500">
            Connected from NebraskaHomeHub
          </p>

          {user && (
            <div className="mt-4">
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Welcome back, {user.email}! You're successfully connected from
                  your NebraskaHomeHub account.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {error && (
            <div className="mt-4">
              <Alert className="border-orange-200 bg-orange-50">
                <AlertDescription className="text-orange-800">
                  {error}
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Social Media Setup */}
          <Card className="relative overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-pink-500 to-purple-600 text-white">
              <CardTitle className="flex items-center">
                <ExternalLink className="w-5 h-5 mr-2" />
                Social Media Setup
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-gray-600 mb-4">
                Configure your social media accounts for automated posting. You
                can always set this up later from Settings.
              </p>
              <div className="bg-blue-50 p-3 rounded-lg mb-4">
                <p className="text-sm text-blue-800">
                  💡 <strong>Pro tip:</strong> Setting up now enables automatic
                  content posting to Facebook, Instagram, Twitter, and more!
                </p>
              </div>
              <div className="space-y-3">
                <Button
                  onClick={() => setShowSetup(true)}
                  className="w-full"
                  variant={user ? "default" : "outline"}
                >
                  Set Up Social Media Now
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  onClick={handleSkipSetup}
                  variant="ghost"
                  className="w-full text-gray-600 hover:text-gray-800"
                >
                  Skip for now, go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Dashboard Access */}
          <Card className="relative overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
              <CardTitle className="flex items-center">
                <Sparkles className="w-5 h-5 mr-2" />
                Full Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-gray-600 mb-4">
                Access the complete RealtyFlow dashboard with AI content
                generation, SEO tools, and more.
              </p>
              <Button
                onClick={handleGoToDashboard}
                className="w-full"
                variant={user ? "default" : "outline"}
              >
                {user ? "Open" : "Access"} Dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Info Section */}
        <div className="mt-8 text-center">
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <h3 className="text-lg font-semibold mb-2">
              What you get with RealtyFlow:
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
              <div className="flex items-center justify-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>AI Content Generation</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Social Media Automation</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>SEO Optimization</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Connected from NebraskaHomeHub • Secure Integration • Real Estate
              AI Tools
            </p>
          </div>
        </div>
      </div>

      {/* Social Media Setup Modal */}
      {showSetup && (
        <SocialMediaSetup
          isOpen={showSetup}
          onClose={() => setShowSetup(false)}
          onComplete={handleSetupComplete}
        />
      )}
    </div>
  );
}
