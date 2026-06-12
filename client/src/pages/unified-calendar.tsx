import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Calendar, Plus, Trash2, RefreshCw, Settings, Sparkles, Clock, MapPin, ExternalLink, Check, X, Loader2, CalendarDays, Link2, ArrowLeft, Wand2, ListChecks, CheckCircle2, Eye, Home, MoreHorizontal, Heart, MessageCircle, Send, Bookmark, Edit2, Save, Upload, ChevronDown, Filter, AlertCircle, Image, XCircle, AlertTriangle, Mail, Video, Building2 } from "lucide-react";
import { FaFacebook, FaInstagram, FaLinkedin, FaYoutube, FaTiktok } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { AiGeneratedBadge } from "@/components/shared/ai-generated-badge";
import { ImagePicker } from "@/components/shared/image-picker";
import { PropertySelector, Property } from "@/components/dashboard/property-selector";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessType } from "@/lib/businessContext";
import { INDUSTRY_CALENDAR_BLUEPRINTS } from "@shared/industryCalendarBlueprints";
import { INDUSTRY_CONTENT } from "@shared/industryContent";
import { Sidebar } from "@/components/layout/sidebar";
import { Progress } from "@/components/ui/progress";
import { CharacterCounter, getPlatformConfig } from "@/components/ui/character-counter";

interface EventSource {
  id: string;
  name: string;
  type: string;
  status: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  syncError: string | null;
  createdAt: string;
}

interface Event {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  location: string | null;
  category: string | null;
  eventUrl: string | null;
  isAllDay: boolean;
}

interface EventPostSuggestion {
  id: string;
  platform: string;
  content: string;
  hashtags: string[];
  suggestedPostTime: string | null;
  status: string;
}

interface WeeklyPlanSuggestion extends EventPostSuggestion {
  eventTitle: string;
  eventDate: string;
}

interface ScheduledPost {
  id: string;
  platform: string;
  postType: string | null;
  content: string;
  scheduledFor: string;
  status: string;
  isEdited: boolean;
  originalContent: string;
  hashtags: string[];
  isAiGenerated?: boolean;
  metadata?: {
    imageUrl?: string;
    planId?: string;
    aiGenerated?: boolean;
    backfilled?: boolean;
    theme?: string;
    [key: string]: any;
  };
}

const calendarDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const generateCalendarDays = (selectedDate: Date) => {
  const today = new Date();
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());
  
  const days = [];
  const current = new Date(startDate);
  
  for (let week = 0; week < 6; week++) {
    const weekDays = [];
    for (let day = 0; day < 7; day++) {
      weekDays.push({
        date: current.getDate(),
        month: current.getMonth(),
        year: current.getFullYear(),
        isCurrentMonth: current.getMonth() === month,
        isToday: current.toDateString() === today.toDateString(),
        fullDate: new Date(current)
      });
      current.setDate(current.getDate() + 1);
    }
    days.push(weekDays);
  }
  
  return days;
};

const eventFormSchema = z.object({
  title: z.string().min(1, "Event title is required").max(200, "Title is too long"),
  date: z.string().min(1, "Date is required").refine((val) => {
    const parsed = new Date(val);
    return !isNaN(parsed.getTime());
  }, "Please enter a valid date"),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  isAllDay: z.boolean().default(false),
  location: z.string().optional(),
  description: z.string().max(2000, "Description is too long").optional(),
  category: z.string().default("community"),
}).refine(
  (data) => {
    if (!data.isAllDay && !data.startTime) {
      return false;
    }
    return true;
  },
  { message: "Start time is required for non-all-day events", path: ["startTime"] }
).refine(
  (data) => {
    if (data.startTime && data.endTime) {
      return data.endTime > data.startTime;
    }
    return true;
  },
  { message: "End time must be after start time", path: ["endTime"] }
);

const sourceFormSchema = z.object({
  name: z.string().min(1, "Source name is required").max(100, "Name is too long"),
  type: z.enum(["ical", "google_calendar_public"], {
    required_error: "Please select a source type",
  }),
  url: z.string().min(1, "URL is required").refine((url) => {
    if (url.includes("calendar.google.com") || url.endsWith(".ics") || url.includes("webcal://")) {
      return true;
    }
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }, "Please enter a valid calendar URL or Google Calendar ID"),
});

type EventFormData = z.infer<typeof eventFormSchema>;
type SourceFormData = z.infer<typeof sourceFormSchema>;

const platformColors: Record<string, string> = {
  facebook: "bg-blue-500",
  instagram: "bg-pink-500",
  linkedin: "bg-blue-700",
  x: "bg-blue-400",
  youtube: "bg-red-600",
};

const platformNames: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X",
  youtube: "YouTube",
};

const postTypeLabels: Record<string, string> = {
  market_update: "Market Update",
  buyer_tips: "Buyer Tips",
  seller_tips: "Seller Tips",
  neighborhood: "Neighborhood",
  neighborhood_tour: "Neighborhood Tour",
  local_market: "Local Market",
  moving_guide: "Moving Guide",
  open_houses: "Open House",
  just_listed: "Just Listed",
  just_sold: "Just Sold",
  price_improvement: "Price Drop",
};

