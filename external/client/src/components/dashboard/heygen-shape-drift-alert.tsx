import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw } from "lucide-react";
import { HEYGEN_SHAPE_DRIFT_ERROR_CODE } from "@shared/heygenPhotoAvatarSchemas";

export interface HeygenShapeDriftDetails {
  endpoint: string;
  message: string;
  issuePaths: string[];
}

/**
 * Try to interpret a parsed JSON error body as a HeyGen shape-drift
 * envelope. Returns `null` when the body does not carry the
 * `heygen_shape_drift` error code so callers can fall back to their
 * existing handling.
 */
export function tryParseShapeDriftBody(
  parsed: unknown,
): HeygenShapeDriftDetails | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  if (p.error !== HEYGEN_SHAPE_DRIFT_ERROR_CODE) return null;
  return {
    endpoint:
      typeof p.endpoint === "string" && p.endpoint
        ? p.endpoint
        : "(unknown HeyGen endpoint)",
    message:
      typeof p.message === "string" && p.message
        ? p.message
        : "HeyGen returned an unexpected response shape.",
    issuePaths: Array.isArray(p.issuePaths)
      ? p.issuePaths.filter((x): x is string => typeof x === "string")
      : [],
  };
}

/**
 * Parse the `${status}: ${body}` string `apiRequest` throws on a non-2xx
 * response, looking specifically for a HeyGen shape-drift envelope.
 * Returns null when the body is not JSON or not a shape-drift envelope.
 */
export function parseShapeDriftFromApiError(
  err: unknown,
): HeygenShapeDriftDetails | null {
  if (!(err instanceof Error)) return null;
  const m = err.message.match(/^(\d+):\s*([\s\S]*)$/);
  const rest = m ? m[2] : err.message;
  try {
    return tryParseShapeDriftBody(JSON.parse(rest));
  } catch {
    return null;
  }
}

interface HeygenShapeDriftAlertProps {
  details: HeygenShapeDriftDetails;
  /** Stable suffix appended to data-testids (`alert-heygen-shape-drift-${scope}`). */
  scope: string;
  /** Label for the contextual line appearing in the copy block (e.g. "group"). */
  scopeLabel?: string;
  /** Contextual value for the scope line (e.g. the HeyGen group id). */
  scopeValue?: string;
  /** Phrase used in the "We hit … while {action}" sentence. */
  action: string;
  /**
   * Optional one-click retry hook. When provided, a "Retry" button is
   * rendered next to the "Copy details" button so the user can re-run
   * the failing HeyGen call without rebuilding their input. Pair with
   * `isRetrying` to show a spinner / disable the button while the
   * retry request is in flight.
   */
  onRetry?: () => void;
  /** When true the retry button shows a spinner and is disabled. */
  isRetrying?: boolean;
}

/**
 * Destructive Alert that renders the same copy-pastable HeyGen
 * shape-drift notice across every panel that talks to a HeyGen route.
 * Reused by the V3 Looks panel, the Voices browser, and the Voice
 * Designer so operators always see the offending endpoint and zod
 * issue paths in one place.
 */
export function HeygenShapeDriftAlert({
  details,
  scope,
  scopeLabel,
  scopeValue,
  action,
  onRetry,
  isRetrying,
}: HeygenShapeDriftAlertProps) {
  const { toast } = useToast();
  const issues = details.issuePaths.join(", ") || "(none)";
  const scopeLine =
    scopeLabel && scopeValue
      ? `${scopeLabel.padEnd(8)}: ${scopeValue}\n`
      : "";
  const detailsBlock =
    `error:    ${HEYGEN_SHAPE_DRIFT_ERROR_CODE}\n` +
    `endpoint: ${details.endpoint}\n` +
    scopeLine +
    `issues:   ${issues}\n` +
    `message:  ${details.message}`;
  const copyBlob = detailsBlock.replace(/^([a-z]+):\s+/gm, "$1: ");

  return (
    <Alert
      variant="destructive"
      data-testid={`alert-heygen-shape-drift-${scope}`}
    >
      <AlertTitle className="text-xs">
        HeyGen returned an unexpected response shape — please retry
      </AlertTitle>
      <AlertDescription className="text-xs space-y-2">
        <p>
          We hit a <code>{HEYGEN_SHAPE_DRIFT_ERROR_CODE}</code> error while{" "}
          {action}. If retrying doesn't help, copy the details below and
          forward them to support.
        </p>
        <pre
          className="whitespace-pre-wrap break-all rounded bg-red-950/40 text-red-100 p-2 text-[10px] font-mono select-all"
          data-testid={`text-heygen-shape-drift-details-${scope}`}
        >
          {detailsBlock}
        </pre>
        <div className="flex flex-wrap gap-2">
        {onRetry && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] px-2"
            onClick={onRetry}
            disabled={isRetrying}
            data-testid={`button-retry-heygen-shape-drift-${scope}`}
          >
            {isRetrying ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Retrying…
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </>
            )}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-[10px] px-2"
          onClick={() => {
            if (typeof navigator !== "undefined" && navigator.clipboard) {
              navigator.clipboard
                .writeText(copyBlob)
                .then(() =>
                  toast({
                    title: "Copied error details",
                    description: "Paste this into your support ticket.",
                  }),
                )
                .catch(() =>
                  toast({
                    title: "Couldn't copy automatically",
                    description:
                      "Select the details above and copy manually.",
                    variant: "destructive",
                  }),
                );
            }
          }}
          data-testid={`button-copy-heygen-shape-drift-${scope}`}
        >
          Copy details
        </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Build a destructive toast description that, while less prominent than
 * the dedicated alert, still includes the offending HeyGen endpoint and
 * zod issue paths so operators have something concrete to forward to
 * support. Used by flows that don't render an inline alert region.
 */
export function shapeDriftToast(
  details: HeygenShapeDriftDetails,
): { title: string; description: string } {
  const issues = details.issuePaths.join(", ") || "(none)";
  return {
    title: "HeyGen returned an unexpected response shape",
    description: `${details.message}\n\nendpoint: ${details.endpoint}\nissues: ${issues}`,
  };
}
