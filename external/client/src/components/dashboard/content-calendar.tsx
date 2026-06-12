import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Eye, Home, MoreHorizontal, Heart, MessageCircle, Send, Bookmark, Edit2, Save, Upload, Check, X, ChevronDown, Trash2, Mail } from "lucide-react";
import { FaFacebook, FaInstagram, FaLinkedin, FaYoutube } from "react-icons/fa";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AiGeneratedBadge } from "@/components/shared/ai-generated-badge";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessType } from "@/lib/businessContext";
import { ComplianceChecker } from "@/components/shared/compliance-checker";
import { CharacterCounter } from "@/components/ui/character-counter";

const calendarDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Generate calendar days for specified date
const generateCalendarDays = (selectedDate: Date) => {
  const today = new Date();
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
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

// Holiday recommendations for real estate
const holidayRecommendations = {
  // January
  "2025-01-01": {
    holiday: "New Year's Day",
    recommendations: [
      {
        type: "Social",
        title: "New Year Real Estate Goals",
        description: "Share tips for home buying/selling resolutions",
        color: "bg-yellow-500"
      }
    ]
  },
  "2025-01-20": {
    holiday: "Martin Luther King Jr. Day",
    recommendations: [
      {
        type: "Blog",
        title: "Community Spotlight",
        description: "Highlight diverse local neighborhoods",
        color: "bg-purple-500"
      }
    ]
  },
  
  // February
  "2025-02-02": {
    holiday: "Groundhog Day",
    recommendations: [
      {
        type: "Social",
        title: "Spring Market Preview",
        description: "Will we see an early spring market?",
        color: "bg-green-500"
      }
    ]
  },
  "2025-02-14": {
    holiday: "Valentine's Day",
    recommendations: [
      {
        type: "Social",
        title: "Love Your Home",
        description: "Share romantic home staging tips",
        color: "bg-pink-500"
      }
    ]
  },
  "2025-02-17": {
    holiday: "Presidents Day",
    recommendations: [
      {
        type: "Blog",
        title: "Presidential Homes Tour",
        description: "Historic homes in your area",
        color: "bg-blue-500"
      }
    ]
  },
  
  // March
  "2025-03-17": {
    holiday: "St. Patrick's Day",
    recommendations: [
      {
        type: "Social",
        title: "Lucky Home Finds",
        description: "Share your best property finds",
        color: "bg-emerald-500"
      }
    ]
  },
  "2025-03-20": {
    holiday: "First Day of Spring",
    recommendations: [
      {
        type: "Blog",
        title: "Spring Market Kickoff",
        description: "Spring real estate market trends",
        color: "bg-green-400"
      }
    ]
  },
  
  // April
  "2025-04-01": {
    holiday: "April Fool's Day",
    recommendations: [
      {
        type: "Social",
        title: "Real Estate Myths Busted",
        description: "Debunk common home buying myths",
        color: "bg-orange-500"
      }
    ]
  },
  "2025-04-22": {
    holiday: "Earth Day",
    recommendations: [
      {
        type: "Blog",
        title: "Eco-Friendly Homes",
        description: "Green features in local homes",
        color: "bg-emerald-600"
      }
    ]
  },
  
  // May
  "2025-05-11": {
    holiday: "Mother's Day",
    recommendations: [
      {
        type: "Social",
        title: "Homes Perfect for Families",
        description: "Feature family-friendly neighborhoods",
        color: "bg-rose-400"
      }
    ]
  },
  "2025-05-26": {
    holiday: "Memorial Day",
    recommendations: [
      {
        type: "Social",
        title: "Thank You Veterans",
        description: "Honor veterans, mention VA loan benefits",
        color: "bg-red-600"
      }
    ]
  },
  
  // June
  "2025-06-15": {
    holiday: "Father's Day",
    recommendations: [
      {
        type: "Social",
        title: "Dad's Dream Home Features",
        description: "Man caves, garages, outdoor spaces",
        color: "bg-blue-600"
      }
    ]
  },
  "2025-06-21": {
    holiday: "First Day of Summer",
    recommendations: [
      {
        type: "Blog",
        title: "Summer Move Season",
        description: "Why summer is prime moving time",
        color: "bg-yellow-400"
      }
    ]
  },
  
  // July
  "2025-07-04": {
    holiday: "Independence Day",
    recommendations: [
      {
        type: "Social",
        title: "American Dream Homes",
        description: "Celebrate homeownership freedom",
        color: "bg-red-500"
      }
    ]
  },
  
  // August
  "2025-08-31": {
    holiday: "End of Summer",
    recommendations: [
      {
        type: "Blog",
        title: "Back to School Move Guide",
        description: "Moving families before school starts",
        color: "bg-indigo-500"
      }
    ]
  },
  
  // September
  "2025-09-02": {
    holiday: "Labor Day",
    recommendations: [
      {
        type: "Social",
        title: "Hard Working Homeowners",
        description: "Celebrate the value of hard work",
        color: "bg-gray-600"
      }
    ]
  },
  "2025-09-23": {
    holiday: "First Day of Fall",
    recommendations: [
      {
        type: "Blog",
        title: "Fall Market Opportunities",
        description: "Why fall can be great for buying",
        color: "bg-orange-600"
      }
    ]
  },
  
  // October
  "2025-10-31": {
    holiday: "Halloween",
    recommendations: [
      {
        type: "Social",
        title: "Spooky House Features",
        description: "Fun post about unique home features",
        color: "bg-orange-500"
      }
    ]
  },
  
  // November
  "2025-11-11": {
    holiday: "Veterans Day",
    recommendations: [
      {
        type: "Blog",
        title: "VA Loans for Veterans",
        description: "Help veterans understand VA benefits",
        color: "bg-red-700"
      }
    ]
  },
  "2025-11-27": {
    holiday: "Thanksgiving",
    recommendations: [
      {
        type: "Social",
        title: "Grateful for Clients",
        description: "Thank your clients and community",
        color: "bg-amber-600"
      }
    ]
  },
  
  // December
  "2025-12-25": {
    holiday: "Christmas",
    recommendations: [
      {
        type: "Social",
        title: "Holiday Home Decor",
        description: "Share festive staging tips",
        color: "bg-red-600"
      }
    ]
  },
  "2025-12-31": {
    holiday: "New Year's Eve",
    recommendations: [
      {
        type: "Blog",
        title: "Year in Review",
        description: "Reflect on the year's market success",
        color: "bg-purple-600"
      }
    ]
  }
};

// Initial scheduled content with specific dates
const initialScheduledContent = [
  {
    id: 1,
    title: "Dundee Market Report",
    type: "Blog",
    date: new Date(2025, 0, 7), // January 7, 2025 (Tuesday)
    time: "10:00 AM",
    color: "bg-primary",
    platform: "Facebook",
    content: "🏘️ Neighborhood Market Update\n\nThe local market continues to show strong activity! Here's what we're seeing:\n\n📈 Average home price trending upward\n🏠 Days on market: competitive\n📊 Active listings available\n\nHistoric charm and walkability make this one of the most desirable neighborhoods. Perfect for buyers seeking character homes with modern updates.\n\nLooking to buy or sell? Let's chat about current opportunities!\n\n#RealEstate #MarketUpdate",
  },
  {
    id: 2,
    title: "Property Showcase: Aksarben",
    type: "Social",
    date: new Date(2025, 0, 10), // January 10, 2025 (Friday)
    time: "2:00 PM",
    color: "bg-accent",
    platform: "Instagram",
    content: "✨ JUST LISTED! ✨\n\n🏡 4BR/3BA Contemporary Home\n💰 Competitively Priced\n📍 Prime Location\n\n▫️ Open concept living\n▫️ Gourmet kitchen with granite counters\n▫️ Master suite with walk-in closet\n▫️ Private backyard oasis\n▫️ 2-car garage\n\nWalkable to shops, restaurants, and local amenities! This won't last long in today's market.\n\nDM me for a private showing! 📲\n\n#JustListed #RealEstateExpert #HomesForSale",
  },
  {
    id: 3,
    title: "Home Buying Tips Video",
    type: "Video",
    date: new Date(2025, 0, 13), // January 13, 2025 (Monday)
    time: "9:00 AM",
    color: "bg-chart-3",
    platform: "YouTube",
    content: "🎥 First-Time Home Buyer Tips\n\nIn this video, I share the essential steps every first-time buyer should know when purchasing a home.\n\n📋 What's covered:\n• Pre-approval process and local lenders\n• Neighborhood selection guide\n• Home inspection priorities\n• Closing cost expectations\n• Market timing strategies\n\nAs your local expert, I've helped hundreds of first-time buyers navigate this exciting journey. Let me help you find your dream home!\n\n💬 Questions? Drop them in the comments below!\n\n#FirstTimeBuyer #RealEstate #HomeBuyingTips #RealEstateEducation",
  },
  {
    id: 4,
    title: "Weekend Open House",
    type: "Social",
    date: new Date(2025, 0, 18), // January 18, 2025 (Saturday)
    time: "11:00 AM",
    color: "bg-green-500",
    platform: "Facebook",
    content: "🏠 OPEN HOUSE THIS WEEKEND! 🏠\n\n📍 Beautiful Craftsman Home\n⏰ Saturday & Sunday 1-4 PM\n💰 Competitively Priced\n\n✨ Features:\n• 3BR/2BA Craftsman style\n• Updated kitchen & baths\n• Hardwood floors throughout\n• Large fenced backyard\n• Walking distance to shops\n\nPerfect starter home or investment property! See you there!\n\n#OpenHouse #RealEstate #HomesForSale",
  },
  {
    id: 5,
    title: "Market Trends Analysis",
    type: "Blog",
    date: new Date(2025, 0, 24), // January 24, 2025 (Friday)
    time: "3:00 PM",
    color: "bg-indigo-500",
    platform: "LinkedIn",
    content: "📊 Real Estate Market Trends\n\nAs we move through the first quarter, here's what we're seeing in the local market:\n\n🏠 INVENTORY: Up 12% from last month\n💰 MEDIAN PRICE: Trending upward YoY\n📈 SALES VOLUME: Strong activity despite winter\n⏱️ DAYS ON MARKET: Competitive\n\nKey insights for buyers and sellers:\n• Inventory increasing gives buyers more options\n• Interest rates stabilizing\n• Spring market prep should start now\n\nThinking of making a move? Let's discuss your strategy.\n\n#RealEstate #MarketTrends #RealEstateExpert",
  }
];

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
  metadata?: {
    imageUrl?: string;
    planId?: string;
    aiGenerated?: boolean;
    backfilled?: boolean;
    theme?: string;
    [key: string]: any;
  };
}