export default function UnifiedCalendarPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const { businessType } = useBusinessType();
  const [activeTab, setActiveTab] = useState("calendar");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showAddSourceDialog, setShowAddSourceDialog] = useState(false);
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewFilter, setViewFilter] = useState<"all" | "events" | "posts">("all");
  const [weeklyPlanSuggestions, setWeeklyPlanSuggestions] = useState<WeeklyPlanSuggestion[]>([]);
  const [postManagerPlatformFilter, setPostManagerPlatformFilter] = useState<string>("all");
  const [postManagerStatusFilter, setPostManagerStatusFilter] = useState<string>("all");
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [editImageUrl, setEditImageUrl] = useState<string>("");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [showCreateImageDialog, setShowCreateImageDialog] = useState(false);
  const [showCreateVideoDialog, setShowCreateVideoDialog] = useState(false);
  const [showMlsDialog, setShowMlsDialog] = useState(false);
  const [mlsPhotos, setMlsPhotos] = useState<string[]>([]);
  const [videoPromptText, setVideoPromptText] = useState("");
  const [videoAspect, setVideoAspect] = useState("16:9");
  const [videoPlatform, setVideoPlatform] = useState<"veo" | "sora2" | "luma" | "runway">("veo");
  const [videoGenStep, setVideoGenStep] = useState<"idle" | "generating-image" | "generating-video" | "polling" | "done">("idle");
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [videoRefImageUrl, setVideoRefImageUrl] = useState<string | null>(null);
  const [videoRefImageUploading, setVideoRefImageUploading] = useState(false);
  const videoRefFileInputRef = useRef<HTMLInputElement>(null);
  const [mlsSelectedProperty, setMlsSelectedProperty] = useState<Property | null>(null);
  const videoMountedRef = useRef(true);
  useEffect(() => {
    return () => { videoMountedRef.current = false; };
  }, []);
  const previewFileInputRef = useRef<HTMLInputElement>(null);
  const [showAutoFillPanel, setShowAutoFillPanel] = useState(false);
  const [autoFillMode, setAutoFillMode] = useState<"month" | "twoweek">("month");
  const [autoFillPlatforms, setAutoFillPlatforms] = useState<string[]>(["facebook", "instagram", "linkedin", "x", "tiktok"]);
  const [autoFillFrequency, setAutoFillFrequency] = useState(3);
  const [autoFillCategories, setAutoFillCategories] = useState<string[]>([
    "market_update", "buyer_tips", "seller_tips", "neighborhood_spotlight",
    "home_improvement", "investment_tips", "community_events", "success_stories"
  ]);
  const [autoFillProgress, setAutoFillProgress] = useState(0);
  const [campaignStartDate, setCampaignStartDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [showBestTimes, setShowBestTimes] = useState(false);

  const industryBlueprint = INDUSTRY_CALENDAR_BLUEPRINTS[businessType];
  const industryContent = INDUSTRY_CONTENT[businessType] || INDUSTRY_CONTENT.general;

  const dynamicCategories = useMemo(() => {
    if (businessType !== 'real_estate' && industryBlueprint) {
      return industryBlueprint.postTypes.map(pt => ({
        id: pt,
        label: pt.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      }));
    }
    return [
      { id: "market_update", label: "Market" },
      { id: "buyer_tips", label: "Buyers" },
      { id: "seller_tips", label: "Sellers" },
      { id: "neighborhood_spotlight", label: "Neighborhoods" },
      { id: "home_improvement", label: "Home Tips" },
      { id: "investment_tips", label: "Investing" },
      { id: "community_events", label: "Community" },
      { id: "success_stories", label: "Stories" },
    ];
  }, [businessType, industryBlueprint]);

  useEffect(() => {
    const validIds = dynamicCategories.map(c => c.id);
    setAutoFillCategories(validIds);
  }, [dynamicCategories]);

  const rawName = user?.name || user?.email?.split('@')[0];
  const userName = rawName 
    ? rawName.charAt(0).toUpperCase() + rawName.slice(1)
    : "Agent";

  const eventForm = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      date: "",
      startTime: "",
      endTime: "",
      isAllDay: false,
      location: "",
      description: "",
      category: "community",
    },
  });

  const sourceForm = useForm<SourceFormData>({
    resolver: zodResolver(sourceFormSchema),
    defaultValues: {
      name: "",
      type: "ical",
      url: "",
    },
  });

  const { data: sourcesData, isLoading: sourcesLoading } = useQuery<{ sources: EventSource[] }>({
    queryKey: ["/api/events/sources"],
  });

  const { data: eventsData, isLoading: eventsLoading } = useQuery<{ events: Event[] }>({
    queryKey: ["/api/events"],
  });

  const { data: suggestionsData, refetch: refetchSuggestions } = useQuery<{ suggestions: EventPostSuggestion[] }>({
    queryKey: ["/api/events", selectedEvent?.id, "suggestions"],
    enabled: !!selectedEvent,
  });

  const { data: templatesData } = useQuery<{ templates: { name: string; type: string; calendarId?: string; icalUrl?: string }[] }>({
    queryKey: ["/api/events/templates"],
  });

  const { data: companyProfile } = useQuery<any>({ queryKey: ["/api/company/profile"] });

  const { data: apiScheduledPosts = [], isLoading: postsLoading } = useQuery<ScheduledPost[]>({
    queryKey: ["/api/scheduled-posts", statusFilter],
    queryFn: async () => {
      const url = statusFilter === "all" 
        ? "/api/scheduled-posts"
        : `/api/scheduled-posts?status=${statusFilter}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch scheduled posts");
      return await response.json();
    },
  });

  const createSourceMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; config: any }) => {
      const res = await apiRequest("POST", "/api/events/sources", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Source Added", description: "Calendar source added successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/events/sources"] });
      setShowAddSourceDialog(false);
      sourceForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/events/sources/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Source Removed", description: "Calendar source removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/events/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
  });

  const syncSourceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/events/sources/${id}/sync`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Sync Complete", 
        description: `Added ${data.added} events, updated ${data.updated}.` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
    onError: (error: Error) => {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/events/sync-all");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "All Sources Synced", 
        description: `Processed ${data.sourcesProcessed} sources. Added ${data.totalAdded} events.` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/events", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Event Created", description: "Your event has been added." });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setShowAddEventDialog(false);
      eventForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const fixBlankPostsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/scheduled-posts/fix-blank");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
      toast({
        title: data.fixed > 0 ? `Fixed ${data.fixed} Blank Post${data.fixed !== 1 ? "s" : ""}!` : "No Blank Posts Found",
        description: data.fixed > 0
          ? `${data.fixed} of ${data.total} blank posts have been filled with AI-generated content.`
          : "All your posts already have content.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Fix Failed", description: error.message, variant: "destructive" });
    },
  });

  const generatePostsMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const res = await apiRequest("POST", `/api/events/${eventId}/generate-posts`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Posts Generated", description: "AI has created post suggestions for this event." });
      refetchSuggestions();
    },
    onError: (error: Error) => {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    },
  });

  const acceptSuggestionMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      const res = await apiRequest("POST", `/api/events/suggestions/${suggestionId}/accept`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Post Scheduled", description: "The post has been added to your schedule." });
      refetchSuggestions();
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
    },
  });

  const rejectSuggestionMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      const res = await apiRequest("POST", `/api/events/suggestions/${suggestionId}/reject`);
      return res.json();
    },
    onSuccess: () => {
      refetchSuggestions();
    },
  });

  const generateWeeklyPlanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/events/generate-weekly-plan", {
        platforms: ['facebook', 'instagram', 'linkedin', 'x'],
      });
      return res.json();
    },
    onSuccess: (data) => {
      setWeeklyPlanSuggestions(data.suggestions || []);
      toast({ 
        title: "Weekly Plan Generated", 
        description: `Created ${data.suggestions?.length || 0} post suggestions for upcoming events` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    },
  });

  const acceptWeeklyPlanSuggestionMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      const res = await apiRequest("POST", `/api/events/suggestions/${suggestionId}/accept`);
      return res.json();
    },
    onSuccess: (_, suggestionId) => {
      setWeeklyPlanSuggestions(prev => 
        prev.map(s => s.id === suggestionId ? { ...s, status: 'accepted' } : s)
      );
      toast({ title: "Post Scheduled", description: "The post has been added to your schedule." });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
    },
  });

  const generateContentPlanMutation = useMutation({
    mutationFn: async (weeks: number = 4) => {
      const response = await apiRequest('POST', '/api/content/generate-plan', {
        targetAudience: businessType === 'real_estate' ? 'home buyers and sellers' : 'local customers',
        specialties: [],
        weeks,
        businessType,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
      const weeks = data.weeks || (data.posts?.length ? Math.ceil(data.posts.length / 35) : 4);
      toast({
        title: "Content Plan Generated!",
        description: `Created ${data.posts?.length || 0} posts across all platforms for the next ${weeks} week(s).`,
      });
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Could not generate content plan. Please try again.",
        variant: "destructive",
      });
    },
  });

  const generateMonthlyMutation = useMutation({
    mutationFn: async () => {
      setAutoFillProgress(10);
      const startDate = new Date(campaignStartDate + 'T00:00:00');
      const month = startDate.getMonth();
      const year = startDate.getFullYear();
      const res = await apiRequest("POST", "/api/scheduled-posts/generate-monthly", {
        platforms: autoFillPlatforms,
        postsPerWeek: autoFillFrequency,
        month,
        year,
        startDay: startDate.getDate(),
        categories: autoFillCategories,
      });
      setAutoFillProgress(90);
      return res.json();
    },
    onSuccess: (data) => {
      setAutoFillProgress(100);
      setTimeout(() => {
        setAutoFillProgress(0);
        setShowAutoFillPanel(false);
      }, 1000);
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
      toast({
        title: "Month Auto-Filled!",
        description: `Created ${data.count} AI-generated posts across ${autoFillPlatforms.length} platforms starting ${format(new Date(campaignStartDate + 'T00:00:00'), "MMM d, yyyy")}`,
      });
    },
    onError: (error: Error) => {
      setAutoFillProgress(0);
      toast({
        title: "Auto-Fill Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateTwoWeekMutation = useMutation({
    mutationFn: async () => {
      setAutoFillProgress(10);
      const startDate = new Date(campaignStartDate + 'T00:00:00');
      const month = startDate.getMonth();
      const year = startDate.getFullYear();
      const res = await apiRequest("POST", "/api/scheduled-posts/generate-monthly", {
        platforms: autoFillPlatforms.length > 0 ? autoFillPlatforms : ["facebook", "instagram", "linkedin", "x"],
        postsPerWeek: 3,
        month,
        year,
        startDay: startDate.getDate(),
        weeks: 2,
        categories: autoFillCategories,
      });
      setAutoFillProgress(90);
      return res.json();
    },
    onSuccess: (data) => {
      setAutoFillProgress(100);
      setTimeout(() => {
        setAutoFillProgress(0);
        setShowAutoFillPanel(false);
      }, 1000);
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
      toast({
        title: "Two-Week Blueprint Generated!",
        description: `Created ${data.count} SEO-optimized posts for 2 weeks starting ${format(new Date(campaignStartDate + 'T00:00:00'), "MMM d, yyyy")} with question hooks and keyword-rich captions.`,
      });
    },
    onError: (error: Error) => {
      setAutoFillProgress(0);
      toast({
        title: "Blueprint Generation Failed",
        description: error.message,
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
      setShowPreview(false);
      setPreviewContent(null);
    },
  });

  const deleteAllPostsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/scheduled-posts/bulk-delete", { deleteAll: true });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "All Posts Deleted",
        description: `${data.deleted} scheduled post${data.deleted !== 1 ? 's have' : ' has'} been deleted.`,
      });
      setSelectedPostIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Could not delete all posts. Please try again.",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteSelectedMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await apiRequest("POST", "/api/scheduled-posts/bulk-delete", { ids });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Posts Deleted",
        description: `${data.deleted} scheduled post${data.deleted !== 1 ? 's have' : ' has'} been deleted.`,
      });
      setSelectedPostIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Could not delete selected posts. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updatePostMutation = useMutation({
    mutationFn: async ({ id, content, metadata }: { id: string; content?: string; metadata?: any }) => {
      const body: any = {};
      if (content !== undefined) body.content = content;
      if (metadata !== undefined) body.metadata = metadata;
      const res = await apiRequest("PATCH", `/api/scheduled-posts/${id}`, body);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Post Updated",
        description: "Your scheduled post has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
      setShowEditDialog(false);
      setEditingPost(null);
      setEditContent("");
      setEditImageUrl("");
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sources = sourcesData?.sources || [];
  const events = eventsData?.events || [];
  const suggestions = suggestionsData?.suggestions || [];
  const templates = templatesData?.templates || [];

  // Auto-sync event sources on page load if sources exist
  const hasAutoSynced = useRef(false);
  useEffect(() => {
    if (sources.length > 0 && !hasAutoSynced.current && !syncAllMutation.isPending) {
      hasAutoSynced.current = true;
      syncAllMutation.mutate();
    }
  }, [sources.length]);

  const calendarGrid = useMemo(() => generateCalendarDays(selectedDate), [selectedDate]);

  // Filtered posts for the Scheduled Posts Manager section
  const filteredPosts = useMemo(() => {
    return apiScheduledPosts
      .filter(post => postManagerPlatformFilter === "all" || post.platform.toLowerCase() === postManagerPlatformFilter)
      .filter(post => postManagerStatusFilter === "all" || post.status.toLowerCase() === postManagerStatusFilter);
  }, [apiScheduledPosts, postManagerPlatformFilter, postManagerStatusFilter]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedPostIds(new Set());
  }, [postManagerPlatformFilter, postManagerStatusFilter]);

  const platformLimits: Record<string, { optimal: number; max: number }> = {
    x: { optimal: 280, max: 280 },
    twitter: { optimal: 280, max: 280 },
    facebook: { optimal: 500, max: 63206 },
    instagram: { optimal: 2000, max: 2200 },
    linkedin: { optimal: 1500, max: 3000 },
    youtube: { optimal: 3000, max: 5000 },
    tiktok: { optimal: 2000, max: 4000 },
  };

  const checkCompliance = (content: string): { status: 'compliant' | 'warning' | 'error'; issues: string[] } => {
    const issues: { message: string; severity: 'warning' | 'error' }[] = [];
    const lowerContent = content.toLowerCase();

    const advertisingIndicators = [
      'just listed', 'just sold', 'open house', 'for sale', 'price reduced',
      'new listing', 'coming soon', 'pending', 'under contract', 'sold!',
      'featured property', 'dream home', 'call me', 'contact me', 'dm me',
      'reach out', 'schedule a showing', 'home buyer', 'home seller',
      'real estate', 'property tour', 'market update', 'mortgage',
      'investment property', 'first time buyer'
    ];
    const isAdvertising = advertisingIndicators.some(indicator => lowerContent.includes(indicator));

    if (isAdvertising) {
      const brandTerms: string[] = [];
      if (companyProfile?.businessName) brandTerms.push(companyProfile.businessName.toLowerCase());
      if (companyProfile?.brokerageName) brandTerms.push(companyProfile.brokerageName.toLowerCase());

      if (brandTerms.length > 0) {
        const hasBranding = brandTerms.some(term => lowerContent.includes(term));
        if (!hasBranding) {
          issues.push({ message: 'Missing brokerage branding (required for ads)', severity: 'error' });
        }
      }
    }

    const prohibitedTerms = ['brokerage owner', 'principal broker'];
    prohibitedTerms.forEach(term => {
      if (lowerContent.includes(term)) {
        issues.push({ message: `Term "${term}" requires broker license`, severity: 'error' });
      }
    });

    if (issues.length === 0) return { status: 'compliant', issues: [] };
    const hasError = issues.some(i => i.severity === 'error');
    return {
      status: hasError ? 'error' : 'warning',
      issues: issues.map(i => i.message)
    };
  };

  const scheduledContent = useMemo(() => {
    return apiScheduledPosts.map((post) => {
      const scheduledDate = new Date(post.scheduledFor);
      const platformKey = post.platform.toLowerCase() as keyof typeof platformColors;
      
      return {
        id: `post-${post.id}`,
        originalId: post.id,
        title: post.postType ? postTypeLabels[post.postType] || post.postType : "Social Post",
        type: "post" as const,
        date: scheduledDate,
        time: format(scheduledDate, "h:mm a"),
        color: platformColors[platformKey] || "bg-gray-500",
        platform: platformNames[platformKey] || post.platform.charAt(0).toUpperCase() + post.platform.slice(1),
        content: post.content,
        photoUrl: post.metadata?.imageUrl,
        metadata: post.metadata,
        isAiGenerated: post.isAiGenerated || false,
        status: post.status,
      };
    });
  }, [apiScheduledPosts]);

  const calendarEvents = useMemo(() => {
    return events.map(event => ({
      id: `event-${event.id}`,
      originalId: event.id,
      title: event.title,
      type: "event" as const,
      date: new Date(event.startTime),
      time: event.isAllDay ? "All Day" : format(new Date(event.startTime), "h:mm a"),
      color: getCategoryColor(event.category),
      location: event.location,
      description: event.description,
      category: event.category,
      eventUrl: event.eventUrl,
      isAllDay: event.isAllDay,
    }));
  }, [events]);

  const getItemsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    
    const postsForDate = viewFilter === "events" ? [] : scheduledContent.filter(
      post => format(post.date, "yyyy-MM-dd") === dateStr
    );
    
    const eventsForDate = viewFilter === "posts" ? [] : calendarEvents.filter(
      event => format(event.date, "yyyy-MM-dd") === dateStr
    );
    
    return [...eventsForDate, ...postsForDate];
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  function getCategoryColor(category: string | null) {
    switch (category) {
      case "real_estate": return "bg-blue-500";
      case "market": return "bg-green-500";
      case "festival": return "bg-purple-500";
      case "networking": return "bg-orange-500";
      case "entertainment": return "bg-pink-500";
      case "sports": return "bg-red-500";
      case "education": return "bg-yellow-500";
      default: return "bg-gray-500";
    }
  }

  const getPlatformIcon = (platform: string) => {
    const iconClass = "w-5 h-5";
    switch (platform.toLowerCase()) {
      case "facebook": return <FaFacebook className={`${iconClass} text-blue-600`} />;
      case "instagram": return <FaInstagram className={`${iconClass} text-pink-500`} />;
      case "linkedin": return <FaLinkedin className={`${iconClass} text-blue-700`} />;
      case "x": 
      case "twitter": return <FaXTwitter className={`${iconClass} text-black dark:text-white`} />;
      case "youtube": return <FaYoutube className={`${iconClass} text-red-600`} />;
      case "tiktok": return <FaTiktok className={`${iconClass} text-black dark:text-white`} />;
      case "email": return <Mail className={`${iconClass} text-emerald-600`} />;
      default: return <span className="text-sm font-medium">{platform.charAt(0).toUpperCase()}</span>;
    }
  };

  const handleAddSource = (data: SourceFormData) => {
    const config: Record<string, string> = {};
    if (data.type === "ical") {
      config.icalUrl = data.url;
    } else if (data.type === "google_calendar_public") {
      config.calendarId = data.url;
    }
    
    createSourceMutation.mutate({
      name: data.name,
      type: data.type,
      config,
    });
  };

  const handleAddEvent = (data: EventFormData) => {
    let startTime: Date;
    let endTime: Date | undefined;
    
    if (data.isAllDay) {
      startTime = new Date(`${data.date}T00:00:00`);
      endTime = new Date(`${data.date}T23:59:59`);
    } else {
      startTime = new Date(`${data.date}T${data.startTime || "12:00"}`);
      if (data.endTime) {
        endTime = new Date(`${data.date}T${data.endTime}`);
      }
    }
    
    createEventMutation.mutate({
      title: data.title,
      description: data.description || undefined,
      startTime: startTime.toISOString(),
      endTime: endTime?.toISOString(),
      location: data.location || undefined,
      category: data.category,
      isAllDay: data.isAllDay,
    });
  };

  const handleAddTemplate = (template: { name: string; type: string; calendarId?: string; icalUrl?: string }) => {
    createSourceMutation.mutate({
      name: template.name,
      type: template.type,
      config: {
        calendarId: template.calendarId,
        icalUrl: template.icalUrl,
      },
    });
  };

  const handlePreview = (item: any) => {
    setPreviewContent(item);
    setShowPreview(true);
  };

  const handleAIScheduling = async () => {
    generateContentPlanMutation.mutate(4);
  };

  const upcomingEvents = events
    .filter(e => new Date(e.startTime) > new Date())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 10);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const years = [2024, 2025, 2026];

  const handleMonthYearChange = (value: string) => {
    const [monthName, yearStr] = value.split(' ');
    const monthIndex = months.indexOf(monthName);
    const year = parseInt(yearStr);
    setSelectedDate(new Date(year, monthIndex, 1));
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar activeView="calendar" />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6 max-w-7xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="page-title">
                <CalendarDays className="w-8 h-8" />
                Content & Event Calendar
              </h1>
              <p className="text-muted-foreground">
                Manage events, schedule posts, and generate AI content in one place
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => syncAllMutation.mutate()}
                disabled={syncAllMutation.isPending}
                data-testid="btn-sync-all"
              >
                {syncAllMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Sync Events
              </Button>
              <Dialog open={showAddEventDialog} onOpenChange={(open) => {
                setShowAddEventDialog(open);
                if (!open) eventForm.reset();
              }}>
                <DialogTrigger asChild>
                  <Button data-testid="btn-add-event">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Event
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Manual Event</DialogTitle>
                    <DialogDescription>
                      Add a local event to generate posts for
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...eventForm}>
                    <form onSubmit={eventForm.handleSubmit(handleAddEvent)} className="space-y-4">
                      <FormField
                        control={eventForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Event Title</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Omaha Farmer's Market"
                                data-testid="input-event-title"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={eventForm.control}
                        name="isAllDay"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3">
                            <div className="space-y-0.5">
                              <FormLabel>All-Day Event</FormLabel>
                              <FormDescription className="text-xs">
                                Toggle if this event runs the entire day
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-all-day"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={eventForm.control}
                        name="date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="date"
                                data-testid="input-event-date"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {!eventForm.watch("isAllDay") && (
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={eventForm.control}
                            name="startTime"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Start Time</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    type="time"
                                    data-testid="input-start-time"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={eventForm.control}
                            name="endTime"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>End Time (optional)</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    type="time"
                                    data-testid="input-end-time"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                      <FormField
                        control={eventForm.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location (optional)</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Old Market, Omaha"
                                data-testid="input-event-location"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={eventForm.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger data-testid="select-event-category">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="community">Community</SelectItem>
                                <SelectItem value="real_estate">Real Estate</SelectItem>
                                <SelectItem value="market">Market</SelectItem>
                                <SelectItem value="festival">Festival</SelectItem>
                                <SelectItem value="networking">Networking</SelectItem>
                                <SelectItem value="entertainment">Entertainment</SelectItem>
                                <SelectItem value="sports">Sports</SelectItem>
                                <SelectItem value="education">Education</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={eventForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description (optional)</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="Describe the event..."
                                data-testid="input-event-description"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        disabled={createEventMutation.isPending}
                        className="w-full"
                        data-testid="btn-create-event"
                      >
                        {createEventMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4 mr-2" />
                        )}
                        Create Event
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="calendar" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Calendar View
              </TabsTrigger>
              <TabsTrigger value="ai-planner" className="flex items-center gap-2">
                <Wand2 className="w-4 h-4" />
                AI Planner
              </TabsTrigger>
              <TabsTrigger value="events" className="flex items-center gap-2">
                <ListChecks className="w-4 h-4" />
                Upcoming Events
              </TabsTrigger>
              <TabsTrigger value="sources" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Event Sources
              </TabsTrigger>
            </TabsList>

        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Monthly Calendar</CardTitle>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <Select value={viewFilter} onValueChange={(v: "all" | "events" | "posts") => setViewFilter(v)}>
                    <SelectTrigger className="w-32" data-testid="select-view-filter">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Items</SelectItem>
                      <SelectItem value="events">Events Only</SelectItem>
                      <SelectItem value="posts">Posts Only</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={`${format(selectedDate, "MMMM")} ${format(selectedDate, "yyyy")}`}
                    onValueChange={handleMonthYearChange}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(year => 
                        months.map(month => (
                          <SelectItem key={`${month} ${year}`} value={`${month} ${year}`}>
                            {month} {year}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={() => setShowAutoFillPanel(!showAutoFillPanel)}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                    data-testid="btn-auto-fill-month"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Auto-Fill Month
                  </Button>
                  {apiScheduledPosts.filter(p => !p.content || !(p.content as string).trim()).length > 0 && (
                    <Button
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
                      onClick={() => fixBlankPostsMutation.mutate()}
                      disabled={fixBlankPostsMutation.isPending}
                      data-testid="btn-fix-blank-posts"
                    >
                      {fixBlankPostsMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Fixing...</>
                      ) : (
                        <><Wand2 className="w-4 h-4 mr-2" />Fix Blank Posts ({apiScheduledPosts.filter(p => !p.content || !(p.content as string).trim()).length})</>
                      )}
                    </Button>
                  )}
                  {apiScheduledPosts.filter(p => p.status === "pending").length > 0 && (
                    <Button 
                      variant="outline"
                      className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400"
                      onClick={async () => {
                        const pendingPosts = apiScheduledPosts.filter(p => p.status === "pending");
                        let approved = 0;
                        let failed = 0;
                        for (const post of pendingPosts) {
                          try {
                            await apiRequest("PUT", `/api/scheduled-posts/${post.id}`, { status: "approved" });
                            approved++;
                          } catch {
                            failed++;
                          }
                        }
                        queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
                        if (failed > 0) {
                          toast({ title: "Partially Approved", description: `${approved} approved, ${failed} failed.`, variant: "destructive" });
                        } else {
                          toast({ title: "All Posts Approved", description: `${approved} posts approved and will be published at their scheduled times.` });
                        }
                      }}
                      data-testid="btn-approve-all"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Approve All ({apiScheduledPosts.filter(p => p.status === "pending").length})
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            {showAutoFillPanel && (
              <div className="mx-6 mb-4 p-4 border-2 border-amber-200 dark:border-amber-800 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Auto-Fill Content
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowAutoFillPanel(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setAutoFillMode("month")}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                      autoFillMode === "month"
                        ? "border-amber-400 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200"
                        : "border-gray-200 dark:border-gray-700 hover:border-amber-300"
                    }`}
                    data-testid="mode-month"
                  >
                    <CalendarDays className="w-4 h-4 mx-auto mb-1" />
                    Full Month
                    <p className="text-[10px] text-muted-foreground mt-0.5">Fill remaining month with posts</p>
                  </button>
                  <button
                    onClick={() => setAutoFillMode("twoweek")}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                      autoFillMode === "twoweek"
                        ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200"
                        : "border-gray-200 dark:border-gray-700 hover:border-emerald-300"
                    }`}
                    data-testid="mode-twoweek"
                  >
                    <Sparkles className="w-4 h-4 mx-auto mb-1" />
                    Two-Week Blueprint
                    <p className="text-[10px] text-muted-foreground mt-0.5">SEO-optimized 14-day plan</p>
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-medium mb-2 block">Campaign Start Date</Label>
                    <Input
                      type="date"
                      value={campaignStartDate}
                      onChange={(e) => {
                        if (e.target.value) setCampaignStartDate(e.target.value);
                      }}
                      required
                      min={(() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; })()}
                      className="w-full text-sm"
                      data-testid="input-campaign-start-date"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Posts will be scheduled starting from this date</p>
                  </div>

                  <button
                    onClick={() => setShowBestTimes(!showBestTimes)}
                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    data-testid="btn-toggle-best-times"
                  >
                    <Clock className="w-3 h-3" />
                    {showBestTimes ? "Hide" : "Show"} Best Times to Post
                    <ChevronDown className={`w-3 h-3 transition-transform ${showBestTimes ? "rotate-180" : ""}`} />
                  </button>
                  {showBestTimes && (
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-1.5">
                      <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">Recommended posting windows:</p>
                      <div className="grid gap-1 text-[10px]">
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300"><FaFacebook className="w-3 h-3 text-blue-600" /> <span className="font-medium">Facebook:</span> Tue–Thu, 9am–12pm</div>
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300"><FaInstagram className="w-3 h-3 text-pink-500" /> <span className="font-medium">Instagram:</span> Mon/Wed/Fri, 11am–1pm</div>
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300"><FaLinkedin className="w-3 h-3 text-blue-700" /> <span className="font-medium">LinkedIn:</span> Tue–Wed, 8am–10am</div>
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300"><FaXTwitter className="w-3 h-3" /> <span className="font-medium">X/Twitter:</span> Wed–Fri, 9am–11am</div>
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300"><FaTiktok className="w-3 h-3" /> <span className="font-medium">TikTok:</span> Tue/Thu/Sat, 7pm–9pm</div>
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300"><FaYoutube className="w-3 h-3 text-red-600" /> <span className="font-medium">YouTube:</span> Thu–Sat, 2pm–4pm</div>
                      </div>
                    </div>
                  )}
                </div>

                {autoFillMode === "twoweek" ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                      <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200 mb-2">
                        Your {businessType.replace(/_/g, ' ')} blueprint includes:
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-emerald-700 dark:text-emerald-300">
                        <div className="flex items-center gap-1"><Check className="w-3 h-3" /> Question-format hooks for voice search</div>
                        <div className="flex items-center gap-1"><Check className="w-3 h-3" /> Keyword-rich captions for SEO</div>
                        <div className="flex items-center gap-1"><Check className="w-3 h-3" /> Local area references</div>
                        <div className="flex items-center gap-1"><Check className="w-3 h-3" /> Platform-optimized character counts</div>
                        <div className="flex items-center gap-1"><Check className="w-3 h-3" /> Industry-specific content types</div>
                        <div className="flex items-center gap-1"><Check className="w-3 h-3" /> CTA on every post</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <Button
                        onClick={() => generateTwoWeekMutation.mutate()}
                        disabled={generateTwoWeekMutation.isPending}
                        className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white"
                        data-testid="btn-generate-twoweek"
                      >
                        {generateTwoWeekMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Building Blueprint...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Generate Two-Week Blueprint
                          </>
                        )}
                      </Button>
                      {generateTwoWeekMutation.isPending && (
                        <div className="flex-1">
                          <Progress value={autoFillProgress} className="h-2" />
                          <p className="text-[10px] text-muted-foreground mt-1">
                            AI is creating SEO-optimized content with question hooks and keywords...
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs font-medium mb-2 block">Platforms</Label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { id: "facebook", label: "Facebook", icon: FaFacebook, color: "text-blue-600" },
                            { id: "instagram", label: "Instagram", icon: FaInstagram, color: "text-pink-500" },
                            { id: "linkedin", label: "LinkedIn", icon: FaLinkedin, color: "text-blue-700" },
                            { id: "x", label: "X", icon: FaXTwitter, color: "text-black dark:text-white" },
                            { id: "tiktok", label: "TikTok", icon: FaTiktok, color: "text-black dark:text-white" },
                            { id: "youtube", label: "YouTube", icon: FaYoutube, color: "text-red-600" },
                          ].map((p) => {
                            const isSelected = autoFillPlatforms.includes(p.id);
                            return (
                              <button
                                key={p.id}
                                onClick={() => {
                                  setAutoFillPlatforms(prev => 
                                    isSelected 
                                      ? prev.filter(x => x !== p.id)
                                      : [...prev, p.id]
                                  );
                                }}
                                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-all ${
                                  isSelected 
                                    ? "border-amber-400 bg-white dark:bg-gray-800 shadow-sm" 
                                    : "border-gray-200 dark:border-gray-700 opacity-50"
                                }`}
                                data-testid={`toggle-platform-${p.id}`}
                              >
                                <p.icon className={`w-3 h-3 ${p.color}`} />
                                {p.label}
                                {p.id === "x" && <span className="text-[10px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded-full">Down</span>}
                                {isSelected && <Check className="w-3 h-3 text-green-500" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs font-medium mb-2 block">Posts per Week</Label>
                        <div className="flex gap-1">
                          {[2, 3, 4, 5, 7].map((n) => (
                            <button
                              key={n}
                              onClick={() => setAutoFillFrequency(n)}
                              className={`px-3 py-1.5 rounded text-xs font-medium border transition-all ${
                                autoFillFrequency === n
                                  ? "border-amber-400 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                                  : "border-gray-200 dark:border-gray-700 hover:border-amber-300"
                              }`}
                              data-testid={`freq-${n}`}
                            >
                              {n === 7 ? "Daily" : `${n}x`}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          ~{Math.round(autoFillFrequency * 4.3)} posts this month
                        </p>
                      </div>

                      <div>
                        <Label className="text-xs font-medium mb-2 block">Content Mix</Label>
                        <div className="flex flex-wrap gap-1">
                          {dynamicCategories.map((cat) => {
                            const isSelected = autoFillCategories.includes(cat.id);
                            return (
                              <button
                                key={cat.id}
                                onClick={() => {
                                  setAutoFillCategories(prev =>
                                    isSelected
                                      ? prev.filter(x => x !== cat.id)
                                      : [...prev, cat.id]
                                  );
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                                  isSelected
                                    ? "border-amber-400 bg-white dark:bg-gray-800"
                                    : "border-gray-200 dark:border-gray-700 opacity-50"
                                }`}
                                data-testid={`toggle-cat-${cat.id}`}
                              >
                                {cat.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <Button
                        onClick={() => generateMonthlyMutation.mutate()}
                        disabled={generateMonthlyMutation.isPending || autoFillPlatforms.length === 0 || autoFillCategories.length === 0}
                        className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                        data-testid="btn-generate-month"
                      >
                        {generateMonthlyMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating {format(selectedDate, "MMMM")} Posts...
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-4 h-4 mr-2" />
                            Generate {format(selectedDate, "MMMM")} Posts
                          </>
                        )}
                      </Button>
                      {generateMonthlyMutation.isPending && (
                        <div className="flex-1">
                          <Progress value={autoFillProgress} className="h-2" />
                          <p className="text-[10px] text-muted-foreground mt-1">
                            AI is creating unique content for each post... This may take a minute.
                          </p>
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {autoFillPlatforms.length} platforms, {autoFillFrequency}x/week, {autoFillCategories.length} categories
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
            <CardContent>
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {calendarDays.map((day) => (
                  <div key={day} className="text-xs font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-1 text-center">
                {calendarGrid.map((week, weekIndex) => 
                  week.map((day, dayIndex) => {
                    const dayItems = getItemsForDate(day.fullDate);
                    
                    return (
                      <div
                        key={`${weekIndex}-${dayIndex}`}
                        className={`
                          relative min-h-[100px] p-1 border rounded-sm
                          ${
                            day.isCurrentMonth
                              ? day.isToday
                                ? "bg-primary/10 border-primary text-foreground font-medium"
                                : "text-foreground hover:bg-muted/50"
                              : "text-muted-foreground bg-muted/20"
                          }
                        `}
                        data-testid={`calendar-day-${day.date}`}
                      >
                        <div className="text-xs font-medium mb-1">{day.date}</div>
                        
                        {dayItems.slice(0, 3).map((item) => (
                          <div
                            key={item.id}
                            className={`text-xs p-1 rounded ${item.color} text-white cursor-pointer hover:opacity-80 mb-1 overflow-hidden`}
                            onClick={() => handlePreview(item)}
                            title={item.title}
                            data-testid={`calendar-item-${item.id}`}
                          >
                            <div className="flex items-center gap-1">
                              {item.type === "event" ? (
                                <CalendarDays className="w-3 h-3 flex-shrink-0" />
                              ) : null}
                              <span className="truncate text-[10px]">{item.title}</span>
                            </div>
                            {item.type === "post" && item.platform?.toLowerCase() === "tiktok" && !item.photoUrl && !(apiScheduledPosts.find(p => p.id === item.originalId)?.metadata as any)?.imageUrl && (
                              <div className="mt-0.5 bg-red-600 text-white text-[9px] px-1 rounded font-medium" data-testid={`badge-needs-video-${item.id}`}>
                                📹 Needs video
                              </div>
                            )}
                            {item.type === "post" && item.platform?.toLowerCase() === "instagram" && !item.photoUrl && !(apiScheduledPosts.find(p => p.id === item.originalId)?.metadata as any)?.imageUrl && (
                              <div className="mt-0.5 bg-red-600 text-white text-[9px] px-1 rounded font-medium" data-testid={`badge-needs-image-${item.id}`}>
                                📷 Needs image
                              </div>
                            )}
                          </div>
                        ))}
                        {dayItems.length > 3 && (
                          <div className="text-[10px] text-muted-foreground">
                            +{dayItems.length - 3} more
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-500 rounded"></div>
                  <span>Events</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span>Facebook</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-pink-500 rounded"></div>
                  <span>Instagram</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-700 rounded"></div>
                  <span>LinkedIn</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-600 rounded"></div>
                  <span>YouTube</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scheduled Posts Manager Section */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ListChecks className="w-5 h-5" />
                    Scheduled Posts Manager
                    {apiScheduledPosts.length > 0 && (
                      <Badge variant="secondary">{apiScheduledPosts.length} posts</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Preview, edit, and optimize your scheduled posts
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {filteredPosts.length > 0 && (
                    <div className="flex items-center gap-2 mr-2">
                      <Checkbox
                        id="select-all-posts"
                        checked={selectedPostIds.size === filteredPosts.length && filteredPosts.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedPostIds(new Set(filteredPosts.map(p => p.id)));
                          } else {
                            setSelectedPostIds(new Set());
                          }
                        }}
                        data-testid="checkbox-select-all-posts"
                      />
                      <label htmlFor="select-all-posts" className="text-sm text-muted-foreground cursor-pointer">
                        Select All
                      </label>
                    </div>
                  )}
                  <Select value={postManagerPlatformFilter} onValueChange={setPostManagerPlatformFilter}>
                    <SelectTrigger className="w-32" data-testid="select-post-platform-filter">
                      <SelectValue placeholder="Platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Platforms</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="x">Twitter/X</SelectItem>
                      <SelectItem value="youtube">YouTube</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={postManagerStatusFilter} onValueChange={setPostManagerStatusFilter}>
                    <SelectTrigger className="w-32" data-testid="select-post-status-filter">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="posted">Posted</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedPostIds.size > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={async () => {
                        const confirmed = await confirm({
                          title: "Delete Selected Posts",
                          description: `Delete ${selectedPostIds.size} selected post${selectedPostIds.size !== 1 ? 's' : ''}? This cannot be undone.`,
                          confirmText: "Delete",
                          variant: "destructive",
                        });
                        if (confirmed) {
                          bulkDeleteSelectedMutation.mutate(Array.from(selectedPostIds));
                        }
                      }}
                      disabled={bulkDeleteSelectedMutation.isPending}
                      data-testid="btn-delete-selected-posts"
                    >
                      {bulkDeleteSelectedMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-1" />
                      )}
                      Delete {selectedPostIds.size} Selected
                    </Button>
                  )}
                  {apiScheduledPosts.filter(p => p.status === 'scheduled').length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={async () => {
                        const confirmed = await confirm({
                          title: "Delete All Posts",
                          description: "Delete all scheduled posts? This cannot be undone.",
                          confirmText: "Delete All",
                          variant: "destructive",
                        });
                        if (confirmed) {
                          deleteAllPostsMutation.mutate();
                        }
                      }}
                      disabled={deleteAllPostsMutation.isPending}
                      data-testid="btn-delete-all-posts"
                    >
                      {deleteAllPostsMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-1" />
                      )}
                      Delete All
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {postsLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : apiScheduledPosts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No scheduled posts yet</p>
                  <p className="text-sm">Use AI Generate to create content</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredPosts.map((post) => {
                      const limit = platformLimits[post.platform.toLowerCase()] || { optimal: 500, max: 2000 };
                      const charCount = post.content.length;
                      const charPercent = Math.min((charCount / limit.max) * 100, 100);
                      const charColor = charCount <= limit.optimal ? "bg-green-500" : charCount <= limit.max ? "bg-yellow-500" : "bg-red-500";
                      const compliance = checkCompliance(post.content);
                      const scheduledDate = new Date(post.scheduledFor);

                      return (
                        <div 
                          key={post.id} 
                          className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                          data-testid={`post-row-${post.id}`}
                        >
                          <div className="flex items-start gap-4">
                            <Checkbox
                              checked={selectedPostIds.has(post.id)}
                              onCheckedChange={(checked) => {
                                const newSelected = new Set(selectedPostIds);
                                if (checked) {
                                  newSelected.add(post.id);
                                } else {
                                  newSelected.delete(post.id);
                                }
                                setSelectedPostIds(newSelected);
                              }}
                              className="mt-1"
                              data-testid={`checkbox-post-${post.id}`}
                            />
                            <div className="flex-shrink-0">
                              {getPlatformIcon(post.platform)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant={post.status === 'scheduled' ? 'default' : post.status === 'posted' ? 'secondary' : 'destructive'}>
                                  {post.status}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {format(scheduledDate, "MMM d, yyyy 'at' h:mm a")}
                                </span>
                                {post.isAiGenerated && <AiGeneratedBadge size="sm" />}
                              </div>
                              
                              <p className="text-sm line-clamp-2 mb-2">{post.content}</p>
                              {post.metadata?.imageUrl && (
                                <img src={post.metadata.imageUrl} alt="Post media" className="h-16 w-16 object-cover rounded mb-2" />
                              )}
                              
                              <div className="flex items-center gap-4 mt-3">
                                {/* Character Count */}
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-muted-foreground">{charCount}/{limit.max}</span>
                                  <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                                    <div className={`h-full ${charColor}`} style={{ width: `${charPercent}%` }} />
                                  </div>
                                </div>
                                
                                {/* Compliance Status */}
                                <div className="flex items-center gap-1">
                                  {compliance.status === 'compliant' && (
                                    <Badge variant="outline" className="text-green-600 border-green-600">
                                      <CheckCircle2 className="w-3 h-3 mr-1" />
                                      Compliant
                                    </Badge>
                                  )}
                                  {compliance.status === 'warning' && (
                                    <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                                      <AlertTriangle className="w-3 h-3 mr-1" />
                                      {compliance.issues[0]}
                                    </Badge>
                                  )}
                                  {compliance.status === 'error' && (
                                    <Badge variant="outline" className="text-red-600 border-red-600">
                                      <XCircle className="w-3 h-3 mr-1" />
                                      {compliance.issues[0]}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex-shrink-0 flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const platformKey = post.platform.toLowerCase() as keyof typeof platformColors;
                                  setEditingPost(post);
                                  setEditContent(post.content);
                                  setEditImageUrl((post.metadata as any)?.imageUrl || "");
                                  handlePreview({
                                    id: `post-${post.id}`,
                                    originalId: post.id,
                                    title: post.postType ? postTypeLabels[post.postType] || post.postType : "Social Post",
                                    type: "post" as const,
                                    date: scheduledDate,
                                    time: format(scheduledDate, "h:mm a"),
                                    color: platformColors[platformKey] || "bg-gray-500",
                                    platform: platformNames[platformKey] || post.platform.charAt(0).toUpperCase() + post.platform.slice(1),
                                    content: post.content,
                                    photoUrl: post.metadata?.imageUrl,
                                    metadata: post.metadata,
                                    isAiGenerated: post.isAiGenerated || false,
                                    status: post.status,
                                  });
                                }}
                                data-testid={`btn-edit-post-${post.id}`}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deletePostMutation.mutate(post.id)}
                                disabled={deletePostMutation.isPending}
                                data-testid={`btn-delete-post-${post.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-planner">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="w-5 h-5" />
                  Weekly Content Planner
                </CardTitle>
                <CardDescription>
                  Generate AI-powered posts based on upcoming events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button
                    onClick={() => generateWeeklyPlanMutation.mutate()}
                    disabled={generateWeeklyPlanMutation.isPending}
                    className="w-full"
                    data-testid="btn-generate-weekly-plan"
                  >
                    {generateWeeklyPlanMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Generate Weekly Plan from Events
                  </Button>

                  {weeklyPlanSuggestions.length > 0 && (
                    <div className="space-y-3 mt-4">
                      <div className="flex items-center justify-between">
                        <h5 className="font-medium">Generated Suggestions</h5>
                        <Badge variant="outline">
                          {weeklyPlanSuggestions.filter(s => s.status === 'suggested').length} pending
                        </Badge>
                      </div>
                      {weeklyPlanSuggestions.map((suggestion) => (
                        <div key={suggestion.id} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {getPlatformIcon(suggestion.platform)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {suggestion.eventTitle}
                              </span>
                            </div>
                            {suggestion.status === 'suggested' && (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => acceptWeeklyPlanSuggestionMutation.mutate(suggestion.id)}
                                  disabled={acceptWeeklyPlanSuggestionMutation.isPending}
                                  data-testid={`btn-accept-weekly-${suggestion.id}`}
                                >
                                  <Check className="w-4 h-4 text-green-500" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setWeeklyPlanSuggestions(prev => 
                                    prev.map(s => s.id === suggestion.id ? { ...s, status: 'rejected' } : s)
                                  )}
                                  data-testid={`btn-reject-weekly-${suggestion.id}`}
                                >
                                  <X className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            )}
                            {suggestion.status === 'accepted' && (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Scheduled
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm line-clamp-3">{suggestion.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Generate from Selected Event
                </CardTitle>
                <CardDescription>
                  {selectedEvent ? "Create posts for this event" : "Select an event to generate posts"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedEvent ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <h4 className="font-medium">{selectedEvent.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(selectedEvent.startTime)}
                      </p>
                    </div>

                    <Button
                      onClick={() => generatePostsMutation.mutate(selectedEvent.id)}
                      disabled={generatePostsMutation.isPending}
                      className="w-full"
                      data-testid="btn-generate-posts"
                    >
                      {generatePostsMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      Generate Posts for All Platforms
                    </Button>

                    {suggestions.length > 0 && (
                      <div className="space-y-3 mt-4">
                        <h5 className="font-medium text-sm">Generated Suggestions</h5>
                        {suggestions
                          .filter(s => s.status === "suggested")
                          .map((suggestion) => (
                          <div key={suggestion.id} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant="outline">
                                {getPlatformIcon(suggestion.platform)}
                              </Badge>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => acceptSuggestionMutation.mutate(suggestion.id)}
                                  disabled={acceptSuggestionMutation.isPending}
                                  data-testid={`btn-accept-${suggestion.id}`}
                                >
                                  <Check className="w-4 h-4 text-green-500" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => rejectSuggestionMutation.mutate(suggestion.id)}
                                  disabled={rejectSuggestionMutation.isPending}
                                  data-testid={`btn-reject-${suggestion.id}`}
                                >
                                  <X className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm">{suggestion.content}</p>
                            {suggestion.hashtags && suggestion.hashtags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {suggestion.hashtags.map((tag, i) => (
                                  <span key={i} className="text-xs text-blue-500">
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Select an event from the list below</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Upcoming Events</CardTitle>
              <CardDescription>Click an event to generate posts for it</CardDescription>
            </CardHeader>
            <CardContent>
              {eventsLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : upcomingEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No upcoming events</p>
                  <p className="text-sm">Add event sources or create manual events</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {upcomingEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedEvent?.id === event.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                      data-testid={`event-item-${event.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-3 h-3 rounded-full mt-1.5 ${getCategoryColor(event.category)}`} />
                        <div className="flex-1">
                          <h4 className="font-medium">{event.title}</h4>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(event.startTime)} {!event.isAllDay && formatTime(event.startTime)}
                            </span>
                            {event.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {event.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>All Upcoming Events</CardTitle>
              <CardDescription>Events from all connected sources</CardDescription>
            </CardHeader>
            <CardContent>
              {eventsLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No events found</p>
                  <p className="text-sm">Connect a calendar source or add events manually</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {events
                    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                    .map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => setSelectedEvent(event)}
                      data-testid={`event-row-${event.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-3 h-3 rounded-full mt-1.5 ${getCategoryColor(event.category)}`} />
                        <div>
                          <h4 className="font-medium">{event.title}</h4>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(event.startTime)} {!event.isAllDay && formatTime(event.startTime)}
                            </span>
                            {event.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {event.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {event.eventUrl && (
                          <a 
                            href={event.eventUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:text-primary"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            generatePostsMutation.mutate(event.id);
                          }}
                          disabled={generatePostsMutation.isPending}
                          data-testid={`btn-generate-event-${event.id}`}
                        >
                          <Sparkles className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Connected Sources</CardTitle>
                <CardDescription>
                  Calendar feeds and event sources
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sourcesLoading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : sources.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Link2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No sources connected</p>
                    <p className="text-sm">Add a calendar source to start tracking events</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sources.map((source) => (
                      <div
                        key={source.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                        data-testid={`source-${source.id}`}
                      >
                        <div>
                          <h4 className="font-medium">{source.name}</h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="outline">{source.type}</Badge>
                            {source.lastSyncAt && (
                              <span>
                                Last sync: {new Date(source.lastSyncAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {source.syncError && (
                            <p className="text-xs text-red-500 mt-1">{source.syncError}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => syncSourceMutation.mutate(source.id)}
                            disabled={syncSourceMutation.isPending}
                            data-testid={`btn-sync-${source.id}`}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteSourceMutation.mutate(source.id)}
                            disabled={deleteSourceMutation.isPending}
                            data-testid={`btn-delete-source-${source.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Dialog open={showAddSourceDialog} onOpenChange={(open) => {
                  setShowAddSourceDialog(open);
                  if (!open) sourceForm.reset();
                }}>
                  <DialogTrigger asChild>
                    <Button className="w-full mt-4" variant="outline" data-testid="btn-add-source">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Calendar Source
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add Calendar Source</DialogTitle>
                      <DialogDescription>
                        Connect a calendar to automatically pull events
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...sourceForm}>
                      <form onSubmit={sourceForm.handleSubmit(handleAddSource)} className="space-y-4">
                        <FormField
                          control={sourceForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Source Name</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Omaha Events"
                                  data-testid="input-source-name"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={sourceForm.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Source Type</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-source-type">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="ical">iCal Feed URL</SelectItem>
                                  <SelectItem value="google_calendar_public">Google Public Calendar</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={sourceForm.control}
                          name="url"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {sourceForm.watch("type") === "ical" ? "iCal URL" : "Calendar ID"}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder={
                                    sourceForm.watch("type") === "ical"
                                      ? "https://example.com/calendar.ics"
                                      : "calendar-id@group.calendar.google.com"
                                  }
                                  data-testid="input-source-url"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button
                          type="submit"
                          disabled={createSourceMutation.isPending}
                          className="w-full"
                          data-testid="btn-create-source"
                        >
                          {createSourceMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4 mr-2" />
                          )}
                          Add Source
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Add Templates</CardTitle>
                <CardDescription>
                  Popular calendar sources for Omaha area
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {templates.map((template, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <h4 className="font-medium">{template.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {template.type}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddTemplate(template)}
                        disabled={sources.some(s => s.name === template.name)}
                        data-testid={`btn-add-template-${idx}`}
                      >
                        {sources.some(s => s.name === template.name) ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                  {templates.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground">
                      <p className="text-sm">No templates available</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showPreview} onOpenChange={(open) => {
        setShowPreview(open);
        if (!open) {
          setEditingPost(null);
          setEditContent("");
          setEditImageUrl("");
        }
      }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {previewContent?.type === "event" ? "Event Details" : "Post Preview"}
            </DialogTitle>
          </DialogHeader>
          {previewContent && (
            <div className="space-y-4">
              {previewContent.type === "event" ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${previewContent.color}`} />
                    <h3 className="font-semibold text-lg">{previewContent.title}</h3>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{format(previewContent.date, "EEEE, MMMM d, yyyy")} at {previewContent.time}</span>
                    </div>
                    {previewContent.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>{previewContent.location}</span>
                      </div>
                    )}
                  </div>
                  {previewContent.description && (
                    <p className="text-sm">{previewContent.description}</p>
                  )}
                  <Button
                    className="w-full"
                    onClick={() => {
                      const event = events.find(e => e.id === previewContent.originalId);
                      if (event) {
                        generatePostsMutation.mutate(event.id);
                      }
                    }}
                    disabled={generatePostsMutation.isPending}
                    data-testid="btn-generate-from-preview"
                  >
                    {generatePostsMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Generate Posts for This Event
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getPlatformIcon(previewContent.platform?.toLowerCase() || "")}
                      <span className="font-medium">{previewContent.platform}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {previewContent.isAiGenerated && <AiGeneratedBadge size="sm" />}
                      <Badge variant={previewContent.status === "approved" ? "default" : previewContent.status === "posted" ? "secondary" : "outline"} className="text-[10px]">
                        {previewContent.status || "pending"}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Scheduled for {format(previewContent.date, "MMMM d, yyyy")} at {previewContent.time}
                  </p>
                  {editingPost?.id === previewContent.originalId ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[120px] text-sm"
                        data-testid="textarea-edit-preview"
                      />
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Media</Label>
                        <input
                          type="file"
                          accept="image/*,video/*"
                          ref={previewFileInputRef}
                          className="hidden"
                          data-testid="input-media-file-preview"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setMediaUploading(true);
                            try {
                              const formData = new FormData();
                              formData.append("media", file);
                              const res = await fetch("/api/scheduled-posts/upload-media", {
                                method: "POST",
                                credentials: "include",
                                body: formData,
                              });
                              const data = await res.json();
                              if (data.url) {
                                setEditImageUrl(data.url);
                                toast({ title: "Media Uploaded", description: "File uploaded successfully." });
                              } else {
                                toast({ title: "Upload Failed", description: data.error || "Could not upload media", variant: "destructive" });
                              }
                            } catch {
                              toast({ title: "Upload Failed", description: "Could not upload media", variant: "destructive" });
                            } finally {
                              setMediaUploading(false);
                              if (previewFileInputRef.current) previewFileInputRef.current.value = "";
                            }
                          }}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => previewFileInputRef.current?.click()}
                            disabled={mediaUploading}
                            data-testid="btn-upload-media-preview"
                          >
                            {mediaUploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                            Upload
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowCreateImageDialog(true)}
                            data-testid="btn-create-image-preview"
                          >
                            <Image className="w-4 h-4 mr-1" />
                            Create Image
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setVideoPromptText("");
                              setVideoGenStep("idle");
                              setGeneratedVideoUrl(null);
                              setShowCreateVideoDialog(true);
                            }}
                            data-testid="btn-create-video-preview"
                          >
                            <Video className="w-4 h-4 mr-1" />
                            Create Video
                          </Button>
                          {businessType === "real_estate" && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowMlsDialog(true)}
                              data-testid="btn-upload-mls-preview"
                            >
                              <Building2 className="w-4 h-4 mr-1" />
                              From MLS
                            </Button>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">or paste URL below</span>
                        <Input
                          id="media-url-input"
                          value={editImageUrl}
                          onChange={(e) => setEditImageUrl(e.target.value)}
                          placeholder="https://example.com/media.jpg"
                          data-testid="input-media-url"
                        />
                        {editImageUrl && (
                          <div className="flex items-center gap-2">
                            {/\.(mp4|mov|webm|avi)$/i.test(editImageUrl) ? (
                              <video src={editImageUrl} className="h-16 w-16 object-cover rounded" muted data-testid="preview-media-video" />
                            ) : (
                              <img src={editImageUrl} alt="Media preview" className="h-16 w-16 object-cover rounded" data-testid="preview-media-image" />
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditImageUrl("")}
                              data-testid="btn-remove-media-preview"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground" data-testid="text-media-hint">
                          {previewContent.platform?.toLowerCase() === "tiktok"
                            ? "TikTok requires a video URL to publish"
                            : previewContent.platform?.toLowerCase() === "instagram"
                            ? "Instagram requires an image or video to publish"
                            : "Optional: attach an image to your post"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            const updatedMetadata = {
                              ...previewContent.metadata,
                              imageUrl: editImageUrl || undefined
                            };
                            updatePostMutation.mutate({
                              id: previewContent.originalId,
                              content: editContent,
                              metadata: updatedMetadata,
                            });
                            setEditingPost(null);
                            if (previewContent) {
                              setPreviewContent({
                                ...previewContent,
                                content: editContent,
                                photoUrl: editImageUrl || previewContent.photoUrl,
                              });
                            }
                          }}
                          disabled={updatePostMutation.isPending}
                          className="flex-1"
                          data-testid="btn-save-edit-preview"
                        >
                          {updatePostMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingPost(null)}
                          data-testid="btn-cancel-edit-preview"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm whitespace-pre-wrap">{previewContent.content}</p>
                    </div>
                  )}
                  {(() => {
                    const contentToCheck = editingPost?.id === previewContent.originalId ? editContent : previewContent.content;
                    const platform = previewContent.platform?.toLowerCase() || "";
                    const limit = platformLimits[platform] || { optimal: 500, max: 2000 };
                    const charCount = contentToCheck.length;
                    const charPercent = Math.min((charCount / limit.max) * 100, 100);
                    const charColor = charCount <= limit.optimal ? "bg-green-500" : charCount <= limit.max ? "bg-yellow-500" : "bg-red-500";
                    const compliance = checkCompliance(contentToCheck);
                    return (
                      <div className="flex items-center gap-4" data-testid="preview-compliance-info">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">{charCount}/{limit.max}</span>
                          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full ${charColor}`} style={{ width: `${charPercent}%` }} />
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {compliance.status === 'compliant' && (
                            <Badge variant="outline" className="text-green-600 border-green-600" data-testid="badge-compliant-preview">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Compliant
                            </Badge>
                          )}
                          {compliance.status === 'warning' && (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-600" data-testid="badge-warning-preview">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {compliance.issues[0]}
                            </Badge>
                          )}
                          {compliance.status === 'error' && (
                            <Badge variant="outline" className="text-red-600 border-red-600" data-testid="badge-error-preview">
                              <XCircle className="w-3 h-3 mr-1" />
                              {compliance.issues[0]}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  {previewContent.photoUrl && (
                    /\.(mp4|mov|webm|avi)$/i.test(previewContent.photoUrl) ? (
                      <video src={previewContent.photoUrl} controls className="w-full rounded-lg" data-testid="video-post-media" />
                    ) : (
                      <img src={previewContent.photoUrl} alt="Post media" className="w-full rounded-lg" data-testid="img-post-media" />
                    )
                  )}
                  {previewContent.platform?.toLowerCase() === "tiktok" && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg" data-testid="info-tiktok-note">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          TikTok only supports video posts. Add a video URL above to enable auto-publishing. Without a video, this post will need to be published manually.
                        </p>
                      </div>
                    </div>
                  )}
                  {previewContent.platform?.toLowerCase() === "instagram" && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg" data-testid="info-instagram-note">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          Instagram requires a Business/Creator Account and an image or video. Add media above to enable auto-publishing.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {previewContent.status !== "approved" && previewContent.status !== "posted" && (
                      <Button
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => {
                          updatePostMutation.mutate({ id: previewContent.originalId, content: previewContent.content, metadata: { approved: true } });
                          apiRequest("PUT", `/api/scheduled-posts/${previewContent.originalId}`, { status: "approved" }).then(() => {
                            queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
                            setPreviewContent({ ...previewContent, status: "approved" });
                            toast({ title: "Post Approved", description: "This post will be published at its scheduled time." });
                          });
                        }}
                        data-testid="btn-approve-post"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                    )}
                    {editingPost?.id !== previewContent.originalId && (
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          const post = apiScheduledPosts.find(p => p.id === previewContent.originalId);
                          if (post) {
                            setEditingPost(post);
                            setEditContent(post.content);
                            setEditImageUrl((post.metadata as any)?.imageUrl || "");
                          }
                        }}
                        data-testid="btn-edit-post-preview"
                      >
                        <Edit2 className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => {
                        deletePostMutation.mutate(previewContent.originalId);
                      }}
                      disabled={deletePostMutation.isPending}
                      data-testid="btn-delete-post-preview"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateImageDialog} onOpenChange={setShowCreateImageDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create AI Image</DialogTitle>
          </DialogHeader>
          <ImagePicker
            onSelect={(imageUrl) => {
              if (imageUrl) {
                setEditImageUrl(imageUrl);
                setShowCreateImageDialog(false);
                toast({ title: "Image Attached", description: "AI-generated image has been attached to your post." });
              }
            }}
            platform={previewContent?.platform?.toLowerCase()}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateVideoDialog} onOpenChange={(open) => {
        if (!open && videoGenStep !== "idle" && videoGenStep !== "done") {
          return;
        }
        setShowCreateVideoDialog(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create AI Video</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">AI Platform</Label>
              <Select value={videoPlatform} onValueChange={(v) => setVideoPlatform(v as "veo" | "sora2" | "luma" | "runway")} disabled={videoGenStep !== "idle" && videoGenStep !== "done"}>
                <SelectTrigger data-testid="select-video-platform-preview">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="veo">VEO 3.1</SelectItem>
                  <SelectItem value="sora2">Sora 2</SelectItem>
                  <SelectItem value="luma">Luma Ray 2</SelectItem>
                  <SelectItem value="runway">Runway Gen-4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Describe your video</Label>
              <Textarea
                value={videoPromptText}
                onChange={(e) => setVideoPromptText(e.target.value)}
                placeholder="E.g., A cinematic aerial shot of a luxury home with a pool at sunset..."
                className="min-h-[80px] text-sm"
                disabled={videoGenStep !== "idle" && videoGenStep !== "done"}
                data-testid="textarea-video-prompt-preview"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Aspect Ratio</Label>
              <Select value={videoAspect} onValueChange={setVideoAspect} disabled={videoGenStep !== "idle" && videoGenStep !== "done"}>
                <SelectTrigger data-testid="select-video-aspect-preview">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">Landscape (16:9)</SelectItem>
                  <SelectItem value="9:16">Portrait (9:16)</SelectItem>
                  <SelectItem value="1:1">Square (1:1)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Reference Image (optional)</Label>
              <p className="text-xs text-muted-foreground">Upload an image to use as the starting frame for the video</p>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={videoRefFileInputRef}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setVideoRefImageUploading(true);
                  try {
                    const formData = new FormData();
                    formData.append("file", file);
                    const res = await fetch("/api/upload-reference", {
                      method: "POST",
                      credentials: "include",
                      body: formData,
                    });
                    if (!res.ok) throw new Error("Upload failed");
                    const data = await res.json();
                    if (data.url) {
                      setVideoRefImageUrl(data.url);
                    }
                  } catch {
                    toast({ title: "Upload Failed", description: "Could not upload reference image.", variant: "destructive" });
                  } finally {
                    setVideoRefImageUploading(false);
                    if (videoRefFileInputRef.current) videoRefFileInputRef.current.value = "";
                  }
                }}
                data-testid="input-video-ref-image-file"
              />
              {videoRefImageUrl ? (
                <div className="flex items-center gap-2">
                  <img src={videoRefImageUrl} alt="Reference" className="h-16 w-16 object-cover rounded" data-testid="img-video-ref-preview" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setVideoRefImageUrl(null)}
                    disabled={videoGenStep !== "idle" && videoGenStep !== "done"}
                    data-testid="btn-remove-video-ref-image"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => videoRefFileInputRef.current?.click()}
                      disabled={(videoGenStep !== "idle" && videoGenStep !== "done") || videoRefImageUploading}
                      data-testid="btn-upload-video-ref-image"
                    >
                      {videoRefImageUploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
                      Upload Image
                    </Button>
                    <span className="text-xs text-muted-foreground self-center">or</span>
                  </div>
                  <Input
                    placeholder="Paste image URL..."
                    disabled={videoGenStep !== "idle" && videoGenStep !== "done"}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val && /^https?:\/\/.+/i.test(val)) {
                          setVideoRefImageUrl(val);
                          (e.target as HTMLInputElement).value = "";
                        } else if (val) {
                          toast({ title: "Invalid URL", description: "Please enter a valid image URL starting with http:// or https://", variant: "destructive" });
                        }
                      }
                    }}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val && /^https?:\/\/.+/i.test(val)) {
                        setVideoRefImageUrl(val);
                        e.target.value = "";
                      }
                    }}
                    data-testid="input-video-ref-image-url"
                  />
                </div>
              )}
            </div>

            {videoGenStep !== "idle" && videoGenStep !== "done" && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {videoGenStep === "generating-image" && "Generating base image..."}
                    {videoGenStep === "generating-video" && `Starting video generation with ${
                      videoPlatform === "veo" ? "VEO 3.1" : videoPlatform === "sora2" ? "Sora 2" : videoPlatform === "luma" ? "Luma Ray 2" : "Runway Gen-4"
                    }...`}
                    {videoGenStep === "polling" && "Video is rendering... This may take a few minutes."}
                  </p>
                </div>
              </div>
            )}

            {generatedVideoUrl && videoGenStep === "done" && (
              <div className="space-y-2">
                <video src={generatedVideoUrl} controls className="w-full rounded-lg" data-testid="video-preview-result" />
              </div>
            )}

            <div className="flex gap-2">
              {videoGenStep === "idle" && (
                <Button
                  className="flex-1"
                  onClick={async () => {
                    if (!videoPromptText.trim()) {
                      toast({ title: "Prompt Required", description: "Please describe the video you want to create.", variant: "destructive" });
                      return;
                    }
                    videoMountedRef.current = true;
                    try {
                      setGeneratedVideoUrl(null);

                      if (videoPlatform === "veo") {
                        let veoImageUrl = videoRefImageUrl;
                        if (!veoImageUrl) {
                          setVideoGenStep("generating-image");
                          const imageResponse = await apiRequest("POST", "/api/images/generate", {
                            prompt: videoPromptText,
                            aspectRatio: videoAspect,
                            style: "photorealistic",
                          });
                          const imageData = await imageResponse.json();
                          if (!imageData.imageUrl) throw new Error("Failed to generate image");
                          veoImageUrl = imageData.imageUrl;
                        }
                        setVideoGenStep("generating-video");
                        const presetMap: Record<string, string> = { "9:16": "tiktok", "16:9": "facebook-feed", "1:1": "facebook-feed" };
                        const veoResponse = await apiRequest("POST", "/api/ai/veo/start", {
                          imageUrl: veoImageUrl,
                          preset: presetMap[videoAspect] || "facebook-feed",
                          prompt: videoPromptText,
                          noSound: true,
                        });
                        const veoData = await veoResponse.json();
                        if (!veoData.operationId) throw new Error("Failed to start video generation");
                        setVideoGenStep("polling");
                        const videoUrl = await new Promise<string>((resolve, reject) => {
                          let pollCount = 0;
                          const maxPolls = 36;
                          const interval = setInterval(async () => {
                            if (!videoMountedRef.current) { clearInterval(interval); reject(new Error("Cancelled")); return; }
                            pollCount++;
                            if (pollCount > maxPolls) { clearInterval(interval); reject(new Error("Video generation timed out.")); return; }
                            try {
                              const statusRes = await fetch(`/api/ai/veo/status/${veoData.operationId}`, { credentials: "include" });
                              if (!statusRes.ok) { clearInterval(interval); reject(new Error("Status check failed")); return; }
                              const statusData = await statusRes.json();
                              if (statusData.error) { clearInterval(interval); reject(new Error(statusData.error)); return; }
                              if (statusData.done && statusData.videoUrl) { clearInterval(interval); resolve(statusData.videoUrl); }
                            } catch (err: unknown) { clearInterval(interval); reject(new Error(err instanceof Error ? err.message : "Status check failed")); }
                          }, 5000);
                        });
                        if (!videoMountedRef.current) return;
                        setGeneratedVideoUrl(videoUrl);
                      } else if (videoPlatform === "sora2") {
                        setVideoGenStep("generating-video");
                        const aspectMap: Record<string, string> = { "16:9": "landscape", "9:16": "portrait", "1:1": "square" };
                        const sora2Body: Record<string, unknown> = {
                          prompt: videoPromptText,
                          aspectRatio: aspectMap[videoAspect] || "landscape",
                        };
                        if (videoRefImageUrl) {
                          sora2Body.imageUrls = [videoRefImageUrl];
                        }
                        const createRes = await apiRequest("POST", "/api/sora2/create-video", sora2Body);
                        const createData = await createRes.json();
                        if (!createData.taskId) throw new Error("Failed to start Sora 2 video");
                        setVideoGenStep("polling");
                        const videoUrl = await new Promise<string>((resolve, reject) => {
                          let pollCount = 0;
                          const maxPolls = 60;
                          const interval = setInterval(async () => {
                            if (!videoMountedRef.current) { clearInterval(interval); reject(new Error("Cancelled")); return; }
                            pollCount++;
                            if (pollCount > maxPolls) { clearInterval(interval); reject(new Error("Video generation timed out.")); return; }
                            try {
                              const statusRes = await fetch(`/api/sora2/status/${createData.taskId}`, { credentials: "include" });
                              if (!statusRes.ok) { clearInterval(interval); reject(new Error("Status check failed")); return; }
                              const statusData = await statusRes.json();
                              if (statusData.status === "failed") { clearInterval(interval); reject(new Error(statusData.error || "Video generation failed")); return; }
                              if (statusData.status === "completed" && statusData.videoUrl) { clearInterval(interval); resolve(statusData.videoUrl); }
                            } catch (err: unknown) { clearInterval(interval); reject(new Error(err instanceof Error ? err.message : "Status check failed")); }
                          }, 5000);
                        });
                        if (!videoMountedRef.current) return;
                        setGeneratedVideoUrl(videoUrl);
                      } else if (videoPlatform === "luma") {
                        setVideoGenStep("generating-video");
                        const lumaAspectMap: Record<string, string> = { "16:9": "16:9", "9:16": "9:16", "1:1": "1:1" };
                        const lumaBody: Record<string, unknown> = {
                          prompt: videoPromptText,
                          model: "ray-2",
                          aspectRatio: lumaAspectMap[videoAspect] || "16:9",
                          duration: 5,
                        };
                        if (videoRefImageUrl) {
                          lumaBody.keyframeImageUrl = videoRefImageUrl;
                        }
                        const createRes = await apiRequest("POST", "/api/luma/create-video", lumaBody);
                        const createData = await createRes.json();
                        if (!createData.taskId) throw new Error("Failed to start Luma video");
                        setVideoGenStep("polling");
                        const videoUrl = await new Promise<string>((resolve, reject) => {
                          let pollCount = 0;
                          const maxPolls = 60;
                          const interval = setInterval(async () => {
                            if (!videoMountedRef.current) { clearInterval(interval); reject(new Error("Cancelled")); return; }
                            pollCount++;
                            if (pollCount > maxPolls) { clearInterval(interval); reject(new Error("Video generation timed out.")); return; }
                            try {
                              const statusRes = await fetch(`/api/luma/status/${createData.taskId}`, { credentials: "include" });
                              if (!statusRes.ok) { clearInterval(interval); reject(new Error("Status check failed")); return; }
                              const statusData = await statusRes.json();
                              if (statusData.status === "failed") { clearInterval(interval); reject(new Error(statusData.error || "Video generation failed")); return; }
                              if (statusData.status === "completed" && statusData.videoUrl) { clearInterval(interval); resolve(statusData.videoUrl); }
                            } catch (err: unknown) { clearInterval(interval); reject(new Error(err instanceof Error ? err.message : "Status check failed")); }
                          }, 5000);
                        });
                        if (!videoMountedRef.current) return;
                        setGeneratedVideoUrl(videoUrl);
                      } else if (videoPlatform === "runway") {
                        setVideoGenStep("generating-video");
                        const runwayRatioMap: Record<string, string> = { "16:9": "1280:720", "9:16": "720:1280", "1:1": "720:720" };
                        const runwayBody: Record<string, unknown> = {
                          promptText: videoPromptText,
                          ratio: runwayRatioMap[videoAspect] || "1280:720",
                          duration: 5,
                        };
                        if (videoRefImageUrl) {
                          runwayBody.mode = "image-to-video";
                          runwayBody.model = "gen4_turbo";
                          runwayBody.promptImage = videoRefImageUrl;
                        } else {
                          runwayBody.mode = "text-to-video";
                          runwayBody.model = "gen4.5";
                        }
                        const createRes = await apiRequest("POST", "/api/runway/create-video", runwayBody);
                        const createData = await createRes.json();
                        if (!createData.taskId) throw new Error("Failed to start Runway video");
                        setVideoGenStep("polling");
                        const videoUrl = await new Promise<string>((resolve, reject) => {
                          let pollCount = 0;
                          const maxPolls = 60;
                          const interval = setInterval(async () => {
                            if (!videoMountedRef.current) { clearInterval(interval); reject(new Error("Cancelled")); return; }
                            pollCount++;
                            if (pollCount > maxPolls) { clearInterval(interval); reject(new Error("Video generation timed out.")); return; }
                            try {
                              const statusRes = await fetch(`/api/runway/status/${createData.taskId}`, { credentials: "include" });
                              if (!statusRes.ok) { clearInterval(interval); reject(new Error("Status check failed")); return; }
                              const statusData = await statusRes.json();
                              if (statusData.status === "failed") { clearInterval(interval); reject(new Error(statusData.error || "Video generation failed")); return; }
                              if (statusData.status === "completed" && statusData.videoUrl) { clearInterval(interval); resolve(statusData.videoUrl); }
                            } catch (err: unknown) { clearInterval(interval); reject(new Error(err instanceof Error ? err.message : "Status check failed")); }
                          }, 5000);
                        });
                        if (!videoMountedRef.current) return;
                        setGeneratedVideoUrl(videoUrl);
                      }

                      setVideoGenStep("done");
                      toast({ title: "Video Generated!", description: "Your video is ready. Click 'Use This Video' to attach it." });
                    } catch (error: unknown) {
                      if (videoMountedRef.current) {
                        setVideoGenStep("idle");
                        toast({ title: "Video Generation Failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
                      }
                    }
                  }}
                  data-testid="btn-generate-video-preview"
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  Generate Video
                </Button>
              )}
              {videoGenStep === "done" && generatedVideoUrl && (
                <Button
                  className="flex-1"
                  onClick={() => {
                    setEditImageUrl(generatedVideoUrl);
                    setShowCreateVideoDialog(false);
                    setVideoGenStep("idle");
                    toast({ title: "Video Attached", description: "AI-generated video has been attached to your post." });
                  }}
                  data-testid="btn-use-video-preview"
                >
                  <Check className="w-4 h-4 mr-1" />
                  Use This Video
                </Button>
              )}
              {(videoGenStep !== "idle") && videoGenStep !== "done" && (
                <Button
                  variant="outline"
                  onClick={() => {
                    videoMountedRef.current = false;
                    setVideoGenStep("idle");
                    setGeneratedVideoUrl(null);
                  }}
                  data-testid="btn-cancel-video-generation"
                >
                  Cancel
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  videoMountedRef.current = false;
                  setShowCreateVideoDialog(false);
                  setVideoGenStep("idle");
                }}
                data-testid="btn-close-video-dialog"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showMlsDialog} onOpenChange={(open) => {
        setShowMlsDialog(open);
        if (!open) { setMlsSelectedProperty(null); setMlsPhotos([]); }
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mlsSelectedProperty ? "Select a Photo" : "Find Property from MLS"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!mlsSelectedProperty ? (
              <PropertySelector
                onSelectProperty={(property: Property) => {
                  if (property.photoUrls && property.photoUrls.length > 0) {
                    setMlsSelectedProperty(property);
                    setMlsPhotos(property.photoUrls);
                  } else {
                    toast({ title: "No Photos", description: "This property has no photos available.", variant: "destructive" });
                  }
                }}
                selectedProperty={null}
              />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {mlsSelectedProperty.address}, {mlsSelectedProperty.city} - {mlsPhotos.length} photo{mlsPhotos.length !== 1 ? "s" : ""}
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => { setMlsSelectedProperty(null); setMlsPhotos([]); }} data-testid="btn-mls-back-to-search">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {mlsPhotos.map((url, idx) => (
                    <button
                      key={idx}
                      className="relative aspect-video rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                      onClick={() => {
                        setEditImageUrl(url);
                        setShowMlsDialog(false);
                        setMlsSelectedProperty(null);
                        setMlsPhotos([]);
                        toast({ title: "MLS Photo Attached", description: "Property photo has been attached to your post." });
                      }}
                      data-testid={`btn-mls-photo-${idx}`}
                    >
                      <img src={url} alt={`Property photo ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

        </div>
      </main>
    </div>
  );
}
