import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useBusinessType } from "@/lib/businessContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Send,
  Loader2,
  MessageSquare,
  FileText,
  Home,
  Image,
  Video,
  Sparkles,
  User,
  Bot,
  Paperclip,
  X,
  ArrowLeft,
  Upload,
  History,
  Plus,
  Trash2,
  ChevronLeft,
  Download,
  AlertTriangle,
  Scissors,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAuthToken } from "@/lib/authToken";

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface Attachment {
  url: string;
  type: string;
  name: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
  videoUrl?: string;
  imageUrl?: string;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  starterPrompt: string;
}

const quickActions: QuickAction[] = [
  {
    id: "social-post",
    label: "Social Post",
    icon: <MessageSquare className="h-4 w-4" />,
    starterPrompt: "Create an engaging social media post for ",
  },
  {
    id: "blog-article",
    label: "Blog Article",
    icon: <FileText className="h-4 w-4" />,
    starterPrompt: "Write a blog article about ",
  },
  {
    id: "property-description",
    label: "Property Description",
    icon: <Home className="h-4 w-4" />,
    starterPrompt: "Generate a compelling property description for a ",
  },
  {
    id: "generate-image",
    label: "Generate Image",
    icon: <Image className="h-4 w-4" />,
    starterPrompt: "Create an image of ",
  },
  {
    id: "generate-video",
    label: "Generate Video",
    icon: <Video className="h-4 w-4" />,
    starterPrompt: "Create a video script for ",
  },
  {
    id: "video-edit",
    label: "Video Edit",
    icon: <Scissors className="h-4 w-4" />,
    starterPrompt: "",
  },
];

const videoPresets = [
  { value: "tiktok", label: "TikTok/Reels (8s, Portrait)" },
  { value: "youtube-shorts", label: "YouTube Shorts (8s, Portrait)" },
  { value: "instagram-stories", label: "Instagram Stories (8s, Portrait)" },
  { value: "facebook-feed", label: "Facebook Feed (8s, Landscape)" },
  { value: "linkedin-feed", label: "LinkedIn Feed (8s, Landscape)" },
  { value: "commercial-15", label: "Commercial Spot (4s, Landscape)" },
  { value: "commercial-30", label: "Commercial Spot (8s, Landscape)" },
  { value: "tour-16s", label: "Extended Tour (16s, Landscape)" },
  { value: "tour-24s", label: "Long Tour (24s, Landscape)" },
  { value: "tour-30s", label: "Full Tour (30s, Landscape)" },
  { value: "reel-16s", label: "Extended Reel (16s, Portrait)" },
  { value: "reel-30s", label: "Full Reel (30s, Portrait)" },
];

const spaceTypes = [
  { value: "interior", label: "Interior Rooms" },
  { value: "exterior", label: "Exterior Spaces" },
];

const interiorRoomTypes = [
  { value: "living-room", label: "Living Room", prompt: "spacious living room with elegant furnishings" },
  { value: "kitchen", label: "Kitchen", prompt: "modern kitchen with premium appliances and countertops" },
  { value: "master-bedroom", label: "Master Bedroom", prompt: "luxurious master bedroom with ample natural light" },
  { value: "bedroom", label: "Bedroom", prompt: "comfortable bedroom with quality finishes" },
  { value: "bathroom", label: "Bathroom", prompt: "updated bathroom with contemporary fixtures" },
  { value: "master-bath", label: "Master Bath", prompt: "spa-like master bathroom with upscale finishes" },
  { value: "dining-room", label: "Dining Room", prompt: "elegant dining room perfect for entertaining" },
  { value: "office", label: "Home Office", prompt: "functional home office with natural lighting" },
  { value: "basement", label: "Basement", prompt: "finished basement with versatile living space" },
  { value: "laundry", label: "Laundry Room", prompt: "convenient laundry room with modern appliances" },
  { value: "garage", label: "Garage", prompt: "spacious garage with ample storage" },
  { value: "other", label: "Other Room", prompt: "beautifully finished interior space" },
];

const exteriorRoomTypes = [
  { value: "front-yard", label: "Front Yard / Curb Appeal", prompt: "stunning curb appeal with manicured landscaping" },
  { value: "backyard", label: "Backyard", prompt: "private backyard oasis perfect for outdoor living" },
  { value: "patio", label: "Patio / Deck", prompt: "inviting outdoor patio ideal for entertaining" },
  { value: "pool", label: "Pool Area", prompt: "sparkling pool with resort-style amenities" },
  { value: "garden", label: "Garden / Landscaping", prompt: "professionally designed landscaping and garden" },
  { value: "driveway", label: "Driveway / Entrance", prompt: "welcoming entrance with elegant driveway" },
  { value: "aerial", label: "Aerial / Lot View", prompt: "expansive property showcasing the full lot" },
  { value: "other-exterior", label: "Other Exterior", prompt: "impressive outdoor feature" },
];

const VIDEO_PANEL_BY_BUSINESS: Record<string, {
  spaceTypeLabel: string;
  imagesLabel: string;
  imageTypeLabel: string;
  descPlaceholder: string;
  interiorLabel: string;
  exteriorLabel: string;
  interiorTypes: typeof interiorRoomTypes;
  exteriorTypes: typeof exteriorRoomTypes;
}> = {
  restaurant: {
    spaceTypeLabel: "Area Type",
    imagesLabel: "Restaurant Photos",
    imageTypeLabel: "Area",
    descPlaceholder: "Add notes about this scene, like 'Our main dining room decorated for a special event, warm lighting, intimate atmosphere...'",
    interiorLabel: "Indoor Areas",
    exteriorLabel: "Outdoor Areas",
    interiorTypes: [
      { value: "dining-area", label: "Dining Room", prompt: "elegant dining area with beautifully set tables and warm ambiance" },
      { value: "bar-lounge", label: "Bar / Lounge", prompt: "stylish bar and lounge area with premium spirits display" },
      { value: "open-kitchen", label: "Open Kitchen", prompt: "bustling open kitchen showcasing culinary craftsmanship" },
      { value: "private-dining", label: "Private Dining", prompt: "intimate private dining room perfect for special occasions" },
      { value: "dessert-station", label: "Dessert Station", prompt: "inviting dessert display with artisan sweets" },
      { value: "counter", label: "Counter / Service Area", prompt: "welcoming service counter with attentive staff" },
      { value: "waiting-area", label: "Waiting Area / Entrance", prompt: "welcoming entrance and waiting area" },
      { value: "other-indoor", label: "Other Indoor Area", prompt: "beautifully appointed interior space" },
    ],
    exteriorTypes: [
      { value: "patio-terrace", label: "Patio / Terrace", prompt: "charming outdoor patio dining area" },
      { value: "storefront", label: "Entrance / Storefront", prompt: "inviting restaurant entrance and storefront" },
      { value: "outdoor-seating", label: "Outdoor Seating", prompt: "relaxing outdoor seating area" },
      { value: "rooftop", label: "Rooftop", prompt: "stunning rooftop dining experience" },
      { value: "other-exterior", label: "Other Outdoor Area", prompt: "charming outdoor space" },
    ],
  },
  home_services: {
    spaceTypeLabel: "Location Type",
    imagesLabel: "Job Site Photos",
    imageTypeLabel: "Area",
    descPlaceholder: "Add notes about this job, like 'Kitchen remodel with custom cabinetry and quartz countertops...'",
    interiorLabel: "Interior Areas",
    exteriorLabel: "Exterior Areas",
    interiorTypes: [
      { value: "kitchen", label: "Kitchen", prompt: "professionally renovated kitchen with quality finishes" },
      { value: "bathroom", label: "Bathroom", prompt: "beautifully updated bathroom with modern fixtures" },
      { value: "living-room", label: "Living Room", prompt: "refreshed living space with professional workmanship" },
      { value: "bedroom", label: "Bedroom", prompt: "comfortable bedroom with expert finishing" },
      { value: "basement", label: "Basement", prompt: "transformed basement space" },
      { value: "other", label: "Other Interior", prompt: "professionally finished interior space" },
    ],
    exteriorTypes: [
      { value: "roof", label: "Roof", prompt: "newly installed or repaired roof" },
      { value: "siding", label: "Siding / Exterior", prompt: "refreshed exterior with quality siding" },
      { value: "landscaping", label: "Landscaping", prompt: "professionally manicured landscaping" },
      { value: "driveway", label: "Driveway", prompt: "newly paved or repaired driveway" },
      { value: "other-exterior", label: "Other Exterior", prompt: "expertly completed exterior work" },
    ],
  },
  retail: {
    spaceTypeLabel: "Area Type",
    imagesLabel: "Store Photos",
    imageTypeLabel: "Area",
    descPlaceholder: "Add notes about this scene, like 'Our new summer collection display near the front entrance...'",
    interiorLabel: "Indoor Areas",
    exteriorLabel: "Outdoor Areas",
    interiorTypes: [
      { value: "sales-floor", label: "Sales Floor", prompt: "inviting sales floor with attractive product displays" },
      { value: "display", label: "Feature Display", prompt: "eye-catching feature display showcasing top products" },
      { value: "fitting-room", label: "Fitting Room", prompt: "comfortable and stylish fitting rooms" },
      { value: "counter", label: "Checkout / Counter", prompt: "efficient checkout area with friendly service" },
      { value: "window-display", label: "Window Display", prompt: "captivating window display" },
      { value: "other", label: "Other Area", prompt: "well-merchandised store area" },
    ],
    exteriorTypes: [
      { value: "storefront", label: "Storefront / Entrance", prompt: "welcoming storefront and entrance" },
      { value: "signage", label: "Signage", prompt: "prominent and attractive store signage" },
      { value: "outdoor-display", label: "Outdoor Display", prompt: "eye-catching outdoor product display" },
      { value: "other-exterior", label: "Other Exterior", prompt: "attractive exterior area" },
    ],
  },
  professional_services: {
    spaceTypeLabel: "Space Type",
    imagesLabel: "Office Photos",
    imageTypeLabel: "Space",
    descPlaceholder: "Add notes about this space, like 'Our main conference room with video conferencing setup...'",
    interiorLabel: "Office Areas",
    exteriorLabel: "Exterior",
    interiorTypes: [
      { value: "reception", label: "Reception", prompt: "welcoming reception area with professional atmosphere" },
      { value: "office", label: "Private Office", prompt: "well-appointed private office space" },
      { value: "conference", label: "Conference Room", prompt: "modern conference room for client meetings" },
      { value: "waiting", label: "Waiting Area", prompt: "comfortable waiting area" },
      { value: "workspace", label: "Open Workspace", prompt: "collaborative open workspace" },
      { value: "other", label: "Other Space", prompt: "professional office environment" },
    ],
    exteriorTypes: [
      { value: "building", label: "Building / Exterior", prompt: "professional office building exterior" },
      { value: "entrance", label: "Entrance", prompt: "welcoming building entrance" },
      { value: "other-exterior", label: "Other", prompt: "professional exterior" },
    ],
  },
  real_estate: {
    spaceTypeLabel: "Space Type",
    imagesLabel: "Property Images",
    imageTypeLabel: "Room",
    descPlaceholder: "Add notes about this property, like '4BR/3BA with updated kitchen, open concept living area...' This will be included in the video generation.",
    interiorLabel: "Interior Rooms",
    exteriorLabel: "Exterior Spaces",
    interiorTypes: interiorRoomTypes,
    exteriorTypes: exteriorRoomTypes,
  },
  general: {
    spaceTypeLabel: "Area Type",
    imagesLabel: "Business Photos",
    imageTypeLabel: "Area",
    descPlaceholder: "Add notes about this scene, like 'Our main workspace during a busy day...'",
    interiorLabel: "Indoor Areas",
    exteriorLabel: "Outdoor Areas",
    interiorTypes: [
      { value: "main-area", label: "Main Area", prompt: "well-organized main business area" },
      { value: "workspace", label: "Workspace", prompt: "productive workspace environment" },
      { value: "meeting", label: "Meeting Space", prompt: "professional meeting or collaboration space" },
      { value: "other", label: "Other Indoor", prompt: "professional indoor space" },
    ],
    exteriorTypes: [
      { value: "exterior", label: "Exterior / Entrance", prompt: "inviting business exterior" },
      { value: "other-exterior", label: "Other Outdoor", prompt: "business outdoor area" },
    ],
  },
};

