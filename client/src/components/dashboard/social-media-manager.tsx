import { ObjectUploader } from "@/components/ObjectUploader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { friendlyError, messages } from "@/lib/messages";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MenuItem } from "@shared/schema";
import {
  Brain,
  AlertTriangle,
  Calendar,
  Check,
  Download,
  CheckCircle,
  Clock,
  CreditCard,
  Eye,
  Facebook,
  Home,
  Image,
  Info,
  Instagram,
  Linkedin,
  Loader2,
  Megaphone,
  MessageCircle,
  Music,
  Percent,
  Plug,
  PlugZap,
  RefreshCw,
  Repeat,
  Settings,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  TrendingDown,
  TrendingUp,
  Upload,
  Users,
  Utensils,
  Video,
  Wrench,
  Twitter as X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useBusinessType } from "@/lib/businessContext";
import { MediaLibrary } from "./media-library";
import { PropertySelector } from "./property-selector";
import { PostComposer } from "./post-composer";
import { ComplianceChecker } from "@/components/shared/compliance-checker";

interface SocialMediaAccount {
  id: string;
  platform: string;
  isConnected: boolean;
  lastSync?: string;
}

interface Property {
  id: string;
  mlsId: string;
  listPrice: number;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFootage: number | null;
  propertyType: string;
  listingStatus: string;
  listingDate: string;
  description: string;
  features: string[];
  photoUrls: string[];
  neighborhood: string | null;
  agentName: string | null;
}

const platformIcons = {
  facebook: { icon: Facebook, color: "text-blue-600" },
  instagram: { icon: Instagram, color: "text-pink-600" },
  linkedin: { icon: Linkedin, color: "text-blue-700" },
  x: { icon: X, color: "text-black dark:text-white" },
  tiktok: { icon: Music, color: "text-red-500" },
  youtube: { icon: Video, color: "text-red-600" },
  whatsapp: { icon: MessageCircle, color: "text-green-500" },
};

