import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { PropertySelector } from "./property-selector";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ObjectUploader } from "@/components/ObjectUploader";
import {
  Facebook,
  Instagram,
  Linkedin,
  Twitter as X,
  Image,
  Calendar,
  Sparkles,
  Home,
  Tag,
  CheckCircle,
  TrendingDown,
  Eye,
  Upload,
  ImageIcon,
  CreditCard,
  Brain,
  Music,
  Video,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
};

const postTypes = [
  {
    id: "open_houses",
    label: "Open Houses",
    icon: Home,
    color: "text-orange-600",
    bgColor: "bg-orange-600/10",
  },
  {
    id: "just_listed",
    label: "Just Listed",
    icon: Tag,
    color: "text-blue-600",
    bgColor: "bg-blue-600/10",
  },
  {
    id: "just_sold",
    label: "Just Sold",
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-600/10",
  },
  {
    id: "price_improvement",
    label: "Price Decrease",
    icon: TrendingDown,
    color: "text-purple-600",
    bgColor: "bg-purple-600/10",
  },
  {
    id: "e_card",
    label: "E-Card",
    icon: CreditCard,
    color: "text-teal-600",
    bgColor: "bg-teal-600/10",
  },
  {
    id: "create_your_own",
    label: "Custom",
    icon: Upload,
    color: "text-indigo-600",
    bgColor: "bg-indigo-600/10",
  },
];

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

