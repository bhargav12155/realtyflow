import { useState, useCallback, useRef, useEffect } from "react";
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
  ChevronUp,
  ChevronDown,
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
  DoorOpen,
  AlertTriangle,
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

interface CameraPosition {
  x: number;
  y: number;
  photoIndex: number;
  direction?: number;
}

interface RoomPhotos {
  roomId: string;
  roomName: string;
  roomType: "interior" | "exterior";
  photos: RoomPhoto[];
  maxPhotos: 6;
}

// VEO 3.1: 6 photos per room (3 per clip), two 8-sec clips combined into smooth 16-sec room video
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

// VEO 3.1: 16-second dual-clip mode - two 8-sec clips combined per room
const ROOM_CLIP_DURATION = 16;

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
  const [selectedUnassigned, setSelectedUnassigned] = useState<Set<number>>(new Set());
  const [bulkAssignRoom, setBulkAssignRoom] = useState<string>("");
  const [roomDragOver, setRoomDragOver] = useState<string | null>(null);
  const [cameraPositions, setCameraPositions] = useState<Record<string, CameraPosition[]>>({});
    const [customPrompt, setCustomPrompt] = useState<string>("");
  const [tourOrder, setTourOrder] = useState<string[]>([]);
  const [roomConnections, setRoomConnections] = useState<{fromRoom: string; toRoom: string; label: string}[]>([]);
  const [connectionFrom, setConnectionFrom] = useState<string>("");
  const [connectionTo, setConnectionTo] = useState<string>("");
  const [connectionLabel, setConnectionLabel] = useState<string>("");

  const [tourVideoEngine, setTourVideoEngine] = useState<"veo" | "sora2" | "luma">("veo");
  const [lumaModel, setLumaModel] = useState<"ray-2" | "ray-flash-2">("ray-2");
  const [sjinnTourChatId, setSjinnTourChatId] = useState<string | null>(null);
  const [sjinnTourStatus, setSjinnTourStatus] = useState<"idle" | "pending" | "processing" | "completed" | "failed">("idle");
  const [sjinnTourVideoUrl, setSjinnTourVideoUrl] = useState<string | null>(null);
  const sjinnTourPollRef = useRef<NodeJS.Timeout | null>(null);
  const sjinnTourStartTimeRef = useRef<number | null>(null);
  const [sjinnTourElapsed, setSjinnTourElapsed] = useState(0);
  const sjinnTourElapsedRef = useRef<NodeJS.Timeout | null>(null);

  const { data: avatarsData, isLoading: avatarsLoading } = useQuery<{ photos: AvatarPhoto[] }>({
    queryKey: ["/api/avatar-iv/photos"],
    enabled: currentStep >= 3,
  });

  const generateScriptMutation = useMutation({
    mutationFn: async (property: Property) => {
      const propertyDetails = `
Property Address: ${property.address}, ${property.city}, ${property.state} ${property.zipCode}
List Price: ${property.listPrice !== null ? `$${property.listPrice.toLocaleString()}` : "Not provided"}
${property.bedrooms ? `Bedrooms: ${property.bedrooms}` : ""}
${property.bathrooms ? `Bathrooms: ${property.bathrooms}` : ""}
${property.squareFootage ? `Square Footage: ${property.squareFootage.toLocaleString()} sq ft` : ""}
Property Type: ${property.propertyType}
${property.neighborhood ? `Neighborhood: ${property.neighborhood}` : ""}
${property.description ? `Description: ${property.description}` : ""}
${property.features && property.features.length > 0 ? `Features: ${property.features.join(", ")}` : ""}
`.trim();

      const selectedStyle = SCRIPT_STYLES.find(s => s.value === scriptStyle) || SCRIPT_STYLES[0];
      // Calculate target words based on number of rooms (8 seconds per room, ~2 words per second)
      const roomCount = tourOrder.length || Object.keys(roomPhotos).filter(k => roomPhotos[k]?.length > 0).length || 3;
      const totalDuration = roomCount * ROOM_CLIP_DURATION;
      const targetWordCount = Math.floor(totalDuration * 2); // ~2 words per second for narration

      const userInstructions = customPrompt.trim() 
        ? `\n\nADDITIONAL USER INSTRUCTIONS:\n${customPrompt.trim()}`
        : "";

      const message = `You are a professional real estate video script writer. ${selectedStyle.prompt}

IMPORTANT RULES:
- Only describe features that are explicitly mentioned in the property data provided
- Do not make up or assume any features, amenities, or characteristics not in the MLS data
- Keep the script around ${targetWordCount} words for a ${totalDuration} second video (${roomCount} rooms x 8 seconds each)
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
          description: "This room already has 6 photos (maximum for dual-clip mode).",
          variant: "destructive",
        });
        return prev;
      }
      // Auto-add to tour order when first photo added
      if (currentPhotos.length === 0) {
        setTourOrder(order => order.includes(roomId) ? order : [...order, roomId]);
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
      if (filtered.length === 0) {
        setTourOrder(order => order.filter(id => id !== roomId));
      }
      return {
        ...prev,
        [roomId]: filtered.map((p, i) => ({ ...p, order: i })),
      };
    });
    setCameraPositions(prev => ({ ...prev, [roomId]: [] }));
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
    setCameraPositions(prev => ({ ...prev, [roomId]: [] }));
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

  const handleBulkAssign = useCallback(() => {
    if (!bulkAssignRoom || selectedUnassigned.size === 0) return;
    const indices = Array.from(selectedUnassigned).sort((a, b) => a - b);
    indices.forEach(idx => {
      const photo = unassignedPhotos[idx];
      if (photo) addPhotoToRoom(bulkAssignRoom, photo.url, photo.source);
    });
    setUnassignedPhotos(prev => prev.filter((_, i) => !selectedUnassigned.has(i)));
    setSelectedUnassigned(new Set());
    setBulkAssignRoom("");
  }, [bulkAssignRoom, selectedUnassigned, unassignedPhotos, addPhotoToRoom]);

  const handleRoomClick = useCallback((roomId: string) => {
    setSelectedRoomId(roomId);
    setShowRoomModal(true);
  }, []);

  const handleRoomFileUpload = useCallback((files: FileList | null, roomId: string) => {
    if (!files || files.length === 0) return;
    
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const currentCount = roomPhotos[roomId]?.length || 0;
    const slotsAvailable = 6 - currentCount;
    
    if (slotsAvailable <= 0) {
      toast({
        title: "Room Full",
        description: "This room already has 6 photos (maximum for dual-clip mode).",
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
        description: `Only ${slotsAvailable} photos added. Room limit is 6 for dual-clip mode.`,
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
  const [combinedTourUrl, setCombinedTourUrl] = useState<string | null>(null);
  const [avatarVideoUrl, setAvatarVideoUrl] = useState<string | null>(null);
  const [roomVideoMap, setRoomVideoMap] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [savedToLibrary, setSavedToLibrary] = useState<boolean>(false);
  const [savedVideos, setSavedVideos] = useState<{ url: string; id: string; title: string }[]>([]);
  const [showShareDialog, setShowShareDialog] = useState<boolean>(false);
  const [selectedVideoForShare, setSelectedVideoForShare] = useState<string>("");
  const [shareContent, setShareContent] = useState<string>("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");
  const [isSavingToLibrary, setIsSavingToLibrary] = useState<boolean>(false);
  const [isPosting, setIsPosting] = useState<boolean>(false);
  const [selectedRoomsForCombine, setSelectedRoomsForCombine] = useState<Set<string>>(new Set());
  const [isCombining, setIsCombining] = useState(false);

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
      if (data.roomVideoMap) {
        setRoomVideoMap(data.roomVideoMap);
      }
      if (data.combinedTourUrl) {
        setCombinedTourUrl(data.combinedTourUrl);
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
        if (data.combinedTourUrl) {
          setCombinedTourUrl(data.combinedTourUrl);
        }
        if (data.avatarVideoUrl) {
          setAvatarVideoUrl(data.avatarVideoUrl);
        }
        if (data.roomVideoMap) {
          setRoomVideoMap(data.roomVideoMap);
        }
        
        // Show quota warning if VEO quota was exceeded
        if (data.quotaExceeded) {
          toast({
            title: "VEO Quota Exceeded",
            description: "Video was created using simplified effects. Upgrade your Gemini API plan for HD quality.",
            variant: "destructive",
          });
        }
        
        const tourMsg = data.combinedTourUrl ? " complete tour" : `${data.motionVideos?.length || 1} room clips`;
        const avatarMsg = data.avatarVideoUrl ? " + avatar narration" : "";
        toast({
          title: "Video Generation Complete",
          description: `Generated ${tourMsg}${avatarMsg}!`,
        });
        return true;
      }
      
      if (data.status === "failed") {
        setIsGenerating(false);
        
        let errorTitle = "Generation Failed";
        let errorDescription = data.error || "Video generation failed. Please try again.";
        
        if (data.errorType === "safety_filter") {
          errorTitle = "Content Blocked";
          errorDescription = data.error || "Video was blocked by content filters. Try rephrasing your prompt or using a different image.";
        } else if (data.errorType === "transient" || (data.error && data.error.includes("No video in response"))) {
          errorTitle = "Generation Failed — Temporary Issue";
          errorDescription = "The video API returned an empty response. This is usually a temporary issue. Please try again, or use a different photo.";
        } else if (data.quotaExceeded) {
          errorTitle = "API Quota Exceeded";
          errorDescription = data.error || "Your Gemini API quota has been exceeded. Please wait for it to reset or upgrade your plan.";
        }
        
        toast({
          title: errorTitle,
          description: errorDescription,
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
    if (!selectedAvatar) return;
    if (!selectedProperty && !noMlsMode) return;
    
    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationComplete(false);
    setGeneratedVideoUrl(null);
    setMotionVideos([]);
    setCombinedTourUrl(null);
    setAvatarVideoUrl(null);
    setRoomVideoMap({});
    setSelectedRoomsForCombine(new Set());
    setStatusMessage("Starting video generation...");
    
    try {
      // Prepare photos in tour order (rooms in sequence, photos within each room)
      const photosWithRoomTypes: { url: string; roomType: string }[] = [];
      const orderedRooms = tourOrder.length > 0 ? tourOrder : getRoomsWithPhotos().map(r => r.roomId);
      orderedRooms.forEach((roomId) => {
        const photos = roomPhotos[roomId] || [];
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
          tourOrder: orderedRooms,
          avatarId: selectedAvatar,
          avatarImageKey,
          script: generatedScript,
          backgroundType,
          includeBranding,
          engine: tourVideoEngine,
          lumaModel: tourVideoEngine === "luma" ? lumaModel : undefined,
          roomClipDuration: ROOM_CLIP_DURATION,
          cameraPositions,
          roomConnections,
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
  }, [selectedProperty, noMlsMode, selectedAvatar, generatedScript, getRoomsWithPhotos, backgroundType, includeBranding, toast, pollJobStatus, avatarsData, tourVideoEngine, lumaModel, tourOrder, roomPhotos, cameraPositions, roomConnections]);

  const SORA2_TOUR_STORAGE_KEY = "sora2_tour_pending_task";
  const SORA2_TOUR_MAX_POLL_MS = 15 * 60 * 1000;
  const sjinnTourErrorCountRef = useRef(0);

  const stopSjinnTourPolling = useCallback(() => {
    if (sjinnTourPollRef.current) { clearInterval(sjinnTourPollRef.current); sjinnTourPollRef.current = null; }
    if (sjinnTourElapsedRef.current) { clearInterval(sjinnTourElapsedRef.current); sjinnTourElapsedRef.current = null; }
    sjinnTourStartTimeRef.current = null;
    setSjinnTourElapsed(0);
    sjinnTourErrorCountRef.current = 0;
  }, []);

  const clearSora2TourTask = useCallback(() => {
    try { localStorage.removeItem(SORA2_TOUR_STORAGE_KEY); } catch {}
  }, []);

  const startSjinnTourPolling = useCallback((taskId: string, startedAt?: number) => {
    stopSjinnTourPolling();
    const actualStartTime = startedAt || Date.now();
    sjinnTourStartTimeRef.current = actualStartTime;
    setSjinnTourElapsed(Math.floor((Date.now() - actualStartTime) / 1000));
    sjinnTourElapsedRef.current = setInterval(() => {
      if (sjinnTourStartTimeRef.current) {
        setSjinnTourElapsed(Math.floor((Date.now() - sjinnTourStartTimeRef.current) / 1000));
      }
    }, 1000);
    sjinnTourPollRef.current = setInterval(async () => {
      if (sjinnTourStartTimeRef.current && Date.now() - sjinnTourStartTimeRef.current > SORA2_TOUR_MAX_POLL_MS) {
        stopSjinnTourPolling();
        clearSora2TourTask();
        setSjinnTourStatus("failed");
        toast({ title: "Sora 2 Timeout", description: "Video generation took too long. Please try again.", variant: "destructive" });
        return;
      }
      try {
        const statusRes = await fetch(`/api/sora2/status/${taskId}`, { credentials: "include" });
        if (!statusRes.ok) {
          sjinnTourErrorCountRef.current++;
          if (sjinnTourErrorCountRef.current >= 20) {
            stopSjinnTourPolling();
            clearSora2TourTask();
            setSjinnTourStatus("failed");
            toast({ title: "Sora 2 Connection Lost", description: "Lost connection to server. Please try generating again.", variant: "destructive" });
          }
          return;
        }
        const statusData = await statusRes.json();
        sjinnTourErrorCountRef.current = 0;
        if (statusData.status === "completed" && statusData.videoUrl) {
          setSjinnTourVideoUrl(statusData.videoUrl);
          setSjinnTourStatus("completed");
          stopSjinnTourPolling();
          clearSora2TourTask();
          toast({ title: "Sora 2 Video Ready", description: "Your property tour video has been generated." });
          fetch("/api/sora2/notify-completion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ videoUrl: statusData.videoUrl, taskId }),
          }).catch((err) => console.warn("Sora2 completion notification failed:", err));
        } else if (statusData.status === "failed") {
          setSjinnTourStatus("failed");
          stopSjinnTourPolling();
          clearSora2TourTask();
          toast({ title: "Sora 2 Generation Failed", description: statusData.error || "Video generation failed.", variant: "destructive" });
        }
      } catch {
        sjinnTourErrorCountRef.current++;
        if (sjinnTourErrorCountRef.current >= 20) {
          stopSjinnTourPolling();
          clearSora2TourTask();
          setSjinnTourStatus("failed");
          toast({ title: "Sora 2 Connection Lost", description: "Lost connection to server. Please try generating again.", variant: "destructive" });
        }
      }
    }, 15000);
  }, [stopSjinnTourPolling, clearSora2TourTask, toast]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SORA2_TOUR_STORAGE_KEY);
      if (stored) {
        const { taskId, startedAt } = JSON.parse(stored);
        if (taskId && startedAt && Date.now() - startedAt < SORA2_TOUR_MAX_POLL_MS) {
          console.log(`🔄 Resuming Sora 2 tour polling for task ${taskId}`);
          setSjinnTourChatId(taskId);
          setSjinnTourStatus("processing");
          setTourVideoEngine("sora2");
          setCurrentStep(4);
          startSjinnTourPolling(taskId, startedAt);
        } else {
          clearSora2TourTask();
        }
      }
    } catch {}
    return () => stopSjinnTourPolling();
  }, []);

  const handleGenerateSora2Tour = useCallback(async () => {
    const rooms = getRoomsWithPhotos().map(r => r.roomId.replace(/-/g, " "));
    const address = selectedProperty
      ? `${selectedProperty.address}, ${selectedProperty.city}, ${selectedProperty.state}`
      : "custom property";
    const prompt = `Cinematic property tour video of ${address}. ${generatedScript ? generatedScript.slice(0, 300) : "Showcase each room with smooth camera movements."}. Rooms featured: ${rooms.join(", ")}. Style: professional real estate video with warm lighting and elegant transitions.`;

    setSjinnTourStatus("pending");
    setSjinnTourChatId(null);
    setSjinnTourVideoUrl(null);

    try {
      const res = await fetch("/api/sora2/create-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prompt, aspectRatio: "landscape", quality: "hd" }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to start Sora 2 generation");
      }
      const data = await res.json();
      const taskId = data.taskId;
      setSjinnTourChatId(taskId);
      setSjinnTourStatus("processing");
      try {
        localStorage.setItem(SORA2_TOUR_STORAGE_KEY, JSON.stringify({ taskId, startedAt: Date.now() }));
      } catch {}
      startSjinnTourPolling(taskId);
    } catch (error: any) {
      setSjinnTourStatus("failed");
      toast({ title: "Sora 2 Error", description: error.message || "Failed to start video generation.", variant: "destructive" });
    }
  }, [getRoomsWithPhotos, selectedProperty, generatedScript, toast, startSjinnTourPolling]);

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
      ? `🏠 Just listed! Beautiful property at ${selectedProperty.address}, ${selectedProperty.city}, ${selectedProperty.state}.${selectedProperty.listPrice !== null ? ` Listed at $${selectedProperty.listPrice.toLocaleString()}.` : ""} Check out this virtual tour! #RealEstate #PropertyTour #NewListing`
      : `🏠 Check out this amazing property tour! #RealEstate #PropertyTour`;
    setShareContent(defaultContent);
    
    const defaultVideo = combinedTourUrl || avatarVideoUrl || (motionVideos.length > 0 ? motionVideos[0] : "");
    setSelectedVideoForShare(defaultVideo);
    setSelectedPlatform("");
    setShowShareDialog(true);
  }, [selectedProperty, noMlsMode, combinedTourUrl, avatarVideoUrl, motionVideos]);

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
    Object.entries(roomVideoMap).forEach(([roomId, url]) => {
      const roomName = ROOM_ZONES.find(r => r.roomId === roomId)?.roomName || roomId;
      options.push({ value: url, label: `${roomName} Room Video` });
    });
    return options;
  }, [avatarVideoUrl, motionVideos, roomVideoMap]);

  const canProceedToStep = (step: number): boolean => {
    switch (step) {
      case 2:
        return selectedProperty !== null || noMlsMode;
      case 3:
        return getTotalRoomPhotoCount() > 0;
      case 4:
        return selectedAvatar !== "";
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
                  {selectedProperty.listPrice !== null ? `$${selectedProperty.listPrice.toLocaleString()}` : "Price not provided"} • {selectedProperty.photoUrls?.length || 0} photos available
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
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h5 className="font-medium text-sm">Unassigned Photos ({unassignedPhotos.length})</h5>
                  <div className="flex items-center gap-3">
                    <button
                      className="text-xs text-primary underline-offset-2 hover:underline"
                      data-testid="select-all-unassigned-btn"
                      onClick={() => {
                        if (selectedUnassigned.size === unassignedPhotos.length) {
                          setSelectedUnassigned(new Set());
                        } else {
                          setSelectedUnassigned(new Set(unassignedPhotos.map((_, i) => i)));
                        }
                      }}
                    >
                      {selectedUnassigned.size === unassignedPhotos.length ? "Deselect All" : "Select All"}
                    </button>
                    <span className="text-xs text-muted-foreground">or drag to a room below</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {unassignedPhotos.map((photo, index) => {
                    const isChecked = selectedUnassigned.has(index);
                    return (
                      <div
                        key={`unassigned-${index}`}
                        draggable={!isChecked}
                        onDragStart={(e) => {
                          if (isChecked) { e.preventDefault(); return; }
                          e.dataTransfer.setData("application/json", JSON.stringify(photo));
                        }}
                        className={`relative w-36 h-24 rounded-lg overflow-hidden border-2 transition-all cursor-grab hover:shadow-md ${
                          isChecked
                            ? "border-primary shadow-md ring-2 ring-primary/40"
                            : "border-dashed border-muted-foreground/30 hover:border-primary"
                        }`}
                        data-testid={`unassigned-photo-${index}`}
                      >
                        <img src={photo.url} alt="Unassigned" className="w-full h-full object-cover" />
                        <div
                          className="absolute top-1 left-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUnassigned(prev => {
                              const next = new Set(prev);
                              if (next.has(index)) next.delete(index);
                              else next.add(index);
                              return next;
                            });
                          }}
                        >
                          <Checkbox
                            checked={isChecked}
                            className="bg-white/90 border-white shadow data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            data-testid={`unassigned-check-${index}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedUnassigned.size > 0 && (
                  <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-muted-foreground/20">
                    <span className="text-sm font-medium">{selectedUnassigned.size} selected</span>
                    <Select value={bulkAssignRoom} onValueChange={setBulkAssignRoom}>
                      <SelectTrigger className="w-44 h-8 text-xs" data-testid="bulk-assign-room-select">
                        <SelectValue placeholder="Choose a room…" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROOM_ZONES.map(room => (
                          <SelectItem key={room.roomId} value={room.roomId}>{room.roomName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      disabled={!bulkAssignRoom}
                      onClick={handleBulkAssign}
                      data-testid="bulk-assign-btn"
                    >
                      Assign to Room
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setSelectedUnassigned(new Set()); setBulkAssignRoom(""); }}
                      data-testid="bulk-clear-btn"
                    >
                      Clear
                    </Button>
                  </div>
                )}
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
                    const isFull = photos.length >= 3;
                    const tourIndex = tourOrder.indexOf(room.roomId);
                    
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
                        {tourIndex >= 0 && (
                          <div className="absolute -top-2 -left-2 w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-md z-10">
                            {tourIndex + 1}
                          </div>
                        )}
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
                    const isFull = photos.length >= 3;
                    const tourIndex = tourOrder.indexOf(room.roomId);
                    
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
                        {tourIndex >= 0 && (
                          <div className="absolute -top-2 -left-2 w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-md z-10">
                            {tourIndex + 1}
                          </div>
                        )}
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

            {tourOrder.length > 0 && (
              <div className="mt-6 p-4 bg-muted/30 rounded-lg border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Film className="h-5 w-5 text-blue-600" />
                    <h4 className="font-medium">Tour Sequence</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {tourOrder.length} rooms • ~{tourOrder.length * ROOM_CLIP_DURATION}s total
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tourOrder.map((roomId, index) => {
                    const room = ROOM_ZONES.find(r => r.roomId === roomId);
                    const photoCount = (roomPhotos[roomId] || []).length;
                    return (
                      <div 
                        key={roomId}
                        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border shadow-sm"
                      >
                        <span className="w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium">{room?.roomName || roomId}</span>
                        <Badge variant="secondary" className="text-xs">{photoCount}</Badge>
                        <div className="flex gap-1 ml-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            disabled={index === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setTourOrder(prev => {
                                const newOrder = [...prev];
                                [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                                return newOrder;
                              });
                            }}
                            data-testid={`tour-move-up-${roomId}`}
                          >
                            <ChevronLeft className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            disabled={index === tourOrder.length - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              setTourOrder(prev => {
                                const newOrder = [...prev];
                                [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                                return newOrder;
                              });
                            }}
                            data-testid={`tour-move-down-${roomId}`}
                          >
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Use arrows to reorder rooms. Videos will be combined in this sequence with smooth transitions.
                </p>
              </div>
            )}

            {getRoomsWithPhotos().length >= 2 && (
              <div className="mt-4 p-4 bg-muted/20 rounded-lg border">
                <div className="flex items-center gap-2 mb-3">
                  <DoorOpen className="h-5 w-5 text-orange-600" />
                  <h4 className="font-medium">Room Connections</h4>
                  <span className="text-xs text-muted-foreground">(Optional - improves video transitions)</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Define how rooms connect to create smoother camera transitions between spaces in the tour video.
                </p>
                
                <div className="flex flex-wrap items-end gap-2 mb-3">
                  <div className="space-y-1">
                    <Label className="text-xs">From</Label>
                    <Select value={connectionFrom} onValueChange={setConnectionFrom}>
                      <SelectTrigger className="w-[150px] h-8 text-xs" data-testid="connection-from-select">
                        <SelectValue placeholder="Select room" />
                      </SelectTrigger>
                      <SelectContent>
                        {getRoomsWithPhotos().map(r => (
                          <SelectItem key={r.roomId} value={r.roomId}>{r.roomName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="text-muted-foreground pb-1 text-lg">→</span>
                  <div className="space-y-1">
                    <Label className="text-xs">To</Label>
                    <Select value={connectionTo} onValueChange={setConnectionTo}>
                      <SelectTrigger className="w-[150px] h-8 text-xs" data-testid="connection-to-select">
                        <SelectValue placeholder="Select room" />
                      </SelectTrigger>
                      <SelectContent>
                        {getRoomsWithPhotos().map(r => (
                          <SelectItem key={r.roomId} value={r.roomId}>{r.roomName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Entry Type</Label>
                    <Input 
                      placeholder="e.g., through hallway" 
                      value={connectionLabel}
                      onChange={(e) => setConnectionLabel(e.target.value)}
                      className="w-[150px] h-8 text-xs"
                      data-testid="connection-label-input"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    data-testid="add-connection-btn"
                    disabled={!connectionFrom || !connectionTo || connectionFrom === connectionTo}
                    onClick={() => {
                      if (!connectionFrom || !connectionTo || connectionFrom === connectionTo) return;
                      const exists = roomConnections.some(c => c.fromRoom === connectionFrom && c.toRoom === connectionTo);
                      if (exists) return;
                      setRoomConnections(prev => [...prev, { fromRoom: connectionFrom, toRoom: connectionTo, label: connectionLabel.trim() || "" }]);
                      setConnectionFrom("");
                      setConnectionTo("");
                      setConnectionLabel("");
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>

                {roomConnections.length > 0 && (
                  <div className="space-y-1.5">
                    {roomConnections.map((conn, idx) => {
                      const fromName = ROOM_ZONES.find(r => r.roomId === conn.fromRoom)?.roomName || conn.fromRoom;
                      const toName = ROOM_ZONES.find(r => r.roomId === conn.toRoom)?.roomName || conn.toRoom;
                      return (
                        <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 rounded border text-sm">
                          <DoorOpen className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                          <span className="font-medium">{fromName}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-medium">{toName}</span>
                          {conn.label && <span className="text-xs text-muted-foreground italic">({conn.label})</span>}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 ml-auto"
                            onClick={() => setRoomConnections(prev => prev.filter((_, i) => i !== idx))}
                            data-testid={`remove-connection-${idx}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

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

                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 text-sm">
                      <Film className="h-4 w-4 text-blue-600" />
                      <span className="font-medium">Video Duration:</span>
                      <span className="text-blue-700 dark:text-blue-400">
                        {tourOrder.length || Object.keys(roomPhotos).filter(k => roomPhotos[k]?.length > 0).length || 0} rooms × 16 seconds = ~{(tourOrder.length || Object.keys(roomPhotos).filter(k => roomPhotos[k]?.length > 0).length || 0) * ROOM_CLIP_DURATION}s
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">VEO 3.1: Up to 6 photos per room, two 8-sec clips combined into smooth 16-sec room video</p>
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
                  const roomCount = tourOrder.length || Object.keys(roomPhotos).filter(k => roomPhotos[k]?.length > 0).length || 3;
                  const totalDuration = roomCount * ROOM_CLIP_DURATION;
                  const targetWords = Math.floor(totalDuration * 2); // ~2 words per second
                  const wordCount = generatedScript.trim() ? generatedScript.trim().split(/\s+/).length : 0;
                  
                  const isOverTarget = wordCount > targetWords * 1.1;
                  const isUnderTarget = wordCount < targetWords * 0.7;
                  
                  let wordStatus = "text-muted-foreground";
                  if (isOverTarget) wordStatus = "text-red-500 font-medium";
                  else if (isUnderTarget && wordCount > 0) wordStatus = "text-yellow-500";
                  
                  return (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className={wordStatus}>
                          {wordCount} / {targetWords} words
                          {isOverTarget && " (too long for video)"}
                          {isUnderTarget && wordCount > 0 && " (could be longer)"}
                        </span>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Play className="h-3 w-3" />
                          <span>Target: {totalDuration}s video ({roomCount} rooms)</span>
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
            <div className="p-4 border rounded-lg space-y-3 bg-card">
              <Label className="text-sm font-semibold">AI Video Engine</Label>
              <Select value={tourVideoEngine} onValueChange={(v) => {
                setTourVideoEngine(v as typeof tourVideoEngine);
                stopSjinnTourPolling();
                clearSora2TourTask();
                setSjinnTourStatus("idle");
                setSjinnTourChatId(null);
                setSjinnTourVideoUrl(null);
              }}>
                <SelectTrigger data-testid="tour-engine-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="veo">Google VEO 3.1 — Cinematic Room Videos</SelectItem>
                  <SelectItem value="luma">Luma Ray 2 — Cinematic Room Videos</SelectItem>
                  <SelectItem value="sora2">Sora 2 (OpenAI) — HD Cinematic AI Video</SelectItem>
                </SelectContent>
              </Select>
              {tourVideoEngine === "veo" ? (
                <p className="text-xs text-muted-foreground">VEO 3.1 generates individual cinematic clips per room using your uploaded photos.</p>
              ) : tourVideoEngine === "luma" ? (
                <p className="text-xs text-muted-foreground">Luma Ray 2 generates cinematic room videos from your photos. Models: ray-2 (best quality) or ray-flash-2 (faster).</p>
              ) : (
                <p className="text-xs text-amber-600 dark:text-amber-400">Sora 2 generates a single AI video from your property details and script — no photos required. Estimated time: 3–10 minutes.</p>
              )}
              {tourVideoEngine === "luma" && (
                <div className="flex items-center gap-3 pt-1">
                  <Label className="text-xs text-muted-foreground">Model:</Label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={lumaModel === "ray-2" ? "default" : "outline"}
                      className="h-7 text-xs px-3"
                      onClick={() => setLumaModel("ray-2")}
                      data-testid="luma-model-ray2"
                    >
                      ray-2 (Best Quality)
                    </Button>
                    <Button
                      size="sm"
                      variant={lumaModel === "ray-flash-2" ? "default" : "outline"}
                      className="h-7 text-xs px-3"
                      onClick={() => setLumaModel("ray-flash-2")}
                      data-testid="luma-model-ray-flash-2"
                    >
                      ray-flash-2 (Faster)
                    </Button>
                  </div>
                </div>
              )}
            </div>

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
              <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-lg space-y-6" data-testid="generation-complete">
                <div className="flex items-center gap-3">
                  <Check className="h-6 w-6 text-green-500" />
                  <div>
                    <h4 className="font-medium text-green-600 dark:text-green-400">
                      Property Tour Videos Generated
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {Object.keys(roomVideoMap).length || motionVideos.length} room videos ready
                      {avatarVideoUrl ? " + avatar narration" : ""}
                      {combinedTourUrl ? " + full tour" : ""}
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
                
                {combinedTourUrl && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Film className="h-5 w-5 text-blue-600" />
                      <h5 className="font-medium">Complete Property Tour</h5>
                      <Badge variant="secondary" className="text-xs">
                        {tourOrder.length} rooms combined
                      </Badge>
                    </div>
                    <div className="rounded-lg overflow-hidden border-2 border-blue-200 bg-black max-w-3xl mx-auto">
                      <video
                        src={combinedTourUrl}
                        controls
                        className="w-full aspect-video"
                        data-testid="combined-tour-video"
                      />
                      <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-3 flex items-center justify-between">
                        <span className="text-sm font-medium">Full Property Tour Video</span>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="gap-1 h-7 text-xs"
                            onClick={() => {
                              setSelectedVideoForShare(combinedTourUrl);
                              handleOpenShareDialog();
                            }}
                            data-testid="share-tour-btn"
                          >
                            <Share2 className="h-3 w-3" />
                            Share
                          </Button>
                          <Button 
                            size="sm" 
                            variant="default" 
                            className="gap-1 h-7"
                            asChild
                          >
                            <a href={combinedTourUrl} download target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                              Download Tour
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {(Object.keys(roomVideoMap).length > 0 || motionVideos.length > 0) && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Home className="h-5 w-5 text-primary" />
                        <h5 className="font-medium">Individual Room Videos</h5>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Share individual rooms on social media or download separately
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.keys(roomVideoMap).length > 0 ? (
                        Object.entries(roomVideoMap).map(([roomId, videoUrl]) => {
                          const roomName = ROOM_ZONES.find(r => r.roomId === roomId)?.roomName || roomId.replace(/-/g, ' ');
                          return (
                            <div key={roomId} className="rounded-lg overflow-hidden border bg-black relative" data-testid={`room-video-card-${roomId}`}>
                              <div className="absolute top-2 right-2 z-10">
                                <Checkbox
                                  checked={selectedRoomsForCombine.has(roomId)}
                                  onCheckedChange={(checked) => {
                                    setSelectedRoomsForCombine(prev => {
                                      const next = new Set(prev);
                                      if (checked) next.add(roomId);
                                      else next.delete(roomId);
                                      return next;
                                    });
                                  }}
                                  className="bg-white/80 border-white"
                                  data-testid={`select-room-${roomId}`}
                                />
                              </div>
                              <video
                                src={videoUrl}
                                controls
                                className="w-full aspect-video"
                                data-testid={`room-video-${roomId}`}
                              />
                              <div className="bg-muted p-2.5 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs capitalize">{roomName}</Badge>
                                    <span className="text-xs text-muted-foreground">16s clip</span>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="flex-1 h-7 gap-1 text-xs"
                                    onClick={() => {
                                      setSelectedVideoForShare(videoUrl);
                                      handleOpenShareDialog();
                                    }}
                                    data-testid={`share-room-${roomId}`}
                                  >
                                    <Share2 className="h-3 w-3" />
                                    Share on Social
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-7 gap-1 text-xs"
                                    asChild
                                  >
                                    <a href={videoUrl} download target="_blank" rel="noopener noreferrer">
                                      <Download className="h-3 w-3" />
                                      Save
                                    </a>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        motionVideos.map((videoUrl, index) => (
                          <div key={index} className="rounded-lg overflow-hidden border bg-black">
                            <video
                              src={videoUrl}
                              controls
                              className="w-full aspect-video"
                              data-testid={`motion-video-${index}`}
                            />
                            <div className="bg-muted p-2.5 space-y-2">
                              <div className="flex items-center justify-between">
                                <Badge variant="outline" className="text-xs capitalize">
                                  {tourOrder[index] ? ROOM_ZONES.find(r => r.roomId === tourOrder[index])?.roomName || `Clip ${index + 1}` : `Clip ${index + 1}`}
                                </Badge>
                                <span className="text-xs text-muted-foreground">16s clip</span>
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="flex-1 h-7 gap-1 text-xs"
                                  onClick={() => {
                                    setSelectedVideoForShare(videoUrl);
                                    handleOpenShareDialog();
                                  }}
                                  data-testid={`share-motion-${index}`}
                                >
                                  <Share2 className="h-3 w-3" />
                                  Share on Social
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-7 gap-1 text-xs"
                                  asChild
                                >
                                  <a href={videoUrl} download target="_blank" rel="noopener noreferrer">
                                    <Download className="h-3 w-3" />
                                    Save
                                  </a>
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {Object.keys(roomVideoMap).length >= 2 && (
                      <div className="flex items-center justify-between mt-3 pt-3 border-t">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedRoomsForCombine.size === Object.keys(roomVideoMap).length}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedRoomsForCombine(new Set(Object.keys(roomVideoMap)));
                              } else {
                                setSelectedRoomsForCombine(new Set());
                              }
                            }}
                            data-testid="select-all-rooms-checkbox"
                          />
                          <span className="text-sm text-muted-foreground">
                            {selectedRoomsForCombine.size} of {Object.keys(roomVideoMap).length} rooms selected
                          </span>
                        </div>
                        <Button
                          size="sm"
                          disabled={selectedRoomsForCombine.size < 2 || isCombining}
                          onClick={async () => {
                            if (!currentJobId || selectedRoomsForCombine.size < 2) return;
                            setIsCombining(true);
                            try {
                              const response = await fetch("/api/property-tour/combine", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                credentials: "include",
                                body: JSON.stringify({
                                  jobId: currentJobId,
                                  selectedRooms: Array.from(selectedRoomsForCombine),
                                }),
                              });
                              if (!response.ok) throw new Error("Failed to combine");
                              const data = await response.json();
                              if (data.combinedUrl) {
                                setCombinedTourUrl(data.combinedUrl);
                                toast({ title: "Tour Combined", description: `Combined ${selectedRoomsForCombine.size} room videos into a tour.` });
                              }
                            } catch (err: any) {
                              toast({ title: "Combine Failed", description: err.message, variant: "destructive" });
                            } finally {
                              setIsCombining(false);
                            }
                          }}
                          data-testid="combine-selected-btn"
                        >
                          {isCombining ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Film className="h-4 w-4 mr-2" />
                          )}
                          Combine Selected into Tour
                        </Button>
                      </div>
                    )}
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
                      setCombinedTourUrl(null);
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

            {(tourVideoEngine === "veo" || tourVideoEngine === "luma") && !isGenerating && !generationComplete && (
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

            {tourVideoEngine === "sora2" && (
              <div className="space-y-4">
                {sjinnTourStatus === "idle" && (
                  <div className="flex justify-center">
                    <Button
                      size="lg"
                      onClick={handleGenerateSora2Tour}
                      className="gap-2"
                      data-testid="sjinn-generate-btn"
                    >
                      <Video className="h-5 w-5" />
                      Generate with Sora 2
                    </Button>
                  </div>
                )}

                {(sjinnTourStatus === "pending" || sjinnTourStatus === "processing") && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-3" data-testid="sjinn-progress">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 text-amber-600 animate-spin" />
                      <div>
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Sora 2 is generating your video…</p>
                        <p className="text-xs text-muted-foreground">Elapsed: {Math.floor(sjinnTourElapsed / 60)}:{String(sjinnTourElapsed % 60).padStart(2, "0")} — Estimated: 5–15 minutes</p>
                      </div>
                    </div>
                    {sjinnTourElapsed >= 600 && (
                      <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded px-3 py-2" data-testid="sjinn-timeout-warning-tour">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span>This is taking longer than expected. You can keep waiting or cancel.</span>
                      </div>
                    )}
                    {sjinnTourChatId && (
                      <p className="text-xs text-muted-foreground">Job ID: {sjinnTourChatId}</p>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                      data-testid="button-cancel-sjinn-tour"
                      onClick={() => {
                        stopSjinnTourPolling();
                        clearSora2TourTask();
                        setSjinnTourStatus("idle");
                        setSjinnTourChatId(null);
                        setSjinnTourVideoUrl(null);
                        toast({ title: "Video Generation Cancelled", description: "Sora 2 video generation has been cancelled." });
                      }}
                    >
                      <X className="h-4 w-4 mr-1" />Cancel Generation
                    </Button>
                  </div>
                )}

                {sjinnTourStatus === "failed" && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg space-y-3" data-testid="sjinn-failed">
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">Sora 2 generation failed. Please try again.</p>
                    <Button size="sm" variant="outline" onClick={() => { setSjinnTourStatus("idle"); setSjinnTourChatId(null); setSjinnTourVideoUrl(null); }}>
                      Try Again
                    </Button>
                  </div>
                )}

                {sjinnTourStatus === "completed" && sjinnTourVideoUrl && (
                  <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-lg space-y-4" data-testid="sjinn-complete">
                    <div className="flex items-center gap-3">
                      <Check className="h-6 w-6 text-green-500" />
                      <div>
                        <h4 className="font-medium text-green-600 dark:text-green-400">Sora 2 Video Ready</h4>
                        <p className="text-sm text-muted-foreground">Your AI-generated property tour video is ready.</p>
                      </div>
                    </div>
                    <div className="rounded-lg overflow-hidden border bg-black max-w-2xl mx-auto">
                      <video
                        src={sjinnTourVideoUrl}
                        controls
                        className="w-full aspect-video"
                        data-testid="sjinn-tour-video"
                      />
                      <div className="bg-muted p-2 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Sora 2 AI Property Tour</span>
                        <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs" asChild>
                          <a href={sjinnTourVideoUrl} download target="_blank" rel="noopener noreferrer">
                            <Download className="h-3 w-3" />
                            Download
                          </a>
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 justify-center">
                      <Button
                        variant="secondary"
                        className="gap-2"
                        onClick={() => {
                          setSelectedVideoForShare(sjinnTourVideoUrl);
                          handleOpenShareDialog();
                        }}
                        data-testid="sjinn-share-btn"
                      >
                        <Share2 className="h-4 w-4" />
                        Share to Social Media
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                          setSjinnTourStatus("idle");
                          setSjinnTourChatId(null);
                          setSjinnTourVideoUrl(null);
                          setCurrentStep(1);
                        }}
                        data-testid="sjinn-new-tour-btn"
                      >
                        <Video className="h-4 w-4" />
                        Create Another Tour
                      </Button>
                    </div>
                  </div>
                )}
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="room-modal">
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
                    accept="image/*"
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
                  {(roomPhotos[selectedRoomId] || []).map((photo, index) => {
                    const photos = roomPhotos[selectedRoomId] || [];
                    return (
                      <div
                        key={index}
                        className="relative rounded-lg overflow-hidden border-2 border-muted group"
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
                        <div className="absolute top-1 right-1 flex items-center gap-0.5">
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 hover:bg-black/90 text-white"
                            onClick={() => selectedRoomId && index > 0 && reorderRoomPhotos(selectedRoomId, index, index - 1)}
                            disabled={index === 0}
                            data-testid={`move-up-room-photo-${index}`}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 hover:bg-black/90 text-white"
                            onClick={() => selectedRoomId && index < photos.length - 1 && reorderRoomPhotos(selectedRoomId, index, index + 1)}
                            disabled={index === photos.length - 1}
                            data-testid={`move-down-room-photo-${index}`}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="destructive"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => selectedRoomId && removePhotoFromRoom(selectedRoomId, photo.url)}
                            data-testid={`remove-room-photo-${index}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {(roomPhotos[selectedRoomId] || []).length > 0 && (
                <div className="space-y-2 mt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      Camera Positions (Optional)
                    </Label>
                    <span className="text-xs text-muted-foreground">Click the grid to place where each photo was taken</span>
                  </div>
                  <div 
                    className="relative w-full aspect-[4/3] bg-muted/30 border-2 border-dashed rounded-lg cursor-crosshair overflow-hidden"
                    data-testid="camera-position-grid"
                    onClick={(e) => {
                      if (!selectedRoomId) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = ((e.clientX - rect.left) / rect.width) * 100;
                      const y = ((e.clientY - rect.top) / rect.height) * 100;
                      const photos = roomPhotos[selectedRoomId] || [];
                      const currentPositions = cameraPositions[selectedRoomId] || [];
                      if (currentPositions.length >= photos.length) return;
                      const newPosition: CameraPosition = {
                        x,
                        y,
                        photoIndex: currentPositions.length,
                        direction: 0,
                      };
                      setCameraPositions(prev => ({
                        ...prev,
                        [selectedRoomId]: [...(prev[selectedRoomId] || []), newPosition],
                      }));
                    }}
                  >
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/60 uppercase tracking-wider">Door/Entry</div>
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/60 uppercase tracking-wider">Back Wall</div>
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/60 uppercase tracking-wider rotate-[-90deg]">Left</div>
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/60 uppercase tracking-wider rotate-90">Right</div>
                    
                    <div className="absolute inset-0 grid grid-cols-4 grid-rows-3 pointer-events-none">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="border border-muted-foreground/10" />
                      ))}
                    </div>

                    {(cameraPositions[selectedRoomId || ""] || []).length > 1 && (
                      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <defs>
                          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--primary))" fillOpacity="0.7" />
                          </marker>
                        </defs>
                        {(cameraPositions[selectedRoomId || ""] || []).map((pos, idx, arr) => {
                          if (idx === 0) return null;
                          const prev = arr[idx - 1];
                          return (
                            <line
                              key={idx}
                              x1={prev.x}
                              y1={prev.y}
                              x2={pos.x}
                              y2={pos.y}
                              stroke="hsl(var(--primary))"
                              strokeWidth="0.5"
                              strokeOpacity="0.5"
                              strokeDasharray="2,1"
                              markerEnd="url(#arrowhead)"
                            />
                          );
                        })}
                      </svg>
                    )}

                    {(cameraPositions[selectedRoomId || ""] || []).map((pos, idx) => (
                      <div
                        key={idx}
                        className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10"
                        style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                        data-testid={`camera-marker-${idx}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!selectedRoomId) return;
                          setCameraPositions(prev => ({
                            ...prev,
                            [selectedRoomId]: (prev[selectedRoomId] || []).map((p, i) => 
                              i === idx ? { ...p, direction: ((p.direction || 0) + 45) % 360 } : p
                            ),
                          }));
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!selectedRoomId) return;
                          setCameraPositions(prev => ({
                            ...prev,
                            [selectedRoomId]: (prev[selectedRoomId] || []).filter((_, i) => i !== idx).map((p, i) => ({ ...p, photoIndex: i })),
                          }));
                        }}
                      >
                        <svg 
                          width="48" height="48" viewBox="0 0 48 48"
                          className="hover:scale-110 transition-transform drop-shadow-lg"
                          style={{ transform: `rotate(${pos.direction || 0}deg)` }}
                        >
                          <path
                            d="M24 4 L38 20 L24 16 L10 20 Z"
                            fill="hsl(var(--primary))"
                            fillOpacity="0.5"
                            stroke="hsl(var(--primary))"
                            strokeWidth="1.5"
                          />
                          <circle cx="24" cy="24" r="10" fill="hsl(var(--primary))" stroke="white" strokeWidth="2.5" />
                          <text x="24" y="28" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">{pos.photoIndex + 1}</text>
                        </svg>
                        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground whitespace-nowrap bg-background/80 px-1 rounded">
                          {Math.round(pos.direction || 0)}°
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {(cameraPositions[selectedRoomId || ""] || []).length}/{(roomPhotos[selectedRoomId || ""] || []).length} positions placed
                      {(cameraPositions[selectedRoomId || ""] || []).length > 0 && " - click to rotate, right-click to remove"}
                    </p>
                    {(cameraPositions[selectedRoomId || ""] || []).length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          if (selectedRoomId) {
                            setCameraPositions(prev => ({ ...prev, [selectedRoomId]: [] }));
                          }
                        }}
                        data-testid="clear-positions-btn"
                      >
                        Clear All
                      </Button>
                    )}
                  </div>
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
                      accept="image/*"
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
