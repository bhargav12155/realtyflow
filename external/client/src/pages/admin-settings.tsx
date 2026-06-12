import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface HeygenAlertsSettings {
  enabled: boolean;
  webhookUrl: string | null;
}

interface HeygenAlertsSettingsResponse {
  settings: HeygenAlertsSettings;
  source: "admin" | "env" | "default";
  envFallbackConfigured: boolean;
}

interface AdminStatus {
  isAdmin: boolean;
}

function HeygenAlertsPanel() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<HeygenAlertsSettingsResponse>({
    queryKey: ["/api/admin/heygen-alerts/settings"],
  });

  const [enabled, setEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    if (data?.settings) {
      setEnabled(Boolean(data.settings.enabled));
      setWebhookUrl(data.settings.webhookUrl ?? "");
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      enabled: boolean;
      webhookUrl: string | null;
      skipTest?: boolean;
    }) => {
      return apiRequest(
        "PUT",
        "/api/admin/heygen-alerts/settings",
        payload,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/heygen-alerts/settings"],
      });
      toast({
        title: "HeyGen alert settings saved",
        description:
          "New burst alerts will be delivered using this configuration.",
      });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Failed to save settings";
      toast({
        title: "Could not save settings",
        description: message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (skipTest: boolean) => {
    const trimmed = webhookUrl.trim();
    saveMutation.mutate({
      enabled,
      webhookUrl: trimmed.length > 0 ? trimmed : null,
      skipTest,
    });
  };

  const sourceLabel =
    data?.source === "admin"
      ? "Admin-configured"
      : data?.source === "env"
        ? "Using environment fallback"
        : "Not configured";

  return (
    <Card data-testid="card-heygen-alerts-settings">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>HeyGen alert webhook</CardTitle>
            <CardDescription>
              Pick the Slack channel that gets paged when HeyGen
              responses start failing schema validation in bursts.
            </CardDescription>
          </div>
          <Badge variant="secondary" data-testid="badge-heygen-alerts-source">
            {sourceLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div
            className="flex items-center text-sm text-muted-foreground"
            data-testid="status-heygen-alerts-loading"
          >
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading current settings…
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="switch-heygen-alerts-enabled">
                  Send Slack alerts
                </Label>
                <p className="text-sm text-muted-foreground">
                  When off, burst alerts only land in the admin
                  dashboard bell.
                </p>
              </div>
              <Switch
                id="switch-heygen-alerts-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
                data-testid="switch-heygen-alerts-enabled"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="input-heygen-webhook-url">
                Slack incoming webhook URL
              </Label>
              <Input
                id="input-heygen-webhook-url"
                type="url"
                placeholder="https://hooks.slack.com/services/T.../B.../..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                data-testid="input-heygen-webhook-url"
              />
              <p className="text-xs text-muted-foreground">
                Saving will send a test message to this webhook to
                confirm it's reachable. Use "Save without test" if your
                webhook rejects synthetic traffic.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => onSubmit(false)}
                disabled={saveMutation.isPending}
                data-testid="button-save-heygen-alerts"
              >
                {saveMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Test &amp; save
              </Button>
              <Button
                variant="outline"
                onClick={() => onSubmit(true)}
                disabled={saveMutation.isPending}
                data-testid="button-save-heygen-alerts-skip-test"
              >
                Save without test
              </Button>
            </div>
            {data?.envFallbackConfigured ? (
              <p
                className="text-xs text-muted-foreground"
                data-testid="text-heygen-alerts-env-note"
              >
                A HEYGEN_BURST_SLACK_WEBHOOK_URL secret is also
                configured. The admin webhook above takes precedence
                when set.
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminSettingsPage() {
  const [, setLocation] = useLocation();
  const { data: adminStatus, isLoading: adminLoading } = useQuery<AdminStatus>({
    queryKey: ["/api/user/is-admin"],
  });

  useEffect(() => {
    if (!adminLoading && adminStatus && !adminStatus.isAdmin) {
      setLocation("/dashboard");
    }
  }, [adminLoading, adminStatus, setLocation]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar activeView="settings" />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto py-8 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Admin settings</h1>
            <p className="text-muted-foreground">
              Platform-wide controls for operators.
            </p>
          </div>

          {adminLoading ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking permissions…
            </div>
          ) : !adminStatus?.isAdmin ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" />
                  Admin access required
                </CardTitle>
                <CardDescription>
                  This page is only available to platform admins.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <HeygenAlertsPanel />
          )}
        </div>
      </main>
    </div>
  );
}
