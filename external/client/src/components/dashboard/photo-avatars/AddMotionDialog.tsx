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
import { Loader2, Play } from "lucide-react";
import { usePhotoAvatars } from "./context";

export function AddMotionDialog() {
  const m = usePhotoAvatars();
  const {
    addMotionDialogOpen, setAddMotionDialogOpen,
    selectedAvatarForMotion,
    motionPrompt, setMotionPrompt,
    motionType, setMotionType,
    addMotionMutation,
  } = m;

  return (
    <Dialog open={addMotionDialogOpen} onOpenChange={setAddMotionDialogOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-purple-600" />
            Add Motion to Avatar
          </DialogTitle>
          <DialogDescription>
            Animate your avatar with natural motion to bring it to life. This
            creates a short animated video from your still image.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Avatar: {selectedAvatarForMotion?.groupName}</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="motion-prompt">Motion Description (Optional)</Label>
            <Textarea
              id="motion-prompt"
              placeholder="Example: subtle head nod and smile, gentle breathing motion..."
              value={motionPrompt}
              onChange={(e) => setMotionPrompt(e.target.value)}
              rows={3}
              className="resize-none"
              data-testid="textarea-motion-prompt"
            />
            <p className="text-xs text-muted-foreground">
              Leave blank for automatic natural motion
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="motion-type">Motion Engine</Label>
            <Select value={motionType} onValueChange={setMotionType}>
              <SelectTrigger data-testid="select-motion-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consistent">Consistent (Recommended)</SelectItem>
                <SelectItem value="expressive">Expressive</SelectItem>
                <SelectItem value="consistent_gen_3">Consistent Gen 3</SelectItem>
                <SelectItem value="hailuo_2">Hailuo 2</SelectItem>
                <SelectItem value="veo2">Veo 2</SelectItem>
                <SelectItem value="seedance_lite">Seedance Lite</SelectItem>
                <SelectItem value="kling">Kling</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Different engines produce varying styles of motion
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setAddMotionDialogOpen(false);
              setMotionPrompt("");
              setMotionType("consistent");
            }}
            data-testid="button-cancel-motion"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (selectedAvatarForMotion) {
                addMotionMutation.mutate({
                  avatarId: selectedAvatarForMotion.avatarId,
                  prompt: motionPrompt.trim() || undefined,
                  motionType,
                });
              }
            }}
            disabled={addMotionMutation.isPending}
            className="bg-gradient-to-r from-purple-600 to-purple-800 hover:brightness-110"
            data-testid="button-add-motion"
          >
            {addMotionMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding Motion...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Add Motion
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
