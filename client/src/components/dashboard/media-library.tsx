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
    <div className="space-y-4">
      {/* Header with filters and upload */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Label>Filter:</Label>
          <Select
            value={filter}
            onValueChange={(v) => setFilter(v as typeof filter)}
          >
            <SelectTrigger className="w-32" data-testid="select-media-filter">
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

        <div className="flex items-center gap-2">
          <Input
            type="file"
            accept="image/*,video/*"
            onChange={handleFileChange}
            className="w-64"
            data-testid="input-media-upload"
          />
          <Button
            onClick={handleUpload}
            disabled={!uploadFile || uploadMutation.isPending}
            data-testid="button-upload-media"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Selection summary */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between bg-primary/10 p-3 rounded-lg">
          <span
            className="text-sm font-medium"
            data-testid="text-selection-count"
          >
            {selectedIds.length} {selectedIds.length === 1 ? "item" : "items"}{" "}
            selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onSelectMedia?.([]);
            }}
            data-testid="button-clear-selection"
          >
            <X className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>
      )}

      {/* Media grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredAssets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-2">
              <div className="text-muted-foreground">
                {filter === "all"
                  ? "No media in your library yet"
                  : `No ${filter}s in your library yet`}
              </div>
              <p className="text-sm text-muted-foreground">
                Upload some media to get started
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredAssets.map((asset) => (
            <Card
              key={asset.id}
              className={`relative cursor-pointer transition-all hover:shadow-lg ${
                selectedIds.includes(asset.id)
                  ? "ring-2 ring-primary shadow-lg"
                  : ""
              }`}
              onClick={() => toggleSelection(asset.id)}
              data-testid={`card-media-${asset.id}`}
            >
              <CardContent className="p-0">
                {/* Media preview */}
                <div className="aspect-square relative overflow-hidden rounded-t-lg bg-muted">
                  {asset.type === "photo" ? (
                    <img
                      src={asset.url}
                      alt={asset.title || "Media asset"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                      <FileVideo className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}

                  {/* Selection indicator */}
                  {selectedIds.includes(asset.id) && (
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                      <Check className="h-4 w-4" />
                    </div>
                  )}

                  {/* Type badge */}
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                    {asset.type === "photo" ? (
                      <ImageIcon className="h-3 w-3" />
                    ) : (
                      <FileVideo className="h-3 w-3" />
                    )}
                    {asset.type}
                  </div>
                </div>

                {/* Media info */}
                <div className="p-3 space-y-1">
                  <div
                    className="text-sm font-medium truncate"
                    data-testid={`text-title-${asset.id}`}
                  >
                    {asset.title || "Untitled"}
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {asset.source}
                  </div>
                  {asset.fileSize && (
                    <div className="text-xs text-muted-foreground">
                      {(asset.fileSize / 1024 / 1024).toFixed(2)} MB
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
