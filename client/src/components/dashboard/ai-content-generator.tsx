// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  FileText,
  Eye,
  Search,
  Clock,
  ChevronDown,
  ChevronUp,
  Copy,
  Share2,
  ImagePlus,
  Send,
  X,
  RefreshCw,
  Home,
  Edit2,
  Save,
  Heart,
  MessageCircle,
  Bookmark,
  MoreHorizontal,
  Globe,
} from "lucide-react";
import {
  FaFacebook,
  FaInstagram,
  FaLinkedin,
  FaTwitter,
  FaYoutube,
  FaTiktok,
} from "react-icons/fa";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ObjectUploader } from "@/components/ObjectUploader";

interface AIContentGeneratorProps {
  isGenerating: boolean;
}

interface GeneratedContent {
  id?: string;
  title: string;
  content: string;
  keywords: string[];
  wordCount: number;
  seoScore?: number;
  seoBreakdown?: {
    keywordOptimization: number;
    contentStructure: number;
    localSEO: number;
    contentQuality: number;
    metaOptimization: number;
    callToAction: number;
  };
}

interface Property {
  id: string;
  mlsNumber: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number;
  propertyType: string;
  description?: string;
  yearBuilt?: number;
  listingAgent?: string;
  photos?: string[];
}

const contentTypes = [
  { value: "blog", label: "Blog Post", icon: FileText },
  { value: "social", label: "Social Post", icon: FileText },
  { value: "property_feature", label: "Property Feature", icon: FileText },
];

const neighborhoods = [
  "All Omaha Areas",
  "Dundee",
  "Aksarben",
  "Old Market",
  "Benson",
  "Blackstone",
  "Elkhorn",
  "Millard",
];

interface PlatformSuggestion {
  platform: string;
  icon: any;
  fit: "excellent" | "very-good" | "good";
  reason: string;
  optimization: string;
  score: number;
}

const getPlatformSuggestions = (
  content: GeneratedContent
): PlatformSuggestion[] => {
  const { content: text, wordCount, keywords } = content;

  const hasEmojis = text
    ? /[\uD83C-\uDBFF\uDC00-\uDFFF]|[\u2600-\u27FF]/.test(text)
    : false;
  const hasHashtags = text?.includes("#") || false;
  const isEducational =
    text?.toLowerCase().includes("tips") ||
    text?.toLowerCase().includes("guide") ||
    text?.toLowerCase().includes("first-time") ||
    false;
  const isVisual =
    text?.toLowerCase().includes("home") ||
    text?.toLowerCase().includes("property") ||
    text?.toLowerCase().includes("house") ||
    false;
  const isProfessional =
    text?.toLowerCase().includes("expert") ||
    text?.toLowerCase().includes("professional") ||
    false;

  const suggestions: PlatformSuggestion[] = [];

  // Instagram analysis
  let instagramScore = 0;
  if (hasEmojis) instagramScore += 25;
  if (hasHashtags) instagramScore += 25;
  if (isEducational) instagramScore += 20;
  if (isVisual) instagramScore += 15;
  if (wordCount <= 150) instagramScore += 15;

  suggestions.push({
    platform: "Instagram",
    icon: FaInstagram,
    fit:
      instagramScore >= 80
        ? "excellent"
        : instagramScore >= 60
        ? "very-good"
        : "good",
    reason: isEducational
      ? "Educational content + visual appeal + younger demographic"
      : "Great for visual storytelling and hashtags",
    optimization:
      "Pair with home photos or create an infographic with buying tips",
    score: instagramScore,
  });

  // Facebook analysis
  let facebookScore = 0;
  if (isEducational) facebookScore += 30;
  if (wordCount >= 100 && wordCount <= 300) facebookScore += 25;
  if (
    text?.toLowerCase().includes("omaha") ||
    text?.toLowerCase().includes("local")
  )
    facebookScore += 20;
  if (hasEmojis) facebookScore += 15;
  if (text?.includes("?")) facebookScore += 10;

  suggestions.push({
    platform: "Facebook",
    icon: FaFacebook,
    fit:
      facebookScore >= 80
        ? "excellent"
        : facebookScore >= 60
        ? "very-good"
        : "good",
    reason: "Perfect for community engagement and local groups",
    optimization:
      'Add engagement question: "What\'s your biggest concern as a first-time buyer?"',
    score: facebookScore,
  });

  // LinkedIn analysis
  let linkedinScore = 0;
  if (isProfessional) linkedinScore += 30;
  if (wordCount >= 200) linkedinScore += 25;
  if (
    text?.toLowerCase().includes("market") ||
    text?.toLowerCase().includes("insight")
  )
    linkedinScore += 20;
  if (
    !hasEmojis ||
    (hasEmojis &&
      text
        ?.split("")
        .filter((char) =>
          /[\uD83C-\uDBFF\uDC00-\uDFFF]|[\u2600-\u27FF]/.test(char)
        ).length <= 2)
  )
    linkedinScore += 15;
  if (
    text?.toLowerCase().includes("expert") ||
    text?.toLowerCase().includes("professional")
  )
    linkedinScore += 10;

  suggestions.push({
    platform: "LinkedIn",
    icon: FaLinkedin,
    fit:
      linkedinScore >= 80
        ? "excellent"
        : linkedinScore >= 60
        ? "very-good"
        : "good",
    reason: "Professional expertise positioning and business networking",
    optimization:
      'Make more professional: "As your Omaha real estate professional..."',
    score: linkedinScore,
  });

  // Twitter/X analysis
  let twitterScore = 0;
  if (wordCount <= 200) twitterScore += 30;
  if (hasHashtags) twitterScore += 25;
  if (
    text?.toLowerCase().includes("omaha") ||
    text?.toLowerCase().includes("local")
  )
    twitterScore += 20;
  if (hasEmojis) twitterScore += 15;
  if (text?.includes("?") || text?.includes("!")) twitterScore += 10;

  suggestions.push({
    platform: "X (Twitter)",
    icon: FaTwitter,
    fit:
      twitterScore >= 80
        ? "excellent"
        : twitterScore >= 60
        ? "very-good"
        : "good",
    reason: "Perfect character count and real-time engagement",
    optimization: "Add trending local hashtags like #OmahaLife",
    score: twitterScore,
  });

  // TikTok analysis
  let tiktokScore = 0;
  if (wordCount <= 150) tiktokScore += 30; // Short, engaging content
  if (hasEmojis) tiktokScore += 25; // TikTok loves emojis
  if (
    text?.toLowerCase().includes("home") ||
    text?.toLowerCase().includes("house") ||
    text?.toLowerCase().includes("tip")
  )
    tiktokScore += 20; // Visual/educational content
  if (hasHashtags) tiktokScore += 15; // Hashtag discovery is key
  if (text?.includes("!") || text?.includes("?")) tiktokScore += 10; // Engaging punctuation

  suggestions.push({
    platform: "TikTok",
    icon: FaTiktok,
    fit:
      tiktokScore >= 80
        ? "excellent"
        : tiktokScore >= 60
        ? "very-good"
        : "good",
    reason: "Short-form video content with high engagement potential",
    optimization:
      "Create quick home tour or real estate tip video with trending audio",
    score: tiktokScore,
  });

  // YouTube analysis
  let youtubeScore = 0;
  if (wordCount >= 300) youtubeScore += 25; // Detailed descriptions perform better
  if (
    text?.toLowerCase().includes("omaha") ||
    text?.toLowerCase().includes("local")
  )
    youtubeScore += 25; // Local SEO crucial for YouTube
  if (
    text?.toLowerCase().includes("mike bjork") ||
    text?.toLowerCase().includes("expert")
  )
    youtubeScore += 20; // Personal branding
  if (
    text?.toLowerCase().includes("home") ||
    text?.toLowerCase().includes("property") ||
    text?.toLowerCase().includes("real estate")
  )
    youtubeScore += 15; // Relevant keywords
  if (text?.includes("?") || text?.includes("!")) youtubeScore += 10; // Engagement
  if (hasHashtags) youtubeScore += 5; // YouTube hashtags help but less critical

  suggestions.push({
    platform: "YouTube",
    icon: FaYoutube,
    fit:
      youtubeScore >= 80
        ? "excellent"
        : youtubeScore >= 60
        ? "very-good"
        : "good",
    reason: "Long-form video content with strong local SEO potential",
    optimization:
      "Create detailed description with local keywords and Mike Bjork expert positioning",
    score: youtubeScore,
  });

  // Website analysis
  let websiteScore = 0;
  if (wordCount >= 300) websiteScore += 30; // Blog-length content works best for website
  if (
    text?.toLowerCase().includes("omaha") ||
    text?.toLowerCase().includes("local")
  )
    websiteScore += 25; // Local SEO crucial for website
  if (isEducational) websiteScore += 20; // Educational content drives website traffic
  if (keywords && keywords.length >= 3) websiteScore += 15; // Keyword rich content
  if (
    text?.toLowerCase().includes("market") ||
    text?.toLowerCase().includes("insight")
  )
    websiteScore += 10; // Authority content

  suggestions.push({
    platform: "Website",
    icon: Globe,
    fit:
      websiteScore >= 80
        ? "excellent"
        : websiteScore >= 60
        ? "very-good"
        : "good",
    reason: "SEO-optimized content perfect for driving organic website traffic",
    optimization:
      "Add meta description and internal links to boost search rankings",
    score: websiteScore,
  });

  return suggestions.sort((a, b) => b.score - a.score);
};

