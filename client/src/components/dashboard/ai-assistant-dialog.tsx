import { useState, useRef, useEffect, useCallback } from "react";
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
];

const videoPresets = [
  { value: "tiktok", label: "TikTok/Reels (8s, Portrait)" },
  { value: "youtube-shorts", label: "YouTube Shorts (8s, Portrait)" },
  { value: "instagram-stories", label: "Instagram Stories (8s, Portrait)" },
  { value: "facebook-feed", label: "Facebook Feed (8s, Landscape)" },
  { value: "linkedin-feed", label: "LinkedIn Feed (8s, Landscape)" },
  { value: "commercial-15", label: "Commercial Spot (4s, Landscape)" },
  { value: "commercial-30", label: "Commercial Spot (8s, Landscape)" },
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
  const [videoPreset, setVideoPreset] = useState<string>("tiktok");
  const [spaceType, setSpaceType] = useState<"interior" | "exterior">("interior");
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
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoImageInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
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
      if (!token) return;
      
      const response = await fetch("/api/ai/chat-sessions", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
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
      if (!token) return null;
      
      const response = await fetch("/api/ai/chat-sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
      if (!token) return;
      
      const body: { messages: Message[]; title?: string } = { messages: sessionMessages };
      if (title) body.title = title;
      
      await fetch(`/api/ai/chat-sessions/${sessionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
      if (!token) return;
      
      const response = await fetch(`/api/ai/chat-sessions/${sessionId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
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
      if (!token) return;
      
      const response = await fetch(`/api/ai/chat-sessions/${sessionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
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
      const defaultRoomType = spaceType === "interior" ? "living-room" : "front-yard";
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

      const assistantMessage: Message = {
        role: "assistant",
        content: "Video generation started! This may take a few minutes. I'll notify you when it's ready...",
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

        {!videoMode && (
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
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Space Type</label>
                  <Select value={spaceType} onValueChange={(val: "interior" | "exterior") => setSpaceType(val)}>
                    <SelectTrigger className="w-full" data-testid="select-space-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {spaceTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
                  Property Images ({videoImages.length}/3) - Select room type for each
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
                    const currentRoomOptions = spaceType === "interior" ? interiorRoomTypes : exteriorRoomTypes;
                    const currentRoomType = currentRoomOptions.find(r => r.value === img.roomType);
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2"
                      >
                        <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                          <img
                            src={img.preview || img.url}
                            alt={`Property ${index + 1}`}
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
                              <SelectValue placeholder="Select room type" />
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
                          <span className="text-xs text-gray-500">Add {spaceType === "interior" ? "Room" : "Exterior"} Image</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Tip: For 3 images use triangle positioning (left → right → opposite view)
                </p>
                <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
                  VEO API: 10 requests/min, pay-per-use ($0.75/sec), no daily limit
                </p>
              </div>

              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
                  Custom Description (Optional)
                </label>
                <textarea
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder="Add notes about this property, like '4BR/3BA with updated kitchen, open concept living area...' This will be included in the video generation."
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

        {!videoMode && (
        <ScrollArea 
          ref={scrollAreaRef}
          className="flex-1 px-4 py-4"
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
                              <img 
                                src={attachment.url} 
                                alt={attachment.name}
                                className="max-w-[150px] max-h-[100px] rounded object-cover"
                              />
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
        </ScrollArea>
        )}

        {!videoMode && (
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
