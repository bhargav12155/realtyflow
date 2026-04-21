import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ConsentStatus } from "./types";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Video,
} from "lucide-react";

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

  const { data, isLoading, isError, refetch } = useQuery<V3LooksPage>({
    queryKey: ["/api/v3/photo-avatars", heygenGroupId, "looks", cursor ?? ""],
    queryFn: async () => {
      const url = `/api/v3/photo-avatars/${encodeURIComponent(
        heygenGroupId
      )}/looks${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load looks (${res.status})`);
      return res.json();
    },
  });

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
          <p className="text-[10px] text-gray-500">
            Consent:{" "}
            <span data-testid={`text-consent-status-${heygenGroupId}`}>
              {consentStatus || "unknown"}
            </span>
          </p>
        </div>
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

      {isLoading && (
        <div className="text-center py-4 text-xs text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
          Loading looks...
        </div>
      )}
      {isError && (
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
                      (useLookMutation.isPending && pendingLookId === lookId)
                    }
                    onClick={() => {
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
                        Use for Video
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