export function SocialMediaManager() {
  const [postContent, setPostContent] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedPostType, setSelectedPostType] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null
  );
  const [showPreview, setShowPreview] = useState(false);
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [photoUploadMode, setPhotoUploadMode] = useState<
    "upload" | "stock" | "ai"
  >("upload");
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [facebookPages, setFacebookPages] = useState<any[]>([]);
  const [selectedFacebookPage, setSelectedFacebookPage] = useState<string>("");
  const [uploadedVideo, setUploadedVideo] = useState<File | null>(null);
  const [videoUploadUrl, setVideoUploadUrl] = useState<string | null>(null);
  const [showVideoUpload, setShowVideoUpload] = useState(false);
  const { toast } = useToast();

  const { data: accounts, isLoading } = useQuery<SocialMediaAccount[]>({
    queryKey: ["/api/social/accounts"],
  });

  // Load Facebook pages when component mounts
  useEffect(() => {
    const loadFacebookPages = async () => {
      try {
        const response = await fetch("/api/facebook/pages");
        if (response.ok) {
          const pages = await response.json();
          setFacebookPages(pages);
        }
      } catch (error) {
        console.log("No Facebook pages available");
      }
    };
    loadFacebookPages();
  }, []);

  // Automatically pull MLS photos when a property is selected
  useEffect(() => {
    if (
      selectedProperty &&
      selectedProperty.photoUrls &&
      selectedProperty.photoUrls.length > 0
    ) {
      // Use the first MLS photo from the property
      const mlsPhoto = selectedProperty.photoUrls[0];
      setUploadedPhoto(mlsPhoto);

      toast({
        title: "MLS Photo Added",
        description: `Automatically added photo from ${selectedProperty.address}`,
      });
    }
  }, [selectedProperty]);

  // Handle YouTube posting with on-demand authentication
  const handleYouTubePost = async (content: string, videoFile?: File) => {
    try {
      // Check if we have a stored YouTube access token
      const youtubeAccount = accounts?.find(
        (account) => account.platform === "youtube"
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
        formData.append(
          "accessToken",
          (youtubeAccount as any).accessToken || ""
        );

        const response = await fetch("/api/youtube/upload-video", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || "Failed to upload video to YouTube"
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
    mutationFn: async (data: { content: string; platforms: string[] }) => {
      // Check if YouTube is selected and handle on-demand authentication
      if (data.platforms.includes("youtube")) {
        return await handleYouTubePost(
          data.content,
          uploadedVideo || undefined
        );
      }

      // Handle other platform-specific posting
      if (data.platforms.includes("facebook")) {
        // Use Facebook Pages API for Facebook posting
        const facebookResponse = await apiRequest(
          "POST",
          "/api/facebook/post",
          {
            content: data.content,
            pageId: "61581294927027", // Golden Brick page ID
          }
        );
        return facebookResponse.json();
      } else if (data.platforms.includes("instagram")) {
        // Use Instagram Graph API for Instagram posting
        const instagramResponse = await apiRequest(
          "POST",
          "/api/instagram/post",
          {
            content: data.content,
            // Instagram User ID will be read from environment variables
          }
        );
        return instagramResponse.json();
      } else if (
        data.platforms.includes("x") ||
        data.platforms.includes("twitter")
      ) {
        // Use Twitter API for Twitter posting
        const twitterResponse = await apiRequest("POST", "/api/twitter/post", {
          content: data.content,
        });
        return twitterResponse.json();
      } else {
        // For other platforms, use the general endpoint
        const response = await apiRequest("POST", "/api/social/post", data);
        return response.json();
      }
    },
    onSuccess: () => {
      toast({
        title: "Posted Successfully!",
        description: "Your content has been shared across selected platforms",
      });
      setPostContent("");
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
      toast({
        title: "Facebook Post Successful!",
        description:
          data.message ||
          "Your content has been posted to Facebook successfully.",
      });
      setPostContent("");
      setUploadedPhoto(null);
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
    mutationFn: async (data: { topic: string; platform: string }) => {
      const response = await apiRequest(
        "POST",
        "/api/content/social-post",
        data
      );
      return response.json();
    },
    onSuccess: (data) => {
      setPostContent(
        data.content +
          (data.hashtags
            ? " " + data.hashtags.map((tag: string) => "#" + tag).join(" ")
            : "")
      );
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
    platform: string
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

Contact Mike Bjork at Berkshire Hathaway HomeServices for more information!

#JustListed #OmahaRealEstate #MikeBjork #BHHS ${
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

#JustListed #OmahaHomes #RealEstate #MikeBjork ${
          neighborhoodTag ? `#${neighborhoodTag}` : ""
        }`,

        x: `🏠 JUST LISTED!\n\n${property.address}\n${formatPrice(
          property.listPrice
        )}\n${property.bedrooms}BD ${
          property.bathrooms
        }BA\n\n${property.description.substring(
          0,
          100
        )}...\n\nContact Mike Bjork for details!\n\n#JustListed #OmahaRealEstate`,

        youtube: `🏠 NEW LISTING: ${property.address} | ${formatPrice(
          property.listPrice
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
          property.listPrice
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

I'm Mike Bjork with Berkshire Hathaway HomeServices, and I'd love to show you this amazing property. Call or text me today to schedule your private showing!

#JustListed #OmahaRealEstate #${
          property.neighborhood
            ? property.neighborhood.replace(/\s+/g, "")
            : "OmahaHomes"
        } #MikeBjork #BerkshireHathaway #RealEstate #HomeTour`,
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

Mike Bjork | Berkshire Hathaway HomeServices

#JustSold #OmahaRealEstate #MikeBjork #BHHS #RealEstateSuccess`,

        instagram: `✅ SOLD! 

${property.address}

Another happy client! 🙌

${
  property.neighborhood
    ? `${property.neighborhood} market staying strong! 💪`
    : ""
}

Ready to make your move? Let's chat! 📞

#Sold #OmahaRealEstate #MikeBjork #RealEstateSuccess`,

        x: `✅ SOLD!\n\n${
          property.address
        }\n\nAnother successful closing! 🎉\n\n${
          property.neighborhood ? `${property.neighborhood} market strong!` : ""
        }\n\nMike Bjork | BHHS\n\n#JustSold #OmahaRealEstate`,

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

Mike Bjork | Berkshire Hathaway HomeServices

#JustSold #OmahaRealEstate #${
          property.neighborhood
            ? property.neighborhood.replace(/\s+/g, "")
            : "OmahaHomes"
        } #MikeBjork #BerkshireHathaway #RealEstateSuccess #SoldHomes`,
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

Contact Mike Bjork at Berkshire Hathaway HomeServices today!

#PriceImprovement #OmahaRealEstate #MikeBjork #BHHS #Opportunity`,

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
          property.listPrice
        )}!\n\n${property.bedrooms}BD ${property.bathrooms}BA\n\n${
          property.neighborhood
            ? `${property.neighborhood} opportunity!`
            : "Great opportunity!"
        }\n\nMike Bjork | BHHS\n\n#PriceImprovement`,

        youtube: `💰 PRICE IMPROVEMENT! ${property.address} | Now ${formatPrice(
          property.listPrice
        )}

Exciting news! This beautiful ${property.bedrooms} bedroom, ${
          property.bathrooms
        } bathroom home just had a strategic price adjustment, making it an even better value for buyers!

${property.description.substring(0, 300)}

What makes this price improvement significant:
• Reflects current market conditions  
• Creates opportunity for serious buyers
• Perfect timing for today's market

Don't wait on this opportunity! Contact Mike Bjork at Berkshire Hathaway HomeServices today.

#PriceImprovement #OmahaRealEstate #MikeBjork #RealEstateOpportunity`,
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

Mike Bjork | Berkshire Hathaway HomeServices

#OpenHouse #OmahaRealEstate #MikeBjork #WeekendViewing`,

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
        }\n\nMike Bjork | BHHS\n\n#OpenHouse`,

        youtube: `🏠 OPEN HOUSE THIS WEEKEND! ${property.address}

Join me Saturday & Sunday, 1:00 PM - 4:00 PM for an exclusive tour of this stunning ${
          property.bedrooms
        } bedroom, ${property.bathrooms} bathroom home!

Price: ${formatPrice(property.listPrice)}

${property.description.substring(0, 300)}

No appointment necessary - just stop by! I'll be there to answer questions and show you everything this wonderful home has to offer.

Can't make the open house? Call or text me to schedule a private showing at your convenience.

Mike Bjork | Berkshire Hathaway HomeServices

#OpenHouse #WeekendViewing #OmahaRealEstate #MikeBjork #HomeTour`,
      },
    };

    const postTypeTemplates = templates[postType as keyof typeof templates];
    if (postTypeTemplates && platform in postTypeTemplates) {
      return postTypeTemplates[platform as keyof typeof postTypeTemplates];
    }

    return `Check out this amazing property at ${
      property.address
    }! ${formatPrice(property.listPrice)} | Contact Mike Bjork for details.`;
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
        primaryPlatform
      );
    }

    if (!content) {
      toast({
        title: "Content Required",
        description:
          "Please enter content to post or select a property with post type",
        variant: "destructive",
      });
      return;
    }

    if (selectedPlatforms.length === 0) {
      toast({
        title: "Select Platforms",
        description: "Please select at least one platform to post to",
        variant: "destructive",
      });
      return;
    }

    postMutation.mutate({
      content,
      platforms: selectedPlatforms,
    });
  };

  const handlePlatformToggle = (platform: string, isConnected: boolean) => {
    if (!isConnected) return;

    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
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
          Social Media Manager
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Platform Selection */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">
            Select Platforms
          </h3>
          {accounts?.map((account) => {
            const platformInfo =
              platformIcons[account.platform as keyof typeof platformIcons];
            if (!platformInfo) return null;

            return (
              <div
                key={account.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={selectedPlatforms.includes(account.platform)}
                    onCheckedChange={(checked) =>
                      handlePlatformToggle(
                        account.platform,
                        account.isConnected
                      )
                    }
                    disabled={!account.isConnected}
                    className="h-5 w-5 bg-[#2d4450] text-[#304652]"
                    data-testid={`checkbox-${account.platform}`}
                  />
                  <platformInfo.icon
                    className={`h-4 w-4 ${platformInfo.color}`}
                  />
                  <span className="text-sm font-medium capitalize">
                    {account.platform}
                  </span>
                </div>
                <Badge
                  variant={account.isConnected ? "secondary" : "destructive"}
                  className={
                    account.isConnected
                      ? "bg-green-100 text-green-700 border-green-200"
                      : "bg-red-100 text-red-700 border-red-200"
                  }
                  data-testid={`status-${account.platform}`}
                >
                  {account.isConnected ? "Connected" : "Disconnected"}
                </Badge>
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
                <div className="flex items-center gap-2 text-xs text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  Video ready: {uploadedVideo.name}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Post */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Quick Post</h3>
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
          </div>

          {/* Property Selector */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Property Listing (Optional)
            </div>
            <PropertySelector
              onSelectProperty={setSelectedProperty}
              selectedProperty={selectedProperty}
            />
          </div>

          {/* Post Type Selection */}
          <div className="space-y-2">
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

                    // Show photo upload for "Create Your Own"
                    if (type.id === "create_your_own" && newType) {
                      setShowPhotoUpload(true);
                    }

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
                        primaryPlatform
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
          </div>

          <Textarea
            placeholder={
              selectedPostType
                ? `Enter details for ${postTypes
                    .find((t) => t.id === selectedPostType)
                    ?.label.toLowerCase()} post (address, price, features, etc.)...`
                : "Share market insights, property highlights, or select a post type above and click AI Optimize..."
            }
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            className="min-h-[100px]"
            data-testid="textarea-social-post"
          />

          {/* Optional AI Prompt Enhancement */}
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

          {selectedPlatforms.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Posting to:{" "}
              {selectedPlatforms
                .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                .join(", ")}
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
                    disabled={!postContent.trim()}
                    data-testid="button-preview-post"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
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
                            MB
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm text-foreground">
                            Mike Bjork
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">
                            Bjork Group at BHHS
                          </div>
                          <div className="text-sm text-foreground whitespace-pre-wrap">
                            {postContent}
                          </div>
                          {uploadedPhoto && (
                            <div className="mt-3 border rounded-lg overflow-hidden">
                              <img
                                src={uploadedPhoto}
                                alt="Post attachment"
                                className="w-full h-48 object-cover"
                              />
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
                </DialogContent>
              </Dialog>
              <Button
                variant="ghost"
                size="icon"
                className={`relative ${
                  uploadedPhoto
                    ? "text-green-600 hover:text-green-700"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setShowPhotoUpload(true)}
                data-testid="button-add-photo"
              >
                <Image className="h-4 w-4" />
                {uploadedPhoto && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></div>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                data-testid="button-schedule"
              >
                <Calendar className="h-4 w-4" />
              </Button>
            </div>
            <Button
              onClick={handlePost}
              disabled={
                postMutation.isPending || selectedPlatforms.length === 0
              }
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-post-now"
            >
              {postMutation.isPending ? "Posting..." : "Post Now"}
            </Button>
          </div>
        </div>

        {/* Upcoming Posts */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3">
            Scheduled Posts
          </h3>
          <div className="space-y-2">
            {scheduledPosts.map((post) => (
              <div
                key={post.id}
                className="p-3 bg-muted rounded-md"
                data-testid={`scheduled-post-${post.id}`}
              >
                <p className="text-sm text-foreground">"{post.content}"</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {post.date} • {post.platforms}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>

      {/* Photo Upload Dialog for Create Your Own */}
      <Dialog open={showPhotoUpload} onOpenChange={setShowPhotoUpload}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Photo to Your Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a photo to make your social media post more engaging. This
              photo will be included with your post content.
            </p>

            {uploadedPhoto ? (
              <div className="space-y-3">
                <div className="border rounded-lg overflow-hidden">
                  <img
                    src={uploadedPhoto}
                    alt="Selected photo"
                    className="w-full h-48 object-cover"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-green-600 font-medium">
                    Photo selected successfully!
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUploadedPhoto(null)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <Tabs
                value={photoUploadMode}
                onValueChange={(value) =>
                  setPhotoUploadMode(value as "upload" | "stock" | "ai")
                }
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="upload">Upload Photo</TabsTrigger>
                  <TabsTrigger value="stock">Stock Photos</TabsTrigger>
                  <TabsTrigger value="ai">AI Image</TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="space-y-4">
                  <ObjectUploader
                    maxNumberOfFiles={1}
                    maxFileSize={10485760}
                    onGetUploadParameters={async () => {
                      const response = await apiRequest(
                        "POST",
                        "/api/objects/upload",
                        {}
                      );
                      const data = await response.json();
                      return {
                        method: "PUT" as const,
                        url: data.uploadURL,
                      };
                    }}
                    onComplete={(uploadedFileUrl: string) => {
                      // Convert Google Cloud Storage URL to local /objects/ endpoint
                      const fileName = uploadedFileUrl.split("/").pop();
                      const localImageUrl = `/objects/${fileName}`;
                      setUploadedPhoto(localImageUrl);
                      toast({
                        title: "Photo Uploaded",
                        description:
                          "Your photo is ready to be included in your post",
                      });
                    }}
                    buttonClassName="w-full"
                  >
                    <div className="flex items-center justify-center gap-2 py-8">
                      <Upload className="h-5 w-5" />
                      <span>Choose Photo</span>
                    </div>
                  </ObjectUploader>
                </TabsContent>

                <TabsContent value="stock" className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                    {stockPhotos.map((photo) => (
                      <div
                        key={photo.id}
                        className="relative cursor-pointer border rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                        onClick={() => {
                          setUploadedPhoto(photo.url);
                          toast({
                            title: "Stock Photo Selected",
                            description: `"${photo.title}" is ready to be included in your post`,
                          });
                        }}
                      >
                        <img
                          src={photo.url}
                          alt={photo.title}
                          className="w-full h-24 object-cover"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-1">
                          <p className="text-xs truncate">{photo.title}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="ai" className="space-y-4">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label
                        htmlFor="ai-prompt"
                        className="text-sm font-medium"
                      >
                        Describe the image you want to generate
                      </Label>
                      <Input
                        id="ai-prompt"
                        placeholder="e.g., Modern luxury home with golden accents at sunset"
                        className="w-full"
                      />
                    </div>

                    <Button
                      className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                      onClick={() => {
                        toast({
                          title: "AI Image Generation",
                          description:
                            "This feature will generate custom images using AI. Coming soon!",
                        });
                      }}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate AI Image
                    </Button>

                    <div className="text-xs text-muted-foreground text-center">
                      AI will create a custom image based on your description,
                      perfectly tailored for your social media post.
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowPhotoUpload(false);
                  if (
                    selectedPostType === "create_your_own" &&
                    !uploadedPhoto
                  ) {
                    setSelectedPostType(null);
                  }
                }}
              >
                {uploadedPhoto ? "Continue" : "Skip Photo"}
              </Button>
              {uploadedPhoto && (
                <Button
                  className="flex-1"
                  onClick={() => setShowPhotoUpload(false)}
                >
                  Use This Photo
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                      // Check file size (YouTube max is 256GB, but we'll limit to 100MB for demo)
                      if (file.size > 100 * 1024 * 1024) {
                        toast({
                          title: "File Too Large",
                          description:
                            "Please select a video smaller than 100MB",
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
                  Supported formats: MP4, MOV, AVI, WMV, FLV, WebM (max 100MB)
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
    </Card>
  );
}
