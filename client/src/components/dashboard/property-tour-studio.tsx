import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PropertySelector, Property } from "./property-selector";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Home,
  Image,
  Settings,
  Video,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Wand2,
  Loader2,
  Check,
  Play,
  User,
  Building,
  Trees,
  Palette,
  Download,
  Library,
  Share2,
  Upload,
  X,
  CircleOff,
  Film,
  Plus,
  Bed,
  Bath,
  UtensilsCrossed,
  Sofa,
  Briefcase,
  Car,
  WashingMachine,
  Droplets,
  Plane,
  MapPin,
  ExternalLink,
} from "lucide-react";
import { Link } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { SiFacebook, SiInstagram, SiLinkedin, SiX, SiYoutube, SiTiktok } from "react-icons/si";

interface AvatarPhoto {
  id: string;
  url: string;
  title: string;
  image_key?: string;
}

interface SelectedPhoto {
  url: string;
  index: number;
  selected: boolean;
  source?: "mls" | "upload";
  roomType?: string;
}

interface RoomPhoto {
  url: string;
  order: number;
  source?: "mls" | "upload";
}

interface RoomPhotos {
  roomId: string;
  roomName: string;
  roomType: "interior" | "exterior";
  photos: RoomPhoto[];
  maxPhotos: 6;
}

const ROOM_ZONES: Omit<RoomPhotos, "photos">[] = [
  { roomId: "living-room", roomName: "Living Room", roomType: "interior", maxPhotos: 6 },
  { roomId: "kitchen", roomName: "Kitchen", roomType: "interior", maxPhotos: 6 },
  { roomId: "dining-room", roomName: "Dining Room", roomType: "interior", maxPhotos: 6 },
  { roomId: "master-bedroom", roomName: "Master Bedroom", roomType: "interior", maxPhotos: 6 },
  { roomId: "bedroom-2", roomName: "Bedroom 2", roomType: "interior", maxPhotos: 6 },
  { roomId: "bedroom-3", roomName: "Bedroom 3", roomType: "interior", maxPhotos: 6 },
  { roomId: "bathroom", roomName: "Bathroom", roomType: "interior", maxPhotos: 6 },
  { roomId: "master-bath", roomName: "Master Bath", roomType: "interior", maxPhotos: 6 },
  { roomId: "office", roomName: "Office", roomType: "interior", maxPhotos: 6 },
  { roomId: "basement", roomName: "Basement", roomType: "interior", maxPhotos: 6 },
  { roomId: "garage", roomName: "Garage", roomType: "interior", maxPhotos: 6 },
  { roomId: "laundry", roomName: "Laundry", roomType: "interior", maxPhotos: 6 },
  { roomId: "front-yard", roomName: "Front Yard", roomType: "exterior", maxPhotos: 6 },
  { roomId: "backyard", roomName: "Backyard", roomType: "exterior", maxPhotos: 6 },
  { roomId: "pool", roomName: "Pool", roomType: "exterior", maxPhotos: 6 },
  { roomId: "patio-deck", roomName: "Patio/Deck", roomType: "exterior", maxPhotos: 6 },
  { roomId: "driveway", roomName: "Driveway", roomType: "exterior", maxPhotos: 6 },
  { roomId: "aerial-view", roomName: "Aerial View", roomType: "exterior", maxPhotos: 6 },
];

const ROOM_TYPES = [
  { value: "auto", label: "Auto-Detect" },
  { value: "living-room", label: "Living Room" },
  { value: "kitchen", label: "Kitchen" },
  { value: "master-bedroom", label: "Master Bedroom" },
  { value: "bedroom", label: "Bedroom" },
  { value: "bathroom", label: "Bathroom" },
  { value: "dining-room", label: "Dining Room" },
  { value: "office", label: "Office" },
  { value: "basement", label: "Basement" },
  { value: "garage", label: "Garage" },
  { value: "laundry", label: "Laundry Room" },
  { value: "hallway", label: "Hallway" },
  { value: "front-yard", label: "Front Yard" },
  { value: "backyard", label: "Backyard" },
  { value: "pool", label: "Pool" },
  { value: "patio", label: "Patio/Deck" },
  { value: "driveway", label: "Driveway" },
  { value: "garden", label: "Garden" },
  { value: "roof", label: "Roof/Exterior" },
  { value: "aerial", label: "Aerial View" },
];

const STEPS = [
  { id: 1, title: "Select Property", icon: Home, description: "Choose a listing" },
  { id: 2, title: "Arrange Photos", icon: Image, description: "Select and order photos" },
  { id: 3, title: "Tour Settings", icon: Settings, description: "Avatar, background, script" },
  { id: 4, title: "Generate Video", icon: Video, description: "Create your tour" },
];

const BACKGROUND_OPTIONS = [
  { value: "none", label: "None", icon: CircleOff },
  { value: "office", label: "Office", icon: Building },
  { value: "outdoor", label: "Outdoor", icon: Trees },
  { value: "branded", label: "Branded", icon: Palette },
  { value: "video", label: "Video", icon: Film },
];

const SCRIPT_STYLES = [
  { 
    value: "standard", 
    label: "Standard", 
    description: "Professional property tour narration",
    prompt: "Create an engaging property tour narration script that highlights key features professionally."
  },
  { 
    value: "high-seo", 
    label: "High SEO", 
    description: "Optimized for search engine visibility",
    prompt: "Create a property tour script optimized for SEO. Include relevant keywords naturally: real estate, home for sale, property listing, neighborhood name, city, bedrooms, bathrooms, square footage, amenities. Structure content with clear topic focus for search visibility."
  },
  { 
    value: "aeo", 
    label: "AEO (Answer Engine)", 
    description: "Optimized for voice search & AI assistants",
    prompt: "Create a property tour script optimized for Answer Engine Optimization (AEO). Use natural conversational language that answers common homebuyer questions. Include phrases like 'This home features...', 'You'll find...', 'The property includes...'. Structure as if answering: What makes this home special? What are the key features? Why should someone consider this property?"
  },
];

const TARGET_PLATFORMS = [
  { value: "youtube", label: "YouTube", charLimit: 5000, icon: SiYoutube, description: "Long-form video descriptions" },
  { value: "instagram", label: "Instagram", charLimit: 2200, icon: SiInstagram, description: "Reels & posts (first 125 chars visible)" },
  { value: "tiktok", label: "TikTok", charLimit: 2200, icon: SiTiktok, description: "Short-form video captions" },
  { value: "facebook", label: "Facebook", charLimit: 500, icon: SiFacebook, description: "Feed posts (first 480 chars visible)" },
  { value: "linkedin", label: "LinkedIn", charLimit: 700, icon: SiLinkedin, description: "Professional network posts" },
  { value: "twitter", label: "X (Twitter)", charLimit: 280, icon: SiX, description: "Short-form posts" },
];