const POST_TYPES_BY_BUSINESS: Record<string, { id: string; label: string; icon: any; color: string; bgColor: string }[]> = {
  real_estate: [
    { id: "open_houses", label: "Open Houses", icon: Home, color: "text-orange-600", bgColor: "bg-orange-600/10" },
    { id: "just_listed", label: "Just Listed", icon: Tag, color: "text-blue-600", bgColor: "bg-blue-600/10" },
    { id: "just_sold", label: "Just Sold", icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-600/10" },
    { id: "price_improvement", label: "Price Decrease", icon: TrendingDown, color: "text-purple-600", bgColor: "bg-purple-600/10" },
    { id: "e_card", label: "E-Card", icon: CreditCard, color: "text-teal-600", bgColor: "bg-teal-600/10" },
    { id: "create_your_own", label: "Custom", icon: Upload, color: "text-indigo-600", bgColor: "bg-indigo-600/10" },
  ],
  restaurant: [
    { id: "daily_special", label: "Daily Special", icon: Utensils, color: "text-orange-600", bgColor: "bg-orange-600/10" },
    { id: "new_menu_item", label: "New Menu Item", icon: Star, color: "text-yellow-600", bgColor: "bg-yellow-600/10" },
    { id: "happy_hour", label: "Happy Hour", icon: Clock, color: "text-blue-600", bgColor: "bg-blue-600/10" },
    { id: "weekend_event", label: "Weekend Event", icon: Calendar, color: "text-pink-600", bgColor: "bg-pink-600/10" },
    { id: "customer_review", label: "Customer Review", icon: MessageCircle, color: "text-green-600", bgColor: "bg-green-600/10" },
    { id: "create_your_own", label: "Custom", icon: Upload, color: "text-indigo-600", bgColor: "bg-indigo-600/10" },
  ],
  home_services: [
    { id: "before_after", label: "Before & After", icon: Eye, color: "text-orange-600", bgColor: "bg-orange-600/10" },
    { id: "seasonal_deal", label: "Seasonal Deal", icon: Percent, color: "text-blue-600", bgColor: "bg-blue-600/10" },
    { id: "free_estimate", label: "Free Estimate", icon: Wrench, color: "text-green-600", bgColor: "bg-green-600/10" },
    { id: "customer_spotlight", label: "Customer Spotlight", icon: Star, color: "text-yellow-600", bgColor: "bg-yellow-600/10" },
    { id: "pro_tip", label: "Pro Tip", icon: Brain, color: "text-purple-600", bgColor: "bg-purple-600/10" },
    { id: "create_your_own", label: "Custom", icon: Upload, color: "text-indigo-600", bgColor: "bg-indigo-600/10" },
  ],
  retail: [
    { id: "new_arrival", label: "New Arrival", icon: ShoppingBag, color: "text-pink-600", bgColor: "bg-pink-600/10" },
    { id: "flash_sale", label: "Flash Sale", icon: Percent, color: "text-red-600", bgColor: "bg-red-600/10" },
    { id: "product_spotlight", label: "Product Spotlight", icon: Star, color: "text-yellow-600", bgColor: "bg-yellow-600/10" },
    { id: "customer_review", label: "Customer Review", icon: MessageCircle, color: "text-green-600", bgColor: "bg-green-600/10" },
    { id: "weekend_deal", label: "Weekend Deal", icon: Tag, color: "text-blue-600", bgColor: "bg-blue-600/10" },
    { id: "create_your_own", label: "Custom", icon: Upload, color: "text-indigo-600", bgColor: "bg-indigo-600/10" },
  ],
  professional_services: [
    { id: "client_success", label: "Client Success", icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-600/10" },
    { id: "expert_tip", label: "Expert Tip", icon: Brain, color: "text-purple-600", bgColor: "bg-purple-600/10" },
    { id: "free_consultation", label: "Free Consult", icon: Calendar, color: "text-blue-600", bgColor: "bg-blue-600/10" },
    { id: "industry_update", label: "Industry Update", icon: TrendingUp, color: "text-orange-600", bgColor: "bg-orange-600/10" },
    { id: "team_spotlight", label: "Team Spotlight", icon: Users, color: "text-teal-600", bgColor: "bg-teal-600/10" },
    { id: "create_your_own", label: "Custom", icon: Upload, color: "text-indigo-600", bgColor: "bg-indigo-600/10" },
  ],
  general_business: [
    { id: "announcement", label: "Announcement", icon: Megaphone, color: "text-orange-600", bgColor: "bg-orange-600/10" },
    { id: "behind_scenes", label: "Behind Scenes", icon: Eye, color: "text-blue-600", bgColor: "bg-blue-600/10" },
    { id: "team_spotlight", label: "Team Spotlight", icon: Users, color: "text-teal-600", bgColor: "bg-teal-600/10" },
    { id: "special_offer", label: "Special Offer", icon: Percent, color: "text-red-600", bgColor: "bg-red-600/10" },
    { id: "customer_review", label: "Customer Review", icon: Star, color: "text-yellow-600", bgColor: "bg-yellow-600/10" },
    { id: "create_your_own", label: "Custom", icon: Upload, color: "text-indigo-600", bgColor: "bg-indigo-600/10" },
  ],
};

const scheduledPosts = [
  {
    id: 1,
    content: "Market Update: Omaha home sales...",
    date: "Tomorrow 9:00 AM",
    platforms: "FB, IG, LI",
  },
  {
    id: 2,
    content: "New listing in Aksarben...",
    date: "Friday 2:00 PM",
    platforms: "All platforms",
  },
];

// Stock real estate photos collection
const stockPhotos = [
  {
    id: 1,
    url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=400&q=80",
    title: "Modern House Exterior",
  },
  {
    id: 2,
    url: "https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=400&q=80",
    title: "Real Estate Keys",
  },
  {
    id: 3,
    url: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=400&q=80",
    title: "Kitchen Interior",
  },
  {
    id: 4,
    url: "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=400&q=80",
    title: "Living Room",
  },
  {
    id: 5,
    url: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=400&q=80",
    title: "Home Exterior",
  },
  {
    id: 6,
    url: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=400&q=80",
    title: "Sold Sign",
  },
  {
    id: 7,
    url: "https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=400&q=80",
    title: "House with Garden",
  },
  {
    id: 8,
    url: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=400&q=80",
    title: "Neighborhood",
  },
];

function WhatsAppTemplateSelector({ selectedTemplate, onSelectTemplate }: { selectedTemplate: string; onSelectTemplate: (name: string) => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newHeader, setNewHeader] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newFooter, setNewFooter] = useState("");
  const [newCategory, setNewCategory] = useState("MARKETING");
  const [creating, setCreating] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<{ templates: any[] }>({
    queryKey: ["/api/whatsapp/templates"],
    staleTime: 5 * 60 * 1000,
  });

  const templates = data?.templates || [];

  const handleCreate = async () => {
    if (!newName.trim() || !newBody.trim()) {
      toast({ title: "Missing fields", description: "Please enter a template name and message body.", variant: "destructive" });
      return;
    }
    const safeName = newName.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 512);
    if (!safeName) {
      toast({ title: "Invalid name", description: "Template name must contain letters, numbers, or underscores.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res = await apiRequest("POST", "/api/whatsapp/templates", {
        name: safeName,
        header: newHeader.trim(),
        body: newBody.trim(),
        footer: newFooter.trim(),
        category: newCategory,
      });
      const result = await res.json();
      toast({ title: "Template Created", description: `"${safeName}" submitted for Meta review. It will appear as active once approved.` });
      setNewName("");
      setNewHeader("");
      setNewBody("");
      setNewFooter("");
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/templates"] });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message || "Could not create template.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mt-2">
        <Label className="text-xs">WhatsApp Template (Optional)</Label>
        <p className="text-xs text-muted-foreground mt-1">Loading templates...</p>
      </div>
    );
  }

  const statusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s === "APPROVED" || s.startsWith("ACTIVE")) return { label: "Active", color: "text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 border-green-200 dark:border-green-800", dot: "bg-green-500" };
    if (s === "PENDING") return { label: "Pending", color: "text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800", dot: "bg-amber-500" };
    if (s === "REJECTED") return { label: "Rejected", color: "text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/40 border-red-200 dark:border-red-800", dot: "bg-red-500" };
    return { label: status, color: "text-gray-600 bg-gray-100 border-gray-200", dot: "bg-gray-400" };
  };

  const activeTemplates = templates.filter((t: any) => {
    const s = (t.status || "").toUpperCase();
    return s === "APPROVED" || s.startsWith("ACTIVE");
  });
  const pendingTemplates = templates.filter((t: any) => (t.status || "").toUpperCase() === "PENDING");

  const formatTemplateName = (name: string) => {
    return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const categoryIcon = (cat: string) => {
    if ((cat || "").toUpperCase() === "UTILITY") return "🔧";
    return "📣";
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-xs font-semibold">Message Templates</Label>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
            {activeTemplates.length} active
          </span>
          {pendingTemplates.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">
              {pendingTemplates.length} pending
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all"
          data-testid="button-create-whatsapp-template"
        >
          {showCreate ? "Cancel" : "+ New Template"}
        </button>
      </div>

      {showCreate && (
        <div className="border border-green-200 dark:border-green-800 rounded-xl p-4 space-y-3 bg-gradient-to-br from-green-50/50 to-white dark:from-green-950/20 dark:to-background shadow-sm">
          <h4 className="text-xs font-semibold text-green-800 dark:text-green-300 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-md bg-green-600 flex items-center justify-center text-white text-[10px]">+</span>
            Create New Template
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] text-muted-foreground font-medium">Template Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. lunch_special"
                className="h-8 text-xs mt-0.5"
                data-testid="input-template-name"
              />
              <p className="text-[9px] text-muted-foreground mt-0.5">Lowercase, numbers, underscores</p>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground font-medium">Category</Label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="h-8 text-xs mt-0.5" data-testid="select-template-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MARKETING">📣 Marketing</SelectItem>
                  <SelectItem value="UTILITY">🔧 Utility</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground font-medium">Header (Optional)</Label>
            <Input
              value={newHeader}
              onChange={(e) => setNewHeader(e.target.value)}
              placeholder="e.g. Namaste Indian Restaurant"
              className="h-8 text-xs mt-0.5"
              maxLength={60}
              data-testid="input-template-header"
            />
            <p className="text-[9px] text-muted-foreground">{newHeader.length}/60</p>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground font-medium">Message Body</Label>
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="Write your template message here..."
              className="text-xs min-h-[70px] w-full rounded-lg border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 mt-0.5"
              data-testid="input-template-body"
            />
            <p className="text-[9px] text-muted-foreground">{newBody.length}/1024 characters</p>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground font-medium">Footer (Optional)</Label>
            <Input
              value={newFooter}
              onChange={(e) => setNewFooter(e.target.value)}
              placeholder="e.g. Order: (479) 346-0255 | namaste28.com"
              className="h-8 text-xs mt-0.5"
              maxLength={60}
              data-testid="input-template-footer"
            />
            <p className="text-[9px] text-muted-foreground">{newFooter.length}/60</p>
          </div>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={creating || !newName.trim() || !newBody.trim()}
            className="h-8 text-xs w-full bg-green-600 hover:bg-green-700 text-white rounded-lg"
            data-testid="button-submit-template"
          >
            {creating ? "Submitting..." : "Submit for Meta Review"}
          </Button>
          <p className="text-[9px] text-muted-foreground text-center">Templates are reviewed by Meta (usually within 24 hours)</p>
        </div>
      )}

      <Select value={selectedTemplate} onValueChange={onSelectTemplate}>
        <SelectTrigger className="h-9 text-xs rounded-lg border-green-200 dark:border-green-800 focus:ring-green-500" data-testid="select-whatsapp-template">
          <SelectValue placeholder="Send as free text (no template)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Send as free text (no template)</SelectItem>
          {templates.map((t: any) => {
            const isPending = (t.status || "").toUpperCase() === "PENDING";
            return (
              <SelectItem key={t.name} value={t.name} data-testid={`template-${t.name}`} disabled={isPending}>
                {categoryIcon(t.category)} {formatTemplateName(t.name)}{isPending ? " (pending)" : ""}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {templates.length > 0 && (
        <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
          {templates.map((t: any) => {
            const badge = statusBadge(t.status);
            const headerComp = t.components?.find((c: any) => c.type === "HEADER");
            const bodyComp = t.components?.find((c: any) => c.type === "BODY");
            const footerComp = t.components?.find((c: any) => c.type === "FOOTER");
            const headerText = headerComp?.text || "";
            const bodyText = bodyComp?.text || "";
            const footerText = footerComp?.text || "";
            const isSelected = selectedTemplate === t.name;
            const isPending = (t.status || "").toUpperCase() === "PENDING";
            return (
              <div
                key={t.name}
                className={`text-[11px] rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden ${
                  isSelected
                    ? "border-green-500 bg-green-50/50 dark:bg-green-950/20 shadow-sm shadow-green-200/50 dark:shadow-green-900/30"
                    : isPending
                      ? "border-amber-200/60 dark:border-amber-800/40 hover:border-amber-300 bg-amber-50/20 dark:bg-amber-950/10"
                      : "border-border/60 hover:border-green-300 dark:hover:border-green-700 hover:shadow-sm"
                }`}
                onClick={() => {
                  if (!isPending) onSelectTemplate(t.name);
                  setPreviewTemplate(previewTemplate?.name === t.name ? null : t);
                }}
                data-testid={`template-card-${t.name}`}
              >
                <div className="flex items-center gap-2.5 px-3 py-2.5">
                  <span className="text-sm flex-shrink-0">{categoryIcon(t.category)}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-foreground">{formatTemplateName(t.name)}</span>
                    {headerText && !previewTemplate?.name && (
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{headerText}</p>
                    )}
                  </div>
                  <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold border ${badge.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                    {badge.label}
                  </span>
                  {isSelected && (
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </span>
                  )}
                </div>
                {previewTemplate?.name === t.name && (
                  <div className="px-3 pb-3 pt-0 border-t border-border/30">
                    <div className="mt-2 rounded-lg bg-white dark:bg-background p-3 space-y-1.5 shadow-inner border border-border/20">
                      {headerText && (
                        <p className="font-bold text-foreground text-xs">{headerText}</p>
                      )}
                      {bodyText && (
                        <p className="text-muted-foreground text-[11px] leading-relaxed">{bodyText}</p>
                      )}
                      {footerText && (
                        <p className="text-muted-foreground/60 text-[10px] italic pt-1 border-t border-dashed border-border/30">{footerText}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedTemplate && selectedTemplate !== "none" && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
          <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
          <p className="text-[11px] text-green-700 dark:text-green-400 font-medium">
            Template: <span className="font-bold">{formatTemplateName(selectedTemplate)}</span> — sends without 24hr window restriction
          </p>
        </div>
      )}
    </div>
  );
}

const promoApps = [
  {
    id: "imakepage",
    name: "iMakePage",
    url: "imakepage.com",
    image: "/images/promo/imakepage-mockup.png",
    description: "Complete AI-powered real estate website platform with MLS/IDX integration, AI content generator, video studio with talking avatars, social media auto-posting, property tour videos, WhatsApp/SMS chatbots, event calendar, and SEO optimization. Used by 300+ agents. Plans: Basic $99/mo, Elite $249/mo (most popular), VIP $499/mo.",
    features: ["AI SEO", "AI Video Avatars", "Social Media Tools", "Lead Capture", "MLS Integration", "Property Tours"],
  },
  {
    id: "mygoldenbrick",
    name: "My Golden Brick",
    url: "mygoldenbrick.com",
    image: null,
    description: "Custom software development, marketing automation, auto-posting, and advanced SEO optimization company. Builds projects that drive results — from real estate tools to enterprise solutions. 98% client satisfaction, 500+ active users, 70% time reduction through automation.",
    features: ["Custom Development", "Marketing Automation", "Auto-Posting", "Advanced SEO", "AI Video", "Workflow Automation"],
  },
  {
    id: "imakevideo",
    name: "iMakeVideo",
    url: "imakevideo.com",
    image: "/images/promo/imakevideo-mockup.png",
    description: "AI-powered video creation with realistic avatars, property showcases, and automated editing. No camera, crew, or editing skills needed. 200+ agents use it to create 5-10 videos per week. Credit packages from $0.99.",
    features: ["AI Avatars", "Motion Videos", "Hand Gestures", "Batch Processing"],
  },
  {
    id: "aiflow",
    name: "AI Flow",
    url: "mygoldenbrick.com",
    image: "/images/promo/aiflow-mockup.png",
    description: "Automated client management and task tracking that saves agents 15+ hours per week. Smart reminders, automated follow-ups, and pipeline management that learns from your workflow patterns.",
    features: ["Automated Workflows", "Client Management", "Task Prioritization", "Performance Analytics"],
  },
  {
    id: "simplecma",
    name: "Simple CMA",
    url: "gbcma.us-east-2.elasticbeanstalk.com",
    image: "/images/promo/simplecma-mockup.png",
    description: "Automated market analysis tool that pulls comparable properties, calculates valuations, and generates professional PDF reports instantly. Win more listings with impressive, data-driven presentations.",
    features: ["Market Analysis", "Property Comparables", "Automated Reports", "Valuation Tools"],
  },
];

export function SocialMediaManager() {
  const { user } = useAuth();
  const { businessType, terms } = useBusinessType();
  const postTypes = POST_TYPES_BY_BUSINESS[businessType] ?? POST_TYPES_BY_BUSINESS.real_estate;
  const isRealEstate = terms.features.mlsSearch;
  const APP_PROMO_EMAILS = [
    "bhargav12155@gmail.com",
    "sudha@mygoldenbrick.com",
    "sgarikap@gmail.com",
    "mikebjork@mygoldenbrick.com",
    "mike.bjork@bhhsamb.com",
  ];
  const isAppPromoUser = APP_PROMO_EMAILS.includes(user?.email || "");
  const [postContent, setPostContent] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedPostType, setSelectedPostType] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null,
  );
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [facebookPages, setFacebookPages] = useState<any[]>([]);
  const [facebookPagesLoaded, setFacebookPagesLoaded] = useState(false);
  const [selectedFacebookPage, setSelectedFacebookPage] = useState<string>("");
  const [uploadedVideo, setUploadedVideo] = useState<File | null>(null);
  const [videoUploadUrl, setVideoUploadUrl] = useState<string | null>(null);
  const [showVideoUpload, setShowVideoUpload] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(
    null,
  );
  const [showPostComposer, setShowPostComposer] = useState(false);
  const [selectedPropertyPhotoUrl, setSelectedPropertyPhotoUrl] = useState<string | null>(null);
  const [tiktokVideoUploading, setTiktokVideoUploading] = useState(false);
  const [tiktokVideoUrl, setTiktokVideoUrl] = useState("");
  const tiktokFileRef = useRef<HTMLInputElement>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleRecurring, setScheduleRecurring] = useState("one-time");
  const [scheduleEndDate, setScheduleEndDate] = useState("");
  const [schedulePlatformOverrides, setSchedulePlatformOverrides] = useState<string[]>([]);
  const [scheduleGenerateUnique, setScheduleGenerateUnique] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [whatsappTo, setWhatsappTo] = useState("");
  const [whatsappTemplateName, setWhatsappTemplateName] = useState<string>("");
  const [isExtractingNumbers, setIsExtractingNumbers] = useState(false);
  const [selectedPromoApp, setSelectedPromoApp] = useState<string | null>(null);
  const [isGeneratingPromo, setIsGeneratingPromo] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{
    sent: number; failed: number; total: number; percent: number;
    queued?: number; estimatedRemaining?: number; message: string; complete?: boolean;
  } | null>(null);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [pendingBulkPayload, setPendingBulkPayload] = useState<any>(null);
  const { toast } = useToast();

  // Fetch company profile for dynamic content
  const { data: companyProfile } = useQuery<{
    agentName?: string;
    brokerageName?: string;
    businessName?: string;
  }>({
    queryKey: ["/api/company/profile"],
  });

  const { data: menuItemsList } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu-items"],
    enabled: !isRealEstate,
  });

  const { data: mediaAssets = [] } = useQuery<any[]>({
    queryKey: ["/api/media"],
  });

  // Get agent name and brokerage with smart defaults
  const isTikTokOnly = selectedPlatforms.length === 1 && selectedPlatforms[0] === "tiktok";
  const isWhatsAppOnly = selectedPlatforms.length === 1 && selectedPlatforms[0] === "whatsapp";
  const agentName = companyProfile?.agentName || "[Your Name]";
  const brokerageName = companyProfile?.brokerageName || "[Your Brokerage]";
  const businessName = companyProfile?.businessName || "[Your Business]";

  useEffect(() => {
    if (!selectedProperty) {
      setSelectedPropertyPhotoUrl(null);
    }
  }, [selectedProperty]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?userId=${user?.id || ""}`;
    if (!user?.id) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "whatsapp_bulk_progress") {
            setBulkProgress({ ...msg.data, complete: false });
          } else if (msg.type === "whatsapp_bulk_complete") {
            setBulkProgress({ ...msg.data, complete: true });
            toast({
              title: msg.data.failed > 0 ? "Bulk Send Finished" : "All Messages Sent!",
              description: msg.data.message,
              variant: msg.data.failed > 0 ? "destructive" : "default",
            });
          }
        } catch {}
      };
      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 5000);
      };
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [user?.id]);

  // OAuth-enabled platforms (only platforms with full OAuth backend support)
  const oauthPlatforms = [
    "facebook",
    "instagram",
    "linkedin",
    "youtube",
    "x",
    "twitter",
    "tiktok",
  ];

  // Handle OAuth connection
  const handleOAuthConnect = async (platform: string) => {
    let popup: Window | null = null;
    let checkClosedInterval: NodeJS.Timeout | null = null;

    try {
      setConnectingPlatform(platform);

      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      popup = window.open(
        "about:blank",
        `${platform}_oauth`,
        `width=${width},height=${height},left=${left},top=${top}`,
      );

      if (!popup || popup.closed) {
        throw new Error("POPUP_BLOCKED");
      }

      popup.document.write(
        `<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;background:#f5f5f5"><div style="text-align:center"><div style="width:40px;height:40px;border:4px solid #ddd;border-top-color:#333;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px"></div><p style="color:#555">Connecting to ${platform}...</p></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style></body></html>`
      );

      const connectingMsg = messages.oauth.connecting(platform);
      toast({
        title: connectingMsg.title,
        description: connectingMsg.description,
      });

      const response = await fetch(`/api/social/connect/${platform}`, {
        method: "POST",
      });

      if (!response.ok) {
        popup.close();
        const error = friendlyError({ status: response.status });
        throw new Error(error.description);
      }

      const data = await response.json();
      const { authUrl } = data;

      popup.location.href = authUrl;

      // Listen for OAuth callback message
      const messageHandler = (event: MessageEvent) => {
        // Security: Validate origin AND source window
        if (event.origin !== window.location.origin) return;
        if (event.source !== popup) return;

        // Handle success
        if (event.data.success && event.data.platform === platform) {
          // Success! Refresh accounts list
          queryClient.invalidateQueries({ queryKey: ["/api/social/accounts"] });

          const successMsg = messages.oauth.success(platform);
          toast({
            title: successMsg.title,
            description: successMsg.description,
          });

          cleanup();
        }
        // Handle errors
        else if (event.data.error) {
          const errorMsg = messages.oauth.error(platform, event.data.error);
          toast({
            title: errorMsg.title,
            description: errorMsg.description,
            variant: "destructive",
          });

          cleanup();
        }
      };

      const cleanup = () => {
        if (checkClosedInterval) {
          clearInterval(checkClosedInterval);
          checkClosedInterval = null;
        }
        window.removeEventListener("message", messageHandler);
        setConnectingPlatform(null);
      };

      window.addEventListener("message", messageHandler);

      // Also check if popup was closed without success
      checkClosedInterval = setInterval(() => {
        if (popup && popup.closed) {
          const cancelledMsg = messages.oauth.cancelled(platform);
          toast({
            title: cancelledMsg.title,
            description: cancelledMsg.description,
          });
          cleanup();
        }
      }, 500);
    } catch (error: any) {
      console.error("OAuth connection error:", error);

      // Handle popup blocking specifically
      if (error.message === "POPUP_BLOCKED") {
        toast({
          title: "Pop-ups are blocked",
          description: `To connect your ${platform} account, please allow pop-ups for this site in your browser settings. On mobile, try using the browser's desktop mode.`,
          variant: "destructive",
        });
      } else {
        // Use friendlyError to provide context-aware messages (network, auth, etc.)
        const friendlyMsg = friendlyError(error);
        const errorMsg = messages.oauth.error(
          platform,
          friendlyMsg.description,
        );
        toast({
          title: errorMsg.title,
          description: errorMsg.description,
          variant: "destructive",
        });
      }

      setConnectingPlatform(null);

      if (checkClosedInterval) {
        clearInterval(checkClosedInterval);
      }
    }
  };

  const {
    data: accounts,
    isLoading,
    error,
  } = useQuery<SocialMediaAccount[]>({
    queryKey: ["/api/social/accounts"],
  });

  // Debug: Log accounts when they change
  useEffect(() => {
    console.log("🔍 Social accounts data:", accounts);
    console.log("🔍 Is loading:", isLoading);
    console.log("🔍 Error:", error);
    console.log("🔍 Document cookies:", document.cookie);
  }, [accounts, isLoading, error]);

  // Handle disconnect
  const disconnectMutation = useMutation({
    mutationFn: async (platform: string) => {
      const response = await apiRequest(
        "POST",
        `/api/social/disconnect/${platform}`,
        {},
      );
      return response.json();
    },
    onSuccess: (_, platform) => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/accounts"] });
      const successMsg = messages.oauth.disconnectSuccess(platform);
      toast({
        title: successMsg.title,
        description: successMsg.description,
      });
    },
    onError: (error: Error, platform) => {
      const errorMsg = messages.oauth.disconnectError(platform);
      toast({
        title: errorMsg.title,
        description: errorMsg.description,
        variant: "destructive",
      });
    },
  });

  // Load Facebook pages when component mounts or when Facebook connection status changes
  useEffect(() => {
    const facebookAccount = accounts?.find(
      (a) => a.platform === "facebook" || a.platform === "facebook_page"
    );
    
    const loadFacebookPages = async () => {
      if (!facebookAccount?.isConnected) {
        setFacebookPages([]);
        setFacebookPagesLoaded(true);
        return;
      }
      
      setFacebookPagesLoaded(false);
      try {
        const response = await fetch("/api/facebook/pages");
        if (response.ok) {
          const pages = await response.json();
          setFacebookPages(pages);
          
          const savedPageId = localStorage.getItem("selectedFacebookPage");
          if (savedPageId && pages.some((p: any) => p.id === savedPageId)) {
            setSelectedFacebookPage(savedPageId);
          } else if (pages.length > 0 && !selectedFacebookPage) {
            setSelectedFacebookPage(pages[0].id);
            localStorage.setItem("selectedFacebookPage", pages[0].id);
          }
        }
      } catch (error) {
        console.log("No Facebook pages available");
      } finally {
        setFacebookPagesLoaded(true);
      }
    };
    loadFacebookPages();
  }, [accounts]);
  
  // Persist selected Facebook page to localStorage
  useEffect(() => {
    if (selectedFacebookPage) {
      localStorage.setItem("selectedFacebookPage", selectedFacebookPage);
    }
  }, [selectedFacebookPage]);

  // Handle YouTube posting with on-demand authentication
  const handleYouTubePost = async (content: string, videoFile?: File) => {
    try {
      // Check if we have a stored YouTube access token
      const youtubeAccount = accounts?.find(
        (account) => account.platform === "youtube",
      );

      if (!youtubeAccount || !youtubeAccount.isConnected) {
        // No YouTube account connected - start OAuth flow
        toast({
          title: "YouTube Authentication Required",
          description:
            "Redirecting to Google to connect your YouTube account...",
        });

        // Store the content we want to post after authentication
        sessionStorage.setItem("pendingYouTubePost", content);
        if (videoFile) {
          // For video files, we'd need to handle them differently in storage
          // For now, we'll show a message about re-uploading
          toast({
            title: "Video Upload Notice",
            description:
              "Please re-upload your video after YouTube authentication.",
            variant: "default",
          });
        }

        // Redirect to YouTube OAuth
        window.location.href = "/auth/youtube";
        return { success: false, message: "Redirecting to authentication..." };
      }

      // We have authentication - proceed with posting
      if (videoFile) {
        // Upload video file to YouTube
        const formData = new FormData();
        formData.append("video", videoFile);
        formData.append("title", content.substring(0, 100));
        formData.append("description", content);

        const response = await fetch("/api/youtube/upload-video", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || "Failed to upload video to YouTube",
          );
        }

        return response.json();
      } else {
        // Regular content posting (community post attempt)
        const response = await apiRequest("POST", "/api/youtube/post", {
          content: content,
          title: content.substring(0, 100) + "...",
          description: content,
          accessToken: (youtubeAccount as any).accessToken,
        });

        return response.json();
      }
    } catch (error: any) {
      throw new Error(error.message || "Failed to post to YouTube");
    }
  };

  // Check for pending YouTube posts after OAuth callback
  useEffect(() => {
    const pendingPost = sessionStorage.getItem("pendingYouTubePost");
    if (pendingPost) {
      // Clear the pending post
      sessionStorage.removeItem("pendingYouTubePost");

      // Set the content and show user the post is ready
      setPostContent(pendingPost);
      setSelectedPlatforms(["youtube"]);

      toast({
        title: "YouTube Connected!",
        description:
          "Your content is ready to post. Click 'Post' to publish to YouTube.",
      });
    }
  }, [accounts]);

  const postMutation = useMutation({
    mutationFn: async (data: {
      content: string;
      platforms: string[];
      mediaIds?: string[];
      propertyPhotoUrl?: string | null;
      whatsappTo?: string;
    }) => {
      const usePropertyPhoto = data.propertyPhotoUrl && (!data.mediaIds || data.mediaIds.length === 0);

      // Check if YouTube is selected and handle on-demand authentication
      if (data.platforms.includes("youtube")) {
        return await handleYouTubePost(
          data.content,
          uploadedVideo || undefined,
        );
      }

      // Handle other platform-specific posting
      if (data.platforms.includes("facebook")) {
        // Check if a Facebook Page is selected
        if (!selectedFacebookPage) {
          throw new Error("Please select a Facebook Page before posting");
        }

        // Use Facebook Pages API for Facebook posting
        const facebookResponse = await apiRequest(
          "POST",
          "/api/facebook/post",
          {
            content: data.content,
            pageId: selectedFacebookPage,
            mediaIds: data.mediaIds || [],
            ...(usePropertyPhoto ? { mediaUrl: data.propertyPhotoUrl } : {}),
          },
        );
        return facebookResponse.json();
      } else if (data.platforms.includes("instagram")) {
        const hasMedia = (data.mediaIds && data.mediaIds.length > 0) || usePropertyPhoto;
        if (!hasMedia) {
          throw new Error("Instagram requires an image or video. Please attach media before posting.");
        }
        // Use Instagram Graph API for Instagram posting
        const instagramResponse = await apiRequest(
          "POST",
          "/api/instagram/post",
          {
            content: data.content,
            mediaIds: data.mediaIds || [],
            ...(usePropertyPhoto ? { mediaUrl: data.propertyPhotoUrl } : {}),
          },
        );
        return instagramResponse.json();
      } else if (
        data.platforms.includes("x") ||
        data.platforms.includes("twitter")
      ) {
        // Use Twitter API for Twitter posting - must use FormData for multer
        const formData = new FormData();
        formData.append("content", data.content);

        // Add mediaIds if present
        if (data.mediaIds && data.mediaIds.length > 0) {
          formData.append("mediaIds", JSON.stringify(data.mediaIds));
        }

        if (usePropertyPhoto) {
          formData.append("mediaUrl", data.propertyPhotoUrl!);
        }

        const response = await fetch("/api/twitter/post", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to post to Twitter");
        }

        return response.json();
      } else if (data.platforms.includes("whatsapp")) {
        const whatsappPayload: any = {
            to: data.whatsappTo || "",
            message: data.content,
            ...(usePropertyPhoto ? { imageUrl: data.propertyPhotoUrl } : {}),
            ...(data.mediaIds?.length ? { imageUrl: data.mediaIds[0] } : {}),
          };
        if (whatsappTemplateName && whatsappTemplateName !== "none") {
          whatsappPayload.templateName = whatsappTemplateName;
        }
        const whatsappResponse = await apiRequest(
          "POST",
          "/api/whatsapp/send",
          whatsappPayload,
        );
        return whatsappResponse.json();
      } else {
        // For other platforms, use the general endpoint
        const response = await apiRequest("POST", "/api/social/post", {
          ...data,
          mediaIds: data.mediaIds || [],
          ...(usePropertyPhoto ? { propertyPhotoUrl: data.propertyPhotoUrl } : {}),
        });
        return response.json();
      }
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/accounts"] });

      // Handle partial or full failure from the server (success: false or 0 results)
      if (data?.success === false || (data?.results !== undefined && data.results.length === 0 && data?.errors?.length > 0)) {
        const errorDetails = data?.errors?.map((e: any) => e.error).join(" | ") || data?.message || "Post failed";
        toast({
          title: "Post Failed",
          description: errorDetails,
          variant: "destructive",
        });
        return;
      }

      // Show partial success if some platforms failed
      if (data?.errors?.length > 0 && data?.results?.length > 0) {
        const failedPlatforms = data.errors.map((e: any) => e.platform).join(", ");
        toast({
          title: "Partially Posted",
          description: `Posted successfully, but failed on: ${failedPlatforms}. ${data.errors[0]?.error || ""}`,
          variant: "destructive",
        });
        setPostContent("");
        setSelectedMediaIds([]);
        setSelectedPropertyPhotoUrl(null);
        return;
      }

      if (data?.background) {
        setBulkProgress({ sent: 0, failed: 0, total: data.total, queued: data.queued || 0, percent: 0, message: data.message });
        toast({
          title: `Sending ${data.total.toLocaleString()} Messages`,
          description: data.queued > 0
            ? `Sending first ${data.total.toLocaleString()} now (Meta daily limit). ${data.queued.toLocaleString()} contacts exceed today's limit.`
            : "Messages are being sent in the background. You'll see a live progress bar below.",
        });
        setPostContent("");
        setSelectedMediaIds([]);
        setSelectedPropertyPhotoUrl(null);
        if (selectedPlatforms.includes("whatsapp")) {
          setWhatsappTo("");
        }
        return;
      }

      const description = data?.sent != null && data?.total != null
        ? `Sent to ${data.sent} of ${data.total} recipients${data.failed > 0 ? ` (${data.failed} failed)` : ""}`
        : "Your content has been shared across selected platforms";

      toast({
        title: "Posted Successfully!",
        description,
      });
      setPostContent("");
      setSelectedMediaIds([]);
      setSelectedPropertyPhotoUrl(null);
      if (selectedPlatforms.includes("whatsapp")) {
        setWhatsappTo("");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Posting Failed",
        description: error.message || "Failed to post to social media",
        variant: "destructive",
      });
    },
  });

  const facebookPostMutation = useMutation({
    mutationFn: async (data: {
      content: string;
      pageId?: string;
      photo?: File;
    }) => {
      const formData = new FormData();
      formData.append("content", data.content);

      if (data.photo) {
        formData.append("photo", data.photo);
      }

      if (data.pageId) {
        formData.append("pageId", data.pageId);
      }

      const response = await fetch("/api/facebook/post", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to post to Facebook");
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Refresh accounts to ensure connection status is up-to-date
      queryClient.invalidateQueries({ queryKey: ["/api/social/accounts"] });

      toast({
        title: "Facebook Post Successful!",
        description:
          data.message ||
          "Your content has been posted to Facebook successfully.",
      });
      setPostContent("");
      setSelectedProperty(null);
      setSelectedPostType(null);
      setSelectedFacebookPage("");
    },
    onError: (error: Error) => {
      toast({
        title: "Facebook Post Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const optimizeContentMutation = useMutation({
    mutationFn: async (data: { topic: string; platform: string; menuItem?: { name: string; description?: string; price?: string; category?: string } }) => {
      const response = await apiRequest(
        "POST",
        "/api/content/social-post",
        { ...data, businessType },
      );
      return response.json();
    },
    onSuccess: (data) => {
      const content: string = data.content || "";
      const newTags: string[] = (data.hashtags || [])
        .map((tag: string) => (tag.startsWith("#") ? tag : "#" + tag))
        .filter((tag: string) => !content.includes(tag));
      setPostContent(content + (newTags.length ? " " + newTags.join(" ") : ""));
      toast({
        title: "Content Optimized!",
        description:
          "Generated platform-specific content for better engagement",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Optimization Failed",
        description: error.message || "Failed to optimize content",
        variant: "destructive",
      });
    },
  });

  const generatePropertyContent = (
    property: Property,
    postType: string,
    platform: string,
  ) => {
    const formatPrice = (price: number) => {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(price);
    };

    const bedBathText = `${
      property.bedrooms ? `🛏️ ${property.bedrooms} bed` : ""
    } ${property.bathrooms ? `🛁 ${property.bathrooms} bath` : ""} ${
      property.squareFootage
        ? `📐 ${property.squareFootage.toLocaleString()} sqft`
        : ""
    }`;
    const neighborhoodTag = property.neighborhood
      ? property.neighborhood.replace(/\s+/g, "")
      : "";

    const templates = {
      just_listed: {
        facebook: `🏠 JUST LISTED!

${property.address}
${property.city}, ${property.state} ${property.zipCode}

💰 ${formatPrice(property.listPrice)}
${bedBathText}

${property.description.substring(0, 200)}...

${
  property.neighborhood
    ? `📍 Located in desirable ${property.neighborhood}`
    : ""
}

Contact ${agentName} at ${brokerageName} for more information!

#JustListed #OmahaRealEstate #${agentName.replace(/\s+/g, "")} #${brokerageName.split(" ").map((w: string) => w.charAt(0)).join("")} ${
          neighborhoodTag ? `#${neighborhoodTag}` : ""
        }`,

        instagram: `🏠 NEW LISTING ALERT!

${property.address}
${formatPrice(property.listPrice)}

✨ ${property.bedrooms}BD ${property.bathrooms}BA${
          property.squareFootage
            ? ` | ${property.squareFootage.toLocaleString()} sqft`
            : ""
        }

${property.description.substring(0, 150)}...

DM for details! 📩

#JustListed #OmahaHomes #RealEstate #${agentName.replace(/\s+/g, "")} ${
          neighborhoodTag ? `#${neighborhoodTag}` : ""
        }`,

        x: `🏠 JUST LISTED!\n\n${property.address}\n${formatPrice(
          property.listPrice,
        )}\n${property.bedrooms}BD ${
          property.bathrooms
        }BA\n\n${property.description.substring(
          0,
          100,
        )}...\n\nContact ${agentName} for details!\n\n#JustListed #OmahaRealEstate`,

        youtube: `🏠 NEW LISTING: ${property.address} | ${formatPrice(
          property.listPrice,
        )}

Welcome to this stunning ${property.bedrooms} bedroom, ${
          property.bathrooms
        } bathroom home in ${
          property.neighborhood || property.city
        }! This beautiful ${
          property.squareFootage
            ? property.squareFootage.toLocaleString() + " square foot "
            : ""
        }${property.propertyType.toLowerCase()} offers everything you've been looking for.

${property.description}

${
  property.neighborhood
    ? `Located in the desirable ${property.neighborhood} neighborhood, `
    : ""
}this property is perfectly positioned for ${
          property.city
        } living. Whether you're a first-time homebuyer or looking to upgrade, this home offers incredible value at ${formatPrice(
          property.listPrice,
        )}.

Key Features:
${
  property.features && Array.isArray(property.features)
    ? property.features
        .slice(0, 5)
        .map((feature) => `• ${feature}`)
        .join("\n")
    : "• Beautifully maintained interior\n• Great neighborhood location\n• Move-in ready condition"
}

I'm ${agentName} with ${brokerageName}, and I'd love to show you this amazing property. Call or text me today to schedule your private showing!

#JustListed #OmahaRealEstate #${
          property.neighborhood
            ? property.neighborhood.replace(/\s+/g, "")
            : "OmahaHomes"
        } #${agentName.replace(/\s+/g, "")} #${brokerageName.split(" ").map((w: string) => w.charAt(0)).join("")} #RealEstate #HomeTour`,
      },

      just_sold: {
        facebook: `🎉 CONGRATULATIONS! SOLD!

${property.address}
${property.city}, ${property.state}

Another successful closing! Thank you to my amazing clients for trusting me with their real estate needs.

${
  property.neighborhood
    ? `Properties in ${property.neighborhood} continue to perform well in our market.`
    : ""
}

Thinking of buying or selling? I'd love to help you achieve your real estate goals!

${agentName} | ${brokerageName}

#JustSold #OmahaRealEstate #${agentName.replace(/\s+/g, "")} #${brokerageName.split(" ").map((w: string) => w.charAt(0)).join("")} #RealEstateSuccess`,

        instagram: `✅ SOLD!

${property.address}

Another happy client! 🙌

${
  property.neighborhood
    ? `${property.neighborhood} market staying strong! 💪`
    : ""
}

Ready to make your move? Let's chat! 📞

#Sold #OmahaRealEstate #${agentName.replace(/\s+/g, "")} #RealEstateSuccess`,

        x: `✅ SOLD!\n\n${
          property.address
        }\n\nAnother successful closing! 🎉\n\n${
          property.neighborhood ? `${property.neighborhood} market strong!` : ""
        }\n\n${agentName} | ${brokerageName.split(" ").map((w: string) => w.charAt(0)).join("")}\n\n#JustSold #OmahaRealEstate`,

        youtube: `🎉 SOLD! ${property.address} | Another Successful Closing!

I'm thrilled to share another successful sale in ${
          property.neighborhood || property.city
        }! This beautiful ${property.bedrooms} bedroom, ${
          property.bathrooms
        } bathroom home has found its perfect new owners.

${property.description.substring(0, 300)}

This ${
          property.squareFootage
            ? property.squareFootage.toLocaleString() + " square foot "
            : ""
        }property sold quickly, showcasing the continued strength of ${
          property.neighborhood ? `the ${property.neighborhood}` : "our local"
        } real estate market.

What made this sale special:
• Strategic pricing based on current market data
• Professional marketing that attracted qualified buyers
• Expert negotiation ensuring the best terms
• Smooth closing process with clear communication

${
  property.neighborhood
    ? `Properties in ${property.neighborhood} continue to perform exceptionally well, with strong buyer demand and competitive pricing.`
    : "The Omaha market remains strong with excellent opportunities for both buyers and sellers."
}

Thinking about selling your home? I'd love to discuss your goals and show you how I can maximize your property's value in today's market.

${agentName} | ${brokerageName}

#JustSold #OmahaRealEstate #${
          property.neighborhood
            ? property.neighborhood.replace(/\s+/g, "")
            : "OmahaHomes"
        } #${agentName.replace(/\s+/g, "")} #${brokerageName.split(" ").map((w: string) => w.charAt(0)).join("")} #RealEstateSuccess #SoldHomes`,
      },

      price_improvement: {
        facebook: `💰 PRICE IMPROVEMENT!

${property.address}
${property.city}, ${property.state} ${property.zipCode}

NOW ${formatPrice(property.listPrice)}

${bedBathText}

${property.description.substring(0, 200)}...

${
  property.neighborhood
    ? `Don't miss this opportunity in ${property.neighborhood}!`
    : "Don't miss this opportunity!"
}

Contact ${agentName} at ${brokerageName} today!

#PriceImprovement #OmahaRealEstate #${agentName.replace(/\s+/g, "")} #${brokerageName.split(" ").map((w: string) => w.charAt(0)).join("")} #Opportunity`,

        instagram: `💰 PRICE DROP ALERT!

${property.address}
NOW ${formatPrice(property.listPrice)}!

✨ ${property.bedrooms}BD ${property.bathrooms}BA

${property.description.substring(0, 120)}...

${
  property.neighborhood
    ? `Great opportunity in ${property.neighborhood}!`
    : "Great opportunity!"
}

DM me now! 📩

#PriceImprovement #OmahaHomes #Opportunity`,

        x: `💰 PRICE IMPROVED!\n\n${property.address}\nNOW ${formatPrice(
          property.listPrice,
        )}!\n\n${property.bedrooms}BD ${property.bathrooms}BA\n\n${
          property.neighborhood
            ? `${property.neighborhood} opportunity!`
            : "Great opportunity!"
        }\n\n${agentName} | ${brokerageName.split(" ").map((w: string) => w.charAt(0)).join("")}\n\n#PriceImprovement`,

        youtube: `💰 PRICE IMPROVEMENT! ${property.address} | Now ${formatPrice(
          property.listPrice,
        )}

Exciting news! This beautiful ${property.bedrooms} bedroom, ${
          property.bathrooms
        } bathroom home just had a strategic price adjustment, making it an even better value for buyers!

${property.description.substring(0, 300)}

What makes this price improvement significant:
• Reflects current market conditions
• Creates opportunity for serious buyers
• Perfect timing for today's market

Don't wait on this opportunity! Contact ${agentName} at ${brokerageName} today.

#PriceImprovement #OmahaRealEstate #${agentName.replace(/\s+/g, "")} #RealEstateOpportunity`,
      },

      open_houses: {
        facebook: `🏠 OPEN HOUSE THIS WEEKEND!

📍 ${property.address}
${property.city}, ${property.state} ${property.zipCode}

🕐 Saturday & Sunday, 1:00 PM - 4:00 PM

💰 ${formatPrice(property.listPrice)}
${bedBathText}

${property.description.substring(0, 200)}...

${
  property.neighborhood
    ? `Come see why ${property.neighborhood} is such a desirable area!`
    : "Come see this beautiful property!"
}

No appointment necessary - just stop by!

${agentName} | ${brokerageName}

#OpenHouse #OmahaRealEstate #${agentName.replace(/\s+/g, "")} #WeekendViewing`,

        instagram: `🏠 OPEN HOUSE ALERT!

📍 ${property.address}
🕐 Sat & Sun 1-4pm
💰 ${formatPrice(property.listPrice)}

✨ ${property.bedrooms}BD ${property.bathrooms}BA

${property.description.substring(0, 120)}...

${
  property.neighborhood
    ? `${property.neighborhood} living awaits!`
    : "Your dream home awaits!"
}

See you there! 👋

#OpenHouse #WeekendViewing #OmahaHomes`,

        x: `🏠 OPEN HOUSE!\n\n📍 ${
          property.address
        }\n🕐 Sat & Sun 1-4pm\n💰 ${formatPrice(property.listPrice)}\n\n${
          property.bedrooms
        }BD ${property.bathrooms}BA\n\n${
          property.neighborhood ? `${property.neighborhood} gem!` : "Must see!"
        }\n\n${agentName} | ${brokerageName.split(" ").map((w: string) => w.charAt(0)).join("")}\n\n#OpenHouse`,

        youtube: `🏠 OPEN HOUSE THIS WEEKEND! ${property.address}

Join me Saturday & Sunday, 1:00 PM - 4:00 PM for an exclusive tour of this stunning ${
          property.bedrooms
        } bedroom, ${property.bathrooms} bathroom home!

Price: ${formatPrice(property.listPrice)}

${property.description.substring(0, 300)}

No appointment necessary - just stop by! I'll be there to answer questions and show you everything this wonderful home has to offer.

Can't make the open house? Call or text me to schedule a private showing at your convenience.

${agentName} | ${brokerageName}

#OpenHouse #WeekendViewing #OmahaRealEstate #${agentName.replace(/\s+/g, "")} #HomeTour`,
      },
    };

    const postTypeTemplates = templates[postType as keyof typeof templates];
    if (postTypeTemplates && platform in postTypeTemplates) {
      return postTypeTemplates[platform as keyof typeof postTypeTemplates];
    }

    return `Check out this amazing property at ${
      property.address
    }! ${formatPrice(property.listPrice)} | Contact ${agentName} for details.`;
  };

  const handlePost = () => {
    let content = postContent.trim();

    // If property is selected and no custom content, generate property-specific content
    if (selectedProperty && !postContent.trim() && selectedPostType) {
      // Use the first selected platform for content generation
      const primaryPlatform = selectedPlatforms[0] || "facebook";
      content = generatePropertyContent(
        selectedProperty,
        selectedPostType,
        primaryPlatform,
      );
    }

    const isWhatsAppTemplate = selectedPlatforms.includes("whatsapp") && whatsappTemplateName && whatsappTemplateName !== "none";

    if (isWhatsAppOnly) {
      const recipientCount = whatsappTo.split(/[\n,]+/).filter((n: string) => n.replace(/\D/g, "").length > 0).length;
      if (recipientCount > 1 && !isWhatsAppTemplate) {
        toast({
          title: "Template Required for Bulk Messages",
          description: "Meta requires approved templates when initiating business conversations with multiple recipients. Please select a template.",
          variant: "destructive",
          duration: 6000,
        });
        return;
      }
    }

    if (!content && !isTikTokOnly && !isWhatsAppTemplate) {
      toast({
        title: "Content Required",
        description:
          "Please enter content to post or select a property with post type",
        variant: "destructive",
      });
      return;
    }

    if (isTikTokOnly && !tiktokVideoUrl) {
      toast({
        title: "Video Required",
        description: "Please upload a video or paste a video URL for TikTok.",
        variant: "destructive",
      });
      return;
    }

    if (isTikTokOnly) {
      content = content || "Check out this video!";
    }

    if (selectedPlatforms.length === 0) {
      toast({
        title: "Select Platforms",
        description: "Please select at least one platform to post to",
        variant: "destructive",
      });
      return;
    }

    const hasMedia = (selectedMediaIds && selectedMediaIds.length > 0) || !!selectedPropertyPhotoUrl;

    if (selectedPlatforms.includes("tiktok") && !hasMedia) {
      toast({
        title: "TikTok Requires Video",
        description: "TikTok only supports video posts. Please upload a video from your device or paste a video URL using the media gallery above.",
        variant: "destructive",
        duration: 6000,
      });
      return;
    }

    if (selectedPlatforms.includes("instagram") && !hasMedia) {
      toast({
        title: "Instagram Requires Media",
        description: "Instagram requires an image or video. Please upload media from your device or paste a URL using the media gallery above.",
        variant: "destructive",
        duration: 6000,
      });
      return;
    }

    const payload = {
      content,
      platforms: selectedPlatforms,
      mediaIds: selectedMediaIds,
      propertyPhotoUrl: selectedPropertyPhotoUrl,
      whatsappTo,
    };

    const whatsappRecipientCount = isWhatsAppOnly
      ? whatsappTo.split(/[\n,]+/).filter((n: string) => n.replace(/\D/g, "").length > 0).length
      : 0;

    if (isWhatsAppOnly && whatsappRecipientCount > 10) {
      setPendingBulkPayload(payload);
      setShowBulkConfirm(true);
      return;
    }

    postMutation.mutate(payload);
  };

  const handlePlatformToggle = (platform: string, isConnected: boolean) => {
    if (!isConnected) return;

    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform],
    );
  };

  const handleOptimizeContent = () => {
    if (!postContent.trim()) {
      toast({
        title: "Content Required",
        description: "Please enter some content to optimize",
        variant: "destructive",
      });
      return;
    }

    if (selectedPlatforms.length === 0) {
      toast({
        title: "Select Platform",
        description: "Please select at least one platform to optimize for",
        variant: "destructive",
      });
      return;
    }

    // Optimize for the first selected platform with post type context
    const primaryPlatform = selectedPlatforms[0];
    const topic = selectedPostType
      ? `${selectedPostType.replace("_", " ")} ${postContent.trim()}`.trim()
      : postContent.trim();

    optimizeContentMutation.mutate({
      topic,
      platform: primaryPlatform,
      menuItem: selectedMenuItem ? {
        name: selectedMenuItem.name,
        description: selectedMenuItem.description ?? undefined,
        price: selectedMenuItem.price ? `$${(Number(selectedMenuItem.price) / 100).toFixed(2)}` : undefined,
        category: selectedMenuItem.category ?? undefined,
      } : undefined,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          Quick Posts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Platform Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">
              Select Platforms
            </h3>
          </div>
          {accounts?.map((account) => {
            // Normalize platform name (handle aliases like twitter->x, facebook_page->facebook)
            const normalizedPlatform = account.platform
              .toLowerCase()
              .replace("twitter", "x")
              .replace("facebook_page", "facebook")
              .replace("_", "");
            const platformInfo = platformIcons[
              normalizedPlatform as keyof typeof platformIcons
            ] || { icon: Settings, color: "text-gray-600" }; // Fallback for unknown platforms

            const PlatformIcon = platformInfo.icon;

            return (
              <div key={account.id} className="contents">
                <div
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={selectedPlatforms.includes(account.platform)}
                      onCheckedChange={(checked) =>
                        handlePlatformToggle(
                          account.platform,
                          account.isConnected,
                        )
                      }
                      disabled={!account.isConnected}
                      className="h-5 w-5 bg-[#2d4450] text-[#304652]"
                      data-testid={`checkbox-${account.platform}`}
                    />
                    <PlatformIcon className={`h-4 w-4 ${platformInfo.color}`} />
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium capitalize">
                        {account.platform}
                      </span>
                      {account.platform === "instagram" && (
                        <span className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded-full font-medium">Temporarily down</span>
                      )}
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-2"
                    data-testid={`status-${account.platform}`}
                    title={account.isConnected ? "Connected" : "Disconnected"}
                  >
                    {account.isConnected ? (
                      <>
                        <Plug className="h-5 w-5 text-green-600" />
                        {account.platform.toLowerCase() !== "whatsapp" && (
                          <Button
                            onClick={() =>
                              disconnectMutation.mutate(
                                account.platform.toLowerCase(),
                              )
                            }
                            disabled={disconnectMutation.isPending}
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                            data-testid={`button-disconnect-${account.platform}`}
                          >
                            {disconnectMutation.isPending ? (
                              <>
                                <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                                Disconnecting...
                              </>
                            ) : (
                              <>
                                <PlugZap className="mr-1 h-3 w-3" />
                                Disconnect
                              </>
                            )}
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <PlugZap className="h-5 w-5 text-red-600" />
                        {oauthPlatforms.includes(
                          account.platform.toLowerCase(),
                        ) && (
                          <Button
                            onClick={() =>
                              handleOAuthConnect(account.platform.toLowerCase())
                            }
                            disabled={
                              connectingPlatform ===
                              account.platform.toLowerCase()
                            }
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs border-green-200 text-green-600 hover:bg-green-50 hover:border-green-300"
                            data-testid={`button-connect-${account.platform}`}
                          >
                            {connectingPlatform ===
                            account.platform.toLowerCase() ? (
                              <>
                                <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                                Connecting...
                              </>
                            ) : (
                              <>
                                <Plug className="mr-1 h-3 w-3" />
                                Reconnect
                              </>
                            )}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {!account.isConnected && (account.platform === "facebook" || account.platform === "facebook_page" || account.platform === "instagram") && (
                  <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md w-full">
                    <p className="text-xs text-blue-900 dark:text-blue-100">
                      <strong>Note:</strong> {account.platform === "instagram" ? "Instagram" : "Facebook"} posts require a{" "}
                      {account.platform === "instagram" ? "Business or Creator Account" : "Page"}. Posts will not appear on your personal profile. Please make sure you have a{" "}
                      {account.platform === "instagram" ? "Business/Creator Account" : "Page"} created before connecting.
                    </p>
                  </div>
                )}
                {/* Facebook Page Selector - Show immediately when Facebook is connected */}
                {account.isConnected && (account.platform === "facebook" || account.platform === "facebook_page") && (
                  <div className="mt-2 ml-8 p-3 rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800 space-y-2">
                    <Label
                      htmlFor="facebook-page-inline-select"
                      className="text-xs font-medium text-blue-900 dark:text-blue-100"
                    >
                      Select Facebook Page to post to:
                    </Label>
                    {facebookPages.length > 0 ? (
                      <>
                        <select
                          id="facebook-page-inline-select"
                          value={selectedFacebookPage}
                          onChange={(e) => setSelectedFacebookPage(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-blue-300 bg-white dark:bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          data-testid="select-facebook-page-inline"
                        >
                          <option value="">Select a page...</option>
                          {facebookPages.map((page: any) => (
                            <option key={page.id} value={page.id}>
                              {page.name}
                            </option>
                          ))}
                        </select>
                        {selectedFacebookPage && (
                          <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> Ready to post to: {facebookPages.find((p: any) => p.id === selectedFacebookPage)?.name}
                          </p>
                        )}
                      </>
                    ) : facebookPagesLoaded ? (
                      <div className="space-y-1">
                        <p className="text-xs text-amber-600 font-medium">No Facebook Pages found</p>
                        <p className="text-[10px] text-muted-foreground">Your Facebook account may not have any Pages linked, or the token may need the "pages_show_list" permission. Try disconnecting and reconnecting Facebook.</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Loading your Pages...</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* YouTube Video Upload Option */}
        {selectedPlatforms.includes("youtube") && (
          <div className="space-y-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-red-600" />
              <h3 className="text-sm font-medium text-foreground">
                YouTube Video Upload
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload a video file to post directly to your YouTube channel as a
              public video.
            </p>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowVideoUpload(true)}
                variant="outline"
                size="sm"
                className="border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
                data-testid="button-upload-video"
              >
                <Upload className="mr-2 h-3 w-3" />
                {uploadedVideo ? "Change Video" : "Upload Video"}
              </Button>
              {uploadedVideo && (
                <>
                  <div className="flex items-center gap-2 text-xs text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    Video ready: {uploadedVideo.name}
                  </div>
                  <Button
                    onClick={() => {
                      const videoTitle = postContent.trim() || "Real Estate Video Update";
                      const videoDescription = postContent.trim() || "Check out this update from my real estate business!";
                      
                      postMutation.mutate({
                        content: videoTitle.substring(0, 100),
                        platforms: ["youtube"],
                        mediaIds: [],
                      });
                    }}
                    disabled={postMutation.isPending}
                    size="sm"
                    className="bg-red-600 text-white hover:bg-red-700"
                    data-testid="button-post-youtube-video"
                  >
                    {postMutation.isPending ? "Uploading..." : "Post Video"}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Quick Post */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Quick Post</h3>
          </div>

          {!isTikTokOnly && !isWhatsAppOnly && isRealEstate && <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Property Listing (Optional)
            </div>
            <PropertySelector
              onSelectProperty={setSelectedProperty}
              selectedProperty={selectedProperty}
            />
            {selectedProperty && selectedProperty.photoUrls && selectedProperty.photoUrls.length > 0 && (
              <div className="mt-2 space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Select listing photo</span>
                <div className="flex gap-2 overflow-x-auto pb-1" data-testid="property-photo-gallery">
                  {selectedProperty.photoUrls.map((url, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedPropertyPhotoUrl(selectedPropertyPhotoUrl === url ? null : url)}
                      className={`relative flex-shrink-0 w-[100px] h-[100px] rounded-md overflow-hidden border-2 transition-all ${
                        selectedPropertyPhotoUrl === url
                          ? "border-blue-500 ring-2 ring-blue-500/30"
                          : "border-border hover:border-blue-300"
                      }`}
                      data-testid={`property-photo-thumb-${index}`}
                    >
                      <img
                        src={url}
                        alt={`Listing photo ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {selectedPropertyPhotoUrl === url && (
                        <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                          <div className="bg-blue-500 rounded-full p-0.5">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>}

          {!isTikTokOnly && !isWhatsAppOnly && !isRealEstate && menuItemsList && menuItemsList.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                {terms.itemCapitalized} (Optional)
              </div>
              <Select
                value={selectedMenuItem?.id ?? "none"}
                onValueChange={(val) => {
                  if (val === "none") {
                    setSelectedMenuItem(null);
                  } else {
                    const item = menuItemsList.find((m) => m.id === val) ?? null;
                    setSelectedMenuItem(item);
                  }
                }}
              >
                <SelectTrigger className="w-full text-xs" data-testid="select-catalog-item">
                  <SelectValue placeholder={`Select a ${terms.item}...`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {menuItemsList.filter((m) => m.status === "active").map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}{item.price ? ` — $${(Number(item.price) / 100).toFixed(2)}` : ""}
                      {item.category ? ` (${item.category})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedMenuItem && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 space-y-0.5">
                  <div className="font-medium text-foreground">{selectedMenuItem.name}</div>
                  {selectedMenuItem.description && <div>{selectedMenuItem.description}</div>}
                  {selectedMenuItem.price && <div className="text-amber-600 font-medium">${(Number(selectedMenuItem.price) / 100).toFixed(2)}</div>}
                </div>
              )}
            </div>
          )}

          {!isTikTokOnly && !isWhatsAppOnly && <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Post Type (Optional)
            </div>
            <div className="grid grid-cols-2 gap-2">
              {postTypes.map((type) => (
                <Button
                  key={type.id}
                  variant={selectedPostType === type.id ? "default" : "outline"}
                  size="sm"
                  className={`text-[10px] h-10 justify-start gap-3 border-2 rounded-lg font-medium transition-all duration-200 ${
                    selectedPostType === type.id
                      ? `${type.bgColor} ${type.color} border-current shadow-md`
                      : "border-golden-muted/30 hover:border-golden-accent/50 hover:bg-golden-accent/5 hover:shadow-sm"
                  }`}
                  onClick={() => {
                    const newType =
                      selectedPostType === type.id ? null : type.id;
                    setSelectedPostType(newType);

                    // Auto-generate content if property is selected
                    if (
                      selectedProperty &&
                      newType &&
                      selectedPlatforms.length > 0 &&
                      type.id !== "create_your_own"
                    ) {
                      const primaryPlatform = selectedPlatforms[0];
                      const generatedContent = generatePropertyContent(
                        selectedProperty,
                        newType,
                        primaryPlatform,
                      );
                      setPostContent(generatedContent);
                    }
                  }}
                  data-testid={`post-type-${type.id}`}
                >
                  <div className="p-1.5 rounded-md bg-[#2d4450]">
                    <type.icon
                      className={`h-3.5 w-3.5 ${
                        selectedPostType === type.id
                          ? type.color
                          : "text-muted-foreground"
                      }`}
                    />
                  </div>
                  {type.label}
                </Button>
              ))}
            </div>
            {isAppPromoUser && (
              <Button
                variant={selectedPostType === "promote_app" ? "default" : "outline"}
                size="sm"
                className={`text-[10px] h-10 w-full justify-start gap-3 border-2 rounded-lg font-medium transition-all duration-200 ${
                  selectedPostType === "promote_app"
                    ? "bg-gradient-to-r from-violet-600/10 to-fuchsia-600/10 text-violet-600 border-violet-400 shadow-md"
                    : "border-golden-muted/30 hover:border-violet-400/50 hover:bg-violet-500/5 hover:shadow-sm"
                }`}
                onClick={() => {
                  setSelectedPostType(selectedPostType === "promote_app" ? null : "promote_app");
                  if (selectedPostType !== "promote_app") {
                    setSelectedPromoApp(null);
                  }
                }}
                data-testid="post-type-promote_app"
              >
                <div className="p-1.5 rounded-md bg-[#2d4450]">
                  <Megaphone className={`h-3.5 w-3.5 ${selectedPostType === "promote_app" ? "text-violet-600" : "text-muted-foreground"}`} />
                </div>
                Promote App
              </Button>
            )}
          </div>}

          {!isTikTokOnly && !isWhatsAppOnly && selectedPostType === "promote_app" && isAppPromoUser && (
            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground">Select App to Promote</div>
              <div className="grid grid-cols-1 gap-2">
                {promoApps.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    disabled={isGeneratingPromo}
                    className={`h-auto py-3 px-4 text-left rounded-lg border-2 transition-all duration-200 ${
                      selectedPromoApp === app.id
                        ? "bg-violet-600/10 text-violet-700 border-violet-400 shadow-md"
                        : "border-golden-muted/30 hover:border-violet-400/50 hover:bg-violet-500/5"
                    } ${isGeneratingPromo ? "opacity-50 cursor-not-allowed" : ""}`}
                    onClick={async () => {
                      setSelectedPromoApp(app.id);
                      if (app.image) {
                        setSelectedPropertyPhotoUrl(app.image);
                      }
                      setIsGeneratingPromo(true);
                      try {
                        // Clean the aiPrompt to remove "promote app" or "promote_app" prefix if it's there
                        const cleanAiPrompt = (aiPrompt || "").replace(/^promote\s+app\s+/i, "").replace(/^promote_app\s+/i, "").trim();
                        
                        const response = await apiRequest("POST", "/api/content/promote-app", {
                          appId: app.id,
                          appName: app.name,
                          appUrl: app.url,
                          appDescription: app.description,
                          appFeatures: app.features,
                          platform: selectedPlatforms[0] || "facebook",
                          businessType,
                          aiPrompt: cleanAiPrompt || undefined,
                        });
                        const data = await response.json();
                        const promoContent: string = data.content || "";
                        const promoTags: string[] = (data.hashtags || [])
                          .map((tag: string) => (tag.startsWith("#") ? tag : "#" + tag))
                          .filter((tag: string) => !promoContent.includes(tag));
                        setPostContent(promoContent + (promoTags.length ? " " + promoTags.join(" ") : ""));
                        toast({ title: "Promo Content Generated!", description: `Created engaging promotional post for ${app.name}` });
                      } catch (error: any) {
                        toast({ title: "Generation Failed", description: error.message || "Failed to generate promotional content", variant: "destructive" });
                      } finally {
                        setIsGeneratingPromo(false);
                      }
                    }}
                    data-testid={`promo-app-${app.id}`}
                  >
                    <div className="flex gap-3 items-start">
                      {app.image && (
                        <img src={app.image} alt={app.name} className="w-16 h-16 rounded-md object-cover flex-shrink-0 border" />
                      )}
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-sm font-semibold">{app.name}</span>
                        <span className="text-[10px] text-muted-foreground font-normal leading-tight">{app.url}</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {app.features.slice(0, 3).map((f) => (
                            <span key={f} className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">{f}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {isGeneratingPromo && (
                <div className="flex items-center gap-2 text-xs text-violet-600">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Generating promotional content with AI...
                </div>
              )}
              {selectedPromoApp && !isGeneratingPromo && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs border-violet-300 text-violet-600 hover:bg-violet-50"
                  onClick={async () => {
                    const app = promoApps.find(a => a.id === selectedPromoApp);
                    if (!app) return;
                    setIsGeneratingPromo(true);
                    try {
                      // Clean the aiPrompt to remove "promote app" or "promote_app" prefix if it's there
                      const cleanAiPrompt = (aiPrompt || "").replace(/^promote\s+app\s+/i, "").replace(/^promote_app\s+/i, "").trim();
                      
                      const response = await apiRequest("POST", "/api/content/promote-app", {
                        appId: app.id,
                        appName: app.name,
                        appUrl: app.url,
                        appDescription: app.description,
                        appFeatures: app.features,
                        platform: selectedPlatforms[0] || "facebook",
                        businessType,
                        aiPrompt: cleanAiPrompt || undefined,
                      });
                      const data = await response.json();
                      const regenContent: string = data.content || "";
                      const regenTags: string[] = (data.hashtags || [])
                        .map((tag: string) => (tag.startsWith("#") ? tag : "#" + tag))
                        .filter((tag: string) => !regenContent.includes(tag));
                      setPostContent(regenContent + (regenTags.length ? " " + regenTags.join(" ") : ""));
                      toast({ title: "New Angle Generated!", description: "Created a fresh promotional post with a different angle" });
                    } catch (error: any) {
                      toast({ title: "Generation Failed", description: error.message || "Failed to generate content", variant: "destructive" });
                    } finally {
                      setIsGeneratingPromo(false);
                    }
                  }}
                  data-testid="button-regenerate-promo"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  Generate New Angle
                </Button>
              )}
            </div>
          )}


          {!isTikTokOnly && !isWhatsAppOnly && <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Image className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  Media Library
                </span>
                {selectedMediaIds.length > 0 && (
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full">
                    {selectedMediaIds.length} selected
                  </span>
                )}
              </div>
              {selectedMediaIds.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedMediaIds([])}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear Selection
                </Button>
              )}
            </div>
            <div className="relative rounded-lg border border-border bg-gradient-to-br from-muted/20 to-muted/5 p-4 max-h-[400px] overflow-y-auto overflow-x-hidden w-full">
              <MediaLibrary
                onSelectMedia={setSelectedMediaIds}
                selectedMediaIds={selectedMediaIds}
                multiSelect={true}
                typeFilter="all"
              />
            </div>
            
            {/* Helper text below the container */}
            {selectedMediaIds.length === 0 && (
              <p className="text-xs text-muted-foreground/70 text-center -mt-1">
                Click media items to attach them to your post
              </p>
            )}
          </div>}

          {isWhatsAppOnly ? (
            <div className="space-y-3 rounded-lg border-2 border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20 p-4">
              <div className="flex items-center gap-2 mb-1">
                <MessageCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-semibold">WhatsApp Message</span>
              </div>

              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[11px] font-semibold text-blue-800 dark:text-blue-300">Messaging Limit: 2,000 / 24hrs</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium">Current Tier</span>
                </div>
                <div className="flex gap-1">
                  {[250, 2000, 10000, 100000].map((tier, i) => (
                    <div key={tier} className={`flex-1 h-1.5 rounded-full ${tier <= 2000 ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                  ))}
                </div>
                <p className="text-[10px] text-blue-700/80 dark:text-blue-400/80 leading-relaxed">
                  You can initiate up to <strong>2,000</strong> conversations per rolling 24-hour window. Only the first 2,000 contacts will be sent — any beyond that will be skipped. Reach <strong>1,000 quality conversations</strong> in 7 days to unlock 10,000/day.
                </p>
                <details className="group">
                  <summary className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 cursor-pointer hover:text-blue-900 flex items-center gap-1">
                    <svg className="w-3 h-3 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    Meta Quality Best Practices
                  </summary>
                  <div className="mt-2 space-y-1.5 text-[10px] text-blue-700/70 dark:text-blue-400/70 pl-4 border-l-2 border-blue-200 dark:border-blue-700">
                    <p><strong>Expected:</strong> Only message customers who opted in to receive messages from your business.</p>
                    <p><strong>Timely:</strong> Connect messages to time-bound topics — seasonal events, recent purchases, browsed products.</p>
                    <p><strong>Relevant:</strong> Personalize content based on customer interests with a clear call-to-action.</p>
                    <p><strong>Frequency:</strong> Avoid sending too many messages in a short period — spread campaigns out.</p>
                    <p><strong>Opt-out:</strong> Always provide a clear way for customers to unsubscribe.</p>
                    <p className="text-[9px] italic pt-1">Following these guidelines improves your quality rating and unlocks higher messaging tiers faster.</p>
                  </div>
                </details>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Recipient Phone Numbers</Label>
                <textarea
                  data-testid="input-whatsapp-to-compact"
                  placeholder={"Phone numbers (comma or newline separated)\ne.g. 15185459592, 447911123456"}
                  value={whatsappTo}
                  onChange={(e) => {
                    const val = e.target.value;
                    const count = val.split(/[\n,]+/).filter((n: string) => n.replace(/\D/g, "").length > 0).length;
                    if (count <= 30000) setWhatsappTo(val);
                  }}
                  className="text-sm min-h-[50px] w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="flex items-center justify-between flex-wrap gap-1">
                  {(() => {
                    const recipientCount = whatsappTo.split(/[\n,]+/).filter((n: string) => n.replace(/\D/g, "").length > 0).length;
                    const dailyLimit = 2000;
                    const daysNeeded = Math.ceil(recipientCount / dailyLimit);
                    return (
                      <div className="flex flex-col gap-0.5">
                        <p className={`text-[10px] ${recipientCount > dailyLimit ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground'}`}>
                          {recipientCount.toLocaleString()} recipients
                          {recipientCount > dailyLimit && ` — only first ${dailyLimit.toLocaleString()} will be sent (Meta daily limit)`}
                        </p>
                        {recipientCount > dailyLimit && (
                          <p className="text-[9px] text-amber-500/80 dark:text-amber-400/60">
                            Meta limits: {dailyLimit.toLocaleString()}/day. {(recipientCount - dailyLimit).toLocaleString()} contacts will be skipped.
                          </p>
                        )}
                      </div>
                    );
                  })()}
                
                  <label className="cursor-pointer inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80">
                    <input
                      type="file"
                      accept=".csv,.txt,.pdf,.docx"
                      className="hidden"
                      data-testid="input-upload-contacts-compact"
                      disabled={isExtractingNumbers}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsExtractingNumbers(true);
                        try {
                          const formData = new FormData();
                          formData.append("file", file);
                          const token = localStorage.getItem("authToken") || "";
                          const response = await fetch("/api/whatsapp/extract-numbers", {
                            method: "POST",
                            headers: { ...(token ? { "Authorization": `Bearer ${token}` } : {}) },
                            body: formData,
                          });
                          const data = await response.json();
                          if (data.numbers?.length > 0) {
                            const existing = whatsappTo.trim();
                            setWhatsappTo(existing ? existing + "\n" + data.numbers.join("\n") : data.numbers.join("\n"));
                            toast({ title: "Numbers Imported", description: `Extracted ${data.count} phone numbers` });
                          } else {
                            toast({ title: "No Numbers Found", description: "No phone numbers found in the file.", variant: "destructive" });
                          }
                        } catch {
                          toast({ title: "Upload Failed", description: "Failed to process file.", variant: "destructive" });
                        } finally {
                          setIsExtractingNumbers(false);
                          e.target.value = "";
                        }
                      }}
                    />
                    {isExtractingNumbers ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    {isExtractingNumbers ? "Extracting..." : "Import File"}
                  </label>
                </div>
              </div>
              <WhatsAppTemplateSelector
                selectedTemplate={whatsappTemplateName}
                onSelectTemplate={(name) => setWhatsappTemplateName(name)}
              />
              {(!whatsappTemplateName || whatsappTemplateName === "none") && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Message (required if no template)</Label>
                  <Textarea
                    placeholder="Type your WhatsApp message..."
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    className="min-h-[60px] text-sm"
                    data-testid="textarea-whatsapp-message"
                  />
                </div>
              )}
              {showBulkConfirm && pendingBulkPayload && (
                <div className="rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3" data-testid="whatsapp-bulk-confirm">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <span className="text-sm font-bold text-amber-800 dark:text-amber-300">Bulk Send Confirmation</span>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    You're about to send to <strong>{pendingBulkPayload.whatsappTo.split(/[\n,]+/).filter((n: string) => n.replace(/\D/g, "").length > 0).length.toLocaleString()}</strong> recipients. Please confirm Meta's compliance requirements:
                  </p>
                  <div className="space-y-1.5 text-[11px] text-amber-800/80 dark:text-amber-300/80">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                      <span>All recipients have <strong>opted in</strong> to receive messages from your business</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                      <span>Using an <strong>approved template</strong> (required for business-initiated conversations)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                      <span>Message is <strong>timely and relevant</strong> — connected to events, offers, or recent activity</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                      <span>Not sending duplicate campaigns to the same recipients in a short period</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                      <span>Max <strong>2,000</strong> per 24-hour window (current tier) — excess contacts will be skipped</span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="default"
                      className="bg-green-600 hover:bg-green-700 text-white text-xs"
                      data-testid="button-confirm-bulk-send"
                      onClick={() => {
                        setShowBulkConfirm(false);
                        postMutation.mutate(pendingBulkPayload);
                        setPendingBulkPayload(null);
                      }}
                    >
                      Confirm & Send
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      data-testid="button-cancel-bulk-send"
                      onClick={() => {
                        setShowBulkConfirm(false);
                        setPendingBulkPayload(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {bulkProgress && (
                <div className={`rounded-xl border p-4 space-y-3 ${bulkProgress.complete ? (bulkProgress.failed > 0 ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20' : 'border-green-300 bg-green-50/50 dark:bg-green-950/20') : 'border-blue-300 bg-blue-50/50 dark:bg-blue-950/20'}`} data-testid="whatsapp-bulk-progress">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {!bulkProgress.complete ? (
                        <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
                      ) : bulkProgress.failed > 0 ? (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                      <span className="text-sm font-semibold">
                        {bulkProgress.complete ? "Bulk Send Complete" : "Sending Messages..."}
                      </span>
                    </div>
                    {bulkProgress.complete && (
                      <button
                        type="button"
                        onClick={() => setBulkProgress(null)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${bulkProgress.complete ? (bulkProgress.failed > 0 ? 'bg-amber-500' : 'bg-green-500') : 'bg-blue-500'}`}
                      style={{ width: `${bulkProgress.percent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-green-700 dark:text-green-400 font-medium">{bulkProgress.sent.toLocaleString()} sent</span>
                      {bulkProgress.failed > 0 && (
                        <span className="text-red-600 font-medium">{bulkProgress.failed.toLocaleString()} failed</span>
                      )}
                      <span className="text-muted-foreground">of {bulkProgress.total.toLocaleString()}</span>
                      {(bulkProgress as any).queued > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">{((bulkProgress as any).queued).toLocaleString()} over daily limit</span>
                      )}
                    </div>
                    <span className="text-muted-foreground font-mono">{bulkProgress.percent}%</span>
                  </div>
                  {!bulkProgress.complete && bulkProgress.estimatedRemaining && bulkProgress.estimatedRemaining > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      Estimated time remaining: {bulkProgress.estimatedRemaining > 60 ? `${Math.round(bulkProgress.estimatedRemaining / 60)}m` : `${bulkProgress.estimatedRemaining}s`}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : isTikTokOnly ? (
            <div className="space-y-4 rounded-lg border-2 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 p-4">
              <div className="flex items-center gap-2">
                <Video className="h-5 w-5 text-red-500" />
                <span className="text-sm font-semibold">Upload Video for TikTok</span>
              </div>
              <p className="text-xs text-muted-foreground">TikTok only supports video posts. Upload a video or paste a video URL below.</p>
              <input
                type="file"
                ref={tiktokFileRef}
                accept="video/*"
                className="hidden"
                data-testid="input-tiktok-video-file"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setTiktokVideoUploading(true);
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
                      setTiktokVideoUrl(data.url);
                      setSelectedMediaIds([data.url]);
                      toast({ title: "Video Uploaded", description: "Video ready for TikTok posting." });
                    } else {
                      toast({ title: "Upload Failed", description: data.error || "Could not upload video", variant: "destructive" });
                    }
                  } catch {
                    toast({ title: "Upload Failed", description: "Could not upload video", variant: "destructive" });
                  } finally {
                    setTiktokVideoUploading(false);
                    if (tiktokFileRef.current) tiktokFileRef.current.value = "";
                  }
                }}
              />
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => tiktokFileRef.current?.click()}
                  disabled={tiktokVideoUploading}
                  data-testid="btn-upload-tiktok-video"
                  className="border-red-300 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  {tiktokVideoUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  {tiktokVideoUploading ? "Uploading..." : "Upload Video"}
                </Button>
                <span className="text-xs text-muted-foreground">or</span>
              </div>
              <Input
                placeholder="Paste video URL here..."
                value={tiktokVideoUrl}
                onChange={(e) => {
                  setTiktokVideoUrl(e.target.value);
                  if (e.target.value.trim()) {
                    setSelectedMediaIds([e.target.value.trim()]);
                  } else {
                    setSelectedMediaIds([]);
                  }
                }}
                className="text-sm"
                data-testid="input-tiktok-video-url"
              />
              {tiktokVideoUrl && (
                <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded-md border border-green-200 dark:border-green-800">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-green-700 dark:text-green-300 truncate flex-1">Video ready: {tiktokVideoUrl.length > 50 ? tiktokVideoUrl.slice(0, 50) + "..." : tiktokVideoUrl}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                    onClick={() => { setTiktokVideoUrl(""); setSelectedMediaIds([]); }}
                    data-testid="btn-remove-tiktok-video"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Video Description (Optional)</label>
                <Textarea
                  placeholder="Add a description for your TikTok video..."
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  className="min-h-[60px]"
                  data-testid="textarea-tiktok-description"
                />
              </div>
            </div>
          ) : (
            <>
              <Textarea
                placeholder={
                  selectedPostType
                    ? `Enter details for your ${postTypes
                        .find((t) => t.id === selectedPostType)
                        ?.label.toLowerCase()} post...`
                    : `${terms.topicPlaceholder} — or select a post type above and click AI Optimize`
                }
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                className="min-h-[100px]"
                data-testid="textarea-social-post"
              />

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Brain className="h-3 w-3" />
                    AI Prompt (Optional)
                  </label>
                </div>
                <Input
                  placeholder="Add specific instructions for AI enhancement (e.g., 'Make it more engaging', 'Add call-to-action', 'Include market stats')..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="text-sm"
                  data-testid="input-ai-prompt"
                />
                <p className="text-xs text-muted-foreground">
                  💡 Use this to guide AI optimization with specific instructions or
                  tone preferences
                </p>
              </div>

              {isRealEstate && postContent.trim().length > 10 && (
                <ComplianceChecker
                  content={postContent}
                  platform={selectedPlatforms[0] || "general"}
                  hasMedia={selectedMediaIds.length > 0}
                  hasVideo={false}
                  onContentFix={(fixedContent) => setPostContent(fixedContent)}
                  showGuidelines={true}
                />
              )}
            </>
          )}

          {selectedPlatforms.length > 0 && !isWhatsAppOnly && (
            <div className="text-xs text-muted-foreground">
              Posting to:{" "}
              {selectedPlatforms
                .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                .join(", ")}
            </div>
          )}
          {selectedPlatforms.includes("whatsapp") && !isWhatsAppOnly && (
            <div className="space-y-1">
              <Label htmlFor="whatsapp-to" className="text-xs">WhatsApp Recipient Phone Numbers</Label>
              <textarea
                id="whatsapp-to"
                data-testid="input-whatsapp-to"
                placeholder={"Enter phone numbers (one per line or comma-separated)\nExample: 15185459592, 447911123456"}
                value={whatsappTo}
                onChange={(e) => {
                  const val = e.target.value;
                  const count = val.split(/[\n,]+/).filter((n: string) => n.replace(/\D/g, "").length > 0).length;
                  if (count <= 30000) {
                    setWhatsappTo(val);
                  }
                }}
                className="text-sm min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {whatsappTo.split(/[\n,]+/).filter((n: string) => n.replace(/\D/g, "").length > 0).length.toLocaleString()} / 30,000 numbers — Enter with country code, one per line or comma-separated
                </p>
                <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                  <input
                    type="file"
                    accept=".csv,.txt,.pdf,.docx"
                    className="hidden"
                    data-testid="input-upload-contacts"
                    disabled={isExtractingNumbers}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setIsExtractingNumbers(true);
                      try {
                        const formData = new FormData();
                        formData.append("file", file);
                        const token = localStorage.getItem("authToken") || "";
                        const response = await fetch("/api/whatsapp/extract-numbers", {
                          method: "POST",
                          headers: {
                            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                          },
                          body: formData,
                        });
                        const data = await response.json();
                        if (data.numbers && data.numbers.length > 0) {
                          const existing = whatsappTo.trim();
                          const newNumbers = data.numbers.join("\n");
                          setWhatsappTo(existing ? existing + "\n" + newNumbers : newNumbers);
                          toast({
                            title: "Numbers Imported",
                            description: `Extracted ${data.count} phone numbers from ${data.filename}`,
                          });
                        } else {
                          toast({
                            title: "No Numbers Found",
                            description: "Could not find any phone numbers in the uploaded file.",
                            variant: "destructive",
                          });
                        }
                      } catch (err) {
                        toast({
                          title: "Upload Failed",
                          description: "Failed to process the file. Please try again.",
                          variant: "destructive",
                        });
                      } finally {
                        setIsExtractingNumbers(false);
                        e.target.value = "";
                      }
                    }}
                  />
                  {isExtractingNumbers ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3" />
                  )}
                  {isExtractingNumbers ? "Extracting..." : "Import from File"}
                </label>
              </div>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                Supported files: Excel/CSV (.csv), PDF (.pdf), Word (.docx), or plain text (.txt) containing phone numbers
              </p>
              <WhatsAppTemplateSelector
                selectedTemplate={whatsappTemplateName}
                onSelectTemplate={(name) => setWhatsappTemplateName(name)}
              />
            </div>
          )}
          {selectedPlatforms.length > 0 && (
            <div className="flex items-center gap-2 px-1 py-1.5 rounded-md bg-muted/40 border border-border/50">
              <span className="text-[10px] text-muted-foreground font-medium ml-1">Posting to:</span>
              {selectedPlatforms.map((p) => {
                const pInfo = platformIcons[p as keyof typeof platformIcons];
                if (!pInfo) return null;
                const Icon = pInfo.icon;
                return (
                  <span key={p} className={`inline-flex items-center gap-1 text-[10px] font-medium ${pInfo.color}`}>
                    <Icon className="h-3 w-3" />
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </span>
                );
              })}
              {postMutation.isPending && (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-medium ml-auto mr-1">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Sending...
                </span>
              )}
            </div>
          )}
          {!isTikTokOnly && selectedPlatforms.includes("tiktok") && selectedMediaIds.length === 0 && !selectedPropertyPhotoUrl && (
            <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-md text-orange-700 dark:text-orange-300 text-xs" data-testid="warning-tiktok-video">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>TikTok requires a video. Upload or paste a video URL from the media gallery above before posting.</span>
            </div>
          )}
          {selectedPlatforms.includes("instagram") && selectedMediaIds.length === 0 && !selectedPropertyPhotoUrl && (
            <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-md text-orange-700 dark:text-orange-300 text-xs" data-testid="warning-instagram-media">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Instagram requires an image or video. Upload or paste a URL from the media gallery above before posting.</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Dialog open={showPreview} onOpenChange={setShowPreview}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    disabled={!postContent.trim() && !(selectedPlatforms.includes("whatsapp") && whatsappTemplateName && whatsappTemplateName !== "none")}
                    data-testid="button-preview-post"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Post Preview</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Posting to:{" "}
                      {selectedPlatforms.length > 0
                        ? selectedPlatforms
                            .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                            .join(", ")
                        : "No platforms selected"}
                    </div>
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-golden-accent rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-golden-foreground">
                            {agentName.split(' ').map((n: string) => n.charAt(0)).join('').substring(0, 2)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm text-foreground">
                            {agentName}
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">
                            {businessName} at {brokerageName}
                          </div>
                          <div className="text-sm text-foreground whitespace-pre-wrap">
                            {postContent}
                          </div>
                          {(selectedPropertyPhotoUrl || selectedMediaIds.length > 0) && (
                            <div className="mt-3 grid grid-cols-1 gap-2">
                              {selectedPropertyPhotoUrl && (
                                <div className="rounded-md overflow-hidden border" data-testid="preview-selected-photo">
                                  <img
                                    src={selectedPropertyPhotoUrl}
                                    alt="Selected listing photo"
                                    className="w-full h-40 object-cover"
                                  />
                                </div>
                              )}
                              {selectedMediaIds.map((idOrUrl, idx) => {
                                const asset = mediaAssets.find((a: any) => a.id === idOrUrl);
                                const url = asset ? asset.url : idOrUrl;
                                return (
                                  <div key={idx} className="rounded-md overflow-hidden border" data-testid={`preview-media-${idx}`}>
                                    <img
                                      src={url}
                                      alt={`Selected media ${idx + 1}`}
                                      className="w-full h-40 object-cover"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {selectedProperty && (
                            <div className="mt-3 p-3 bg-background rounded-md border">
                              <div className="font-medium text-sm">
                                {selectedProperty.address}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {selectedProperty.city},{" "}
                                {selectedProperty.state}
                              </div>
                              <div className="text-sm font-medium mt-1">
                                $
                                {selectedProperty.listPrice?.toLocaleString() ||
                                  "0"}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {selectedProperty.bedrooms || 0}bd •{" "}
                                {selectedProperty.bathrooms || 0}ba •{" "}
                                {selectedProperty.squareFootage?.toLocaleString() ||
                                  "0"}{" "}
                                sq ft
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      className="w-full"
                      data-testid="button-download-post"
                      onClick={() => {
                        const platforms = selectedPlatforms.length > 0
                          ? selectedPlatforms.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(", ")
                          : "No platforms selected";
                        const lines: string[] = [
                          "POST PREVIEW",
                          "============",
                          `Platforms: ${platforms}`,
                          "",
                          agentName,
                          `${businessName} at ${brokerageName}`,
                          "",
                          postContent,
                        ];
                        if (selectedProperty) {
                          lines.push(
                            "",
                            "--- Property ---",
                            `Address: ${selectedProperty.address}`,
                            `${selectedProperty.city}, ${selectedProperty.state}`,
                            `Price: $${selectedProperty.listPrice?.toLocaleString() || "0"}`,
                            `${selectedProperty.bedrooms || 0} bd • ${selectedProperty.bathrooms || 0} ba • ${selectedProperty.squareFootage?.toLocaleString() || "0"} sq ft`,
                          );
                        }
                        const blob = new Blob([lines.join("\n")], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "post.txt";
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Post
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    disabled={isTikTokOnly ? !tiktokVideoUrl : (!postContent.trim() && !(selectedPlatforms.includes("whatsapp") && whatsappTemplateName && whatsappTemplateName !== "none"))}
                    data-testid="button-schedule"
                  >
                    <Calendar className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md" data-testid="dialog-schedule-post">
                  <DialogHeader>
                    <DialogTitle>Schedule Post</DialogTitle>
                    <DialogDescription>Choose when and where to publish your post</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                    {postContent.trim() && (
                      <div className="rounded-md border p-3 bg-muted/50">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Post Preview</p>
                        <p className="text-sm" data-testid="text-schedule-preview">
                          {postContent.length > 140 ? postContent.slice(0, 140) + "…" : postContent}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {(schedulePlatformOverrides.length > 0 ? schedulePlatformOverrides : selectedPlatforms).map((p) => {
                            const charLimits: Record<string, number> = { x: 280, twitter: 280, facebook: 63206, instagram: 2200, linkedin: 3000, tiktok: 2200, youtube: 5000, whatsapp: 65536 };
                            const limit = charLimits[p] || 5000;
                            const over = postContent.length > limit;
                            return (
                              <span key={p} className={`text-xs px-2 py-0.5 rounded-full ${over ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-muted text-muted-foreground"}`} data-testid={`text-charcount-${p}`}>
                                {p.charAt(0).toUpperCase() + p.slice(1)}: {postContent.length}/{limit}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-sm font-medium">
                        <Clock className="h-3.5 w-3.5" />
                        Quick Presets
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: "Today at Noon", getDate: () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; } },
                          { label: "Today at 5 PM", getDate: () => { const d = new Date(); d.setHours(17, 0, 0, 0); return d; } },
                          { label: "Tomorrow 9 AM", getDate: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; } },
                          { label: "This Weekend", getDate: () => { const d = new Date(); const day = d.getDay(); const diff = day === 0 ? 6 : 6 - day; d.setDate(d.getDate() + diff); d.setHours(10, 0, 0, 0); return d; } },
                          { label: "Next Monday", getDate: () => { const d = new Date(); const day = d.getDay(); const diff = day === 0 ? 1 : 8 - day; d.setDate(d.getDate() + diff); d.setHours(8, 0, 0, 0); return d; } },
                        ].map((preset) => (
                          <Button
                            key={preset.label}
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            data-testid={`button-preset-${preset.label.toLowerCase().replace(/\s+/g, "-")}`}
                            onClick={() => {
                              const d = preset.getDate();
                              const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                              setScheduleDate(local);
                            }}
                          >
                            {preset.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="schedule-date">Custom Date & Time</Label>
                      <input
                        id="schedule-date"
                        type="datetime-local"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        min={new Date().toISOString().slice(0, 16)}
                        value={scheduleDate}
                        data-testid="input-schedule-date"
                        onChange={(e) => setScheduleDate(e.target.value)}
                      />
                    </div>

                    <div className="flex items-start gap-2 rounded-md bg-blue-50 dark:bg-blue-950/30 p-2.5">
                      <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-blue-700 dark:text-blue-300" data-testid="text-best-times">
                        Best times to post: Tue/Thu 9-11 AM, Wed 12 PM
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Platforms</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {accounts?.filter((a) => a.isConnected).map((account) => {
                          const meta = platformIcons[account.platform as keyof typeof platformIcons];
                          const IconComp = meta?.icon;
                          const overrides = schedulePlatformOverrides.length > 0 ? schedulePlatformOverrides : selectedPlatforms;
                          const isChecked = overrides.includes(account.platform);
                          return (
                            <label
                              key={account.platform}
                              className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/50 transition-colors"
                              data-testid={`label-platform-override-${account.platform}`}
                            >
                              <Checkbox
                                checked={isChecked}
                                data-testid={`checkbox-platform-${account.platform}`}
                                onCheckedChange={(checked) => {
                                  const current = schedulePlatformOverrides.length > 0 ? schedulePlatformOverrides : [...selectedPlatforms];
                                  if (checked) {
                                    setSchedulePlatformOverrides([...current.filter((p) => p !== account.platform), account.platform]);
                                  } else {
                                    setSchedulePlatformOverrides(current.filter((p) => p !== account.platform));
                                  }
                                }}
                              />
                              {IconComp && <IconComp className={`h-4 w-4 ${meta.color}`} />}
                              <div className="flex items-center gap-1">
                                <span className="text-sm capitalize">{account.platform}</span>
                                {(account.platform === "x" || account.platform === "twitter") && (
                                  <span className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded-full font-medium">Temporarily down</span>
                                )}
                                {account.platform === "instagram" && (
                                  <span className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded-full font-medium">Temporarily down</span>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-sm font-medium">
                        <Repeat className="h-3.5 w-3.5" />
                        Recurring Schedule
                      </Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={scheduleRecurring}
                        data-testid="select-recurring"
                        onChange={(e) => setScheduleRecurring(e.target.value)}
                      >
                        <option value="one-time">One-time</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="bi-weekly">Bi-weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                      {scheduleRecurring !== "one-time" && (
                        <div className="space-y-1">
                          <Label htmlFor="schedule-end-date" className="text-xs">End Date{!scheduleEndDate && <span className="text-muted-foreground ml-1">(Defaults to 30 days)</span>}</Label>
                          <input
                            id="schedule-end-date"
                            type="date"
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            min={new Date().toISOString().slice(0, 10)}
                            value={scheduleEndDate}
                            data-testid="input-schedule-end-date"
                            onChange={(e) => setScheduleEndDate(e.target.value)}
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer" data-testid="label-generate-unique">
                        <Checkbox
                          checked={scheduleGenerateUnique}
                          data-testid="checkbox-generate-unique"
                          onCheckedChange={(checked) => setScheduleGenerateUnique(!!checked)}
                        />
                        <span className="text-sm font-medium">Generate unique AI content for each platform & date</span>
                      </label>
                      {scheduleGenerateUnique && (
                        <div className="flex items-start gap-2 rounded-md bg-purple-50 dark:bg-purple-950/30 p-2.5">
                          <Sparkles className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                          <p className="text-xs text-purple-700 dark:text-purple-300" data-testid="text-unique-content-info">
                            AI will create unique, platform-optimized content for each post to maximize engagement and avoid duplicate content penalties
                          </p>
                        </div>
                      )}
                    </div>

                    {scheduleLoading && (
                      <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 p-3" data-testid="status-schedule-loading">
                        <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          Generating unique content for {(() => {
                            const platforms = schedulePlatformOverrides.length > 0 ? schedulePlatformOverrides : selectedPlatforms;
                            let dateSlots = 1;
                            if (scheduleRecurring !== "one-time" && scheduleDate) {
                              const start = new Date(scheduleDate);
                              const end = scheduleEndDate ? new Date(scheduleEndDate) : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
                              const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                              if (scheduleRecurring === "daily") dateSlots = diffDays;
                              else if (scheduleRecurring === "weekly") dateSlots = Math.ceil(diffDays / 7);
                              else if (scheduleRecurring === "bi-weekly") dateSlots = Math.ceil(diffDays / 14);
                              else if (scheduleRecurring === "monthly") dateSlots = Math.ceil(diffDays / 30);
                            }
                            return dateSlots * platforms.length;
                          })()} posts...
                        </p>
                      </div>
                    )}

                    <Button
                      className="w-full bg-golden-accent hover:bg-golden-accent/90 text-golden-foreground"
                      data-testid="button-confirm-schedule"
                      disabled={!scheduleDate || scheduleLoading}
                      onClick={async () => {
                        if (!scheduleDate) {
                          toast({ title: "Select a date", description: "Please pick a date and time to schedule", variant: "destructive" });
                          return;
                        }
                        const platforms = schedulePlatformOverrides.length > 0 ? schedulePlatformOverrides : selectedPlatforms;
                        if (platforms.length === 0) {
                          toast({ title: "No platforms", description: "Select at least one platform to schedule", variant: "destructive" });
                          return;
                        }
                        if (isTikTokOnly && !tiktokVideoUrl) {
                          toast({ title: "Video required", description: "TikTok requires a video. Upload or paste a video URL first.", variant: "destructive" });
                          return;
                        }
                        try {
                          const scheduleContent = isTikTokOnly ? (postContent.trim() || "Check out this video!") : postContent;
                          const scheduleImageUrl = isTikTokOnly ? (tiktokVideoUrl || null) : (selectedPropertyPhotoUrl || null);
                          let effectiveEndDate = scheduleEndDate || null;
                          if (scheduleRecurring !== "one-time" && !effectiveEndDate) {
                            const defaultEnd = new Date(new Date(scheduleDate).getTime() + 30 * 24 * 60 * 60 * 1000);
                            effectiveEndDate = defaultEnd.toISOString().slice(0, 10);
                          }
                          const useSmartSchedule = scheduleRecurring !== "one-time" || scheduleGenerateUnique;
                          if (useSmartSchedule) {
                            setScheduleLoading(true);
                            await apiRequest("POST", "/api/scheduled-posts/schedule-smart", {
                              content: scheduleContent,
                              platforms,
                              scheduledAt: new Date(scheduleDate).toISOString(),
                              recurring: scheduleRecurring,
                              endDate: effectiveEndDate,
                              propertyId: selectedProperty?.id || null,
                              imageUrl: scheduleImageUrl,
                              generateUniqueContent: scheduleGenerateUnique,
                            });
                          } else {
                            const metadata: Record<string, any> = {};
                            if (scheduleRecurring !== "one-time") {
                              metadata.recurring = scheduleRecurring;
                              if (scheduleEndDate) {
                                metadata.recurringEndDate = scheduleEndDate;
                              }
                            }
                            if (isTikTokOnly && tiktokVideoUrl) {
                              metadata.videoUrl = tiktokVideoUrl;
                            }
                            await apiRequest("POST", "/api/scheduled-posts", {
                              content: scheduleContent,
                              platforms,
                              scheduledAt: new Date(scheduleDate).toISOString(),
                              propertyId: selectedProperty?.id || null,
                              imageUrl: scheduleImageUrl,
                              ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
                            });
                          }
                          queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
                          toast({ title: "Post Scheduled!", description: `Your post will be published on ${new Date(scheduleDate).toLocaleString()}${scheduleRecurring !== "one-time" ? ` (${scheduleRecurring})` : ""}${scheduleGenerateUnique ? " with unique AI content" : ""}` });
                          setScheduleDate("");
                          setScheduleRecurring("one-time");
                          setScheduleEndDate("");
                          setSchedulePlatformOverrides([]);
                          setScheduleGenerateUnique(true);
                        } catch (error: any) {
                          toast({ title: "Scheduling Failed", description: error.message || "Could not schedule post", variant: "destructive" });
                        } finally {
                          setScheduleLoading(false);
                        }
                      }}
                    >
                      {scheduleLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Calendar className="h-4 w-4 mr-2" />
                      )}
                      {scheduleLoading ? "Scheduling..." : "Schedule Post"}
                    </Button>

                    {(() => {
                      const platforms = schedulePlatformOverrides.length > 0 ? schedulePlatformOverrides : selectedPlatforms;
                      let dateSlots = 1;
                      if (scheduleRecurring !== "one-time" && scheduleDate) {
                        const start = new Date(scheduleDate);
                        const end = scheduleEndDate ? new Date(scheduleEndDate) : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
                        const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                        if (scheduleRecurring === "daily") dateSlots = diffDays;
                        else if (scheduleRecurring === "weekly") dateSlots = Math.ceil(diffDays / 7);
                        else if (scheduleRecurring === "bi-weekly") dateSlots = Math.ceil(diffDays / 14);
                        else if (scheduleRecurring === "monthly") dateSlots = Math.ceil(diffDays / 30);
                      }
                      const totalPosts = dateSlots * platforms.length;
                      if (totalPosts > 1 || (scheduleGenerateUnique && platforms.length > 0)) {
                        return (
                          <p className="text-xs text-center text-muted-foreground" data-testid="text-schedule-summary">
                            This will create {totalPosts} post{totalPosts !== 1 ? "s" : ""}{dateSlots > 1 ? ` (${dateSlots} date${dateSlots !== 1 ? "s" : ""} × ${platforms.length} platform${platforms.length !== 1 ? "s" : ""})` : ""}{scheduleGenerateUnique ? " with unique AI content for each" : ""}
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="flex items-center space-x-2">
              {!isTikTokOnly && !isWhatsAppOnly && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleOptimizeContent}
                        disabled={
                          optimizeContentMutation.isPending || !postContent.trim()
                        }
                        variant="ghost"
                        size="sm"
                        className="text-primary hover:text-primary/80"
                        data-testid="button-optimize-content"
                      >
                        <Sparkles className="mr-1 h-3 w-3" />
                        {optimizeContentMutation.isPending
                          ? "Optimizing..."
                          : "AI Optimize"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p>AI Optimize enhances your post content with better engagement and professional messaging. It analyzes your text and suggests improvements for clarity, tone, and real estate marketing best practices to help get more visibility and responses from your audience.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <Button
                onClick={handlePost}
                disabled={
                  postMutation.isPending || selectedPlatforms.length === 0 || (isTikTokOnly && !tiktokVideoUrl)
                }
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="button-post-now"
              >
                {postMutation.isPending ? "Posting..." : "Post Now"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Video Upload Dialog for YouTube */}
      <Dialog open={showVideoUpload} onOpenChange={setShowVideoUpload}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Video for YouTube</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a video to post to your YouTube channel. This will create a
              public video on your channel.
            </p>

            {uploadedVideo ? (
              <div className="space-y-3">
                <div className="border rounded-lg p-4 bg-muted">
                  <div className="flex items-center gap-3">
                    <Video className="h-8 w-8 text-red-600" />
                    <div>
                      <p className="text-sm font-medium">
                        {uploadedVideo.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(uploadedVideo.size / (1024 * 1024)).toFixed(1)} MB
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-green-600 font-medium">
                    Video ready for upload!
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUploadedVideo(null)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Check file size (HeyGen max is 200MB)
                      if (file.size > 200 * 1024 * 1024) {
                        toast({
                          title: "File Too Large",
                          description:
                            "Please select a video smaller than 200MB",
                          variant: "destructive",
                        });
                        return;
                      }
                      setUploadedVideo(file);
                      toast({
                        title: "Video Selected",
                        description: "Your video is ready to upload to YouTube",
                      });
                    }
                  }}
                  className="w-full"
                />
                <div className="text-xs text-muted-foreground">
                  Supported formats: MP4, MOV, WEBM, MKV (max 200MB)
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowVideoUpload(false);
                  setUploadedVideo(null);
                }}
              >
                Cancel
              </Button>
              {uploadedVideo && (
                <Button
                  className="flex-1"
                  onClick={() => setShowVideoUpload(false)}
                >
                  Use This Video
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Post Composer */}
      <PostComposer
        open={showPostComposer}
        onOpenChange={setShowPostComposer}
      />
    </Card>
  );
}
