import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Shirt, Wand2 } from "lucide-react";
import { OUTFIT_PRESETS } from "./constants";
import { usePhotoAvatars } from "./context";
import type { EditOrientation, EditPose } from "./types";

export function EditOutfitDialog() {
  const m = usePhotoAvatars();
  const {
    editDialogOpen, setEditDialogOpen,
    selectedGroupForEdit,
    editPrompt, setEditPrompt,
    editOrientation, setEditOrientation,
    editPose, setEditPose,
    editStyle, setEditStyle,
    editLookMutation,
  } = m;

  return (
    <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shirt className="h-5 w-5 text-[#D4AF37]" />
            Change Outfit
          </DialogTitle>
          <DialogDescription>
            Choose a preset outfit or describe what you'd like your avatar to wear.
            HeyGen will generate a new look with the selected clothing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Avatar Group: {selectedGroupForEdit?.name}</Label>
            <Badge variant="outline" className="ml-2">
              {selectedGroupForEdit?.group_id}
            </Badge>
          </div>

          <div className="space-y-2">
            <Label>Quick Outfit Presets</Label>
            <div className="grid grid-cols-3 gap-2">
              {OUTFIT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setEditPrompt(preset.prompt)}
                  className={`p-2 rounded-lg border text-left transition-all hover:border-[#D4AF37] hover:bg-[#D4AF37]/5 ${
                    editPrompt === preset.prompt
                      ? 'border-[#D4AF37] bg-[#D4AF37]/10'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                  data-testid={`button-preset-${preset.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <span className="text-lg">{preset.icon}</span>
                  <p className="text-xs font-medium mt-1">{preset.label}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 my-2">
            <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
            <span className="text-xs text-gray-400">or describe your own</span>
            <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-prompt">Describe the outfit</Label>
            <Textarea
              id="edit-prompt"
              placeholder="Describe the outfit: e.g., navy blazer with white shirt, or casual polo with khakis..."
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              rows={4}
              className="resize-none"
              data-testid="textarea-edit-prompt"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-orientation">Orientation</Label>
              <Select
                value={editOrientation}
                onValueChange={(value) => setEditOrientation(value as EditOrientation)}
              >
                <SelectTrigger data-testid="select-edit-orientation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="square">Square</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                  <SelectItem value="portrait">Portrait</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-pose">Pose</Label>
              <Select value={editPose} onValueChange={(value) => setEditPose(value as EditPose)}>
                <SelectTrigger data-testid="select-edit-pose">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="half_body">Half Body</SelectItem>
                  <SelectItem value="full_body">Full Body</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-style">Style</Label>
              <Select value={editStyle} onValueChange={setEditStyle}>
                <SelectTrigger data-testid="select-edit-style">
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

          <p className="text-xs text-muted-foreground">
            Be specific about what you want to change. This will generate a new
            look variation based on your description.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setEditDialogOpen(false);
              setEditPrompt("");
            }}
            data-testid="button-cancel-edit"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (selectedGroupForEdit && editPrompt.trim()) {
                editLookMutation.mutate({
                  groupId: selectedGroupForEdit.group_id,
                  prompt: editPrompt.trim(),
                  orientation: editOrientation,
                  pose: editPose,
                  style: editStyle,
                });
              }
            }}
            disabled={!editPrompt.trim() || editLookMutation.isPending}
            className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110"
            data-testid="button-generate-edit"
          >
            {editLookMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                Generate Outfit
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