interface AIAssistantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIAssistantDialog({ open, onOpenChange }: AIAssistantDialogProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [aiProvider, setAiProvider] = useState<"auto" | "openai" | "gemini">("auto");
  const [videoMode, setVideoMode] = useState(false);
  const [assistantVideoPlatform, setAssistantVideoPlatform] = useState<"veo" | "sora2" | "luma" | "runway">("veo");
  const [sora2Prompt, setSora2Prompt] = useState("");
  const [sora2TaskId, setSora2TaskId] = useState<string | null>(null);
  const [sora2Status, setSora2Status] = useState<"idle" | "pending" | "processing" | "completed" | "failed">("idle");
  const [sora2VideoUrl, setSora2VideoUrl] = useState<string | null>(null);
  const sora2PollRef = useRef<NodeJS.Timeout | null>(null);
  const sora2StartTimeRef = useRef<number | null>(null);
  const [sora2Elapsed, setSora2Elapsed] = useState(0);
  const sora2ElapsedRef = useRef<NodeJS.Timeout | null>(null);
  const [sora2Images, setSora2Images] = useState<Array<{ url: string; preview: string }>>([]);
  const [sora2ImageUploading, setSora2ImageUploading] = useState(false);
  const [videoPreset, setVideoPreset] = useState<string>("tiktok");
  const [spaceType, setSpaceType] = useState<"interior" | "exterior" | "none">("interior");
  const [customDescription, setCustomDescription] = useState("");
  const [noSound, setNoSound] = useState(false);
  const [videoImages, setVideoImages] = useState<Array<{ url: string; preview: string; roomType: string }>>([]);
  const [videoGenerating, setVideoGenerating] = useState(false);
  const [videoOperationId, setVideoOperationId] = useState<string | null>(null);
  const [includeAgentPhoto, setIncludeAgentPhoto] = useState(false);
  const [agentPhotoUrl, setAgentPhotoUrl] = useState<string | null>(null);
  const [videoImageUploading, setVideoImageUploading] = useState(false);
  const [completedVideos, setCompletedVideos] = useState<Array<{ url: string; roomType: string; label: string }>>([]);
  const [combiningVideos, setCombiningVideos] = useState(false);
  const pendingVideoDataRef = useRef<Map<string, { label: string; spaceType: string }>>(new Map());
  const [lumaPrompt, setLumaPrompt] = useState("");
  const [lumaTaskId, setLumaTaskId] = useState<string | null>(null);
  const [lumaStatus, setLumaStatus] = useState<"idle" | "pending" | "processing" | "completed" | "failed">("idle");
  const [lumaVideoUrl, setLumaVideoUrl] = useState<string | null>(null);
  const lumaPollRef = useRef<NodeJS.Timeout | null>(null);
  const lumaStartTimeRef = useRef<number | null>(null);
  const [lumaElapsed, setLumaElapsed] = useState(0);
  const lumaElapsedRef = useRef<NodeJS.Timeout | null>(null);
  const [lumaImages, setLumaImages] = useState<Array<{ url: string; preview: string }>>([]);
  const [lumaImageUploading, setLumaImageUploading] = useState(false);
  const [lumaModel, setLumaModel] = useState<"ray-2" | "ray-flash-2">("ray-2");
  const [lumaAspectRatio, setLumaAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [lumaDuration, setLumaDuration] = useState<string>("5s");
  const [lumaLoop, setLumaLoop] = useState(false);
  const lumaImageInputRef = useRef<HTMLInputElement>(null);
  const [runwayPrompt, setRunwayPrompt] = useState("");
  const [runwayTaskId, setRunwayTaskId] = useState<string | null>(null);
  const [runwayStatus, setRunwayStatus] = useState<"idle" | "pending" | "processing" | "completed" | "failed">("idle");
  const [runwayVideoUrl, setRunwayVideoUrl] = useState<string | null>(null);
  const runwayPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [runwayElapsed, setRunwayElapsed] = useState(0);
  const runwayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [runwaySourceVideo, setRunwaySourceVideo] = useState<{ url: string; preview: string } | null>(null);
  const [runwaySourceUploading, setRunwaySourceUploading] = useState(false);
  const [runwayRefImage, setRunwayRefImage] = useState<{ url: string; preview: string } | null>(null);
  const [runwayRefUploading, setRunwayRefUploading] = useState(false);
  const runwayVideoInputRef = useRef<HTMLInputElement>(null);
  const runwayRefInputRef = useRef<HTMLInputElement>(null);
  const [runwayTotalDuration, setRunwayTotalDuration] = useState<number>(10);
  const [runwayClipDuration, setRunwayClipDuration] = useState<number>(10);
  const [runwayBatchId, setRunwayBatchId] = useState<string | null>(null);
  const [runwayBatchProgress, setRunwayBatchProgress] = useState<{ completed: number; total: number } | null>(null);
  const [videoEditMode, setVideoEditMode] = useState(false);
  const [userVideos, setUserVideos] = useState<Array<{ id: number; title: string; videoUrl: string; thumbnailUrl?: string | null; createdAt: string }>>([]);
  const [userVideosLoading, setUserVideosLoading] = useState(false);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<number>>(new Set());
  const [stitchingVideos, setStitchingVideos] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const videoUploadInputRef = useRef<HTMLInputElement>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoImageInputRef = useRef<HTMLInputElement>(null);
  const sora2ImageInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { businessType } = useBusinessType();
  const videoPanel = useMemo(() => VIDEO_PANEL_BY_BUSINESS[businessType] ?? VIDEO_PANEL_BY_BUSINESS.real_estate, [businessType]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      const fetchAgentPhoto = async () => {
        try {
          const token = getAuthToken();
          if (!token) return;
          
          const response = await fetch("/api/user/preferences", {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.agentPhotoUrl) {
              setAgentPhotoUrl(data.agentPhotoUrl);
            }
          }
        } catch (error) {
          console.error("Error fetching agent photo:", error);
        }
      };
      fetchAgentPhoto();
    }
  }, [open]);

  const fetchSessions = useCallback(async () => {
    try {
      setSessionsLoading(true);
      const token = getAuthToken();
      
      const response = await fetch("/api/ai/chat-sessions", {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (error) {
      console.error("Error fetching chat sessions:", error);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchSessions();
    }
  }, [open, fetchSessions]);

  const createSession = useCallback(async (title: string): Promise<string | null> => {
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const response = await fetch("/api/ai/chat-sessions", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ title }),
      });
      
      if (response.ok) {
        const data = await response.json();
        fetchSessions();
        return data.id;
      }
      return null;
    } catch (error) {
      console.error("Error creating session:", error);
      return null;
    }
  }, [fetchSessions]);

  const saveSessionMessages = useCallback(async (sessionId: string, sessionMessages: Message[], title?: string) => {
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const body: { messages: Message[]; title?: string } = { messages: sessionMessages };
      if (title) body.title = title;
      
      await fetch(`/api/ai/chat-sessions/${sessionId}`, {
        method: "PATCH",
        headers,
        credentials: "include",
        body: JSON.stringify(body),
      });
      
      fetchSessions();
    } catch (error) {
      console.error("Error saving session messages:", error);
    }
  }, [fetchSessions]);

  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const token = getAuthToken();
      
      const response = await fetch(`/api/ai/chat-sessions/${sessionId}`, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        setCurrentSessionId(sessionId);
        setShowHistory(false);
      }
    } catch (error) {
      console.error("Error loading session:", error);
      toast({
        title: "Error",
        description: "Failed to load chat session.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      const token = getAuthToken();
      
      const response = await fetch(`/api/ai/chat-sessions/${sessionId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      
      if (response.ok) {
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
          setMessages([]);
        }
        fetchSessions();
        toast({
          title: "Deleted",
          description: "Chat session deleted successfully.",
        });
      }
    } catch (error) {
      console.error("Error deleting session:", error);
      toast({
        title: "Error",
        description: "Failed to delete chat session.",
        variant: "destructive",
      });
    }
  }, [currentSessionId, fetchSessions, toast]);

  const startNewChat = useCallback(() => {
    setCurrentSessionId(null);
    setMessages([]);
    setInput("");
    setShowHistory(false);
  }, []);

  const generateTitle = (message: string): string => {
    const cleaned = message.trim().slice(0, 30);
    return cleaned.length < message.trim().length ? cleaned + "..." : cleaned;
  };

  useEffect(() => {
    if (!videoOperationId || !videoGenerating) return;

    const pollInterval = setInterval(async () => {
      try {
        const token = getAuthToken();
        const headers: Record<string, string> = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(`/api/ai/veo/status/${videoOperationId}`, {
          method: "GET",
          headers,
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to check video status");
        }

        const data = await response.json();

        if (data.done && data.videoUrl) {
          clearInterval(pollInterval);
          setVideoGenerating(false);
          setVideoOperationId(null);

          // Add to completed videos for full tour compilation using operation ID
          const pendingData = videoOperationId ? pendingVideoDataRef.current.get(videoOperationId) : null;
          if (pendingData) {
            setCompletedVideos(prev => [...prev, {
              url: data.videoUrl,
              roomType: pendingData.spaceType,
              label: pendingData.label,
            }]);
            pendingVideoDataRef.current.delete(videoOperationId!);
          }

          const assistantMessage: Message = {
            role: "assistant",
            content: `Video generated successfully! Here's your ${videoPresets.find(p => p.value === videoPreset)?.label || videoPreset} video:`,
            videoUrl: data.videoUrl,
          };
          setMessages(prev => [...prev, assistantMessage]);
          toast({
            title: "Video Ready",
            description: "Your video has been generated successfully!",
          });
        } else if (data.done && data.error) {
          clearInterval(pollInterval);
          setVideoGenerating(false);
          setVideoOperationId(null);

          const errorMessage: Message = {
            role: "assistant",
            content: `Video generation failed: ${data.error || "Unknown error occurred"}`,
          };
          setMessages(prev => [...prev, errorMessage]);
          toast({
            title: "Video Generation Failed",
            description: data.error || "An error occurred while generating your video.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error polling video status:", error);
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [videoOperationId, videoGenerating, videoPreset, toast]);

  const handleQuickAction = (action: QuickAction) => {
    if (action.id === "generate-video") {
      setVideoMode(true);
      return;
    }
    if (action.id === "video-edit") {
      setVideoEditMode(true);
      fetchUserVideos();
      return;
    }
    setInput(action.starterPrompt);
    inputRef.current?.focus();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (selectedFiles.length + files.length > 5) {
      toast({
        title: "Too many files",
        description: "You can only upload up to 5 files at a time.",
        variant: "destructive",
      });
      return;
    }

    const validFiles = files.filter(file => {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds the 10MB limit.`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });

    setSelectedFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleVideoImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (videoImages.length >= 3) {
      toast({
        title: "Maximum images reached",
        description: "You can only upload up to 3 images.",
        variant: "destructive",
      });
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be under 10MB.",
        variant: "destructive",
      });
      return;
    }

    setVideoImageUploading(true);
    const previewUrl = URL.createObjectURL(file);

    try {
      const token = getAuthToken();
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/video-source', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      const defaultRoomType = spaceType === "none"
        ? "other"
        : spaceType === "interior"
        ? (videoPanel.interiorTypes[0]?.value || "living-room")
        : (videoPanel.exteriorTypes[0]?.value || "front-yard");
      setVideoImages(prev => [...prev, { url: data.url, preview: previewUrl, roomType: defaultRoomType }]);
      toast({
        title: "Image uploaded",
        description: `Image ${videoImages.length + 1} of 3 added.`,
      });
    } catch (error) {
      console.error('Video image upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
      URL.revokeObjectURL(previewUrl);
    } finally {
      setVideoImageUploading(false);
      if (videoImageInputRef.current) {
        videoImageInputRef.current.value = '';
      }
    }
  };

  const removeVideoImage = (index: number) => {
    setVideoImages(prev => {
      const removed = prev[index];
      if (removed?.preview) {
        URL.revokeObjectURL(removed.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSora2ImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (sora2Images.length >= 3) {
      toast({ title: "Maximum images reached", description: "You can upload up to 3 reference images.", variant: "destructive" });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file type", description: "Please upload an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Image must be under 10MB.", variant: "destructive" });
      return;
    }
    setSora2ImageUploading(true);
    const previewUrl = URL.createObjectURL(file);
    try {
      const token = getAuthToken();
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload/video-source", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to upload image");
      const data = await response.json();
      setSora2Images(prev => [...prev, { url: data.url, preview: previewUrl }]);
      toast({ title: "Image added", description: `Reference image ${sora2Images.length + 1} of 3 added.` });
    } catch (error) {
      toast({ title: "Upload failed", description: "Failed to upload image. Please try again.", variant: "destructive" });
      URL.revokeObjectURL(previewUrl);
    } finally {
      setSora2ImageUploading(false);
      if (sora2ImageInputRef.current) sora2ImageInputRef.current.value = "";
    }
  };

  const removeSora2Image = (index: number) => {
    setSora2Images(prev => {
      const removed = prev[index];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const stopSora2Polling = () => {
    if (sora2PollRef.current) {
      clearInterval(sora2PollRef.current);
      sora2PollRef.current = null;
    }
    if (sora2ElapsedRef.current) {
      clearInterval(sora2ElapsedRef.current);
      sora2ElapsedRef.current = null;
    }
    sora2StartTimeRef.current = null;
    setSora2Elapsed(0);
  };

  const cancelSora2Generation = () => {
    stopSora2Polling();
    setSora2Status("idle");
    setSora2TaskId(null);
    setSora2VideoUrl(null);
    toast({ title: "Video Generation Cancelled", description: "Sora 2 video generation has been cancelled." });
  };

  const startSora2Polling = (taskId: string) => {
    stopSora2Polling();
    sora2StartTimeRef.current = Date.now();
    setSora2Elapsed(0);
    sora2ElapsedRef.current = setInterval(() => {
      if (sora2StartTimeRef.current) {
        setSora2Elapsed(Math.floor((Date.now() - sora2StartTimeRef.current) / 1000));
      }
    }, 1000);
    sora2PollRef.current = setInterval(async () => {
      try {
        const token = getAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`/api/sora2/status/${taskId}`, { headers, credentials: "include" });
        const data = await res.json();
        if (data.status === "completed" && data.videoUrl) {
          setSora2Status("completed");
          setSora2VideoUrl(data.videoUrl);
          stopSora2Polling();
          const assistantMsg: Message = {
            role: "assistant",
            content: "Your Sora 2 AI video is ready!",
            videoUrl: data.videoUrl,
          };
          setMessages(prev => [...prev, assistantMsg]);
          setVideoMode(false);
          toast({ title: "Sora 2 Video Ready!", description: "Your AI-generated video is ready to view in the chat." });
          const notifyHeaders: Record<string, string> = { "Content-Type": "application/json" };
          if (token) notifyHeaders["Authorization"] = `Bearer ${token}`;
          fetch("/api/sora2/notify-completion", {
            method: "POST",
            headers: notifyHeaders,
            credentials: "include",
            body: JSON.stringify({ videoUrl: data.videoUrl, taskId }),
          }).catch((err) => console.warn("Sora2 completion notification failed:", err));
        } else if (data.status === "failed") {
          setSora2Status("failed");
          stopSora2Polling();
          toast({ title: "Sora 2 Generation Failed", description: data.error || "Something went wrong", variant: "destructive" });
        } else {
          setSora2Status(data.status || "processing");
        }
      } catch (err) {
        console.error("Sora2 poll error:", err);
      }
    }, 15000);
  };

  const startSora2Generation = async () => {
    if (!sora2Prompt.trim()) {
      toast({ title: "Prompt Required", description: "Please enter a video prompt.", variant: "destructive" });
      return;
    }
    setSora2Status("pending");
    const imageUrls = sora2Images.length > 0 ? sora2Images.map(img => img.url) : undefined;
    const finalPrompt = sora2Prompt;
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/sora2/create-video", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ prompt: finalPrompt, aspectRatio: "landscape", quality: "hd", imageUrls }),
      });
      const data = await res.json();
      if (!res.ok || !data.taskId) {
        throw new Error(data.error || "Failed to start Sora 2");
      }
      setSora2TaskId(data.taskId);
      setSora2Status("processing");
      startSora2Polling(data.taskId);
      const imageNote = sora2Images.length > 0 ? ` (with ${sora2Images.length} reference image${sora2Images.length > 1 ? "s" : ""})` : "";
      const userMsg: Message = { role: "user", content: `Generate a video${imageNote}: ${sora2Prompt}` };
      const assistantMsg: Message = { role: "assistant", content: "Sora 2 is creating your video. This can take 3–10 minutes. I'll show it here when it's ready..." };
      setMessages(prev => [...prev, userMsg, assistantMsg]);
      setSora2Images([]);
      setSora2Prompt("");
      setVideoMode(false);
      toast({ title: "Sora 2 Video Started!", description: "Sora 2 AI is generating your video. Please wait a few minutes." });
    } catch (error: any) {
      setSora2Status("failed");
      toast({ title: "Sora 2 Failed", description: error?.message || "Could not start Sora 2 video", variant: "destructive" });
    }
  };

  const stopLumaPolling = () => {
    if (lumaPollRef.current) {
      clearInterval(lumaPollRef.current);
      lumaPollRef.current = null;
    }
    if (lumaElapsedRef.current) {
      clearInterval(lumaElapsedRef.current);
      lumaElapsedRef.current = null;
    }
    lumaStartTimeRef.current = null;
    setLumaElapsed(0);
  };

  const cancelLumaGeneration = () => {
    stopLumaPolling();
    setLumaStatus("idle");
    setLumaTaskId(null);
    setLumaVideoUrl(null);
    toast({ title: "Video Generation Cancelled", description: "Luma Ray 2 video generation has been cancelled." });
  };

  const startLumaPolling = (taskId: string) => {
    stopLumaPolling();
    lumaStartTimeRef.current = Date.now();
    setLumaElapsed(0);
    lumaElapsedRef.current = setInterval(() => {
      if (lumaStartTimeRef.current) {
        setLumaElapsed(Math.floor((Date.now() - lumaStartTimeRef.current) / 1000));
      }
    }, 1000);
    lumaPollRef.current = setInterval(async () => {
      try {
        const token = getAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`/api/luma/status/${taskId}`, { headers, credentials: "include" });
        const data = await res.json();
        if (data.status === "completed" && data.videoUrl) {
          setLumaStatus("completed");
          setLumaVideoUrl(data.videoUrl);
          stopLumaPolling();
          const assistantMsg: Message = {
            role: "assistant",
            content: "Your Luma Ray 2 AI video is ready!",
            videoUrl: data.videoUrl,
          };
          setMessages(prev => [...prev, assistantMsg]);
          setVideoMode(false);
          toast({ title: "Luma Ray 2 Video Ready!", description: "Your AI-generated video is ready to view in the chat." });
          const notifyHeaders: Record<string, string> = { "Content-Type": "application/json" };
          if (token) notifyHeaders["Authorization"] = `Bearer ${token}`;
          fetch("/api/luma/notify-completion", {
            method: "POST",
            headers: notifyHeaders,
            credentials: "include",
            body: JSON.stringify({ videoUrl: data.videoUrl, taskId }),
          }).catch((err) => console.warn("Luma completion notification failed:", err));
        } else if (data.status === "failed") {
          setLumaStatus("failed");
          stopLumaPolling();
          toast({ title: "Luma Generation Failed", description: data.error || "Something went wrong", variant: "destructive" });
        } else {
          setLumaStatus(data.status === "processing" ? "processing" : "pending");
        }
      } catch (err) {
        console.error("Luma poll error:", err);
      }
    }, 10000);
  };

  const startLumaGeneration = async () => {
    if (!lumaPrompt.trim()) {
      toast({ title: "Prompt Required", description: "Please enter a video prompt.", variant: "destructive" });
      return;
    }
    setLumaStatus("pending");
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const bodyData: Record<string, any> = {
        prompt: lumaPrompt,
        model: lumaModel,
        aspectRatio: lumaAspectRatio,
        duration: lumaDuration,
        loop: lumaLoop,
      };
      if (lumaImages.length > 0) {
        bodyData.keyframeImageUrl = lumaImages[0].url;
      }
      const res = await fetch("/api/luma/create-video", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(bodyData),
      });
      const data = await res.json();
      if (!res.ok || !data.taskId) {
        throw new Error(data.error || "Failed to start Luma Ray 2");
      }
      setLumaTaskId(data.taskId);
      setLumaStatus("processing");
      startLumaPolling(data.taskId);
      const imageNote = lumaImages.length > 0 ? " (with reference image)" : "";
      const userMsg: Message = { role: "user", content: `Generate a Luma Ray 2 video${imageNote}: ${lumaPrompt}` };
      const assistantMsg: Message = { role: "assistant", content: `Luma Ray 2 (${lumaModel}) is creating your video. This usually takes 1–5 minutes. I'll show it here when it's ready...` };
      setMessages(prev => [...prev, userMsg, assistantMsg]);
      setLumaImages([]);
      setLumaPrompt("");
      setVideoMode(false);
      toast({ title: "Luma Video Started!", description: "Luma Ray 2 AI is generating your video. Please wait a few minutes." });
    } catch (error: any) {
      setLumaStatus("failed");
      toast({ title: "Luma Failed", description: error?.message || "Could not start Luma Ray 2 video", variant: "destructive" });
    }
  };

  const handleLumaImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (lumaImages.length >= 1) {
      toast({ title: "Maximum images reached", description: "Luma supports 1 keyframe image.", variant: "destructive" });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file type", description: "Please upload an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Image must be under 10MB.", variant: "destructive" });
      return;
    }
    setLumaImageUploading(true);
    const previewUrl = URL.createObjectURL(file);
    try {
      const token = getAuthToken();
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload/video-source", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to upload image");
      const data = await response.json();
      setLumaImages([{ url: data.url, preview: previewUrl }]);
      toast({ title: "Image added", description: "Keyframe image added for image-to-video generation." });
    } catch (error) {
      toast({ title: "Upload failed", description: "Failed to upload image. Please try again.", variant: "destructive" });
      URL.revokeObjectURL(previewUrl);
    } finally {
      setLumaImageUploading(false);
      if (lumaImageInputRef.current) lumaImageInputRef.current.value = "";
    }
  };

  const removeLumaImage = () => {
    if (lumaImages[0]?.preview) URL.revokeObjectURL(lumaImages[0].preview);
    setLumaImages([]);
  };

  const stopRunwayPolling = () => {
    if (runwayPollRef.current) {
      clearInterval(runwayPollRef.current);
      runwayPollRef.current = null;
    }
    if (runwayTimerRef.current) {
      clearInterval(runwayTimerRef.current);
      runwayTimerRef.current = null;
    }
    setRunwayElapsed(0);
  };

  const cancelRunwayGeneration = () => {
    stopRunwayPolling();
    setRunwayStatus("idle");
    setRunwayTaskId(null);
    setRunwayVideoUrl(null);
    setRunwayBatchId(null);
    setRunwayBatchProgress(null);
    toast({ title: "Video Generation Cancelled", description: "Runway Gen-4 video generation has been cancelled." });
  };

  const startRunwayPolling = (taskId: string) => {
    stopRunwayPolling();
    const startTime = Date.now();
    setRunwayElapsed(0);
    runwayTimerRef.current = setInterval(() => {
      setRunwayElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    runwayPollRef.current = setInterval(async () => {
      try {
        const token = getAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`/api/runway/status/${taskId}`, { headers, credentials: "include" });
        if (!res.ok) throw new Error("Poll failed");
        const data = await res.json();

        if (data.status === "completed" && data.videoUrl) {
          stopRunwayPolling();
          setRunwayStatus("completed");
          setRunwayVideoUrl(data.videoUrl);
          const videoMsg: Message = {
            role: "assistant",
            content: "Your Runway Gen-4 Aleph video is ready!",
            videoUrl: data.videoUrl,
          };
          setMessages(prev => [...prev, videoMsg]);
          toast({ title: "Runway Video Ready!", description: "Your AI-generated video is ready to view in the chat." });

          const notifyToken = getAuthToken();
          const notifyHeaders: Record<string, string> = { "Content-Type": "application/json" };
          if (notifyToken) notifyHeaders["Authorization"] = `Bearer ${notifyToken}`;
          fetch("/api/runway/notify-completion", {
            method: "POST",
            headers: notifyHeaders,
            credentials: "include",
            body: JSON.stringify({ videoUrl: data.videoUrl, taskId }),
          }).catch(() => {});
        } else if (data.status === "failed") {
          stopRunwayPolling();
          setRunwayStatus("failed");
          toast({ title: "Runway Generation Failed", description: data.error || "Something went wrong", variant: "destructive" });
        } else {
          setRunwayStatus(data.status === "processing" ? "processing" : "pending");
        }
      } catch {
        // keep polling
      }
    }, 5000);
  };

  const startRunwayBatchPolling = (batchId: string) => {
    stopRunwayPolling();
    const startTime = Date.now();
    setRunwayElapsed(0);
    runwayTimerRef.current = setInterval(() => {
      setRunwayElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    let batchPollFailCount = 0;
    runwayPollRef.current = setInterval(async () => {
      try {
        const token = getAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`/api/runway/batch-status/${batchId}`, { headers, credentials: "include" });
        if (!res.ok) {
          batchPollFailCount++;
          if (batchPollFailCount >= 5) {
            stopRunwayPolling();
            setRunwayStatus("failed");
            setRunwayBatchId(null);
            setRunwayBatchProgress(null);
            toast({ title: "Connection Lost", description: "Lost connection to batch status. Please try again.", variant: "destructive" });
          }
          return;
        }
        batchPollFailCount = 0;
        const data = await res.json();

        setRunwayBatchProgress({ completed: data.completedSegments || 0, total: data.totalSegments || 0 });

        if (data.status === "completed" && data.videoUrl) {
          stopRunwayPolling();
          setRunwayStatus("completed");
          setRunwayVideoUrl(data.videoUrl);
          setRunwayBatchId(null);
          setRunwayBatchProgress(null);
          const videoMsg: Message = {
            role: "assistant",
            content: `Your extended Runway Gen-4 Aleph video (${data.totalSegments} clips stitched) is ready!`,
            videoUrl: data.videoUrl,
          };
          setMessages(prev => [...prev, videoMsg]);
          toast({ title: "Extended Video Ready!", description: `${data.totalSegments} clips generated and stitched together!` });

          const notifyToken = getAuthToken();
          const notifyHeaders: Record<string, string> = { "Content-Type": "application/json" };
          if (notifyToken) notifyHeaders["Authorization"] = `Bearer ${notifyToken}`;
          fetch("/api/runway/notify-completion", {
            method: "POST",
            headers: notifyHeaders,
            credentials: "include",
            body: JSON.stringify({ videoUrl: data.videoUrl, taskId: batchId }),
          }).catch(() => {});
        } else if (data.status === "failed") {
          stopRunwayPolling();
          setRunwayStatus("failed");
          setRunwayBatchId(null);
          setRunwayBatchProgress(null);
          toast({ title: "Extended Video Failed", description: data.error || "Some segments failed to generate", variant: "destructive" });
        } else {
          setRunwayStatus("processing");
        }
      } catch {
        batchPollFailCount++;
        if (batchPollFailCount >= 5) {
          stopRunwayPolling();
          setRunwayStatus("failed");
          setRunwayBatchId(null);
          setRunwayBatchProgress(null);
          toast({ title: "Connection Lost", description: "Lost connection to batch status. Please try again.", variant: "destructive" });
        }
      }
    }, 8000);
  };

  const handleRunwayGenerate = async () => {
    if (!runwayPrompt.trim()) {
      toast({ title: "Prompt required", description: "Please enter a video prompt.", variant: "destructive" });
      return;
    }
    if (!runwaySourceVideo) {
      toast({ title: "Source video required", description: "Please upload a source video for video-to-video transformation.", variant: "destructive" });
      return;
    }

    setRunwayStatus("pending");
    setRunwayVideoUrl(null);
    setRunwayBatchProgress(null);

    const isExtended = runwayTotalDuration > 10;

    try {
      const token = getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      if (isExtended) {
        const splitRes = await fetch("/api/runway/split-video", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({
            videoUrl: runwaySourceVideo.url,
            clipDuration: runwayClipDuration,
            totalDuration: runwayTotalDuration,
          }),
        });
        const splitData = await splitRes.json();
        if (!splitRes.ok) throw new Error(splitData.error || "Failed to split video");

        const batchRes = await fetch("/api/runway/create-extended-video", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({
            segmentUrls: splitData.segmentUrls,
            promptText: runwayPrompt,
            referenceImageUrl: runwayRefImage?.url || undefined,
          }),
        });
        const batchData = await batchRes.json();
        if (!batchRes.ok) throw new Error(batchData.error || "Failed to start extended video");

        setRunwayBatchId(batchData.batchId);
        setRunwayBatchProgress({ completed: 0, total: batchData.totalSegments });
        startRunwayBatchPolling(batchData.batchId);

        const refNote = runwayRefImage ? " (with style reference)" : "";
        const userMsg: Message = { role: "user", content: `Transform ${runwayTotalDuration}s video with Runway Gen-4 Aleph (${runwayClipDuration}s clips)${refNote}: ${runwayPrompt}` };
        const assistantMsg: Message = { role: "assistant", content: `Runway Gen-4 Aleph is generating ${batchData.totalSegments} clips of ${runwayClipDuration}s each (${runwayTotalDuration}s total). Each clip takes 2-5 minutes, then they'll be auto-stitched together...` };
        setMessages(prev => [...prev, userMsg, assistantMsg]);
        toast({ title: "Extended Video Started!", description: `Generating ${batchData.totalSegments} clips for a ${runwayTotalDuration}s video.` });
      } else {
        let videoUri = runwaySourceVideo.url;

        const trimRes = await fetch("/api/runway/trim-video", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({
            videoUrl: runwaySourceVideo.url,
            duration: runwayTotalDuration,
          }),
        });
        const trimData = await trimRes.json();
        if (trimRes.ok && trimData.trimmedUrl) {
          videoUri = trimData.trimmedUrl;
        }

        const res = await fetch("/api/runway/create-video", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({
            videoUri,
            promptText: runwayPrompt,
            referenceImageUrl: runwayRefImage?.url || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to start Runway Gen-4");

        setRunwayTaskId(data.taskId);
        startRunwayPolling(data.taskId);

        const refNote = runwayRefImage ? " (with style reference image)" : "";
        const userMsg: Message = { role: "user", content: `Transform ${runwayTotalDuration}s video with Runway Gen-4 Aleph${refNote}: ${runwayPrompt}` };
        const assistantMsg: Message = { role: "assistant", content: `Runway Gen-4 Aleph is transforming your ${runwayTotalDuration}s video. This typically takes 2-5 minutes. I'll show it here when it's ready...` };
        setMessages(prev => [...prev, userMsg, assistantMsg]);
        toast({ title: "Runway Video Started!", description: `Runway Gen-4 Aleph is transforming your ${runwayTotalDuration}s video.` });
      }
    } catch (error: any) {
      setRunwayStatus("failed");
      setRunwayBatchId(null);
      setRunwayBatchProgress(null);
      toast({ title: "Runway Failed", description: error?.message || "Could not start Runway Gen-4 video", variant: "destructive" });
    }
  };

  const handleRunwayVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast({ title: "Invalid file type", description: "Please select a video file.", variant: "destructive" });
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      toast({ title: "File too large", description: "Video must be under 100MB.", variant: "destructive" });
      return;
    }

    setRunwaySourceUploading(true);
    const previewUrl = URL.createObjectURL(file);
    try {
      const token = getAuthToken();
      const formData = new FormData();
      formData.append("video", file);
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/runway/upload-video", { method: "POST", headers, credentials: "include", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setRunwaySourceVideo({ url: data.url, preview: previewUrl });
      toast({ title: "Video uploaded", description: "Source video ready for transformation." });
    } catch (error) {
      toast({ title: "Upload failed", description: "Failed to upload video. Please try again.", variant: "destructive" });
      URL.revokeObjectURL(previewUrl);
    } finally {
      setRunwaySourceUploading(false);
      if (runwayVideoInputRef.current) runwayVideoInputRef.current.value = "";
    }
  };

  const handleRunwayRefUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file type", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "File too large", description: "Image must be under 20MB.", variant: "destructive" });
      return;
    }

    setRunwayRefUploading(true);
    const previewUrl = URL.createObjectURL(file);
    try {
      const token = getAuthToken();
      const formData = new FormData();
      formData.append("file", file);
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/upload-reference", { method: "POST", headers, credentials: "include", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setRunwayRefImage({ url: data.url, preview: previewUrl });
      toast({ title: "Style reference added", description: "Style reference image ready." });
    } catch (error) {
      toast({ title: "Upload failed", description: "Failed to upload image. Please try again.", variant: "destructive" });
      URL.revokeObjectURL(previewUrl);
    } finally {
      setRunwayRefUploading(false);
      if (runwayRefInputRef.current) runwayRefInputRef.current.value = "";
    }
  };

  const fetchUserVideos = async () => {
    setUserVideosLoading(true);
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/videos?status=ready", { headers, credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUserVideos(data.filter((v: any) => v.videoUrl));
      }
    } catch (error) {
      console.error("Failed to fetch user videos:", error);
    } finally {
      setUserVideosLoading(false);
    }
  };

  const toggleVideoSelection = (id: number) => {
    setSelectedVideoIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStitchVideos = async () => {
    const selectedUrls = userVideos
      .filter(v => selectedVideoIds.has(v.id))
      .map(v => v.videoUrl);
    if (selectedUrls.length < 2) {
      toast({ title: "Select More Videos", description: "Please select at least 2 videos to stitch together.", variant: "destructive" });
      return;
    }
    setStitchingVideos(true);
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/ai/veo/combine", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ videoUrls: selectedUrls, title: "Stitched Video" }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to stitch videos");
      }
      const data = await res.json();
      const assistantMsg: Message = {
        role: "assistant",
        content: `Video stitch complete! Combined ${selectedUrls.length} clips into one video:`,
        videoUrl: data.videoUrl,
      };
      setMessages(prev => [...prev, assistantMsg]);
      setVideoEditMode(false);
      setSelectedVideoIds(new Set());
      toast({ title: "Videos Stitched!", description: `Combined ${selectedUrls.length} videos into one.` });
    } catch (error: any) {
      toast({ title: "Stitch Failed", description: error?.message || "Failed to stitch videos", variant: "destructive" });
    } finally {
      setStitchingVideos(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = "";
    if (!file.type.startsWith("video/")) {
      toast({ title: "Invalid File", description: "Please select a video file (MP4, WebM, MOV).", variant: "destructive" });
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Maximum file size is 500MB.", variant: "destructive" });
      return;
    }
    setUploadingVideo(true);
    try {
      const token = getAuthToken();
      const formData = new FormData();
      formData.append("video", file);
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/videos/upload", {
        method: "POST",
        headers,
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Upload failed");
      }
      toast({ title: "Video Uploaded", description: `"${file.name}" has been added to your videos.` });
      const vidToken = getAuthToken();
      const vidHeaders: Record<string, string> = {};
      if (vidToken) vidHeaders["Authorization"] = `Bearer ${vidToken}`;
      const videosRes = await fetch("/api/videos?status=ready", { headers: vidHeaders, credentials: "include" });
      if (videosRes.ok) {
        const videosData = await videosRes.json();
        setUserVideos(videosData);
      }
    } catch (error: any) {
      toast({ title: "Upload Failed", description: error?.message || "Failed to upload video", variant: "destructive" });
    } finally {
      setUploadingVideo(false);
    }
  };

  const startVideoGeneration = async () => {
    if (videoImages.length === 0) {
      toast({
        title: "Image Required",
        description: "Please upload at least one property image.",
        variant: "destructive",
      });
      return;
    }

    setVideoGenerating(true);

    const imageData = videoImages.map(img => ({
      url: img.url,
      roomType: img.roomType,
    }));
    const allRoomTypes = [...interiorRoomTypes, ...exteriorRoomTypes];
    const roomLabels = videoImages.map(img => 
      allRoomTypes.find(r => r.value === img.roomType)?.label || img.roomType
    );
    const userMessage: Message = {
      role: "user",
      content: `Generate a ${videoPresets.find(p => p.value === videoPreset)?.label || videoPreset} property tour video from ${videoImages.length} image${videoImages.length > 1 ? 's' : ''}: ${roomLabels.join(', ')}`,
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/ai/veo/start", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          imageUrl: imageData[0].url,
          imageUrls: imageData.map(d => d.url),
          roomTypes: imageData.map(d => d.roomType),
          preset: videoPreset,
          spaceType: spaceType,
          customDescription: customDescription.trim() || undefined,
          noSound: noSound,
          agentPhotoUrl: includeAgentPhoto ? agentPhotoUrl : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to start video generation");
      }

      const data = await response.json();
      setVideoOperationId(data.operationId);
      
      // Store label and spaceType keyed by operation ID to handle concurrent generations
      const allRoomTypes = [...interiorRoomTypes, ...exteriorRoomTypes];
      const roomLabel = videoImages.map(img => 
        allRoomTypes.find(r => r.value === img.roomType)?.label || img.roomType
      ).join(", ");
      if (data.operationId) {
        pendingVideoDataRef.current.set(data.operationId, {
          label: roomLabel,
          spaceType: spaceType,
        });
      }

      const segmentInfo = data.isMultiSegment 
        ? ` I'm generating ${data.segmentCount} segments (one per room) and will combine them into a single ${data.duration}-second video.`
        : "";
      const assistantMessage: Message = {
        role: "assistant",
        content: `Video generation started!${segmentInfo} This may take a few minutes. I'll notify you when it's ready...`,
      };
      setMessages(prev => [...prev, assistantMessage]);

      setVideoImages([]);
      setVideoMode(false);
    } catch (error) {
      console.error("Video generation error:", error);
      setVideoGenerating(false);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start video generation.",
        variant: "destructive",
      });
      const errorMessage: Message = {
        role: "assistant",
        content: "I'm sorry, I encountered an error starting the video generation. Please try again.",
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const sendMessage = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput && selectedFiles.length === 0) return;
    if (isLoading) return;

    const userAttachments: Attachment[] = selectedFiles.map(file => ({
      url: URL.createObjectURL(file),
      type: file.type,
      name: file.name,
    }));

    const userMessage: Message = { 
      role: "user", 
      content: trimmedInput || (selectedFiles.length > 0 ? "Uploaded files" : ""),
      attachments: userAttachments.length > 0 ? userAttachments : undefined,
    };
    const updatedMessages = [...messages, userMessage];
    
    setMessages(updatedMessages);
    setInput("");
    const filesToSend = [...selectedFiles];
    setSelectedFiles([]);
    setIsLoading(true);

    const isFirstMessage = messages.length === 0;
    let sessionId = currentSessionId;

    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      if (isFirstMessage && !sessionId) {
        const title = generateTitle(trimmedInput || "New Chat");
        sessionId = await createSession(title);
        if (sessionId) {
          setCurrentSessionId(sessionId);
        }
      }

      let data;
      
      if (filesToSend.length > 0) {
        const formData = new FormData();
        formData.append("message", trimmedInput);
        formData.append("provider", aiProvider);
        filesToSend.forEach(file => {
          formData.append("files", file);
        });

        const response = await fetch("/api/ai-assistant/chat", {
          method: "POST",
          headers,
          credentials: "include",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to get AI response");
        }

        data = await response.json();
      } else {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          credentials: "include",
          body: JSON.stringify({
            message: trimmedInput,
            conversationHistory: messages,
            provider: aiProvider,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || "Failed to get AI response");
        }

        data = await response.json();
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: data.assistantMessage?.content || data.response || data.message || "I apologize, but I couldn't generate a response. Please try again.",
        imageUrl: data.imageUrl || undefined,
      };
      
      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);

      if (sessionId) {
        saveSessionMessages(sessionId, finalMessages);
      }
    } catch (error) {
      console.error("AI chat error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to get AI response. Please try again.",
        variant: "destructive",
      });
      const errorMessage: Message = {
        role: "assistant",
        content: "I'm sorry, I encountered an error. Please try again or contact support if the issue persists.",
      };
      const finalMessages = [...updatedMessages, errorMessage];
      setMessages(finalMessages);

      if (sessionId) {
        saveSessionMessages(sessionId, finalMessages);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setInput("");
    setCurrentSessionId(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "h-[80vh] max-h-[700px] flex flex-col p-0 gap-0 bg-white dark:bg-gray-900",
          showHistory ? "sm:max-w-[850px]" : "sm:max-w-[600px]"
        )}
        data-testid="dialog-ai-assistant"
      >
        <DialogHeader className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Assistant
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={startNewChat}
                className="text-xs"
                data-testid="button-new-chat"
              >
                <Plus className="h-3 w-3 mr-1" />
                New Chat
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className={cn("text-xs", showHistory && "bg-gray-100 dark:bg-gray-800")}
                data-testid="button-toggle-history"
              >
                <History className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {showHistory && (
            <div className="w-[250px] border-r border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-gray-800/50">
              <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Chat History</h3>
              </div>
              <ScrollArea className="flex-1">
                {sessionsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="text-center py-8 px-3">
                    <MessageSquare className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">No chat history yet</p>
                  </div>
                ) : (
                  <div className="py-2">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className={cn(
                          "group px-3 py-2 mx-2 rounded-md cursor-pointer transition-colors",
                          currentSessionId === session.id
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-gray-100 dark:hover:bg-gray-700"
                        )}
                        onClick={() => loadSession(session.id)}
                        data-testid={`session-item-${session.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-gray-800 dark:text-gray-200">
                              {session.title || "Untitled"}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDate(session.updatedAt)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSession(session.id);
                            }}
                            data-testid={`button-delete-session-${session.id}`}
                          >
                            <Trash2 className="h-3 w-3 text-gray-400 hover:text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          <div className="flex-1 flex flex-col overflow-hidden">

        {!videoMode && !videoEditMode && (
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-3 mb-3">
              <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">AI Provider:</label>
              <Select value={aiProvider} onValueChange={(value: "auto" | "openai" | "gemini") => setAiProvider(value)}>
                <SelectTrigger className="w-[200px] h-8 text-xs" data-testid="select-ai-provider">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (Recommended)</SelectItem>
                  <SelectItem value="openai">ChatGPT (GPT-4o)</SelectItem>
                  <SelectItem value="gemini">Gemini</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Quick Actions</p>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <Button
                  key={action.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction(action)}
                  className="text-xs bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                  data-testid={`button-quick-action-${action.id}`}
                >
                  {action.icon}
                  <span className="ml-1">{action.label}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {videoMode && (
          <div className="flex-1 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setVideoMode(false)}
                className="h-7 px-2"
                data-testid="button-exit-video-mode"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <h4 className="font-medium text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Video className="h-4 w-4 text-primary" />
                Generate Video
              </h4>
            </div>
            
            <div className="space-y-2 mt-2">
              {/* AI Video Platform selector */}
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">AI Video Platform</label>
                <Select value={assistantVideoPlatform} onValueChange={(v) => setAssistantVideoPlatform(v as typeof assistantVideoPlatform)}>
                  <SelectTrigger className="w-full" data-testid="select-assistant-video-platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="veo">
                      <div className="flex flex-col">
                        <span>Google VEO (Property Tour)</span>
                        <span className="text-xs text-gray-500">Upload room photos — cinematic walk-through</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="sora2">
                      <div className="flex flex-col">
                        <span>Sora 2 (OpenAI)</span>
                        <span className="text-xs text-gray-500">HD cinematic AI video generation — 3-10 min</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="luma">
                      <div className="flex flex-col">
                        <span>Luma Ray 2</span>
                        <span className="text-xs text-gray-500">Fast coherent motion, ultra-realistic — 1-5 min</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="runway">
                      <div className="flex flex-col">
                        <span>Runway Gen-4 Aleph</span>
                        <span className="text-xs text-gray-500">Video-to-video transformation — 2-5 min</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sora 2 flow */}
              {assistantVideoPlatform === "sora2" && (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Video Prompt</label>
                    <textarea
                      value={sora2Prompt}
                      onChange={(e) => setSora2Prompt(e.target.value)}
                      placeholder="e.g. A cinematic walk-through of a modern kitchen with marble countertops, warm lighting, and open shelving..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      rows={3}
                      data-testid="input-sora2-prompt"
                    />
                  </div>

                  {/* Reference image upload */}
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
                      Reference Images (optional, up to 3)
                    </label>
                    <input
                      ref={sora2ImageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleSora2ImageUpload}
                      className="hidden"
                      data-testid="input-sora2-image-file"
                    />
                    <div className="space-y-2">
                      {sora2Images.map((img, index) => (
                        <div key={index} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2">
                          <div className="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                            <img src={img.preview || img.url} alt={`Reference ${index + 1}`} className="w-full h-full object-cover" />
                            <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5">
                              #{index + 1}
                            </span>
                          </div>
                          <span className="flex-1 text-xs text-gray-500 dark:text-gray-400 truncate">Reference image {index + 1}</span>
                          <button
                            onClick={() => removeSora2Image(index)}
                            className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600 flex-shrink-0"
                            data-testid={`button-remove-sora2-image-${index}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {sora2Images.length < 3 && (
                        <div
                          onClick={() => !sora2ImageUploading && sora2ImageInputRef.current?.click()}
                          className={cn(
                            "border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg py-2.5 flex items-center justify-center gap-2 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors",
                            sora2ImageUploading && "opacity-50 cursor-wait"
                          )}
                          data-testid="button-upload-sora2-image"
                        >
                          {sora2ImageUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                          ) : (
                            <>
                              <Upload className="h-4 w-4 text-gray-400" />
                              <span className="text-xs text-gray-500">Add Reference Image (optional)</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {sora2Images.length > 0 && (
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                        Image URLs will be included in the prompt as visual reference for the AI.
                      </p>
                    )}
                  </div>

                  {(sora2Status === "pending" || sora2Status === "processing") && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Sora 2 is generating your video ({Math.floor(sora2Elapsed / 60)}:{String(sora2Elapsed % 60).padStart(2, "0")} elapsed)…</span>
                      </div>
                      {sora2Elapsed >= 600 && (
                        <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded px-3 py-2" data-testid="sora2-timeout-warning">
                          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                          <span>This is taking longer than expected. You can keep waiting or cancel.</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={startSora2Generation}
                      disabled={sora2Status === "pending" || sora2Status === "processing" || !sora2Prompt.trim()}
                      className="flex-1 bg-primary hover:bg-primary/90"
                      data-testid="button-generate-sora2-assistant"
                    >
                      {(sora2Status === "pending" || sora2Status === "processing") ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generating...</>
                      ) : (
                        <><Video className="h-4 w-4 mr-2" />Generate with Sora 2</>
                      )}
                    </Button>
                    {(sora2Status === "pending" || sora2Status === "processing") && (
                      <Button
                        onClick={cancelSora2Generation}
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                        data-testid="button-cancel-sora2-assistant"
                      >
                        <X className="h-4 w-4 mr-1" />Cancel
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Luma Ray 2 flow */}
              {assistantVideoPlatform === "luma" && (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Video Prompt</label>
                    <textarea
                      value={lumaPrompt}
                      onChange={(e) => setLumaPrompt(e.target.value)}
                      placeholder="e.g. A cinematic aerial shot of a luxury beachfront property at sunset, smooth camera movement revealing the pool and garden..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      rows={3}
                      data-testid="input-luma-prompt"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Model</label>
                      <Select value={lumaModel} onValueChange={(v) => setLumaModel(v as typeof lumaModel)}>
                        <SelectTrigger className="w-full h-8 text-xs" data-testid="select-luma-model">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ray-2">Ray 2 (Best)</SelectItem>
                          <SelectItem value="ray-flash-2">Ray Flash 2 (Fast)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Aspect Ratio</label>
                      <Select value={lumaAspectRatio} onValueChange={(v) => setLumaAspectRatio(v as typeof lumaAspectRatio)}>
                        <SelectTrigger className="w-full h-8 text-xs" data-testid="select-luma-aspect">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="16:9">16:9 Landscape</SelectItem>
                          <SelectItem value="9:16">9:16 Portrait</SelectItem>
                          <SelectItem value="1:1">1:1 Square</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Duration</label>
                      <Select value={lumaDuration} onValueChange={setLumaDuration}>
                        <SelectTrigger className="w-full h-8 text-xs" data-testid="select-luma-duration">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5s">5 seconds</SelectItem>
                          <SelectItem value="9s">9 seconds</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="luma-loop"
                      checked={lumaLoop}
                      onCheckedChange={(checked) => setLumaLoop(checked === true)}
                      data-testid="checkbox-luma-loop"
                    />
                    <label htmlFor="luma-loop" className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                      Seamless loop
                    </label>
                  </div>

                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
                      Keyframe Image (optional — image-to-video)
                    </label>
                    <input
                      ref={lumaImageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLumaImageUpload}
                      className="hidden"
                      data-testid="input-luma-image-file"
                    />
                    <div className="space-y-2">
                      {lumaImages.map((img, index) => (
                        <div key={index} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2">
                          <div className="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                            <img src={img.preview || img.url} alt="Keyframe" className="w-full h-full object-cover" />
                          </div>
                          <span className="flex-1 text-xs text-gray-500 dark:text-gray-400 truncate">Keyframe image</span>
                          <button
                            onClick={removeLumaImage}
                            className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600 flex-shrink-0"
                            data-testid="button-remove-luma-image"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {lumaImages.length === 0 && (
                        <div
                          onClick={() => !lumaImageUploading && lumaImageInputRef.current?.click()}
                          className={cn(
                            "border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg py-2.5 flex items-center justify-center gap-2 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors",
                            lumaImageUploading && "opacity-50 cursor-wait"
                          )}
                          data-testid="button-upload-luma-image"
                        >
                          {lumaImageUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                          ) : (
                            <>
                              <Upload className="h-4 w-4 text-gray-400" />
                              <span className="text-xs text-gray-500">Add Keyframe Image (optional)</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {(lumaStatus === "pending" || lumaStatus === "processing") && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Luma Ray 2 is generating your video ({Math.floor(lumaElapsed / 60)}:{String(lumaElapsed % 60).padStart(2, "0")} elapsed)…</span>
                      </div>
                      {lumaElapsed >= 300 && (
                        <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded px-3 py-2" data-testid="luma-timeout-warning">
                          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                          <span>This is taking longer than expected. You can keep waiting or cancel.</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={startLumaGeneration}
                      disabled={lumaStatus === "pending" || lumaStatus === "processing" || !lumaPrompt.trim()}
                      className="flex-1 bg-primary hover:bg-primary/90"
                      data-testid="button-generate-luma-assistant"
                    >
                      {(lumaStatus === "pending" || lumaStatus === "processing") ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generating...</>
                      ) : (
                        <><Video className="h-4 w-4 mr-2" />Generate with Luma Ray 2</>
                      )}
                    </Button>
                    {(lumaStatus === "pending" || lumaStatus === "processing") && (
                      <Button
                        onClick={cancelLumaGeneration}
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                        data-testid="button-cancel-luma-assistant"
                      >
                        <X className="h-4 w-4 mr-1" />Cancel
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Runway Gen-4 Aleph flow */}
              {assistantVideoPlatform === "runway" && (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Transformation Prompt</label>
                    <textarea
                      value={runwayPrompt}
                      onChange={(e) => setRunwayPrompt(e.target.value)}
                      placeholder="e.g. Transform into an animated watercolor painting style with soft brush strokes and flowing colors..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      rows={3}
                      data-testid="input-runway-prompt"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Total Duration</label>
                      <Select value={String(runwayTotalDuration)} onValueChange={(v) => setRunwayTotalDuration(Number(v))}>
                        <SelectTrigger className="w-full" data-testid="select-runway-duration">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 seconds</SelectItem>
                          <SelectItem value="10">10 seconds</SelectItem>
                          <SelectItem value="20">20 seconds</SelectItem>
                          <SelectItem value="30">30 seconds</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {runwayTotalDuration > 10 && (
                      <div>
                        <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Clip Duration</label>
                        <Select value={String(runwayClipDuration)} onValueChange={(v) => setRunwayClipDuration(Number(v))}>
                          <SelectTrigger className="w-full" data-testid="select-runway-clip-duration">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5s per clip</SelectItem>
                            <SelectItem value="10">10s per clip</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  {runwayTotalDuration > 10 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Your video will be split into {Math.ceil(runwayTotalDuration / runwayClipDuration)} segments of {runwayClipDuration}s each, transformed separately, then auto-stitched with crossfade transitions.
                    </p>
                  )}

                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Source Video (required)</label>
                    <input
                      ref={runwayVideoInputRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={handleRunwayVideoUpload}
                      data-testid="input-runway-video-upload"
                    />
                    {runwaySourceVideo ? (
                      <div className="relative inline-block">
                        <video src={runwaySourceVideo.preview} className="h-20 rounded-lg border border-gray-300 dark:border-gray-600" muted />
                        <button
                          onClick={() => { if (runwaySourceVideo.preview) URL.revokeObjectURL(runwaySourceVideo.preview); setRunwaySourceVideo(null); }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                          data-testid="button-remove-runway-source"
                        >×</button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runwayVideoInputRef.current?.click()}
                        disabled={runwaySourceUploading}
                        data-testid="button-upload-runway-source"
                      >
                        {runwaySourceUploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                        Upload Source Video
                      </Button>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Style Reference Image (optional)</label>
                    <input
                      ref={runwayRefInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleRunwayRefUpload}
                      data-testid="input-runway-ref-upload"
                    />
                    {runwayRefImage ? (
                      <div className="relative inline-block">
                        <img src={runwayRefImage.preview} className="h-16 rounded-lg border border-gray-300 dark:border-gray-600 object-cover" alt="Style reference" />
                        <button
                          onClick={() => { if (runwayRefImage.preview) URL.revokeObjectURL(runwayRefImage.preview); setRunwayRefImage(null); }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                          data-testid="button-remove-runway-ref"
                        >×</button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runwayRefInputRef.current?.click()}
                        disabled={runwayRefUploading}
                        data-testid="button-upload-runway-ref"
                      >
                        {runwayRefUploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Image className="h-4 w-4 mr-1" />}
                        Add Style Reference
                      </Button>
                    )}
                  </div>

                  {(runwayStatus === "pending" || runwayStatus === "processing") && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>
                          {runwayBatchProgress
                            ? `Generating clip ${runwayBatchProgress.completed + 1} of ${runwayBatchProgress.total} (${Math.floor(runwayElapsed / 60)}:${String(runwayElapsed % 60).padStart(2, "0")} elapsed)…`
                            : `Runway Gen-4 is transforming your video (${Math.floor(runwayElapsed / 60)}:${String(runwayElapsed % 60).padStart(2, "0")} elapsed)…`}
                        </span>
                      </div>
                      {runwayBatchProgress && (
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(5, (runwayBatchProgress.completed / runwayBatchProgress.total) * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={handleRunwayGenerate}
                      disabled={!runwayPrompt.trim() || !runwaySourceVideo || runwayStatus === "pending" || runwayStatus === "processing"}
                      className="flex-1"
                      data-testid="button-generate-runway-assistant"
                    >
                      {(runwayStatus === "pending" || runwayStatus === "processing") ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" />Transforming...</>
                      ) : (
                        <><Video className="h-4 w-4 mr-2" />Transform with Runway Gen-4 ({runwayTotalDuration}s)</>
                      )}
                    </Button>
                    {(runwayStatus === "pending" || runwayStatus === "processing") && (
                      <Button
                        onClick={cancelRunwayGeneration}
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                        data-testid="button-cancel-runway-assistant"
                      >
                        <X className="h-4 w-4 mr-1" />Cancel
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* VEO (Google) flow — existing image-based UI */}
              {assistantVideoPlatform === "veo" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Platform Preset</label>
                  <Select value={videoPreset} onValueChange={setVideoPreset}>
                    <SelectTrigger className="w-full" data-testid="select-video-preset">
                      <SelectValue placeholder="Select preset" />
                    </SelectTrigger>
                    <SelectContent>
                      {videoPresets.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">{videoPanel.spaceTypeLabel}</label>
                  <Select value={spaceType} onValueChange={(val: "interior" | "exterior" | "none") => setSpaceType(val)}>
                    <SelectTrigger className="w-full" data-testid="select-space-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Trigger</SelectItem>
                      <SelectItem value="interior">{videoPanel.interiorLabel}</SelectItem>
                      <SelectItem value="exterior">{videoPanel.exteriorLabel}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              )}

              {assistantVideoPlatform === "veo" && <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
                  {videoPanel.imagesLabel} ({videoImages.length}/3) - Select {videoPanel.imageTypeLabel.toLowerCase()} type for each
                </label>
                <input
                  ref={videoImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleVideoImageUpload}
                  className="hidden"
                  data-testid="input-video-image-file"
                />
                
                <div className="space-y-3">
                  {videoImages.map((img, index) => {
                    const currentRoomOptions = spaceType === "none"
                      ? [...videoPanel.interiorTypes, ...videoPanel.exteriorTypes]
                      : spaceType === "interior"
                      ? videoPanel.interiorTypes
                      : videoPanel.exteriorTypes;
                    const currentRoomType = currentRoomOptions.find(r => r.value === img.roomType);
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2"
                      >
                        <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                          <img
                            src={img.preview || img.url}
                            alt={`${videoPanel.imageTypeLabel} ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5">
                            #{index + 1}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <Select 
                            value={img.roomType} 
                            onValueChange={(val) => {
                              setVideoImages(prev => prev.map((item, i) => 
                                i === index ? { ...item, roomType: val } : item
                              ));
                            }}
                          >
                            <SelectTrigger className="w-full h-8 text-xs" data-testid={`select-room-type-${index}`}>
                              <SelectValue placeholder={`Select ${videoPanel.imageTypeLabel.toLowerCase()} type`} />
                            </SelectTrigger>
                            <SelectContent>
                              {currentRoomOptions.map((room) => (
                                <SelectItem key={room.value} value={room.value}>
                                  {room.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {currentRoomType && (
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                              {currentRoomType.prompt}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => removeVideoImage(index)}
                          className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600 flex-shrink-0"
                          data-testid={`button-remove-video-image-${index}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                  
                  {videoImages.length < 3 && (
                    <div
                      onClick={() => !videoImageUploading && videoImageInputRef.current?.click()}
                      className={cn(
                        "border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg py-3 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors",
                        videoImageUploading && "opacity-50 cursor-wait"
                      )}
                      data-testid="button-upload-video-image"
                    >
                      {videoImageUploading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Upload className="h-5 w-5 text-gray-400" />
                          <span className="text-xs text-gray-500">Add {spaceType === "none" ? "" : spaceType === "interior" ? videoPanel.interiorLabel.split(" ")[0] + " " : videoPanel.exteriorLabel.split(" ")[0] + " "}Photo</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Tip: For 3 images use triangle positioning (left → right → opposite view)
                </p>
              </div>}

              {assistantVideoPlatform === "veo" && <>
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
                  Custom Description (Optional)
                </label>
                <textarea
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder={videoPanel.descPlaceholder}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={2}
                  data-testid="input-custom-description"
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="no-sound-checkbox"
                  checked={noSound}
                  onCheckedChange={(checked) => setNoSound(checked === true)}
                  data-testid="checkbox-no-sound"
                />
                <label
                  htmlFor="no-sound-checkbox"
                  className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer"
                >
                  No sound (silent video)
                </label>
              </div>

              {agentPhotoUrl && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="include-agent-photo"
                    checked={includeAgentPhoto}
                    onCheckedChange={(checked) => setIncludeAgentPhoto(checked === true)}
                    data-testid="checkbox-include-agent-photo"
                  />
                  <img
                    src={agentPhotoUrl}
                    alt="Agent"
                    className="w-5 h-5 rounded-full object-cover"
                  />
                  <label
                    htmlFor="include-agent-photo"
                    className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer"
                  >
                    Include my photo
                  </label>
                </div>
              )}

              <Button
                onClick={startVideoGeneration}
                disabled={videoGenerating || videoImages.length === 0}
                className="w-full bg-primary hover:bg-primary/90"
                data-testid="button-generate-video"
              >
                {videoGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4 mr-2" />
                    Generate Video
                  </>
                )}
              </Button>
              </> }

              {completedVideos.length > 0 && (
                <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                  <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Completed Videos ({completedVideos.length})
                  </h5>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {completedVideos.map((video, index) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between bg-white dark:bg-gray-800 rounded p-2 text-xs"
                      >
                        <span className="truncate flex-1">{video.label}</span>
                        <button
                          onClick={() => setCompletedVideos(prev => prev.filter((_, i) => i !== index))}
                          className="ml-2 text-red-500 hover:text-red-700"
                          data-testid={`button-remove-completed-video-${index}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  {completedVideos.length >= 2 && (
                    <Button
                      onClick={async () => {
                        setCombiningVideos(true);
                        try {
                          const token = getAuthToken();
                          const headers: Record<string, string> = {
                            "Content-Type": "application/json",
                          };
                          if (token) {
                            headers["Authorization"] = `Bearer ${token}`;
                          }

                          const response = await fetch("/api/ai/veo/combine", {
                            method: "POST",
                            headers,
                            credentials: "include",
                            body: JSON.stringify({
                              videoUrls: completedVideos.map(v => v.url),
                              title: "Full Property Tour",
                            }),
                          });

                          if (!response.ok) {
                            const errorData = await response.json().catch(() => ({}));
                            throw new Error(errorData.error || "Failed to combine videos");
                          }

                          const data = await response.json();
                          
                          const assistantMessage: Message = {
                            role: "assistant",
                            content: `Full property tour created! Combined ${completedVideos.length} videos into one seamless tour:`,
                            videoUrl: data.videoUrl,
                          };
                          setMessages(prev => [...prev, assistantMessage]);
                          setCompletedVideos([]);
                          setVideoMode(false);
                          
                          toast({
                            title: "Full Tour Created",
                            description: `Combined ${completedVideos.length} videos into a complete property tour!`,
                          });
                        } catch (error: any) {
                          toast({
                            title: "Failed to Create Tour",
                            description: error.message || "An error occurred while combining videos.",
                            variant: "destructive",
                          });
                        } finally {
                          setCombiningVideos(false);
                        }
                      }}
                      disabled={combiningVideos}
                      className="w-full mt-3 bg-green-600 hover:bg-green-700"
                      data-testid="button-create-full-tour"
                    >
                      {combiningVideos ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Creating Full Tour...
                        </>
                      ) : (
                        <>
                          <Video className="h-4 w-4 mr-2" />
                          Create Full House Tour
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {videoEditMode && (
          <div className="flex-1 px-4 py-3 bg-orange-50 dark:bg-orange-900/20 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setVideoEditMode(false); setSelectedVideoIds(new Set()); }}
                className="h-7 px-2"
                data-testid="button-exit-video-edit-mode"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <h4 className="font-medium text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Scissors className="h-4 w-4 text-orange-600" />
                Video Edit / Stitch
              </h4>
              <div className="ml-auto">
                <input
                  ref={videoUploadInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/*"
                  className="hidden"
                  onChange={handleVideoUpload}
                  data-testid="input-video-upload"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => videoUploadInputRef.current?.click()}
                  disabled={uploadingVideo}
                  className="h-7 px-2 text-xs"
                  data-testid="button-upload-video"
                >
                  {uploadingVideo ? (
                    <><Loader2 className="h-3 w-3 animate-spin mr-1" />Uploading...</>
                  ) : (
                    <><Upload className="h-3 w-3 mr-1" />Upload Video</>
                  )}
                </Button>
              </div>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              Select 2 or more videos to combine into one with crossfade transitions.
            </p>

            {userVideosLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Loading your videos...</span>
              </div>
            ) : userVideos.length === 0 ? (
              <div className="text-center py-8">
                <Video className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No videos found</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Upload a video or generate some using the Video generator.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {userVideos.map((video) => {
                  const isSelected = selectedVideoIds.has(video.id);
                  const selectionOrder = isSelected ? Array.from(selectedVideoIds).indexOf(video.id) + 1 : 0;
                  return (
                    <div
                      key={video.id}
                      onClick={() => toggleVideoSelection(video.id)}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-colors",
                        isSelected
                          ? "border-orange-500 bg-orange-100 dark:bg-orange-900/30"
                          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-orange-300"
                      )}
                      data-testid={`video-edit-item-${video.id}`}
                    >
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold",
                        isSelected ? "bg-orange-500 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                      )}>
                        {isSelected ? selectionOrder : <Check className="h-3 w-3" />}
                      </div>
                      {video.videoUrl && (
                        <div className="w-16 h-10 rounded overflow-hidden flex-shrink-0 bg-black">
                          <video
                            src={video.videoUrl}
                            className="w-full h-full object-cover"
                            muted
                            preload="metadata"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          {video.title || "Untitled Video"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(video.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedVideoIds.size > 0 && (
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                {selectedVideoIds.size} video{selectedVideoIds.size !== 1 ? "s" : ""} selected
              </p>
            )}

            <Button
              onClick={handleStitchVideos}
              disabled={stitchingVideos || selectedVideoIds.size < 2}
              className="w-full mt-3 bg-orange-600 hover:bg-orange-700"
              data-testid="button-stitch-videos"
            >
              {stitchingVideos ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Stitching Videos...</>
              ) : (
                <><Scissors className="h-4 w-4 mr-2" />Stitch {selectedVideoIds.size} Videos</>
              )}
            </Button>
          </div>
        )}

        {!videoMode && !videoEditMode && (
        <div
          ref={scrollAreaRef}
          className="flex-1 min-h-0 overflow-y-auto px-4 py-4"
          data-testid="scroll-area-messages"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400 py-8">
              <Sparkles className="h-12 w-12 mb-4 text-primary/50" />
              <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                How can I help you today?
              </h3>
              <p className="text-sm max-w-sm">
                I can help you create social media posts, blog articles, property descriptions, and more. 
                Try one of the quick actions above or type your own message.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                  data-testid={`message-${message.role}-${index}`}
                >
                  {message.role === "assistant" && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-4 py-2 text-sm",
                      message.role === "user"
                        ? "bg-primary text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    )}
                  >
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {message.attachments.map((attachment, idx) => (
                          <div key={idx}>
                            {attachment.type.startsWith('image/') ? (
                              <div className="w-[200px] h-[140px] rounded overflow-hidden flex-shrink-0">
                                <img 
                                  src={attachment.url} 
                                  alt={attachment.name}
                                  className="w-full h-full object-contain bg-black/5"
                                />
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 bg-white/20 dark:bg-black/20 rounded px-2 py-1 text-xs">
                                <FileText className="h-3 w-3" />
                                <span className="truncate max-w-[100px]">{attachment.name}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.imageUrl && (
                      <div className="mt-3">
                        <img
                          src={message.imageUrl}
                          alt="AI generated image"
                          className="max-w-full rounded-lg shadow-md"
                          data-testid={`img-generated-${index}`}
                        />
                        <div className="flex gap-2 mt-2">
                          <a
                            href={message.imageUrl}
                            download={`ai-image-${index}.png`}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            data-testid={`btn-download-image-${index}`}
                          >
                            <Download className="h-3 w-3" />
                            Download
                          </a>
                          <a
                            href={message.imageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                            data-testid={`link-open-image-${index}`}
                          >
                            Open in new tab
                          </a>
                        </div>
                      </div>
                    )}
                    {message.videoUrl && (
                      <div className="mt-3">
                        <video
                          src={message.videoUrl}
                          controls
                          className="max-w-full rounded-lg"
                          data-testid={`video-${index}`}
                        />
                        <a
                          href={message.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline mt-2 inline-block"
                        >
                          Open in new tab
                        </a>
                      </div>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <User className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 justify-start" data-testid="message-loading">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              {videoGenerating && (
                <div className="flex gap-3 justify-start" data-testid="message-video-generating">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Generating video... This may take a few minutes.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        )}

        {!videoMode && !videoEditMode && (
        <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gray-50 dark:bg-gray-800/50">
          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedFiles.map((file, index) => (
                <div 
                  key={index} 
                  className="relative group bg-gray-100 dark:bg-gray-800 rounded-lg p-2 flex items-center gap-2"
                >
                  {file.type.startsWith('image/') ? (
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt={file.name}
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-gray-500" />
                    </div>
                  )}
                  <span className="text-xs text-gray-600 dark:text-gray-400 max-w-[100px] truncate">
                    {file.name}
                  </span>
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`button-remove-file-${index}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.txt,.doc,.docx,.csv"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-file-upload"
          />
          
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="flex-shrink-0 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
              data-testid="button-upload-file"
              title="Upload images or files"
            >
              <Paperclip className="h-4 w-4 text-gray-500" />
            </Button>
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              data-testid="input-message"
            />
            <Button
              onClick={sendMessage}
              disabled={(!input.trim() && selectedFiles.length === 0) || isLoading}
              className="bg-primary hover:bg-primary/90 text-white"
              data-testid="button-send-message"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          {messages.length > 0 && (
            <div className="mt-2 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearConversation}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                data-testid="button-clear-conversation"
              >
                Clear conversation
              </Button>
            </div>
          )}
        </div>
        )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useAIAssistantDialog() {
  const [open, setOpen] = useState(false);
  
  return {
    open,
    setOpen,
    openDialog: () => setOpen(true),
    closeDialog: () => setOpen(false),
  };
}
