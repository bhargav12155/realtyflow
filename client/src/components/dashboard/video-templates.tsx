import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Play, Sparkles, Video } from "lucide-react";
import { useState } from "react";

interface HeyGenTemplate {
  template_id: string;
  name: string;
  thumbnail_image_url: string;
  aspect_ratio: string;
}

interface TemplateVariable {
  name: string;
  type: string;
  properties: {
    content?: string;
    url?: string;
    voice_id?: string;
    character_id?: string;
  };
}

interface TemplateScene {
  id: string;
  script: string;
  variables: TemplateVariable[];
}

interface TemplateDetails {
  version: string;
  scenes: TemplateScene[] | null;
  variables: Record<string, TemplateVariable>;
}

export function VideoTemplates() {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] =
    useState<HeyGenTemplate | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [templateVariables, setTemplateVariables] = useState<
    Record<string, any>
  >({});
  const [videoTitle, setVideoTitle] = useState("");

  // Fetch user's avatars for selection
  const { data: avatars } = useQuery({
    queryKey: ["/api/avatars"],
  });

  // Fetch photo avatar groups with looks
  const { data: photoAvatarGroups } = useQuery({
    queryKey: ["/api/photo-avatars/groups"],
  });

  // Fetch templates list
  const templatesQuery = useQuery({
    queryKey: ["/api/heygen/templates"],
    select: (data: any) => {
      console.log("🔍 [TEMPLATES] Raw API response:", data);
      console.log("🔍 [TEMPLATES] Is array?", Array.isArray(data));
      console.log("🔍 [TEMPLATES] Data type:", typeof data);
      console.log(
        "🔍 [TEMPLATES] Data keys:",
        data ? Object.keys(data) : "null"
      );

      let templates = [];
      if (Array.isArray(data)) {
        templates = data;
      } else if (data && data.templates && Array.isArray(data.templates)) {
        templates = data.templates;
      } else if (data && typeof data === "object") {
        console.log(
          "🔍 [TEMPLATES] Data structure:",
          JSON.stringify(data, null, 2)
        );
      }

      console.log("✅ [TEMPLATES] Final templates array:", templates);
      console.log("✅ [TEMPLATES] Templates count:", templates.length);
      return templates;
    },
  });

  // Fetch template details when selected
  const templateDetailsQuery = useQuery({
    queryKey: ["/api/heygen/templates", selectedTemplate?.template_id],
    enabled: !!selectedTemplate,
    select: (data: any) => data as TemplateDetails,
  });

  // Generate video from template
  const generateMutation = useMutation({
    mutationFn: async (data: {
      templateId: string;
      title: string;
      variables: Record<string, any>;
    }) => {
      return await apiRequest(
        "POST",
        `/api/heygen/templates/${data.templateId}/generate`,
        {
          title: data.title,
          variables: data.variables,
          caption: true,
          include_gif: true,
          enable_sharing: true,
        }
      );
    },
    onSuccess: () => {
      toast({
        title: "Video Generation Started",
        description:
          "Your video is being generated. Check the Videos tab for progress.",
      });
      setShowGenerateDialog(false);
      setSelectedTemplate(null);
      setTemplateVariables({});
      setVideoTitle("");
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate video from template",
        variant: "destructive",
      });
    },
  });

  const handleTemplateSelect = (template: HeyGenTemplate) => {
    setSelectedTemplate(template);
    setTemplateVariables({});
    setVideoTitle(template.name);
    setShowGenerateDialog(true);
  };

  const handleGenerate = () => {
    if (!selectedTemplate) return;

    generateMutation.mutate({
      templateId: selectedTemplate.template_id,
      title: videoTitle,
      variables: templateVariables,
    });
  };

  const handleVariableChange = (varName: string, value: any) => {
    setTemplateVariables((prev) => ({
      ...prev,
      [varName]: value,
    }));
  };

  // Helper to get avatar's HeyGen ID
  const getAvatarHeyGenId = (avatarId: string) => {
    const avatar = avatars?.find((a: any) => a.id === avatarId);
    return avatar?.metadata?.heygenAvatarId || avatar?.heygenAvatarId;
  };

  // Helper to render avatar variable input with look selection
  const renderAvatarInput = (varName: string, variable: TemplateVariable) => {
    const selectedAvatarId = templateVariables[varName]?.avatar_id;
    const selectedAvatar = avatars?.find((a: any) => a.id === selectedAvatarId);

    // Get looks for the selected avatar if it's a photo avatar
    const avatarGroup = photoAvatarGroups?.groups?.find(
      (g: any) => g.group_id === selectedAvatar?.groupId
    );

    const avatarLooks = avatarGroup?.looks || [];

    return (
      <div
        key={varName}
        className="space-y-3 p-4 border rounded-lg bg-muted/30"
      >
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-purple-600" />
          <Label className="font-semibold">{variable.name || varName}</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Select an avatar and optionally choose a specific look/outfit
        </p>

        {/* Avatar Selection */}
        <div>
          <Label htmlFor={`avatar-${varName}`} className="text-xs">
            Avatar
          </Label>
          <Select
            value={selectedAvatarId || ""}
            onValueChange={(value) => {
              const avatar = avatars?.find((a: any) => a.id === value);
              const heygenId = getAvatarHeyGenId(value);

              handleVariableChange(varName, {
                name: varName,
                type: "avatar",
                properties: {
                  character_id: heygenId,
                  avatar_id: value,
                  avatar_name: avatar?.name,
                },
              });
            }}
          >
            <SelectTrigger
              id={`avatar-${varName}`}
              data-testid={`select-avatar-${varName}`}
            >
              <SelectValue placeholder="Choose an avatar..." />
            </SelectTrigger>
            <SelectContent>
              {avatars?.map((avatar: any) => (
                <SelectItem key={avatar.id} value={avatar.id}>
                  {avatar.name || "Unnamed Avatar"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Look Selection (if photo avatar with multiple looks) */}
        {selectedAvatarId && avatarLooks.length > 0 && (
          <div>
            <Label htmlFor={`look-${varName}`} className="text-xs">
              Avatar Look/Outfit ({avatarLooks.length} available)
            </Label>
            <Select
              value={templateVariables[varName]?.properties?.look_id || ""}
              onValueChange={(lookId) => {
                const look = avatarLooks.find(
                  (l: any) => l.avatar_id === lookId
                );
                handleVariableChange(varName, {
                  ...templateVariables[varName],
                  properties: {
                    ...templateVariables[varName]?.properties,
                    character_id: lookId, // Use the specific look's ID
                    look_id: lookId,
                    look_name: look?.name || "Custom Look",
                  },
                });
              }}
            >
              <SelectTrigger
                id={`look-${varName}`}
                data-testid={`select-look-${varName}`}
              >
                <SelectValue placeholder="Use default look or choose specific..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default Look</SelectItem>
                {avatarLooks.map((look: any) => (
                  <SelectItem key={look.avatar_id} value={look.avatar_id}>
                    {look.name || `Look ${look.avatar_id.substring(0, 8)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {templateVariables[varName]?.properties?.look_id && (
              <p className="text-xs text-muted-foreground mt-1">
                ✨ Using specific look:{" "}
                {templateVariables[varName]?.properties?.look_name}
              </p>
            )}
          </div>
        )}

        {/* Voice Selection (optional) */}
        <div>
          <Label htmlFor={`voice-${varName}`} className="text-xs">
            Voice (Optional)
          </Label>
          <Input
            id={`voice-${varName}`}
            placeholder="Enter HeyGen voice ID or leave empty for default"
            value={templateVariables[varName]?.properties?.voice_id || ""}
            onChange={(e) => {
              handleVariableChange(varName, {
                ...templateVariables[varName],
                properties: {
                  ...templateVariables[varName]?.properties,
                  voice_id: e.target.value,
                },
              });
            }}
            data-testid={`input-voice-${varName}`}
          />
        </div>
      </div>
    );
  };

  const templates = templatesQuery.data || [];

  console.log("🎨 [RENDER] Templates query state:", {
    isLoading: templatesQuery.isLoading,
    isError: templatesQuery.isError,
    error: templatesQuery.error,
    dataExists: !!templatesQuery.data,
    templatesCount: templates.length,
  });

  return (
    <>
      <Card data-testid="card-video-templates">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Video Templates
          </CardTitle>
          <CardDescription>
            Browse and use professional video templates from HeyGen to create
            engaging content quickly
          </CardDescription>
        </CardHeader>
        <CardContent>
          {templatesQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : templatesQuery.data && templatesQuery.data.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templatesQuery.data.map((template: HeyGenTemplate) => {
                console.log("🎬 [RENDER] Rendering template:", template);
                return (
                  <Card
                    key={template.template_id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => handleTemplateSelect(template)}
                    data-testid={`card-template-${template.template_id}`}
                  >
                    <div className="aspect-video bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 relative overflow-hidden">
                      {template.thumbnail_image_url ? (
                        <img
                          src={template.thumbnail_image_url}
                          alt={template.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600">
                          <Video className="w-16 h-16 text-white mb-3 opacity-90" />
                          <h3 className="text-white font-semibold text-center text-sm leading-tight">
                            {template.name}
                          </h3>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button size="sm" variant="secondary">
                          <Play className="w-4 h-4 mr-2" />
                          Use Template
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <h3
                        className="font-semibold truncate"
                        data-testid={`text-template-name-${template.template_id}`}
                      >
                        {template.name}
                      </h3>
                      <p className="text-sm text-muted-foreground capitalize mt-1">
                        {template.aspect_ratio}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No templates available</p>
              <p className="text-xs mt-2 text-red-500">
                {templatesQuery.isError
                  ? `Error: ${templatesQuery.error}`
                  : "Check browser console for details"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Video Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Generate Video from Template</DialogTitle>
            <DialogDescription>
              Customize the template variables and generate your video
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {/* Video Title */}
              <div>
                <Label htmlFor="video-title">Video Title</Label>
                <Input
                  id="video-title"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="Enter video title"
                  data-testid="input-video-title"
                />
              </div>

              {/* Template Variables */}
              {templateDetailsQuery.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : templateDetailsQuery.data?.variables &&
                Object.keys(templateDetailsQuery.data.variables).length > 0 ? (
                <>
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-4">Template Variables</h4>
                    {Object.entries(templateDetailsQuery.data.variables).map(
                      ([key, variable]) => {
                        // Special handling for avatar variables
                        if (variable.type === "avatar") {
                          return renderAvatarInput(key, variable);
                        }

                        // Standard variable types
                        return (
                          <div key={key} className="mb-4">
                            <Label htmlFor={`var-${key}`}>
                              {variable.name || key}
                            </Label>
                            <p className="text-xs text-muted-foreground mb-2">
                              Type: {variable.type}
                            </p>

                            {variable.type === "text" ? (
                              <Textarea
                                id={`var-${key}`}
                                value={
                                  templateVariables[key] ||
                                  variable.properties.content ||
                                  ""
                                }
                                onChange={(e) =>
                                  handleVariableChange(key, e.target.value)
                                }
                                placeholder={`Enter ${variable.name || key}`}
                                rows={3}
                                data-testid={`input-variable-${key}`}
                              />
                            ) : variable.type === "image" ||
                              variable.type === "video" ? (
                              <Input
                                id={`var-${key}`}
                                type="url"
                                value={
                                  templateVariables[key] ||
                                  variable.properties.url ||
                                  ""
                                }
                                onChange={(e) =>
                                  handleVariableChange(key, e.target.value)
                                }
                                placeholder={`Enter ${variable.type} URL`}
                                data-testid={`input-variable-${key}`}
                              />
                            ) : (
                              <Input
                                id={`var-${key}`}
                                value={
                                  templateVariables[key] ||
                                  variable.properties.content ||
                                  ""
                                }
                                onChange={(e) =>
                                  handleVariableChange(key, e.target.value)
                                }
                                placeholder={`Enter ${variable.name || key}`}
                                data-testid={`input-variable-${key}`}
                              />
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No variables to configure for this template
                </p>
              )}

              {/* Scenes (if available) */}
              {templateDetailsQuery.data?.scenes &&
                templateDetailsQuery.data.scenes.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-4">
                      Template Scenes ({templateDetailsQuery.data.scenes.length}
                      )
                    </h4>
                    <div className="space-y-2">
                      {templateDetailsQuery.data.scenes.map((scene, idx) => (
                        <div key={scene.id} className="p-3 bg-muted rounded-lg">
                          <p className="text-sm font-medium">Scene {idx + 1}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {scene.script}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowGenerateDialog(false)}
              data-testid="button-cancel-generate"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !videoTitle}
              data-testid="button-generate-video"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Generate Video
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
