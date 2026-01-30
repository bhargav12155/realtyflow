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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAuthToken } from "@/lib/authToken";

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
  const [videoImageUrl, setVideoImageUrl] = useState("");
  const [videoGenerating, setVideoGenerating] = useState(false);
  const [videoOperationId, setVideoOperationId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const startVideoGeneration = async () => {
    if (!videoImageUrl.trim()) {
      toast({
        title: "Image URL Required",
        description: "Please enter an image URL for the video source.",
        variant: "destructive",
      });
      return;
    }

    setVideoGenerating(true);

    const userMessage: Message = {
      role: "user",
      content: `Generate a ${videoPresets.find(p => p.value === videoPreset)?.label || videoPreset} video from: ${videoImageUrl}`,
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
          imageUrl: videoImageUrl,
          preset: videoPreset,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to start video generation");
      }

      const data = await response.json();
      setVideoOperationId(data.operationId);

      const assistantMessage: Message = {
        role: "assistant",
        content: "Video generation started! This may take a few minutes. I'll notify you when it's ready...",
      };
      setMessages(prev => [...prev, assistantMessage]);

      setVideoImageUrl("");
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

    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
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
        content: data.response || data.message || "I apologize, but I couldn't generate a response. Please try again.",
      };
      
      setMessages([...updatedMessages, assistantMessage]);
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
      setMessages([...updatedMessages, errorMessage]);
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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[600px] h-[80vh] max-h-[700px] flex flex-col p-0 gap-0 bg-white dark:bg-gray-900"
        data-testid="dialog-ai-assistant"
      >
        <DialogHeader className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Assistant
          </DialogTitle>
        </DialogHeader>

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

        {videoMode && (
          <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-center gap-2 mb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setVideoMode(false)}
                className="h-8 px-2"
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
            
            <div className="space-y-3">
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
                <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Source Image URL</label>
                <Input
                  value={videoImageUrl}
                  onChange={(e) => setVideoImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="bg-white dark:bg-gray-900"
                  data-testid="input-video-image-url"
                />
              </div>

              <Button
                onClick={startVideoGeneration}
                disabled={videoGenerating || !videoImageUrl.trim()}
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
            </div>
          </div>
        )}

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
