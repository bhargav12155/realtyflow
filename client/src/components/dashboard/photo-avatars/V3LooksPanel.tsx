import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  HeygenShapeDriftAlert,
  type HeygenShapeDriftDetails,
  parseShapeDriftFromApiError,
  shapeDriftToast,
  tryParseShapeDriftBody,
} from "@/components/dashboard/heygen-shape-drift-alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ConsentStatus } from "./types";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  ShieldOff,
  Video,
} from "lucide-react";

const CONSENT_BADGE_CLASSES: Record<string, string> = {
  approved: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  revoked: "bg-red-100 text-red-700",
  unknown: "bg-gray-100 text-gray-600",
};

function consentBadgeClass(status: string | null | undefined): string {
  const key = (status ?? "unknown") || "unknown";
  return CONSENT_BADGE_CLASSES[key] ?? CONSENT_BADGE_CLASSES.unknown;
}

type V3Look = {
  id?: string;
  look_id?: string;
  name?: string;
  business_type?: string;
  image_url?: string;
  preview_image_url?: string;
  url?: string;
  photo_url?: string;
};

type V3LooksPage = {
  data: V3Look[];
  nextCursor: string | null;
};

function pickLookImage(look: V3Look): string | undefined {
  return look.image_url || look.preview_image_url || look.url || look.photo_url;
}

