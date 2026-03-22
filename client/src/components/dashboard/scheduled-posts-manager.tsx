import { useState, useEffect, useRef } from "react";
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
import { useBusinessType } from "@/lib/businessContext";
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
  Image,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Wand2,
  ChevronDown,
  Square,
  CheckSquare,
  Trash,
  Video
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isSameMonth } from "date-fns";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ObjectUploader } from "@/components/ObjectUploader";
import { ComplianceChecker } from "@/components/shared/compliance-checker";
import { ImagePicker } from "@/components/shared/image-picker";
import { CharacterCounter, PlatformTip } from "@/components/ui/character-counter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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
  facebook: { icon: Facebook, color: "text-blue-600", bgColor: "bg-blue-600", name: "Facebook" },
  instagram: { icon: Instagram, color: "text-pink-600", bgColor: "bg-pink-600", name: "Instagram" },
  linkedin: { icon: Linkedin, color: "text-blue-700", bgColor: "bg-blue-700", name: "LinkedIn" },
  x: { icon: XIcon, color: "text-blue-400", bgColor: "bg-blue-400", name: "X" },
};

const postTypeLabels = {
  local_market: { label: "Local Market", icon: MapPin, color: "bg-green-100 text-green-700" },
  moving_guide: { label: "Moving Guide", icon: Home, color: "bg-blue-100 text-blue-700" },
  open_houses: { label: "Open House", icon: Home, color: "bg-purple-100 text-purple-700" },
  just_listed: { label: "Just Listed", icon: Home, color: "bg-orange-100 text-orange-700" },
  just_sold: { label: "Just Sold", icon: Check, color: "bg-green-100 text-green-700" },
  price_improvement: { label: "Price Drop", icon: Clock, color: "bg-red-100 text-red-700" },
};

// Platform-specific optimal word counts
const platformWordCounts: Record<string, { min: number; max: number; optimal: number }> = {
  instagram: { min: 100, max: 150, optimal: 125 },
  facebook: { min: 100, max: 250, optimal: 150 },
  linkedin: { min: 150, max: 300, optimal: 200 },
  x: { min: 30, max: 70, optimal: 50 },
};

// AI Enhancement Presets
const aiPresets = [
  { 
    id: "engagement", 
    name: "Engagement Boost",
    description: "Optimize for likes, comments & shares",
    prompt: "Rewrite this post to maximize engagement with action-oriented language, compelling hooks, and a clear call-to-action. Use emojis strategically and ask a question to encourage comments."
  },
  { 
    id: "seo", 
    name: "SEO Focus",
    description: "Add keywords & hashtags for discoverability",
    prompt: "Optimize this post for search and discoverability. Add relevant real estate keywords naturally, include location-specific terms for Omaha/Nebraska, and suggest 3-5 relevant hashtags at the end."
  },
  { 
    id: "compliance", 
    name: "Compliance-Safe",
    description: "Ensure brokerage-compliant language",
    prompt: "Review and rewrite this post to ensure it's compliant with real estate advertising regulations. Avoid making guarantees or promises about property values, use appropriate disclosures, and maintain professional language."
  },
  { 
    id: "shorten", 
    name: "Make Concise",
    description: "Trim to optimal length for the platform",
    prompt: "Shorten this post while keeping the key message. Remove filler words, be direct, and ensure the most important information is front-loaded."
  },
  { 
    id: "expand", 
    name: "Add Detail",
    description: "Expand with more compelling content",
    prompt: "Expand this post with more detail and context. Add storytelling elements, paint a picture for the reader, and include more specific benefits or features."
  },
  { 
    id: "custom", 
    name: "Custom Prompt",
    description: "Write your own instructions",
    prompt: ""
  },
];

