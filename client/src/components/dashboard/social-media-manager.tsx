import * as React from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Share2, Eye, Loader2, Send, Sparkles, 
  Info, Facebook, Instagram, Linkedin, Twitter, Music, Youtube, MessageSquare
} from "lucide-react";
import { PropertySelector } from "./property-selector";
import { MediaLibrary } from "./media-library";

interface SocialMediaAccount {
  id: number;
  platform: string;
  isConnected: boolean;
  accessToken?: string;
  metadata?: any;
}

const platformIcons: Record<string, any> = {
  facebook: { icon: Facebook, color: "text-blue-600" },
  instagram: { icon: Instagram, color: "text-pink-600" },
  linkedin: { icon: Linkedin, color: "text-blue-700" },
  twitter: { icon: Twitter, color: "text-sky-500" },
  x: { icon: Twitter, color: "text-foreground" },
  tiktok: { icon: Music, color: "text-foreground" },
  youtube: { icon: Youtube, color: "text-red-600" },
  whatsapp: { icon: MessageSquare, color: "text-green-600" },
};

export function SocialMediaManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [postContent, setPostContent] = React.useState("");
  const [selectedPlatforms, setSelectedPlatforms] = React.useState<string[]>([]);
  const [showPreview, setShowPreview] = React.useState(false);
  const [selectedMediaIds, setSelectedMediaIds] = React.useState<string[]>([]);
  const [tiktokVideoUrl, setTiktokVideoUrl] = React.useState("");
  const [selectedProperty, setSelectedProperty] = React.useState<any>(null);
  const [isGeneratingAi, setIsGeneratingAi] = React.useState(false);

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
      setTiktokVideoUrl("");
      setSelectedProperty(null);
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAiOptimize = async () => {
    if (!postContent) return;
    setIsGeneratingAi(true);
    try {
      const res = await apiRequest("POST", "/api/ai/optimize-post", { content: postContent });
      const data = await res.json();
      setPostContent(data.optimizedContent);
      toast({ title: "AI Optimized", description: "Your post has been optimized for engagement." });
    } catch (err) {
      toast({ title: "AI Error", description: "Failed to optimize post.", variant: "destructive" });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handlePost = () => {
    if (!postContent.trim() && selectedMediaIds.length === 0) {
      toast({ title: "Validation Error", description: "Please add content or media.", variant: "destructive" });
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast({ title: "Validation Error", description: "Please select at least one platform.", variant: "destructive" });
      return;
    }

    postMutation.mutate({
      content: postContent,
      platforms: selectedPlatforms,
      mediaIds: selectedMediaIds,
      tiktokVideoUrl,
      propertyId: selectedProperty?.id
    });
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
    );
  };

  const agentName = user?.username || "Agent";

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quick Posts</h1>
          <p className="text-muted-foreground">Create and publish content across all your social channels instantly.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPreview(true)} disabled={!postContent.trim()}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button onClick={handlePost} disabled={postMutation.isPending || selectedPlatforms.length === 0}>
            {postMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            {postMutation.isPending ? "Posting..." : "Post Now"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Compose Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="post-content">What's on your mind?</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs text-primary h-7 px-2"
                    onClick={handleAiOptimize}
                    disabled={isGeneratingAi || !postContent}
                  >
                    {isGeneratingAi ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                    AI Optimize
                  </Button>
                </div>
                <Textarea
                  id="post-content"
                  placeholder="Share an update, property highlight, or market insight..."
                  className="min-h-[200px] text-base resize-none"
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{postContent.length} characters</span>
                  {selectedPlatforms.includes('twitter') && (
                    <span className={postContent.length > 280 ? "text-destructive font-medium" : ""}>
                      X (Twitter): {280 - postContent.length} left
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Attach Property (Optional)</Label>
                  <PropertySelector onSelect={setSelectedProperty} selectedPropertyId={selectedProperty?.id} />
                </div>
                {selectedPlatforms.includes('tiktok') && (
                  <div className="space-y-2">
                    <Label>TikTok Video URL</Label>
                    <Input 
                      placeholder="Paste TikTok video URL..." 
                      value={tiktokVideoUrl}
                      onChange={(e) => setTiktokVideoUrl(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Media Gallery</CardTitle>
              <CardDescription>Select images or videos to include in your post.</CardDescription>
            </CardHeader>
            <CardContent>
              <MediaLibrary 
                onSelect={(ids) => setSelectedMediaIds(ids)} 
                selectedIds={selectedMediaIds}
                multiSelect={true}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Target Platforms</CardTitle>
              <CardDescription>Choose where to publish your post.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-2">
                {accounts?.filter(a => a.isConnected).map((account) => {
                  const isSelected = selectedPlatforms.includes(account.platform);
                  const Icon = platformIcons[account.platform.toLowerCase()]?.icon || Share2;
                  const color = platformIcons[account.platform.toLowerCase()]?.color || "text-foreground";
                  
                  return (
                    <Button
                      key={account.platform}
                      variant={isSelected ? "default" : "outline"}
                      className={`justify-start h-12 ${isSelected ? "" : "hover:bg-secondary/50"}`}
                      onClick={() => togglePlatform(account.platform)}
                    >
                      <div className={`mr-3 p-1.5 rounded-md bg-background ${isSelected ? "text-primary-foreground" : color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="capitalize font-medium">{account.platform}</span>
                      {isSelected && <Badge variant="secondary" className="ml-auto bg-primary-foreground/20 text-primary-foreground border-none">Selected</Badge>}
                    </Button>
                  );
                })}
                {(!accounts || accounts.filter(a => a.isConnected).length === 0) && (
                  <div className="text-center py-6 border border-dashed rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-3">No accounts connected</p>
                    <Button variant="link" size="sm" asChild>
                      <a href="/settings">Connect Accounts</a>
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Pro Tip: Multi-Posting</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Posting to multiple platforms at once can save hours of work. AI Optimize ensures your hashtags and tone match each platform's unique style.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl overflow-hidden p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Post Preview</DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Preview Content</h4>
                <div className="border rounded-xl p-5 bg-card shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold shadow-inner">
                      {agentName.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-sm leading-none">{agentName}</div>
                      <div className="text-xs text-muted-foreground mt-1">Just now • BHHS Real Estate</div>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{postContent}</p>
                  
                  {selectedProperty && (
                    <div className="mt-4 border rounded-lg overflow-hidden bg-muted/30">
                      <div className="aspect-video relative">
                        <img src={selectedProperty.images?.[0] || "/placeholder-property.jpg"} className="object-cover w-full h-full" alt="Property" />
                        <div className="absolute bottom-2 right-2">
                          <Badge variant="secondary" className="bg-black/60 text-white border-none backdrop-blur-md">
                            ${selectedProperty.price?.toLocaleString()}
                          </Badge>
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="text-sm font-bold truncate">{selectedProperty.address}</div>
                        <div className="text-xs text-muted-foreground">{selectedProperty.beds} beds • {selectedProperty.baths} baths</div>
                      </div>
                    </div>
                  )}

                  {selectedMediaIds.length > 0 && (
                    <div className={`mt-4 grid gap-2 ${selectedMediaIds.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                      {selectedMediaIds.map((url, i) => (
                        <div key={i} className="aspect-square rounded-lg overflow-hidden border">
                          <img src={url} className="w-full h-full object-cover" alt={`Upload ${i}`} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Destinations</h4>
                <div className="space-y-2">
                  {selectedPlatforms.map(platform => (
                    <div key={platform} className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                      <div className="flex items-center gap-2">
                        {React.createElement(platformIcons[platform.toLowerCase()]?.icon || Share2, { 
                          className: `h-4 w-4 ${platformIcons[platform.toLowerCase()]?.color}` 
                        })}
                        <span className="text-sm font-medium capitalize">{platform}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] h-5">Verified</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 bg-muted/30">
            <Button variant="outline" onClick={() => setShowPreview(false)}>Close Preview</Button>
            <Button onClick={handlePost} disabled={postMutation.isPending}>
              {postMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Publish Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SocialMediaManager;
