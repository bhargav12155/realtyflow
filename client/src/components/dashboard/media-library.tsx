import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Check,
  FileVideo,
  Image as ImageIcon,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useState } from "react";

interface MediaAsset {
  id: string;
  userId: string;
  type: "photo" | "video";
  source: "upload" | "heygen" | "library";
  url: string;
  thumbnailUrl: string | null;
  title: string | null;
  description: string | null;
  avatarId: string | null;
  fileSize: number | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  metadata: unknown;
  createdAt: string;
}

interface MediaLibraryProps {
  onSelectMedia?: (mediaIds: string[]) => void;
  selectedMediaIds?: string[];
  multiSelect?: boolean;
  typeFilter?: "photo" | "video" | "all";
}

export function MediaLibrary({
  onSelectMedia,
  selectedMediaIds = [],
  multiSelect = true,
  typeFilter = "all",
}: MediaLibraryProps) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "photo" | "video">(typeFilter);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Sync internal state with prop to ensure controlled behavior
  const selectedIds = selectedMediaIds;

  // Fetch media assets
  const { data: mediaAssets = [], isLoading } = useQuery<MediaAsset[]>({
    queryKey: ["/api/media", filter !== "all" ? filter : undefined],
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "type",
        file.type.startsWith("video/") ? "video" : "photo",
      );
      formData.append("source", "upload");

      const response = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Upload successful",
        description: "Your media has been uploaded to the library",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      setUploadFile(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
    }
  };

  const handleUpload = () => {
    if (uploadFile) {
      uploadMutation.mutate(uploadFile);
    }
  };

  const toggleSelection = (mediaId: string) => {
    let newSelection: string[];

    if (multiSelect) {
      newSelection = selectedIds.includes(mediaId)
        ? selectedIds.filter((id) => id !== mediaId)
        : [...selectedIds, mediaId];
    } else {
      newSelection = selectedIds.includes(mediaId) ? [] : [mediaId];
    }

    // Notify parent of selection change - parent manages state
    onSelectMedia?.(newSelection);
  };

  const filteredAssets = mediaAssets.filter((asset) => {
    if (filter === "all") return true;
    return asset.type === filter;
  });

  return (
    <div className="space-y-3 w-full overflow-hidden">
      {/* Header with filters and upload - compact layout */}
      <div className="flex flex-col gap-3 w-full">
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium whitespace-nowrap">Filter:</Label>
          <Select
            value={filter}
            onValueChange={(v) => setFilter(v as typeof filter)}
          >
            <SelectTrigger className="w-[120px] h-8 text-xs" data-testid="select-media-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="filter-all">
                All Media
              </SelectItem>
              <SelectItem value="photo" data-testid="filter-photo">
                Photos
              </SelectItem>
              <SelectItem value="video" data-testid="filter-video">
                Videos
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 w-full">
          <Input
            type="file"
            accept="image/*,video/*"
            onChange={handleFileChange}
            className="flex-1 h-8 text-xs"
            data-testid="input-media-upload"
          />
          <Button
            onClick={handleUpload}
            disabled={!uploadFile || uploadMutation.isPending}
            size="sm"
            className="shrink-0 h-8"
            data-testid="button-upload-media"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                <span className="text-xs">Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="mr-1 h-3 w-3" />
                <span className="text-xs">Upload</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Selection summary - compact */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between bg-primary/10 px-3 py-2 rounded-md">
          <span
            className="text-xs font-medium"
            data-testid="text-selection-count"
          >
            {selectedIds.length} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={() => {
              onSelectMedia?.([]);
            }}
            data-testid="button-clear-selection"
          >
            <X className="h-3 w-3 mr-1" />
            <span className="text-xs">Clear</span>
          </Button>
        </div>
      )}

      {/* Media grid - compact vertical layout */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-center space-y-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
            <p className="text-xs text-muted-foreground">Loading...</p>
          </div>
        </div>
      ) : filteredAssets.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-8 px-4">
            <div className="text-center space-y-2 max-w-xs">
              <div className="bg-muted/50 rounded-full w-12 h-12 flex items-center justify-center mx-auto">
                {filter === "photo" ? (
                  <ImageIcon className="h-5 w-5 text-muted-foreground/60" />
                ) : filter === "video" ? (
                  <FileVideo className="h-5 w-5 text-muted-foreground/60" />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground/60" />
                )}
              </div>
              <div className="text-sm font-medium text-foreground">
                {filter === "all"
                  ? "No media yet"
                  : `No ${filter}s yet`}
              </div>
              <p className="text-xs text-muted-foreground">
                Upload media to get started
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 w-full">
          {filteredAssets.map((asset) => (
            <Card
              key={asset.id}
              className={`group relative cursor-pointer transition-all duration-150 hover:shadow-lg ${
                selectedIds.includes(asset.id)
                  ? "ring-2 ring-primary shadow-lg"
                  : "hover:ring-1 hover:ring-border"
              }`}
              onClick={() => toggleSelection(asset.id)}
              data-testid={`card-media-${asset.id}`}
            >
              <CardContent className="p-0">
                {/* Media preview - small thumbnail */}
                <div className="aspect-square relative overflow-hidden rounded-t-lg bg-gradient-to-br from-muted to-muted/50">
                  {asset.type === "photo" ? (
                    <img
                      src={asset.url}
                      alt={asset.title || "Media asset"}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : asset.thumbnailUrl ? (
                    <div className="relative w-full h-full">
                      <img
                        src={asset.thumbnailUrl}
                        alt={asset.title || "Video thumbnail"}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="bg-white/90 rounded-full p-2">
                          <FileVideo className="h-4 w-4 text-primary" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/10 to-pink-500/10">
                      <FileVideo className="h-6 w-6 text-primary" />
                    </div>
                  )}

                  {/* Selection indicator - compact */}
                  {selectedIds.includes(asset.id) && (
                    <div className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground rounded-full p-1 shadow-md">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </div>
                  )}

                  {/* Type badge - compact */}
                  <div className="absolute bottom-1.5 left-1.5 bg-black/75 text-white px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1">
                    {asset.type === "photo" ? (
                      <ImageIcon className="h-2.5 w-2.5" />
                    ) : (
                      <FileVideo className="h-2.5 w-2.5" />
                    )}
                    {asset.type.toUpperCase()}
                  </div>
                </div>

                {/* Media info - minimal */}
                <div className="p-2 bg-background">
                  <div
                    className="text-xs font-medium truncate group-hover:text-primary transition-colors"
                    data-testid={`text-title-${asset.id}`}
                    title={asset.title || "Untitled"}
                  >
                    {asset.title || "Untitled"}
                  </div>
                  
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded-full capitalize">
                      {asset.source}
                    </span>
                    {asset.fileSize && (
                      <span className="text-[10px] text-muted-foreground">
                        {(asset.fileSize / 1024 / 1024).toFixed(1)}MB
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