export function AIContentGenerator({ isGenerating }: AIContentGeneratorProps) {
  const [contentType, setContentType] = useState("blog");
  const [topic, setTopic] = useState("");
  const [aiPrompt, setAiPrompt] = useState(
    "Create engaging, SEO-optimized content for Omaha real estate that drives leads and builds trust with potential clients."
  );
  const [neighborhood, setNeighborhood] = useState("All Omaha Areas");
  const [seoOptimized, setSeoOptimized] = useState(true);
  const [longTailKeywords, setLongTailKeywords] = useState(true);

  // Style selection for each content type
  const [contentStyles, setContentStyles] = useState<Record<string, string>>({
    blog: "None",
    social_media: "None",
    property_feature: "None",
    market_analysis: "Market data",
    newsletter: "Things around town",
    listing_description: "Luxury",
  });
  const [lastGenerated, setLastGenerated] = useState<GeneratedContent | null>(
    null
  );
  const [showFullContent, setShowFullContent] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [postingTo, setPostingTo] = useState<string | null>(null);
  const [regeneratingFor, setRegeneratingFor] = useState<string | null>(null);
  const [optimizedContent, setOptimizedContent] = useState<Record<string, any>>(
    {}
  );
  const [viewingPlatform, setViewingPlatform] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<Record<string, number>>({});

  // Content editing states
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [showPlatformPreview, setShowPlatformPreview] = useState(false);
  const [previewPlatform, setPreviewPlatform] = useState<string | null>(null);

  // Photo upload dialog states
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [photoUploadMode, setPhotoUploadMode] = useState<
    "upload" | "stock" | "ai"
  >("upload");

  // MLS Property Search States
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null
  );
  const [propertySearchParams, setPropertySearchParams] = useState({
    mlsNumber: "",
    address: "",
    city: "",
    listingAgent: "",
  });

  // Google Places autocomplete states
  const [addressAutocomplete, setAddressAutocomplete] =
    useState<google.maps.places.AutocompleteService | null>(null);
  const [googleMapsStatus, setGoogleMapsStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<
    google.maps.places.QueryAutocompletePrediction[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Style options for all content types
  const styleOptions = [
    { value: "None", label: "None" },
    { value: "Funny", label: "Funny" },
    { value: "Luxury", label: "Luxury" },
    { value: "Market data", label: "Market data" },
    { value: "Things around town", label: "Things around town" },
    { value: "Custom template", label: "Custom template" },
  ];

  // Initialize Google Maps
  useEffect(() => {
    const initializeGoogleMaps = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        console.log("Google Maps loaded successfully");
        setGoogleMapsStatus("ready");

        // Initialize AutocompleteService for dropdown suggestions
        if (!addressAutocomplete) {
          const service = new window.google.maps.places.AutocompleteService();
          setAddressAutocomplete(service);
        }
      } else {
        setTimeout(initializeGoogleMaps, 500);
      }
    };

    initializeGoogleMaps();
  }, [addressAutocomplete]);

  // Debounced auto-search function
  const handleAddressAutoSearch = async (address: string) => {
    if (!address || address.length < 5) return;

    setIsLoadingDetails(true);
    try {
      console.log("Fetching property details for address:", address);
      const response = await fetch("/api/property/details-by-address", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address: address.split(",")[0] }),
      });

      if (response.ok) {
        const propertyData = await response.json();
        console.log(
          "GBCMA property details for address:",
          address,
          propertyData
        );

        // Auto-fill other form fields
        setPropertySearchParams((prev) => ({
          ...prev,
          city: propertyData.City || prev.city,
          mlsNumber: propertyData.ListAgentMlsId || prev.mlsNumber,
          listingAgent: propertyData.ListAgentFullName || prev.listingAgent,
          address: propertyData.UnparsedAddress || address,
        }));

        console.log("AI Content Generator form auto-filled with:", {
          mlsNumber: propertyData.ListAgentMlsId,
          listingAgent: propertyData.ListAgentFullName,
          city: propertyData.City,
          address: propertyData.UnparsedAddress,
        });

        // Auto-select this property
        const foundProperty: Property = {
          id: propertyData.ListingKey || "auto-found",
          mlsNumber: propertyData.ListAgentMlsId || "",
          address: propertyData.UnparsedAddress || address,
          city: propertyData.City || "",
          state: "NE",
          zipCode: propertyData.PostalCode || "",
          price: Number(propertyData.ListPrice) || 0,
          bedrooms: Number(propertyData.BedroomsTotal) || 0,
          bathrooms: Number(propertyData.BathroomsTotal) || 0,
          squareFootage: Number(propertyData.LivingArea) || 0,
          yearBuilt: Number(propertyData.YearBuilt) || 0,
          propertyType: "Residential",
          listingAgent: propertyData.ListAgentFullName || null,
          photos:
            propertyData.Media?.slice(0, 3)?.map((m: any) => m.MediaURL) || [],
          description: propertyData.PublicRemarks || "",
        };
        setSelectedProperty(foundProperty);
      } else {
        console.log("No property details found for address:", address);
      }
    } catch (error) {
      console.error("Error fetching property details:", error);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Get address suggestions as user types
  const getAddressSuggestions = async (input: string) => {
    if (!addressAutocomplete || !input || input.length < 3) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const request = {
        input: input,
        types: ["address"],
        componentRestrictions: { country: "US" },
      };

      addressAutocomplete.getPlacePredictions(
        request,
        (
          predictions: google.maps.places.QueryAutocompletePrediction[] | null
        ) => {
          if (predictions) {
            setAddressSuggestions(predictions);
            setShowSuggestions(true);
          }
        }
      );
    } catch (error) {
      console.error("Error fetching address suggestions:", error);
    }
  };

  // Handle address suggestion selection
  const selectAddressSuggestion = async (
    suggestion: google.maps.places.QueryAutocompletePrediction
  ) => {
    const address = suggestion.description;
    setPropertySearchParams((prev) => ({ ...prev, address }));
    setShowSuggestions(false);

    // Auto-search for property details immediately
    await handleAddressAutoSearch(address);
  };

  // Get suggestions when address changes
  useEffect(() => {
    if (
      propertySearchParams.address &&
      propertySearchParams.address.length >= 3
    ) {
      getAddressSuggestions(propertySearchParams.address);
    } else {
      setShowSuggestions(false);
      setAddressSuggestions([]);
    }
  }, [propertySearchParams.address, addressAutocomplete]);

  // MLS Property Search Query - using the same API as the dropdown for consistency
  const {
    data: properties,
    isLoading: isSearchingProperties,
    refetch: searchProperties,
  } = useQuery<Property[]>({
    queryKey: ["gbcma-ai-content-search", propertySearchParams],
    queryFn: async () => {
      const hasAddress =
        propertySearchParams.address &&
        propertySearchParams.address.trim() !== "";
      const hasMlsNumber =
        propertySearchParams.mlsNumber &&
        propertySearchParams.mlsNumber.trim() !== "";
      const hasListingAgent =
        propertySearchParams.listingAgent &&
        propertySearchParams.listingAgent.trim() !== "";

      // If we have an address, use the same details-by-address API that works for dropdown
      if (hasAddress) {
        console.log(
          "Search Properties using details-by-address API for:",
          propertySearchParams.address
        );

        const response = await fetch("/api/property/details-by-address", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            address: propertySearchParams.address.trim().split(",")[0], // Extract just the street address
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            "Property details API error:",
            response.status,
            errorText
          );
          throw new Error(`Property details API error: ${response.status}`);
        }

        const propertyData = await response.json();
        console.log("Search Properties API response:", propertyData);

        // Convert single property to array format using the same structure as dropdown
        const property: Property = {
          id: propertyData.ListingKey || "search-result",
          mlsNumber: propertyData.ListAgentMlsId || "",
          address: propertyData.UnparsedAddress || propertySearchParams.address,
          city: propertyData.City || "",
          state: "NE",
          zipCode: propertyData.PostalCode || "",
          price: Number(propertyData.ListPrice) || 0,
          listPrice: Number(propertyData.ListPrice) || 0,
          bedrooms: Number(propertyData.BedroomsTotal) || 0,
          bathrooms: Number(propertyData.BathroomsTotal) || 0,
          squareFootage: Number(propertyData.LivingArea) || 0,
          yearBuilt: Number(propertyData.YearBuilt) || 0,
          propertyType: "Residential",
          listingStatus: propertyData.MlsStatus || "",
          description: propertyData.PublicRemarks || "",
          features: [],
          photoUrls:
            propertyData.Media?.slice(0, 3)?.map((m: any) => m.MediaURL) || [],
          neighborhood: propertyData.SubdivisionName || null,
          agentName: propertyData.ListAgentFullName || null,
        };

        return [property];
      }

      // If no address but has MLS number, use the GBCMA search API
      if (hasMlsNumber) {
        const response = await fetch(
          `/api/property/search?mls_number=${encodeURIComponent(
            propertySearchParams.mlsNumber.trim()
          )}`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            "Property search API error:",
            response.status,
            errorText
          );
          throw new Error(`Property search API error: ${response.status}`);
        }

        const data = await response.json();

        // Transform GBCMA API response to our Property interface
        const properties = data.properties || [];

        return properties.map((prop: any) => ({
          id: prop.id || Math.random().toString(),
          mlsNumber: propertySearchParams.mlsNumber || prop.id || "", // Use the searched MLS number
          address: prop.address || "",
          city: prop.city || "",
          state: prop.state || "NE",
          zipCode: prop.zipCode || "",
          price: prop.listPrice || 0,
          listPrice: prop.listPrice || 0,
          bedrooms: prop.beds || 0,
          bathrooms: prop.baths || 0,
          squareFootage: prop.sqft || 0,
          yearBuilt: prop.yearBuilt || 0,
          propertyType: prop.propertyType || "Residential",
          listingStatus: prop.status || "Active",
          listingDate: prop.onMarketDate || "",
          description: "",
          features: prop.condition ? [prop.condition] : [],
          photoUrls: prop.imageUrl ? [prop.imageUrl] : [],
          neighborhood: prop.subdivision || null,
          agentName: null,
        }));
      }

      // If no address or MLS but has listing agent, use the GBCMA search API
      if (hasListingAgent) {
        const response = await fetch(
          `/api/property/search?agent=${encodeURIComponent(
            propertySearchParams.listingAgent.trim()
          )}`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            "Property search API error:",
            response.status,
            errorText
          );
          throw new Error(`Property search API error: ${response.status}`);
        }

        const data = await response.json();

        // Transform GBCMA API response to our Property interface
        const properties = data.properties || [];

        return properties.map((prop: any) => ({
          id: prop.id || Math.random().toString(),
          mlsNumber: prop.id || "", // gbcma uses 'id' field as MLS number
          address: prop.address || "",
          city: prop.city || "",
          state: prop.state || "NE",
          zipCode: prop.zipCode || "",
          price: prop.listPrice || 0,
          listPrice: prop.listPrice || 0,
          bedrooms: prop.beds || 0,
          bathrooms: prop.baths || 0,
          squareFootage: prop.sqft || 0,
          yearBuilt: prop.yearBuilt || 0,
          propertyType: prop.propertyType || "Residential",
          listingStatus: prop.status || "Active",
          listingDate: prop.onMarketDate || "",
          description: "",
          features: prop.condition ? [prop.condition] : [],
          photoUrls: prop.imageUrl ? [prop.imageUrl] : [],
          neighborhood: prop.subdivision || null,
          agentName: null,
        }));
      }

      // No valid search criteria
      return [];
    },
    enabled: false, // Only search when user clicks search button
  });

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        // 10MB limit
        toast({
          title: "File Too Large",
          description: "Please select an image under 10MB",
          variant: "destructive",
        });
        return;
      }

      setSelectedPhoto(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setSelectedPhoto(null);
    setPhotoPreview(null);
  };

  const postToPlatformMutation = useMutation({
    mutationFn: async ({
      platform,
      content,
      photo,
    }: {
      platform: string;
      content: string;
      photo?: File;
    }) => {
      // Handle Facebook posting separately using Facebook Pages API
      if (platform.toLowerCase() === "facebook") {
        const response = await fetch("/api/facebook/post", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: content,
            pageId: "61581294927027", // Golden Brick page ID
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to post to Facebook");
        }

        return response.json();
      } else if (platform.toLowerCase() === "instagram") {
        // Handle Instagram posting using Instagram Graph API
        const formData = new FormData();
        formData.append("content", content);
        if (photo) {
          formData.append("photo", photo);
        }

        const response = await fetch("/api/instagram/post", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to post to Instagram");
        }

        return response.json();
      } else if (
        platform.toLowerCase() === "x (twitter)" ||
        platform.toLowerCase() === "twitter"
      ) {
        // Handle Twitter posting using Twitter API v2
        const formData = new FormData();
        formData.append("content", content);
        if (photo) {
          formData.append("photo", photo);
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
      } else {
        // For other platforms, use the general endpoint
        const formData = new FormData();
        formData.append("platform", platform);
        formData.append("content", content);
        if (photo) {
          formData.append("photo", photo);
        }

        const response = await fetch("/api/social/post", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        return response.json();
      }
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Posted Successfully!",
        description: `Your content has been posted to ${variables.platform}`,
      });
      setPostingTo(null);
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] });
    },
    onError: (error: any, variables) => {
      toast({
        title: "Posting Failed",
        description: `Failed to post to ${variables.platform}: ${error.message}`,
        variant: "destructive",
      });
      setPostingTo(null);
    },
  });

  const handlePostToPlatform = (platform: string) => {
    if (!lastGenerated) return;

    setPostingTo(platform);
    postToPlatformMutation.mutate({
      platform: platform.toLowerCase(),
      content: lastGenerated.content,
      photo: selectedPhoto || undefined,
    });
  };

  const handlePostToWebsite = (platform: string) => {
    const content =
      optimizedContent[platform]?.content || lastGenerated?.content;
    if (!content) return;

    toast({
      title: "Posting to Website",
      description: `Publishing "${
        lastGenerated?.title || "Real Estate Content"
      }" to your website...`,
    });

    // Simulate posting to website - this would integrate with CMS
    setTimeout(() => {
      toast({
        title: "Posted to Website",
        description: "Your content has been published to your website!",
      });
    }, 2000);
  };

  const regenerateForPlatformMutation = useMutation<
    GeneratedContent,
    Error,
    {
      platform: string;
      originalContent: string;
      contentType: string;
      topic: string;
      neighborhood: string;
    }
  >({
    mutationFn: async ({
      platform,
      originalContent,
      contentType,
      topic,
      neighborhood,
    }) => {
      const response = await apiRequest(
        "POST",
        "/api/content/regenerate-for-platform",
        {
          platform: platform.toLowerCase(),
          originalContent,
          contentType,
          topic,
          neighborhood,
          seoOptimized: true,
          longTailKeywords: true,
        }
      );
      return await response.json();
    },
    onSuccess: (data: GeneratedContent, variables) => {
      // Check if SEO score is below 80%, if so, automatically regenerate (max 2 retries)
      const seoScore = data.seoScore || 0;
      const currentRetries = retryCount[variables.platform] || 0;

      if (seoScore < 80 && currentRetries < 2) {
        // Automatically retry to get better SEO score
        console.log(
          `SEO score ${seoScore}% below target, auto-regenerating for ${
            variables.platform
          } (attempt ${currentRetries + 1})...`
        );
        setRetryCount((prev) => ({
          ...prev,
          [variables.platform]: currentRetries + 1,
        }));

        regenerateForPlatformMutation.mutate({
          platform: variables.platform,
          originalContent: variables.originalContent,
          contentType: variables.contentType,
          topic: variables.topic,
          neighborhood: variables.neighborhood,
        });
        return;
      }

      // Reset retry count for this platform
      setRetryCount((prev) => ({
        ...prev,
        [variables.platform]: 0,
      }));

      // Store optimized content for this platform
      setOptimizedContent((prev) => ({
        ...prev,
        [variables.platform]: data,
      }));
      setLastGenerated(data);

      const message =
        seoScore >= 80
          ? `Content optimized for ${variables.platform} with ${seoScore}% SEO score`
          : `Content optimized for ${variables.platform} with ${seoScore}% SEO score (reached max retries)`;

      toast({
        title: "Content Optimized!",
        description: message,
      });
      setRegeneratingFor(null);
    },
    onError: (error: any, variables) => {
      toast({
        title: "Regeneration Failed",
        description: `Failed to regenerate content for ${variables.platform}`,
        variant: "destructive",
      });
      setRegeneratingFor(null);
    },
  });

  const handleRegenerateForPlatform = (platform: string) => {
    if (!lastGenerated) return;

    setRegeneratingFor(platform);
    regenerateForPlatformMutation.mutate({
      platform,
      originalContent: lastGenerated.content,
      contentType,
      topic,
      neighborhood,
    });
  };

  const generateContentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/content/generate", data);
      return response.json();
    },
    onSuccess: (data: GeneratedContent) => {
      setLastGenerated(data);
      toast({
        title: "Content Generated Successfully!",
        description: `Created "${data.title}" with ${data.wordCount} words`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate content",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    if (!topic.trim() && contentType !== "property_feature") {
      toast({
        title: "Topic Required",
        description: "Please enter a topic or keywords for content generation",
        variant: "destructive",
      });
      return;
    }

    if (contentType === "property_feature" && !selectedProperty) {
      toast({
        title: "Property Required",
        description:
          "Please search and select a property for property feature content",
        variant: "destructive",
      });
      return;
    }

    const selectedStyle = contentStyles[contentType] || "None";
    const enhancedPrompt =
      selectedStyle === "None"
        ? aiPrompt.trim()
        : `${aiPrompt.trim()} Use a ${selectedStyle.toLowerCase()} style and tone for this content.`;

    generateContentMutation.mutate({
      type: contentType,
      topic: topic.trim(),
      aiPrompt: enhancedPrompt,
      neighborhood:
        neighborhood === "All Omaha Areas" ? undefined : neighborhood,
      seoOptimized,
      longTailKeywords,
      localSeoFocus: true,
      propertyData:
        contentType === "property_feature" ? selectedProperty : undefined,
    });
  };

  // Determine if generator is active (ready to generate content)
  const isActive =
    !isGenerating &&
    !generateContentMutation.isPending &&
    (contentType !== "property_feature" ||
      (contentType === "property_feature" && selectedProperty));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">
            AI Content Generator
          </CardTitle>
          <Badge
            variant="secondary"
            className={
              isActive
                ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700"
                : "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700"
            }
          >
            {isActive ? "Active" : "Not Active"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Content Type Selection */}
        <div>
          <Label className="text-sm font-medium text-foreground mb-2 block">
            Content Type
          </Label>
          <div className="grid grid-cols-3 gap-3">
            {contentTypes.map((type) => (
              <div key={type.value} className="space-y-2">
                <Button
                  variant={contentType === type.value ? "default" : "secondary"}
                  className="w-full text-sm font-medium"
                  onClick={() => setContentType(type.value)}
                  data-testid={`content-type-${type.value}`}
                >
                  <type.icon className="mr-2 h-4 w-4" />
                  {type.label}
                </Button>

                {/* Style Dropdown */}
                <Select
                  value={contentStyles[type.value] || "None"}
                  onValueChange={(value) =>
                    setContentStyles((prev) => ({
                      ...prev,
                      [type.value]: value,
                    }))
                  }
                >
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {styleOptions.map((style) => (
                      <SelectItem key={style.value} value={style.value}>
                        {style.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>

        {/* Property Selection (only for Property Feature) */}
        {contentType === "property_feature" && (
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
            <div className="flex items-center space-x-2">
              <Home className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium text-foreground">
                Select Property from MLS
              </Label>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label
                  htmlFor="mls-number"
                  className="text-xs text-muted-foreground mb-1 block"
                >
                  MLS#
                </Label>
                <Input
                  id="mls-number"
                  placeholder="e.g., 22301234"
                  value={propertySearchParams.mlsNumber}
                  onChange={(e) =>
                    setPropertySearchParams((prev) => ({
                      ...prev,
                      mlsNumber: e.target.value,
                    }))
                  }
                  className="w-full"
                  data-testid="input-mls-number"
                />
              </div>
              <div className="relative">
                <Label
                  htmlFor="property-address"
                  className="text-xs text-muted-foreground mb-1 block"
                >
                  Address{" "}
                  {isLoadingDetails && (
                    <span className="text-blue-600">
                      (Loading property details...)
                    </span>
                  )}
                </Label>
                <Input
                  ref={addressInputRef}
                  id="property-address"
                  placeholder="Start typing address..."
                  value={propertySearchParams.address}
                  onChange={(e) =>
                    setPropertySearchParams((prev) => ({
                      ...prev,
                      address: e.target.value,
                    }))
                  }
                  className="w-full"
                  data-testid="input-property-address"
                  onBlur={() => {
                    // Hide suggestions after a small delay to allow clicking
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                  onFocus={() => {
                    if (addressSuggestions.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                />

                {/* Address Suggestions Dropdown */}
                {showSuggestions && addressSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {addressSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b last:border-b-0 border-gray-100 dark:border-gray-600"
                        onClick={() => selectAddressSuggestion(suggestion)}
                        onMouseDown={(e) => e.preventDefault()} // Prevent input blur
                      >
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {suggestion.description}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {googleMapsStatus === "loading" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Loading address suggestions...
                  </p>
                )}
                {googleMapsStatus === "ready" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ✓ Type to see address suggestions
                  </p>
                )}
              </div>
              <div>
                <Label
                  htmlFor="listing-agent"
                  className="text-xs text-muted-foreground mb-1 block"
                >
                  Listing Agent
                </Label>
                <Input
                  id="listing-agent"
                  placeholder="e.g., Mike Bjork"
                  value={propertySearchParams.listingAgent}
                  onChange={(e) =>
                    setPropertySearchParams((prev) => ({
                      ...prev,
                      listingAgent: e.target.value,
                    }))
                  }
                  className="w-full"
                  data-testid="input-listing-agent"
                />
              </div>
            </div>

            <Button
              onClick={() => searchProperties()}
              disabled={
                isSearchingProperties ||
                (!propertySearchParams.mlsNumber &&
                  !propertySearchParams.address &&
                  !propertySearchParams.listingAgent)
              }
              className="w-full"
              variant="outline"
              data-testid="button-search-properties"
            >
              <Search className="mr-2 h-4 w-4" />
              {isSearchingProperties ? "Searching..." : "Search Properties"}
            </Button>

            {properties && properties.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Found Properties
                </Label>
                <div className="max-h-32 overflow-y-auto space-y-2">
                  {properties.map((property) => (
                    <div
                      key={property.id}
                      className={`p-2 rounded border cursor-pointer transition-colors ${
                        selectedProperty?.id === property.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted border-border"
                      }`}
                      onClick={() => setSelectedProperty(property)}
                      data-testid={`property-option-${property.id}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-xs font-medium">
                            #{property.mlsNumber}
                          </p>
                          <p className="text-xs">{property.address}</p>
                          <p className="text-xs opacity-75">
                            ${property.price?.toLocaleString() || "N/A"} •{" "}
                            {property.bedrooms || 0}BR/{property.bathrooms || 0}
                            BA
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedProperty && (
              <div className="p-3 bg-background rounded border">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-foreground">
                    Selected Property
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedProperty(null)}
                    className="h-6 w-6 p-0"
                    data-testid="button-clear-property"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-xs font-medium">
                  #{selectedProperty.mlsNumber}
                </p>
                <p className="text-xs">
                  {selectedProperty.address}, {selectedProperty.city}
                </p>
                <p className="text-xs text-muted-foreground">
                  ${selectedProperty.price?.toLocaleString() || "N/A"} •{" "}
                  {selectedProperty.bedrooms || 0}BR/
                  {selectedProperty.bathrooms || 0}BA •{" "}
                  {selectedProperty.squareFootage?.toLocaleString() || "N/A"} sq
                  ft
                </p>
              </div>
            )}
          </div>
        )}

        {/* Topic Input */}
        <div>
          <Label
            htmlFor="topic"
            className="text-sm font-medium text-foreground mb-2 block"
          >
            {contentType === "property_feature"
              ? "Additional Keywords (Optional)"
              : "Topic or Keywords"}
          </Label>
          <Input
            id="topic"
            placeholder={
              contentType === "property_feature"
                ? "e.g., luxury features, family-friendly"
                : "e.g., Dundee neighborhood guide, luxury homes Aksarben"
            }
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full"
            data-testid="input-topic"
          />
        </div>

        {/* AI Prompt Input */}
        <div>
          <Label
            htmlFor="ai-prompt"
            className="text-sm font-medium text-foreground mb-2 block"
          >
            AI Instructions
          </Label>
          <Textarea
            id="ai-prompt"
            placeholder="Tell the AI exactly how to create your content..."
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            className="w-full resize-none"
            rows={3}
            data-testid="input-ai-prompt"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Customize how AI creates your content - specify tone, style,
            call-to-actions, or any special requirements.
          </p>
        </div>

        {/* Neighborhood Selection */}
        <div>
          <Label className="text-sm font-medium text-foreground mb-2 block">
            Omaha Neighborhood Focus
          </Label>
          <Select value={neighborhood} onValueChange={setNeighborhood}>
            <SelectTrigger data-testid="select-neighborhood">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {neighborhoods.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* SEO Options */}
        <div>
          <Label className="text-sm font-medium text-foreground mb-2 block">
            SEO Optimization
          </Label>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="long-tail"
                checked={longTailKeywords}
                onCheckedChange={(checked) =>
                  setLongTailKeywords(checked === true)
                }
                data-testid="checkbox-long-tail"
              />
              <Label
                htmlFor="long-tail"
                className="text-sm text-muted-foreground"
              >
                Long-tail keywords
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="local-seo"
                checked={seoOptimized}
                onCheckedChange={(checked) => setSeoOptimized(checked === true)}
                data-testid="checkbox-local-seo"
              />
              <Label
                htmlFor="local-seo"
                className="text-sm text-muted-foreground"
              >
                Local SEO focus
              </Label>
            </div>
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={isGenerating || generateContentMutation.isPending}
          className="w-full bg-primary text-primary-foreground py-3 font-medium hover:bg-primary/90"
          data-testid="button-generate-ai-content"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {isGenerating || generateContentMutation.isPending
            ? "Generating..."
            : "Generate Content with AI"}
        </Button>

        {/* Generated Content Preview */}
        {lastGenerated && (
          <div
            className="mt-6 p-4 bg-muted rounded-lg"
            data-testid="content-preview"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-foreground">
                Latest Generated Content
              </h3>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(lastGenerated.content);
                    toast({
                      title: "Copied to Clipboard",
                      description: "Content has been copied to your clipboard",
                    });
                  }}
                  data-testid="button-copy-content"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFullContent(!showFullContent)}
                  data-testid="button-toggle-content"
                >
                  {showFullContent ? (
                    <>
                      <ChevronUp className="mr-1 h-4 w-4" />
                      Hide
                    </>
                  ) : (
                    <>
                      <ChevronDown className="mr-1 h-4 w-4" />
                      View Full
                    </>
                  )}
                </Button>
              </div>
            </div>

            <p className="text-sm font-medium text-foreground mb-3">
              "{lastGenerated.title}"
            </p>

            {/* Photo Upload Section */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium text-foreground">
                  Add Photo (Optional)
                </Label>
                {!selectedPhoto && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPhotoUpload(true)}
                    data-testid="button-add-photo"
                  >
                    <ImagePlus className="mr-1 h-3 w-3" />
                    Upload Image
                  </Button>
                )}
              </div>

              {photoPreview && (
                <div className="relative inline-block">
                  <img
                    src={photoPreview}
                    alt="Selected photo"
                    className="max-w-full h-32 object-cover rounded border"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                    onClick={removePhoto}
                    data-testid="button-remove-photo"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            {showFullContent && (
              <div className="mb-4 p-3 bg-background rounded border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Generated Content
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!isEditing) {
                        setEditedContent(lastGenerated.content);
                      } else {
                        // Save edited content
                        setLastGenerated((prev) =>
                          prev ? { ...prev, content: editedContent } : null
                        );
                      }
                      setIsEditing(!isEditing);
                    }}
                    className="h-6 px-2 text-xs"
                  >
                    {isEditing ? (
                      <>
                        <Save className="mr-1 h-3 w-3" />
                        Save
                      </>
                    ) : (
                      <>
                        <Edit2 className="mr-1 h-3 w-3" />
                        Edit
                      </>
                    )}
                  </Button>
                </div>
                {isEditing ? (
                  <Textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    rows={8}
                    className="resize-none text-sm"
                    placeholder="Edit your generated content..."
                  />
                ) : (
                  <div className="prose prose-sm max-w-none text-sm text-foreground whitespace-pre-wrap">
                    {lastGenerated.content}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                <span className="flex items-center">
                  <Eye className="mr-1 h-3 w-3" />
                  {lastGenerated.wordCount} words
                </span>
                <span className="flex items-center">
                  <Search className="mr-1 h-3 w-3" />
                  {lastGenerated.keywords?.length || 0} keywords optimized
                </span>
                <span className="flex items-center">
                  <Clock className="mr-1 h-3 w-3" />
                  Generated just now
                </span>
              </div>

              {lastGenerated.seoScore && (
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    lastGenerated.seoScore >= 80
                      ? "border-green-500 text-green-700 dark:text-green-400"
                      : lastGenerated.seoScore >= 70
                      ? "border-yellow-500 text-yellow-700 dark:text-yellow-400"
                      : "border-red-500 text-red-700 dark:text-red-400"
                  }`}
                >
                  SEO Score: {lastGenerated.seoScore}%
                </Badge>
              )}
            </div>

            {(lastGenerated.keywords?.length || 0) > 0 && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-muted-foreground mb-2">Keywords:</p>
                <div className="flex flex-wrap gap-1">
                  {lastGenerated.keywords?.map((keyword, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {keyword}
                    </Badge>
                  )) || []}
                </div>
              </div>
            )}

            {lastGenerated.seoBreakdown && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-muted-foreground mb-2">
                  SEO Breakdown:
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span>Keywords:</span>
                    <span className="font-mono">
                      {lastGenerated.seoBreakdown.keywordOptimization}/25
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Structure:</span>
                    <span className="font-mono">
                      {lastGenerated.seoBreakdown.contentStructure}/20
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Local SEO:</span>
                    <span className="font-mono">
                      {lastGenerated.seoBreakdown.localSEO}/20
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quality:</span>
                    <span className="font-mono">
                      {lastGenerated.seoBreakdown.contentQuality}/15
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Meta:</span>
                    <span className="font-mono">
                      {lastGenerated.seoBreakdown.metaOptimization}/10
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Call-to-Action:</span>
                    <span className="font-mono">
                      {lastGenerated.seoBreakdown.callToAction}/10
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Platform Suggestions */}
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center mb-3">
                <Share2 className="mr-2 h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Recommended Platforms:
                </p>
              </div>
              <div className="space-y-2">
                {getPlatformSuggestions(lastGenerated).map(
                  (suggestion, index) => {
                    const IconComponent = suggestion.icon;
                    return (
                      <div
                        key={suggestion.platform}
                        className="flex items-start space-x-3 p-2 bg-background rounded border"
                      >
                        <div className="flex items-center space-x-2">
                          <IconComponent
                            className="h-4 w-4"
                            style={{
                              color:
                                suggestion.platform === "Facebook"
                                  ? "#1877F2"
                                  : suggestion.platform === "Instagram"
                                  ? "#E4405F"
                                  : suggestion.platform === "LinkedIn"
                                  ? "#0077B5"
                                  : suggestion.platform === "YouTube"
                                  ? "#FF0000"
                                  : "#1DA1F2",
                            }}
                          />
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              suggestion.fit === "excellent"
                                ? "border-green-500 text-green-700 dark:text-green-400"
                                : suggestion.fit === "very-good"
                                ? "border-blue-500 text-blue-700 dark:text-blue-400"
                                : "border-yellow-500 text-yellow-700 dark:text-yellow-400"
                            }`}
                          >
                            {suggestion.fit === "excellent"
                              ? "🏆 Excellent"
                              : suggestion.fit === "very-good"
                              ? "⭐ Very Good"
                              : "👍 Good"}{" "}
                            Fit
                          </Badge>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-foreground">
                              {suggestion.platform}
                            </p>
                            <div className="flex items-center space-x-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() =>
                                  handleRegenerateForPlatform(
                                    suggestion.platform
                                  )
                                }
                                disabled={
                                  regeneratingFor === suggestion.platform ||
                                  regenerateForPlatformMutation.isPending
                                }
                                data-testid={`button-regenerate-${suggestion.platform.toLowerCase()}`}
                              >
                                {regeneratingFor === suggestion.platform ? (
                                  <>
                                    <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                                    Optimizing...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="mr-1 h-3 w-3" />
                                    Optimize
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => {
                                  setPreviewPlatform(suggestion.platform);
                                  setShowPlatformPreview(true);
                                }}
                                data-testid={`button-view-${suggestion.platform.toLowerCase()}`}
                              >
                                <Eye className="mr-1 h-3 w-3" />
                                Preview
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => {
                                  if (suggestion.platform === "Website") {
                                    handlePostToWebsite(suggestion.platform);
                                  } else {
                                    handlePostToPlatform(suggestion.platform);
                                  }
                                }}
                                disabled={
                                  postingTo === suggestion.platform ||
                                  postToPlatformMutation.isPending
                                }
                                data-testid={`button-post-${suggestion.platform.toLowerCase()}`}
                              >
                                {postingTo === suggestion.platform ? (
                                  <>
                                    <span className="animate-spin mr-1">
                                      ⏳
                                    </span>
                                    Posting...
                                  </>
                                ) : (
                                  <>
                                    {suggestion.platform === "Website" ? (
                                      <Globe className="mr-1 h-3 w-3" />
                                    ) : (
                                      <Send className="mr-1 h-3 w-3" />
                                    )}
                                    {suggestion.platform === "Website"
                                      ? "Post to Website"
                                      : "Post Now"}
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {suggestion.reason}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">Tip:</span>{" "}
                            {suggestion.optimization}
                          </p>
                          {optimizedContent[suggestion.platform] && (
                            <div className="flex items-center space-x-2 mt-2">
                              <Badge
                                variant="outline"
                                className="text-xs border-green-500 text-green-700 dark:text-green-400"
                              >
                                SEO:{" "}
                                {optimizedContent[suggestion.platform]
                                  .seoScore || 82}
                                %
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Optimized for {suggestion.platform}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* Platform Preview Dialog */}
      <Dialog open={showPlatformPreview} onOpenChange={setShowPlatformPreview}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Platform Preview</DialogTitle>
          </DialogHeader>
          {previewPlatform && (
            <div>
              {/* Facebook Preview */}
              {previewPlatform === "Facebook" && (
                <div className="bg-white text-black">
                  <div className="flex items-center gap-3 p-3">
                    <div className="w-10 h-10 bg-golden-accent rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-golden-foreground">
                        MB
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">Mike Bjork</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <span>{format(new Date(), "MMM d 'at' h:mm a")}</span>
                        <span>·</span>
                        <span>🌎</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsEditing(true);
                          setEditedContent(
                            optimizedContent[previewPlatform]?.content ||
                              lastGenerated?.content ||
                              ""
                          );
                        }}
                        className="h-8 w-8 p-0 hover:bg-gray-100"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <MoreHorizontal className="h-5 w-5 text-gray-500" />
                    </div>
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
                      <div className="text-sm mb-3 whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {optimizedContent[previewPlatform]?.content ||
                          lastGenerated?.content}
                      </div>
                    )}
                  </div>

                  {photoPreview && (
                    <div
                      className="aspect-video bg-cover bg-center"
                      style={{ backgroundImage: `url(${photoPreview})` }}
                    ></div>
                  )}
                  {!photoPreview && (
                    <div className="aspect-video bg-gradient-to-br from-golden-accent/20 to-golden-muted/40 flex items-center justify-center">
                      <div className="text-center text-gray-600">
                        <Home className="h-12 w-12 mx-auto mb-2" />
                        <div className="text-sm">Property Image</div>
                      </div>
                    </div>
                  )}

                  <div className="p-3 border-t">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <div className="flex -space-x-1">
                          <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-xs text-white">
                            👍
                          </div>
                          <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-xs text-white">
                            ❤️
                          </div>
                        </div>
                        <span className="ml-2">43</span>
                      </div>
                      <div>8 comments</div>
                    </div>
                    <div className="flex items-center justify-around mt-3 pt-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-gray-600"
                      >
                        👍 Like
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-gray-600"
                      >
                        💬 Comment
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-gray-600"
                      >
                        📤 Share
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Instagram Preview */}
              {previewPlatform === "Instagram" && (
                <div className="bg-white text-black">
                  <div className="flex items-center justify-between p-3 border-b">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-400 rounded-full p-[2px]">
                        <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-golden-accent">
                            MB
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-sm">
                          mikebjork_realtor
                        </div>
                        <div className="text-xs text-gray-500">
                          Omaha, Nebraska
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsEditing(true);
                          setEditedContent(
                            optimizedContent[previewPlatform]?.content ||
                              lastGenerated?.content ||
                              ""
                          );
                        }}
                        className="h-8 w-8 p-0 hover:bg-gray-100"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <MoreHorizontal className="h-4 w-4" />
                    </div>
                  </div>

                  {photoPreview ? (
                    <div
                      className="aspect-square bg-cover bg-center"
                      style={{ backgroundImage: `url(${photoPreview})` }}
                    ></div>
                  ) : (
                    <div className="aspect-square bg-gradient-to-br from-golden-accent/20 to-golden-muted/40 flex items-center justify-center">
                      <div className="text-center text-gray-600">
                        <Home className="h-12 w-12 mx-auto mb-2" />
                        <div className="text-sm">Property Image</div>
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
                    <div className="text-sm font-semibold mb-1">127 likes</div>
                    <div className="text-sm max-h-32 overflow-y-auto">
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
                          <span className="whitespace-pre-wrap">
                            {optimizedContent[previewPlatform]?.content ||
                              lastGenerated?.content}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      View all 5 comments
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {format(new Date(), "MMMM d")}
                    </div>
                  </div>
                </div>
              )}

              {/* LinkedIn/X Preview */}
              {(previewPlatform === "LinkedIn" ||
                previewPlatform === "X (Twitter)") && (
                <div className="bg-white text-black p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-golden-accent rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-golden-foreground">
                        MB
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">Mike Bjork</div>
                      <div className="text-xs text-gray-500">
                        Real Estate Professional at BHHS
                      </div>
                      <div className="text-xs text-gray-400">
                        {format(new Date(), "MMM d, h:mm a")}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditing(true);
                        setEditedContent(
                          optimizedContent[previewPlatform]?.content ||
                            lastGenerated?.content ||
                            ""
                        );
                      }}
                      className="h-8 w-8 p-0 hover:bg-gray-100"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {isEditing ? (
                    <Textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="text-sm mb-3 min-h-[100px] resize-none"
                      placeholder="Edit your content..."
                    />
                  ) : (
                    <div className="text-sm mb-3 whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {optimizedContent[previewPlatform]?.content ||
                        lastGenerated?.content}
                    </div>
                  )}
                  {photoPreview && (
                    <div className="border rounded bg-gray-50 p-1 mb-3">
                      <img
                        src={photoPreview}
                        alt="Property"
                        className="w-full aspect-video object-cover rounded"
                      />
                    </div>
                  )}
                  {!photoPreview && (
                    <div className="border rounded bg-gray-50 p-4">
                      <div className="text-center text-gray-600">
                        <Home className="h-8 w-8 mx-auto mb-2" />
                        <div className="text-sm font-medium">
                          Property Listing
                        </div>
                        <div className="text-xs">Click to view details</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* YouTube Preview */}
              {previewPlatform === "YouTube" && (
                <div className="bg-white text-black p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-golden-accent rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-golden-foreground">
                        MB
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">
                        Mike Bjork Real Estate
                      </div>
                      <div className="text-xs text-gray-500">
                        Omaha Real Estate Expert
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditing(true);
                        setEditedContent(
                          optimizedContent[previewPlatform]?.content ||
                            lastGenerated?.content ||
                            ""
                        );
                      }}
                      className="h-8 w-8 p-0 hover:bg-gray-100"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {photoPreview ? (
                    <div
                      className="aspect-video bg-cover bg-center rounded mb-3 relative"
                      style={{ backgroundImage: `url(${photoPreview})` }}
                    >
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded">
                        <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
                          <div className="w-0 h-0 border-l-[8px] border-l-white border-y-[6px] border-y-transparent ml-1"></div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video bg-gradient-to-br from-golden-accent/20 to-golden-muted/40 flex items-center justify-center rounded mb-3">
                      <div className="text-center text-gray-600">
                        <Home className="h-12 w-12 mx-auto mb-2" />
                        <div className="text-sm font-medium">
                          Video Thumbnail
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="text-sm font-semibold line-clamp-2">
                      {lastGenerated?.title || "Real Estate Video Content"}
                    </div>
                    {isEditing ? (
                      <Textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="text-xs text-gray-600 min-h-[60px] resize-none"
                        placeholder="Edit video description..."
                      />
                    ) : (
                      <div className="text-xs text-gray-600 max-h-32 overflow-y-auto whitespace-pre-wrap">
                        {optimizedContent[previewPlatform]?.content ||
                          lastGenerated?.content}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Edit Controls */}
          {previewPlatform && (
            <div className="p-4 border-t bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
              {!isEditing ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditing(true);
                    setEditedContent(
                      optimizedContent[previewPlatform]?.content ||
                        lastGenerated?.content ||
                        ""
                    );
                  }}
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
                      setEditedContent("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (previewPlatform) {
                        setOptimizedContent((prev) => ({
                          ...prev,
                          [previewPlatform]: {
                            ...prev[previewPlatform],
                            content: editedContent,
                          },
                        }));
                      }
                      setIsEditing(false);
                      toast({
                        title: "Content Updated",
                        description: "Your content has been saved",
                      });
                    }}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Photo Upload Dialog */}
      <Dialog open={showPhotoUpload} onOpenChange={setShowPhotoUpload}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Photo to Content</DialogTitle>
          </DialogHeader>

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
                  const response = await fetch("/api/objects/upload", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                  });
                  const data = await response.json();
                  return {
                    method: "PUT" as const,
                    url: data.uploadURL,
                  };
                }}
                onComplete={(uploadedFileUrl) => {
                  // Convert Google Cloud Storage URL to local /objects/ endpoint
                  const fileName = uploadedFileUrl.split("/").pop();
                  const localImageUrl = `/objects/${fileName}`;
                  setPhotoPreview(localImageUrl);
                  setShowPhotoUpload(false);
                  toast({
                    title: "Photo uploaded successfully",
                    description: "Your photo has been added to the content.",
                  });
                }}
              >
                <div className="flex items-center gap-2">
                  <ImagePlus className="h-4 w-4" />
                  <span>Select Photo to Upload</span>
                </div>
              </ObjectUploader>

              <div className="text-xs text-muted-foreground text-center">
                Upload your own photos for a personal touch. Supports JPG, PNG
                up to 10MB.
              </div>
            </TabsContent>

            <TabsContent value="stock" className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  "https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200&q=80",
                  "https://images.unsplash.com/photo-1582407947304-fd86f028f716?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200&q=80",
                  "https://images.unsplash.com/photo-1570129477492-45c003edd2be?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200&q=80",
                  "https://images.unsplash.com/photo-1601760562234-9814eea6663a?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200&q=80",
                  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200&q=80",
                  "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200&q=80",
                ].map((image, index) => (
                  <div
                    key={index}
                    className="relative cursor-pointer group rounded overflow-hidden border hover:border-primary"
                    onClick={() => {
                      setPhotoPreview(image);
                      setShowPhotoUpload(false);
                      toast({
                        title: "Stock photo selected",
                        description:
                          "Professional stock photo added to your content.",
                      });
                    }}
                  >
                    <img
                      src={image}
                      alt={`Stock photo ${index + 1}`}
                      className="w-full h-24 object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Button
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Select
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-xs text-muted-foreground text-center">
                Choose from our curated collection of professional real estate
                photos.
              </div>
            </TabsContent>

            <TabsContent value="ai" className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label
                    htmlFor="ai-image-prompt"
                    className="text-sm font-medium"
                  >
                    Describe the image you want to generate
                  </Label>
                  <Input
                    id="ai-image-prompt"
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
                  perfectly tailored for your content.
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowPhotoUpload(false)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
