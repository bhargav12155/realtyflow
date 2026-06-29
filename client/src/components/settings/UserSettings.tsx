import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { User, Mail } from "lucide-react";
import { CompanyProfile } from "./CompanyProfile";
import { SocialSetupReminder } from "@/components/dashboard/social-setup-reminder";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UserSettingsResponse {
  emailNotifications?: boolean;
}

export function UserSettings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("account");
  const { toast } = useToast();

  const { data: settings, isLoading: settingsLoading } = useQuery<UserSettingsResponse>({
    queryKey: ["/api/user/settings"],
  });

  const [emailNotifications, setEmailNotifications] = useState(true);

  useEffect(() => {
    if (settings && typeof settings.emailNotifications === "boolean") {
      setEmailNotifications(settings.emailNotifications);
    }
  }, [settings]);

  const emailMutation = useMutation({
    mutationFn: async (next: boolean) => {
      await apiRequest("POST", "/api/user/settings", {
        emailNotifications: next,
      });
    },
    onSuccess: (_data, next) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/settings"] });
      toast({
        title: next ? "Emails turned on" : "Emails turned off",
        description: next
          ? "You'll receive transactional emails like board-share notifications."
          : "You won't receive transactional emails like board-share notifications.",
      });
    },
    onError: (error: Error) => {
      setEmailNotifications((prev) => !prev);
      toast({
        title: "Couldn't update email setting",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEmailToggle = (next: boolean) => {
    setEmailNotifications(next);
    emailMutation.mutate(next);
  };

  return (
    <div className="space-y-6">
      <SocialSetupReminder
        onSetupClick={() => setActiveTab("social")}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            Notifications
          </TabsTrigger>
          <TabsTrigger value="company">Company Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={user?.email || ""} disabled />
                  </div>
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={user?.name || user?.email || ""}
                      disabled
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="role">Account Type</Label>
                  <Input id="role" value={user?.type || ""} disabled />
                </div>
                <div>
                  <Label htmlFor="id">User ID</Label>
                  <Input id="id" value={user?.id || ""} disabled />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Notifications
              </CardTitle>
              <CardDescription>
                Choose whether to receive transactional emails such as
                "a board was shared with you" notifications.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="email-notifications" className="text-base">
                      Send me transactional emails
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Turn this off to stop receiving board-share emails and
                      other account notifications.
                    </p>
                  </div>
                  <Switch
                    id="email-notifications"
                    data-testid="switch-email-notifications"
                    checked={emailNotifications}
                    onCheckedChange={handleEmailToggle}
                    disabled={settingsLoading || emailMutation.isPending}
                  />
                </div>

              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company">
          <CompanyProfile />
        </TabsContent>
      </Tabs>
    </div>
  );
}
