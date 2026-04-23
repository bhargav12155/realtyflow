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
import { AlertTriangle, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import type { HeygenShapeDriftIncident } from "@shared/schema";

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

export default HeygenShapeDriftIncidentsPanel;
