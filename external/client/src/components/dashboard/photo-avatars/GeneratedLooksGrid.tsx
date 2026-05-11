import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Image, Loader2, Video } from "lucide-react";
import { usePhotoAvatars } from "./context";
import type { AvatarLook } from "./types";

export function GeneratedLooksGrid() {
  const m = usePhotoAvatars();
  const { allLooks, isLoadingAllLooks, useLookForVideoMutation, useLookPendingId } = m;

  if (allLooks.length === 0) return null;

  return (
    <Card data-testid="card-generated-looks">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="w-5 h-5 text-[#D4AF37]" />
          Generated Looks
        </CardTitle>
        <CardDescription>
          All AI-generated avatar looks across your groups
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoadingAllLooks ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto" />
            <p className="text-sm text-gray-500 mt-2">Loading looks...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {allLooks.map((look: AvatarLook) => (
              <div
                key={look.id}
                className="group relative rounded-lg overflow-hidden border border-gray-200 hover:border-[#D4AF37] transition-colors"
                data-testid={`card-look-${look.id}`}
              >
                <div className="aspect-square bg-gray-100">
                  <img
                    src={look.photoUrl}
                    alt={look.poseType || "Avatar look"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium text-gray-800 truncate">
                    {look.poseType || "Look"}
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">
                    {look.groupName || look.groupId}
                  </p>
                  {look.processingStatus && (
                    <Badge
                      variant={look.processingStatus === "completed" ? "default" : "secondary"}
                      className="mt-1 text-[10px] px-1 py-0"
                      data-testid={`badge-status-${look.id}`}
                    >
                      {look.processingStatus}
                    </Badge>
                  )}
                  {look.photoUrl && look.processingStatus === "completed" && (
                    <Button
                      size="sm"
                      className="w-full mt-2 bg-[#D4AF37] hover:bg-[#C4A030] text-white text-[10px] h-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        useLookForVideoMutation.mutate(look);
                      }}
                      disabled={useLookForVideoMutation.isPending && useLookPendingId === look.id}
                      data-testid={`button-use-look-video-${look.id}`}
                    >
                      {useLookForVideoMutation.isPending && useLookPendingId === look.id ? (
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
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
