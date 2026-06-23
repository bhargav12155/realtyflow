import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Loader2, Sparkles, Upload, X } from "lucide-react";
import { usePhotoAvatars } from "./context";
import type { AILookOrientation, AILookPose, AvatarGroup } from "./types";

export function AILookDialog() {
  const m = usePhotoAvatars();
  const {
    aiLookDialogOpen, setAiLookDialogOpen,
    aiLookSource, setAiLookSource,
    aiLookFile, setAiLookFile,
    aiLookFilePreview, setAiLookFilePreview,
    aiLookPrompt, setAiLookPrompt,
    aiLookOrientation, setAiLookOrientation,
    aiLookPose, setAiLookPose,
    aiLookStyle, setAiLookStyle,
    aiLookSelectedGroup, setAiLookSelectedGroup,
    aiLookGenerating,
    aiLookFileRef,
    handleAiLookGenerate,
    avatarGroups,
  } = m;

  return (
    <Dialog open={aiLookDialogOpen} onOpenChange={(open) => {
      setAiLookDialogOpen(open);
      if (!open) {
        setAiLookFile(null);
        setAiLookFilePreview(null);
      }
    }}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#D4AF37]" />
            Generate New Look
          </DialogTitle>
          <DialogDescription>
            Create a new appearance for your selected avatar with different
            outfits and styles
          </DialogDescription>
        </DialogHeader>

        <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg p-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#D4AF37]" />
          <span className="text-sm">
            <strong>Processing time:</strong> 2-3 minutes. You can close this
            modal and continue working.
          </span>
        </div>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="font-semibold">Source</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={aiLookSource === "upload" ? "default" : "outline"}
                onClick={() => setAiLookSource("upload")}
                className={aiLookSource === "upload" ? "bg-[#D4AF37] hover:bg-[#B8860B] text-black" : ""}
                data-testid="button-source-upload"
              >
                Use staged photo
              </Button>
              <Button
                type="button"
                variant={aiLookSource === "existing" ? "default" : "outline"}
                onClick={() => setAiLookSource("existing")}
                className={aiLookSource === "existing" ? "bg-[#D4AF37] hover:bg-[#B8860B] text-black" : ""}
                data-testid="button-source-existing"
              >
                Use existing avatar
              </Button>
            </div>
          </div>

          {aiLookSource === "upload" ? (
            <div className="space-y-2">
              <input
                type="file"
                ref={aiLookFileRef}
                accept="image/*"
                className="hidden"
                data-testid="input-ai-look-file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setAiLookFile(file);
                    const reader = new FileReader();
                    reader.onload = () => setAiLookFilePreview(reader.result as string);
                    reader.readAsDataURL(file);
                  }
                }}
              />
              {aiLookFilePreview ? (
                <div className="relative">
                  <img src={aiLookFilePreview} alt="Preview" className="w-full h-40 object-cover rounded-lg border" />
                  <button
                    type="button"
                    onClick={() => {
                      setAiLookFile(null);
                      setAiLookFilePreview(null);
                    }}
                    className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 rounded-full p-1"
                    data-testid="button-remove-ai-look-file"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed border-gray-300 hover:border-[#D4AF37] rounded-lg p-8 text-center cursor-pointer transition-colors"
                  onClick={() => aiLookFileRef.current?.click()}
                  data-testid="dropzone-ai-look"
                >
                  <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-muted-foreground">Click to upload a photo</p>
                  <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, WebP • Max 50MB</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Using your latest staged photo by default.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Select Avatar Group</Label>
              <Select value={aiLookSelectedGroup} onValueChange={setAiLookSelectedGroup}>
                <SelectTrigger data-testid="select-ai-look-group">
                  <SelectValue placeholder="Choose an avatar..." />
                </SelectTrigger>
                <SelectContent>
                  {avatarGroups.map((group: AvatarGroup) => (
                    <SelectItem key={group.group_id} value={group.group_id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="font-semibold">Describe the Look</Label>
            <Input
              placeholder="e.g., White shirt front-facing, Professional attire, Casual outfit"
              value={aiLookPrompt}
              onChange={(e) => setAiLookPrompt(e.target.value)}
              data-testid="input-ai-look-prompt"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-semibold">Orientation</Label>
            <Select value={aiLookOrientation} onValueChange={(v) => setAiLookOrientation(v as AILookOrientation)}>
              <SelectTrigger data-testid="select-ai-look-orientation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="square">Square</SelectItem>
                <SelectItem value="horizontal">Horizontal</SelectItem>
                <SelectItem value="vertical">Vertical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold">Pose</Label>
            <Select value={aiLookPose} onValueChange={(v) => setAiLookPose(v as AILookPose)}>
              <SelectTrigger data-testid="select-ai-look-pose">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="half_body">Half Body</SelectItem>
                <SelectItem value="close_up">Close Up</SelectItem>
                <SelectItem value="full_body">Full Body</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold">Style</Label>
            <Select value={aiLookStyle} onValueChange={setAiLookStyle}>
              <SelectTrigger data-testid="select-ai-look-style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Realistic">Realistic</SelectItem>
                <SelectItem value="Cinematic">Cinematic</SelectItem>
                <SelectItem value="Pixar">Pixar</SelectItem>
                <SelectItem value="Vintage">Vintage</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setAiLookDialogOpen(false);
              setAiLookFile(null);
              setAiLookFilePreview(null);
            }}
            data-testid="button-cancel-ai-look"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAiLookGenerate}
            disabled={
              aiLookGenerating ||
              (aiLookSource === "upload" && !aiLookFile) ||
              (aiLookSource === "existing" && !aiLookSelectedGroup)
            }
            className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110 text-black"
            data-testid="button-ok-ai-look"
          >
            {aiLookGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              "OK"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
