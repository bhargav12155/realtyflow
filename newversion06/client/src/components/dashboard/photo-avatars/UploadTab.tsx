import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { AlertCircle, Image, Loader2, Upload, X } from "lucide-react";
import { usePhotoAvatars } from "./context";
import type { AvatarGroup } from "./types";
import { HeygenShapeDriftAlert } from "@/components/dashboard/heygen-shape-drift-alert";

export function UploadTab() {
  const m = usePhotoAvatars();
  const {
    uploadedFiles, setUploadedFiles,
    handleFileUpload, handleUploadFiles,
    uploadPhotoMutation,
    showGroupNameDialog, setShowGroupNameDialog,
    groupNameInput, setGroupNameInput,
    handleConfirmGroupName,
    retryConfirmGroupName, closeGroupNameDialog,
    createShapeDrift, isRetryingCreate,
    avatarGroups,
    consentAcknowledged, setConsentAcknowledged,
    consentVideoUrl, setConsentVideoUrl,
  } = m;

  return (
    <TabsContent value="upload" className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Upload 5-20 high-quality photos of the same person from different
          angles for best results. Photos should be clear, well-lit, and show
          the face clearly.
        </AlertDescription>
      </Alert>

      <div className="border-2 border-dashed border-gray-300 hover:border-[#D4AF37] rounded-lg p-6 text-center transition-colors">
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
          id="photo-upload"
        />
        <label
          htmlFor="photo-upload"
          className="cursor-pointer flex flex-col items-center"
          data-testid="label-upload"
        >
          <Image className="w-12 h-12 text-gray-400 mb-2" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Click to select multiple photos
          </span>
          <span className="text-xs text-gray-500 mt-1">
            Hold Ctrl (or Cmd on Mac) to select multiple files at once
          </span>
          <span className="text-xs text-gray-400 mt-0.5">
            PNG, JPG up to 10MB each
          </span>
        </label>
      </div>

      {uploadedFiles.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {uploadedFiles.length} photo{uploadedFiles.length > 1 ? "s" : ""} selected
            </p>
            <label
              htmlFor="photo-upload"
              className="text-xs text-[#D4AF37] hover:underline cursor-pointer"
            >
              + Add more
            </label>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {uploadedFiles.map((file, index) => {
              const previewUrl = URL.createObjectURL(file);
              return (
                <div
                  key={`${file.name}-${file.size}-${index}`}
                  className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
                >
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className="w-full h-full object-cover"
                    onLoad={() => URL.revokeObjectURL(previewUrl)}
                  />
                  <button
                    onClick={() =>
                      setUploadedFiles((files) =>
                        files.filter((_, i) => i !== index)
                      )
                    }
                    className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`button-remove-${index}`}
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* HeyGen v3 likeness consent — required before any new
              avatar group can be created. */}
          <p className="text-[11px] text-gray-500 dark:text-gray-400 -mt-1">
            Heads up: new groups are created with HeyGen v3, which uses
            your first photo as the primary image. Additional photos are
            uploaded for reference and history.
          </p>
          <div className="border rounded-lg p-3 space-y-2 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
            <div className="flex items-start gap-2">
              <Checkbox
                id="consent-acknowledged"
                checked={consentAcknowledged}
                onCheckedChange={(checked) =>
                  setConsentAcknowledged(checked === true)
                }
                data-testid="checkbox-consent-acknowledged"
              />
              <Label
                htmlFor="consent-acknowledged"
                className="text-xs leading-relaxed cursor-pointer"
              >
                I confirm I have permission to use this person's likeness
                and that the subject consents to being turned into an AI
                avatar via HeyGen. <span className="text-red-600">*</span>
              </Label>
            </div>
            <div>
              <Label
                htmlFor="consent-video-url"
                className="text-xs text-gray-600 dark:text-gray-400"
              >
                Consent video URL (optional)
              </Label>
              <Input
                id="consent-video-url"
                type="url"
                placeholder="https://..."
                value={consentVideoUrl}
                onChange={(e) => setConsentVideoUrl(e.target.value)}
                className="mt-1 text-xs"
                data-testid="input-consent-video-url"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Link to a short video where the subject acknowledges
                consent. Recommended for production likenesses.
              </p>
            </div>
          </div>

          <Button
            onClick={handleUploadFiles}
            disabled={uploadPhotoMutation.isPending || !consentAcknowledged}
            className="w-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110 text-white"
            data-testid="button-upload-files"
          >
            {uploadPhotoMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload {uploadedFiles.length} Photo
                {uploadedFiles.length > 1 ? "s" : ""} & Create Avatar
              </>
            )}
          </Button>
        </>
      )}

      <Dialog
        open={showGroupNameDialog}
        onOpenChange={(open) => {
          if (!open) {
            closeGroupNameDialog();
          } else {
            setShowGroupNameDialog(true);
          }
        }}
      >
        <DialogContent data-testid="dialog-group-name">
          <DialogHeader>
            <DialogTitle>Name Your Avatar Group</DialogTitle>
            <DialogDescription>
              Enter a name for your new avatar group
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="e.g., Professional Avatar, Business Headshot"
              value={groupNameInput}
              onChange={(e) => setGroupNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleConfirmGroupName();
                }
              }}
              data-testid="input-group-name"
            />
            {createShapeDrift && (
              <HeygenShapeDriftAlert
                details={createShapeDrift}
                scope="photo-avatar-create"
                action="creating your photo avatar"
                onRetry={() => {
                  void retryConfirmGroupName();
                }}
                isRetrying={isRetryingCreate}
              />
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  closeGroupNameDialog();
                  setGroupNameInput("");
                }}
                data-testid="button-cancel-group"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmGroupName}
                disabled={!groupNameInput.trim() || isRetryingCreate}
                data-testid="button-confirm-group"
              >
                Create Avatar Group
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {avatarGroups && avatarGroups.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <h3 className="text-sm font-semibold mb-3 text-gray-700 flex items-center gap-2">
            <Image className="h-4 w-4" />
            Upload History
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            {avatarGroups.length} avatar{" "}
            {avatarGroups.length === 1 ? "group" : "groups"} created
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {avatarGroups.map((group: AvatarGroup) => (
              <div
                key={group.group_id}
                className="group relative border rounded-lg overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                onClick={() => {
                  const element = document.getElementById(`avatar-group-${group.group_id}`);
                  if (element) {
                    const generateTab = document.querySelector('[value="generate"]');
                    if (generateTab) {
                      (generateTab as HTMLElement).click();
                    }
                    setTimeout(() => {
                      element.scrollIntoView({ behavior: "smooth", block: "center" });
                    }, 100);
                  }
                }}
                data-testid={`upload-history-${group.group_id}`}
              >
                <div className="aspect-square relative">
                  <img
                    src={group.preview_image}
                    alt={group.name}
                    className="w-full h-full object-cover"
                  />
                  {(group.num_looks ?? 0) > 1 && (
                    <div className="absolute top-2 right-2 bg-[#D4AF37] text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                      {group.num_looks}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        const element = document.getElementById(`avatar-group-${group.group_id}`);
                        if (element) {
                          const generateTab = document.querySelector('[value="generate"]');
                          if (generateTab) {
                            (generateTab as HTMLElement).click();
                          }
                          setTimeout(() => {
                            element.scrollIntoView({ behavior: "smooth", block: "center" });
                          }, 100);
                        }
                      }}
                      data-testid={`button-view-${group.group_id}`}
                    >
                      View
                    </Button>
                  </div>
                </div>
                <div className="p-2 bg-white dark:bg-card">
                  <h4 className="text-xs font-medium text-gray-800 dark:text-foreground truncate">
                    {group.name}
                  </h4>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {new Date(Number(group.created_at) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </TabsContent>
  );
}
