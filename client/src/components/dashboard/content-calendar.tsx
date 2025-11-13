import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Eye, Home, MoreHorizontal, Heart, MessageCircle, Send, Bookmark, Edit2, Save, Upload, Check, X } from "lucide-react";
import { FaFacebook, FaInstagram, FaLinkedin, FaYoutube } from "react-icons/fa";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
        description: "Highlight diverse Omaha neighborhoods",
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
        description: "Historic homes in Omaha area",
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
        description: "Green features in Omaha homes",
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
    content: "🏘️ Dundee Market Update - January 2025\n\nThe Dundee neighborhood continues to show strong market activity! Here's what we're seeing:\n\n📈 Average home price: $425,000 (+8% YoY)\n🏠 Days on market: 18 days\n📊 Inventory: 45 active listings\n\nDundee's historic charm and walkability make it one of Omaha's most desirable neighborhoods. Perfect for buyers seeking character homes with modern updates.\n\nLooking to buy or sell in Dundee? Let's chat about current opportunities!\n\n#OmahaRealEstate #DundeeNeighborhood #MarketUpdate",
  },
  {
    id: 2,
    title: "Property Showcase: Aksarben",
    type: "Social",
    date: new Date(2025, 0, 10), // January 10, 2025 (Friday)
    time: "2:00 PM",
    color: "bg-accent",
    platform: "Instagram",
    content: "✨ JUST LISTED in Aksarben Village! ✨\n\n🏡 4BR/3BA Contemporary Home\n💰 $485,000\n📍 Prime Aksarben location\n\n▫️ Open concept living\n▫️ Gourmet kitchen with granite counters\n▫️ Master suite with walk-in closet\n▫️ Private backyard oasis\n▫️ 2-car garage\n\nWalkable to shops, restaurants, and the new development! This won't last long in today's market.\n\nDM me for a private showing! 📲\n\n#AksarbenVillage #OmahaHomes #JustListed #RealEstateExpert",
  },
  {
    id: 3,
    title: "Home Buying Tips Video",
    type: "Video",
    date: new Date(2025, 0, 13), // January 13, 2025 (Monday)
    time: "9:00 AM",
    color: "bg-chart-3",
    platform: "YouTube",
    content: "🎥 First-Time Home Buyer Tips for Omaha Market\n\nIn this video, I share the essential steps every first-time buyer should know when purchasing in the Omaha metro area.\n\n📋 What's covered:\n• Pre-approval process and local lenders\n• Neighborhood selection guide\n• Inspection priorities in Omaha homes\n• Closing cost expectations\n• Market timing strategies\n\nAs your local Omaha expert, I've helped hundreds of first-time buyers navigate this exciting journey. Let me help you find your dream home!\n\n💬 Questions? Drop them in the comments below!\n\n#FirstTimeBuyer #OmahaRealEstate #HomeBuyingTips #RealEstateEducation",
  },
  {
    id: 4,
    title: "Weekend Open House",
    type: "Social",
    date: new Date(2025, 0, 18), // January 18, 2025 (Saturday)
    time: "11:00 AM",
    color: "bg-green-500",
    platform: "Facebook",
    content: "🏠 OPEN HOUSE THIS WEEKEND! 🏠\n\n📍 123 Maple Street, Benson\n⏰ Saturday & Sunday 1-4 PM\n💰 $385,000\n\n✨ Features:\n• 3BR/2BA Craftsman style\n• Updated kitchen & baths\n• Hardwood floors throughout\n• Large fenced backyard\n• Walking distance to shops\n\nPerfect starter home or investment property! See you there!\n\n#OpenHouse #BensonNeighborhood #OmahaRealEstate",
  },
  {
    id: 5,
    title: "Market Trends Analysis",
    type: "Blog",
    date: new Date(2025, 0, 24), // January 24, 2025 (Friday)
    time: "3:00 PM",
    color: "bg-indigo-500",
    platform: "LinkedIn",
    content: "📊 Omaha Real Estate Market Trends - January 2025\n\nAs we move through the first quarter, here's what we're seeing in the Omaha metro area:\n\n🏠 INVENTORY: Up 12% from last month\n💰 MEDIAN PRICE: $425K (+6% YoY)\n📈 SALES VOLUME: Strong activity despite winter\n⏱️ DAYS ON MARKET: Averaging 22 days\n\nKey insights for buyers and sellers:\n• Inventory increasing gives buyers more options\n• Interest rates stabilizing around 6.8%\n• Spring market prep should start now\n\nThinking of making a move? Let's discuss your strategy.\n\n#OmahaRealEstate #MarketTrends #RealEstateExpert",
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
  const { toast } = useToast();

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

  const generateContentPlanMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/content/generate-plan', {
        targetAudience: 'home buyers and sellers',
        specialties: [],
      });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
      toast({
        title: "Content Plan Generated!",
        description: `Successfully created ${data.posts?.length || 30}-day content calendar`,
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
  
  const handlePhotoComplete = (result: any) => {
    if (result.successful && result.successful[0]) {
      const uploadedUrl = result.successful[0].uploadURL;
      setPhotoPreview(uploadedUrl);
      toast({
        title: "Photo Uploaded",
        description: "Your property photo has been uploaded successfully",
      });
    }
  };
  
  const handleSaveEdit = () => {
    if (previewContent) {
      // Save the photo URL to the content
      setSavedPhotoUrl(photoPreview);
    }
    
    // In a real app, this would save to backend
    toast({
      title: "Content Updated", 
      description: "Your content changes have been saved",
    });
    setIsEditing(false);
  };
  
  const handleAIScheduling = async () => {
    setIsGenerating(true);
    
    try {
      // Fetch SEO keywords and market data for intelligent scheduling
      const [keywordsResponse, marketResponse] = await Promise.all([
        fetch('/api/seo/keywords'),
        fetch('/api/market/data')
      ]);
      
      const keywords = await keywordsResponse.json();
      const marketData = await marketResponse.json();
      
      // Generate AI-optimized content schedule
      const response = await fetch('/api/ai/schedule-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keywords: keywords.slice(0, 5), // Top 5 keywords
          marketData: marketData.slice(0, 3), // Top 3 market trends
          timeframe: '30-days',
          focus: 'high-impact',
          prompt: 'You are a Luxury real estate agent. Create a month worth social media posts. Optimize what days are best for each platform.'
        }),
      });
      
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
          content: item.content || 'AI generated content'
        };
      });
      
      // Add new content to existing schedule
      setScheduledContent(prev => [...prev, ...newContent]);
      
      toast({
        title: "🤖 AI Content Scheduled!",
        description: `Generated ${aiSchedule.contentCount} optimized posts and added them to your calendar.`,
      });
      
    } catch (error) {
      console.error('AI scheduling error:', error);
      toast({
        title: "AI Scheduling Error",
        description: "Failed to generate optimized schedule. Please try again.",
        variant: "destructive"
      });
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
      default: return FaFacebook;
    }
  };
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Content Calendar</CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => generateContentPlanMutation.mutate()}
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
                  Generate 30-Day Plan
                </>
              )}
            </Button>
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
            <div className="flex items-center justify-between mb-4">
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
            </div>
            
            {/* Calendar Header */}
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {calendarDays.map((day) => (
                <div key={day} className="text-xs font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {calendarGrid.map((week, weekIndex) => 
                week.map((day, dayIndex) => {
                  const dayContent = getContentForDate(day.fullDate);
                  const holiday = getHolidayForDate(day.fullDate);
                  
                  return (
                    <div
                      key={`${weekIndex}-${dayIndex}`}
                      className={`
                        relative min-h-[80px] p-1 border rounded-sm
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
                      
                      {/* Holiday Recommendations */}
                      {holiday && (
                        <div className="space-y-1 mb-1">
                          {holiday.recommendations.map((rec, index) => (
                            <div
                              key={index}
                              className={`text-xs p-1 rounded ${rec.color} text-white cursor-pointer hover:opacity-80`}
                              title={`${holiday.holiday}: ${rec.description}`}
                            >
                              {rec.type}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Scheduled Content */}
                      {dayContent.map((content) => (
                        <div
                          key={content.id}
                          className={`text-xs p-1.5 rounded ${content.color} text-white cursor-pointer hover:opacity-80 mb-1 overflow-hidden`}
                          onClick={() => handlePreview(content)}
                          title={`${content.title} - ${content.time}\n${content.content?.substring(0, 100)}`}
                        >
                          <div className="font-semibold truncate text-[11px]">{content.title}</div>
                          <div className="text-[10px] opacity-80 truncate mt-0.5">{content.platform} • {content.time}</div>
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Upcoming Content */}
          <div className="mt-6">
            <h3 className="text-sm font-medium text-foreground mb-3">This Week's Content</h3>
            <div className="space-y-3">
              {scheduledContent.map((content) => (
                <div key={content.id} className="flex items-center space-x-3" data-testid={`content-item-${content.id}`}>
                  <div className={`w-2 h-2 ${content.color} rounded-full`}></div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground">{content.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {content.type} • {format(content.date, "MMM d")} {content.time}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handlePreview(content)}
                    data-testid={`button-preview-${content.id}`}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
      
      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Content Preview</DialogTitle>
          </DialogHeader>
          {previewContent && (
            <div>
              {/* Facebook Preview */}
              {previewContent.platform === 'Facebook' && (
                <div className="bg-white text-black">
                  <div className="flex items-center gap-3 p-3">
                    <div className="w-10 h-10 bg-golden-accent rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-golden-foreground">MB</span>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">Mike Bjork</div>
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
                      <Textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="text-sm mb-3 min-h-[100px] resize-none"
                        placeholder="Edit your content..."
                      />
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
                        <div className="text-xs text-gray-500">Omaha, Nebraska</div>
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
                          <Textarea
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            className="text-sm mt-2 min-h-[80px] resize-none w-full"
                            placeholder="Edit your caption..."
                          />
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
                      <div className="font-semibold text-sm">Mike Bjork Real Estate</div>
                      <div className="text-xs text-gray-500">Omaha Real Estate Expert</div>
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
                      <Textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="text-xs text-gray-600 min-h-[60px] resize-none"
                        placeholder="Edit video description..."
                      />
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
                      <div className="font-semibold text-sm">Mike Bjork</div>
                      <div className="text-xs text-gray-500">Real Estate Professional at BHHS</div>
                      <div className="text-xs text-gray-400">
                        {format(new Date(), "MMM d, h:mm a")}
                      </div>
                    </div>
                  </div>
                  {isEditing ? (
                    <Textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="text-sm mb-3 min-h-[100px] resize-none"
                      placeholder="Edit your content..."
                    />
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
                      <div className="font-semibold text-sm">Mike Bjork</div>
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
          
          {/* Edit Controls */}
          {previewContent && (
            <div className="p-4 border-t bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
              {!isEditing ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit
                </Button>
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
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm"
                    onClick={handleSaveEdit}
                    className="flex items-center gap-2"
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
    </Card>
  );
}