export function V3LooksPanel({
  heygenGroupId,
  consentStatus,
}: {
  heygenGroupId: string;
  consentStatus: ConsentStatus | null;
}) {
  const { toast } = useToast();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [history, setHistory] = useState<string[]>([]);
  const [pendingLookId, setPendingLookId] = useState<string | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approveVideoUrl, setApproveVideoUrl] = useState("");
  const [approveSignature, setApproveSignature] = useState("");

  const consentMutation = useMutation({
    mutationFn: async (payload: {
      action: "approve" | "revoke";
      consentVideoUrl?: string;
      signature?: string;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/v3/photo-avatars/${encodeURIComponent(heygenGroupId)}/consent`,
        payload,
      );
      return res.json();
    },
    onSuccess: (_data, vars) => {
      toast({
        title:
          vars.action === "revoke" ? "Consent revoked" : "Consent recorded",
        description:
          vars.action === "revoke"
            ? "This likeness can no longer be used for new generations."
            : "Thanks — the likeness is approved for video generation.",
      });
      setApproveDialogOpen(false);
      setApproveVideoUrl("");
      setApproveSignature("");
      queryClient.invalidateQueries({ queryKey: ["/api/photo-avatars/groups"] });
    },
    onError: (err: unknown) => {
      // Surface HeyGen shape drift with endpoint + issue paths in the
      // toast (see Voices/Looks panels for the full alert version) so
      // operators don't lose the upstream context.
      const drift = parseShapeDriftFromApiError(err);
      if (drift) {
        toast({ ...shapeDriftToast(drift), variant: "destructive" });
        return;
      }
      const message = err instanceof Error ? err.message : "Please try again.";
      toast({
        title: "Couldn't update consent",
        description: message,
        variant: "destructive",
      });
    },
  });

  // When the looks endpoint fails because HeyGen sent back a payload that
  // didn't match our zod schema, the server returns 502 with
  // `{ error: "heygen_shape_drift", endpoint, message, issuePaths }`. We
  // capture that body so the dashboard can render a copy-pastable notice
  // instead of the generic "still training" placeholder.
  const { data, isLoading, isError, error, refetch } = useQuery<
    V3LooksPage,
    Error & { shapeDrift?: HeygenShapeDriftDetails }
  >({
    queryKey: ["/api/v3/photo-avatars", heygenGroupId, "looks", cursor ?? ""],
    queryFn: async () => {
      const url = `/api/v3/photo-avatars/${encodeURIComponent(
        heygenGroupId
      )}/looks${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let parsed: unknown = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          /* non-JSON body — treat as opaque failure */
        }
        const drift = tryParseShapeDriftBody(parsed);
        const message =
          (parsed as { message?: string } | null)?.message ||
          `Failed to load looks (${res.status})`;
        const e: Error & { shapeDrift?: HeygenShapeDriftDetails } = new Error(
          message,
        );
        if (drift) e.shapeDrift = drift;
        throw e;
      }
      return res.json();
    },
  });

  const shapeDrift = error?.shapeDrift;

  const useLookMutation = useMutation({
    mutationFn: async (look: V3Look) => {
      const imageUrl = pickLookImage(look);
      if (!imageUrl) {
        throw new Error(
          "This look has no preview image yet — try again once training finishes."
        );
      }
      const lookName =
        look.name || look.business_type || look.id || "HeyGen v3 Look";
      const res = await apiRequest("POST", "/api/avatar-iv/use-look-image", {
        imageUrl,
        lookName,
      });
      return res.json();
    },
    onSuccess: () => {
      setPendingLookId(null);
      toast({
        title: "Look Ready for Video!",
        description: "The selected look is queued for the Video Studio.",
      });
      window.location.hash = "photo-avatars";
    },
    onError: (err: unknown) => {
      setPendingLookId(null);
      const message = err instanceof Error ? err.message : "Please try again.";
      toast({
        title: "Could not use this look",
        description: message,
        variant: "destructive",
      });
    },
  });

  const looks = data?.data ?? [];
  const isRevoked = consentStatus === "revoked";

  return (
    <div
      className="border-t mt-2 pt-3 space-y-2"
      data-testid={`v3-looks-panel-${heygenGroupId}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            HeyGen v3 Looks
          </p>
          <p className="text-[10px] text-gray-500 flex items-center gap-1">
            Consent:{" "}
            <span
              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${consentBadgeClass(consentStatus)}`}
              data-testid={`text-consent-status-${heygenGroupId}`}
            >
              {consentStatus || "unknown"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1">
          {consentStatus !== "approved" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setApproveDialogOpen(true)}
              className="h-6 text-[10px] px-2 border-green-300 text-green-700 hover:bg-green-50"
              data-testid={`button-approve-consent-${heygenGroupId}`}
              disabled={consentMutation.isPending}
            >
              <Check className="w-3 h-3 mr-1" />
              Approve
            </Button>
          )}
          {consentStatus !== "revoked" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => consentMutation.mutate({ action: "revoke" })}
              className="h-6 text-[10px] px-2 border-red-300 text-red-700 hover:bg-red-50"
              data-testid={`button-revoke-consent-${heygenGroupId}`}
              disabled={consentMutation.isPending}
            >
              <ShieldOff className="w-3 h-3 mr-1" />
              Revoke
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            className="h-6 text-[10px] px-2"
            data-testid={`button-refresh-looks-${heygenGroupId}`}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent data-testid={`dialog-approve-consent-${heygenGroupId}`}>
          <DialogHeader>
            <DialogTitle>Approve likeness consent</DialogTitle>
            <DialogDescription>
              Provide a consent video URL or a signature on file to confirm the
              subject of this avatar consents to being used for AI generation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor={`approve-video-url-${heygenGroupId}`}>
                Consent video URL
              </Label>
              <Input
                id={`approve-video-url-${heygenGroupId}`}
                value={approveVideoUrl}
                onChange={(e) => setApproveVideoUrl(e.target.value)}
                placeholder="https://..."
                data-testid={`input-approve-video-url-${heygenGroupId}`}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`approve-signature-${heygenGroupId}`}>
                Signature (optional)
              </Label>
              <Input
                id={`approve-signature-${heygenGroupId}`}
                value={approveSignature}
                onChange={(e) => setApproveSignature(e.target.value)}
                placeholder="Signed name"
                data-testid={`input-approve-signature-${heygenGroupId}`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveDialogOpen(false)}
              data-testid={`button-cancel-approve-${heygenGroupId}`}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                consentMutation.mutate({
                  action: "approve",
                  consentVideoUrl: approveVideoUrl.trim() || undefined,
                  signature: approveSignature.trim() || undefined,
                })
              }
              disabled={
                consentMutation.isPending ||
                (!approveVideoUrl.trim() && !approveSignature.trim())
              }
              data-testid={`button-confirm-approve-${heygenGroupId}`}
            >
              {consentMutation.isPending ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Approve consent"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading && (
        <div className="text-center py-4 text-xs text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
          Loading looks...
        </div>
      )}
      {isError && shapeDrift && (
        <HeygenShapeDriftAlert
          details={shapeDrift}
          scope={heygenGroupId}
          scopeLabel="group"
          scopeValue={heygenGroupId}
          action="loading looks"
        />
      )}
      {isError && !shapeDrift && (
        <Alert variant="destructive">
          <AlertDescription className="text-xs">
            Couldn't load v3 looks. The group may still be training.
          </AlertDescription>
        </Alert>
      )}
      {!isLoading && !isError && looks.length === 0 && (
        <p className="text-[11px] text-gray-500 py-2">
          No looks yet — they'll appear here once HeyGen finishes generating
          them.
        </p>
      )}

      {isRevoked && (
        <Alert variant="destructive" data-testid={`alert-consent-revoked-${heygenGroupId}`}>
          <AlertDescription className="text-xs">
            Consent has been revoked for this avatar. Existing looks are read-only and
            can't be used to create new videos. Re-approve consent to enable video
            generation again.
          </AlertDescription>
        </Alert>
      )}

      {looks.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {looks.map((look: V3Look, idx: number) => {
            const lookId = look.id || look.look_id || `look-${idx}`;
            const imageUrl = pickLookImage(look);
            return (
              <div
                key={lookId}
                className="relative rounded-lg overflow-hidden border bg-gray-50"
                data-testid={`card-v3-look-${lookId}`}
              >
                <div className="aspect-square bg-gray-100">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={look?.name || "Look"}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">
                      No preview
                    </div>
                  )}
                </div>
                <div className="p-1.5 space-y-1">
                  <p className="text-[10px] truncate" title={look?.name}>
                    {look?.name || lookId}
                  </p>
                  <Button
                    size="sm"
                    className="w-full bg-[#D4AF37] hover:bg-[#C4A030] text-white text-[10px] h-6"
                    disabled={
                      !imageUrl ||
                      isRevoked ||
                      (useLookMutation.isPending && pendingLookId === lookId)
                    }
                    title={
                      isRevoked
                        ? "Consent revoked — re-approve consent to use this look for video"
                        : undefined
                    }
                    onClick={() => {
                      if (isRevoked) return;
                      setPendingLookId(lookId);
                      useLookMutation.mutate(look);
                    }}
                    data-testid={`button-use-v3-look-${lookId}`}
                  >
                    {useLookMutation.isPending && pendingLookId === lookId ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Preparing...
                      </>
                    ) : (
                      <>
                        <Video className="h-3 w-3 mr-1" />
                        {isRevoked ? "Consent Revoked" : "Use for Video"}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <Button
          size="sm"
          variant="ghost"
          disabled={history.length === 0}
          onClick={() => {
            const next = [...history];
            const prev = next.pop();
            setHistory(next);
            setCursor(prev ?? undefined);
          }}
          className="h-6 text-[10px] px-2"
          data-testid={`button-looks-prev-${heygenGroupId}`}
        >
          <ChevronUp className="w-3 h-3 mr-1 rotate-[-90deg]" />
          Previous
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!data?.nextCursor}
          onClick={() => {
            if (!data?.nextCursor) return;
            setHistory((h) => [...h, cursor ?? ""]);
            setCursor(data.nextCursor);
          }}
          className="h-6 text-[10px] px-2"
          data-testid={`button-looks-next-${heygenGroupId}`}
        >
          Next
          <ChevronDown className="w-3 h-3 ml-1 rotate-[-90deg]" />
        </Button>
      </div>
    </div>
  );
}
