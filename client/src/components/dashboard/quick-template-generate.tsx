import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Play, Video } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TemplateItem {
  template_id: string;
  name: string;
  thumbnail_image_url?: string | null;
  aspect_ratio?: string;
}

interface TemplateVariable {
  name: string;
  type: string;
  properties: {
    content?: string;
    url?: string;
    character_id?: string;
    voice_id?: string;
  };
}

interface Avatar {
  avatar_id: string;
  avatar_name: string;
  preview_image_url?: string;
}

interface Voice {
  voice_id: string;
  name: string;
  language: string;
  gender: string;
}

export function QuickTemplateGenerate() {
  const { toast } = useToast();
  const [selected, setSelected] = useState<TemplateItem | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [videoId, setVideoId] = useState<string | null>(null);
  const [status, setStatus] = useState<any | null>(null);
  const pollRef = useRef<number | null>(null);

  // List templates from unified endpoint
  const listQuery = useQuery({
    queryKey: ["/api/templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error("Failed to load templates");
      return res.json();
    },
    select: (data: any): TemplateItem[] => {
      // Normalize various shapes into a flat templates array
      if (Array.isArray(data)) return data as TemplateItem[];
      if (Array.isArray(data?.templates))
        return data.templates as TemplateItem[];
      if (Array.isArray(data?.data?.templates))
        return data.data.templates as TemplateItem[];
      return [];
    },
  });

  // Fetch template details with variables
  const templateDetailsQuery = useQuery({
    queryKey: ["/api/templates", selected?.template_id],
    queryFn: async () => {
      if (!selected) return null;
      const res = await fetch(`/api/templates/${selected.template_id}`);
      if (!res.ok) throw new Error("Failed to load template details");
      return res.json();
    },
    enabled: !!selected,
  });

  // Fetch avatars
  const avatarsQuery = useQuery({
    queryKey: ["/api/avatars"],
    queryFn: async () => {
      const res = await fetch("/api/avatars");
      if (!res.ok) throw new Error("Failed to load avatars");
      const data = await res.json();
      return (data?.avatars || data?.data?.avatars || data || []) as Avatar[];
    },
    enabled: open,
  });

  // Fetch voices
  const voicesQuery = useQuery({
    queryKey: ["/api/voices"],
    queryFn: async () => {
      const res = await fetch("/api/voices");
      if (!res.ok) throw new Error("Failed to load voices");
      const data = await res.json();
      return (data?.data?.voices || data?.voices || []) as Voice[];
    },
    enabled: open,
  });

  // Generate via quick endpoint
  const generateMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiRequest("POST", "/api/templates/generate-quick", payload);
    },
    onSuccess: (data: any) => {
      const vid = data?.video_id;
      if (vid) {
        setVideoId(vid);
        toast({ title: "Generation started", description: `video_id: ${vid}` });
      } else {
        toast({
          title: "Unexpected response",
          description: JSON.stringify(data),
          variant: "destructive",
        });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Failed to generate",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    },
  });

  // Poll status
  useEffect(() => {
    if (!videoId) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/templates/video-status/${videoId}`);
        if (!res.ok) return;
        const data = await res.json();
        setStatus(data);
      } catch {}
    };
    poll();
    pollRef.current = window.setInterval(poll, 4000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [videoId]);

  const handleSelect = (t: TemplateItem) => {
    setSelected(t);
    setTitle(t.name || "Generated Video");
    setVariables({});
    setOpen(true);
    setVideoId(null);
    setStatus(null);
  };

  const handleGenerate = () => {
    if (!selected) return;

    generateMutation.mutate({
      templateId: selected.template_id,
      title,
      caption: true,
      include_gif: true,
      enable_sharing: true,
      variables,
    });
  };

  const updateVariable = (varName: string, field: string, value: any) => {
    setVariables((prev) => ({
      ...prev,
      [varName]: {
        ...prev[varName],
        name: varName,
        [field]: value,
      },
    }));
  };

  const templateVars = useMemo(() => {
    const vars = templateDetailsQuery.data?.variables || {};
    return Object.entries(vars).map(([key, val]: [string, any]) => ({
      name: key,
      ...val,
    }));
  }, [templateDetailsQuery.data]);

  // Validation
  const { missingFields, isValid } = useMemo(() => {
    const missing: string[] = [];

    templateVars.forEach((variable) => {
      const varData = variables[variable.name];

      if (!varData) {
        missing.push(variable.name);
        return;
      }

      if (variable.type === "character") {
        if (
          !varData.properties?.character_id ||
          !varData.properties?.voice_id
        ) {
          missing.push(variable.name);
        }
      } else if (variable.type === "text") {
        if (!varData.properties?.content?.trim()) {
          missing.push(variable.name);
        }
      } else if (variable.type === "image" || variable.type === "video") {
        if (!varData.properties?.url?.trim()) {
          missing.push(variable.name);
        }
      }
    });

    return { missingFields: missing, isValid: missing.length === 0 };
  }, [templateVars, variables]);

  const isDone = useMemo(() => status?.status === "completed", [status]);

  // Stop polling once processing completes
  useEffect(() => {
    if (status?.status === "completed" && pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [status]);

  // Guard against redundant open state updates that can trigger warnings in StrictMode
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen((prev) => (prev === nextOpen ? prev : nextOpen));
  }, []);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Quick Template Generate</CardTitle>
          <CardDescription>
            Pick a template, paste variables JSON (if needed), generate, and
            watch status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : listQuery.data && listQuery.data.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {listQuery.data.map((t: TemplateItem) => (
                <Card
                  key={t.template_id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleSelect(t)}
                >
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {t.thumbnail_image_url ? (
                      <img
                        src={t.thumbnail_image_url}
                        alt={t.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold truncate">{t.name}</h3>
                    <p className="text-sm text-muted-foreground capitalize mt-1">
                      {t.aspect_ratio || ""}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No templates available</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Generate from Template</DialogTitle>
            <DialogDescription>
              Template: {selected?.name} — ID: {selected?.template_id}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Video Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* Dynamic form fields based on template variables */}
              {templateDetailsQuery.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Loading template variables...
                  </span>
                </div>
              ) : templateVars.length > 0 ? (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-medium">Template Variables</h3>
                  {templateVars.map((variable) => (
                    <div key={variable.name} className="space-y-2">
                      {variable.type === "character" ? (
                        <>
                          <Label>{variable.name} (Avatar & Voice)</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                Avatar
                              </Label>
                              <Select
                                value={
                                  variables[variable.name]?.properties
                                    ?.character_id || ""
                                }
                                onValueChange={(val) => {
                                  updateVariable(
                                    variable.name,
                                    "type",
                                    "character"
                                  );
                                  updateVariable(variable.name, "properties", {
                                    ...variables[variable.name]?.properties,
                                    character_id: val,
                                  });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select avatar" />
                                </SelectTrigger>
                                <SelectContent>
                                  {avatarsQuery.data?.map((avatar) => (
                                    <SelectItem
                                      key={avatar.avatar_id}
                                      value={avatar.avatar_id}
                                    >
                                      {avatar.avatar_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                Voice
                              </Label>
                              <Select
                                value={
                                  variables[variable.name]?.properties
                                    ?.voice_id || ""
                                }
                                onValueChange={(val) => {
                                  updateVariable(
                                    variable.name,
                                    "type",
                                    "character"
                                  );
                                  updateVariable(variable.name, "properties", {
                                    ...variables[variable.name]?.properties,
                                    voice_id: val,
                                  });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select voice" />
                                </SelectTrigger>
                                <SelectContent>
                                  {voicesQuery.data
                                    ?.slice(0, 50)
                                    .map((voice) => (
                                      <SelectItem
                                        key={voice.voice_id}
                                        value={voice.voice_id}
                                      >
                                        {voice.name} ({voice.language},{" "}
                                        {voice.gender})
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </>
                      ) : variable.type === "text" ? (
                        <>
                          <Label htmlFor={variable.name}>{variable.name}</Label>
                          <Textarea
                            id={variable.name}
                            value={
                              variables[variable.name]?.properties?.content ||
                              ""
                            }
                            onChange={(e) => {
                              updateVariable(variable.name, "type", "text");
                              updateVariable(variable.name, "properties", {
                                content: e.target.value,
                              });
                            }}
                            placeholder={`Enter ${variable.name}`}
                            rows={3}
                          />
                        </>
                      ) : variable.type === "image" ||
                        variable.type === "video" ? (
                        <>
                          <Label htmlFor={variable.name}>
                            {variable.name} URL
                          </Label>
                          <Input
                            id={variable.name}
                            type="url"
                            value={
                              variables[variable.name]?.properties?.url || ""
                            }
                            onChange={(e) => {
                              updateVariable(
                                variable.name,
                                "type",
                                variable.type
                              );
                              updateVariable(variable.name, "properties", {
                                url: e.target.value,
                              });
                            }}
                            placeholder={`https://example.com/${variable.type}`}
                          />
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          Unsupported variable type: {variable.type}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground">
                    This template has no variables defined. You can still
                    generate a video with default settings.
                  </p>
                </div>
              )}

              {videoId && (
                <div className="border-t pt-4 space-y-2">
                  <div className="text-sm">
                    video_id: <code>{videoId}</code>
                  </div>
                  <div className="text-sm">
                    status: <code>{status?.status || "pending"}</code>
                  </div>
                  {status?.video_url && (
                    <div className="pt-2">
                      <a
                        className="text-primary underline"
                        href={status.video_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open video
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 pt-4 border-t">
            {missingFields.length > 0 && (
              <div className="flex-1 text-sm text-destructive">
                Missing required fields: {missingFields.join(", ")}
              </div>
            )}
            <Button
              variant="secondary"
              onClick={() => {
                if (pollRef.current) {
                  window.clearInterval(pollRef.current);
                  pollRef.current = null;
                }
                setVideoId(null);
                setStatus(null);
              }}
            >
              Reset
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={
                generateMutation.isPending ||
                !title ||
                (templateVars.length > 0 && !isValid)
              }
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
                  Generating...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" /> Generate
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default QuickTemplateGenerate;
