import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Image as ImageIcon, ZoomIn, Download, Play } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

  // Fetch photos for this avatar group
  const { data: photoData, isLoading } = useQuery<PhotoGalleryData>({
    queryKey: [`/api/photo-avatars/groups/${groupId}/photos`],
    enabled: !!groupId,
  });

  const photos = photoData?.photos || [];

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
      {/* Large Portrait Images Grid - Like HeyGen */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((photo, index) => (
          <button
            key={photo.id || index}
            onClick={() => setSelectedPhoto(photo)}
            className="relative group rounded-lg overflow-hidden border-2 border-gray-200 hover:border-[#D4AF37] transition-all duration-200 hover:shadow-xl bg-gray-50"
            style={{ aspectRatio: '3/4' }}
            data-testid={`avatar-photo-${index}`}
          >
            <img
              src={photo.url}
              alt={photo.name || `Avatar ${index + 1}`}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(photo.name || 'Avatar')}&background=D4AF37&color=fff&size=400`;
              }}
            />
            
            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <div className="flex items-center justify-between text-white">
                  <ZoomIn className="w-5 h-5" />
                  {photo.motion_preview_url && (
                    <Play className="w-5 h-5" />
                  )}
                </div>
              </div>
            </div>

            {/* Preview Badge */}
            {photo.motion_preview_url && (
              <div className="absolute top-2 right-2 bg-[#D4AF37] text-white text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
                <Play className="w-3 h-3" />
                Video
              </div>
            )}
          </button>
        ))}
      </div>

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
              <div className="flex gap-2 justify-end">
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
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
