import * as React from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Share2, Eye, Loader2, Send, Calendar, ImageIcon, Video, X, Sparkles, Download, Clock, RefreshCw, Info, Repeat } from "lucide-react";

interface SocialMediaAccount {
  id: number;
  platform: string;
  isConnected: boolean;
  accessToken?: string;
}

const platformIcons: Record<string, any> = {
  facebook: { icon: Share2, color: "text-blue-600" },
  instagram: { icon: Share2, color: "text-pink-600" },
  linkedin: { icon: Share2, color: "text-blue-700" },
  x: { icon: Share2, color: "text-foreground" },
  twitter: { icon: Share2, color: "text-foreground" },
  tiktok: { icon: Video, color: "text-foreground" },
  youtube: { icon: Video, color: "text-red-600" },
  whatsapp: { icon: Share2, color: "text-green-600" },
};

export function SocialMediaManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [postContent, setPostContent] = React.useState("");
  const [selectedPlatforms, setSelectedPlatforms] = React.useState<string[]>([]);
  const [showPreview, setShowPreview] = React.useState(false);
  const [selectedMediaIds, setSelectedMediaIds] = React.useState<string[]>([]);
  const [selectedPropertyPhotoUrl, setSelectedPropertyPhotoUrl] = React.useState<string | null>(null);

  const { data: accounts } = useQuery<SocialMediaAccount[]>({
    queryKey: ["/api/social-accounts"],
  });

  const postMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/social-post", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Post published successfully" });
      setPostContent("");
      setSelectedPlatforms([]);
      setSelectedMediaIds([]);
      setSelectedPropertyPhotoUrl(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handlePost = () => {
    if (!postContent.trim() && selectedMediaIds.length === 0 && !selectedPropertyPhotoUrl) return;
    postMutation.mutate({
      content: postContent,
      platforms: selectedPlatforms,
      mediaIds: selectedMediaIds,
      propertyPhotoUrl: selectedPropertyPhotoUrl
    });
  };

  const agentName = user?.username || "Agent";

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Social Media Manager
          </CardTitle>
          <CardDescription>Create and publish posts across your social platforms</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Select Platforms</Label>
            <div className="flex flex-wrap gap-2">
              {accounts?.filter(a => a.isConnected).map((account) => {
                const isSelected = selectedPlatforms.includes(account.platform);
                return (
                  <Button
                    key={account.platform}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedPlatforms(selectedPlatforms.filter(p => p !== account.platform));
                      } else {
                        setSelectedPlatforms([...selectedPlatforms, account.platform]);
                      }
                    }}
                  >
                    {account.platform}
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="post-content">Post Content</Label>
            <Textarea
              id="post-content"
              placeholder="What would you like to share?"
              className="min-h-[150px]"
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPreview(true)} disabled={!postContent.trim()}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button onClick={handlePost} disabled={postMutation.isPending || selectedPlatforms.length === 0}>
              {postMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {postMutation.isPending ? "Posting..." : "Post Now"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Post Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex flex-wrap gap-2">
              {selectedPlatforms.map(p => (
                <span key={p} className="text-xs bg-muted px-2 py-1 rounded-full capitalize">{p}</span>
              ))}
            </div>
            <div className="border rounded-lg p-4 bg-muted/30">
              <div className="flex items-start gap-3 mb-2">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xs font-bold">
                  {agentName.charAt(0)}
                </div>
                <div>
                  <div className="font-medium text-sm">{agentName}</div>
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap">{postContent}</p>
              {selectedPropertyPhotoUrl && (
                <img src={selectedPropertyPhotoUrl} className="mt-3 rounded-md w-full h-40 object-cover" alt="Preview" />
              )}
              {selectedMediaIds.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {selectedMediaIds.map((url, i) => (
                    <img key={i} src={url} className="rounded-md h-20 w-full object-cover" alt={`Media ${i}`} />
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SocialMediaManager;
