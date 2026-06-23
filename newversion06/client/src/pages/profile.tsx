import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return <div>Loading...</div>;
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">Your Profile</h1>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>User Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xl font-medium">
                  {getInitials(user.name || user.email)}
                </AvatarFallback>
              </Avatar>

              <div>
                <h2 className="text-xl font-semibold">{user.name || "User"}</h2>
                <p className="text-gray-500">{user.email}</p>

                <div className="mt-2">
                  {user.type === "agent" ? (
                    <Badge className="bg-blue-100 text-blue-800">Agent</Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-800">
                      Client
                    </Badge>
                  )}

                  {user.type === "agent" && user.username && (
                    <p className="text-sm text-gray-500 mt-1">
                      @{user.username}
                    </p>
                  )}
                  {user.type === "public" && user.agentSlug && (
                    <p className="text-sm text-gray-500 mt-1">
                      Connected to: @{user.agentSlug}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              View your account information and membership details.
            </p>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Account Type:</span>
                <span className="font-medium">
                  {user.type === "agent" ? "Real Estate Agent" : "Client"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Member Since:</span>
                <span className="font-medium">October 2025</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Last Login:</span>
                <span className="font-medium">Today</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
