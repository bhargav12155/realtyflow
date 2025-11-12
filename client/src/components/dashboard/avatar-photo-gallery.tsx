import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Image as ImageIcon, ZoomIn, Download, Play, Wand2, Volume2, Trash2 } from 'lucide-react';
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
      {/* HeyGen-Style Avatar Gallery - Large Cards */}
      {photos.map((photo, index) => (
        <button
          key={photo.id || index}
          onClick={() => setSelectedPhoto(photo)}
          className="relative group rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-300 bg-white w-full"
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
          
          {/* Name Overlay at Bottom - Always Visible */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
            <p className="text-white text-sm font-medium truncate">
              {photo.name || `Avatar ${index + 1}`}
            </p>
          </div>

          {/* Hover Actions Overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="flex gap-2 text-white">
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
                <ZoomIn className="w-5 h-5" />
              </div>
              {photo.motion_preview_url && (
                <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
                  <Play className="w-5 h-5" />
                </div>
              )}
            </div>
          </div>

          {/* Video Badge */}
          {photo.motion_preview_url && (
            <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
              <Play className="w-3 h-3" />
              Video
            </div>
          )}
        </button>
      ))}

      {/* Full-Size Photo Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-playfair text-2xl">
              {selectedPhoto?.name || 'Avatar'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedPhoto && (
            <div className="space-y-4">
              {/* Full-size image */}
              <div className="relative w-full max-h-[70vh] overflow-hidden rounded-lg border-2 border-[#D4AF37]/30 bg-gray-50">
                <img
                  src={selectedPhoto.url}
                  alt={selectedPhoto.name || 'Avatar'}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://ui-avatars.com/api/?name=Avatar&background=D4AF37&color=fff&size=800';
                  }}
                />
              </div>

              {/* Motion Preview - Compact with Sound */}
              {selectedPhoto.motion_preview_url && (
                <div className="border-2 border-[#D4AF37]/30 rounded-lg overflow-hidden bg-black">
                  <video
                    src={selectedPhoto.motion_preview_url}
                    controls
                    controlsList="nodownload"
                    className="w-full max-h-[400px] object-contain"
                    autoPlay
                    loop
                    playsInline
                  >
                    Your browser does not support video playback.
                  </video>
                  <div className="bg-gray-900 px-3 py-2 text-xs text-gray-300 flex items-center gap-2">
                    <Play className="w-3 h-3" />
                    Motion Preview • Click play to see avatar animation with sound
                  </div>
                </div>
              )}

              {/* Photo Actions */}
              <div className="flex gap-2 justify-between">
                <div className="flex gap-2">
                  {selectedPhoto.id && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (selectedPhoto.id) {
                            addMotionMutation.mutate(selectedPhoto.id);
                          }
                        }}
                        disabled={addMotionMutation.isPending}
                        className="border-[#D4AF37]/30 hover:bg-[#D4AF37]/10"
                        data-testid="button-add-motion"
                      >
                        {addMotionMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-4 h-4 mr-2" />
                            Add Motion
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (selectedPhoto.id) {
                            addSoundEffectMutation.mutate(selectedPhoto.id);
                          }
                        }}
                        disabled={addSoundEffectMutation.isPending}
                        className="border-[#D4AF37]/30 hover:bg-[#D4AF37]/10"
                        data-testid="button-add-sound"
                      >
                        {addSoundEffectMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-4 h-4 mr-2" />
                            Add Sound
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (selectedPhoto.id && confirm('Are you sure you want to delete this avatar? This action cannot be undone.')) {
                            deleteAvatarMutation.mutate(selectedPhoto.id);
                          }
                        }}
                        disabled={deleteAvatarMutation.isPending}
                        className="border-red-300 text-red-600 hover:bg-red-50"
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
                            Delete
                          </>
                        )}
                      </Button>
                    </>
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
                    Download
                  </Button>
                  {selectedPhoto.motion_preview_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedPhoto.motion_preview_url) {
                          window.open(selectedPhoto.motion_preview_url, '_blank');
                        }
                      }}
                      className="border-[#D4AF37]/30 hover:bg-[#D4AF37]/10"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Download Video
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => setSelectedPhoto(null)}
                    className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110"
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