export function ScheduledPostsManager() {
  const { user, isLoading: authLoading } = useAuth();
  const { businessType, terms } = useBusinessType();
  const isRealEstate = terms.features.complianceCheck;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dayModalDate, setDayModalDate] = useState<Date | null>(null);
  const [dayModalPosts, setDayModalPosts] = useState<any[]>([]);
  const MAX_VISIBLE_POSTS = 3;
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editScheduledFor, setEditScheduledFor] = useState("");
  const [previewPost, setPreviewPost] = useState<ScheduledPost | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // Get user's display name with proper formatting
  const rawName = user?.name || user?.email?.split('@')[0];
  const userName = rawName 
    ? rawName.charAt(0).toUpperCase() + rawName.slice(1) // Capitalize first letter
    : terms.role;
  const [isEditingWithAI, setIsEditingWithAI] = useState(false);
  const [aiEditContent, setAiEditContent] = useState("");
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("engagement");
  const [aiPrompt, setAiPrompt] = useState(aiPresets[0].prompt);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [editMode, setEditMode] = useState<"manual" | "ai">("manual");
  const [isEnhancingInEdit, setIsEnhancingInEdit] = useState(false);
  const [uploadingPostId, setUploadingPostId] = useState<string | null>(null);
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleteType, setBulkDeleteType] = useState<"selected" | "all">("selected");
  const [photoUploadMode, setPhotoUploadMode] = useState<"upload" | "mls">("upload");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [editVideoUrl, setEditVideoUrl] = useState("");
  const [editVideoUploading, setEditVideoUploading] = useState(false);
  const editVideoFileRef = useRef<HTMLInputElement>(null);

  // Recalculate aiPrompt when selected post changes to ensure platform-specific word count is current
  useEffect(() => {
    if (selectedPost && editMode === "ai" && selectedPreset !== "custom") {
      const preset = aiPresets.find(p => p.id === selectedPreset);
      if (preset) {
        const platform = selectedPost.platform;
        const wordCount = platformWordCounts[platform];
        const wordCountInstruction = wordCount 
          ? ` Target approximately ${wordCount.optimal} words (${wordCount.min}-${wordCount.max} range is optimal for ${platform}).`
          : "";
        setAiPrompt(preset.prompt + wordCountInstruction);
      }
    }
  }, [selectedPost?.id, selectedPost?.platform]);

  // Reset AI mode state when switching posts
  useEffect(() => {
    if (selectedPost) {
      setEditMode("manual");
      setShowPromptEditor(false);
      setSelectedPreset("engagement");
    }
  }, [selectedPost?.id]);

  const { data: scheduledPosts = [], isLoading } = useQuery<ScheduledPost[]>({
    queryKey: ["/api/scheduled-posts"],
  });

  const generateContentPlanMutation = useMutation({
    mutationFn: async (weeks: number) => {
      const response = await apiRequest('POST', '/api/content/generate-plan', { weeks, businessType });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Content Plan Generated!",
        description: `Created ${data.posts?.length || 0} posts for the next ${data.weeks} week(s).`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Could not generate content plan. Please try again.",
        variant: "destructive",
      });
    },
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updatePostMutation = useMutation({
    mutationFn: async ({ id, content, scheduledFor, metadata }: { id: string; content: string; scheduledFor: string; metadata?: Record<string, any> }) => {
      const response = await apiRequest("PUT", `/api/scheduled-posts/${id}`, {
        content,
        scheduledFor,
        ...(metadata ? { metadata } : {}),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Post Updated!",
        description: "Your scheduled post has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
      setShowEditDialog(false);
      setSelectedPost(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update post. Please try again.",
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
        title: "Post Deleted",
        description: "Your scheduled post has been deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
      setShowEditDialog(false);
      setSelectedPost(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete post. Please try again.",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async ({ ids, deleteAll }: { ids?: string[]; deleteAll?: boolean }) => {
      const response = await apiRequest("POST", "/api/scheduled-posts/bulk-delete", { ids, deleteAll });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Posts Deleted",
        description: `Successfully deleted ${data.deleted} scheduled post${data.deleted !== 1 ? 's' : ''}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
      setSelectedPostIds(new Set());
      setShowBulkDeleteConfirm(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete posts. Please try again.",
        variant: "destructive",
      });
    },
  });

  const attachPhotoMutation = useMutation({
    mutationFn: async ({ id, imageUrl }: { id: string; imageUrl: string }) => {
      const response = await apiRequest("PUT", `/api/scheduled-posts/${id}`, {
        metadata: { imageUrl }
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Photo Attached!",
        description: "Photo has been attached to your post.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
      setShowPhotoDialog(false);
      setSelectedPhoto(null);
      setUploadingPostId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to attach photo. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePhotoUploadComplete = (imageUrl: string) => {
    if (uploadingPostId) {
      attachPhotoMutation.mutate({ id: uploadingPostId, imageUrl });
    }
  };

  const handleSelectMLSPhoto = (imageUrl: string) => {
    setSelectedPhoto(imageUrl);
  };

  const handleUploadPhoto = (post: ScheduledPost) => {
    setUploadingPostId(post.id);
    setSelectedPhoto(null);
    setShowPhotoDialog(true);
  };

  const handleEditPost = (post: ScheduledPost) => {
    setSelectedPost(post);
    setEditContent(post.content);
    setEditScheduledFor(format(new Date(post.scheduledFor), "yyyy-MM-dd'T'HH:mm"));
    setEditMode("manual");
    setAiEditContent(post.content);
    setEditVideoUrl(post.metadata?.videoUrl || post.metadata?.imageUrl || "");
    setShowEditDialog(true);
  };

  const handleSave = () => {
    if (!selectedPost) return;
    if (selectedPost.platform === 'tiktok' && !editVideoUrl) {
      toast({ title: "Video Required", description: "TikTok posts require a video. Please upload or paste a video URL.", variant: "destructive" });
      return;
    }
    const metadata: Record<string, any> = { ...(selectedPost.metadata || {}) };
    if (selectedPost.platform === 'tiktok') {
      metadata.videoUrl = editVideoUrl;
      metadata.imageUrl = editVideoUrl;
    }
    updatePostMutation.mutate({
      id: selectedPost.id,
      content: editContent,
      scheduledFor: new Date(editScheduledFor).toISOString(),
      metadata,
    });
  };

  const handlePreview = (post: ScheduledPost) => {
    setPreviewPost(post);
    setShowPreview(true);
  };

  // Calendar functions
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getPostsForDay = (day: Date) => {
    return scheduledPosts.filter(post => 
      isSameDay(new Date(post.scheduledFor), day)
    );
  };

  const previousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  // Selection helper functions
  const togglePostSelection = (postId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setSelectedPostIds(prev => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  const selectAllPosts = () => {
    setSelectedPostIds(new Set(scheduledPosts.map(p => p.id)));
  };

  const deselectAllPosts = () => {
    setSelectedPostIds(new Set());
  };

  const handleBulkDelete = (type: "selected" | "all") => {
    setBulkDeleteType(type);
    setShowBulkDeleteConfirm(true);
  };

  const confirmBulkDelete = () => {
    if (bulkDeleteType === "all") {
      bulkDeleteMutation.mutate({ deleteAll: true });
    } else {
      bulkDeleteMutation.mutate({ ids: Array.from(selectedPostIds) });
    }
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
    <>
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Scheduled Posts Calendar
          </CardTitle>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  disabled={generateContentPlanMutation.isPending}
                  data-testid="button-ai-generate"
                >
                  {generateContentPlanMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4 mr-2" />
                  )}
                  AI Generate
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => generateContentPlanMutation.mutate(1)}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  1 Week Plan
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => generateContentPlanMutation.mutate(2)}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  2 Week Plan
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => generateContentPlanMutation.mutate(4)}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  4 Week Plan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              onClick={previousMonth}
              data-testid="button-previous-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              data-testid="button-today"
            >
              Today
            </Button>
            <span className="font-semibold text-sm min-w-[140px] text-center">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={nextMonth}
              data-testid="button-next-month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Bulk Actions Row */}
        {scheduledPosts.length > 0 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectedPostIds.size === scheduledPosts.length ? deselectAllPosts : selectAllPosts}
                data-testid="button-select-all"
              >
                {selectedPostIds.size === scheduledPosts.length ? (
                  <>
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Deselect All
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Select All ({scheduledPosts.length})
                  </>
                )}
              </Button>
              {selectedPostIds.size > 0 && (
                <span className="text-sm text-muted-foreground">
                  {selectedPostIds.size} selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedPostIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleBulkDelete("selected")}
                  disabled={bulkDeleteMutation.isPending}
                  data-testid="button-delete-selected"
                >
                  {bulkDeleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash className="h-4 w-4 mr-2" />
                  )}
                  Delete Selected ({selectedPostIds.size})
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkDelete("all")}
                disabled={bulkDeleteMutation.isPending}
                className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                data-testid="button-delete-all"
              >
                <Trash className="h-4 w-4 mr-2" />
                Delete All
              </Button>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {/* Calendar Grid */}
        <div className="border rounded-lg overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-7 bg-muted">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center text-sm font-semibold border-r last:border-r-0">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Days */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => {
              const postsForDay = getPostsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, new Date());
              
              return (
                <div
                  key={index}
                  className={`min-h-[120px] p-2 border-r border-b last:border-r-0 ${
                    !isCurrentMonth ? 'bg-muted/30' : 'bg-background'
                  } ${isToday ? 'bg-golden-accent/10' : ''}`}
                  data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                >
                  <div className={`text-sm font-medium mb-2 ${
                    !isCurrentMonth ? 'text-muted-foreground' : isToday ? 'text-golden-accent font-bold' : 'text-foreground'
                  }`}>
                    {format(day, 'd')}
                  </div>
                  
                  {/* Platform Icons for Posts */}
                  <div className="space-y-1">
                    {postsForDay.slice(0, MAX_VISIBLE_POSTS).map((post) => {
                      const platform = platformIcons[post.platform as keyof typeof platformIcons];
                      const Icon = platform?.icon || Home;
                      const isSelected = selectedPostIds.has(post.id);
                      
                      return (
                        <div
                          key={post.id}
                          className={`w-full flex items-center gap-1 p-1 rounded hover:bg-muted/50 transition-colors group ${isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : ''}`}
                          data-testid={`post-${post.id}`}
                          title={`${platform?.name || post.platform} - ${format(new Date(post.scheduledFor), 'h:mm a')}`}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => togglePostSelection(post.id)}
                            className="shrink-0 h-3 w-3"
                            data-testid={`checkbox-post-${post.id}`}
                          />
                          <button
                            onClick={() => handleEditPost(post)}
                            className="flex-1 flex items-center gap-1.5 text-left min-w-0"
                          >
                            <div className={`shrink-0 w-5 h-5 rounded flex items-center justify-center ${platform?.bgColor || 'bg-gray-500'}`}>
                              <Icon className="h-3 w-3 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] font-medium truncate leading-tight">
                                {format(new Date(post.scheduledFor), 'h:mm a')}
                              </div>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                    {postsForDay.length > MAX_VISIBLE_POSTS && (
                      <button
                        type="button"
                        onClick={() => {
                          setDayModalDate(day);
                          setDayModalPosts(postsForDay);
                        }}
                        className="w-full text-[10px] font-semibold text-primary hover:text-primary/80 hover:bg-primary/5 rounded py-0.5 transition-colors"
                        data-testid={`button-more-posts-${format(day, 'yyyy-MM-dd')}`}
                      >
                        +{postsForDay.length - MAX_VISIBLE_POSTS} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {scheduledPosts.length === 0 && (
          <div className="text-center py-8 mt-4">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Scheduled Posts</h3>
            <p className="text-muted-foreground">
              Create your first scheduled post using Quick Posts
            </p>
          </div>
        )}
      </CardContent>
      
      {/* Day Detail Modal */}
      <Dialog open={!!dayModalDate} onOpenChange={(open) => { if (!open) { setDayModalDate(null); setDayModalPosts([]); } }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {dayModalDate ? format(dayModalDate, 'EEEE, MMMM d, yyyy') : ''}
            </DialogTitle>
            <DialogDescription>
              {dayModalPosts.length} scheduled post{dayModalPosts.length !== 1 ? 's' : ''} for this day
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {dayModalPosts.map((post) => {
              const platform = platformIcons[post.platform as keyof typeof platformIcons];
              const Icon = platform?.icon || Home;
              const isSelected = selectedPostIds.has(post.id);
              return (
                <div
                  key={post.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all hover:bg-muted/40 ${isSelected ? 'bg-primary/5 border-primary/30' : 'border-border/50'}`}
                  data-testid={`modal-post-${post.id}`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => togglePostSelection(post.id)}
                    className="shrink-0 mt-1"
                  />
                  <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${platform?.bgColor || 'bg-gray-500'}`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold capitalize">{platform?.name || post.platform}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(post.scheduledFor), 'h:mm a')}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-3 leading-relaxed">{post.content}</p>
                  </div>
                  <button
                    onClick={() => { setDayModalDate(null); setDayModalPosts([]); handleEditPost(post); }}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors"
                    data-testid={`button-edit-modal-post-${post.id}`}
                  >
                    <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Post Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Scheduled Post</DialogTitle>
            <DialogDescription>
              Modify your post content and schedule
            </DialogDescription>
          </DialogHeader>
          
          {selectedPost && (
            <div className="space-y-4">
              {/* Platform Badge */}
              <div className="flex items-center gap-2">
                {(() => {
                  const platform = platformIcons[selectedPost.platform as keyof typeof platformIcons];
                  const Icon = platform?.icon || Home;
                  return (
                    <>
                      <div className={`w-8 h-8 rounded flex items-center justify-center ${platform?.bgColor || 'bg-gray-500'}`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <span className="font-semibold">{platform?.name || selectedPost.platform}</span>
                    </>
                  );
                })()}
              </div>

              {/* Edit Mode Toggle */}
              <div className="flex gap-2 p-1 bg-muted rounded-lg">
                <Button
                  variant={editMode === "manual" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setEditMode("manual")}
                  className="flex-1 h-8"
                  data-testid="button-manual-edit"
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
                    // Initialize the prompt with word count instructions for the current platform
                    const preset = aiPresets.find(p => p.id === selectedPreset);
                    if (preset && selectedPreset !== "custom" && selectedPost) {
                      const platform = selectedPost.platform;
                      const wordCount = platformWordCounts[platform];
                      const wordCountInstruction = wordCount 
                        ? ` Target approximately ${wordCount.optimal} words (${wordCount.min}-${wordCount.max} range is optimal for ${platform}).`
                        : "";
                      setAiPrompt(preset.prompt + wordCountInstruction);
                    }
                  }}
                  className="flex-1 h-8"
                  data-testid="button-ai-edit"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI Assistant
                </Button>
              </div>

              {/* Platform Tip */}
              {selectedPost?.platform && (
                <PlatformTip platform={selectedPost.platform} />
              )}

              {/* Content Editor */}
              <div>
                <Label htmlFor="edit-content" className="text-sm font-medium">
                  Content
                </Label>
                {editMode === "manual" ? (
                  <>
                    <Textarea
                      id="edit-content"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="mt-1"
                      rows={6}
                      data-testid="textarea-content"
                    />
                    {selectedPost?.platform && (
                      <CharacterCounter
                        platform={selectedPost.platform}
                        text={editContent}
                        className="mt-2"
                      />
                    )}
                  </>
                ) : (
                  <div className="space-y-3 mt-1">
                    <Textarea
                      value={aiEditContent}
                      onChange={(e) => setAiEditContent(e.target.value)}
                      placeholder="Content will be enhanced with AI..."
                      rows={6}
                      className="resize-none"
                      data-testid="textarea-ai-content"
                    />
                    {selectedPost?.platform && (
                      <CharacterCounter
                        platform={selectedPost.platform}
                        text={aiEditContent}
                        className="mt-2"
                      />
                    )}
                    
                    {/* AI Preset Selector */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Enhancement Style</Label>
                      <Select 
                        value={selectedPreset} 
                        onValueChange={(value) => {
                          setSelectedPreset(value);
                          const preset = aiPresets.find(p => p.id === value);
                          if (preset && preset.id !== "custom") {
                            // Build prompt with word count target
                            const platform = selectedPost?.platform || "facebook";
                            const wordCount = platformWordCounts[platform];
                            const wordCountInstruction = wordCount 
                              ? ` Target approximately ${wordCount.optimal} words (${wordCount.min}-${wordCount.max} range is optimal for ${platform}).`
                              : "";
                            setAiPrompt(preset.prompt + wordCountInstruction);
                            setShowPromptEditor(false);
                          }
                          if (value === "custom") {
                            // Clear prompt for custom input
                            setAiPrompt("");
                            setShowPromptEditor(true);
                          }
                        }}
                      >
                        <SelectTrigger className="h-9" data-testid="select-ai-preset">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {aiPresets.map((preset) => (
                            <SelectItem key={preset.id} value={preset.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{preset.name}</span>
                                <span className="text-xs text-muted-foreground">{preset.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {/* Word count indicator */}
                      {selectedPost?.platform && platformWordCounts[selectedPost.platform] && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">Target:</span>
                          <span className={`font-medium ${
                            (() => {
                              const wordCount = aiEditContent.trim().split(/\s+/).filter(w => w).length;
                              const target = platformWordCounts[selectedPost.platform];
                              if (wordCount >= target.min && wordCount <= target.max) return "text-green-600";
                              if (wordCount < target.min) return "text-amber-600";
                              return "text-red-600";
                            })()
                          }`}>
                            {aiEditContent.trim().split(/\s+/).filter(w => w).length} / {platformWordCounts[selectedPost.platform].optimal} words
                          </span>
                          {(() => {
                            const wordCount = aiEditContent.trim().split(/\s+/).filter(w => w).length;
                            const target = platformWordCounts[selectedPost.platform];
                            if (wordCount < target.min) return <span className="text-amber-600">(too short)</span>;
                            if (wordCount > target.max) return <span className="text-red-600">(too long)</span>;
                            return <span className="text-green-600">(optimal)</span>;
                          })()}
                        </div>
                      )}
                    </div>

                    {(showPromptEditor || selectedPreset === "custom") && (
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Custom Instructions</Label>
                        <Textarea
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          placeholder="Tell AI how to optimize your content..."
                          rows={2}
                          className="resize-none text-xs"
                          data-testid="textarea-ai-prompt"
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
                              platform: selectedPost.platform,
                              postType: selectedPost.postType
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
                        data-testid="button-enhance-ai"
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        {isEnhancingInEdit ? "Enhancing..." : "Enhance with AI"}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowPromptEditor(!showPromptEditor)}
                        className="shrink-0"
                        data-testid="button-toggle-prompt"
                      >
                        {showPromptEditor ? "Hide" : "Edit"} Prompt
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* BHHS Compliance Check */}
              {isRealEstate && (editContent.trim().length > 10 || aiEditContent.trim().length > 10) && (
                <ComplianceChecker
                  content={editMode === "manual" ? editContent : aiEditContent}
                  platform={selectedPost?.platform || "general"}
                  hasMedia={!!selectedPost?.metadata?.imageUrl}
                  hasVideo={false}
                  onContentFix={(fixedContent) => {
                    if (editMode === "manual") {
                      setEditContent(fixedContent);
                    } else {
                      setAiEditContent(fixedContent);
                    }
                  }}
                  showGuidelines={false}
                />
              )}

              {selectedPost?.platform === 'tiktok' && (
                <div className="space-y-3 p-3 border border-red-200 dark:border-red-800 rounded-lg bg-red-50/50 dark:bg-red-950/20">
                  <div className="flex items-center gap-2">
                    <Video className="h-5 w-5 text-red-500" />
                    <span className="text-sm font-semibold">TikTok Video (Required)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">TikTok only supports video posts. Upload a video or paste a video URL.</p>
                  <input
                    type="file"
                    ref={editVideoFileRef}
                    accept="video/*"
                    className="hidden"
                    data-testid="input-edit-tiktok-video-file"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setEditVideoUploading(true);
                      try {
                        const formData = new FormData();
                        formData.append("media", file);
                        const res = await fetch("/api/scheduled-posts/upload-media", {
                          method: "POST",
                          credentials: "include",
                          body: formData,
                        });
                        const data = await res.json();
                        if (res.ok && data.url) {
                          setEditVideoUrl(data.url);
                          toast({ title: "Video Uploaded", description: "Video ready for TikTok posting." });
                        } else {
                          toast({ title: "Upload Failed", description: data.error || "Could not upload video", variant: "destructive" });
                        }
                      } catch {
                        toast({ title: "Upload Failed", description: "Could not upload video", variant: "destructive" });
                      } finally {
                        setEditVideoUploading(false);
                        if (editVideoFileRef.current) editVideoFileRef.current.value = "";
                      }
                    }}
                  />
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => editVideoFileRef.current?.click()}
                      disabled={editVideoUploading}
                      data-testid="btn-edit-upload-tiktok-video"
                      className="border-red-300 hover:bg-red-50 dark:hover:bg-red-950"
                    >
                      {editVideoUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                      {editVideoUploading ? "Uploading..." : "Upload Video"}
                    </Button>
                    <span className="text-xs text-muted-foreground">or</span>
                  </div>
                  <Input
                    placeholder="Paste video URL here..."
                    value={editVideoUrl}
                    onChange={(e) => setEditVideoUrl(e.target.value)}
                    className="text-sm"
                    data-testid="input-edit-tiktok-video-url"
                  />
                  {editVideoUrl && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded-md border border-green-200 dark:border-green-800">
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-xs text-green-700 dark:text-green-300 truncate flex-1">Video ready: {editVideoUrl.length > 50 ? editVideoUrl.slice(0, 50) + "..." : editVideoUrl}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                        onClick={() => setEditVideoUrl("")}
                        data-testid="btn-edit-remove-tiktok-video"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                  {!editVideoUrl && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">A video is required for TikTok posts to publish successfully.</p>
                  )}
                </div>
              )}

              {/* Schedule Date/Time */}
              <div>
                <Label htmlFor="edit-scheduled" className="text-sm font-medium">
                  Schedule For
                </Label>
                <Input
                  id="edit-scheduled"
                  type="datetime-local"
                  value={editScheduledFor}
                  onChange={(e) => setEditScheduledFor(e.target.value)}
                  className="mt-1"
                  data-testid="input-scheduled-time"
                />
              </div>

              {/* Post Metadata */}
              {selectedPost.metadata?.imageUrl && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Attached Image</Label>
                  <img 
                    src={selectedPost.metadata.imageUrl} 
                    alt="Post attachment" 
                    className="rounded-md max-h-48 max-w-full object-cover"
                    data-testid="img-attached"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={() => handlePreview(selectedPost)}
                  variant="outline"
                  className="flex-1"
                  data-testid="button-preview"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <Button
                  onClick={() => {
                    if (selectedPost?.platform === 'tiktok') {
                      editVideoFileRef.current?.click();
                    } else {
                      handleUploadPhoto(selectedPost);
                    }
                  }}
                  variant="outline"
                  className="flex-1"
                  data-testid="button-upload-photo"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {selectedPost?.platform === 'tiktok' ? 'Upload Video' : 'Upload Photo'}
                </Button>
                <Button
                  onClick={() => {
                    setPostToDelete(selectedPost.id);
                    setShowDeleteConfirm(true);
                  }}
                  variant="outline"
                  className="flex-1 text-red-600 hover:text-red-700"
                  data-testid="button-delete"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  disabled={updatePostMutation.isPending}
                  className="flex-1"
                  data-testid="button-save"
                >
                  {updatePostMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  {updatePostMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowEditDialog(false)}
                  disabled={updatePostMutation.isPending}
                  data-testid="button-cancel"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
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
                          if (selectedPost) {
                            setEditContent(data.enhancedContent || aiEditContent);
                          }
                          toast({
                            title: "Content Enhanced",
                            description: "AI has optimized your content."
                          });
                        } catch (error) {
                          toast({
                            title: "Enhancement Failed",
                            description: "Unable to enhance content.",
                            variant: "destructive"
                          });
                        }
                        setIsEnhancing(false);
                      }}
                      disabled={isEnhancing || !aiEditContent.trim()}
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      {isEnhancing ? "Enhancing..." : "Enhance"}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowPromptEditor(!showPromptEditor)}
                    >
                      Prompt
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
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-golden-accent to-golden-muted rounded-full flex items-center justify-center">
                            <span className="text-xs font-bold text-golden-foreground">MB</span>
                          </div>
                          <span className="font-semibold text-sm">{userName}</span>
                        </div>
                        <MoreHorizontal className="h-5 w-5" />
                      </div>
                      
                      {/* Instagram Image */}
                      {previewPost.metadata?.imageUrl ? (
                        <img 
                          src={previewPost.metadata.imageUrl} 
                          alt="Post" 
                          className="w-full aspect-square object-cover"
                          data-testid="preview-img-instagram"
                        />
                      ) : (
                        <div className="w-full aspect-square bg-gradient-to-br from-golden-accent/20 to-golden-muted/40 flex items-center justify-center">
                          <div className="text-center text-gray-600">
                            <Image className="h-16 w-16 mx-auto mb-2" />
                            <div className="text-sm">No Image</div>
                          </div>
                        </div>
                      )}
                      
                      {/* Instagram Actions */}
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-4">
                            <Heart className="h-6 w-6" />
                            <MessageCircle className="h-6 w-6" />
                            <Send className="h-6 w-6" />
                          </div>
                          <Bookmark className="h-6 w-6" />
                        </div>
                        <div className="text-sm font-semibold mb-2">245 likes</div>
                        <div className="text-sm">
                          <span className="font-semibold mr-2">{userName}</span>
                          {previewPost.content}
                        </div>
                        {previewPost.hashtags && previewPost.hashtags.length > 0 && (
                          <div className="text-sm text-blue-600 mt-1">
                            {previewPost.hashtags.map((hashtag, i) => (
                              <span key={i} className="mr-1">#{hashtag}</span>
                            ))}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 mt-2">
                          {format(new Date(previewPost.scheduledFor), "MMMM d 'at' h:mm a")}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {previewPost.platform === 'facebook' && (
                    <div className="bg-white text-black">
                      {/* Facebook Header */}
                      <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 bg-golden-accent rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold text-golden-foreground">MB</span>
                          </div>
                          <div>
                            <div className="font-semibold text-sm">{userName}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <span>{format(new Date(previewPost.scheduledFor), "MMM d 'at' h:mm a")}</span>
                              <span>·</span>
                              <span>🌎</span>
                            </div>
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
                          <div className="text-xs text-gray-500">{terms.role}</div>
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
                          <div className="text-sm font-medium">{terms.featureLabel}</div>
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
      
      {/* Photo Upload Dialog - Enhanced with AI Image Generation */}
      <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Image to Post</DialogTitle>
            <DialogDescription>
              Generate with AI, search stock images, upload your own, or select from MLS listings
            </DialogDescription>
          </DialogHeader>
          
          <ImagePicker
            onSelect={(imageUrl) => {
              handlePhotoUploadComplete(imageUrl);
              setShowPhotoDialog(false);
            }}
            platform={previewPost?.platform}
            selectedImage={selectedPhoto}
            mlsPhotos={[
              "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&h=600&fit=crop",
              "https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800&h=600&fit=crop",
              "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop",
              "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&h=600&fit=crop",
              "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&h=600&fit=crop",
              "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop",
            ]}
          />
        </DialogContent>
      </Dialog>
    </Card>
    
    {/* Delete Confirmation Dialog */}
    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Scheduled Post?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this scheduled post? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (postToDelete) {
                deletePostMutation.mutate(postToDelete);
              }
              setShowDeleteConfirm(false);
              setPostToDelete(null);
            }}
            className="bg-red-600 hover:bg-red-700"
            data-testid="button-confirm-delete"
          >
            Delete Post
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Bulk Delete Confirmation Dialog */}
    <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {bulkDeleteType === "all" 
              ? "Delete All Scheduled Posts?" 
              : `Delete ${selectedPostIds.size} Selected Post${selectedPostIds.size !== 1 ? 's' : ''}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {bulkDeleteType === "all"
              ? `This will permanently delete all ${scheduledPosts.length} scheduled posts. This action cannot be undone.`
              : `This will permanently delete ${selectedPostIds.size} selected post${selectedPostIds.size !== 1 ? 's' : ''}. This action cannot be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-bulk-delete">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmBulkDelete}
            className="bg-red-600 hover:bg-red-700"
            disabled={bulkDeleteMutation.isPending}
            data-testid="button-confirm-bulk-delete"
          >
            {bulkDeleteMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              bulkDeleteType === "all" ? "Delete All Posts" : "Delete Selected"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
