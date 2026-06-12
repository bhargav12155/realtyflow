import { useQuery } from "@tanstack/react-query";
import { MoreVertical, Play, Shirt, Trash2, ZoomIn } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface AvatarPhoto {
  url: string;
  name?: string;
  motion_preview_url?: string;
}

interface PhotosResponse {
  photos?: AvatarPhoto[];
}

export function LargeAvatarCard({
  groupId,
  groupName,
  onOpenGallery,
  onChangeOutfit,
  onDelete,
}: {
  groupId: string;
  groupName: string;
  onOpenGallery: () => void;
  onChangeOutfit: () => void;
  onDelete: () => void;
}) {
  const confirm = useConfirm();
  const { data: photoData } = useQuery<PhotosResponse>({
    queryKey: [`/api/photo-avatars/groups/${groupId}/photos`],
    enabled: !!groupId,
  });

  const photos: AvatarPhoto[] = photoData?.photos ?? [];
  const firstPhoto = photos[0];

  if (!firstPhoto) return null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenGallery}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenGallery(); } }}
      className="relative group rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-300 bg-white w-full cursor-pointer"
      data-testid={`large-avatar-${groupId}`}
    >
      <div className="aspect-[3/4] w-full">
        <img
          src={firstPhoto.url}
          alt={firstPhoto.name || groupName}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Three-dot menu - Always visible */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="absolute top-2 right-2 w-7 h-7 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center z-20 transition-colors"
            onClick={(e) => e.stopPropagation()}
            data-testid={`button-menu-avatar-${groupId}`}
          >
            <MoreVertical className="h-4 w-4 text-white" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onChangeOutfit();
            }}
            data-testid={`button-menu-outfit-avatar-${groupId}`}
          >
            <Shirt className="h-4 w-4 mr-2" />
            Change Outfit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={async (e) => {
              e.stopPropagation();
              const confirmed = await confirm({
                title: "Delete Avatar Group",
                description: "Delete this avatar group? This cannot be undone.",
                confirmText: "Delete",
                variant: "destructive",
              });
              if (confirmed) {
                onDelete();
              }
            }}
            className="text-red-600 focus:text-red-600"
            data-testid={`button-menu-delete-avatar-${groupId}`}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Name Overlay at Bottom - Always Visible */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <p className="text-white text-sm font-medium truncate">
          {firstPhoto.name || groupName}
        </p>
      </div>

      {/* Hover Actions Overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
        <div className="flex gap-2 text-white">
          <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
            <ZoomIn className="w-5 h-5" />
          </div>
          {firstPhoto.motion_preview_url && (
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
              <Play className="w-5 h-5" />
            </div>
          )}
        </div>
      </div>

      {/* Video Badge */}
      {firstPhoto.motion_preview_url && (
        <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
          <Play className="w-3 h-3" />
          Video
        </div>
      )}
    </div>
  );
}
