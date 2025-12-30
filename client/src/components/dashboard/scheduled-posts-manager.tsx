import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  Calendar, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  Clock,
  Facebook, 
  Instagram, 
  Linkedin, 
  Twitter as XIcon,
  MapPin,
  Home,
  Eye,
  Sparkles,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Send,
  MoreHorizontal,
  Upload,
  Image
} from "lucide-react";
import { format } from "date-fns";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ObjectUploader } from "@/components/ObjectUploader";

interface ScheduledPost {
  id: string;
  platform: string;
  postType: string | null;
  content: string;
  hashtags: string[] | null;
  scheduledFor: string;
  status: string;
  isEdited: boolean;
  neighborhood: string | null;
  seoScore?: number;
  metadata?: {
    imageUrl?: string;
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
}

const platformIcons = {
  facebook: { icon: Facebook, color: "text-blue-600", name: "Facebook" },
  instagram: { icon: Instagram, color: "text-pink-600", name: "Instagram" },
  linkedin: { icon: Linkedin, color: "text-blue-700", name: "LinkedIn" },
  x: { icon: XIcon, color: "text-blue-400", name: "X" },
};

const postTypeLabels = {
  local_market: { label: "Local Market", icon: MapPin, color: "bg-green-100 text-green-700" },
  moving_guide: { label: "Moving Guide", icon: Home, color: "bg-blue-100 text-blue-700" },
  open_houses: { label: "Open House", icon: Home, color: "bg-purple-100 text-purple-700" },
  just_listed: { label: "Just Listed", icon: Home, color: "bg-orange-100 text-orange-700" },
  just_sold: { label: "Just Sold", icon: Check, color: "bg-green-100 text-green-700" },
  price_improvement: { label: "Price Drop", icon: Clock, color: "bg-red-100 text-red-700" },
};

export function ScheduledPostsManager() {
  const { user, isLoading: authLoading } = useAuth();
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editScheduledFor, setEditScheduledFor] = useState("");
  const [previewPost, setPreviewPost] = useState<ScheduledPost | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // Get user's display name with proper formatting (safe)
  const emailName = user?.email ? user.email.split('@')[0] : "";
  const rawName = (user?.name || emailName || "").trim();
  const userName = rawName
    ? rawName.charAt(0).toUpperCase() + rawName.slice(1)
    : "Agent";
  const [isEditingWithAI, setIsEditingWithAI] = useState(false);
  const [aiEditContent, setAiEditContent] = useState("");
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("Optimize this post for SEO and engagement while maintaining professional tone for real estate audience in Omaha, Nebraska.");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [editMode, setEditMode] = useState<"manual" | "ai">("manual");
  const [isEnhancingInEdit, setIsEnhancingInEdit] = useState(false);
  const [uploadingPostId, setUploadingPostId] = useState<string | null>(null);
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [photoUploadMode, setPhotoUploadMode] = useState<"upload" | "mls">("upload");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const { data: scheduledPosts = [], isLoading } = useQuery<ScheduledPost[]>({
    queryKey: ["/api/scheduled-posts"],
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updatePostMutation = useMutation({
    mutationFn: async ({ id, content, scheduledFor }: { id: string; content: string; scheduledFor: string }) => {
      const response = await apiRequest("PUT", `/api/scheduled-posts/${id}`, {
        content,
        scheduledFor,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Post Updated!",
        description: "Scheduled post has been updated successfully",
      });
      setEditingPost(null);
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update scheduled post",
        variant: "destructive",
      });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/scheduled-posts/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Post Deleted!",
        description: "Scheduled post has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete scheduled post",
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "Invalid date";
      }
      return format(date, "MMM d, h:mm a");
    } catch (error) {
      return "Invalid date";
    }
  };

  const handleEdit = (post: ScheduledPost) => {
    setEditingPost(post.id);
    setEditContent(post.content);
    
    try {
      const date = new Date(post.scheduledFor);
      if (!isNaN(date.getTime())) {
        setEditScheduledFor(date.toISOString().slice(0, 16));
      } else {
        setEditScheduledFor("");
      }
    } catch (error) {
      setEditScheduledFor("");
    }
  };

