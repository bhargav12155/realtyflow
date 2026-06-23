import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Play, Trash2, Video } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface GeneratedVideo {
  id: string;
  title: string;
  script: string;
  videoUrl?: string;
  video_url?: string;
  status: string;
  createdAt?: string;
  created_at?: string;
  heygenVideoId?: string;
  heygenAvatarId?: string;
  heygenVoiceId?: string;
}

export default function VideosPage() {
  const [selectedVideo, setSelectedVideo] = useState<GeneratedVideo | null>(null);

  const { data: videosResponse, isLoading } = useQuery<
    GeneratedVideo[] | { videos?: GeneratedVideo[]; data?: GeneratedVideo[] }
  >({
    queryKey: ["/api/videos"],
    refetchInterval: 5000,
  });

  // Handle both array response and object-wrapped response
  const videos = Array.isArray(videosResponse) 
    ? videosResponse 
    : (videosResponse?.videos || videosResponse?.data || []);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "ready":
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "generating":
      case "processing":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "failed":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const getVideoUrl = (video: GeneratedVideo) => video.videoUrl || video.video_url;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Video className="h-8 w-8 text-[#D4AF37]" />
            Generated Videos
          </h1>
          <p className="text-gray-500 mt-2">View and manage your AI-generated avatar videos</p>
        </div>
      </div>

      {isLoading ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
          </CardContent>
        </Card>
      ) : videos.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Video className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500 mb-2">No videos generated yet</p>
            <p className="text-sm text-gray-400">Go to Avatar Studio to create your first video</p>
            <Button className="mt-4 bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white">
              Create Video
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((video) => (
            <Card key={video.id} className="border-0 shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg truncate">{video.title || "Untitled Video"}</CardTitle>
                    <Badge className={`mt-2 ${getStatusColor(video.status)}`}>
                      {video.status?.charAt(0).toUpperCase() + video.status?.slice(1) || "unknown"}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {video.created_at || video.createdAt
                    ? new Date(video.created_at || video.createdAt!).toLocaleDateString()
                    : ""}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{video.script}</p>

                {getVideoUrl(video) && (
                  <div className="bg-black rounded-lg h-40 flex items-center justify-center">
                    <video
                      src={getVideoUrl(video)}
                      className="w-full h-full object-cover rounded-lg"
                      onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                      onMouseLeave={(e) => (e.currentTarget as HTMLVideoElement).pause()}
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  {getVideoUrl(video) && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setSelectedVideo(video)}
                        data-testid={`button-play-${video.id}`}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Watch
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(getVideoUrl(video), "_blank")}
                        data-testid={`button-download-${video.id}`}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-2xl" data-testid="dialog-video-player">
          <DialogHeader>
            <DialogTitle>{selectedVideo?.title || "Video Player"}</DialogTitle>
          </DialogHeader>
          {selectedVideo && getVideoUrl(selectedVideo) && (
            <div className="space-y-4">
              <video
                controls
                autoPlay
                className="w-full rounded-lg bg-black"
                src={getVideoUrl(selectedVideo)}
                data-testid="video-player"
              />
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Script:</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{selectedVideo.script}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
