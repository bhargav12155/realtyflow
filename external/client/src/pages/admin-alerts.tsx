import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/layout/sidebar";
import type { Notification } from "@shared/schema";

interface AdminAlertData {
  source?: string;
  severity?: "info" | "warning" | "error";
  title?: string;
  message?: string;
  context?: Record<string, unknown>;
}

const SEVERITY_STYLES: Record<
  NonNullable<AdminAlertData["severity"]>,
  { badge: string; label: string }
> = {
  info: {
    badge:
      "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    label: "Info",
  },
  warning: {
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    label: "Warning",
  },
  error: {
    badge:
      "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    label: "Error",
  },
};

function formatTimestamp(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export default function AdminAlertsPage() {
  const [, setLocation] = useLocation();
  const [severity, setSeverity] = useState<string>("all");
  const [source, setSource] = useState<string>("all");

  const adminStatus = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/user/is-admin"],
  });

  const notificationsQuery = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: adminStatus.data?.isAdmin === true,
    refetchInterval: 60_000,
  });

  const alerts = useMemo(() => {
    return (notificationsQuery.data ?? [])
      .filter((n) => n.type === "admin_alert")
      .map((n) => ({
        id: n.id,
        createdAt: n.createdAt,
        isRead: n.isRead,
        data: (n.data ?? {}) as AdminAlertData,
      }));
  }, [notificationsQuery.data]);

  const sources = useMemo(() => {
    const set = new Set<string>();
    for (const a of alerts) {
      if (a.data.source) set.add(String(a.data.source));
    }
    return Array.from(set).sort();
  }, [alerts]);

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (severity !== "all" && (a.data.severity ?? "error") !== severity) {
        return false;
      }
      if (source !== "all" && (a.data.source ?? "") !== source) {
        return false;
      }
      return true;
    });
  }, [alerts, severity, source]);

  if (adminStatus.isLoading) {
    return (
      <div className="p-8 text-sm text-neutral-500" data-testid="text-admin-alerts-loading">
        Checking access...
      </div>
    );
  }

  if (!adminStatus.data?.isAdmin) {
    return (
      <div
        className="max-w-xl mx-auto mt-16 rounded-xl border border-neutral-200 dark:border-neutral-800 p-8 text-center"
        data-testid="text-admin-alerts-forbidden"
      >
        <ShieldAlert className="w-8 h-8 mx-auto text-red-500 mb-2" />
        <div className="text-base font-medium mb-1">Admins only</div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
          You don't have permission to view infrastructure alerts.
        </p>
        <button
          type="button"
          className="text-sm text-blue-600 hover:underline"
          onClick={() => setLocation("/dashboard")}
          data-testid="link-back-to-dashboard"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar activeView="admin-alerts" />
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8" data-testid="page-admin-alerts">
      <title>Infrastructure Alerts | Admin</title>
      <meta
        name="description"
        content="Review recent infrastructure alerts surfaced to admins, filterable by severity and source."
      />

      <header className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100"
            data-testid="text-admin-alerts-heading"
          >
            Infrastructure Alerts
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Recent admin notifications from monitored systems. Newest first.
          </p>
        </div>
        <Badge variant="outline" data-testid="badge-admin-alerts-count">
          {filtered.length} {filtered.length === 1 ? "alert" : "alerts"}
        </Badge>
      </header>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500 dark:text-neutral-400">Severity</label>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger className="w-[160px]" data-testid="select-admin-alerts-severity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="option-severity-all">All severities</SelectItem>
              <SelectItem value="info" data-testid="option-severity-info">Info</SelectItem>
              <SelectItem value="warning" data-testid="option-severity-warning">Warning</SelectItem>
              <SelectItem value="error" data-testid="option-severity-error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500 dark:text-neutral-400">Source</label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-[200px]" data-testid="select-admin-alerts-source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="option-source-all">All sources</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s} value={s} data-testid={`option-source-${s}`}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {notificationsQuery.isLoading ? (
        <div className="py-12 text-center text-sm text-neutral-500" data-testid="text-admin-alerts-loading-list">
          Loading alerts...
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="py-16 text-center text-sm text-neutral-500 dark:text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl"
          data-testid="text-admin-alerts-empty"
        >
          No infrastructure alerts match these filters.
        </div>
      ) : (
        <ul className="space-y-3" data-testid="list-admin-alerts">
          {filtered.map((a) => {
            const sev = (a.data.severity ?? "error") as keyof typeof SEVERITY_STYLES;
            const sevStyle = SEVERITY_STYLES[sev];
            const ctx = a.data.context;
            const hasCtx = ctx && typeof ctx === "object" && Object.keys(ctx).length > 0;
            return (
              <li
                key={a.id}
                className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
                data-testid={`row-admin-alert-${a.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <AlertTriangle className="w-4 h-4 mt-0.5 text-red-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className={`text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded ${sevStyle.badge}`}
                          data-testid={`badge-admin-alert-severity-${a.id}`}
                        >
                          {sevStyle.label}
                        </span>
                        {a.data.source && (
                          <span
                            className="text-[11px] text-neutral-500 dark:text-neutral-400"
                            data-testid={`text-admin-alert-source-${a.id}`}
                          >
                            {a.data.source}
                          </span>
                        )}
                      </div>
                      <div
                        className="text-sm font-medium text-neutral-900 dark:text-neutral-100"
                        data-testid={`text-admin-alert-title-${a.id}`}
                      >
                        {a.data.title ?? "Admin alert"}
                      </div>
                      {a.data.message && (
                        <div
                          className="text-sm text-neutral-600 dark:text-neutral-300 mt-1 break-words"
                          data-testid={`text-admin-alert-message-${a.id}`}
                        >
                          {a.data.message}
                        </div>
                      )}
                      {hasCtx && (
                        <details className="mt-2">
                          <summary
                            className="text-[11px] text-neutral-500 dark:text-neutral-400 cursor-pointer"
                            data-testid={`toggle-admin-alert-context-${a.id}`}
                          >
                            Context
                          </summary>
                          <pre
                            className="mt-1 text-[11px] bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded p-2 overflow-x-auto"
                            data-testid={`text-admin-alert-context-${a.id}`}
                          >
                            {JSON.stringify(ctx, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                  <div
                    className="text-[11px] text-neutral-400 dark:text-neutral-500 whitespace-nowrap"
                    data-testid={`text-admin-alert-time-${a.id}`}
                  >
                    {formatTimestamp(a.createdAt)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
        </div>
      </main>
    </div>
  );
}
