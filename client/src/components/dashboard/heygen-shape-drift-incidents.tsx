import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import type {
  HeygenShapeDriftIncident,
  HeygenShapeDriftRetentionRun,
} from "@shared/schema";

interface IncidentsResponse {
  incidents: HeygenShapeDriftIncident[];
}

const QUERY_KEY = ["/api/v3/admin/heygen-shape-drift-incidents"] as const;

function formatTimestamp(ts: string | Date): string {
  const d = typeof ts === "string" ? new Date(ts) : ts;
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString();
}

function IncidentRow({ incident }: { incident: HeygenShapeDriftIncident }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TableRow data-testid={`row-heygen-incident-${incident.id}`}>
        <TableCell className="align-top">
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                data-testid={`button-expand-heygen-incident-${incident.id}`}
                aria-label={open ? "Collapse details" : "Expand details"}
              >
                {open ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </TableCell>
        <TableCell
          className="font-mono text-xs align-top"
          data-testid={`text-heygen-incident-endpoint-${incident.id}`}
        >
          {incident.endpoint}
        </TableCell>
        <TableCell
          className="text-xs align-top"
          data-testid={`text-heygen-incident-user-${incident.id}`}
        >
          {incident.userId ?? (
            <span className="text-muted-foreground italic">—</span>
          )}
        </TableCell>
        <TableCell
          className="text-xs align-top"
          data-testid={`text-heygen-incident-group-${incident.id}`}
        >
          {incident.groupId ?? (
            <span className="text-muted-foreground italic">—</span>
          )}
        </TableCell>
        <TableCell
          className="text-xs whitespace-nowrap align-top"
          data-testid={`text-heygen-incident-timestamp-${incident.id}`}
        >
          {formatTimestamp(incident.createdAt)}
        </TableCell>
      </TableRow>
      {open && (
        <TableRow data-testid={`row-heygen-incident-details-${incident.id}`}>
          <TableCell colSpan={5} className="bg-muted/40">
            <div className="space-y-2 p-2">
              <div>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Issue paths
                </p>
                {incident.issuePaths.length === 0 ? (
                  <p className="text-xs italic text-muted-foreground">
                    (none)
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {incident.issuePaths.map((p, i) => (
                      <Badge
                        key={`${incident.id}-${i}`}
                        variant="outline"
                        className="font-mono text-[10px]"
                        data-testid={`badge-heygen-incident-issue-${incident.id}-${i}`}
                      >
                        {p}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Message
                </p>
                <pre
                  className="whitespace-pre-wrap break-all rounded bg-background border p-2 text-[11px] font-mono mt-1"
                  data-testid={`text-heygen-incident-message-${incident.id}`}
                >
                  {incident.message}
                </pre>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function HeygenShapeDriftIncidentsPanel() {
  const [endpointFilter, setEndpointFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");

  const { data, isLoading, isError, error, isFetching } =
    useQuery<IncidentsResponse>({
      queryKey: QUERY_KEY,
    });

  const filtered = useMemo(() => {
    const incidents = data?.incidents ?? [];
    const ef = endpointFilter.trim().toLowerCase();
    const uf = userFilter.trim().toLowerCase();
    return incidents.filter((i) => {
      if (ef && !i.endpoint.toLowerCase().includes(ef)) return false;
      if (uf && !(i.userId ?? "").toLowerCase().includes(uf)) return false;
      return true;
    });
  }, [data, endpointFilter, userFilter]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  };

  return (
    <Card data-testid="card-heygen-shape-drift-incidents">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              HeyGen shape drift
            </CardTitle>
            <CardDescription>
              Most recent <code>heygen_shape_drift</code> incidents recorded
              from the v3 routes. Use this to spot HeyGen API regressions
              without scraping production logs.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={isFetching}
            data-testid="button-refresh-heygen-incidents"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1.5 ${
                isFetching ? "animate-spin" : ""
              }`}
            />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input
            placeholder="Filter by endpoint (e.g. /v3/voices)"
            value={endpointFilter}
            onChange={(e) => setEndpointFilter(e.target.value)}
            data-testid="input-filter-heygen-endpoint"
          />
          <Input
            placeholder="Filter by user id"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            data-testid="input-filter-heygen-user"
          />
        </div>

        {isLoading ? (
          <div
            className="space-y-2"
            data-testid="loading-heygen-incidents"
          >
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : isError ? (
          <div
            className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm"
            data-testid="error-heygen-incidents"
          >
            Failed to load incidents:{" "}
            {error instanceof Error ? error.message : "unknown error"}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground"
            data-testid="empty-heygen-incidents"
          >
            {(data?.incidents.length ?? 0) === 0
              ? "No HeyGen shape-drift incidents recorded yet."
              : "No incidents match the current filters."}
          </div>
        ) : (
          <div className="rounded border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Endpoint</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((incident) => (
                  <IncidentRow key={incident.id} incident={incident} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface RetentionRunsResponse {
  runs: HeygenShapeDriftRetentionRun[];
}

const RETENTION_RUNS_QUERY_KEY = [
  "/api/v3/admin/heygen-shape-drift-retention-runs",
] as const;

export const STALE_RUN_THRESHOLD_MS = 36 * 60 * 60 * 1000;
export const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;

function formatDurationApprox(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

export function HeygenShapeDriftRetentionRunsPanel() {
  const { data, isLoading, isError, error, isFetching } =
    useQuery<RetentionRunsResponse>({
      queryKey: RETENTION_RUNS_QUERY_KEY,
    });

  const runs = data?.runs ?? [];
  const lastRun = runs[0];

  const lastRunMs = useMemo(() => {
    if (!lastRun) return null;
    const d =
      typeof lastRun.createdAt === "string"
        ? new Date(lastRun.createdAt)
        : lastRun.createdAt;
    const t = d?.getTime?.();
    if (!t || Number.isNaN(t)) return null;
    return t;
  }, [lastRun]);

  const lastRunAgeMs = lastRunMs === null ? null : Date.now() - lastRunMs;
  const nextDueAt =
    lastRunMs === null ? null : new Date(lastRunMs + RETENTION_INTERVAL_MS);

  const isStale =
    !isLoading &&
    !isError &&
    (lastRunAgeMs === null || lastRunAgeMs > STALE_RUN_THRESHOLD_MS);

  const staleMessage = !lastRun
    ? "No retention sweep has been recorded yet. If this server has been running for more than a day, the daily cron may not be firing — check logs and HEYGEN_SHAPE_DRIFT_RETENTION_DAYS configuration."
    : `The most recent retention sweep ran ${formatDurationApprox(
        lastRunAgeMs ?? 0,
      )} ago, which is past the ~36h staleness threshold. The daily cron may not be firing — check server logs.`;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: RETENTION_RUNS_QUERY_KEY });
  };

  return (
    <Card data-testid="card-heygen-shape-drift-retention-runs">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-muted-foreground" />
              Retention sweeps
            </CardTitle>
            <CardDescription>
              Daily background job that prunes old{" "}
              <code>heygen_shape_drift_incidents</code> rows. Most recent
              runs are listed below — use this to confirm the cron is firing
              on time.
              {lastRun ? (
                <>
                  {" "}
                  Last run{" "}
                  <span data-testid="text-heygen-retention-last-run">
                    {formatTimestamp(lastRun.createdAt)}
                  </span>{" "}
                  removed{" "}
                  <span data-testid="text-heygen-retention-last-deleted">
                    {lastRun.deletedCount}
                  </span>{" "}
                  row(s). Next sweep due{" "}
                  <span data-testid="text-heygen-retention-next-due">
                    {nextDueAt ? formatTimestamp(nextDueAt) : "—"}
                  </span>
                  .
                </>
              ) : null}
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={isFetching}
            data-testid="button-refresh-heygen-retention-runs"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1.5 ${
                isFetching ? "animate-spin" : ""
              }`}
            />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isLoading && !isError && isStale ? (
          <div
            className="flex items-start gap-2 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
            data-testid="alert-heygen-retention-stale"
            role="alert"
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 flex-shrink-0" />
            <div>
              <div className="font-medium text-amber-700 dark:text-amber-300">
                Daily HeyGen cleanup may not be running
              </div>
              <div
                className="text-xs text-muted-foreground mt-0.5"
                data-testid="text-heygen-retention-stale-message"
              >
                {staleMessage}
              </div>
            </div>
          </div>
        ) : null}
        {isLoading ? (
          <div
            className="space-y-2"
            data-testid="loading-heygen-retention-runs"
          >
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : isError ? (
          <div
            className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm"
            data-testid="error-heygen-retention-runs"
          >
            Failed to load retention runs:{" "}
            {error instanceof Error ? error.message : "unknown error"}
          </div>
        ) : runs.length === 0 ? (
          <div
            className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground"
            data-testid="empty-heygen-retention-runs"
          >
            No retention sweeps recorded yet. The job runs once a day in
            production.
          </div>
        ) : (
          <div className="rounded border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead className="text-right">Deleted</TableHead>
                  <TableHead className="text-right">
                    Retention (days)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow
                    key={run.id}
                    data-testid={`row-heygen-retention-run-${run.id}`}
                  >
                    <TableCell
                      className="text-xs whitespace-nowrap"
                      data-testid={`text-heygen-retention-timestamp-${run.id}`}
                    >
                      {formatTimestamp(run.createdAt)}
                    </TableCell>
                    <TableCell
                      className="text-xs text-right font-mono"
                      data-testid={`text-heygen-retention-deleted-${run.id}`}
                    >
                      {run.deletedCount}
                    </TableCell>
                    <TableCell
                      className="text-xs text-right font-mono"
                      data-testid={`text-heygen-retention-days-${run.id}`}
                    >
                      {run.retentionDays}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function HeygenShapeDriftDashboard() {
  return (
    <div className="space-y-6" data-testid="container-heygen-shape-drift">
      <HeygenShapeDriftIncidentsPanel />
      <HeygenShapeDriftRetentionRunsPanel />
    </div>
  );
}

export default HeygenShapeDriftIncidentsPanel;
