import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  Clock,
  Loader2,
  MoreVertical,
  Play,
  RefreshCw,
  Shirt,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Wand2,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { queryClient } from "@/lib/queryClient";
import { AvatarPhotoGallery } from "../avatar-photo-gallery";
import { PROFESSIONAL_VOICES } from "./constants";
import { usePhotoAvatars } from "./context";
import type { AvatarGroup } from "./types";
import { V3LooksPanel } from "./V3LooksPanel";

export function ManageGroupsTab() {
  const m = usePhotoAvatars();
  const confirm = useConfirm();
  const {
    avatarGroups, isLoadingGroups,
    showTrainAllDialog, setShowTrainAllDialog,
    trainAllVoiceId, setTrainAllVoiceId,
    trainAllMutation,
    setAiLookDialogOpen,
    setSelectedGroupForEdit, setEditDialogOpen,
    trainGroupMutation,
    generateLooksMutation,
    setSelectedAvatarForMotion, setAddMotionDialogOpen,
    deleteGroupMutation,
    getStatusColor,
    openLooksGroupId, setOpenLooksGroupId,
  } = m;

  return (
    <TabsContent value="manage" className="space-y-4">
      {!isLoadingGroups &&
        avatarGroups &&
        avatarGroups.some(
          (g: AvatarGroup) => g.train_status === "empty" && (g.num_looks ?? 0) >= 1
        ) && (
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-800">
              <strong>Tip:</strong> If you trained avatars in the HeyGen
              portal, click "Refresh Status" to sync the latest training status.
            </AlertDescription>
          </Alert>
        )}

      {!isLoadingGroups && avatarGroups && avatarGroups.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              queryClient.invalidateQueries({
                queryKey: ["/api/photo-avatars/groups"],
              })
            }
            className="text-xs"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh Status
          </Button>
        </div>
      )}

      {isLoadingGroups ? (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
          <p className="text-sm text-gray-500 mt-2">Loading avatar groups...</p>
        </div>
      ) : !avatarGroups || avatarGroups.length === 0 ? (
        <Alert>
          <AlertDescription>
            No avatar groups found. Generate AI photos or upload your own to
            get started.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-6">
          {avatarGroups.filter(
            (g: AvatarGroup) => g.train_status === "empty" && (g.num_looks ?? 0) >= 1
          ).length > 0 && (
            <div className="sticky top-0 z-10 bg-white border-2 border-[#D4AF37] rounded-lg p-4 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-[#D4AF37]">
                    {avatarGroups.filter(
                      (g: AvatarGroup) => g.train_status === "empty" && (g.num_looks ?? 0) >= 1
                    ).length}{" "}
                    Avatar Groups Need Training
                  </h3>
                  <p className="text-sm text-gray-600">
                    Train all pending avatars at once with the same
                    professional voice
                  </p>
                </div>
                <Button
                  onClick={() => setShowTrainAllDialog(true)}
                  className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110"
                  data-testid="button-train-all-pending"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Train All Pending Avatars
                </Button>
              </div>
            </div>
          )}

          {showTrainAllDialog && (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
              onClick={() => setShowTrainAllDialog(false)}
            >
              <div
                className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-xl font-semibold mb-4">
                  Select Voice for All Avatars
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Choose a professional voice that will be used for all{" "}
                  {avatarGroups.filter(
                    (g: AvatarGroup) => g.train_status === "empty" && (g.num_looks ?? 0) >= 1
                  ).length}{" "}
                  pending avatar groups.
                </p>
                <div className="space-y-4">
                  <div>
                    <Label>Professional Voice</Label>
                    <Select value={trainAllVoiceId} onValueChange={setTrainAllVoiceId}>
                      <SelectTrigger data-testid="select-train-all-voice">
                        <SelectValue placeholder="Choose a voice" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROFESSIONAL_VOICES.map((voice) => (
                          <SelectItem key={voice.id} value={voice.id}>
                            {voice.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => trainAllMutation.mutate(trainAllVoiceId)}
                      disabled={!trainAllVoiceId || trainAllMutation.isPending}
                      className="flex-1 bg-gradient-to-r from-[#D4AF37] to-[#B8860B]"
                      data-testid="button-confirm-train-all"
                    >
                      {trainAllMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Training...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Start Training All
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => {
                        setShowTrainAllDialog(false);
                        setTrainAllVoiceId("");
                      }}
                      variant="outline"
                      disabled={trainAllMutation.isPending}
                      data-testid="button-cancel-train-all"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div
            className="mb-6 cursor-pointer"
            onClick={() => setAiLookDialogOpen(true)}
            data-testid="banner-ai-enhanced-look"
          >
            <div className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] rounded-xl p-4 flex items-center justify-between hover:brightness-110 transition-all shadow-lg">
              <div className="flex items-center gap-3">
                <Sparkles className="h-6 w-6 text-black" />
                <div>
                  <p className="font-semibold text-black text-base">Generate AI Enhanced Look</p>
                  <p className="text-black/70 text-sm">2-3 min processing • {avatarGroups.length}/∞ used</p>
                </div>
              </div>
              <div className="text-black">
                <ChevronDown className="h-5 w-5 rotate-[-90deg]" />
              </div>
            </div>
          </div>

          {(!Array.isArray(avatarGroups) || avatarGroups.length === 0) && !isLoadingGroups && (
            <Card
              className="border-2 border-dashed border-gray-200 dark:border-border bg-muted/20"
              data-testid="empty-state-no-avatar-groups"
            >
              <CardContent className="py-12 text-center">
                <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-60" />
                <p className="font-medium text-base mb-1">No avatar groups yet</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Upload a photo on the Upload tab, or generate AI photos on
                  the Generate tab. Your avatar groups will appear here once
                  they finish training.
                </p>
              </CardContent>
            </Card>
          )}

          {Array.isArray(avatarGroups) &&
            avatarGroups.map((group: AvatarGroup) => {
              const isConsentRevoked = group.consent_status === "revoked";
              return (
              <Card
                key={group.group_id}
                className={`overflow-hidden border border-gray-200 ${isConsentRevoked ? "opacity-75" : ""}`}
                data-testid={`card-group-${group.group_id}`}
              >
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-600 mb-1.5">
                        {group.name}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {group.status === "ready" && (
                          <div
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${
                              group.train_status === "ready"
                                ? "bg-green-100 text-green-700"
                                : group.train_status === "processing"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {group.train_status === "ready" ? (
                              <CheckCircle className="w-3 h-3" />
                            ) : group.train_status === "processing" ? (
                              <Clock className="w-3 h-3 animate-spin" />
                            ) : (
                              <UserPlus className="w-3 h-3" />
                            )}
                            <span className="text-[9px] font-semibold">
                              {group.train_status === "ready"
                                ? "Trained & Ready"
                                : group.train_status === "processing"
                                ? "Training..."
                                : "Ready to Train"}
                            </span>
                          </div>
                        )}
                        {group.status === "pending" && (
                          <div className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" />
                            <span className="text-[9px] font-semibold">
                              Processing Images
                            </span>
                          </div>
                        )}
                        {group.status === "completed" && (
                          <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            <UserPlus className="w-3 h-3" />
                            <span className="text-[9px] font-semibold">
                              {!group.avatar_count || group.avatar_count < 2
                                ? "Need More Photos"
                                : "Ready to Train"}
                            </span>
                          </div>
                        )}
                        {isConsentRevoked && (
                          <div
                            className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded-full"
                            data-testid={`badge-consent-revoked-${group.group_id}`}
                          >
                            <AlertCircle className="w-3 h-3" />
                            <span className="text-[9px] font-semibold">
                              Consent Revoked
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400">
                        {new Date(group.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                        {group.avatar_count && ` • ${group.avatar_count} photos`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge
                        className={`${getStatusColor(group.status)} text-white text-[9px] px-1.5 py-0.5`}
                      >
                        {group.status}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="w-6 h-6 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
                            data-testid={`button-menu-group-${group.group_id}`}
                          >
                            <MoreVertical className="h-3.5 w-3.5 text-gray-500" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            disabled={isConsentRevoked}
                            onClick={() => {
                              if (isConsentRevoked) return;
                              setSelectedGroupForEdit(group);
                              setEditDialogOpen(true);
                            }}
                            data-testid={`button-menu-outfit-${group.group_id}`}
                          >
                            <Shirt className="h-4 w-4 mr-2" />
                            Change Outfit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              const confirmed = await confirm({
                                title: "Delete Avatar Group",
                                description: "Delete this avatar group? This cannot be undone.",
                                confirmText: "Delete",
                                variant: "destructive",
                              });
                              if (confirmed) {
                                deleteGroupMutation.mutate(group.group_id);
                              }
                            }}
                            className="text-red-600 focus:text-red-600"
                            data-testid={`button-menu-delete-${group.group_id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {group.status === "processing" && group.training_progress && (
                    <div className="space-y-1">
                      <Progress value={group.training_progress} className="h-1" />
                      <p className="text-[9px] text-gray-400">
                        Training: {group.training_progress}%
                      </p>
                    </div>
                  )}

                  <AvatarPhotoGallery groupId={group.group_id} />

                  {isConsentRevoked && (
                    <div
                      className="flex items-start gap-1.5 text-red-700 bg-red-50 border border-red-200 px-2 py-1.5 rounded text-[10px]"
                      data-testid={`notice-consent-revoked-${group.group_id}`}
                    >
                      <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>
                        Consent has been revoked for this avatar. Generating new looks,
                        outfit changes, motions and videos are disabled until consent is
                        re-approved.
                      </span>
                    </div>
                  )}

                  <div className="flex gap-1.5 pt-1">
                    {group.status === "pending" && (
                      <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-1 rounded text-[10px]">
                        <Clock className="w-3 h-3 animate-spin" />
                        <span>HeyGen is processing images...</span>
                      </div>
                    )}

                    {(group.status === "completed" ||
                      (group.status === "ready" && group.train_status !== "ready")) && (
                      <>
                        {!group.avatar_count || group.avatar_count < 2 ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-1 rounded text-[10px]">
                                  <Upload className="w-3 h-3" />
                                  <span>
                                    Upload{" "}
                                    {group.avatar_count === 1
                                      ? "2-4 more photos"
                                      : "at least 2 photos"}{" "}
                                    to train
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  Training requires multiple diverse photos
                                  (different angles, expressions, outfits)
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    trainGroupMutation.mutate({
                                      groupId: group.group_id,
                                    })
                                  }
                                  disabled={trainGroupMutation.isPending || isConsentRevoked}
                                  data-testid={`button-train-${group.group_id}`}
                                  className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110 h-7 text-[10px] px-2"
                                >
                                  <UserPlus className="w-3 h-3 mr-1" />
                                  {trainGroupMutation.isPending
                                    ? "Training..."
                                    : `Train Avatar (${group.avatar_count} photos)`}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  Train this avatar to generate custom variations
                                  and looks
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </>
                    )}

                    {group.status === "ready" &&
                      group.train_status === "ready" &&
                      !isConsentRevoked && (
                        <>
                          <Button
                            size="sm"
                            onClick={() =>
                              generateLooksMutation.mutate({
                                groupId: group.group_id,
                                numLooks: 4,
                              })
                            }
                            disabled={generateLooksMutation.isPending}
                            data-testid={`button-looks-${group.group_id}`}
                            className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110 h-7 text-[10px] px-2"
                          >
                            <Wand2 className="w-3 h-3 mr-1" />
                            Generate 4 Looks
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedGroupForEdit(group);
                              setEditDialogOpen(true);
                            }}
                            data-testid={`button-change-outfit-${group.group_id}`}
                            className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10 h-7 text-[10px] px-2"
                          >
                            <Shirt className="w-3 h-3 mr-1" />
                            Change Outfit
                          </Button>
                        </>
                      )}

                    {group.avatar_count && group.avatar_count > 0 && !isConsentRevoked && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedAvatarForMotion({
                            avatarId: group.group_id,
                            groupName: group.name,
                          });
                          setAddMotionDialogOpen(true);
                        }}
                        data-testid={`button-motion-${group.group_id}`}
                        className="border-purple-300 text-purple-600 hover:bg-purple-50 h-7 text-[10px] px-2"
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Add Motion
                      </Button>
                    )}

                    {group.status === "ready" &&
                      group.train_status === "ready" && <></>}

                    {group.api_version === "v3" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setOpenLooksGroupId(
                            openLooksGroupId === group.group_id
                              ? null
                              : group.group_id
                          )
                        }
                        data-testid={`button-toggle-v3-looks-${group.group_id}`}
                        className="border-blue-300 text-blue-600 hover:bg-blue-50 h-7 text-[10px] px-2"
                      >
                        <Sparkles className="w-3 h-3 mr-1" />
                        {openLooksGroupId === group.group_id ? "Hide" : "Show"} v3 Looks
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteGroupMutation.mutate(group.group_id)}
                      disabled={deleteGroupMutation.isPending}
                      data-testid={`button-delete-${group.group_id}`}
                      className="ml-auto border-red-300 text-red-600 hover:bg-red-50 h-7 text-[10px] px-2"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  </div>

                  {group.api_version === "v3" &&
                    openLooksGroupId === group.group_id && (
                      <V3LooksPanel
                        heygenGroupId={group.group_id}
                        consentStatus={group.consent_status ?? null}
                      />
                    )}
                </CardContent>
              </Card>
              );
            })}
        </div>
      )}
    </TabsContent>
  );
}
