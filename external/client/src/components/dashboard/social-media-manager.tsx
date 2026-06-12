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
  BarChart3,
  Brain,
  AlertTriangle,
  Calendar,
  Check,
  Download,
  CheckCircle,
  Clock,
  CreditCard,
  DollarSign,
  Eye,
  Facebook,
  Home,
  Image,
  Info,
  Instagram,
  Linkedin,
  Loader2,
  Mail,
  MailOpen,
  Megaphone,
  MessageCircle,
  Pause,
  Play,
  Music,
  Percent,
  Plug,
  PlugZap,
  RefreshCw,
  Repeat,
  Send,
  Settings,
  ShieldAlert,
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
  Phone,
  Plus,
  Trash2,
  Twitter as X,
  BookOpen,
  ChevronDown,
  FileText,
  Pencil,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useBusinessType } from "@/lib/businessContext";
import { getIndustryContent } from "@shared/industryContent";
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
  listPrice: number | null;
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
  email: { icon: Mail, color: "text-emerald-600" },
};

const SYNTHETIC_EMAIL_ACCOUNT: SocialMediaAccount = {
  id: "email-always-available",
  platform: "email",
  isConnected: true,
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
  general: [
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

const VIDEO_DEFAULTS_BY_BUSINESS: Record<string, { title: string; description: string }> = {
  real_estate: { title: "Real Estate Video Update", description: "Check out this update from my real estate business!" },
  restaurant: { title: "Restaurant Video Update", description: "Check out what's cooking at our restaurant!" },
  home_services: { title: "Home Services Video Update", description: "See our latest project and what we can do for your home!" },
  retail: { title: "Product Video Update", description: "Check out our latest products and deals!" },
  professional_services: { title: "Professional Services Update", description: "Check out our latest insights and services!" },
  general: { title: "Business Video Update", description: "Check out what's new at our business!" },
};


function WhatsAppAccountSwitcher() {
  const { toast } = useToast();

  const { data: accountsData, isLoading } = useQuery<{ accounts: Array<{ label: string; phoneNumberId: string; wabaId: string; displayPhoneNumber?: string }>; activePhoneNumberId: string }>({
    queryKey: ["/api/whatsapp/accounts"],
    staleTime: 30_000,
  });

  const switchMutation = useMutation({
    mutationFn: async (phoneNumberId: string) => {
      const res = await apiRequest("POST", "/api/whatsapp/accounts/switch", { phoneNumberId });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/messaging-limit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/bulk-queues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/bulk-send-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations"] });
      toast({ title: "Switched account", description: `Now using "${data.label}"` });
    },
    onError: () => {
      toast({ title: "Failed to switch", variant: "destructive" });
    },
  });

  const DEFAULT_ACCOUNTS = [
    { label: "Namaste28 - Main", phoneNumberId: "1009337698927791", wabaId: "2690438238000842", displayPhoneNumber: "+1 402-320-4775" },
    { label: "Flavors Cuisine", phoneNumberId: "957638934108525", wabaId: "3832373050232855", displayPhoneNumber: "+1 479-254-1035" },
  ];
  const rawAccounts = accountsData?.accounts || [];
  const accounts = rawAccounts.length > 0 ? rawAccounts : DEFAULT_ACCOUNTS;
  const activeId = accountsData?.activePhoneNumberId || accounts[0]?.phoneNumberId || "";

  if (isLoading) return null;

  const activeAccount = accounts.find(a => a.phoneNumberId === activeId);

  return (
    <div className="flex items-center gap-2 mb-2" data-testid="whatsapp-account-switcher">
      <Phone className="h-3.5 w-3.5 text-green-600 shrink-0" />
      <span className="text-xs text-muted-foreground font-medium shrink-0">Send from:</span>
      <Select
        value={activeId}
        onValueChange={(val) => {
          if (val !== activeId) switchMutation.mutate(val);
        }}
      >
        <SelectTrigger className="h-7 text-xs w-auto min-w-[180px] border-green-200 dark:border-green-800" data-testid="select-whatsapp-account">
          <SelectValue placeholder="Select account" />
        </SelectTrigger>
        <SelectContent>
          {accounts.map(acct => (
            <SelectItem key={acct.phoneNumberId} value={acct.phoneNumberId} data-testid={`option-account-${acct.phoneNumberId}`}>
              <div className="flex items-center gap-1.5">
                {acct.phoneNumberId === activeId && <CheckCircle className="h-3 w-3 text-green-500" />}
                <span>{acct.label}</span>
                {acct.displayPhoneNumber && <span className="text-muted-foreground ml-1">({acct.displayPhoneNumber})</span>}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {switchMutation.isPending && <Loader2 className="h-3 w-3 animate-spin text-green-600" />}
    </div>
  );
}

function WhatsAppTemplateSelector({ selectedTemplate, onSelectTemplate, onSelectLanguage, onTemplateBodyChange }: { selectedTemplate: string; onSelectTemplate: (name: string) => void; onSelectLanguage?: (lang: string) => void; onTemplateBodyChange?: (body: string) => void }) {
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
    const upper = (cat || "").toUpperCase();
    if (upper === "UTILITY") return "🔧";
    if (upper === "AUTHENTICATION") return "🔑";
    return "📣";
  };

  const categoryBadge = (cat: string) => {
    const upper = (cat || "").toUpperCase();
    if (upper === "UTILITY") return { label: "Utility", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" };
    if (upper === "AUTHENTICATION") return { label: "Auth", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" };
    return { label: "Marketing", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" };
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

          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground font-medium">Quick Templates</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {[
                {
                  label: "Anniversary Full (Marketing)",
                  name: "anniversary_celebration_15yr",
                  category: "MARKETING",
                  header: "Flavors Indian Cuisine",
                  body: "Dear Family & Friends \u2764\uFE0F\nWe're overjoyed to celebrate 15 Years of Flavors Indian Cuisine, and it's all because of your love and support! Visit us for our Anniversary Unlimited Mega Grand Lunch & Dinner Buffet:\n\n\uD83D\uDCC5 March 4\u20137, 2026 \u2013 Mega Grand Lunch & Dinner Buffet\n\uD83D\uDCC5 March 8, 2026 \u2013 Mega Grand Special Lunch Buffet\n\nPlease share this message with your friends and family and help us make this celebration even more special! \u2764\uFE0F\n\nPlease consider this message as my personal invitation and your presence makes me happy. See you at the buffet!",
                  footer: "Flavors Indian Cuisine | flavorsic.com",
                  icon: "\uD83C\uDF89",
                },
                {
                  label: "Anniversary Short (Utility)",
                  name: "anniversary_event_update",
                  category: "UTILITY",
                  header: "Event Update",
                  body: "Hi! Your reservation-eligible event at Flavors Indian Cuisine is happening soon.\n\n15th Anniversary Buffet:\nMar 4\u20137 \u2013 Lunch & Dinner\nMar 8 \u2013 Special Lunch\n\nUnlimited Grand Buffet. Walk-ins welcome.\nCall to reserve your spot.",
                  footer: "Flavors Indian Cuisine",
                  icon: "\uD83D\uDD14",
                },
                {
                  label: "Order Confirmation (Utility)",
                  name: "order_confirmation",
                  category: "UTILITY",
                  header: "Order Confirmed",
                  body: "Your order has been confirmed! We're preparing it now.\n\nEstimated ready time: 25-35 minutes.\n\nThank you for choosing us!",
                  footer: "",
                  icon: "\u2705",
                },
                {
                  label: "Reservation Reminder (Utility)",
                  name: "reservation_reminder",
                  category: "UTILITY",
                  header: "Reservation Reminder",
                  body: "Hi! This is a reminder about your upcoming reservation.\n\nPlease arrive on time. If you need to modify or cancel, reply to this message or call us.\n\nWe look forward to seeing you!",
                  footer: "",
                  icon: "\uD83D\uDCC5",
                },
              ].map((qt) => (
                <button
                  key={qt.name}
                  type="button"
                  onClick={() => {
                    setNewName(qt.name);
                    setNewCategory(qt.category);
                    setNewHeader(qt.header);
                    setNewBody(qt.body);
                    setNewFooter(qt.footer);
                  }}
                  className="flex items-start gap-2 p-2 rounded-lg border border-border/60 hover:border-green-300 dark:hover:border-green-700 hover:bg-green-50/30 dark:hover:bg-green-950/20 transition-all text-left"
                  data-testid={`quick-template-${qt.name}`}
                >
                  <span className="text-sm mt-0.5">{qt.icon}</span>
                  <div>
                    <div className="text-[10px] font-semibold">{qt.label}</div>
                    <div className="text-[9px] text-muted-foreground line-clamp-2 mt-0.5">{qt.body.substring(0, 80)}...</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

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
              {newCategory === "MARKETING" && (
                <p className="text-[9px] text-red-600 dark:text-red-400 mt-0.5 font-medium">⚠️ Marketing templates won't deliver to US numbers</p>
              )}
              {newCategory === "UTILITY" && (
                <p className="text-[9px] text-green-600 dark:text-green-400 mt-0.5 font-medium">✅ Utility templates deliver to all numbers</p>
              )}
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

      <Select value={selectedTemplate} onValueChange={(val) => {
        onSelectTemplate(val);
        const tpl = templates.find((t: any) => t.name === val);
        if (onSelectLanguage) onSelectLanguage(tpl?.language || "en_US");
        const bodyComp = tpl?.components?.find((c: any) => c.type === "BODY");
        if (onTemplateBodyChange) onTemplateBodyChange(bodyComp?.text || "");
      }}>
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
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-1.5 max-h-[350px] overflow-y-auto pr-1">
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
                  previewTemplate?.name === t.name ? "col-span-2 xl:col-span-3" : ""
                } ${
                  isSelected
                    ? "border-green-500 bg-green-50/50 dark:bg-green-950/20 shadow-sm shadow-green-200/50 dark:shadow-green-900/30"
                    : isPending
                      ? "border-amber-200/60 dark:border-amber-800/40 hover:border-amber-300 bg-amber-50/20 dark:bg-amber-950/10"
                      : "border-border/60 hover:border-green-300 dark:hover:border-green-700 hover:shadow-sm"
                }`}
                onClick={() => {
                  if (!isPending) {
                    onSelectTemplate(t.name);
                    if (onSelectLanguage) onSelectLanguage(t.language || "en_US");
                    const bc = t.components?.find((c: any) => c.type === "BODY");
                    if (onTemplateBodyChange) onTemplateBodyChange(bc?.text || "");
                  }
                  setPreviewTemplate(previewTemplate?.name === t.name ? null : t);
                }}
                data-testid={`template-card-${t.name}`}
              >
                <div className="flex items-start gap-2 px-2.5 py-2">
                  <span className="text-sm flex-shrink-0 mt-0.5">{categoryIcon(t.category)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 justify-between">
                      <span className="font-semibold text-foreground truncate text-[11px] leading-tight">{formatTemplateName(t.name)}</span>
                      {isSelected && (
                        <span className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </span>
                      )}
                    </div>
                    {headerText && !previewTemplate?.name && (
                      <p className="text-[9px] text-muted-foreground truncate mt-0.5">{headerText}</p>
                    )}
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-semibold border ${badge.color}`}>
                        <span className={`w-1 h-1 rounded-full ${badge.dot}`} />
                        {badge.label}
                      </span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-semibold ${categoryBadge(t.category).color}`}>
                        {categoryBadge(t.category).label}
                      </span>
                    </div>
                  </div>
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

      {selectedTemplate && selectedTemplate !== "none" && (() => {
        const selTpl = templates.find((t: any) => t.name === selectedTemplate);
        const isMarketing = (selTpl?.category || "").toUpperCase() === "MARKETING";
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
              <p className="text-[11px] text-green-700 dark:text-green-400 font-medium">
                Template: <span className="font-bold">{formatTemplateName(selectedTemplate)}</span> ({selTpl?.category || "MARKETING"}) — sends without 24hr window restriction
              </p>
            </div>
            {isMarketing && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-800" data-testid="warning-us-marketing-pause">
                <span className="text-red-500 text-sm flex-shrink-0 mt-0.5">⚠️</span>
                <div className="text-[11px] text-red-700 dark:text-red-400">
                  <p className="font-bold">US Marketing Pause Active</p>
                  <p className="mt-0.5">Since April 2025, Meta has paused delivery of <strong>Marketing</strong> templates to US (+1) phone numbers. Messages are accepted by the API but NOT delivered. Only <strong>Utility</strong> and <strong>Authentication</strong> templates are delivered to US numbers. Consider switching to a Utility template for US contacts.</p>
                </div>
              </div>
            )}
          </div>
        );
      })()}
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

function WhatsAppAnalyticsSection({ bulkProgress }: { bulkProgress?: any }) {
  const [waAnalytics, setWaAnalytics] = useState<any>(null);
  const [waAnalyticsLoading, setWaAnalyticsLoading] = useState(false);
  const [waAnalyticsDays, setWaAnalyticsDays] = useState(7);

  const { data: accountsData } = useQuery<{ accounts: any[]; activePhoneNumberId: string }>({
    queryKey: ["/api/whatsapp/accounts"],
    staleTime: 30_000,
  });
  const activePhoneNumberId = accountsData?.activePhoneNumberId || "";

  const fetchAnalytics = async (days: number) => {
    setWaAnalyticsLoading(true);
    try {
      const token = localStorage.getItem("authToken") || "";
      const res = await fetch(`/api/whatsapp/analytics?days=${days}`, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setWaAnalytics(data);
      }
    } catch {}
    setWaAnalyticsLoading(false);
  };

  useEffect(() => { fetchAnalytics(waAnalyticsDays); }, [waAnalyticsDays, activePhoneNumberId]);

  return (
    <div className="space-y-3" data-testid="whatsapp-analytics-section">
      <WhatsAppAccountSwitcher />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="h-4 w-4 text-green-500" />
          <span>WhatsApp Analytics</span>
        </div>
        <div className="flex items-center gap-1">
          {[7, 14, 30].map(d => (
            <button
              key={d}
              onClick={() => setWaAnalyticsDays(d)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${waAnalyticsDays === d ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              data-testid={`btn-wa-analytics-${d}d`}
            >
              {d}d
            </button>
          ))}
          <button onClick={() => fetchAnalytics(waAnalyticsDays)} className="ml-1 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700" data-testid="btn-wa-analytics-refresh">
            <RefreshCw className={`h-3 w-3 text-muted-foreground ${waAnalyticsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {waAnalyticsLoading && !waAnalytics ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-green-500" />
          <span className="ml-2 text-xs text-muted-foreground">Loading analytics from Meta...</span>
        </div>
      ) : waAnalytics ? (
        <>
          {(() => {
            const tplTotals = waAnalytics.templateAnalytics?.totals;
            const msgTotals = waAnalytics.messagingAnalytics?.totals;
            let sent = msgTotals?.sent || tplTotals?.sent || 0;
            let delivered = msgTotals?.delivered || tplTotals?.delivered || 0;
            const read = tplTotals?.read || 0;
            const hasReadData = tplTotals && !waAnalytics.templateAnalytics?.error;

            let usingBulkFallback = false;
            if (sent === 0 && bulkProgress && bulkProgress.sent > 0) {
              sent = bulkProgress.sent;
              delivered = bulkProgress.sent - (bulkProgress.failed || 0);
              usingBulkFallback = true;
            }

            const blocked = sent - delivered;
            const deliveryRate = sent > 0 ? Math.round((delivered / sent) * 100) : 0;
            const readRate = hasReadData && delivered > 0 ? Math.round((read / delivered) * 100) : 0;

            return (
              <div className="space-y-1">
                {usingBulkFallback && (
                  <div className="text-[9px] text-muted-foreground italic">Based on your recent bulk send — Meta analytics may take a few hours to update</div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="rounded-lg border p-2.5 text-center" data-testid="wa-metric-sent">
                    <Send className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                    <div className="text-lg font-bold">{sent.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground">Messages Sent</div>
                  </div>
                  <div className="rounded-lg border p-2.5 text-center" data-testid="wa-metric-delivered">
                    <CheckCircle className="h-4 w-4 mx-auto mb-1 text-green-500" />
                    <div className="text-lg font-bold">{delivered.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground">Delivered</div>
                    {deliveryRate > 0 && <div className="text-[9px] text-green-600 font-medium">{deliveryRate}%</div>}
                  </div>
                  <div className="rounded-lg border p-2.5 text-center" data-testid="wa-metric-read">
                    <MailOpen className="h-4 w-4 mx-auto mb-1 text-purple-500" />
                    <div className="text-lg font-bold">{hasReadData ? read.toLocaleString() : "—"}</div>
                    <div className="text-[10px] text-muted-foreground">Messages Read</div>
                    {hasReadData && readRate > 0 && <div className="text-[9px] text-purple-600 font-medium">{readRate}%</div>}
                  </div>
                  <div className="rounded-lg border p-2.5 text-center" data-testid="wa-metric-blocked">
                    <ShieldAlert className="h-4 w-4 mx-auto mb-1 text-red-500" />
                    <div className="text-lg font-bold">{blocked.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground">Not Delivered</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {waAnalytics.conversationAnalytics && !waAnalytics.conversationAnalytics.error && (
            <div className="space-y-1.5" data-testid="wa-conversation-breakdown">
              <div className="text-[11px] font-semibold text-muted-foreground">Conversations by Category</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                {Object.entries(waAnalytics.conversationAnalytics.byCategory || {}).map(([cat, data]: [string, any]) => {
                  const catColors: Record<string, string> = {
                    MARKETING: "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20",
                    UTILITY: "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20",
                    SERVICE: "border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/20",
                    AUTHENTICATION: "border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20",
                  };
                  const catTextColors: Record<string, string> = {
                    MARKETING: "text-red-700 dark:text-red-400",
                    UTILITY: "text-blue-700 dark:text-blue-400",
                    SERVICE: "text-gray-700 dark:text-gray-400",
                    AUTHENTICATION: "text-purple-700 dark:text-purple-400",
                  };
                  return (
                    <div key={cat} className={`rounded-lg border p-2 text-center ${catColors[cat] || "border-border"}`}>
                      <div className={`text-[9px] font-bold uppercase ${catTextColors[cat] || "text-muted-foreground"}`}>{cat}</div>
                      <div className="text-sm font-bold">{(data.conversations || 0).toLocaleString()}</div>
                      {data.cost > 0 && <div className="text-[9px] text-muted-foreground">${data.cost.toFixed(2)}</div>}
                    </div>
                  );
                })}
              </div>
              {waAnalytics.conversationAnalytics.totalCost > 0 && (
                <div className="text-[10px] text-right text-muted-foreground">
                  Total: {waAnalytics.conversationAnalytics.totalConversations?.toLocaleString()} conversations | ${waAnalytics.conversationAnalytics.totalCost?.toFixed(2)}
                </div>
              )}
            </div>
          )}

          {waAnalytics.pricingAnalytics && !waAnalytics.pricingAnalytics.error && (
            <div className="space-y-1.5" data-testid="wa-pricing-breakdown">
              <div className="text-[11px] font-semibold text-muted-foreground">Pricing Breakdown</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                {Object.entries(waAnalytics.pricingAnalytics.byCategory || {}).map(([cat, data]: [string, any]) => (
                  <div key={cat} className="rounded-lg border p-2 text-center">
                    <div className="text-[9px] font-bold uppercase text-muted-foreground">{cat.replace(/_/g, " ")}</div>
                    <div className="text-sm font-bold">{(data.volume || 0).toLocaleString()}</div>
                    <div className="text-[9px] text-muted-foreground">${(data.cost || 0).toFixed(2)}</div>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-right text-muted-foreground">
                Total: {waAnalytics.pricingAnalytics.totalVolume?.toLocaleString()} messages | ${waAnalytics.pricingAnalytics.totalCost?.toFixed(2)}
              </div>
            </div>
          )}

          {waAnalytics.phoneQuality && !waAnalytics.phoneQuality.error && (
            <div className="rounded-lg border p-2.5 flex items-center justify-between text-xs" data-testid="wa-phone-quality">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-3.5 w-3.5 text-green-500" />
                <span className="font-medium">{waAnalytics.phoneQuality.displayPhoneNumber || "Phone"}</span>
                <span className="text-muted-foreground">({waAnalytics.phoneQuality.verifiedName})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                  waAnalytics.phoneQuality.qualityRating === "GREEN" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" :
                  waAnalytics.phoneQuality.qualityRating === "YELLOW" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300" :
                  "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                }`}>
                  Quality: {waAnalytics.phoneQuality.qualityRating}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 text-[9px] font-medium">
                  Tier: {waAnalytics.phoneQuality.messagingLimitTier?.replace("TIER_", "")?.replace("_", ",")}
                </span>
              </div>
            </div>
          )}

          {waAnalytics.templateAnalytics?.totals && (
            <div className="grid grid-cols-3 gap-1.5 rounded-lg border p-2.5" data-testid="wa-template-totals">
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground">Amount Spent</div>
                <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">${(waAnalytics.templateAnalytics.totals.cost || 0).toFixed(2)}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground">Cost / Delivered</div>
                <div className="text-sm font-bold">${(waAnalytics.templateAnalytics.totals.costPerDelivered || 0).toFixed(2)}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground">Unique Replies</div>
                <div className="text-sm font-bold text-blue-600">{(waAnalytics.templateAnalytics.totals.replied || 0).toLocaleString()}</div>
              </div>
            </div>
          )}

          {waAnalytics.templateAnalytics?.templateBreakdown?.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-muted-foreground">Template Performance</div>
              {waAnalytics.templateAnalytics.templateBreakdown.map((t: any, i: number) => (
                <div key={i} className="rounded-lg border px-2.5 py-2 text-[10px] space-y-1" data-testid={`wa-template-row-${i}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold truncate max-w-[140px]">{t.name?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>
                      <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                        (t.category || "").toUpperCase() === "UTILITY" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" :
                        (t.category || "").toUpperCase() === "AUTHENTICATION" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" :
                        "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                      }`}>{(t.category || "MARKETING").toUpperCase()}</span>
                    </div>
                    {t.cost > 0 && <span className="text-emerald-600 font-medium">${t.cost.toFixed(2)}</span>}
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span title="Sent">{(t.sent || 0).toLocaleString()} sent</span>
                    <span title="Delivered" className="text-green-600">{(t.delivered || 0).toLocaleString()} del</span>
                    <span title="Read" className="text-purple-600">{(t.read || 0).toLocaleString()} read</span>
                    {(t.replied || 0) > 0 && <span title="Replies" className="text-blue-600">{t.replied} replies</span>}
                    {t.costPerDelivered > 0 && <span title="Cost per delivered" className="text-muted-foreground">${t.costPerDelivered.toFixed(3)}/msg</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {(waAnalytics.templateAnalytics?.error || waAnalytics.conversationAnalytics?.error || waAnalytics.pricingAnalytics?.error || waAnalytics.messagingAnalytics?.error) && (
            <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20 p-2 text-[10px] text-yellow-700 dark:text-yellow-400" data-testid="wa-analytics-errors">
              <span className="font-semibold">Some analytics unavailable:</span>{" "}
              {[
                waAnalytics.templateAnalytics?.error && "Template insights",
                waAnalytics.conversationAnalytics?.error && "Conversations",
                waAnalytics.pricingAnalytics?.error && "Pricing",
                waAnalytics.messagingAnalytics?.error && "Messaging",
              ].filter(Boolean).join(", ")}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border p-3 text-xs text-muted-foreground text-center">
          No analytics data available for this period.
        </div>
      )}
    </div>
  );
}

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
  const [isEditingPreview, setIsEditingPreview] = useState(false);
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
  const [whatsappTemplateLanguage, setWhatsappTemplateLanguage] = useState<string>("");
  const [whatsappTemplateBody, setWhatsappTemplateBody] = useState<string>("");
  const [whatsappTemplateParams, setWhatsappTemplateParams] = useState<Record<string, string>>({});
  const [isExtractingNumbers, setIsExtractingNumbers] = useState(false);
  const [fileBreakdown, setFileBreakdown] = useState<{
    filename: string;
    totalRows: number;
    emptyRows: number;
    validNumbers: number;
    invalidNumbers: number;
    duplicates: number;
    invalidList?: string[];
    duplicateList?: string[];
  } | null>(null);
  const [selectedPromoApp, setSelectedPromoApp] = useState<string | null>(null);
  const [isGeneratingPromo, setIsGeneratingPromo] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{
    sent: number; failed: number; total: number; percent: number;
    queued?: number; estimatedRemaining?: number; message: string; complete?: boolean;
    errorBreakdown?: Record<string, number>; estimatedCost?: number;
    bulkQueueId?: string;
  } | null>(null);
  const { toast } = useToast();

  // Fetch company profile for dynamic content
  const { data: companyProfile } = useQuery<{
    agentName?: string;
    brokerageName?: string;
    businessName?: string;
  }>({
    queryKey: ["/api/company/profile"],
  });

  const { data: messagingLimitData } = useQuery<{
    limit: number;
    tier: string;
    qualityScore?: string;
    source: string;
  }>({
    queryKey: ["/api/whatsapp/messaging-limit"],
  });
  const metaDailyLimit = messagingLimitData?.limit || 250;
  const metaTier = messagingLimitData?.tier || "TIER_250";

  const { data: menuItemsList } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu-items"],
    enabled: !isRealEstate,
  });

  const { data: bulkQueues = [] } = useQuery<any[]>({
    queryKey: ["/api/whatsapp/bulk-queues"],
    refetchInterval: 30000,
  });

  const { data: recentPosts = [] } = useQuery<any[]>({
    queryKey: ["/api/dashboard/recent-posts"],
    refetchInterval: 30000,
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
    if (!user?.id) return;
    const checkActiveSend = async () => {
      try {
        const token = localStorage.getItem("authToken") || "";
        const res = await fetch("/api/whatsapp/bulk-send-status", {
          headers: token ? { "Authorization": `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (data.active) {
            setBulkProgress({
              sent: data.sent,
              failed: data.failed,
              total: data.total,
              queued: data.queued || 0,
              percent: data.percent,
              estimatedRemaining: data.estimatedRemaining,
              message: data.message,
              complete: data.complete || false,
              errorBreakdown: data.errorBreakdown,
              estimatedCost: data.estimatedCost,
              bulkQueueId: data.bulkQueueId,
            });
          }
        }
      } catch {}
    };
    checkActiveSend();
  }, [user?.id]);

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
            queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/bulk-queues"] });
          } else if (msg.type === "whatsapp_queue_progress" || msg.type === "whatsapp_queue_batch_start" || msg.type === "whatsapp_queue_batch_complete" || msg.type === "whatsapp_queue_complete") {
            queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/bulk-queues"] });
            if (msg.type === "whatsapp_queue_complete") {
              toast({
                title: "Queue Complete",
                description: msg.data.message,
              });
            }
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
        let errorMessage: string;
        try {
          const errorData = await response.json();
          if (errorData.error?.includes("not configured") || errorData.message?.includes("not configured")) {
            errorMessage = `${platform.charAt(0).toUpperCase() + platform.slice(1)} integration isn't set up yet. Please contact support to enable it.`;
          } else {
            errorMessage = errorData.message || friendlyError({ status: response.status }).description;
          }
        } catch {
          errorMessage = friendlyError({ status: response.status }).description;
        }
        throw new Error(errorMessage);
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
          const errorCodeMap: Record<string, string> = {
            missing_credentials: `${platform.charAt(0).toUpperCase() + platform.slice(1)} integration isn't set up yet. Please contact support to enable it.`,
            token_exchange_failed: "Couldn't exchange your access token. Check that your app credentials are correct and try again.",
            oauth_error: "Something went wrong during authentication. Please try again or contact support.",
          };
          const description = errorCodeMap[event.data.error] ?? "Please try again. Make sure you're logged in and grant all required permissions.";
          const errorMsg = messages.oauth.error(platform, description);
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
      const hasEmail = data.platforms.includes("email");
      const nonEmailPlatforms = data.platforms.filter(p => p !== "email");

      const saveEmailPost = async () => {
        if (!hasEmail) return null;
        const res = await apiRequest("POST", "/api/social/post", {
          content: data.content,
          platforms: ["email"],
          mediaIds: data.mediaIds || [],
          ...(usePropertyPhoto ? { propertyPhotoUrl: data.propertyPhotoUrl } : {}),
        });
        return res.json();
      };

      if (nonEmailPlatforms.length === 0 && hasEmail) {
        return await saveEmailPost();
      }

      let platformResult: any;

      if (nonEmailPlatforms.includes("youtube")) {
        platformResult = await handleYouTubePost(
          data.content,
          uploadedVideo || undefined,
        );
      } else if (nonEmailPlatforms.includes("facebook")) {
        if (!selectedFacebookPage) {
          throw new Error("Please select a Facebook Page before posting");
        }

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
        platformResult = await facebookResponse.json();
      } else if (nonEmailPlatforms.includes("instagram")) {
        const hasMedia = (data.mediaIds && data.mediaIds.length > 0) || usePropertyPhoto;
        if (!hasMedia) {
          throw new Error("Instagram requires an image or video. Please attach media before posting.");
        }
        const instagramResponse = await apiRequest(
          "POST",
          "/api/instagram/post",
          {
            content: data.content,
            mediaIds: data.mediaIds || [],
            ...(usePropertyPhoto ? { mediaUrl: data.propertyPhotoUrl } : {}),
          },
        );
        platformResult = await instagramResponse.json();
      } else if (
        nonEmailPlatforms.includes("x") ||
        nonEmailPlatforms.includes("twitter")
      ) {
        const formData = new FormData();
        formData.append("content", data.content);

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

        platformResult = await response.json();
      } else if (nonEmailPlatforms.includes("whatsapp")) {
        const whatsappPayload: any = {
            to: data.whatsappTo || "",
            message: data.content,
            ...(usePropertyPhoto ? { imageUrl: data.propertyPhotoUrl } : {}),
            ...(data.mediaIds?.length ? { imageUrl: data.mediaIds[0] } : {}),
          };
        if (whatsappTemplateName && whatsappTemplateName !== "none") {
          whatsappPayload.templateName = whatsappTemplateName;
          if (whatsappTemplateLanguage) {
            whatsappPayload.templateLanguage = whatsappTemplateLanguage;
          }
          const paramKeys = Object.keys(whatsappTemplateParams).filter(k => whatsappTemplateParams[k]?.trim());
          if (paramKeys.length > 0) {
            const sortedParams = paramKeys.sort((a, b) => Number(a) - Number(b)).map(k => ({ type: "text", text: whatsappTemplateParams[k] }));
            whatsappPayload.templateComponents = [{ type: "body", parameters: sortedParams }];
          }
        }
        const whatsappResponse = await apiRequest(
          "POST",
          "/api/whatsapp/send",
          whatsappPayload,
        );
        platformResult = await whatsappResponse.json();
      } else {
        const response = await apiRequest("POST", "/api/social/post", {
          ...data,
          platforms: nonEmailPlatforms,
          mediaIds: data.mediaIds || [],
          ...(usePropertyPhoto ? { propertyPhotoUrl: data.propertyPhotoUrl } : {}),
        });
        platformResult = await response.json();
      }

      await saveEmailPost();
      return platformResult;
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
    const formatPrice = (price: number | null) => {
      if (price === null || !Number.isFinite(price)) return "Price upon request";
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(price);
    };

    const beds = property.bedrooms === null ? "—" : String(property.bedrooms);
    const baths = property.bathrooms === null ? "—" : String(property.bathrooms);
    const sqft =
      property.squareFootage === null
        ? "—"
        : property.squareFootage.toLocaleString();
    const sqftLong =
      property.squareFootage === null
        ? ""
        : property.squareFootage.toLocaleString() + " square foot ";
    const bedBathText = `🛏️ ${beds} bed 🛁 ${baths} bath 📐 ${sqft} sqft`;
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

✨ ${beds}BD ${baths}BA | ${sqft} sqft

${property.description.substring(0, 150)}...

DM for details! 📩

#JustListed #OmahaHomes #RealEstate #${agentName.replace(/\s+/g, "")} ${
          neighborhoodTag ? `#${neighborhoodTag}` : ""
        }`,

        x: `🏠 JUST LISTED!\n\n${property.address}\n${formatPrice(
          property.listPrice,
        )}\n${beds}BD ${baths}BA\n\n${property.description.substring(
          0,
          100,
        )}...\n\nContact ${agentName} for details!\n\n#JustListed #OmahaRealEstate`,

        youtube: `🏠 NEW LISTING: ${property.address} | ${formatPrice(
          property.listPrice,
        )}

Welcome to this stunning ${beds} bedroom, ${baths} bathroom home in ${
          property.neighborhood || property.city
        }! This beautiful ${sqftLong}${property.propertyType.toLowerCase()} offers everything you've been looking for.

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
        }! This beautiful ${beds} bedroom, ${baths} bathroom home has found its perfect new owners.

${property.description.substring(0, 300)}

This ${sqftLong}property sold quickly, showcasing the continued strength of ${
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

✨ ${beds}BD ${baths}BA

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
        )}!\n\n${beds}BD ${baths}BA\n\n${
          property.neighborhood
            ? `${property.neighborhood} opportunity!`
            : "Great opportunity!"
        }\n\n${agentName} | ${brokerageName.split(" ").map((w: string) => w.charAt(0)).join("")}\n\n#PriceImprovement`,

        youtube: `💰 PRICE IMPROVEMENT! ${property.address} | Now ${formatPrice(
          property.listPrice,
        )}

Exciting news! This beautiful ${beds} bedroom, ${baths} bathroom home just had a strategic price adjustment, making it an even better value for buyers!

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

✨ ${beds}BD ${baths}BA

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
        }\n🕐 Sat & Sun 1-4pm\n💰 ${formatPrice(property.listPrice)}\n\n${beds}BD ${baths}BA\n\n${
          property.neighborhood ? `${property.neighborhood} gem!` : "Must see!"
        }\n\n${agentName} | ${brokerageName.split(" ").map((w: string) => w.charAt(0)).join("")}\n\n#OpenHouse`,

        youtube: `🏠 OPEN HOUSE THIS WEEKEND! ${property.address}

Join me Saturday & Sunday, 1:00 PM - 4:00 PM for an exclusive tour of this stunning ${beds} bedroom, ${baths} bathroom home!

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

    postMutation.mutate({
      content,
      platforms: selectedPlatforms,
      mediaIds: selectedMediaIds,
      propertyPhotoUrl: selectedPropertyPhotoUrl,
      whatsappTo,
    });
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
          {[...(accounts || []).filter(a => a.platform !== "email"), SYNTHETIC_EMAIL_ACCOUNT].map((account) => {
            const isEmailPlatform = account.platform === "email";
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
                    title={isEmailPlatform ? "Always Available" : account.isConnected ? "Connected" : "Disconnected"}
                  >
                    {isEmailPlatform ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                        <Check className="h-3 w-3" />
                        Always Available
                      </span>
                    ) : account.isConnected ? (
                      <>
                        {account.platform.toLowerCase() === "whatsapp" ? (
                          <a
                            href="/settings"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border border-green-200 text-green-600 hover:bg-green-50 hover:border-green-300 transition-colors"
                            data-testid={`button-settings-${account.platform}`}
                          >
                            <Settings className="h-3 w-3" />
                            Settings
                          </a>
                        ) : (
                          <>
                            <Plug className="h-5 w-5 text-green-600" />
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
                          </>
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
                      const videoDefaults = VIDEO_DEFAULTS_BY_BUSINESS[businessType] || VIDEO_DEFAULTS_BY_BUSINESS.general;
                      const videoTitle = postContent.trim() || videoDefaults.title;
                      
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
            {selectedPlatforms.includes("whatsapp") && (
              <details className="relative group">
                <summary className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors list-none" data-testid="btn-whatsapp-guide">
                  <BookOpen className="h-3 w-3" />
                  Guide
                </summary>
                <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg border bg-popover p-3 shadow-lg space-y-3">
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Download the guide or <a href="/help" target="_blank" rel="noopener" className="text-blue-600 underline">read it online</a> — covers templates, sending, queues, reports & troubleshooting.
                  </p>
                  <div>
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Documents</p>
                    <div className="flex gap-1.5">
                      {["pdf", "docx"].map((fmt) => (
                        <a
                          key={fmt}
                          href={`/api/whatsapp/guide/download?format=${fmt}`}
                          download={`WhatsApp-Bulk-Messaging-Guide.${fmt}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-medium rounded-md border transition-colors ${
                            fmt === "pdf"
                              ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-100"
                              : "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-100"
                          }`}
                          data-testid={`btn-download-guide-${fmt}`}
                        >
                          <FileText className="h-3 w-3" />
                          {fmt === "pdf" ? "PDF" : "Word"}
                        </a>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Video Tutorials</p>
                    <div className="flex flex-col gap-1.5">
                      {[
                        { type: "template", label: "How to Create Templates" },
                        { type: "bulk", label: "How to Send Bulk Messages" },
                      ].map((vid) => (
                        <a
                          key={vid.type}
                          href={`/api/whatsapp/guide/video?type=${vid.type}&download=true`}
                          download={vid.type === "template" ? "How-to-Create-WhatsApp-Templates.mp4" : "How-to-Send-Bulk-Messages.mp4"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full inline-flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-medium rounded-md border transition-colors bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/40"
                          data-testid={`btn-download-video-${vid.type}`}
                        >
                          <Play className="h-3 w-3" />
                          {vid.label}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </details>
            )}
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

            {selectedPostType && selectedPostType !== "create_your_own" && selectedPostType !== "promote_app" && (() => {
              const starters = getIndustryContent(businessType).contentStarters.filter(
                (s) => s.postTypeId === selectedPostType
              );
              if (starters.length === 0) return null;
              return (
                <div className="mt-2 space-y-1.5" data-testid="quick-start-starters">
                  <div className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Quick Start
                  </div>
                  {starters.map((starter, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="w-full text-left text-[11px] px-2.5 py-2 rounded-md border border-dashed border-muted-foreground/20 hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-all"
                      onClick={() => {
                        setPostContent(starter.template);
                      }}
                      data-testid={`quick-start-${starter.postTypeId}-${idx}`}
                    >
                      <span className="font-medium text-foreground">{starter.label}:</span>{" "}
                      {starter.template.length > 80
                        ? starter.template.substring(0, 80) + "..."
                        : starter.template}
                    </button>
                  ))}
                </div>
              );
            })()}
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

          {selectedPlatforms.includes("whatsapp") ? (
            <div className="space-y-3 rounded-lg border-2 border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20 p-4">
              <div className="flex items-center gap-2 mb-1">
                <MessageCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-semibold">WhatsApp Message</span>
              </div>
              <WhatsAppAccountSwitcher />

              <details className="group rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/10">
                <summary className="flex items-center justify-between px-3 py-1.5 cursor-pointer select-none">
                  <div className="flex items-center gap-1.5">
                    <Info className="h-3 w-3 text-blue-500" />
                    <span className="text-[10px] text-blue-700 dark:text-blue-400">Meta limit: <strong>{metaDailyLimit.toLocaleString()}</strong>/day {messagingLimitData?.qualityScore && messagingLimitData.qualityScore !== "UNKNOWN" && <span className="text-blue-400">· Quality: {messagingLimitData.qualityScore}</span>}</span>
                  </div>
                  <svg className="w-3 h-3 text-blue-400 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </summary>
                <div className="px-3 pb-2.5 pt-1 space-y-2 border-t border-blue-100 dark:border-blue-800/50">
                  <div className="flex gap-1">
                    {[250, 1000, 10000, 100000].map((tier) => (
                      <div key={tier} className={`flex-1 h-1 rounded-full ${metaDailyLimit >= tier ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                    ))}
                  </div>
                  <p className="text-[10px] text-blue-700/70 dark:text-blue-400/70 leading-relaxed">
                    Your account tier: {metaTier.replace("TIER_", "").replace("_", ",")} ({metaDailyLimit.toLocaleString()}/day). Maintain quality conversations to unlock higher tiers. Only send to opted-in contacts using approved templates.
                  </p>
                </div>
              </details>

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
                    return (
                      <div className="flex flex-col gap-0.5">
                        <p className={`text-[10px] ${recipientCount > metaDailyLimit ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground'}`}>
                          {recipientCount.toLocaleString()} recipients
                          {recipientCount > metaDailyLimit && ` — only first ${metaDailyLimit.toLocaleString()} will be sent (Meta daily limit)`}
                        </p>
                        {recipientCount > metaDailyLimit && (
                          <p className="text-[9px] text-amber-500/80 dark:text-amber-400/60">
                            Account tier: {metaDailyLimit.toLocaleString()}/day. {(recipientCount - metaDailyLimit).toLocaleString()} contacts will be skipped.
                          </p>
                        )}
                      </div>
                    );
                  })()}
                
                  <label className="cursor-pointer inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80">
                    <input
                      type="file"
                      accept=".csv,.txt,.pdf,.docx,.xlsx,.xls,.numbers"
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
                            const existingNums = new Set(existing.split(/[\n,]+/).map((n: string) => n.replace(/\D/g, "")).filter(Boolean));
                            const newNums = data.numbers.filter((n: string) => !existingNums.has(n.replace(/\D/g, "")));
                            const dupes = data.numbers.length - newNums.length;
                            setWhatsappTo(existing ? existing + "\n" + newNums.join("\n") : newNums.join("\n"));
                            if (data.breakdown) {
                              setFileBreakdown({
                                filename: data.filename || "file",
                                ...data.breakdown,
                              });
                            }
                            toast({ title: "Numbers Imported", description: `${newNums.length} new numbers added${dupes > 0 ? ` (${dupes} duplicates removed)` : ""}` });
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

                {fileBreakdown && (
                  <div className="mt-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 px-3 py-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-semibold text-blue-800 dark:text-blue-300">File Analysis: {fileBreakdown.filename}</span>
                      <button
                        type="button"
                        onClick={() => setFileBreakdown(null)}
                        className="text-[9px] text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
                        data-testid="button-dismiss-breakdown"
                      >✕</button>
                    </div>
                    <div className="text-[10px] space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total rows in file:</span>
                        <span className="font-medium text-foreground">{fileBreakdown.totalRows.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Empty/blank rows:</span>
                        <span className={`font-medium ${fileBreakdown.emptyRows > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>{fileBreakdown.emptyRows.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valid phone numbers:</span>
                        <span className="font-medium text-green-600 dark:text-green-400">{fileBreakdown.validNumbers.toLocaleString()}</span>
                      </div>

                      {fileBreakdown.invalidNumbers > 0 ? (
                        <details className="group" data-testid="details-invalid-numbers">
                          <summary className="flex justify-between cursor-pointer list-none hover:bg-red-50 dark:hover:bg-red-950/20 rounded px-1 -mx-1">
                            <span className="text-muted-foreground flex items-center gap-1">
                              Invalid numbers
                              <svg className="w-2.5 h-2.5 text-red-400 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                            </span>
                            <span className="font-medium text-red-600 dark:text-red-400">{fileBreakdown.invalidNumbers.toLocaleString()}</span>
                          </summary>
                          {fileBreakdown.invalidList && fileBreakdown.invalidList.length > 0 && (
                            <div className="mt-1 ml-1 p-1.5 rounded bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 max-h-[80px] overflow-y-auto">
                              <div className="text-[9px] text-red-600 dark:text-red-400 font-mono space-y-0.5">
                                {fileBreakdown.invalidList.map((n, i) => <div key={i}>{n}</div>)}
                                {fileBreakdown.invalidNumbers > 50 && <div className="text-red-400">...and {fileBreakdown.invalidNumbers - 50} more</div>}
                              </div>
                            </div>
                          )}
                        </details>
                      ) : (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Invalid numbers:</span>
                          <span className="font-medium text-foreground">0</span>
                        </div>
                      )}

                      {fileBreakdown.duplicates > 0 ? (
                        <details className="group" data-testid="details-duplicate-numbers">
                          <summary className="flex justify-between cursor-pointer list-none hover:bg-amber-50 dark:hover:bg-amber-950/20 rounded px-1 -mx-1">
                            <span className="text-muted-foreground flex items-center gap-1">
                              Duplicates removed
                              <svg className="w-2.5 h-2.5 text-amber-400 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                            </span>
                            <span className="font-medium text-amber-600 dark:text-amber-400">{fileBreakdown.duplicates.toLocaleString()}</span>
                          </summary>
                          {fileBreakdown.duplicateList && fileBreakdown.duplicateList.length > 0 && (
                            <div className="mt-1 ml-1 p-1.5 rounded bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 max-h-[80px] overflow-y-auto">
                              <div className="text-[9px] text-amber-600 dark:text-amber-400 font-mono space-y-0.5">
                                {fileBreakdown.duplicateList.map((n, i) => <div key={i}>{n}</div>)}
                                {fileBreakdown.duplicates > 50 && <div className="text-amber-400">...and {fileBreakdown.duplicates - 50} more</div>}
                              </div>
                            </div>
                          )}
                        </details>
                      ) : (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Duplicates removed:</span>
                          <span className="font-medium text-foreground">0</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <WhatsAppTemplateSelector
                selectedTemplate={whatsappTemplateName}
                onSelectTemplate={(name) => {
                  setWhatsappTemplateName(name);
                  setWhatsappTemplateParams({});
                }}
                onSelectLanguage={(lang) => setWhatsappTemplateLanguage(lang)}
                onTemplateBodyChange={(body) => setWhatsappTemplateBody(body)}
              />
              {whatsappTemplateName && whatsappTemplateName !== "none" && whatsappTemplateBody && (() => {
                const paramMatches = whatsappTemplateBody.match(/\{\{\d+\}\}/g);
                if (!paramMatches || paramMatches.length === 0) return null;
                const paramNums = [...new Set(paramMatches.map(m => m.replace(/[{}]/g, "")))].sort((a, b) => Number(a) - Number(b));
                const labelMap: Record<string, string> = {};
                const bodyLower = whatsappTemplateBody.toLowerCase();
                paramNums.forEach(num => {
                  const idx = whatsappTemplateBody.indexOf(`{{${num}}}`);
                  const before = whatsappTemplateBody.substring(Math.max(0, idx - 40), idx).trim();
                  const lastLine = before.split("\n").pop()?.trim() || "";
                  const match = lastLine.match(/([A-Za-z][A-Za-z\s]*?):\s*$/);
                  if (match) {
                    labelMap[num] = match[1].trim();
                  } else if (num === "1" && (bodyLower.includes("hi {{1}}") || bodyLower.includes("hello {{1}}") || bodyLower.includes("dear {{1}}"))) {
                    labelMap[num] = "Name";
                  }
                });
                const previewText = paramNums.reduce((text, num) => {
                  return text.replace(new RegExp(`\\{\\{${num}\\}\\}`, "g"), whatsappTemplateParams[num] || `{{${num}}}`);
                }, whatsappTemplateBody);
                return (
                  <div className="space-y-2 p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20" data-testid="template-params-section">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Fill in template values ({paramNums.length} field{paramNums.length > 1 ? "s" : ""})</p>
                    <div className="grid grid-cols-2 gap-2">
                      {paramNums.map(num => (
                        <div key={num} className="space-y-0.5">
                          <Label className="text-[10px] text-muted-foreground">{labelMap[num] || `Field ${num}`} {`{{${num}}}`}</Label>
                          <Input
                            value={whatsappTemplateParams[num] || ""}
                            onChange={(e) => setWhatsappTemplateParams(prev => ({ ...prev, [num]: e.target.value }))}
                            placeholder={labelMap[num] || `Value for {{${num}}}`}
                            className="h-7 text-xs"
                            data-testid={`input-template-param-${num}`}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="text-[10px] text-muted-foreground bg-white dark:bg-gray-900 rounded p-2 border border-border/50 whitespace-pre-wrap">
                      <span className="font-semibold text-foreground block mb-1">Preview:</span>
                      {previewText}
                    </div>
                  </div>
                );
              })()}
              {(!whatsappTemplateName || whatsappTemplateName === "none") && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Message</Label>
                  <Textarea
                    placeholder="Type your message here..."
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    className="min-h-[60px] text-sm"
                    data-testid="textarea-whatsapp-message"
                  />
                </div>
              )}
              {bulkProgress && (() => {
                const ERROR_INFO: Record<string, { name: string; description: string; action: string; severity: "warn" | "error" | "info" }> = {
                  "131049": {
                    name: "Ecosystem Health: Meta chose not to deliver",
                    description: "WhatsApp limits how many marketing templates a person receives from a business within a certain time period, especially if they are less likely to respond or engage.",
                    action: "Do not retry immediately. Wait and retry in increasing time intervals (1hr, 4hr, 24hr). This limit varies per user and resets automatically.",
                    severity: "warn",
                  },
                  "131056": {
                    name: "Pair Rate Limit",
                    description: "Too many messages sent to this specific recipient in a short time. WhatsApp throttles per-user delivery.",
                    action: "Skip this contact for now. They will receive future messages once the cooldown period ends (usually a few hours).",
                    severity: "warn",
                  },
                  "130429": {
                    name: "Cloud API Throughput Exceeded",
                    description: "Your account hit Meta's per-second sending throughput limit.",
                    action: "System automatically retries with backoff. No manual action needed. Consider upgrading your throughput tier if this happens frequently.",
                    severity: "info",
                  },
                  "131051": {
                    name: "Template Not Approved",
                    description: "The message template used is not in APPROVED status on Meta's platform.",
                    action: "Check your template status in WhatsApp Manager. Submit for re-review or use a different approved template.",
                    severity: "error",
                  },
                  "131047": {
                    name: "Re-engagement Required",
                    description: "More than 24 hours have passed since the customer's last message. You need a template message to re-engage.",
                    action: "Use an approved template message instead of a free-form text message to initiate the conversation.",
                    severity: "error",
                  },
                  "429": {
                    name: "Rate Limit Hit",
                    description: "Too many API requests sent in a short period.",
                    action: "System automatically backs off and retries. If persistent, reduce batch frequency.",
                    severity: "info",
                  },
                  "503": {
                    name: "WhatsApp Service Temporarily Unavailable",
                    description: "Meta's servers experienced a temporary overload or maintenance.",
                    action: "System retries automatically. These are transient and usually resolve within minutes.",
                    severity: "info",
                  },
                  "unknown": {
                    name: "Undeliverable Message",
                    description: "Message could not be delivered. Reasons include: unregistered WhatsApp number, blocked by recipient, or invalid phone number.",
                    action: "Verify phone numbers are valid and have active WhatsApp accounts. Remove invalid numbers from your contact list.",
                    severity: "error",
                  },
                };

                const costPerMsg = 0.025;
                const totalErrorCount = bulkProgress.errorBreakdown ? Object.values(bulkProgress.errorBreakdown).reduce((s, v) => s + v, 0) : 0;

                return (
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
                    <div className="flex items-center gap-3">
                      {bulkProgress.estimatedCost != null && bulkProgress.estimatedCost > 0 && (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full" data-testid="text-estimated-cost">
                          <DollarSign className="h-3 w-3" />
                          Est. ${bulkProgress.estimatedCost.toFixed(2)}
                        </span>
                      )}
                      {bulkProgress.complete && (
                        <button
                          type="button"
                          onClick={async () => {
                            setBulkProgress(null);
                            try {
                              const token = localStorage.getItem("authToken") || "";
                              await fetch("/api/whatsapp/bulk-send-status/dismiss", {
                                method: "POST",
                                headers: token ? { "Authorization": `Bearer ${token}` } : {},
                              });
                            } catch {}
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground"
                          data-testid="btn-dismiss-progress"
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
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
                        <span className="inline-flex items-center gap-2 flex-wrap">
                          <span className="text-amber-600 dark:text-amber-400 font-medium">{((bulkProgress as any).queued).toLocaleString()} auto-queued for next batch</span>
                          {bulkProgress.complete && (() => {
                            const queueId = bulkProgress.bulkQueueId || bulkQueues.find((q: any) => q.status === "active" || q.status === "paused")?.id;
                            if (queueId) {
                              return (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await apiRequest("POST", `/api/whatsapp/bulk-queues/${queueId}/send-now`);
                                      toast({ title: "Processing Next Batch", description: "Sending next batch of messages now..." });
                                      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/bulk-queues"] });
                                    } catch (err: any) {
                                      toast({ title: "Error", description: err.message || "Failed to start batch", variant: "destructive" });
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors shadow-sm"
                                  data-testid="btn-send-next-batch-banner"
                                >
                                  <Play className="h-3 w-3" />
                                  Send Next Batch Now
                                </button>
                              );
                            }
                            return (
                              <span className="text-[9px] text-muted-foreground italic">(Re-upload contacts to send remaining)</span>
                            );
                          })()}
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground font-mono">{bulkProgress.percent}%</span>
                  </div>

                  {bulkProgress.sent > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] border-t pt-2">
                      <div data-testid="metric-delivered">
                        <span className="text-muted-foreground">Delivered</span>
                        <p className="font-semibold text-green-700 dark:text-green-400">{bulkProgress.sent.toLocaleString()}</p>
                      </div>
                      <div data-testid="metric-failed">
                        <span className="text-muted-foreground">Failed</span>
                        <p className="font-semibold text-red-600">{bulkProgress.failed.toLocaleString()}</p>
                      </div>
                      <div data-testid="metric-cost">
                        <span className="text-muted-foreground">Est. Cost</span>
                        <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                          ${(bulkProgress.estimatedCost ?? bulkProgress.sent * costPerMsg).toFixed(2)}
                        </p>
                      </div>
                      <div data-testid="metric-cost-per-msg">
                        <span className="text-muted-foreground">Per Message</span>
                        <p className="font-semibold">${costPerMsg.toFixed(3)}</p>
                      </div>
                    </div>
                  )}

                  {!bulkProgress.complete && bulkProgress.estimatedRemaining && bulkProgress.estimatedRemaining > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      Estimated time remaining: {bulkProgress.estimatedRemaining > 60 ? `${Math.round(bulkProgress.estimatedRemaining / 60)}m` : `${bulkProgress.estimatedRemaining}s`}
                    </p>
                  )}

                  {bulkProgress.errorBreakdown && totalErrorCount > 0 && (
                    <div className="border-t pt-2 space-y-2" data-testid="error-breakdown">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-red-700 dark:text-red-400">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Error Breakdown ({totalErrorCount} issues)
                      </div>
                      <div className="space-y-2">
                        {Object.entries(bulkProgress.errorBreakdown)
                          .sort(([, a], [, b]) => b - a)
                          .map(([code, count]) => {
                            const info = ERROR_INFO[code] || ERROR_INFO["unknown"];
                            return (
                              <div
                                key={code}
                                className={`rounded-lg p-2.5 text-[10px] space-y-1 ${
                                  info.severity === "error" ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800" :
                                  info.severity === "warn" ? "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800" :
                                  "bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800"
                                }`}
                                data-testid={`error-code-${code}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold">
                                    {info.name}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded font-mono font-bold ${
                                    info.severity === "error" ? "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-300" :
                                    info.severity === "warn" ? "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-300" :
                                    "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                                  }`}>
                                    {count} {count === 1 ? "message" : "messages"} &middot; Code {code}
                                  </span>
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                  {info.description}
                                </p>
                                <div className="flex items-start gap-1.5 mt-1 p-1.5 rounded bg-white/60 dark:bg-black/20">
                                  <Info className="h-3 w-3 mt-0.5 shrink-0 text-blue-500" />
                                  <p className="font-medium leading-relaxed">
                                    {info.action}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {(() => {
                    const queueId = bulkProgress.bulkQueueId || bulkQueues.find((q: any) => q.status === "active" || q.status === "paused")?.id;
                    const activeQueue = bulkQueues.find((q: any) => q.id === queueId);
                    const remaining = activeQueue?.remainingNumbers?.length || (bulkProgress.queued || Math.max(0, bulkProgress.total - bulkProgress.sent - bulkProgress.failed));
                    const nextBatch = activeQueue?.nextBatchAt ? new Date(activeQueue.nextBatchAt) : null;
                    const nextBatchTime = nextBatch ? nextBatch.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null;

                    return (
                      <div className="border-t pt-3 space-y-2" data-testid="bulk-send-actions">
                        <div className="flex flex-wrap items-center gap-2">
                          {queueId && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await apiRequest("POST", `/api/whatsapp/bulk-queues/${queueId}/send-now`);
                                  toast({ title: "Processing Next Batch", description: "Sending next batch of messages now..." });
                                  queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/bulk-queues"] });
                                } catch (err: any) {
                                  toast({ title: "Error", description: err.message || "Failed to start batch", variant: "destructive" });
                                }
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors shadow-sm"
                              data-testid="btn-send-next-batch-always"
                            >
                              <Play className="h-3.5 w-3.5" />
                              Send Next Batch Now
                            </button>
                          )}
                          {queueId && activeQueue && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const action = activeQueue.status === "paused" ? "resume" : "pause";
                                  await apiRequest("POST", `/api/whatsapp/bulk-queues/${queueId}/${action}`);
                                  toast({ title: action === "pause" ? "Queue Paused" : "Queue Resumed" });
                                  queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/bulk-queues"] });
                                } catch (err: any) {
                                  toast({ title: "Error", description: err.message, variant: "destructive" });
                                }
                              }}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors shadow-sm ${
                                activeQueue.status === "paused"
                                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                                  : "bg-amber-500 hover:bg-amber-600 text-white"
                              }`}
                              data-testid="btn-pause-resume-queue"
                            >
                              {activeQueue.status === "paused" ? (
                                <><Play className="h-3.5 w-3.5" /> Resume Queue</>
                              ) : (
                                <><Pause className="h-3.5 w-3.5" /> Pause Queue</>
                              )}
                            </button>
                          )}
                          {bulkProgress.complete && (
                            <button
                              type="button"
                              onClick={async () => {
                                setBulkProgress(null);
                                try {
                                  const token = localStorage.getItem("authToken") || "";
                                  await fetch("/api/whatsapp/bulk-send-status/dismiss", {
                                    method: "POST",
                                    headers: token ? { "Authorization": `Bearer ${token}` } : {},
                                  });
                                } catch {}
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                              data-testid="btn-dismiss-progress-bar"
                            >
                              Dismiss
                            </button>
                          )}
                        </div>

                        {remaining > 0 && nextBatchTime && (
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground px-1">
                            <Clock className="h-3 w-3" />
                            <span>{remaining.toLocaleString()} remaining &middot; Next auto-batch: <strong>{nextBatchTime}</strong></span>
                          </div>
                        )}

                        {queueId && bulkProgress.sent > 0 && (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span className="text-[10px] font-semibold text-muted-foreground">Download:</span>
                            {[
                              { type: "all", label: "Full Report", color: "purple" },
                              { type: "sent", label: `Sent (${bulkProgress.sent.toLocaleString()})`, color: "green" },
                              { type: "remaining", label: `Remaining (${remaining.toLocaleString()})`, color: "orange" },
                            ].map(dl => (
                              <button
                                key={dl.type}
                                onClick={() => {
                                  const token = localStorage.getItem("authToken") || "";
                                  fetch(`/api/whatsapp/bulk-queues/${queueId}/download?type=${dl.type}`, {
                                    headers: token ? { "Authorization": `Bearer ${token}` } : {},
                                  })
                                    .then(r => r.blob())
                                    .then(blob => {
                                      const url = window.URL.createObjectURL(blob);
                                      const a = document.createElement("a");
                                      a.href = url;
                                      a.download = `${dl.type}_contacts.xlsx`;
                                      document.body.appendChild(a);
                                      a.click();
                                      a.remove();
                                      window.URL.revokeObjectURL(url);
                                    })
                                    .catch(() => toast({ title: "Download failed", variant: "destructive" }));
                                }}
                                className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded font-medium cursor-pointer transition-colors ${
                                  dl.color === "green" ? "bg-green-100 hover:bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-300" :
                                  dl.color === "orange" ? "bg-orange-100 hover:bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300" :
                                  "bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"
                                }`}
                                data-testid={`btn-banner-download-${dl.type}`}
                              >
                                <Download className="h-3 w-3" />
                                {dl.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                );
              })()}
              <WhatsAppAnalyticsSection bulkProgress={bulkProgress} />

              {(() => {
                const whatsappPosts = recentPosts.filter((p: any) => p.platform === "whatsapp").slice(0, 5);
                if (whatsappPosts.length === 0) return null;
                return (
                  <div className="space-y-2" data-testid="whatsapp-recent-activity">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <MessageCircle className="h-4 w-4 text-green-500" />
                      <span>Recent WhatsApp Activity</span>
                    </div>
                    <div className="space-y-1.5">
                      {whatsappPosts.map((post: any) => {
                        const isSuccess = post.status === "posted";
                        const time = post.metadata?.publishedAt || post.updatedAt;
                        const timeAgo = time ? (() => {
                          const diff = Math.round((Date.now() - new Date(time).getTime()) / 1000);
                          if (diff < 60) return `${diff}s ago`;
                          if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
                          if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
                          return `${Math.round(diff / 86400)}d ago`;
                        })() : "";
                        return (
                          <div key={post.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-[11px]" data-testid={`recent-wa-post-${post.id}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              {isSuccess ? (
                                <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                              ) : (
                                <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                              )}
                              <span className="truncate max-w-[200px]">{post.content?.slice(0, 60) || "WhatsApp message"}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${isSuccess ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"}`}>
                                {isSuccess ? "Delivered" : "Failed"}
                              </span>
                              <span className="text-muted-foreground text-[10px]">{timeAgo}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {bulkQueues.filter((q: any) => q.status === "active" || q.status === "paused").length > 0 && (
                <div className="space-y-2" data-testid="whatsapp-bulk-queue-dashboard">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <span>Queued Messages</span>
                  </div>
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-800" data-testid="warning-bulk-marketing-pause">
                    <span className="text-red-500 text-sm flex-shrink-0 mt-0.5">⚠️</span>
                    <div className="text-[10px] text-red-700 dark:text-red-400 leading-relaxed">
                      <span className="font-bold">US Marketing Pause:</span> Since April 2025, Meta does not deliver <strong>Marketing</strong> template messages to US (+1) numbers. The API accepts them (returns success) but they are silently dropped. Only <strong>Utility</strong> and <strong>Authentication</strong> templates are actually delivered. If your queue uses a Marketing template, consider creating a Utility template instead.
                    </div>
                  </div>
                  {bulkQueues
                    .filter((q: any) => q.status === "active" || q.status === "paused")
                    .map((q: any) => {
                      const remaining = q.remainingNumbers?.length || 0;
                      const totalSent = q.sentCount || 0;
                      const totalFailed = q.failedCount || 0;
                      const overallPercent = q.totalNumbers > 0
                        ? Math.round(((totalSent + totalFailed) / q.totalNumbers) * 100)
                        : 0;
                      const nextBatch = q.nextBatchAt ? new Date(q.nextBatchAt) : null;
                      const renewalTime = nextBatch
                        ? nextBatch.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                        : "—";

                      return (
                        <div
                          key={q.id}
                          className={`rounded-lg border p-3 space-y-2 ${q.status === "paused" ? "border-yellow-300 bg-yellow-50/50 dark:bg-yellow-950/20" : "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20"}`}
                          data-testid={`bulk-queue-${q.id}`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              {q.status === "paused" ? (
                                <Pause className="h-3.5 w-3.5 text-yellow-600" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5 text-amber-600 animate-spin" />
                              )}
                              <span className="font-medium">
                                {q.templateName ? `Template: ${q.templateName}` : "Text message"}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${q.status === "paused" ? "bg-yellow-200 text-yellow-800" : "bg-amber-200 text-amber-800"}`}>
                                {q.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {q.status === "active" ? (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await apiRequest("POST", `/api/whatsapp/bulk-queues/${q.id}/pause`);
                                    queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/bulk-queues"] });
                                  }}
                                  className="px-2 py-0.5 text-[10px] rounded bg-yellow-100 hover:bg-yellow-200 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 dark:hover:bg-yellow-900"
                                  data-testid={`btn-pause-queue-${q.id}`}
                                >
                                  Pause
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await apiRequest("POST", `/api/whatsapp/bulk-queues/${q.id}/resume`);
                                    queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/bulk-queues"] });
                                  }}
                                  className="px-2 py-0.5 text-[10px] rounded bg-green-100 hover:bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-300 dark:hover:bg-green-900"
                                  data-testid={`btn-resume-queue-${q.id}`}
                                >
                                  Resume
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiRequest("POST", `/api/whatsapp/bulk-queues/${q.id}/cancel`);
                                  queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/bulk-queues"] });
                                }}
                                className="px-2 py-0.5 text-[10px] rounded bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900"
                                data-testid={`btn-cancel-queue-${q.id}`}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-amber-500 transition-all duration-500"
                              style={{ width: `${overallPercent}%` }}
                            />
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                            <div>
                              <span className="text-muted-foreground">Sent</span>
                              <p className="font-semibold text-green-700 dark:text-green-400">{totalSent.toLocaleString()}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Remaining</span>
                              <p className="font-semibold text-amber-700 dark:text-amber-400">{remaining.toLocaleString()}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Quota/Day</span>
                              <p className="font-semibold">{(q.dailyLimit || metaDailyLimit).toLocaleString()}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Next Batch</span>
                              <p className="font-semibold text-xs">{renewalTime}</p>
                            </div>
                          </div>
                          {totalFailed > 0 && (
                            <p className="text-[10px] text-red-600">{totalFailed.toLocaleString()} failed (ecosystem-blocked contacts are re-queued automatically)</p>
                          )}
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await apiRequest("POST", `/api/whatsapp/bulk-queues/${q.id}/send-now`);
                                  queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/bulk-queues"] });
                                  toast({ title: "Next batch triggered!", description: "Processing will start within 60 seconds." });
                                } catch (err: any) {
                                  toast({ title: "Error", description: err.message || "Failed to trigger batch", variant: "destructive" });
                                }
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 text-[10px] rounded font-medium bg-green-100 hover:bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-300 dark:hover:bg-green-900 transition-colors"
                              data-testid={`btn-send-now-queue-${q.id}`}
                            >
                              <Send className="h-3 w-3" />
                              Send Next Batch Now
                            </button>
                            {[
                              { type: "all", label: "Full Report", color: "purple", icon: "all" },
                              { type: "sent", label: `Sent (${(q.sentCount || 0).toLocaleString()})`, color: "green", icon: "sent" },
                              { type: "remaining", label: `Remaining (${remaining.toLocaleString()})`, color: "orange", icon: "remaining" },
                            ].map(dl => (
                              <button
                                key={dl.type}
                                onClick={() => {
                                  const token = localStorage.getItem("authToken") || "";
                                  fetch(`/api/whatsapp/bulk-queues/${q.id}/download?type=${dl.type}`, {
                                    headers: token ? { "Authorization": `Bearer ${token}` } : {},
                                  })
                                    .then(res => res.blob())
                                    .then(blob => {
                                      const url = window.URL.createObjectURL(blob);
                                      const a = document.createElement("a");
                                      a.href = url;
                                      a.download = `${dl.type}_contacts_${q.id.slice(0, 8)}.xlsx`;
                                      document.body.appendChild(a);
                                      a.click();
                                      a.remove();
                                      window.URL.revokeObjectURL(url);
                                    })
                                    .catch(() => toast({ title: "Download failed", variant: "destructive" }));
                                }}
                                className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded font-medium cursor-pointer transition-colors ${
                                  dl.color === "green" ? "bg-green-100 hover:bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-300" :
                                  dl.color === "orange" ? "bg-orange-100 hover:bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300" :
                                  "bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"
                                }`}
                                data-testid={`btn-download-${dl.type}-${q.id}`}
                              >
                                <Download className="h-3 w-3" />
                                {dl.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {bulkQueues.length > 0 && (
                <div className="space-y-2" data-testid="whatsapp-bulk-history">
                  <details className="group">
                    <summary className="flex items-center gap-2 cursor-pointer select-none">
                      <FileText className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-semibold">Bulk Send History</span>
                      <span className="text-[10px] text-muted-foreground ml-1">({bulkQueues.length} {bulkQueues.length === 1 ? "batch" : "batches"})</span>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="mt-2 space-y-2 max-h-[400px] overflow-y-auto">
                      {[...bulkQueues]
                        .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                        .map((q: any) => {
                          const totalSent = q.sentCount || 0;
                          const totalFailed = q.failedCount || 0;
                          const remaining = q.remainingNumbers?.length || 0;
                          const total = q.totalNumbers || 0;
                          const pct = total > 0 ? Math.round(((totalSent + totalFailed) / total) * 100) : 0;
                          const created = q.createdAt ? new Date(q.createdAt) : null;
                          const updated = q.updatedAt ? new Date(q.updatedAt) : null;
                          const dateStr = created ? created.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
                          const timeStr = created ? created.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";
                          const lastUpdatedStr = updated ? updated.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
                          const statusColor = q.status === "completed" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                            : q.status === "active" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                            : q.status === "paused" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";

                          return (
                            <div key={q.id} className="rounded-lg border p-3 space-y-2 bg-background" data-testid={`history-queue-${q.id}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-semibold">{q.templateName || "Free text"}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${statusColor}`}>{q.status}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground">{dateStr} {timeStr}</span>
                              </div>

                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
                              </div>

                              <div className="grid grid-cols-4 gap-1 text-[10px]">
                                <div data-testid={`hist-sent-${q.id}`}>
                                  <span className="text-muted-foreground">Sent</span>
                                  <p className="font-bold text-green-700 dark:text-green-400">{totalSent.toLocaleString()}</p>
                                </div>
                                <div data-testid={`hist-failed-${q.id}`}>
                                  <span className="text-muted-foreground">Failed</span>
                                  <p className="font-bold text-red-600">{totalFailed.toLocaleString()}</p>
                                </div>
                                <div data-testid={`hist-remaining-${q.id}`}>
                                  <span className="text-muted-foreground">Remaining</span>
                                  <p className="font-bold text-amber-600">{remaining.toLocaleString()}</p>
                                </div>
                                <div data-testid={`hist-total-${q.id}`}>
                                  <span className="text-muted-foreground">Total</span>
                                  <p className="font-bold">{total.toLocaleString()}</p>
                                </div>
                              </div>

                              {lastUpdatedStr && (
                                <p className="text-[9px] text-muted-foreground">Last updated: {lastUpdatedStr}</p>
                              )}

                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                {[
                                  { type: "all", label: "Full Report", color: "purple" },
                                  { type: "sent", label: `Sent (${totalSent.toLocaleString()})`, color: "green" },
                                  { type: "failed", label: `Failed (${totalFailed.toLocaleString()})`, color: "red" },
                                  { type: "remaining", label: `Remaining (${remaining.toLocaleString()})`, color: "orange" },
                                ].map(dl => (
                                  <button
                                    key={dl.type}
                                    onClick={() => {
                                      const token = localStorage.getItem("authToken") || "";
                                      fetch(`/api/whatsapp/bulk-queues/${q.id}/download?type=${dl.type}`, {
                                        headers: token ? { "Authorization": `Bearer ${token}` } : {},
                                      })
                                        .then(r => {
                                          if (!r.ok) throw new Error("Download failed");
                                          return r.blob();
                                        })
                                        .then(blob => {
                                          const url = window.URL.createObjectURL(blob);
                                          const a = document.createElement("a");
                                          a.href = url;
                                          a.download = `${dl.type}_${q.templateName || "batch"}_${dateStr.replace(/\s/g, "_")}.xlsx`;
                                          document.body.appendChild(a);
                                          a.click();
                                          a.remove();
                                          window.URL.revokeObjectURL(url);
                                        })
                                        .catch(() => toast({ title: "Download failed", variant: "destructive" }));
                                    }}
                                    className={`flex items-center gap-1 px-2 py-0.5 text-[9px] rounded font-medium cursor-pointer transition-colors ${
                                      dl.color === "green" ? "bg-green-100 hover:bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-300" :
                                      dl.color === "red" ? "bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300" :
                                      dl.color === "orange" ? "bg-orange-100 hover:bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300" :
                                      "bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"
                                    }`}
                                    data-testid={`btn-hist-download-${dl.type}-${q.id}`}
                                  >
                                    <Download className="h-2.5 w-2.5" />
                                    {dl.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </details>
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

          {selectedPlatforms.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Posting to:{" "}
              {selectedPlatforms
                .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                .join(", ")}
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
              <Dialog open={showPreview} onOpenChange={(open) => { setShowPreview(open); if (!open) setIsEditingPreview(false); }}>
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
                          {isEditingPreview ? (
                            <Textarea
                              value={postContent}
                              onChange={(e) => setPostContent(e.target.value)}
                              className="min-h-[160px] text-sm"
                              data-testid="textarea-preview-edit"
                            />
                          ) : (
                            <div className="text-sm text-foreground whitespace-pre-wrap">
                              {postContent}
                            </div>
                          )}
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
                                {selectedProperty.listPrice !== null && selectedProperty.listPrice !== undefined
                                  ? `$${selectedProperty.listPrice.toLocaleString()}`
                                  : "Price upon request"}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {selectedProperty.bedrooms === null ? "—" : selectedProperty.bedrooms}bd •{" "}
                                {selectedProperty.bathrooms === null ? "—" : selectedProperty.bathrooms}ba •{" "}
                                {selectedProperty.squareFootage === null
                                  ? "—"
                                  : selectedProperty.squareFootage.toLocaleString()}{" "}
                                sq ft
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
                    <Button
                      variant="outline"
                      className="w-full sm:flex-1"
                      data-testid={isEditingPreview ? "button-done-edit-preview" : "button-edit-preview"}
                      onClick={() => setIsEditingPreview((v) => !v)}
                    >
                      {isEditingPreview ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Done
                        </>
                      ) : (
                        <>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full sm:flex-1"
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
                            `Price: ${selectedProperty.listPrice !== null && selectedProperty.listPrice !== undefined ? `$${selectedProperty.listPrice.toLocaleString()}` : "Price upon request"}`,
                            `${selectedProperty.bedrooms === null ? "—" : selectedProperty.bedrooms} bd • ${selectedProperty.bathrooms === null ? "—" : selectedProperty.bathrooms} ba • ${selectedProperty.squareFootage === null ? "—" : selectedProperty.squareFootage.toLocaleString()} sq ft`,
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
                      <p>AI Optimize enhances your post content with better engagement and professional messaging. It analyzes your text and suggests improvements for clarity, tone, and industry best practices to help get more visibility and responses from your audience.</p>
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
