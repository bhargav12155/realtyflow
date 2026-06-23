import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Loader2 } from "lucide-react";
import { LargeAvatarCard } from "./LargeAvatarCard";
import { usePhotoAvatars } from "./context";
import type {
  AgeOption,
  AvatarGroup,
  GenderOption,
  OrientationOption,
  PoseOption,
  StyleOption,
} from "./types";

export function GenerateTab() {
  const m = usePhotoAvatars();
  const {
    generationForm, setGenerationForm,
    generatePhotosMutation,
    avatarGroups, isLoadingGroups,
    setOpenGalleryGroupId,
    setSelectedGroupForEdit, setEditDialogOpen,
    deleteGroupMutation,
  } = m;

  return (
    <TabsContent value="generate" className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Name</Label>
          <Input
            value={generationForm.name}
            onChange={(e) =>
              setGenerationForm({ ...generationForm, name: e.target.value })
            }
            placeholder="Avatar name..."
            data-testid="input-avatar-name"
          />
        </div>

        <div>
          <Label>Age Range</Label>
          <Select
            value={generationForm.age}
            onValueChange={(value) =>
              setGenerationForm({ ...generationForm, age: value as AgeOption })
            }
          >
            <SelectTrigger data-testid="select-age">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Young Adult">Young Adult</SelectItem>
              <SelectItem value="Early Middle Age">Early Middle Age</SelectItem>
              <SelectItem value="Late Middle Age">Late Middle Age</SelectItem>
              <SelectItem value="Senior">Senior</SelectItem>
              <SelectItem value="Unspecified">Unspecified</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Gender</Label>
          <Select
            value={generationForm.gender}
            onValueChange={(value) =>
              setGenerationForm({ ...generationForm, gender: value as GenderOption })
            }
          >
            <SelectTrigger data-testid="select-gender">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Man">Man</SelectItem>
              <SelectItem value="Woman">Woman</SelectItem>
              <SelectItem value="Person">Person</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Ethnicity</Label>
          <Select
            value={generationForm.ethnicity}
            onValueChange={(value) =>
              setGenerationForm({ ...generationForm, ethnicity: value })
            }
          >
            <SelectTrigger data-testid="select-ethnicity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="White">White</SelectItem>
              <SelectItem value="Black">Black</SelectItem>
              <SelectItem value="Asian American">Asian American</SelectItem>
              <SelectItem value="East Asian">East Asian</SelectItem>
              <SelectItem value="South East Asian">South East Asian</SelectItem>
              <SelectItem value="South Asian">South Asian</SelectItem>
              <SelectItem value="Middle Eastern">Middle Eastern</SelectItem>
              <SelectItem value="Pacific">Pacific</SelectItem>
              <SelectItem value="Hispanic">Hispanic</SelectItem>
              <SelectItem value="Unspecified">Unspecified</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Orientation</Label>
          <Select
            value={generationForm.orientation}
            onValueChange={(value) =>
              setGenerationForm({ ...generationForm, orientation: value as OrientationOption })
            }
          >
            <SelectTrigger data-testid="select-orientation">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="horizontal">Horizontal</SelectItem>
              <SelectItem value="vertical">Vertical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Pose</Label>
          <Select
            value={generationForm.pose}
            onValueChange={(value) =>
              setGenerationForm({ ...generationForm, pose: value as PoseOption })
            }
          >
            <SelectTrigger data-testid="select-pose">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full_body">Full Body</SelectItem>
              <SelectItem value="half_body">Half Body</SelectItem>
              <SelectItem value="close_up">Close Up</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Style</Label>
          <Select
            value={generationForm.style}
            onValueChange={(value) =>
              setGenerationForm({ ...generationForm, style: value as StyleOption })
            }
          >
            <SelectTrigger data-testid="select-style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Realistic">Realistic</SelectItem>
              <SelectItem value="Pixar">Pixar</SelectItem>
              <SelectItem value="Cinematic">Cinematic</SelectItem>
              <SelectItem value="Vintage">Vintage</SelectItem>
              <SelectItem value="Noir">Noir</SelectItem>
              <SelectItem value="Cyberpunk">Cyberpunk</SelectItem>
              <SelectItem value="Unspecified">Unspecified</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Appearance Description</Label>
        <Textarea
          value={generationForm.appearance}
          onChange={(e) =>
            setGenerationForm({ ...generationForm, appearance: e.target.value })
          }
          placeholder="Describe the appearance in detail..."
          rows={3}
          data-testid="textarea-appearance"
        />
      </div>

      <Button
        onClick={() => generatePhotosMutation.mutate(generationForm)}
        disabled={generatePhotosMutation.isPending}
        className="w-full"
        data-testid="button-generate"
      >
        {generatePhotosMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generating Photos...
          </>
        ) : (
          <>
            <Camera className="w-4 h-4 mr-2" />
            Generate 5 AI Photos
          </>
        )}
      </Button>

      {avatarGroups &&
        avatarGroups.length > 0 &&
        avatarGroups.some((g: AvatarGroup) => g.train_status === "processing") && (
          <Alert className="mt-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">Avatar Training in Progress...</p>
                <p className="text-sm">
                  {avatarGroups.filter((g: AvatarGroup) => g.train_status === "processing").length}{" "}
                  avatar group(s) are being trained by HeyGen. This typically
                  takes 2-3 minutes. The page will auto-refresh every 5 seconds.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

      {avatarGroups && avatarGroups.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <h3 className="text-sm font-semibold mb-3 text-gray-700">My Avatars</h3>

          <div className="flex gap-3 overflow-x-auto pb-3 mb-4">
            {avatarGroups.map((group: AvatarGroup) => (
              <button
                key={group.group_id}
                onClick={() => {
                  const element = document.getElementById(`avatar-group-${group.group_id}`);
                  if (element) {
                    element.scrollIntoView({ behavior: "smooth", block: "center" });
                  }
                }}
                className="flex flex-col items-center min-w-[70px] focus:outline-none group"
                data-testid={`avatar-thumb-${group.group_id}`}
              >
                <div className="relative">
                  <img
                    src={group.preview_image}
                    alt={group.name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 group-hover:border-[#D4AF37] transition-all cursor-pointer"
                  />
                  {(group.num_looks ?? 0) > 1 && (
                    <div className="absolute -top-0.5 -right-0.5 bg-[#D4AF37] text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-semibold">
                      {group.num_looks}
                    </div>
                  )}
                </div>
                <p className="text-[10px] mt-1.5 text-center font-medium text-gray-600 truncate w-16">
                  {group.name}
                </p>
              </button>
            ))}
          </div>

          <h4 className="text-xs font-medium text-gray-500 mb-3">All avatar looks</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {avatarGroups.map((group: AvatarGroup) => (
              <LargeAvatarCard
                key={group.group_id}
                groupId={group.group_id}
                groupName={group.name}
                onOpenGallery={() => setOpenGalleryGroupId(group.group_id)}
                onChangeOutfit={() => {
                  setSelectedGroupForEdit(group);
                  setEditDialogOpen(true);
                }}
                onDelete={() => deleteGroupMutation.mutate(group.group_id)}
              />
            ))}
          </div>
        </div>
      )}

      {isLoadingGroups && (
        <div className="mt-6 flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-600">Loading your avatars...</span>
        </div>
      )}
    </TabsContent>
  );
}