const VIDEO_DURATIONS = [
  { value: "30", label: "30 seconds", seconds: 30, targetWords: 75, targetChars: 375 },
  { value: "60", label: "1 minute", seconds: 60, targetWords: 150, targetChars: 750 },
  { value: "90", label: "90 seconds", seconds: 90, targetWords: 225, targetChars: 1125 },
  { value: "120", label: "2 minutes", seconds: 120, targetWords: 300, targetChars: 1500 },
  { value: "180", label: "3 minutes", seconds: 180, targetWords: 450, targetChars: 2250 },
];

export function PropertyTourStudio() {
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhoto[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [photoViewTab, setPhotoViewTab] = useState<string>("all");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string>("");
  const [backgroundType, setBackgroundType] = useState<string>("office");
  const [includeBranding, setIncludeBranding] = useState<boolean>(true);
  const [generatedScript, setGeneratedScript] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [generationComplete, setGenerationComplete] = useState<boolean>(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [noMlsMode, setNoMlsMode] = useState<boolean>(false);
  const [showPhotoSelectModal, setShowPhotoSelectModal] = useState<boolean>(false);
  const [tempPhotoSelection, setTempPhotoSelection] = useState<{url: string; selected: boolean}[]>([]);
  const [scriptStyle, setScriptStyle] = useState<string>("standard");
  
  const [roomPhotos, setRoomPhotos] = useState<Record<string, RoomPhoto[]>>({});
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [showRoomModal, setShowRoomModal] = useState<boolean>(false);
  const [showGlobalUploadModal, setShowGlobalUploadModal] = useState<boolean>(false);
  const [unassignedPhotos, setUnassignedPhotos] = useState<{url: string; source: "mls" | "upload"}[]>([]);
  const [roomDragOver, setRoomDragOver] = useState<string | null>(null);
  const [targetPlatform, setTargetPlatform] = useState<string>("youtube");
  const [videoDuration, setVideoDuration] = useState<string>("60");
  const [customPrompt, setCustomPrompt] = useState<string>("");

  const { data: avatarsData, isLoading: avatarsLoading } = useQuery<{ photos: AvatarPhoto[] }>({
    queryKey: ["/api/avatar-iv/photos"],
    enabled: currentStep >= 3,
  });

  const generateScriptMutation = useMutation({
    mutationFn: async (property: Property) => {
      const propertyDetails = `
Property Address: ${property.address}, ${property.city}, ${property.state} ${property.zipCode}
List Price: $${property.listPrice.toLocaleString()}
${property.bedrooms ? `Bedrooms: ${property.bedrooms}` : ""}
${property.bathrooms ? `Bathrooms: ${property.bathrooms}` : ""}
${property.squareFootage ? `Square Footage: ${property.squareFootage.toLocaleString()} sq ft` : ""}
Property Type: ${property.propertyType}
${property.neighborhood ? `Neighborhood: ${property.neighborhood}` : ""}
${property.description ? `Description: ${property.description}` : ""}
${property.features && property.features.length > 0 ? `Features: ${property.features.join(", ")}` : ""}
`.trim();

      const selectedStyle = SCRIPT_STYLES.find(s => s.value === scriptStyle) || SCRIPT_STYLES[0];
      const platform = TARGET_PLATFORMS.find(p => p.value === targetPlatform) || TARGET_PLATFORMS[0];
      const duration = VIDEO_DURATIONS.find(d => d.value === videoDuration) || VIDEO_DURATIONS[1];
      const targetWordCount = Math.min(duration.targetWords, Math.floor(platform.charLimit / 5));

      const userInstructions = customPrompt.trim() 
        ? `\n\nADDITIONAL USER INSTRUCTIONS:\n${customPrompt.trim()}`
        : "";

      const message = `You are a professional real estate video script writer. ${selectedStyle.prompt}

IMPORTANT RULES:
- Only describe features that are explicitly mentioned in the property data provided
- Do not make up or assume any features, amenities, or characteristics not in the MLS data
- Keep the script around ${targetWordCount} words for a ${duration.label} video
- This will be posted on ${platform.label} (max ${platform.charLimit} characters)
- Make it professional and suitable for video narration${userInstructions}

Write a property tour video script for this listing. Only include information that is explicitly provided below:

${propertyDetails}`;

      const response = await apiRequest("POST", "/api/ai/chat", {
        message,
        conversationHistory: []
      });
      return response.json();
    },
    onSuccess: (data) => {
      const script = data.message || data.response || data.choices?.[0]?.message?.content || data.content || "";
      setGeneratedScript(script);
      toast({
        title: "Script Generated",
        description: "Your property tour script is ready. Feel free to edit it.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Script Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePropertySelect = useCallback((property: Property) => {
    setSelectedProperty(property);
    setNoMlsMode(false);
    const photosList = property.photoUrls?.map((url) => ({
      url,
      selected: true,
    })) || [];
    setTempPhotoSelection(photosList);
    setUploadedPhotos([]);
    setGeneratedScript("");
    setShowPhotoSelectModal(true);
  }, []);

  const toggleTempPhoto = useCallback((index: number) => {
    setTempPhotoSelection(prev => 
      prev.map((p, i) => i === index ? { ...p, selected: !p.selected } : p)
    );
  }, []);

  const selectAllPhotos = useCallback(() => {
    setTempPhotoSelection(prev => prev.map(p => ({ ...p, selected: true })));
  }, []);

  const deselectAllPhotos = useCallback(() => {
    setTempPhotoSelection(prev => prev.map(p => ({ ...p, selected: false })));
  }, []);

  const confirmPhotoSelection = useCallback(() => {
    const selected = tempPhotoSelection
      .filter(p => p.selected)
      .map((p) => ({
        url: p.url,
        source: "mls" as const,
      }));
    setUnassignedPhotos(selected);
    setRoomPhotos({});
    setShowPhotoSelectModal(false);
    setCurrentStep(2);
  }, [tempPhotoSelection]);

  const handlePhotoToggle = useCallback((index: number) => {
    setSelectedPhotos(prev => 
      prev.map((photo, i) => 
        i === index ? { ...photo, selected: !photo.selected } : photo
      )
    );
  }, []);

  const handleRoomTypeChange = useCallback((index: number, roomType: string) => {
    setSelectedPhotos(prev => 
      prev.map((photo, i) => 
        i === index ? { ...photo, roomType } : photo
      )
    );
  }, []);

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    setSelectedPhotos(prev => {
      const newPhotos = [...prev];
      const [draggedPhoto] = newPhotos.splice(draggedIndex, 1);
      newPhotos.splice(index, 0, draggedPhoto);
      return newPhotos.map((photo, i) => ({ ...photo, index: i }));
    });
    setDraggedIndex(index);
  }, [draggedIndex]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
  }, []);

  const handleFileUpload = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const newPhotos: SelectedPhoto[] = [];
    let processedCount = 0;
    
    Array.from(files).forEach((file) => {
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Invalid File Type",
          description: `${file.name} is not a supported image format. Use JPG, PNG, or WebP.`,
          variant: "destructive",
        });
        processedCount++;
        if (processedCount === files.length) {
          setIsUploading(false);
        }
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          setUploadedPhotos(prev => [...prev, dataUrl]);
          setSelectedPhotos(prev => [
            ...prev,
            {
              url: dataUrl,
              index: prev.length,
              selected: true,
              source: "upload" as const,
            }
          ]);
        }
        processedCount++;
        if (processedCount === files.length) {
          setIsUploading(false);
          toast({
            title: "Photos Uploaded",
            description: `${files.length} photo(s) added successfully.`,
          });
        }
      };
      reader.onerror = () => {
        processedCount++;
        if (processedCount === files.length) {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    });
  }, [toast]);

  const handleDropZoneDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDropZoneDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDropZoneDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  const handleRemoveUploadedPhoto = useCallback((url: string) => {
    setUploadedPhotos(prev => prev.filter(p => p !== url));
    setSelectedPhotos(prev => {
      const filtered = prev.filter(p => p.url !== url);
      return filtered.map((photo, i) => ({ ...photo, index: i }));
    });
    toast({
      title: "Photo Removed",
      description: "Uploaded photo has been removed.",
    });
  }, [toast]);

  const getRoomIcon = useCallback((roomId: string) => {
    const icons: Record<string, any> = {
      "living-room": Sofa,
      "kitchen": UtensilsCrossed,
      "dining-room": UtensilsCrossed,
      "master-bedroom": Bed,
      "bedroom-2": Bed,
      "bedroom-3": Bed,
      "bathroom": Bath,
      "master-bath": Bath,
      "office": Briefcase,
      "basement": Home,
      "garage": Car,
      "laundry": WashingMachine,
      "front-yard": Trees,
      "backyard": Trees,
      "pool": Droplets,
      "patio-deck": Trees,
      "driveway": MapPin,
      "aerial-view": Plane,
    };
    return icons[roomId] || Home;
  }, []);

  const addPhotoToRoom = useCallback((roomId: string, photoUrl: string, source: "mls" | "upload" = "upload") => {
    setRoomPhotos(prev => {
      const currentPhotos = prev[roomId] || [];
      if (currentPhotos.length >= 6) {
        toast({
          title: "Room Full",
          description: "This room already has 6 photos (maximum).",
          variant: "destructive",
        });
        return prev;
      }
      return {
        ...prev,
        [roomId]: [...currentPhotos, { url: photoUrl, order: currentPhotos.length, source }],
      };
    });
  }, [toast]);

  const removePhotoFromRoom = useCallback((roomId: string, photoUrl: string) => {
    setRoomPhotos(prev => {
      const currentPhotos = prev[roomId] || [];
      const filtered = currentPhotos.filter(p => p.url !== photoUrl);
      return {
        ...prev,
        [roomId]: filtered.map((p, i) => ({ ...p, order: i })),
      };
    });
  }, []);

  const reorderRoomPhotos = useCallback((roomId: string, fromIndex: number, toIndex: number) => {
    setRoomPhotos(prev => {
      const currentPhotos = [...(prev[roomId] || [])];
      const [moved] = currentPhotos.splice(fromIndex, 1);
      currentPhotos.splice(toIndex, 0, moved);
      return {
        ...prev,
        [roomId]: currentPhotos.map((p, i) => ({ ...p, order: i })),
      };
    });
  }, []);

  const handleRoomDrop = useCallback((e: React.DragEvent, roomId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setRoomDragOver(null);
    
    const photoData = e.dataTransfer.getData("application/json");
    if (photoData) {
      try {
        const { url, source } = JSON.parse(photoData);
        addPhotoToRoom(roomId, url, source);
        setUnassignedPhotos(prev => prev.filter(p => p.url !== url));
      } catch (err) {
        console.error("Failed to parse dropped photo data", err);
      }
    } else if (e.dataTransfer.files?.length > 0) {
      const file = e.dataTransfer.files[0];
      const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (validTypes.includes(file.type)) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const dataUrl = evt.target?.result as string;
          if (dataUrl) {
            addPhotoToRoom(roomId, dataUrl, "upload");
          }
        };
        reader.readAsDataURL(file);
      }
    }
  }, [addPhotoToRoom]);

  const handleRoomClick = useCallback((roomId: string) => {
    setSelectedRoomId(roomId);
    setShowRoomModal(true);
  }, []);

  const handleRoomFileUpload = useCallback((files: FileList | null, roomId: string) => {
    if (!files || files.length === 0) return;
    
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const currentCount = roomPhotos[roomId]?.length || 0;
    const slotsAvailable = 6 - currentCount;
    
    if (slotsAvailable === 0) {
      toast({
        title: "Room Full",
        description: "This room already has 6 photos (maximum).",
        variant: "destructive",
      });
      return;
    }
    
    const filesToProcess = Array.from(files).slice(0, slotsAvailable);
    
    filesToProcess.forEach((file) => {
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Invalid File Type",
          description: `${file.name} is not a supported image format.`,
          variant: "destructive",
        });
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          addPhotoToRoom(roomId, dataUrl, "upload");
        }
      };
      reader.readAsDataURL(file);
    });
    
    if (files.length > slotsAvailable) {
      toast({
        title: "Some Photos Skipped",
        description: `Only ${slotsAvailable} photos added. Room limit is 6.`,
      });
    }
  }, [roomPhotos, addPhotoToRoom, toast]);

  const getTotalRoomPhotoCount = useCallback(() => {
    return Object.values(roomPhotos).reduce((sum, photos) => sum + photos.length, 0);
  }, [roomPhotos]);

  const getRoomsWithPhotos = useCallback(() => {
    return Object.entries(roomPhotos)
      .filter(([_, photos]) => photos.length > 0)
      .map(([roomId, photos]) => {
        const zone = ROOM_ZONES.find(z => z.roomId === roomId);
        return { roomId, roomName: zone?.roomName || roomId, photos };
      });
  }, [roomPhotos]);

  const handleGenerateScript = useCallback(() => {
    if (!selectedProperty) return;
    generateScriptMutation.mutate(selectedProperty);
  }, [selectedProperty, generateScriptMutation]);

  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [motionVideos, setMotionVideos] = useState<string[]>([]);
  const [avatarVideoUrl, setAvatarVideoUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [savedToLibrary, setSavedToLibrary] = useState<boolean>(false);
  const [savedVideos, setSavedVideos] = useState<{ url: string; id: string; title: string }[]>([]);
  const [showShareDialog, setShowShareDialog] = useState<boolean>(false);
  const [selectedVideoForShare, setSelectedVideoForShare] = useState<string>("");
  const [shareContent, setShareContent] = useState<string>("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");
  const [isSavingToLibrary, setIsSavingToLibrary] = useState<boolean>(false);
  const [isPosting, setIsPosting] = useState<boolean>(false);

  const SOCIAL_PLATFORMS = [
    { value: "facebook", label: "Facebook", icon: SiFacebook },
    { value: "instagram", label: "Instagram", icon: SiInstagram },
    { value: "linkedin", label: "LinkedIn", icon: SiLinkedin },
    { value: "x", label: "X (Twitter)", icon: SiX },
    { value: "youtube", label: "YouTube", icon: SiYoutube },
    { value: "tiktok", label: "TikTok", icon: SiTiktok },
  ];

  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/property-tour/status/${jobId}`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to check status");
      }
      
      const data = await response.json();
      setGenerationProgress(data.progress || 0);
      setStatusMessage(data.message || "Processing...");
      
      if (data.motionVideos && data.motionVideos.length > 0) {
        setMotionVideos(data.motionVideos);
      }
      
      if (data.status === "completed") {
        setGenerationComplete(true);
        setIsGenerating(false);
        if (data.finalVideoUrl) {
          setGeneratedVideoUrl(data.finalVideoUrl);
        }
        if (data.motionVideos) {
          setMotionVideos(data.motionVideos);
        }
        if (data.avatarVideoUrl) {
          setAvatarVideoUrl(data.avatarVideoUrl);
        }
        const avatarMsg = data.avatarVideoUrl ? " and avatar narration" : "";
        toast({
          title: "Video Generation Complete",
          description: `Generated ${data.motionVideos?.length || 1} motion clips${avatarMsg}!`,
        });
        return true;
      }
      
      if (data.status === "failed") {
        setIsGenerating(false);
        toast({
          title: "Generation Failed",
          description: data.error || "Video generation failed",
          variant: "destructive",
        });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Error polling status:", error);
      return false;
    }
  }, [toast]);

  const handleGenerateVideo = useCallback(async () => {
    if (!selectedAvatar || !generatedScript) return;
    if (!selectedProperty && !noMlsMode) return;
    
    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationComplete(false);
    setGeneratedVideoUrl(null);
    setMotionVideos([]);
    setAvatarVideoUrl(null);
    setStatusMessage("Starting video generation...");
    
    try {
      const photosWithRoomTypes: { url: string; roomType: string }[] = [];
      getRoomsWithPhotos().forEach(({ roomId, photos }) => {
        photos.forEach(photo => {
          photosWithRoomTypes.push({
            url: photo.url,
            roomType: roomId,
          });
        });
      });
      
      const photosToInclude = photosWithRoomTypes.map(p => p.url);
      const roomTypes = photosWithRoomTypes.map(p => p.roomType);

      const selectedAvatarData = avatarsData?.photos?.find(a => a.id === selectedAvatar);
      const avatarImageKey = selectedAvatarData?.image_key || selectedAvatarData?.id;

      const response = await fetch("/api/property-tour/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          photos: photosToInclude,
          roomTypes,
          avatarId: selectedAvatar,
          avatarImageKey,
          script: generatedScript,
          backgroundType,
          includeBranding,
          property: selectedProperty ? {
            address: selectedProperty.address,
            city: selectedProperty.city,
            state: selectedProperty.state,
            listPrice: selectedProperty.listPrice,
          } : {
            address: "Custom Tour",
            city: "",
            state: "",
            listPrice: 0,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start video generation");
      }

      const data = await response.json();
      const jobId = data.jobId;
      setCurrentJobId(jobId);
      
      toast({
        title: "Video Generation Started",
        description: `Estimated time: ${data.estimatedTime || "2-3 minutes"}`,
      });
      
      const pollInterval = setInterval(async () => {
        const isDone = await pollJobStatus(jobId);
        if (isDone) {
          clearInterval(pollInterval);
        }
      }, 5000);
      
    } catch (error: any) {
      setIsGenerating(false);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to start video generation",
        variant: "destructive",
      });
    }
  }, [selectedProperty, noMlsMode, selectedAvatar, generatedScript, getRoomsWithPhotos, backgroundType, includeBranding, toast, pollJobStatus, avatarsData]);

  const handleSaveToLibrary = useCallback(async () => {
    if (!currentJobId) return;
    if (!selectedProperty && !noMlsMode) return;
    
    setIsSavingToLibrary(true);
    try {
      const address = selectedProperty 
        ? `${selectedProperty.address}, ${selectedProperty.city}`
        : "Custom Tour";
      
      const response = await fetch("/api/property-tour/save-to-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          jobId: currentJobId,
          address,
          script: generatedScript,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save to library");
      }

      const data = await response.json();
      setSavedVideos(data.savedVideos || []);
      setSavedToLibrary(true);
      toast({
        title: "Saved to Library",
        description: `${data.savedVideos?.length || 0} videos saved to your library.`,
      });
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save videos to library",
        variant: "destructive",
      });
    } finally {
      setIsSavingToLibrary(false);
    }
  }, [currentJobId, selectedProperty, noMlsMode, generatedScript, toast]);

  const handleOpenShareDialog = useCallback(() => {
    if (!selectedProperty && !noMlsMode) return;
    
    const defaultContent = selectedProperty 
      ? `🏠 Just listed! Beautiful property at ${selectedProperty.address}, ${selectedProperty.city}, ${selectedProperty.state}. Listed at $${selectedProperty.listPrice.toLocaleString()}. Check out this virtual tour! #RealEstate #PropertyTour #NewListing`
      : `🏠 Check out this amazing property tour! #RealEstate #PropertyTour`;
    setShareContent(defaultContent);
    
    const defaultVideo = avatarVideoUrl || (motionVideos.length > 0 ? motionVideos[0] : "");
    setSelectedVideoForShare(defaultVideo);
    setSelectedPlatform("");
    setShowShareDialog(true);
  }, [selectedProperty, noMlsMode, avatarVideoUrl, motionVideos]);

  const handleShareToSocial = useCallback(async () => {
    if (!selectedPlatform || !selectedVideoForShare || !shareContent) {
      toast({
        title: "Missing Information",
        description: "Please select a platform, video, and add content text.",
        variant: "destructive",
      });
      return;
    }

    if (!savedToLibrary || savedVideos.length === 0) {
      toast({
        title: "Save to Library First",
        description: "Please save videos to your library before sharing to social media.",
        variant: "destructive",
      });
      return;
    }

    const selectedVideo = savedVideos.find(v => v.url === selectedVideoForShare);
    if (!selectedVideo) {
      toast({
        title: "Error",
        description: "Selected video not found. Please save videos first.",
        variant: "destructive",
      });
      return;
    }

    setIsPosting(true);
    try {
      const response = await apiRequest("POST", "/api/social/post", {
        platform: selectedPlatform,
        content: shareContent,
        mediaType: "video",
        mediaId: selectedVideo.id,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to share to social media");
      }

      toast({
        title: "Shared Successfully",
        description: `Your property tour video has been shared to ${selectedPlatform}.`,
      });
      setShowShareDialog(false);
    } catch (error: any) {
      toast({
        title: "Share Failed",
        description: error.message || "Failed to share to social media",
        variant: "destructive",
      });
    } finally {
      setIsPosting(false);
    }
  }, [selectedPlatform, selectedVideoForShare, shareContent, savedToLibrary, savedVideos, toast]);

  const getVideoOptions = useCallback(() => {
    const options: { value: string; label: string }[] = [];
    if (avatarVideoUrl) {
      options.push({ value: avatarVideoUrl, label: "Avatar Narration" });
    }
    motionVideos.forEach((url, index) => {
      options.push({ value: url, label: `Motion Clip ${index + 1}` });
    });
    return options;
  }, [avatarVideoUrl, motionVideos]);

  const canProceedToStep = (step: number): boolean => {
    switch (step) {
      case 2:
        return selectedProperty !== null || noMlsMode;
      case 3:
        return getTotalRoomPhotoCount() > 0;
      case 4:
        return selectedAvatar !== "" && generatedScript.trim() !== "";
      default:
        return true;
    }
  };

  const goToNextStep = () => {
    if (currentStep < 4 && canProceedToStep(currentStep + 1)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const selectedPhotoCount = selectedPhotos.filter(p => p.selected).length;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Property Tour Studio
        </CardTitle>
        <CardDescription>
          Create professional property tour videos with AI-powered narration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                  currentStep === step.id
                    ? "bg-primary text-primary-foreground"
                    : currentStep > step.id
                    ? "bg-green-500/20 text-green-600 dark:text-green-400"
                    : "bg-muted text-muted-foreground"
                }`}
                onClick={() => step.id <= currentStep && setCurrentStep(step.id)}
                data-testid={`step-${step.id}`}
              >
                {currentStep > step.id ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <step.icon className="h-4 w-4" />
                )}
                <span className="text-sm font-medium hidden sm:inline">{step.title}</span>
              </div>
              {index < STEPS.length - 1 && (
                <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

        {currentStep === 1 && (
          <div className="space-y-4" data-testid="step-1-content">
            <PropertySelector
              onSelectProperty={handlePropertySelect}
              selectedProperty={selectedProperty}
            />
            {selectedProperty && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Selected Property</h4>
                <p className="text-sm" data-testid="selected-property-address">
                  {selectedProperty.address}, {selectedProperty.city}, {selectedProperty.state}
                </p>
                <p className="text-sm text-muted-foreground">
                  ${selectedProperty.listPrice.toLocaleString()} • {selectedProperty.photoUrls?.length || 0} photos available
                </p>
              </div>
            )}
            <div className="flex items-center gap-4 my-4">
              <div className="flex-1 border-t border-muted" />
              <span className="text-sm text-muted-foreground">or</span>
              <div className="flex-1 border-t border-muted" />
            </div>
            <Button 
              variant="outline"
              onClick={() => {
                setNoMlsMode(true);
                setSelectedProperty(null);
                setSelectedPhotos([]);
                setUploadedPhotos([]);
                setGeneratedScript("");
                setCurrentStep(2);
              }}
              className="w-full"
              data-testid="skip-mls-button"
            >
              <Upload className="h-4 w-4 mr-2" />
              Create Without MLS - Use My Own Photos
            </Button>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6" data-testid="step-2-content">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h4 className="font-medium">Property Floor Plan</h4>
                <p className="text-sm text-muted-foreground">
                  Click on a room to add photos (up to 6 per room). Drag photos directly onto rooms.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" data-testid="photo-count">
                  {getTotalRoomPhotoCount()} photos in {getRoomsWithPhotos().length} rooms
                </Badge>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowGlobalUploadModal(true)}
                  data-testid="global-upload-btn"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Photos
                </Button>
              </div>
            </div>

            {unassignedPhotos.length > 0 && (
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium text-sm">Unassigned Photos</h5>
                  <span className="text-xs text-muted-foreground">Drag to a room below</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {unassignedPhotos.map((photo, index) => (
                    <div
                      key={`unassigned-${index}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify(photo));
                      }}
                      className="w-20 h-14 rounded-md overflow-hidden border-2 border-dashed border-muted-foreground/30 cursor-grab hover:border-primary transition-colors"
                      data-testid={`unassigned-photo-${index}`}
                    >
                      <img src={photo.url} alt="Unassigned" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Tabs defaultValue="interior" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="interior" data-testid="tab-interior">
                  Interior Rooms ({ROOM_ZONES.filter(r => r.roomType === "interior").length})
                </TabsTrigger>
                <TabsTrigger value="exterior" data-testid="tab-exterior">
                  Exterior Areas ({ROOM_ZONES.filter(r => r.roomType === "exterior").length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="interior" className="mt-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {ROOM_ZONES.filter(room => room.roomType === "interior").map((room) => {
                    const photos = roomPhotos[room.roomId] || [];
                    const RoomIcon = getRoomIcon(room.roomId);
                    const hasPhotos = photos.length > 0;
                    const isFull = photos.length >= 6;
                    
                    return (
                      <div
                        key={room.roomId}
                        onClick={() => handleRoomClick(room.roomId)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setRoomDragOver(room.roomId);
                        }}
                        onDragLeave={() => setRoomDragOver(null)}
                        onDrop={(e) => handleRoomDrop(e, room.roomId)}
                        className={`relative p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                          roomDragOver === room.roomId
                            ? "border-primary bg-primary/10"
                            : hasPhotos
                            ? "border-primary/50 bg-primary/5"
                            : "border-dashed border-muted-foreground/30 hover:border-primary/50"
                        } ${isFull ? "ring-2 ring-green-500/30" : ""}`}
                        data-testid={`room-zone-${room.roomId}`}
                      >
                        <div className="flex flex-col items-center gap-2 text-center">
                          {hasPhotos && photos[0] ? (
                            <div className="w-12 h-12 rounded-md overflow-hidden">
                              <img 
                                src={photos[0].url} 
                                alt={room.roomName}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
                              <RoomIcon className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <span className="text-xs font-medium leading-tight">{room.roomName}</span>
                          <Badge 
                            variant={hasPhotos ? "default" : "secondary"} 
                            className="text-xs py-0 h-5"
                          >
                            {photos.length}/6
                          </Badge>
                        </div>
                        {hasPhotos && photos.length > 1 && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                            +{photos.length - 1}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="exterior" className="mt-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {ROOM_ZONES.filter(room => room.roomType === "exterior").map((room) => {
                    const photos = roomPhotos[room.roomId] || [];
                    const RoomIcon = getRoomIcon(room.roomId);
                    const hasPhotos = photos.length > 0;
                    const isFull = photos.length >= 6;
                    
                    return (
                      <div
                        key={room.roomId}
                        onClick={() => handleRoomClick(room.roomId)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setRoomDragOver(room.roomId);
                        }}
                        onDragLeave={() => setRoomDragOver(null)}
                        onDrop={(e) => handleRoomDrop(e, room.roomId)}
                        className={`relative p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                          roomDragOver === room.roomId
                            ? "border-primary bg-primary/10"
                            : hasPhotos
                            ? "border-primary/50 bg-primary/5"
                            : "border-dashed border-muted-foreground/30 hover:border-primary/50"
                        } ${isFull ? "ring-2 ring-green-500/30" : ""}`}
                        data-testid={`room-zone-${room.roomId}`}
                      >
                        <div className="flex flex-col items-center gap-2 text-center">
                          {hasPhotos && photos[0] ? (
                            <div className="w-12 h-12 rounded-md overflow-hidden">
                              <img 
                                src={photos[0].url} 
                                alt={room.roomName}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
                              <RoomIcon className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <span className="text-xs font-medium leading-tight">{room.roomName}</span>
                          <Badge 
                            variant={hasPhotos ? "default" : "secondary"} 
                            className="text-xs py-0 h-5"
                          >
                            {photos.length}/6
                          </Badge>
                        </div>
                        {hasPhotos && photos.length > 1 && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                            +{photos.length - 1}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>

            {getTotalRoomPhotoCount() === 0 && (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                <Image className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No photos added yet</p>
                <p className="text-sm">Click on any room above to add photos, or use the Upload button</p>
              </div>
            )}
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6" data-testid="step-3-content">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="avatar-select">Select Avatar</Label>
                  <Select value={selectedAvatar} onValueChange={setSelectedAvatar}>
                    <SelectTrigger id="avatar-select" data-testid="avatar-select">
                      <SelectValue placeholder="Choose an avatar for narration" />
                    </SelectTrigger>
                    <SelectContent>
                      {avatarsLoading ? (
                        <SelectItem value="loading" disabled>
                          Loading avatars...
                        </SelectItem>
                      ) : (
                        <>
                          <SelectItem value="no-avatar">
                            <div className="flex items-center gap-2">
                              <Video className="w-6 h-6 text-muted-foreground" />
                              No Avatar (Video Only)
                            </div>
                          </SelectItem>
                          {avatarsData?.photos && avatarsData.photos.length > 0 ? (
                            avatarsData.photos.map((avatar) => (
                              <SelectItem key={avatar.id} value={avatar.id}>
                                <div className="flex items-center gap-2">
                                  {avatar.url ? (
                                    <img
                                      src={avatar.url}
                                      alt={avatar.title || "Avatar"}
                                      className="w-6 h-6 rounded-full object-cover"
                                    />
                                  ) : (
                                    <User className="w-6 h-6" />
                                  )}
                                  {avatar.title || "Unnamed Avatar"}
                                </div>
                              </SelectItem>
                            ))
                          ) : null}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Background Style</Label>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                    {BACKGROUND_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        variant={backgroundType === option.value ? "default" : "outline"}
                        className="flex flex-col items-center gap-1 h-auto py-3"
                        onClick={() => setBackgroundType(option.value)}
                        data-testid={`background-${option.value}`}
                      >
                        <option.icon className="h-5 w-5" />
                        <span className="text-xs">{option.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="branding-toggle">Agent Branding</Label>
                    <p className="text-xs text-muted-foreground">
                      Include your branding overlay
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${!includeBranding ? "font-medium" : "text-muted-foreground"}`}>No</span>
                    <Switch
                      id="branding-toggle"
                      checked={includeBranding}
                      onCheckedChange={setIncludeBranding}
                      data-testid="branding-toggle"
                    />
                    <span className={`text-sm ${includeBranding ? "font-medium" : "text-muted-foreground"}`}>Yes</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="script-textarea">Tour Script</Label>
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Add custom instructions for script generation (e.g., 'emphasize the backyard' or 'mention nearby schools')..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="flex-1"
                    data-testid="custom-prompt-input"
                  />
                  {selectedProperty && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleGenerateScript}
                      disabled={generateScriptMutation.isPending}
                      data-testid="generate-script-btn"
                    >
                      {generateScriptMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4 mr-2" />
                      )}
                      Generate Script
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="script-style">Script Style</Label>
                    <Select value={scriptStyle} onValueChange={setScriptStyle}>
                      <SelectTrigger id="script-style" data-testid="script-style-select">
                        <SelectValue placeholder="Select style" />
                      </SelectTrigger>
                      <SelectContent>
                        {SCRIPT_STYLES.map((style) => (
                          <SelectItem key={style.value} value={style.value}>
                            <div className="flex flex-col">
                              <span>{style.label}</span>
                              <span className="text-xs text-muted-foreground">{style.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="target-platform">Target Platform</Label>
                    <Select value={targetPlatform} onValueChange={setTargetPlatform}>
                      <SelectTrigger id="target-platform" data-testid="target-platform-select">
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                      <SelectContent>
                        {TARGET_PLATFORMS.map((platform) => (
                          <SelectItem key={platform.value} value={platform.value}>
                            <div className="flex items-center gap-2">
                              <platform.icon className="h-4 w-4" />
                              <span>{platform.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="video-duration">Video Duration</Label>
                    <Select value={videoDuration} onValueChange={setVideoDuration}>
                      <SelectTrigger id="video-duration" data-testid="video-duration-select">
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                      <SelectContent>
                        {VIDEO_DURATIONS.map((duration) => (
                          <SelectItem key={duration.value} value={duration.value}>
                            <div className="flex items-center gap-2">
                              <span>{duration.label}</span>
                              <span className="text-xs text-muted-foreground">(~{duration.targetWords} words)</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {noMlsMode && (
                  <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                    Since you're creating a tour without MLS data, please write your own script for the avatar narration.
                  </div>
                )}
                <Textarea
                  id="script-textarea"
                  placeholder={noMlsMode 
                    ? "Write your property tour narration script here. Describe the property features, location, and highlights you want the avatar to present."
                    : "Your property tour narration script will appear here. Click 'Generate Script' to create one based on the property's MLS data, or write your own."
                  }
                  value={generatedScript}
                  onChange={(e) => setGeneratedScript(e.target.value)}
                  className="min-h-[200px]"
                  data-testid="script-textarea"
                />
                {(() => {
                  const platform = TARGET_PLATFORMS.find(p => p.value === targetPlatform) || TARGET_PLATFORMS[0];
                  const duration = VIDEO_DURATIONS.find(d => d.value === videoDuration) || VIDEO_DURATIONS[1];
                  const charCount = generatedScript.length;
                  const charLimit = platform.charLimit;
                  const wordCount = generatedScript.trim() ? generatedScript.trim().split(/\s+/).length : 0;
                  const targetWords = duration.targetWords;
                  
                  const isOverPlatformLimit = charCount > charLimit;
                  const isOverDurationTarget = wordCount > targetWords * 1.1;
                  const isUnderDurationTarget = wordCount < targetWords * 0.7;
                  
                  let wordStatus = "text-muted-foreground";
                  if (isOverDurationTarget) wordStatus = "text-red-500 font-medium";
                  else if (isUnderDurationTarget && wordCount > 0) wordStatus = "text-yellow-500";
                  
                  return (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-4">
                          <span className={wordStatus}>
                            {wordCount} / {targetWords} words
                            {isOverDurationTarget && " (too long for video)"}
                          </span>
                          <span className={isOverPlatformLimit ? "text-red-500 font-medium" : "text-muted-foreground"}>
                            {charCount} / {charLimit} chars ({platform.label})
                            {isOverPlatformLimit && " (over limit)"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Play className="h-3 w-3" />
                          <span>Target: {duration.label}</span>
                        </div>
                      </div>
                      <Progress 
                        value={Math.min((wordCount / targetWords) * 100, 100)} 
                        className="h-1"
                      />
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6" data-testid="step-4-content">
            <div className="p-6 bg-muted rounded-lg space-y-4">
              <h4 className="font-medium">Tour Summary</h4>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Property:</span>
                  <p data-testid="summary-property">{selectedProperty?.address || (noMlsMode ? "Custom Tour (No MLS)" : "N/A")}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Photos:</span>
                  <p data-testid="summary-photos">{getTotalRoomPhotoCount()} in {getRoomsWithPhotos().length} rooms</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Avatar:</span>
                  <p data-testid="summary-avatar">
                    {selectedAvatar === "no-avatar" ? "No Avatar (Video Only)" : avatarsData?.photos?.find(a => a.id === selectedAvatar)?.title || "Selected"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Background:</span>
                  <p data-testid="summary-background" className="capitalize">{backgroundType}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Branding:</span>
                  <p data-testid="summary-branding">{includeBranding ? "Enabled" : "Disabled"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Script:</span>
                  <p data-testid="summary-script">{generatedScript.length} characters</p>
                </div>
              </div>
            </div>

            {isGenerating && (
              <div className="space-y-2" data-testid="generation-progress">
                <div className="flex items-center justify-between text-sm">
                  <span>{statusMessage || "Generating video..."}</span>
                  <span>{generationProgress}%</span>
                </div>
                <Progress value={generationProgress} />
                <p className="text-xs text-muted-foreground text-center">
                  This may take 2-3 minutes. Please keep this page open.
                </p>
              </div>
            )}

            {generationComplete && (
              <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-lg space-y-4" data-testid="generation-complete">
                <div className="flex items-center gap-3">
                  <Check className="h-6 w-6 text-green-500" />
                  <div>
                    <h4 className="font-medium text-green-600 dark:text-green-400">
                      Property Tour Videos Generated
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {motionVideos.length} motion clips{avatarVideoUrl ? " and avatar narration" : ""} are ready.
                    </p>
                  </div>
                </div>
                
                {avatarVideoUrl && (
                  <div className="space-y-3">
                    <h5 className="font-medium text-sm">Avatar Narration</h5>
                    <div className="rounded-lg overflow-hidden border bg-black max-w-2xl mx-auto">
                      <video
                        src={avatarVideoUrl}
                        controls
                        className="w-full aspect-video"
                        data-testid="avatar-video-player"
                      />
                      <div className="bg-muted p-2 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Avatar Introduction</span>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 gap-1 text-xs"
                          asChild
                        >
                          <a href={avatarVideoUrl} download target="_blank" rel="noopener noreferrer">
                            <Download className="h-3 w-3" />
                            Save
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                
                {motionVideos.length > 0 && (
                  <div className="space-y-3">
                    <h5 className="font-medium text-sm">Property Motion Clips</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {motionVideos.map((videoUrl, index) => (
                        <div key={index} className="rounded-lg overflow-hidden border bg-black">
                          <video
                            src={videoUrl}
                            controls
                            className="w-full aspect-video"
                            data-testid={`motion-video-${index}`}
                          />
                          <div className="bg-muted p-2 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Clip {index + 1}</span>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-6 gap-1 text-xs"
                              asChild
                            >
                              <a href={videoUrl} download target="_blank" rel="noopener noreferrer">
                                <Download className="h-3 w-3" />
                                Save
                              </a>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-3 justify-center pt-2">
                  <Button
                    variant="default"
                    className="gap-2"
                    onClick={handleSaveToLibrary}
                    disabled={savedToLibrary || isSavingToLibrary}
                    data-testid="save-to-library-btn"
                  >
                    {isSavingToLibrary ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : savedToLibrary ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Library className="h-4 w-4" />
                    )}
                    {savedToLibrary ? "Saved to Library" : "Save to Library"}
                  </Button>
                  {savedToLibrary && (
                    <Link href="/dashboard?tab=videos">
                      <Button
                        variant="outline"
                        className="gap-2"
                        data-testid="view-library-btn"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View in Library
                      </Button>
                    </Link>
                  )}
                  <Button
                    variant="secondary"
                    className="gap-2"
                    onClick={handleOpenShareDialog}
                    data-testid="share-to-social-btn"
                  >
                    <Share2 className="h-4 w-4" />
                    Share to Social Media
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      setGenerationComplete(false);
                      setGeneratedVideoUrl(null);
                      setMotionVideos([]);
                      setAvatarVideoUrl(null);
                      setSavedToLibrary(false);
                      setSavedVideos([]);
                      setCurrentStep(1);
                    }}
                    data-testid="create-another-btn"
                  >
                    <Video className="h-4 w-4" />
                    Create Another Tour
                  </Button>
                </div>
              </div>
            )}

            {!isGenerating && !generationComplete && (
              <div className="flex justify-center">
                <Button
                  size="lg"
                  onClick={handleGenerateVideo}
                  disabled={!canProceedToStep(4)}
                  className="gap-2"
                  data-testid="generate-video-btn"
                >
                  <Video className="h-5 w-5" />
                  Generate Tour Video
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={goToPreviousStep}
            disabled={currentStep === 1}
            data-testid="prev-step-btn"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          
          {currentStep < 4 ? (
            <Button
              onClick={goToNextStep}
              disabled={!canProceedToStep(currentStep + 1)}
              data-testid="next-step-btn"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <div />
          )}
        </div>
      </CardContent>

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-[500px]" data-testid="share-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share to Social Media
            </DialogTitle>
            <DialogDescription>
              Share your property tour video to social media platforms.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {!savedToLibrary && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm">
                <p className="text-yellow-600 dark:text-yellow-400">
                  Please save videos to your library first before sharing to social media.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="platform-select">Platform</Label>
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger id="platform-select" data-testid="share-platform-select">
                  <SelectValue placeholder="Select a platform" />
                </SelectTrigger>
                <SelectContent>
                  {SOCIAL_PLATFORMS.map((platform) => (
                    <SelectItem key={platform.value} value={platform.value}>
                      <div className="flex items-center gap-2">
                        <platform.icon className="h-4 w-4" />
                        {platform.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="video-select">Video to Share</Label>
              <Select value={selectedVideoForShare} onValueChange={setSelectedVideoForShare}>
                <SelectTrigger id="video-select" data-testid="share-video-select">
                  <SelectValue placeholder="Select a video" />
                </SelectTrigger>
                <SelectContent>
                  {getVideoOptions().map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="share-content">Post Content</Label>
              <Textarea
                id="share-content"
                value={shareContent}
                onChange={(e) => setShareContent(e.target.value)}
                className="min-h-[120px]"
                placeholder="Write your post content..."
                data-testid="share-content-textarea"
              />
              <p className="text-xs text-muted-foreground">
                {shareContent.length} characters
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowShareDialog(false)}
              data-testid="share-cancel-btn"
            >
              Cancel
            </Button>
            <Button
              onClick={handleShareToSocial}
              disabled={isPosting || !savedToLibrary || !selectedPlatform}
              data-testid="share-post-btn"
            >
              {isPosting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4 mr-2" />
              )}
              {isPosting ? "Posting..." : "Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPhotoSelectModal} onOpenChange={setShowPhotoSelectModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" data-testid="photo-select-modal">
          <DialogHeader>
            <DialogTitle>Select Photos for Tour</DialogTitle>
            <DialogDescription>
              Choose which photos from this listing to include in your property tour. You can add more photos later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={selectAllPhotos} data-testid="select-all-photos-btn">
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAllPhotos} data-testid="deselect-all-photos-btn">
                Deselect All
              </Button>
              <span className="text-sm text-muted-foreground" data-testid="photo-selection-count">
                {tempPhotoSelection.filter(p => p.selected).length} of {tempPhotoSelection.length} selected
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {tempPhotoSelection.map((photo, index) => (
                <div
                  key={index}
                  onClick={() => toggleTempPhoto(index)}
                  className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                    photo.selected ? "border-primary ring-2 ring-primary/30" : "border-muted opacity-60"
                  }`}
                  data-testid={`temp-photo-${index}`}
                >
                  <img src={photo.url} alt={`Photo ${index + 1}`} className="w-full aspect-video object-cover" />
                  <div className="absolute top-2 right-2">
                    <Checkbox checked={photo.selected} />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 text-center">
                    Photo {index + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
                setShowPhotoSelectModal(false);
                setSelectedProperty(null);
              }} data-testid="photo-select-cancel-btn">
              Cancel
            </Button>
            <Button 
              onClick={confirmPhotoSelection}
              disabled={tempPhotoSelection.filter(p => p.selected).length === 0}
              data-testid="photo-select-confirm-btn"
            >
              Continue with {tempPhotoSelection.filter(p => p.selected).length} Photos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRoomModal} onOpenChange={(open) => {
        setShowRoomModal(open);
        if (!open) setSelectedRoomId(null);
      }}>
        <DialogContent className="max-w-2xl" data-testid="room-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedRoomId && (() => {
                const RoomIcon = getRoomIcon(selectedRoomId);
                return <RoomIcon className="h-5 w-5" />;
              })()}
              {ROOM_ZONES.find(r => r.roomId === selectedRoomId)?.roomName || "Room"}
            </DialogTitle>
            <DialogDescription>
              Add up to 6 photos for this room. Each room creates a 16-second panoramic video segment.
            </DialogDescription>
          </DialogHeader>
          
          {selectedRoomId && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">
                  {(roomPhotos[selectedRoomId] || []).length}/6 photos
                </Badge>
                <label className="cursor-pointer">
                  <Input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={(e) => handleRoomFileUpload(e.target.files, selectedRoomId)}
                    data-testid="room-file-input"
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="pointer-events-none"
                    disabled={(roomPhotos[selectedRoomId] || []).length >= 6}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Photos
                  </Button>
                </label>
              </div>

              {(roomPhotos[selectedRoomId] || []).length === 0 ? (
                <div 
                  className="border-2 border-dashed rounded-lg p-8 text-center"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleRoomDrop(e, selectedRoomId)}
                >
                  <Image className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="font-medium">No photos yet</p>
                  <p className="text-sm text-muted-foreground">Drag and drop or click Add Photos</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {(roomPhotos[selectedRoomId] || []).map((photo, index) => (
                    <div
                      key={index}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", String(index));
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
                        if (!isNaN(fromIndex) && fromIndex !== index && selectedRoomId) {
                          reorderRoomPhotos(selectedRoomId, fromIndex, index);
                        }
                      }}
                      className="relative rounded-lg overflow-hidden border-2 border-muted group cursor-grab"
                      data-testid={`room-photo-${index}`}
                    >
                      <img 
                        src={photo.url} 
                        alt={`Photo ${index + 1}`}
                        className="w-full aspect-video object-cover"
                      />
                      <div className="absolute top-1 left-1 flex items-center gap-1">
                        <div className="bg-black/70 text-white px-1.5 py-0.5 rounded text-xs">
                          #{index + 1}
                        </div>
                        <GripVertical className="h-4 w-4 text-white drop-shadow" />
                      </div>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => selectedRoomId && removePhotoFromRoom(selectedRoomId, photo.url)}
                        data-testid={`remove-room-photo-${index}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowRoomModal(false)} data-testid="room-modal-close-btn">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showGlobalUploadModal} onOpenChange={setShowGlobalUploadModal}>
        <DialogContent className="max-w-xl" data-testid="global-upload-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Photos
            </DialogTitle>
            <DialogDescription>
              Upload photos and select which room to add them to.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Room</Label>
              <Select value={selectedRoomId || ""} onValueChange={setSelectedRoomId}>
                <SelectTrigger data-testid="upload-room-select">
                  <SelectValue placeholder="Choose a room" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">Add to Unassigned</SelectItem>
                  {ROOM_ZONES.map((room) => {
                    const count = (roomPhotos[room.roomId] || []).length;
                    const isFull = count >= 6;
                    return (
                      <SelectItem 
                        key={room.roomId} 
                        value={room.roomId}
                        disabled={isFull}
                      >
                        <div className="flex items-center justify-between gap-2 w-full">
                          <span>{room.roomName}</span>
                          <span className={`text-xs ${isFull ? "text-red-500" : "text-muted-foreground"}`}>
                            ({count}/6)
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const files = e.dataTransfer.files;
                if (selectedRoomId === "__unassigned__") {
                  Array.from(files).forEach(file => {
                    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
                    if (validTypes.includes(file.type)) {
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        const dataUrl = evt.target?.result as string;
                        if (dataUrl) {
                          setUnassignedPhotos(prev => [...prev, { url: dataUrl, source: "upload" }]);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  });
                } else if (selectedRoomId) {
                  handleRoomFileUpload(files, selectedRoomId);
                }
              }}
            >
              {isUploading ? (
                <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
              ) : (
                <>
                  <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="font-medium">Drag and drop photos here</p>
                  <p className="text-sm text-muted-foreground mb-3">or click to browse</p>
                  <label className="cursor-pointer">
                    <Input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (!files || !selectedRoomId) return;
                        
                        if (selectedRoomId === "__unassigned__") {
                          Array.from(files).forEach(file => {
                            const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
                            if (validTypes.includes(file.type)) {
                              const reader = new FileReader();
                              reader.onload = (evt) => {
                                const dataUrl = evt.target?.result as string;
                                if (dataUrl) {
                                  setUnassignedPhotos(prev => [...prev, { url: dataUrl, source: "upload" }]);
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          });
                          toast({
                            title: "Photos Added",
                            description: `Added ${files.length} photos to unassigned. Drag them to rooms.`,
                          });
                        } else {
                          handleRoomFileUpload(files, selectedRoomId);
                        }
                      }}
                    />
                    <Button variant="secondary" className="pointer-events-none">
                      Browse Files
                    </Button>
                  </label>
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowGlobalUploadModal(false)} data-testid="global-upload-close-btn">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
