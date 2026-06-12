import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AvatarPhotoGallery } from "../avatar-photo-gallery";
import { usePhotoAvatars } from "./context";

export function PhotoGalleryDialog() {
  const { openGalleryGroupId, setOpenGalleryGroupId } = usePhotoAvatars();

  return (
    <Dialog
      open={!!openGalleryGroupId}
      onOpenChange={() => setOpenGalleryGroupId(null)}
    >
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-playfair text-2xl">
            Avatar Gallery
          </DialogTitle>
          <DialogDescription>
            Click on any avatar to view full-size and play videos
          </DialogDescription>
        </DialogHeader>
        {openGalleryGroupId && (
          <AvatarPhotoGallery groupId={openGalleryGroupId} />
        )}
      </DialogContent>
    </Dialog>
  );
}