export function ContentCalendar() {
  const { user, isLoading: authLoading } = useAuth();
  const { businessType, terms } = useBusinessType();
  const isRealEstate = terms.features.complianceCheck;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [localGeneratedPosts, setLocalGeneratedPosts] = useState<typeof initialScheduledContent>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [savedPhotoUrl, setSavedPhotoUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [isBulkDelete, setIsBulkDelete] = useState(false);
  const [isDeleteAll, setIsDeleteAll] = useState(false);
  const { toast } = useToast();
  
  // Get user's display name with proper formatting
  const rawName = user?.name || user?.email?.split('@')[0];
  const userName = rawName 
    ? rawName.charAt(0).toUpperCase() + rawName.slice(1) // Capitalize first letter
    : "Agent";
  const hasRealName = !!rawName; // Flag to check if we have a real name vs fallback

  const { data: apiScheduledPosts = [], isLoading } = useQuery<ScheduledPost[]>({
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

  const updatePostMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ScheduledPost> }) => {
      // Only send mutable fields to match updateScheduledPostSchema
      const allowedFields: Array<keyof ScheduledPost> = ['status', 'content', 'scheduledFor', 'hashtags', 'metadata'];
      const payload: any = {};
      allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
          payload[field] = updates[field];
        }
      });
      
      const response = await apiRequest('PATCH', `/api/scheduled-posts/${id}`, payload);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
      toast({
        title: "Post Updated",
        description: "Your changes have been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: "Could not save changes. Please try again.",
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
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      setSelectedPosts(new Set());
      setIsBulkDelete(false);
      setIsDeleteAll(false);
      const count = data?.deleted ?? 0;
      toast({
        title: "Posts Deleted",
        description: `${count} scheduled post${count !== 1 ? 's have' : ' has'} been deleted.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete posts. Please try again.",
        variant: "destructive",
      });
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
      const weeks = data.weeks || (data.posts?.length ? Math.ceil(data.posts.length / 7) : 4);
      toast({
        title: "Content Plan Generated!",
        description: `Successfully created ${weeks}-week content calendar with ${data.posts?.length || 0} posts`,
      });
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: "Could not generate content plan. Please try again.",
        variant: "destructive",
      });
    },
  });

  const approvePostMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('PATCH', `/api/scheduled-posts/${id}`, { status: 'approved' });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
      setShowPreview(false);
      toast({
        title: "Post Approved",
        description: "The post has been approved and will be published on schedule.",
      });
    },
  });

  const declinePostMutation = useMutation({
    mutationFn: async (id: string) => {
      // Use PATCH to set status='cancelled' instead of DELETE
      const response = await apiRequest('PATCH', `/api/scheduled-posts/${id}`, { status: 'cancelled' });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
      setShowPreview(false);
      toast({
        title: "Post Declined",
        description: "The post has been cancelled and won't be published.",
      });
    },
  });

  const duplicatePostMutation = useMutation({
    mutationFn: async (post: ScheduledPost) => {
      // Create a new post with the same content but new schedule time (1 week later)
      const originalDate = new Date(post.scheduledFor);
      const newScheduleDate = new Date(originalDate);
      newScheduleDate.setDate(originalDate.getDate() + 7); // Schedule 1 week later

      const duplicateData = {
        userId: post.userId,
        platform: post.platform,
        postType: post.postType,
        content: post.content,
        hashtags: post.hashtags || [],
        scheduledFor: newScheduleDate.toISOString(),
        status: 'pending', // New duplicate starts as pending
        isAiGenerated: post.isAiGenerated || false,
        metadata: post.metadata || {},
      };

      const response = await apiRequest('POST', '/api/scheduled-posts', duplicateData);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
      setShowPreview(false);
      toast({
        title: "Post Duplicated",
        description: "A copy has been created and scheduled for 1 week later. You can edit the schedule in the calendar.",
      });
    },
    onError: (error) => {
      toast({
        title: "Duplication Failed",
        description: "Could not duplicate the post. Please try again.",
        variant: "destructive",
      });
    },
  });

  const platformColors = {
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

  const scheduledContent = useMemo(() => {
    const transformedPosts = apiScheduledPosts.map((post) => {
      const scheduledDate = new Date(post.scheduledFor);
      const platformKey = post.platform.toLowerCase() as keyof typeof platformColors;
      
      return {
        id: `api-${post.id}`,
        title: post.postType ? postTypeLabels[post.postType] || post.postType : "Social Post",
        type: "Social",
        date: scheduledDate,
        time: format(scheduledDate, "h:mm a"),
        color: platformColors[platformKey] || "bg-gray-500",
        platform: platformNames[platformKey] || post.platform.charAt(0).toUpperCase() + post.platform.slice(1),
        content: post.content,
        photoUrl: post.metadata?.imageUrl,
        isAiGenerated: post.isAiGenerated || false,
      };
    });

    const hasApiPosts = apiScheduledPosts.length > 0;
    const seedContent = hasApiPosts ? [] : initialScheduledContent;

    return [...seedContent, ...localGeneratedPosts, ...transformedPosts];
  }, [apiScheduledPosts, localGeneratedPosts]);

  const setScheduledContent = (updater: typeof initialScheduledContent | ((prev: typeof initialScheduledContent) => typeof initialScheduledContent)) => {
    if (typeof updater === 'function') {
      setLocalGeneratedPosts(prevLocal => {
        const seedContent = apiScheduledPosts.length > 0 ? [] : initialScheduledContent;
        const transformedAPI = apiScheduledPosts.map(p => {
          const platformKey = p.platform.toLowerCase() as keyof typeof platformColors;
          return {
            id: `api-${p.id}`,
            title: p.postType ? postTypeLabels[p.postType] || p.postType : "Social Post",
            type: "Social" as const,
            date: new Date(p.scheduledFor),
            time: format(new Date(p.scheduledFor), "h:mm a"),
            color: platformColors[platformKey] || "bg-gray-500",
            platform: platformNames[platformKey] || p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
            content: p.content,
            photoUrl: p.metadata?.imageUrl,
            isAiGenerated: p.isAiGenerated || false,
          };
        });
        
        const currentFull = [...seedContent, ...prevLocal, ...transformedAPI];
        const currentLength = currentFull.length;
        const newFull = updater(currentFull);
        
        const newlyAddedItems = newFull.slice(currentLength);
        
        return [...prevLocal, ...newlyAddedItems];
      });
    } else {
      setLocalGeneratedPosts(updater);
    }
  };
  
  const handlePreview = (content: typeof initialScheduledContent[0]) => {
    console.log('Preview content:', content);
    console.log('Platform:', content.platform);
    setPreviewContent(content);
    setShowPreview(true);
    setIsEditing(false);
    setEditedContent(content.content);
    // Check if this content has a saved photo
    const savedPhoto = (content as any).photoUrl || null;
    setSavedPhotoUrl(savedPhoto);
    setPhotoPreview(savedPhoto);
  };
  
  const getContentForDate = (date: Date) => {
    const dateStr = date.toDateString();
    return scheduledContent.filter(content => 
      content.date.toDateString() === dateStr
    );
  };
  
  const getHolidayForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return holidayRecommendations[dateStr as keyof typeof holidayRecommendations];
  };
  
  const calendarGrid = generateCalendarDays(selectedDate);
  
  // Generate month/year options
  const currentYear = new Date().getFullYear();
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const years = Array.from({ length: 3 }, (_, i) => currentYear + i - 1); // Previous, current, next year
  
  const handleMonthYearChange = (monthYear: string) => {
    const [monthName, year] = monthYear.split(' ');
    const monthIndex = months.indexOf(monthName);
    setSelectedDate(new Date(parseInt(year), monthIndex, 1));
  };
  
  const handlePhotoUpload = async () => {
    return {
      method: "PUT" as const,
      url: "/api/upload-placeholder", // This would be replaced with actual upload endpoint
    };
  };
  
  const handlePhotoComplete = (uploadedUrl: string, savedToLibrary?: boolean) => {
    if (uploadedUrl) {
      setPhotoPreview(uploadedUrl);
      setSavedPhotoUrl(uploadedUrl);
      if (savedToLibrary === false) {
        toast({
          title: "Photo Uploaded",
          description: "Your property photo has been uploaded but could not be saved to your library",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Photo Uploaded",
          description: "Your property photo has been uploaded and saved to your library",
        });
      }
    }
  };
  
  const handleSaveEdit = async () => {
    if (!previewContent) return;
    
    // Get the API post ID (remove 'api-' prefix if present)
    const apiPostId = String(previewContent.id).startsWith('api-') 
      ? String(previewContent.id).replace('api-', '') 
      : null;
    
    if (!apiPostId) {
      // For local/mock posts, just update local state
      setSavedPhotoUrl(photoPreview);
      toast({
        title: "Content Updated", 
        description: "Your content changes have been saved locally",
      });
      setIsEditing(false);
      return;
    }
    
    // Update API post
    const updates: Partial<ScheduledPost> = {
      content: editedContent,
    };
    
    // Add photo URL to metadata if changed
    if (photoPreview !== savedPhotoUrl) {
      updates.metadata = {
        ...(previewContent as any).metadata,
        imageUrl: photoPreview,
      };
      setSavedPhotoUrl(photoPreview);
    }
    
    try {
      await updatePostMutation.mutateAsync({ id: apiPostId, updates });
      setIsEditing(false);
    } catch (error) {
      // Error toast is handled by the mutation
      console.error('Failed to save edit:', error);
    }
  };
  
  const handleAIScheduling = async () => {
    setIsGenerating(true);
    
    try {
      // Fetch SEO keywords and market data for intelligent scheduling
      const [keywordsResponse, marketResponse] = await Promise.all([
        fetch('/api/seo/keywords'),
        fetch('/api/market/data')
      ]);
      
      if (!keywordsResponse.ok || !marketResponse.ok) {
        throw new Error('Failed to fetch data for AI scheduling');
      }
      
      const keywords = await keywordsResponse.json();
      const marketData = await marketResponse.json();
      
      // Ensure we have valid arrays
      const validKeywords = Array.isArray(keywords) ? keywords : [];
      const validMarketData = Array.isArray(marketData) ? marketData : [];
      
      // Generate AI-optimized content schedule (with 60-second timeout)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      const response = await fetch('/api/ai/schedule-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keywords: validKeywords.slice(0, 5), // Top 5 keywords
          marketData: validMarketData.slice(0, 3), // Top 3 market trends
          timeframe: '15-days',
          focus: 'high-impact',
          prompt: `You are a ${terms.role} creating a content calendar. Create 2 weeks worth of social media posts relevant to ${terms.dashboardSubtitle}. Optimize what days are best for each platform.`
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error('Failed to generate AI schedule');
      }
      
      const aiSchedule = await response.json();
      
      // Convert AI schedule to our content format and add to existing content
      const newContent = aiSchedule.schedule.map((item: any, index: number) => {
        // Parse date safely - API returns 'date' field, not 'scheduledDate'
        let parsedDate;
        try {
          if (item.date) {
            parsedDate = new Date(item.date);
            // Check if date is valid
            if (isNaN(parsedDate.getTime())) {
              // Fallback to a default date if invalid
              parsedDate = new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000); // Next few days
            }
          } else {
            // Fallback to distributing over next few days
            parsedDate = new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000);
          }
        } catch (error) {
          console.warn('Date parsing error:', error);
          // Fallback to distributing over next few days
          parsedDate = new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000);
        }

        return {
          id: `local-${Date.now()}-${index}`,
          title: item.title || `AI Post ${index + 1}`,
          type: item.type || 'Social',
          date: parsedDate,
          time: item.time || '10:00 AM',
          color: item.color || "bg-primary",
          platform: item.platform || 'Facebook',
          content: item.content || 'AI generated content',
          isAiGenerated: true,
        };
      });
      
      // Add new content to existing schedule
      setScheduledContent(prev => [...prev, ...newContent]);
      
      toast({
        title: "🤖 AI Content Scheduled!",
        description: `Generated ${aiSchedule.contentCount} optimized posts and added them to your calendar.`,
      });
      
    } catch (error: any) {
      console.error('AI scheduling error:', error);
      
      // Handle timeout specifically
      if (error.name === 'AbortError') {
        toast({
          title: "Request Timeout",
          description: "AI generation took too long (60s limit). Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "AI Scheduling Error",
          description: "Failed to generate optimized schedule. Please try again.",
          variant: "destructive"
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'Facebook': return FaFacebook;
      case 'Instagram': return FaInstagram;
      case 'LinkedIn': return FaLinkedin;
      case 'YouTube': return FaYoutube;
      case 'Email':
      case 'email': return Mail;
      default: return FaFacebook;
    }
  };
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Content Calendar</CardTitle>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  disabled={generateContentPlanMutation.isPending}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-sm font-medium px-3 py-2 rounded-md transition-all duration-200"
                  data-testid="button-generate-content-plan"
                >
                  {generateContentPlanMutation.isPending ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <span className="mr-1 text-lg">📅</span>
                      Generate Plan
                      <ChevronDown className="ml-1 h-4 w-4" />
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem 
                  onClick={() => generateContentPlanMutation.mutate(1)}
                  data-testid="menu-1-week-plan"
                >
                  1 Week Plan
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => generateContentPlanMutation.mutate(2)}
                  data-testid="menu-2-week-plan"
                  className="flex flex-col items-start"
                >
                  <span>2 Week Blueprint</span>
                  <span className="text-[10px] text-muted-foreground">SEO/AEO optimized with question hooks</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => generateContentPlanMutation.mutate(3)}
                  data-testid="menu-3-week-plan"
                >
                  3 Week Plan
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => generateContentPlanMutation.mutate(4)}
                  data-testid="menu-full-month-plan"
                  className="flex flex-col items-start"
                >
                  <span>Full Month</span>
                  <span className="text-[10px] text-muted-foreground">4 weeks of content across all platforms</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              onClick={handleAIScheduling}
              disabled={isGenerating}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-all duration-200"
              data-testid="button-ai-schedule"
            >
              {isGenerating ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Generating...
                </>
              ) : (
                <>
                  <span className="mr-1 text-lg">🤖</span>
                  AI Schedule
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Calendar View */}
        <div className="space-y-4">
          {/* Month View */}
          <div>
            <div className="flex items-center justify-between mb-3 gap-3">
              <Select
                value={`${format(selectedDate, "MMMM")} ${format(selectedDate, "yyyy")}`}
                onValueChange={handleMonthYearChange}
              >
                <SelectTrigger className="w-44 h-8 text-sm font-medium">
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

              <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                <SelectTrigger className="w-36 h-8 text-sm" data-testid="select-status-filter">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Posts</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="posted">Posted</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Calendar Header */}
            <div className="grid grid-cols-7 mb-1">
              {calendarDays.map((day) => (
                <div key={day} className="text-[11px] font-semibold text-muted-foreground text-center py-1.5 uppercase tracking-wide">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 border-l border-t">
              {calendarGrid.map((week, weekIndex) =>
                week.map((day, dayIndex) => {
                  const dayContent = getContentForDate(day.fullDate);
                  const holiday = getHolidayForDate(day.fullDate);

                  return (
                    <div
                      key={`${weekIndex}-${dayIndex}`}
                      className={`
                        relative min-h-[36px] sm:min-h-[56px] p-0.5 sm:p-1.5 border-r border-b
                        ${
                          !day.isCurrentMonth
                            ? "bg-muted/30"
                            : "bg-background hover:bg-muted/20 transition-colors"
                        }
                      `}
                      data-testid={`calendar-day-${day.date}`}
                    >
                      {/* Day number */}
                      <div className={`
                        text-[10px] sm:text-xs font-medium w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center rounded-full mb-0.5 sm:mb-1 mx-auto
                        ${
                          day.isToday
                            ? "bg-primary text-primary-foreground"
                            : day.isCurrentMonth
                            ? "text-foreground"
                            : "text-muted-foreground/50"
                        }
                      `}>
                        {day.date}
                      </div>

                      {/* Holiday dot */}
                      {holiday && (
                        <div className="flex justify-center gap-0.5 mb-0.5">
                          {holiday.recommendations.slice(0, 2).map((rec, index) => (
                            <div
                              key={index}
                              className={`w-1 h-1 rounded-full ${rec.color} cursor-pointer`}
                              title={`${holiday.holiday}: ${rec.description}`}
                            />
                          ))}
                        </div>
                      )}

                      {/* Mobile: dot indicator when day has content */}
                      {dayContent.length > 0 && (
                        <div className="flex justify-center sm:hidden">
                          <div className="w-1 h-1 rounded-full bg-primary" />
                        </div>
                      )}

                      {/* Scheduled Content — pill per item, hidden on mobile */}
                      <div className="hidden sm:block space-y-0.5">
                        {dayContent.slice(0, 2).map((content) => (
                          <div
                            key={content.id}
                            className={`text-[10px] px-1 py-0.5 rounded-sm ${content.color} text-white cursor-pointer hover:opacity-80 truncate leading-tight`}
                            onClick={() => handlePreview(content)}
                            title={`${content.title} - ${content.time}\n${content.content?.substring(0, 100)}`}
                          >
                            {content.title}
                          </div>
                        ))}
                        {dayContent.length > 2 && (
                          <div className="text-[10px] text-muted-foreground text-center">+{dayContent.length - 2}</div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Upcoming Content */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground">This Week's Content</h3>
              <div className="flex items-center gap-2">
                {scheduledContent.some(c => String(c.id).startsWith('api-')) && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all"
                      checked={
                        scheduledContent.filter(c => String(c.id).startsWith('api-')).length > 0 &&
                        scheduledContent.filter(c => String(c.id).startsWith('api-')).every(c => 
                          selectedPosts.has(String(c.id).replace('api-', ''))
                        )
                      }
                      onCheckedChange={(checked) => {
                        if (checked) {
                          const apiPostIds = scheduledContent
                            .filter(c => String(c.id).startsWith('api-'))
                            .map(c => String(c.id).replace('api-', ''));
                          setSelectedPosts(new Set(apiPostIds));
                        } else {
                          setSelectedPosts(new Set());
                        }
                      }}
                      data-testid="checkbox-select-all"
                    />
                    <label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer">
                      Select All
                    </label>
                  </div>
                )}
                {selectedPosts.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setIsBulkDelete(true);
                      setIsDeleteAll(false);
                      setShowDeleteConfirm(true);
                    }}
                    data-testid="button-delete-selected"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete {selectedPosts.size} Selected
                  </Button>
                )}
                {scheduledContent.some(c => String(c.id).startsWith('api-')) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => {
                      setIsBulkDelete(true);
                      setIsDeleteAll(true);
                      setShowDeleteConfirm(true);
                    }}
                    data-testid="button-delete-all"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete All
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-3">
              {scheduledContent.map((content) => {
                const isApiPost = String(content.id).startsWith('api-');
                const apiPostId = isApiPost ? String(content.id).replace('api-', '') : null;
                const isSelected = apiPostId ? selectedPosts.has(apiPostId) : false;
                
                return (
                  <div key={content.id} className="flex items-center space-x-3" data-testid={`content-item-${content.id}`}>
                    {isApiPost && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          const newSelected = new Set(selectedPosts);
                          if (checked && apiPostId) {
                            newSelected.add(apiPostId);
                          } else if (apiPostId) {
                            newSelected.delete(apiPostId);
                          }
                          setSelectedPosts(newSelected);
                        }}
                        data-testid={`checkbox-select-${content.id}`}
                      />
                    )}
                    <div className={`w-2 h-2 ${content.color} rounded-full`}></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-foreground">{content.title}</p>
                        {(content as any).isAiGenerated && <AiGeneratedBadge size="sm" />}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {content.type} • {format(content.date, "MMM d")} {content.time}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handlePreview(content)}
                        data-testid={`button-preview-${content.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {isApiPost && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPostToDelete(apiPostId);
                            setIsBulkDelete(false);
                            setShowDeleteConfirm(true);
                          }}
                          data-testid={`button-delete-${content.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
      
      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="sr-only">
            <DialogTitle>Content Preview</DialogTitle>
          </DialogHeader>
          {previewContent && (
            <div>
              {/* AI Generated Badge */}
              {(previewContent as any).isAiGenerated && (
                <div className="bg-muted/50 border-b px-3 py-2">
                  <AiGeneratedBadge size="sm" />
                </div>
              )}
              {/* Facebook Preview */}
              {previewContent.platform === 'Facebook' && (
                <div className="bg-white text-black">
                  <div className="flex items-center gap-3 p-3">
                    <div className="w-10 h-10 bg-golden-accent rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-golden-foreground">MB</span>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{userName}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <span>{format(new Date(), "MMM d 'at' h:mm a")}</span>
                        <span>·</span>
                        <span>🌎</span>
                      </div>
                    </div>
                    <MoreHorizontal className="h-5 w-5 text-gray-500" />
                  </div>
                  
                  <div className="px-3 pb-3">
                    {isEditing ? (
                      <>
                        <Textarea
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          className="text-sm mb-2 min-h-[100px] resize-none"
                          placeholder="Edit your content..."
                        />
                        <CharacterCounter
                          platform="facebook"
                          text={editedContent}
                          className="mb-3"
                        />
                      </>
                    ) : (
                      <div className="text-sm mb-3 whitespace-pre-wrap">
                        {editedContent}
                      </div>
                    )}
                  </div>
                  
                  {(photoPreview || savedPhotoUrl) ? (
                    <div className="aspect-video bg-cover bg-center relative" style={{ backgroundImage: `url(${photoPreview || savedPhotoUrl})` }}>
                      {isEditing && (
                        <div className="absolute top-2 right-2">
                          <ObjectUploader
                            maxNumberOfFiles={1}
                            maxFileSize={10485760}
                            saveToLibrary={true}
                            libraryType="photo"
                            onGetUploadParameters={handlePhotoUpload}
                            onComplete={handlePhotoComplete}
                            buttonClassName="h-8 w-8 p-0 bg-black/50 hover:bg-black/70"
                          >
                            <Upload className="h-4 w-4 text-white" />
                          </ObjectUploader>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="aspect-video bg-gradient-to-br from-golden-accent/20 to-golden-muted/40 flex items-center justify-center">
                      <div className="text-center text-gray-600">
                        {isEditing ? (
                          <ObjectUploader
                            maxNumberOfFiles={1}
                            maxFileSize={10485760}
                            saveToLibrary={true}
                            libraryType="photo"
                            onGetUploadParameters={handlePhotoUpload}
                            onComplete={handlePhotoComplete}
                            buttonClassName="bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Property Image
                          </ObjectUploader>
                        ) : (
                          <>
                            <Home className="h-12 w-12 mx-auto mb-2" />
                            <div className="text-sm">Property Image</div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="p-3 border-t">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <div className="flex -space-x-1">
                          <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-xs text-white">👍</div>
                          <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-xs text-white">❤️</div>
                        </div>
                        <span className="ml-2">67</span>
                      </div>
                      <div>12 comments</div>
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
              
              {/* Instagram Preview */}
              {previewContent.platform === 'Instagram' && (
                <div className="bg-white text-black">
                  <div className="flex items-center justify-between p-3 border-b">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-400 rounded-full p-[2px]">
                        <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-golden-accent">MB</span>
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-sm">mikebjork_realtor</div>
                        <div className="text-xs text-gray-500">Real Estate</div>
                      </div>
                    </div>
                    <MoreHorizontal className="h-4 w-4" />
                  </div>
                  
                  {(photoPreview || savedPhotoUrl) ? (
                    <div className="aspect-square bg-cover bg-center relative" style={{ backgroundImage: `url(${photoPreview || savedPhotoUrl})` }}>
                      {isEditing && (
                        <div className="absolute top-2 right-2">
                          <ObjectUploader
                            maxNumberOfFiles={1}
                            maxFileSize={10485760}
                            saveToLibrary={true}
                            libraryType="photo"
                            onGetUploadParameters={handlePhotoUpload}
                            onComplete={handlePhotoComplete}
                            buttonClassName="h-8 w-8 p-0 bg-black/50 hover:bg-black/70"
                          >
                            <Upload className="h-4 w-4 text-white" />
                          </ObjectUploader>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="aspect-square bg-gradient-to-br from-golden-accent/20 to-golden-muted/40 flex items-center justify-center">
                      <div className="text-center text-gray-600">
                        {isEditing ? (
                          <ObjectUploader
                            maxNumberOfFiles={1}
                            maxFileSize={10485760}
                            saveToLibrary={true}
                            libraryType="photo"
                            onGetUploadParameters={handlePhotoUpload}
                            onComplete={handlePhotoComplete}
                            buttonClassName="bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Property Image
                          </ObjectUploader>
                        ) : (
                          <>
                            <Home className="h-12 w-12 mx-auto mb-2" />
                            <div className="text-sm">Property Image</div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-4">
                        <Heart className="h-6 w-6" />
                        <MessageCircle className="h-6 w-6" />
                        <Send className="h-6 w-6" />
                      </div>
                      <Bookmark className="h-6 w-6" />
                    </div>
                    <div className="text-sm font-semibold mb-1">183 likes</div>
                    <div className="text-sm">
                      <span className="font-semibold">mikebjork_realtor</span>
                      <span className="ml-1">
                        {isEditing ? (
                          <>
                            <Textarea
                              value={editedContent}
                              onChange={(e) => setEditedContent(e.target.value)}
                              className="text-sm mt-2 min-h-[80px] resize-none w-full"
                              placeholder="Edit your caption..."
                            />
                            <CharacterCounter
                              platform="instagram"
                              text={editedContent}
                              className="mt-2"
                            />
                          </>
                        ) : (
                          <span className="whitespace-pre-wrap">{editedContent}</span>
                        )}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">View all 8 comments</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {format(new Date(), "MMMM d")}
                    </div>
                  </div>
                </div>
              )}
              
              {/* YouTube Preview */}
              {previewContent.platform === 'YouTube' && (
                <div className="bg-white text-black p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-golden-accent rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-golden-foreground">MB</span>
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{userName} Real Estate</div>
                      <div className="text-xs text-gray-500">Real Estate Expert</div>
                    </div>
                  </div>
                  
                  {(photoPreview || savedPhotoUrl) ? (
                    <div className="aspect-video bg-cover bg-center rounded mb-3 relative" style={{ backgroundImage: `url(${photoPreview || savedPhotoUrl})` }}>
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded">
                        <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
                          <div className="w-0 h-0 border-l-[8px] border-l-white border-y-[6px] border-y-transparent ml-1"></div>
                        </div>
                      </div>
                      {isEditing && (
                        <div className="absolute top-2 right-2">
                          <ObjectUploader
                            maxNumberOfFiles={1}
                            maxFileSize={10485760}
                            saveToLibrary={true}
                            libraryType="photo"
                            onGetUploadParameters={handlePhotoUpload}
                            onComplete={handlePhotoComplete}
                            buttonClassName="h-8 w-8 p-0 bg-black/50 hover:bg-black/70"
                          >
                            <Upload className="h-4 w-4 text-white" />
                          </ObjectUploader>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="aspect-video bg-gradient-to-br from-golden-accent/20 to-golden-muted/40 flex items-center justify-center rounded mb-3 relative">
                      {isEditing ? (
                        <ObjectUploader
                          maxNumberOfFiles={1}
                          maxFileSize={10485760}
                          onGetUploadParameters={handlePhotoUpload}
                          onComplete={handlePhotoComplete}
                          buttonClassName="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Video Thumbnail
                        </ObjectUploader>
                      ) : (
                        <>
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded">
                            <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
                              <div className="w-0 h-0 border-l-[8px] border-l-white border-y-[6px] border-y-transparent ml-1"></div>
                            </div>
                          </div>
                          <div className="text-center text-gray-600">
                            <Home className="h-12 w-12 mx-auto mb-2" />
                            <div className="text-sm font-medium">Video Thumbnail</div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <div className="text-sm font-semibold line-clamp-2">
                      {previewContent.title}
                    </div>
                    {isEditing ? (
                      <>
                        <Textarea
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          className="text-xs text-gray-600 min-h-[60px] resize-none"
                          placeholder="Edit video description..."
                        />
                        <CharacterCounter
                          platform="youtube"
                          text={editedContent}
                        />
                      </>
                    ) : (
                      <div className="text-xs text-gray-600 max-h-20 overflow-y-auto whitespace-pre-wrap">
                        {editedContent}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* LinkedIn Preview */}
              {previewContent.platform === 'LinkedIn' && (
                <div className="bg-white text-black p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-golden-accent rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-golden-foreground">MB</span>
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{userName}</div>
                      <div className="text-xs text-gray-500">{terms.role}</div>
                      <div className="text-xs text-gray-400">
                        {format(new Date(), "MMM d, h:mm a")}
                      </div>
                    </div>
                  </div>
                  {isEditing ? (
                    <>
                      <Textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="text-sm mb-2 min-h-[100px] resize-none"
                        placeholder="Edit your content..."
                      />
                      <CharacterCounter
                        platform="linkedin"
                        text={editedContent}
                        className="mb-3"
                      />
                    </>
                  ) : (
                    <div className="text-sm mb-3 whitespace-pre-wrap">
                      {editedContent}
                    </div>
                  )}
                  {(photoPreview || savedPhotoUrl) ? (
                    <div className="border rounded bg-gray-50 p-1 mb-3 relative">
                      <img 
                        src={photoPreview || savedPhotoUrl || ""} 
                        alt="Property" 
                        className="w-full aspect-video object-cover rounded"
                      />
                      {isEditing && (
                        <div className="absolute top-2 right-2">
                          <ObjectUploader
                            maxNumberOfFiles={1}
                            maxFileSize={10485760}
                            saveToLibrary={true}
                            libraryType="photo"
                            onGetUploadParameters={handlePhotoUpload}
                            onComplete={handlePhotoComplete}
                            buttonClassName="h-8 w-8 p-0 bg-black/50 hover:bg-black/70"
                          >
                            <Upload className="h-4 w-4 text-white" />
                          </ObjectUploader>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="border rounded bg-gray-50 p-4">
                      <div className="text-center text-gray-600">
                        {isEditing ? (
                          <ObjectUploader
                            maxNumberOfFiles={1}
                            maxFileSize={10485760}
                            saveToLibrary={true}
                            libraryType="photo"
                            onGetUploadParameters={handlePhotoUpload}
                            onComplete={handlePhotoComplete}
                            buttonClassName="bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Property Image
                          </ObjectUploader>
                        ) : (
                          <>
                            <Home className="h-8 w-8 mx-auto mb-2" />
                            <div className="text-sm font-medium">Property Listing</div>
                            <div className="text-xs">Click to view details</div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Default/Fallback Preview for other platforms or if no match */}
              {previewContent.platform !== 'Facebook' && 
               previewContent.platform !== 'Instagram' && 
               previewContent.platform !== 'YouTube' && 
               previewContent.platform !== 'LinkedIn' && (
                <div className="bg-white dark:bg-gray-900 text-black dark:text-white p-4">
                  <div className="flex items-center gap-3 mb-3 pb-3 border-b">
                    <div className="w-10 h-10 bg-golden-accent rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-golden-foreground">MB</span>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{userName}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {previewContent.platform} • {format(new Date(), "MMM d, h:mm a")}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <div className="font-semibold text-base mb-2">{previewContent.title}</div>
                    {isEditing ? (
                      <Textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="text-sm min-h-[100px] resize-none"
                        placeholder="Edit your content..."
                      />
                    ) : (
                      <div className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                        {editedContent}
                      </div>
                    )}
                  </div>
                  
                  {(photoPreview || savedPhotoUrl) && (
                    <div className="border rounded bg-gray-50 dark:bg-gray-800 p-1 relative">
                      <img 
                        src={photoPreview || savedPhotoUrl || ""} 
                        alt="Content" 
                        className="w-full aspect-video object-cover rounded"
                      />
                      {isEditing && (
                        <div className="absolute top-2 right-2">
                          <ObjectUploader
                            maxNumberOfFiles={1}
                            maxFileSize={10485760}
                            saveToLibrary={true}
                            libraryType="photo"
                            onGetUploadParameters={handlePhotoUpload}
                            onComplete={handlePhotoComplete}
                            buttonClassName="h-8 w-8 p-0 bg-black/50 hover:bg-black/70"
                          >
                            <Upload className="h-4 w-4 text-white" />
                          </ObjectUploader>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* BHHS Compliance Checker */}
          {isRealEstate && previewContent && (
            <div className="px-4 pt-3">
              <ComplianceChecker
                content={isEditing ? editedContent : (previewContent.content || "")}
                platform={previewContent.platform || "general"}
                hasMedia={!!(photoPreview || savedPhotoUrl)}
                hasVideo={false}
                onContentFix={(fixedContent) => {
                  setEditedContent(fixedContent);
                  if (!isEditing) {
                    setIsEditing(true);
                  }
                }}
                showGuidelines={false}
                className="mb-2"
              />
            </div>
          )}
          
          {/* Edit Controls */}
          {previewContent && (
            <div className="p-4 border-t bg-gray-50 dark:bg-gray-800">
              {!isEditing ? (
                <div className="flex items-center justify-between gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2"
                    data-testid="button-edit-post"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit
                  </Button>
                  
                  {/* Show Duplicate and Delete buttons only for API posts (actual scheduled posts) */}
                  {String(previewContent.id).startsWith('api-') && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          const apiPostId = String(previewContent.id).replace('api-', '');
                          const originalPost = apiScheduledPosts.find(p => p.id === apiPostId);
                          if (originalPost) {
                            duplicatePostMutation.mutate(originalPost);
                          }
                        }}
                        disabled={duplicatePostMutation.isPending}
                        className="flex items-center gap-2"
                        data-testid="button-duplicate-post"
                      >
                        <Plus className="h-4 w-4" />
                        {duplicatePostMutation.isPending ? 'Duplicating...' : 'Duplicate'}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          const apiPostId = String(previewContent.id).replace('api-', '');
                          setPostToDelete(apiPostId);
                          setShowDeleteConfirm(true);
                        }}
                        className="flex items-center gap-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                        data-testid="button-delete-post"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 w-full">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      setEditedContent(previewContent.content);
                      setPhotoPreview(savedPhotoUrl); // Restore to last saved photo
                    }}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm"
                    onClick={handleSaveEdit}
                    className="flex items-center gap-2"
                    data-testid="button-save-changes"
                  >
                    <Save className="h-4 w-4" />
                    Save Changes
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={(open) => {
        setShowDeleteConfirm(open);
        if (!open) {
          setIsBulkDelete(false);
          setIsDeleteAll(false);
          setPostToDelete(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isDeleteAll 
                ? "Delete All Scheduled Posts?"
                : isBulkDelete 
                  ? `Delete ${selectedPosts.size} Scheduled Posts?`
                  : "Delete Scheduled Post?"
              }
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isDeleteAll
                ? `Are you sure you want to delete all ${scheduledContent.filter(c => String(c.id).startsWith('api-')).length} scheduled posts? This action cannot be undone.`
                : isBulkDelete
                  ? `Are you sure you want to delete ${selectedPosts.size} scheduled posts? This action cannot be undone.`
                  : "Are you sure you want to delete this scheduled post? This action cannot be undone."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (isDeleteAll) {
                  bulkDeleteMutation.mutate({ deleteAll: true });
                } else if (isBulkDelete) {
                  bulkDeleteMutation.mutate({ ids: Array.from(selectedPosts) });
                } else if (postToDelete) {
                  deletePostMutation.mutate(postToDelete);
                }
                setShowDeleteConfirm(false);
                setPostToDelete(null);
              }}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              {isDeleteAll 
                ? "Delete All Posts"
                : isBulkDelete 
                  ? `Delete ${selectedPosts.size} Posts`
                  : "Delete Post"
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