  const handleUploadPhoto = (post: ScheduledPost) => {
    setUploadingPostId(post.id);
    setSelectedPhoto(post.metadata?.imageUrl || null);
    setShowPhotoDialog(true);
  };

  const handlePhotoUploadComplete = async (imageUrl: string) => {
    if (!uploadingPostId) return;

    try {
      const response = await apiRequest('POST', '/api/scheduled-posts/update-image', {
        postId: uploadingPostId,
        imageUrl: imageUrl,
      });

      toast({
        title: "Photo Added!",
        description: "Photo has been attached to the scheduled post",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
      setShowPhotoDialog(false);
      setSelectedPhoto(null);
    } catch (error: any) {
      toast({
        title: "Failed to Attach Photo",
        description: error.message || "Failed to attach photo to post",
        variant: "destructive",
      });
    } finally {
      setUploadingPostId(null);
    }
  };

  const handleSelectMLSPhoto = async (mlsPhotoUrl: string) => {
    setSelectedPhoto(mlsPhotoUrl);
    await handlePhotoUploadComplete(mlsPhotoUrl);
  };

  const handleSave = (id: string) => {
    if (!editContent.trim()) {
      toast({
        title: "Content Required",
        description: "Post content cannot be empty",
        variant: "destructive",
      });
      return;
    }

    if (!editScheduledFor) {
      toast({
        title: "Schedule Required",
        description: "Please select a scheduled date and time",
        variant: "destructive",
      });
      return;
    }

    updatePostMutation.mutate({
      id,
      content: editContent,
      scheduledFor: editScheduledFor,
    });
  };

  const handleCancel = () => {
    setEditingPost(null);
    setEditContent("");
    setEditScheduledFor("");
    setEditMode("manual");
    setAiEditContent("");
    setShowPromptEditor(false);
  };

  const handlePreview = (post: ScheduledPost) => {
    setPreviewPost(post);
    setShowPreview(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-golden-accent mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading scheduled posts...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Scheduled Posts Manager
        </CardTitle>
      </CardHeader>
      <CardContent>
        {scheduledPosts.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Scheduled Posts</h3>
            <p className="text-muted-foreground">
              Create your first scheduled post using the Social Media Manager
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {scheduledPosts.map((post: ScheduledPost) => {
              const isEditing = editingPost === post.id;
              const postTypeInfo = postTypeLabels[post.postType as keyof typeof postTypeLabels];

              return (
                <div
                  key={post.id}
                  className="border rounded-lg p-4 bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {(() => {
                        const platform = platformIcons[post.platform as keyof typeof platformIcons];
                        return platform ? (
                          <>
                            <platform.icon className={`h-4 w-4 ${platform.color}`} />
                            <span className="font-medium text-sm text-foreground">{platform.name}</span>
                          </>
                        ) : (
                          <span className="font-medium text-sm text-foreground">{post.platform}</span>
                        );
                      })()}
                      
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{formatDate(post.scheduledFor)}</span>
                      
                      {postTypeInfo && (
                        <>
                          <span className="text-xs text-muted-foreground">•</span>
                          <Badge className={`text-xs ${postTypeInfo.color}`}>
                            {postTypeInfo.label}
                          </Badge>
                        </>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePreview(post)}
                        className="h-7 w-7 p-0"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      
                      {!isEditing && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(post)}
                            className="h-7 w-7 p-0"
                            data-testid={`button-edit-post-${post.id}`}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUploadPhoto(post)}
                            className="h-7 w-7 p-0"
                            data-testid={`button-upload-photo-${post.id}`}
                            title="Upload Photo"
                          >
                            <Upload className="h-3 w-3" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deletePostMutation.mutate(post.id)}
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                            data-testid={`button-delete-post-${post.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-4">
                      {/* Edit Mode Toggle */}
                      <div className="flex gap-2 p-1 bg-muted rounded-lg">
                        <Button
                          variant={editMode === "manual" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setEditMode("manual")}
                          className="flex-1 h-8"
                        >
                          <Edit2 className="h-3 w-3 mr-1" />
                          Manual Edit
                        </Button>
                        <Button
                          variant={editMode === "ai" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => {
                            setEditMode("ai");
                            if (!aiEditContent) {
                              setAiEditContent(editContent);
                            }
                          }}
                          className="flex-1 h-8"
                        >
                          <Sparkles className="h-3 w-3 mr-1" />
                          AI Assistant
                        </Button>
                      </div>

                      <div>
                        <Label htmlFor={`edit-content-${post.id}`} className="text-sm font-medium">
                          Content
                        </Label>
                        {editMode === "manual" ? (
                          <Textarea
                            id={`edit-content-${post.id}`}
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="mt-1"
                            rows={4}
                          />
                        ) : (
                          <div className="space-y-3 mt-1">
                            <Textarea
                              value={aiEditContent}
                              onChange={(e) => setAiEditContent(e.target.value)}
                              placeholder="Content will be enhanced with AI..."
                              rows={4}
                              className="resize-none"
                            />
                            
                            {showPromptEditor && (
                              <div className="space-y-2">
                                <Label className="text-xs font-medium">AI Enhancement Instructions</Label>
                                <Textarea
                                  value={aiPrompt}
                                  onChange={(e) => setAiPrompt(e.target.value)}
                                  placeholder="Tell AI how to optimize your content..."
                                  rows={2}
                                  className="resize-none text-xs"
                                />
                              </div>
                            )}
                            
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                className="flex-1"
                                onClick={async () => {
                                  if (!aiEditContent.trim()) return;
                                  setIsEnhancingInEdit(true);
                                  try {
                                    const response = await apiRequest('POST', '/api/content/enhance', {
                                      content: aiEditContent,
                                      prompt: aiPrompt,
                                      platform: post.platform,
                                      postType: post.postType
                                    });
                                    const data = await response.json();
                                    setAiEditContent(data.enhancedContent || aiEditContent);
                                    setEditContent(data.enhancedContent || aiEditContent);
                                    toast({
                                      title: "Content Enhanced",
                                      description: "AI has optimized your content for better engagement."
                                    });
                                  } catch (error) {
                                    toast({
                                      title: "Enhancement Failed", 
                                      description: "Unable to enhance content. Please try again.",
                                      variant: "destructive"
                                    });
                                  }
                                  setIsEnhancingInEdit(false);
                                }}
                                disabled={isEnhancingInEdit || !aiEditContent.trim()}
                              >
                                <Sparkles className="h-3 w-3 mr-1" />
                                {isEnhancingInEdit ? "Enhancing..." : "Enhance with AI"}
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setShowPromptEditor(!showPromptEditor)}
                                className="shrink-0"
                              >
                                Prompt
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <Label htmlFor={`edit-scheduled-${post.id}`} className="text-sm font-medium">
                          Schedule For
                        </Label>
                        <Input
                          id={`edit-scheduled-${post.id}`}
                          type="datetime-local"
                          value={editScheduledFor}
                          onChange={(e) => setEditScheduledFor(e.target.value)}
                          className="mt-1"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSave(post.id)}
                          disabled={updatePostMutation.isPending}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          {updatePostMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancel}
                          disabled={updatePostMutation.isPending}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-foreground">{post.content}</p>
                      
                      {post.metadata?.imageUrl && (
                        <div className="mt-2 mb-2">
                          <img 
                            src={post.metadata.imageUrl} 
                            alt="Post attachment" 
                            className="rounded-md max-h-32 max-w-full object-cover"
                            data-testid={`img-post-${post.id}`}
                          />
                        </div>
                      )}
                      
                      {post.hashtags && post.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {post.hashtags.map((hashtag, i) => (
                            <span key={i} className="text-xs text-blue-600">#{hashtag}</span>
                          ))}
                        </div>
                      )}
                      {post.neighborhood && (
                        <div className="text-xs text-muted-foreground flex items-center">
                          <MapPin className="mr-1 h-3 w-3" />
                          {post.neighborhood}
                        </div>
                      )}
                      {post.isEdited && (
                        <span className="text-xs text-orange-600 font-medium">✏️ Edited</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      
      {/* Enhanced Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Post Preview</DialogTitle>
          </DialogHeader>
          {previewPost && (
            <div className="relative">
              {/* AI Edit Mode */}
              {isEditingWithAI ? (
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-golden-accent" />
                      AI Content Editor
                    </h3>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setIsEditingWithAI(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    value={aiEditContent}
                    onChange={(e) => setAiEditContent(e.target.value)}
                    placeholder="Original content will be enhanced with AI..."
                    rows={6}
                    className="resize-none"
                  />
                  {showPromptEditor && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">AI Enhancement Instructions</Label>
                      <Textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="Tell AI how to optimize your content..."
                        rows={3}
                        className="resize-none text-xs"
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={async () => {
                        if (!aiEditContent.trim()) return;
                        setIsEnhancing(true);
                        try {
                          const response = await apiRequest('POST', '/api/content/enhance', {
                            content: aiEditContent,
                            prompt: aiPrompt,
                            platform: previewPost.platform,
                            postType: previewPost.postType
                          });
                          const data = await response.json();
                          setAiEditContent(data.enhancedContent || aiEditContent);
                          toast({
                            title: "Content Enhanced",
                            description: "AI has optimized your content for better engagement."
                          });
                        } catch (error) {
                          toast({
                            title: "Enhancement Failed", 
                            description: "Unable to enhance content. Please try again.",
                            variant: "destructive"
                          });
                        }
                        setIsEnhancing(false);
                      }}
                      disabled={isEnhancing || !aiEditContent.trim()}
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      {isEnhancing ? "Enhancing..." : "Enhance with AI"}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowPromptEditor(!showPromptEditor)}
                      className="shrink-0"
                    >
                      Prompt Editor
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={async () => {
                        if (!previewPost || !aiEditContent.trim()) return;
                        try {
                          await updatePostMutation.mutateAsync({
                            id: previewPost.id,
                            content: aiEditContent,
                            scheduledFor: previewPost.scheduledFor
                          });
                          setIsEditingWithAI(false);
                          setShowPreview(false);
                          toast({
                            title: "Post Updated",
                            description: "Your enhanced content has been saved."
                          });
                        } catch (error) {
                          toast({
                            title: "Update Failed",
                            description: "Unable to save changes. Please try again.",
                            variant: "destructive"
                          });
                        }
                      }}
                      disabled={updatePostMutation.isPending}
                    >
                      Save Changes
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        setIsEditingWithAI(false);
                        setAiEditContent("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  {/* Platform-specific preview */}
                  {previewPost.platform === 'instagram' && (
                    <div className="bg-white text-black">
                      {/* Instagram Header */}
                      <div className="flex items-center justify-between p-3 border-b">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-400 rounded-full p-[2px]">
                            <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                              <span className="text-xs font-bold text-golden-accent">MB</span>
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold text-sm">mikebjork_realtor</div>
                            <div className="text-xs text-gray-500">Omaha, Nebraska</div>
                          </div>
                        </div>
                        <MoreHorizontal className="h-4 w-4" />
                      </div>
                      
                      {/* Instagram Image */}
                      {previewPost.metadata?.imageUrl ? (
                        <div className="aspect-square bg-black">
                          <img 
                            src={previewPost.metadata.imageUrl} 
                            alt="Post attachment" 
                            className="w-full h-full object-cover"
                            data-testid="preview-img-instagram"
                          />
                        </div>
                      ) : (
                        <div className="aspect-square bg-gradient-to-br from-golden-accent/20 to-golden-muted/40 flex items-center justify-center">
                          <div className="text-center text-gray-600">
                            <Image className="h-12 w-12 mx-auto mb-2" />
                            <div className="text-sm">No Image Attached</div>
                          </div>
                        </div>
                      )}
                      
                      {/* Instagram Actions */}
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-4">
                            <Heart className="h-6 w-6" />
                            <MessageCircle className="h-6 w-6" />
                            <Send className="h-6 w-6" />
                          </div>
                          <Bookmark className="h-6 w-6" />
                        </div>
                        <div className="text-sm font-semibold mb-1">847 likes</div>
                        <div className="text-sm">
                          <span className="font-semibold">mikebjork_realtor</span>
                          <span className="ml-1">{previewPost.content}</span>
                        </div>
                        {previewPost.hashtags && previewPost.hashtags.length > 0 && (
                          <div className="text-sm text-blue-600 mt-1">
                            {previewPost.hashtags.map((hashtag, i) => (
                              <span key={i}>#{hashtag} </span>
                            ))}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 mt-2">View all 12 comments</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {format(new Date(previewPost.scheduledFor), "MMMM d")}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {previewPost.platform === 'facebook' && (
                    <div className="bg-white text-black">
                      {/* Facebook Header */}
                      <div className="flex items-center gap-3 p-3">
                        <div className="w-10 h-10 bg-golden-accent rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-golden-foreground">MB</span>
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-sm">{userName}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <span>{format(new Date(previewPost.scheduledFor), "MMM d 'at' h:mm a")}</span>
                            <span>·</span>
                            <span>🌎</span>
                          </div>
                        </div>
                        <MoreHorizontal className="h-5 w-5 text-gray-500" />
                      </div>
                      
                      {/* Facebook Content */}
                      <div className="px-3 pb-3">
                        <div className="text-sm mb-3 whitespace-pre-wrap">{previewPost.content}</div>
                        {previewPost.hashtags && previewPost.hashtags.length > 0 && (
                          <div className="text-sm text-blue-600 mb-3">
                            {previewPost.hashtags.map((hashtag, i) => (
                              <span key={i} className="mr-1">#{hashtag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Facebook Image */}
                      {previewPost.metadata?.imageUrl ? (
                        <div className="aspect-video bg-black">
                          <img 
                            src={previewPost.metadata.imageUrl} 
                            alt="Post attachment" 
                            className="w-full h-full object-contain"
                            data-testid="preview-img-facebook"
                          />
                        </div>
                      ) : (
                        <div className="aspect-video bg-gradient-to-br from-golden-accent/20 to-golden-muted/40 flex items-center justify-center">
                          <div className="text-center text-gray-600">
                            <Image className="h-12 w-12 mx-auto mb-2" />
                            <div className="text-sm">No Image Attached</div>
                          </div>
                        </div>
                      )}
                      
                      {/* Facebook Actions */}
                      <div className="p-3 border-t">
                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <div className="flex -space-x-1">
                              <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-xs text-white">👍</div>
                              <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-xs text-white">❤️</div>
                            </div>
                            <span className="ml-2">60</span>
                          </div>
                          <div>14 comments</div>
                        </div>
                        <div className="flex items-center justify-around mt-3 pt-2 border-t">
                          <Button variant="ghost" size="sm" className="flex-1 text-gray-600">
                            👍 Like
                          </Button>
                          <Button variant="ghost" size="sm" className="flex-1 text-gray-600">
                            💬 Comment
                          </Button>
                          <Button variant="ghost" size="sm" className="flex-1 text-gray-600">
                            📤 Share
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {(previewPost.platform === 'linkedin' || previewPost.platform === 'x') && (
                    <div className="bg-white text-black p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-golden-accent rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-golden-foreground">MB</span>
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{userName}</div>
                          <div className="text-xs text-gray-500">Real Estate Professional at BHHS</div>
                          <div className="text-xs text-gray-400">
                            {format(new Date(previewPost.scheduledFor), "MMM d, h:mm a")}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm mb-3 whitespace-pre-wrap">{previewPost.content}</div>
                      {previewPost.hashtags && previewPost.hashtags.length > 0 && (
                        <div className="text-sm text-blue-600 mb-3">
                          {previewPost.hashtags.map((hashtag, i) => (
                            <span key={i} className="mr-1">#{hashtag}</span>
                          ))}
                        </div>
                      )}
                      {previewPost.metadata?.imageUrl && (
                        <div className="mb-3">
                          <img 
                            src={previewPost.metadata.imageUrl} 
                            alt="Post attachment" 
                            className="rounded-md max-w-full max-h-64 object-cover"
                            data-testid="preview-img-linkedin-x"
                          />
                        </div>
                      )}
                      <div className="border rounded bg-gray-50 p-4">
                        <div className="text-center text-gray-600">
                          <Home className="h-8 w-8 mx-auto mb-2" />
                          <div className="text-sm font-medium">Property Listing</div>
                          <div className="text-xs">Click to view details</div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Edit with AI Button */}
                  <div className="absolute top-2 right-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setAiEditContent(previewPost.content);
                        setIsEditingWithAI(true);
                      }}
                      className="bg-white/90 hover:bg-white shadow-sm"
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      Edit with AI
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Photo Upload Dialog */}
      <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Photo to Post</DialogTitle>
            <DialogDescription>
              Upload a photo or select from MLS listings
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={photoUploadMode} onValueChange={(value) => setPhotoUploadMode(value as "upload" | "mls")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Upload Photo</TabsTrigger>
              <TabsTrigger value="mls">MLS Listings</TabsTrigger>
            </TabsList>
            
            <TabsContent value="upload" className="space-y-4 mt-4">
              {selectedPhoto ? (
                <div className="space-y-4">
                  <div className="border rounded-lg overflow-hidden">
                    <img 
                      src={selectedPhoto} 
                      alt="Selected photo" 
                      className="w-full h-64 object-cover"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-green-600 font-medium">Photo selected successfully!</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedPhoto(null)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={10485760}
                  onGetUploadParameters={async () => {
                    const response = await apiRequest("POST", "/api/objects/upload", {});
                    const data = await response.json();
                    return {
                      method: "PUT" as const,
                      url: data.uploadURL,
                    };
                  }}
                  onComplete={(uploadedFileUrl: string) => {
                    // Convert to local endpoint
                    const fileName = uploadedFileUrl.split('/').pop();
                    const localImageUrl = `/objects/${fileName}`;
                    setSelectedPhoto(localImageUrl);
                    toast({
                      title: "Photo Uploaded",
                      description: "Photo is ready to be attached to your post",
                    });
                  }}
                  buttonClassName="w-full"
                >
                  <div className="flex items-center justify-center gap-2 py-8 border-2 border-dashed rounded-lg hover:border-primary transition-colors cursor-pointer">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="text-muted-foreground">Click to upload a photo</span>
                  </div>
                </ObjectUploader>
              )}
              
              {selectedPhoto && (
                <Button 
                  className="w-full"
                  onClick={() => handlePhotoUploadComplete(selectedPhoto)}
                >
                  Attach Photo to Post
                </Button>
              )}
            </TabsContent>
            
            <TabsContent value="mls" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                {/* Sample MLS Properties - In production, these would come from MLS API */}
                {[
                  { id: "1", address: "123 Oak St, Dundee", price: "$425,000", image: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=400&h=300&fit=crop" },
                  { id: "2", address: "456 Maple Ave, Aksarben", price: "$385,000", image: "https://images.unsplash.com/photo-1554995207-c18c203602cb?w=400&h=300&fit=crop" },
                  { id: "3", address: "789 Pine Rd, Old Market", price: "$350,000", image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400&h=300&fit=crop" },
                  { id: "4", address: "321 Elm St, Benson", price: "$295,000", image: "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=400&h=300&fit=crop" },
                  { id: "5", address: "654 Cedar Ln, Blackstone", price: "$450,000", image: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=400&h=300&fit=crop" },
                  { id: "6", address: "987 Birch Way, West Omaha", price: "$525,000", image: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&h=300&fit=crop" },
                ].map((property) => (
                  <div 
                    key={property.id}
                    className="border rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => handleSelectMLSPhoto(property.image)}
                  >
                    <img 
                      src={property.image} 
                      alt={property.address}
                      className="w-full h-32 object-cover"
                    />
                    <div className="p-3">
                      <p className="font-medium text-sm">{property.address}</p>
                      <p className="text-sm text-muted-foreground">{property.price}</p>
                      <Button 
                        size="sm" 
                        className="w-full mt-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectMLSPhoto(property.image);
                        }}
                      >
                        Use This Photo
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Select a property photo from your MLS listings to attach to this post
              </p>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </Card>
  );
}