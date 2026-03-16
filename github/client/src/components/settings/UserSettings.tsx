import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User } from "lucide-react";
import { CompanyProfile } from "./CompanyProfile";
import { SocialSetupReminder } from "@/components/dashboard/social-setup-reminder";

export function UserSettings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("account");

  return (
    <div className="space-y-6">
      <SocialSetupReminder
        onSetupClick={() => setActiveTab("social")}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="account">Account</TabsTrigger>
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

        <TabsContent value="company">
          <CompanyProfile />
        </TabsContent>
      </Tabs>
    </div>
  );
}
