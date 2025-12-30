import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Image as ImageIcon, ZoomIn, Download, Play, Wand2, Volume2, Trash2, Video } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface Photo {
  id?: string;
  url: string;
  thumbnail?: string;
  name?: string;
  type?: string;
  motion_preview_url?: string;
}

interface PhotoGalleryData {
  group_id: string;
  photos: Photo[];
  count: number;
}

interface AvatarPhotoGalleryProps {
  groupId: string;
}

export function AvatarPhotoGallery({ groupId }: AvatarPhotoGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const { toast } = useToast();

  // Fetch photos for this avatar group
  const { data: photoData, isLoading } = useQuery<PhotoGalleryData>({
    queryKey: [`/api/photo-avatars/groups/${groupId}/photos`],
    enabled: !!groupId,
  });

  const photos = photoData?.photos || [];

  // Add motion mutation
  const addMotionMutation = useMutation({
    mutationFn: (avatarId: string) =>
      apiRequest("POST", `/api/photo-avatars/${avatarId}/add-motion`, {}),
    onSuccess: () => {
      toast({
        title: "Motion Added!",
        description: "Dynamic motion is being added to your avatar. This may take a few moments.",
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/photo-avatars/groups/${groupId}/photos`],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Motion Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add sound effect mutation
  const addSoundEffectMutation = useMutation({
    mutationFn: (avatarId: string) =>
      apiRequest("POST", `/api/photo-avatars/${avatarId}/add-sound-effect`, {}),
    onSuccess: () => {
      toast({
        title: "Sound Effect Added!",
        description: "Immersive sound effects are being added to your avatar. This may take a few moments.",
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/photo-avatars/groups/${groupId}/photos`],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sound Effect Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete individual avatar mutation
  const deleteAvatarMutation = useMutation({
    mutationFn: (avatarId: string) =>
      apiRequest("DELETE", `/api/photo-avatars/${avatarId}`),
    onSuccess: () => {
      toast({
        title: "Avatar Deleted",
        description: "The individual avatar has been removed successfully.",
      });
      setSelectedPhoto(null);
      queryClient.invalidateQueries({
        queryKey: [`/api/photo-avatars/groups/${groupId}/photos`],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/photo-avatars/groups"],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
        <span className="ml-2 text-sm text-gray-500">Loading avatars...</span>
      </div>
    );
  }

  if (!photos || photos.length === 0) {
    return (
      <Alert className="border-[#D4AF37]/30 bg-[#D4AF37]/5">
        <ImageIcon className="h-4 w-4 text-[#D4AF37]" />
        <AlertDescription>
          No avatars available yet. Avatars will appear here after creation.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      {/* Compact Avatar Gallery - Small Thumbnails */}
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
        {photos.map((photo, index) => (
          <button
            key={photo.id || index}
            onClick={() => setSelectedPhoto(photo)}
            className="relative group rounded-lg overflow-hidden border-2 border-gray-200 hover:border-[#D4AF37] transition-all duration-200 hover:shadow-lg bg-gray-50 w-full"
            data-testid={`avatar-photo-${index}`}
          >
            <div className="aspect-[3/4] w-full">
              <img
                src={photo.url}
                alt={photo.name || `Avatar ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(photo.name || 'Avatar')}&background=D4AF37&color=fff&size=400`;
                }}
              />
            </div>
            
            {/* Hover Overlay - Compact */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-0 left-0 right-0 p-1.5">
                <div className="flex items-center justify-center gap-1.5 text-white">
                  <ZoomIn className="w-3.5 h-3.5" />
                  {photo.motion_preview_url && (
                    <Play className="w-3.5 h-3.5" />
                  )}
                </div>
              </div>
            </div>

            {/* Preview Badge - Smaller */}
            {photo.motion_preview_url && (
              <div className="absolute top-1 right-1 bg-[#D4AF37] text-white text-[9px] px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                <Play className="w-2.5 h-2.5" />
                Video
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Full-Size Photo Dialog - Improved Layout */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader className="border-b border-[#D4AF37]/20 pb-4">
            <DialogTitle className="font-playfair text-3xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] bg-clip-text text-transparent">
              {selectedPhoto?.name || 'Avatar Preview'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedPhoto && (
            <div className="space-y-6 max-h-[calc(90vh-120px)] overflow-y-auto">
              {/* Two-Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Avatar Image */}
                <div className="space-y-3">
                  <div className="relative w-full aspect-[3/4] overflow-hidden rounded-xl border-2 border-[#D4AF37]/30 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 shadow-xl">
                    <img
                      src={selectedPhoto.url}
                      alt={selectedPhoto.name || 'Avatar'}
                      className="w-full h-full object-contain p-2"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://ui-avatars.com/api/?name=Avatar&background=D4AF37&color=fff&size=800';
                      }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                      <p className="text-white text-sm font-medium">{selectedPhoto.name}</p>
                    </div>
                  </div>

                  {/* Avatar Metadata */}
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2 border border-[#D4AF37]/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                      <Badge className="bg-green-100 text-green-700 border-green-300">Ready</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Type</span>
                      <span className="text-sm font-medium">Photo Avatar</span>
                    </div>
                    {selectedPhoto.motion_preview_url && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Features</span>
                        <div className="flex items-center gap-1 text-sm font-medium text-[#D4AF37]">
                          <Play className="w-3 h-3" />
                          Motion Preview Available
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column - Motion Preview or Placeholder */}
                <div className="space-y-3">
                  {selectedPhoto.motion_preview_url ? (
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Play className="w-5 h-5 text-[#D4AF37]" />
                        Motion Preview
                      </h3>
                      <div className="border-2 border-[#D4AF37]/30 rounded-xl overflow-hidden bg-black shadow-xl">
                        <video
                          src={selectedPhoto.motion_preview_url}
                          controls
                          controlsList="nodownload"
                          className="w-full aspect-video object-contain"
                          autoPlay
                          loop
                          playsInline
                        >
                          Your browser does not support video playback.
                        </video>
                        <div className="bg-gradient-to-r from-gray-900 to-black px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-gray-300 text-sm">
                            <Play className="w-4 h-4 text-[#D4AF37]" />
                            <span>Avatar animation with sound</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (selectedPhoto.motion_preview_url) {
                                window.open(selectedPhoto.motion_preview_url, '_blank');
                              }
                            }}
                            className="border-[#D4AF37]/50 hover:bg-[#D4AF37]/10 text-white"
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Download Video
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                      <div className="text-center p-8">
                        <Video className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                          No motion preview available for this avatar
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Additional Info */}
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">💡 Usage Tips</h4>
                    <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                      <li>• Use this avatar in video generation to create talking videos</li>
                      <li>• Download the image for use in other marketing materials</li>
                      <li>• Motion previews show how your avatar will look animated</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="flex gap-3 justify-between items-center pt-4 border-t border-[#D4AF37]/20">
                <div className="flex gap-2">
                  {selectedPhoto.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedPhoto.id && confirm('Are you sure you want to delete this avatar? This action cannot be undone.')) {
                          deleteAvatarMutation.mutate(selectedPhoto.id);
                        }
                      }}
                      disabled={deleteAvatarMutation.isPending}
                      className="border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                      data-testid="button-delete-avatar"
                    >
                      {deleteAvatarMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Avatar
                        </>
                      )}
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (selectedPhoto.url) {
                        window.open(selectedPhoto.url, '_blank');
                      }
                    }}
                    className="border-[#D4AF37]/30 hover:bg-[#D4AF37]/10"
                    data-testid="button-download-avatar"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Image
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setSelectedPhoto(null)}
                    className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110 text-white"
                    data-testid="button-close-preview"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
