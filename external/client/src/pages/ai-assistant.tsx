import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bot,
  Download,
  File,
  Image,
  Loader2,
  Paperclip,
  Plus,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";
import { detectCreateSelfAvatarIntent } from "@shared/avatarIntent";

interface LocalAssistantMessage {
  id: string;
  content: string;
  cta: { label: string; href: string };
}

interface Attachment {
  url: string;
  type: string;
  name: string;
}

interface Message {
  id: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  attachments: Attachment[] | null;
  createdAt: string;
}

interface ChatResponse {
  userMessage: Message;
  assistantMessage: Message;
}

interface HistoryResponse {
  messages: Message[];
}

export default function AiAssistantPage() {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isNewChat, setIsNewChat] = useState(false);
  const [localMessages, setLocalMessages] = useState<LocalAssistantMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: historyData, isLoading: isLoadingHistory } = useQuery<HistoryResponse>({
    queryKey: ["/api/ai-assistant/history"],
  });

  const allMessages = historyData?.messages || [];
  const messages = isNewChat ? [] : allMessages;

  const chatMutation = useMutation({
    mutationFn: async ({ text, files }: { text: string; files: File[] }) => {
      const formData = new FormData();
      formData.append("message", text);
      files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await apiRequest("POST", "/api/ai-assistant/chat", formData);
      return response.json() as Promise<ChatResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-assistant/history"] });
      setIsNewChat(false);
      setMessage("");
      setSelectedFiles([]);
      setPreviewUrls([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const clearHistoryMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/ai-assistant/history");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-assistant/history"] });
      setLocalMessages([]);
      toast({
        title: "Chat cleared",
        description: "Your chat history has been cleared.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to clear chat",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatMutation.isPending]);

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const totalFiles = selectedFiles.length + files.length;
    if (totalFiles > 5) {
      toast({
        title: "Too many files",
        description: "You can only upload up to 5 files at a time.",
        variant: "destructive",
      });
      return;
    }

    const newPreviewUrls = files
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => URL.createObjectURL(file));

    setSelectedFiles((prev) => [...prev, ...files]);
    setPreviewUrls((prev) => [...prev, ...newPreviewUrls]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    const file = selectedFiles[index];
    if (file?.type.startsWith("image/")) {
      const previewIndex = selectedFiles
        .slice(0, index + 1)
        .filter((f) => f.type.startsWith("image/")).length - 1;
      if (previewUrls[previewIndex]) {
        URL.revokeObjectURL(previewUrls[previewIndex]);
        setPreviewUrls((prev) => prev.filter((_, i) => i !== previewIndex));
      }
    }
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = () => {
    if (!message.trim() && selectedFiles.length === 0) return;
    if (selectedFiles.length === 0 && detectCreateSelfAvatarIntent(message)) {
      setLocalMessages((prev) => [
        ...prev,
        {
          id: `self-avatar-${Date.now()}`,
          content: message,
          cta: { label: "Open Photo Avatars", href: "/dashboard?action=upload#photo-avatars" },
        },
      ]);
      setMessage("");
      return;
    }
    chatMutation.mutate({ text: message, files: selectedFiles });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderAttachment = (attachment: Attachment) => {
    const isImage = attachment.type.startsWith("image/");

    if (isImage) {
      return (
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block max-w-xs"
          data-testid={`attachment-image-${attachment.name}`}
        >
          <img
            src={attachment.url}
            alt={attachment.name}
            className="rounded-lg max-h-48 object-contain hover:opacity-90 transition-opacity"
          />
        </a>
      );
    }

    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors max-w-xs"
        data-testid={`attachment-file-${attachment.name}`}
      >
        <File className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm truncate">{attachment.name}</span>
        <Download className="h-4 w-4 flex-shrink-0 ml-auto" />
      </a>
    );
  };

  const renderMessage = (msg: Message) => {
    const isUser = msg.role === "user";
    const attachments = msg.attachments || [];

    return (
      <div
        key={msg.id}
        className={cn(
          "flex gap-3 mb-4",
          isUser ? "flex-row-reverse" : "flex-row"
        )}
        data-testid={`message-${msg.role}-${msg.id}`}
      >
        <div
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
            isUser ? "bg-primary text-primary-foreground" : "bg-muted"
          )}
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </div>

        <div
          className={cn(
            "max-w-[75%] space-y-2",
            isUser ? "items-end" : "items-start"
          )}
        >
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((attachment, idx) => (
                <div key={idx}>{renderAttachment(attachment)}</div>
              ))}
            </div>
          )}

          {msg.content && (
            <div
              className={cn(
                "rounded-2xl px-4 py-2 whitespace-pre-wrap",
                isUser
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-muted rounded-tl-sm"
              )}
            >
              {msg.content}
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            {new Date(msg.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView="ai-assistant" />

      <main className="flex-1 flex flex-col overflow-hidden">
        <Card className="flex-1 m-4 flex flex-col overflow-hidden">
          <CardHeader className="flex-shrink-0 border-b flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <CardTitle>AI Assistant</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsNewChat(true);
                  setMessage("");
                  setSelectedFiles([]);
                  setPreviewUrls([]);
                  setLocalMessages([]);
                  toast({ title: "New chat started", description: "Your previous history is preserved." });
                }}
                data-testid="button-new-chat"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearHistoryMutation.mutate()}
                disabled={clearHistoryMutation.isPending || allMessages.length === 0}
                data-testid="button-clear-chat"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear History
              </Button>
            </div>
          </CardHeader>

          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 && localMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <Bot className="h-16 w-16 mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">
                    Welcome to AI Assistant
                  </h3>
                  <p className="max-w-md">
                    I can help you with property descriptions, market analysis,
                    social media posts, and more. Feel free to upload images for
                    me to analyze!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map(renderMessage)}

                  {localMessages.map((lm) => (
                    <div key={lm.id} data-testid={`message-self-avatar-${lm.id}`}>
                      <div className="flex gap-3 mb-4 flex-row-reverse">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="max-w-[75%] space-y-2 items-end">
                          <div className="rounded-2xl px-4 py-2 whitespace-pre-wrap bg-primary text-primary-foreground rounded-tr-sm">
                            {lm.content}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3 mb-4">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <Bot className="h-4 w-4" />
                        </div>
                        <div className="max-w-[75%] space-y-2">
                          <div className="rounded-2xl rounded-tl-sm px-4 py-2 bg-muted">
                            To create a Photo Avatar of yourself, head to Photo Avatars. Upload a clear headshot and we'll train your avatar so you can use it in any video.
                          </div>
                          <a
                            href={lm.cta.href}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
                            data-testid="button-open-photo-avatars"
                          >
                            {lm.cta.label}
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}

                  {chatMutation.isPending && (
                    <div className="flex gap-3 mb-4" data-testid="loading-indicator">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {selectedFiles.length > 0 && (
              <div className="flex-shrink-0 px-4 py-2 border-t bg-muted/30">
                <div className="flex flex-wrap gap-2">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="relative group"
                      data-testid={`selected-file-${index}`}
                    >
                      {file.type.startsWith("image/") ? (
                        <div className="relative">
                          <img
                            src={previewUrls[
                              selectedFiles
                                .slice(0, index + 1)
                                .filter((f) => f.type.startsWith("image/")).length - 1
                            ]}
                            alt={file.name}
                            className="h-16 w-16 object-cover rounded-lg"
                          />
                          <button
                            onClick={() => removeFile(index)}
                            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`remove-file-${index}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="relative flex items-center gap-2 bg-muted px-3 py-2 rounded-lg">
                          <File className="h-4 w-4" />
                          <span className="text-sm truncate max-w-[100px]">
                            {file.name}
                          </span>
                          <button
                            onClick={() => removeFile(index)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`remove-file-${index}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-shrink-0 p-4 border-t flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt,.csv"
                className="hidden"
                data-testid="input-file-upload"
              />

              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={chatMutation.isPending}
                data-testid="button-attach-file"
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              <Textarea
                ref={textareaRef}
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={chatMutation.isPending}
                className="min-h-[44px] max-h-32 resize-none"
                rows={1}
                data-testid="input-message"
              />

              <Button
                onClick={handleSend}
                disabled={
                  chatMutation.isPending ||
                  (!message.trim() && selectedFiles.length === 0)
                }
                data-testid="button-send-message"
              >
                {chatMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
