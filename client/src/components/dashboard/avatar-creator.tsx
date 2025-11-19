import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  User, 
  Camera, 
  Upload, 
  Settings, 
  Mic,
  UserPlus,
  Star,
  Edit2,
  MicOff,
  Square,
  Play,
  Pause,
  Video,
  Image,
  ChevronDown,
  ChevronUp,
  Eye,
  Volume2,
  Palette,
  AlertCircle,
  RotateCcw,
  ExternalLink,
  Sparkles
} from "lucide-react";

interface Avatar {
  id: string;
  name: string;
  description: string;
  style: string;
  gender: string;
  isActive: boolean;
  avatarImageUrl: string | null;
  voiceId: string | null;
  supportsGestures?: boolean;
}

const avatarStyles = [
  { value: "professional", label: "Professional Business", description: "Formal attire, confident demeanor" },
  { value: "casual", label: "Casual Friendly", description: "Approachable, relaxed appearance" },
  { value: "luxury", label: "Luxury Agent", description: "High-end, sophisticated look" },
  { value: "neighborhood", label: "Neighborhood Expert", description: "Local, community-focused style" },
];

const voiceOptions = [
  { value: "record_voice", label: "Record Voice" },
  { value: "119caed25533477ba63822d5d1552d25", label: "Professional Male (Midwest accent)" },
  { value: "1bd001e7e50f421d891986aad5158bc8", label: "Professional Female (Midwest accent)" },
  { value: "077ab11b14984b4dbfc939b2a4fa6c35", label: "Friendly Male (General American)" },
  { value: "f4bc62a686ba4f72abf8b017bc9a6c74", label: "Friendly Female (General American)" },
  { value: "b7e511f3de2f4c57adb0fa948f90c79c", label: "Authoritative Male (News anchor style)" },
  { value: "a4949508f37a4b80b1e009ba6d03e88b", label: "Warm Female (Conversational style)" },
];

// HeyGen advanced options
const qualityOptions = [
  { value: "standard", label: "Standard Quality", description: "Good for most uses, faster processing" },
  { value: "hd", label: "HD Quality", description: "Higher resolution, better for professional content" },
  { value: "4k", label: "4K Quality", description: "Ultra-high definition, premium output" },
];

const backgroundOptions = [
  { value: "auto", label: "Auto Remove", description: "Automatically remove background" },
  { value: "keep", label: "Keep Original", description: "Maintain original background" },
  { value: "green", label: "Green Screen", description: "Replace with green screen" },
  { value: "custom", label: "Custom Background", description: "Upload your own background" },
];

const animationOptions = [
  { value: "natural", label: "Natural Movement", description: "Realistic human-like animation" },
  { value: "minimal", label: "Minimal Movement", description: "Subtle, professional movement" },
  { value: "expressive", label: "Expressive", description: "More animated and engaging" },
  { value: "static", label: "Static", description: "Minimal movement, focused delivery" },
];

const headMovementOptions = [
  { value: "none", label: "No Movement" },
  { value: "subtle", label: "Subtle" },
  { value: "natural", label: "Natural" },
  { value: "expressive", label: "Expressive" },
];

const languageOptions = [
  { value: "en-US", label: "English (US)" },
  { value: "en-UK", label: "English (UK)" },
  { value: "es-ES", label: "Spanish" },
  { value: "fr-FR", label: "French" },
  { value: "de-DE", label: "German" },
  { value: "it-IT", label: "Italian" },
  { value: "pt-BR", label: "Portuguese" },
  { value: "zh-CN", label: "Chinese" },
  { value: "ja-JP", label: "Japanese" },
  { value: "ko-KR", label: "Korean" },
];

const emotionOptions = [
  { value: "neutral", label: "Neutral" },
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "confident", label: "Confident" },
  { value: "warm", label: "Warm" },
  { value: "energetic", label: "Energetic" },
];

const genderOptions = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "neutral", label: "Neutral" },
];

export function AvatarCreator() {
  const [isCreating, setIsCreating] = useState(false);
  const [avatarName, setAvatarName] = useState("");
  const [avatarDescription, setAvatarDescription] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("");
  const [selectedGender, setSelectedGender] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [avatarPhoto, setAvatarPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecordedVoice, setHasRecordedVoice] = useState(false);
  
  // Test avatar states
  const [testingAvatarId, setTestingAvatarId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{avatarId: string, videoUrl?: string, error?: string} | null>(null);
  
  // Edit avatar states
  const [editingAvatar, setEditingAvatar] = useState<Avatar | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editAvatarPhoto, setEditAvatarPhoto] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);

  // Advanced HeyGen options
  const [creationMethod, setCreationMethod] = useState<'photo' | 'video'>('photo');
  const [avatarVideo, setAvatarVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [avatarQuality, setAvatarQuality] = useState('standard');
  const [backgroundType, setBackgroundType] = useState('auto');
  const [customBackground, setCustomBackground] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
  const [animationStyle, setAnimationStyle] = useState('natural');
  const [eyeContact, setEyeContact] = useState(true);
  const [headMovement, setHeadMovement] = useState('subtle');
  const [voiceLanguage, setVoiceLanguage] = useState('en-US');
  const [voiceEmotion, setVoiceEmotion] = useState('neutral');
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [microphonePermission, setMicrophonePermission] = useState<'denied' | 'granted' | 'prompt'>('prompt');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Import avatar states
  const [importAvatarId, setImportAvatarId] = useState("");
  const [importAvatarName, setImportAvatarName] = useState("");
  const [selectedImportAvatar, setSelectedImportAvatar] = useState<any>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: avatars } = useQuery<Avatar[]>({
    queryKey: ["/api/avatars"],
  });

  // Query for available HeyGen avatars
  const { data: heygenAvatars, isLoading: isLoadingHeygenAvatars, refetch: refetchHeygenAvatars } = useQuery({
    queryKey: ['/api/avatars/heygen-list'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/avatars/heygen-list');
      return await response.json();
    },
    enabled: false // Only fetch when user clicks on import tab
  });

  const createAvatarMutation = useMutation({
    mutationFn: async (avatarData: any) => {
      const response = await apiRequest("POST", "/api/avatars", avatarData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Avatar Created!",
        description: "Your AI avatar has been created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/avatars"] });
      handleResetForm();
      setIsCreating(false);
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create avatar",
        variant: "destructive",
      });
    },
  });

  // Test avatar mutation
  const testAvatarMutation = useMutation({
    mutationFn: async (avatarId: string) => {
      // Create a test video with the avatar
      const testVideoData = {
        title: "Avatar Test Video",
        script: "Hello! This is a test of your AI avatar. I'm demonstrating how your personalized avatar looks and sounds in action. This technology allows you to create professional real estate videos with your own digital presence.",
        platform: "youtube",
        avatarId: avatarId,
        status: "draft"
      };
      
      const videoResponse = await apiRequest("POST", "/api/videos", testVideoData);
      const video = await videoResponse.json();
      
      // Generate the video
      const generateResponse = await apiRequest("POST", `/api/videos/${video.id}/generate-video`, {
        avatarId: avatarId
      });
      
      return {
        videoId: video.id,
        generateResult: await generateResponse.json()
      };
    },
    onSuccess: (data) => {
      setTestResult({ avatarId: testingAvatarId!, videoUrl: undefined });
      toast({
        title: "Test Started",
        description: "Your avatar test video is being generated. This may take a few minutes.",
      });
      
      // Poll for video status
      pollVideoStatus(data.videoId);
    },
    onError: (error) => {
      setTestResult({ avatarId: testingAvatarId!, error: "Failed to start test" });
      setTestingAvatarId(null);
      toast({
        title: "Test Failed",
        description: "Failed to start avatar test. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateAvatarMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const response = await apiRequest("PUT", `/api/avatars/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Avatar Updated!",
        description: "Avatar settings have been updated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/avatars"] });
      setIsEditDialogOpen(false);
      setEditingAvatar(null);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update avatar",
        variant: "destructive",
      });
    },
  });

  // Import avatar mutation
  const importAvatarMutation = useMutation({
    mutationFn: async (importData: { avatarId: string; name?: string }) => {
      const response = await apiRequest("POST", "/api/avatars/import", importData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Avatar Imported!",
        description: "Your HeyGen avatar has been imported successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/avatars"] });
      handleResetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import avatar",
        variant: "destructive",
      });
    },
  });

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAvatarPhoto(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAvatarVideo(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setVideoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBackgroundUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCustomBackground(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setBackgroundPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateAvatar = () => {
    if (!avatarName || !selectedStyle || !selectedGender) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Create FormData for file upload
    const formData = new FormData();
    formData.append('name', avatarName);
    formData.append('description', avatarDescription || `${selectedStyle} avatar for ${avatarName}`);
    formData.append('style', selectedStyle);
    formData.append('gender', selectedGender);
    formData.append('isActive', 'true');
    
    if (selectedVoice) {
      formData.append('voiceId', selectedVoice);
    }
    
    if (avatarPhoto) {
      formData.append('avatarPhoto', avatarPhoto);
    }

    createAvatarMutation.mutate(formData);
  };

  // Voice recording functions
  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicrophonePermission('granted');
      
      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedAudioBlob(audioBlob);
        setHasRecordedVoice(true);
        audioChunksRef.current = [];
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };
      
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      setMicrophonePermission('denied');
      toast({
        title: "Microphone Access Denied",
        description: "Please allow microphone access to record your voice for the avatar.",
        variant: "destructive",
      });
      return false;
    }
  };

  const startRecording = async () => {
    if (microphonePermission !== 'granted') {
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
      // Request new stream for recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          // Try different audio types for better compatibility
          let audioType = 'audio/webm';
          if (MediaRecorder.isTypeSupported('audio/wav')) {
            audioType = 'audio/wav';
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            audioType = 'audio/mp4';
          }
          
          const audioBlob = new Blob(audioChunksRef.current, { type: audioType });
          console.log('Audio blob created:', {
            size: audioBlob.size,
            type: audioBlob.type,
            chunks: audioChunksRef.current.length,
            supportedTypes: {
              wav: MediaRecorder.isTypeSupported('audio/wav'),
              mp4: MediaRecorder.isTypeSupported('audio/mp4'),
              webm: MediaRecorder.isTypeSupported('audio/webm')
            }
          });
          setRecordedAudioBlob(audioBlob);
          setHasRecordedVoice(true);
          audioChunksRef.current = [];
          stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start();
        setIsRecording(true);
        setRecordingDuration(0);
        
        // Start timer to track recording duration
        recordingTimerRef.current = setInterval(() => {
          setRecordingDuration(prev => prev + 1);
        }, 1000);
        
        toast({
          title: "Recording Started",
          description: "Speak for 15-30 seconds for best results. Click stop when finished.",
        });
      } catch (error) {
        toast({
          title: "Recording Failed",
          description: "Could not start recording. Please check your microphone.",
          variant: "destructive",
        });
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Clear the timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      const duration = recordingDuration;
      let message = "Your voice has been recorded successfully!";
      
      if (duration < 5) {
        message = "Recording complete! For better AI voice quality, try recording for 15-30 seconds.";
      } else if (duration >= 15 && duration <= 30) {
        message = "Perfect recording length! Your voice sample is ideal for AI training.";
      }
      
      toast({
        title: "Recording Complete",
        description: message,
      });
    }
  };

  const playRecordedVoice = async () => {
    if (recordedAudioBlob && !isPlayingVoice) {
      console.log('Attempting to play audio blob:', {
        size: recordedAudioBlob.size,
        type: recordedAudioBlob.type
      });
      
      try {
        const audioUrl = URL.createObjectURL(recordedAudioBlob);
        console.log('Created audio URL:', audioUrl);
        
        const audio = new Audio(audioUrl);
        playbackAudioRef.current = audio;
        
        // Set volume to maximum to ensure it's audible
        audio.volume = 1.0;
        
        audio.oncanplay = () => {
          console.log('Audio can play, duration:', audio.duration);
        };
        
        audio.onloadedmetadata = () => {
          console.log('Audio metadata loaded:', {
            duration: audio.duration,
            volume: audio.volume,
            readyState: audio.readyState
          });
          
          // Check if duration is valid
          if (!audio.duration || audio.duration === 0 || isNaN(audio.duration)) {
            console.warn('Invalid audio duration detected');
            toast({
              title: "Audio Issue Detected",
              description: "The recording might be corrupted. Try recording again or check your microphone.",
              variant: "destructive",
            });
          }
        };
        
        audio.onended = () => {
          console.log('Audio playback ended');
          setIsPlayingVoice(false);
          URL.revokeObjectURL(audioUrl);
        };
        
        audio.onerror = (error) => {
          console.error('Audio playback error:', error, audio.error);
          setIsPlayingVoice(false);
          URL.revokeObjectURL(audioUrl);
          toast({
            title: "Playback Failed",
            description: `Audio error: ${audio.error?.message || 'Unknown error'}`,
            variant: "destructive",
          });
        };
        
        // Load the audio first
        audio.load();
        setIsPlayingVoice(true);
        
        // Wait a moment for loading, then play
        setTimeout(async () => {
          try {
            console.log('Starting audio playback...');
            await audio.play();
            console.log('Audio play started successfully');
            toast({
              title: "Playing Voice",
              description: "Check your speakers/headphones! If you can't hear it, try downloading the file below.",
            });
          } catch (playError) {
            console.error('Play failed:', playError);
            setIsPlayingVoice(false);
            toast({
              title: "Play Failed",
              description: `Could not start playback: ${playError instanceof Error ? playError.message : 'Unknown error'}. Try downloading the audio file instead.`,
              variant: "destructive",
            });
          }
        }, 100);
        
      } catch (error) {
        console.error('Failed to play recorded voice:', error);
        setIsPlayingVoice(false);
        toast({
          title: "Playback Error",
          description: `Unable to play recorded voice: ${error instanceof Error ? error.message : 'Unknown error'}`,
          variant: "destructive",
        });
      }
    } else {
      console.log('Playback conditions not met:', {
        hasBlob: !!recordedAudioBlob,
        isPlaying: isPlayingVoice
      });
    }
  };

  const stopPlayback = () => {
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      playbackAudioRef.current.currentTime = 0;
      setIsPlayingVoice(false);
    }
  };

  const handleResetForm = () => {
    setAvatarName("");
    setAvatarDescription("");
    setSelectedStyle("");
    setSelectedGender("");
    setSelectedVoice("");
    setAvatarPhoto(null);
    setPhotoPreview(null);
    setIsRecording(false);
    setHasRecordedVoice(false);
    setIsPlayingVoice(false);
    setRecordedAudioBlob(null);
    setRecordingDuration(0);
    setImportAvatarId("");
    setImportAvatarName("");
    setSelectedImportAvatar(null);
    
    // Reset advanced HeyGen options
    setCreationMethod('photo');
    setAvatarVideo(null);
    setVideoPreview(null);
    setAvatarQuality('standard');
    setBackgroundType('auto');
    setCustomBackground(null);
    setBackgroundPreview(null);
    setAnimationStyle('natural');
    setEyeContact(true);
    setHeadMovement('subtle');
    setVoiceLanguage('en-US');
    setVoiceEmotion('neutral');
    setVoiceSpeed(1.0);
    setAdvancedMode(false);
    
    // Stop any ongoing recording or playback
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      playbackAudioRef.current.currentTime = 0;
    }
  };

  const toggleAvatarActive = (avatarId: string, currentActive: boolean) => {
    updateAvatarMutation.mutate({
      id: avatarId,
      updates: { isActive: !currentActive }
    });
  };

  const handleEditAvatar = (avatar: Avatar) => {
    setEditingAvatar(avatar);
    setEditAvatarPhoto(null);
    setEditPhotoPreview(avatar.avatarImageUrl);
    setIsEditDialogOpen(true);
  };

  const handleEditPhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setEditAvatarPhoto(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setEditPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateAvatar = () => {
    if (!editingAvatar) return;
    
    const formData = new FormData();
    formData.append('name', editingAvatar.name);
    formData.append('description', editingAvatar.description);
    formData.append('style', editingAvatar.style);
    formData.append('gender', editingAvatar.gender);
    
    if (editAvatarPhoto) {
      formData.append('avatarPhoto', editAvatarPhoto);
    }
    
    // Add voice ID or recorded voice
    if (editingAvatar.voiceId) {
      if (editingAvatar.voiceId === 'record_voice' && recordedAudioBlob) {
        // Upload the recorded voice
        formData.append('voiceRecording', recordedAudioBlob, 'voice-recording.webm');
      } else {
        // Use a predefined voice
        formData.append('voiceId', editingAvatar.voiceId);
      }
    }
    
    updateAvatarMutation.mutate({
      id: editingAvatar.id,
      updates: formData
    });
  };

  // Test avatar function
  const testAvatar = (avatarId: string) => {
    setTestingAvatarId(avatarId);
    setTestResult(null);
    testAvatarMutation.mutate(avatarId);
  };

  // Poll video status function
  const pollVideoStatus = async (videoId: string) => {
    const maxAttempts = 20; // Poll for up to 10 minutes (30s intervals)
    let attempts = 0;
    
    const checkStatus = async () => {
      try {
        const response = await apiRequest("GET", `/api/videos/${videoId}/status`);
        const status = await response.json();
        
        if (status.status === 'ready' && status.videoUrl) {
          setTestResult({ 
            avatarId: testingAvatarId!, 
            videoUrl: status.videoUrl 
          });
          setTestingAvatarId(null);
          toast({
            title: "Test Complete!",
            description: "Your avatar test video is ready to view.",
          });
          return;
        } else if (status.status === 'failed') {
          setTestResult({ 
            avatarId: testingAvatarId!, 
            error: "Video generation failed" 
          });
          setTestingAvatarId(null);
          toast({
            title: "Test Failed",
            description: "Avatar test video generation failed.",
            variant: "destructive",
          });
          return;
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 30000); // Check again in 30 seconds
        } else {
          setTestResult({ 
            avatarId: testingAvatarId!, 
            error: "Test timed out" 
          });
          setTestingAvatarId(null);
          toast({
            title: "Test Timeout",
            description: "Avatar test took too long. Please try again.",
            variant: "destructive",
          });
        }
      } catch (error) {
        setTestResult({ 
          avatarId: testingAvatarId!, 
          error: "Status check failed" 
        });
        setTestingAvatarId(null);
      }
    };
    
    setTimeout(checkStatus, 5000); // Start checking after 5 seconds
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center">
            <User className="mr-2 h-5 w-5" />
            AI Avatar Management
          </CardTitle>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-create-avatar">
                <UserPlus className="mr-2 h-4 w-4" />
                Create New Avatar
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Your AI Avatar</DialogTitle>
                <DialogDescription>
                  Create a personalized AI avatar using advanced HeyGen technology. Choose from photo or video input methods and customize every aspect of your digital persona.
                </DialogDescription>
              </DialogHeader>
              
              <Tabs defaultValue="basic" className="space-y-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">Basic Setup</TabsTrigger>
                  <TabsTrigger value="media">Media Input</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                  <TabsTrigger value="import">Import</TabsTrigger>
                </TabsList>

                {/* Basic Setup Tab */}
                <TabsContent value="basic" className="space-y-4">
                  {/* Avatar Details */}
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="avatar-name" className="text-sm font-medium">Avatar Name *</Label>
                      <Input
                        id="avatar-name"
                        value={avatarName}
                        onChange={(e) => setAvatarName(e.target.value)}
                        placeholder="e.g., Mike Bjork - Professional"
                        data-testid="input-avatar-name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="avatar-description" className="text-sm font-medium">Description</Label>
                      <Textarea
                        id="avatar-description"
                        value={avatarDescription}
                        onChange={(e) => setAvatarDescription(e.target.value)}
                        placeholder="Describe how this avatar should appear and behave"
                        rows={2}
                        data-testid="textarea-avatar-description"
                      />
                    </div>

                    {/* Style Selection */}
                    <div>
                      <Label className="text-sm font-medium">Avatar Style *</Label>
                      <Select onValueChange={setSelectedStyle} data-testid="select-avatar-style">
                        <SelectTrigger>
                          <SelectValue placeholder="Choose your avatar's style" />
                        </SelectTrigger>
                        <SelectContent>
                          {avatarStyles.map((style) => (
                            <SelectItem key={style.value} value={style.value}>
                              <div>
                                <div className="font-medium">{style.label}</div>
                                <div className="text-xs text-muted-foreground">{style.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm font-medium">Gender *</Label>
                        <Select onValueChange={setSelectedGender} data-testid="select-avatar-gender">
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {genderOptions.map((gender) => (
                              <SelectItem key={gender.value} value={gender.value}>
                                {gender.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Output Quality</Label>
                        <Select onValueChange={setAvatarQuality} defaultValue="standard">
                          <SelectTrigger>
                            <SelectValue placeholder="Quality" />
                          </SelectTrigger>
                          <SelectContent>
                            {qualityOptions.map((quality) => (
                              <SelectItem key={quality.value} value={quality.value}>
                                <div>
                                  <div className="font-medium">{quality.label}</div>
                                  <div className="text-xs text-muted-foreground">{quality.description}</div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Media Input Tab */}
                <TabsContent value="media" className="space-y-4">
                  {/* Creation Method Selection */}
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Creation Method *</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant={creationMethod === 'photo' ? 'default' : 'outline'}
                        onClick={() => setCreationMethod('photo')}
                        className="h-auto p-4 flex flex-col items-center space-y-2"
                        data-testid="button-method-photo"
                      >
                        <Image className="h-6 w-6" />
                        <div className="text-center">
                          <div className="font-medium">Photo Avatar</div>
                          <div className="text-xs text-muted-foreground">Upload a photo</div>
                        </div>
                      </Button>
                      <Button
                        variant={creationMethod === 'video' ? 'default' : 'outline'}
                        onClick={() => setCreationMethod('video')}
                        className="h-auto p-4 flex flex-col items-center space-y-2"
                        data-testid="button-method-video"
                      >
                        <Video className="h-6 w-6" />
                        <div className="text-center">
                          <div className="font-medium">Video Avatar</div>
                          <div className="text-xs text-muted-foreground">Upload a video</div>
                        </div>
                      </Button>
                    </div>
                  </div>

                  {/* Photo Upload */}
                  {creationMethod === 'photo' && (
                    <div className="text-center border rounded-lg p-6">
                      <div className="w-32 h-32 mx-auto bg-muted rounded-lg flex items-center justify-center overflow-hidden mb-3">
                        {photoPreview ? (
                          <img src={photoPreview} alt="Avatar preview" className="w-full h-full object-cover" />
                        ) : (
                          <Camera className="h-12 w-12 text-muted-foreground" />
                        )}
                      </div>
                      <Input
                        ref={fileInputRef}
                        id="avatar-photo"
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                        data-testid="input-avatar-photo"
                      />
                      <Button 
                        variant="outline" 
                        className="mb-2" 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        data-testid="button-upload-photo"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Your Photo
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Upload a clear, well-lit headshot. Face should be clearly visible and looking at the camera.
                      </p>
                    </div>
                  )}

                  {/* Video Upload */}
                  {creationMethod === 'video' && (
                    <div className="text-center border rounded-lg p-6">
                      <div className="w-48 h-32 mx-auto bg-muted rounded-lg flex items-center justify-center overflow-hidden mb-3">
                        {videoPreview ? (
                          <video src={videoPreview} className="w-full h-full object-cover" controls={false} />
                        ) : (
                          <Video className="h-12 w-12 text-muted-foreground" />
                        )}
                      </div>
                      <Input
                        id="avatar-video"
                        type="file"
                        accept="video/*"
                        onChange={handleVideoUpload}
                        className="hidden"
                        data-testid="input-avatar-video"
                      />
                      <Button 
                        variant="outline" 
                        className="mb-2" 
                        type="button"
                        onClick={() => document.getElementById('avatar-video')?.click()}
                        data-testid="button-upload-video"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Training Video
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Upload a 10-30 second video of you speaking clearly. Good lighting and stable camera required.
                      </p>
                    </div>
                  )}

                  {/* Background Options */}
                  <div>
                    <Label className="text-sm font-medium">Background</Label>
                    <Select onValueChange={setBackgroundType} defaultValue="auto">
                      <SelectTrigger>
                        <SelectValue placeholder="Background option" />
                      </SelectTrigger>
                      <SelectContent>
                        {backgroundOptions.map((bg) => (
                          <SelectItem key={bg.value} value={bg.value}>
                            <div>
                              <div className="font-medium">{bg.label}</div>
                              <div className="text-xs text-muted-foreground">{bg.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Custom Background Upload */}
                  {backgroundType === 'custom' && (
                    <div className="text-center border rounded-lg p-4">
                      <div className="w-24 h-16 mx-auto bg-muted rounded flex items-center justify-center overflow-hidden mb-2">
                        {backgroundPreview ? (
                          <img src={backgroundPreview} alt="Background preview" className="w-full h-full object-cover" />
                        ) : (
                          <Palette className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <Input
                        id="background-image"
                        type="file"
                        accept="image/*"
                        onChange={handleBackgroundUpload}
                        className="hidden"
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        type="button"
                        onClick={() => document.getElementById('background-image')?.click()}
                      >
                        <Upload className="mr-2 h-3 w-3" />
                        Upload Background
                      </Button>
                    </div>
                  )}
                </TabsContent>

                {/* Advanced Tab */}
                <TabsContent value="advanced" className="space-y-4">
                  {/* Voice Configuration */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Voice Settings</Label>
                      <Select onValueChange={setSelectedVoice} data-testid="select-avatar-voice">
                        <SelectTrigger>
                          <SelectValue placeholder="Choose voice style" />
                        </SelectTrigger>
                        <SelectContent>
                          {voiceOptions.map((voice) => (
                            <SelectItem key={voice.value} value={voice.value}>
                              {voice.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Language and Emotion Settings */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm font-medium">Language</Label>
                        <Select onValueChange={setVoiceLanguage} defaultValue="en-US">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {languageOptions.map((lang) => (
                              <SelectItem key={lang.value} value={lang.value}>
                                {lang.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Emotion</Label>
                        <Select onValueChange={setVoiceEmotion} defaultValue="neutral">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {emotionOptions.map((emotion) => (
                              <SelectItem key={emotion.value} value={emotion.value}>
                                {emotion.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Voice Speed */}
                    <div>
                      <Label className="text-sm font-medium">Voice Speed: {voiceSpeed}x</Label>
                      <Slider
                        value={[voiceSpeed]}
                        onValueChange={(value) => setVoiceSpeed(value[0])}
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        className="mt-2"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>0.5x Slow</span>
                        <span>2.0x Fast</span>
                      </div>
                    </div>

                    {/* Animation Settings */}
                    <div>
                      <Label className="text-sm font-medium">Animation Style</Label>
                      <Select onValueChange={setAnimationStyle} defaultValue="natural">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {animationOptions.map((animation) => (
                            <SelectItem key={animation.value} value={animation.value}>
                              <div>
                                <div className="font-medium">{animation.label}</div>
                                <div className="text-xs text-muted-foreground">{animation.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Head Movement */}
                    <div>
                      <Label className="text-sm font-medium">Head Movement</Label>
                      <Select onValueChange={setHeadMovement} defaultValue="subtle">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {headMovementOptions.map((movement) => (
                            <SelectItem key={movement.value} value={movement.value}>
                              {movement.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Eye Contact Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium">Eye Contact</Label>
                        <p className="text-xs text-muted-foreground">Maintain eye contact with camera</p>
                      </div>
                      <Switch
                        checked={eyeContact}
                        onCheckedChange={setEyeContact}
                      />
                    </div>
                  </div>

                  {/* Voice Recording Section - Only show when "Record Voice" is selected */}
                  {selectedVoice === 'record_voice' && (
                    <div className="bg-muted/50 p-4 rounded-lg border space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Record Your Voice</Label>
                        {microphonePermission === 'denied' && (
                          <div className="flex items-center text-xs text-red-500">
                            <MicOff className="h-3 w-3 mr-1" />
                            Microphone blocked
                          </div>
                        )}
                      </div>
                      
                      {microphonePermission === 'prompt' && (
                        <div className="text-center py-4">
                          <Button 
                            onClick={requestMicrophonePermission}
                            variant="outline"
                            data-testid="button-request-microphone"
                          >
                            <Mic className="mr-2 h-4 w-4" />
                            Allow Microphone Access
                          </Button>
                          <p className="text-xs text-muted-foreground mt-2">
                            Click to grant microphone permission for voice recording
                          </p>
                        </div>
                      )}

                      {microphonePermission === 'granted' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-center space-x-3">
                            {!isRecording && !hasRecordedVoice && (
                              <Button 
                                onClick={startRecording}
                                variant="default"
                                data-testid="button-start-recording"
                              >
                                <Mic className="mr-2 h-4 w-4" />
                                Start Recording
                              </Button>
                            )}
                            
                            {isRecording && (
                              <Button 
                                onClick={stopRecording}
                                variant="destructive"
                                data-testid="button-stop-recording"
                              >
                                <Square className="mr-2 h-4 w-4" />
                                Stop Recording
                              </Button>
                            )}
                            
                            {hasRecordedVoice && !isRecording && (
                              <div className="flex space-x-2">
                                <Button 
                                  onClick={isPlayingVoice ? stopPlayback : playRecordedVoice}
                                  variant="outline"
                                  size="sm"
                                  data-testid="button-play-voice"
                                >
                                  {isPlayingVoice ? (
                                    <>
                                      <Pause className="mr-2 h-3 w-3" />
                                      Stop
                                    </>
                                  ) : (
                                    <>
                                      <Play className="mr-2 h-3 w-3" />
                                      Play
                                    </>
                                  )}
                                </Button>
                                <Button 
                                  onClick={() => {
                                    if (recordedAudioBlob) {
                                      const url = URL.createObjectURL(recordedAudioBlob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = 'voice-sample.webm';
                                      a.click();
                                      URL.revokeObjectURL(url);
                                    }
                                  }}
                                  variant="outline"
                                  size="sm"
                                  data-testid="button-download-voice"
                                >
                                  📥 Download
                                </Button>
                                <Button 
                                  onClick={startRecording}
                                  variant="outline"
                                  size="sm"
                                  data-testid="button-re-record"
                                >
                                  <Mic className="mr-2 h-3 w-3" />
                                  Re-record
                                </Button>
                              </div>
                            )}
                          </div>
                          
                          {isRecording && (
                            <div className="text-center space-y-2">
                              <div className="inline-flex items-center text-red-500 text-sm animate-pulse">
                                <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-ping"></div>
                                Recording... Speak clearly into your microphone
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Duration: {recordingDuration}s {recordingDuration >= 15 && recordingDuration <= 30 ? '✨ Perfect!' : recordingDuration < 15 ? '(aim for 15-30s)' : '(you can stop now)'}
                              </div>
                            </div>
                          )}
                          
                          {hasRecordedVoice && (
                            <div className="text-center">
                              <div className="inline-flex items-center text-green-600 text-sm">
                                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                                Voice recorded successfully! You can play it back or re-record.
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {microphonePermission === 'denied' && (
                        <div className="text-center py-4 text-muted-foreground">
                          <MicOff className="mx-auto h-8 w-8 mb-2" />
                          <p className="text-sm">Microphone access is blocked</p>
                          <p className="text-xs">Please enable microphone permissions in your browser settings</p>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* Import Tab */}
                <TabsContent value="import" className="space-y-4">
                  <div className="space-y-4">
                    <div className="text-center">
                      <h3 className="text-lg font-medium mb-2">Import Gesture-Enabled Avatars</h3>
                      <p className="text-sm text-muted-foreground">
                        Import custom gesture-enabled avatars from your HeyGen account for both video generation and streaming
                      </p>
                    </div>

                    {/* Comprehensive Gesture Avatar Creation Guide */}
                    <Collapsible className="border rounded-lg border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="w-full justify-between p-4 hover:bg-primary/10">
                          <div className="flex items-center gap-2">
                            <Video className="h-5 w-5 text-primary animate-pulse" />
                            <span className="font-semibold text-lg">🎬 How to Create Gesture-Enabled Avatars</span>
                            <Badge variant="secondary" className="ml-2">Step-by-Step Guide</Badge>
                          </div>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="p-6 space-y-6 border-t bg-background/50">
                        {/* Step-by-step guide */}
                        <div className="space-y-6">
                          {/* Overview Card */}
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-5 shadow-sm">
                            <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2 text-lg">
                              <Sparkles className="h-5 w-5" />
                              What Makes Gesture Avatars Special?
                            </h4>
                            <p className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed mb-3">
                              <strong>Gesture-enabled avatars</strong> bring your videos to life with natural hand movements, facial expressions, and body language perfectly synced to your script. 
                              Unlike standard avatars that only do lip-sync, gesture avatars can wave, point, nod, and express emotions just like a real person!
                            </p>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div className="bg-white/50 dark:bg-black/20 rounded-lg p-2">
                                <span className="font-semibold">✅ Works With:</span> Both video generation & live streaming
                              </div>
                              <div className="bg-white/50 dark:bg-black/20 rounded-lg p-2">
                                <span className="font-semibold">⏱️ Processing:</span> 5-7 business days after upload
                              </div>
                              <div className="bg-white/50 dark:bg-black/20 rounded-lg p-2">
                                <span className="font-semibold">🎬 Requires:</span> Custom video footage of yourself
                              </div>
                              <div className="bg-white/50 dark:bg-black/20 rounded-lg p-2">
                                <span className="font-semibold">🎭 Gestures:</span> Up to 10 per video
                              </div>
                            </div>
                          </div>

                          {/* Watch Tutorial Video */}
                          <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                            <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2 flex items-center gap-2">
                              <Play className="h-4 w-4" />
                              📺 Watch Official HeyGen Tutorial
                            </h4>
                            <p className="text-sm text-purple-800 dark:text-purple-200 mb-3">
                              Before you start, watch this 5-minute official tutorial from HeyGen Academy showing exactly how to film and create gesture-enabled avatars:
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open('https://community.heygen.com/public/resources/heygen-academy-101-gesture-control', '_blank')}
                              className="w-full bg-white dark:bg-purple-900 border-purple-300"
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Watch HeyGen Academy: Gesture Control Tutorial
                            </Button>
                          </div>

                          {/* Step-by-Step Filming Process */}
                          <div className="space-y-4">
                            <h3 className="font-bold text-lg flex items-center gap-2 border-b pb-2">
                              <Camera className="h-5 w-5 text-primary" />
                              📹 Step-by-Step Filming Process
                            </h3>

                            {/* STEP 1: Setup Your Recording Space */}
                            <div className="border-2 border-green-300 dark:border-green-700 rounded-xl p-4 bg-green-50/50 dark:bg-green-950/20">
                              <div className="flex items-start gap-3">
                                <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">1</div>
                                <div className="space-y-2 flex-1">
                                  <h5 className="font-bold text-green-900 dark:text-green-100">Setup Your Recording Space</h5>
                                  <div className="text-sm space-y-2 text-green-900 dark:text-green-100">
                                    <div className="bg-white/60 dark:bg-black/20 rounded-lg p-3">
                                      <p className="font-semibold mb-2">📸 Camera & Positioning:</p>
                                      <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li>Use 4K camera or modern smartphone (1080p minimum)</li>
                                        <li>Mount on tripod - <strong>NO handheld!</strong></li>
                                        <li>Position <strong>2-3 feet</strong> from camera</li>
                                        <li>Frame yourself <strong>chest-up</strong> (head & shoulders visible)</li>
                                        <li>Center yourself in frame</li>
                                      </ul>
                                    </div>
                                    <div className="bg-white/60 dark:bg-black/20 rounded-lg p-3">
                                      <p className="font-semibold mb-2">💡 Lighting Setup:</p>
                                      <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li><strong>Natural daylight:</strong> Face a window (not behind you)</li>
                                        <li><strong>Studio setup:</strong> Two soft lights on each side</li>
                                        <li><strong>Goal:</strong> No shadows on face or background</li>
                                        <li>Optional: Backlight behind you for depth</li>
                                      </ul>
                                    </div>
                                    <div className="bg-white/60 dark:bg-black/20 rounded-lg p-3">
                                      <p className="font-semibold mb-2">🎨 Background:</p>
                                      <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li>Clean, simple wall (solid color preferred)</li>
                                        <li>Green screen optional but recommended</li>
                                        <li><strong>Avoid:</strong> Busy patterns, other people, moving objects</li>
                                      </ul>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* STEP 2: Record Your Video */}
                            <div className="border-2 border-amber-300 dark:border-amber-700 rounded-xl p-4 bg-amber-50/50 dark:bg-amber-950/20">
                              <div className="flex items-start gap-3">
                                <div className="bg-amber-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">2</div>
                                <div className="space-y-2 flex-1">
                                  <h5 className="font-bold text-amber-900 dark:text-amber-100">Record Your Video - Follow This EXACT Structure</h5>
                                  <div className="text-sm space-y-2 text-amber-900 dark:text-amber-100">
                                    <div className="bg-white/60 dark:bg-black/20 rounded-lg p-3 border-l-4 border-amber-600">
                                      <p className="font-bold mb-2">⏱️ CRITICAL TIMING STRUCTURE:</p>
                                      <div className="space-y-3">
                                        <div className="pl-3 border-l-2 border-amber-500">
                                          <p className="font-semibold">Seconds 0-30: <span className="text-amber-700 dark:text-amber-300">Neutral Baseline</span></p>
                                          <p className="text-xs mt-1">Speak naturally with NO GESTURES at all. This teaches HeyGen your neutral state.</p>
                                        </div>
                                        <div className="pl-3 border-l-2 border-green-500">
                                          <p className="font-semibold">Seconds 31+: <span className="text-green-700 dark:text-green-300">Gesture Phase</span></p>
                                          <p className="text-xs mt-1"><strong>Perform 1 gesture → Return to neutral → Wait 2 seconds → Next gesture</strong></p>
                                          <p className="text-xs mt-1">Total: 60-90 seconds with 15-30 different gestures</p>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="bg-white/60 dark:bg-black/20 rounded-lg p-3">
                                      <p className="font-semibold mb-2">✅ Example Gestures to Perform:</p>
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>• 👋 Wave hello</div>
                                        <div>• 👍 Thumbs up</div>
                                        <div>• 👉 Point forward</div>
                                        <div>• 👈 Point to side</div>
                                        <div>• 🙂 Big smile</div>
                                        <div>• 😊 Friendly nod</div>
                                        <div>• 🤝 Open palm gesture</div>
                                        <div>• 🤷 Shrug shoulders</div>
                                        <div>• 💭 Thinking (hand on chin)</div>
                                        <div>• 🎯 Counting (1, 2, 3 with fingers)</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* STEP 3: Upload to HeyGen Platform */}
                            <div className="border-2 border-blue-300 dark:border-blue-700 rounded-xl p-4 bg-blue-50/50 dark:bg-blue-950/20">
                              <div className="flex items-start gap-3">
                                <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">3</div>
                                <div className="space-y-2 flex-1">
                                  <h5 className="font-bold text-blue-900 dark:text-blue-100">Upload Your Video to HeyGen</h5>
                                  <div className="text-sm space-y-2 text-blue-900 dark:text-blue-100">
                                    <ol className="list-decimal list-inside space-y-2 bg-white/60 dark:bg-black/20 rounded-lg p-3">
                                      <li>Log into your <a href="https://app.heygen.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">HeyGen account</a></li>
                                      <li>Navigate to <strong>Avatars → Create Avatar</strong></li>
                                      <li>Select <strong>"Hyper-Realistic Avatar"</strong> (video upload option)</li>
                                      <li>Upload your gesture-ready video file</li>
                                      <li>Complete identity verification (required for custom avatars)</li>
                                      <li>Wait 5-7 business days for processing ⏳</li>
                                    </ol>
                                    <div className="flex gap-2 mt-3">
                                      <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => window.open('https://app.heygen.com/streaming-avatar', '_blank')}
                                        className="flex-1"
                                      >
                                        <Upload className="h-4 w-4 mr-2" />
                                        Create on HeyGen
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => window.open('https://help.heygen.com/en/articles/8868166-how-to-create-a-custom-avatar', '_blank')}
                                        className="flex-1"
                                      >
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        Documentation
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* STEP 4: Import Your Gesture Avatar */}
                            <div className="border-2 border-purple-300 dark:border-purple-700 rounded-xl p-4 bg-purple-50/50 dark:bg-purple-950/20">
                              <div className="flex items-start gap-3">
                                <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">4</div>
                                <div className="space-y-2 flex-1">
                                  <h5 className="font-bold text-purple-900 dark:text-purple-100">Import Avatar to RealtyFlow</h5>
                                  <div className="text-sm space-y-2 text-purple-900 dark:text-purple-100">
                                    <p className="bg-white/60 dark:bg-black/20 rounded-lg p-3">
                                      Once HeyGen processes your avatar (you'll get an email), return here and use the <strong>"Import by Avatar ID"</strong> form below. 
                                      Your gesture-enabled avatar will be available for both video generation and live streaming!
                                    </p>
                                    <div className="bg-white/60 dark:bg-black/20 rounded-lg p-3 border-l-4 border-purple-600">
                                      <p className="font-semibold mb-1">💡 Quick Tip:</p>
                                      <p className="text-xs">Use the "Browse Your HeyGen Avatars" button to automatically see all your avatars including gesture-enabled ones. They'll be marked with a 🖐️ Gestures badge!</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Manual Import by ID */}
                    <div className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        <Label className="text-sm font-medium">Import by Avatar ID</Label>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="import-avatar-id" className="text-sm">HeyGen Avatar ID *</Label>
                          <Input
                            id="import-avatar-id"
                            value={importAvatarId}
                            onChange={(e) => setImportAvatarId(e.target.value)}
                            placeholder="Enter your HeyGen avatar ID (e.g., avatar_123abc)"
                            data-testid="input-import-avatar-id"
                          />
                          <p className="text-xs text-muted-foreground">
                            Find your avatar ID in your HeyGen dashboard under Avatar Management
                          </p>
                        </div>
                        <div>
                          <Label htmlFor="import-avatar-name" className="text-sm">Display Name (Optional)</Label>
                          <Input
                            id="import-avatar-name"
                            value={importAvatarName}
                            onChange={(e) => setImportAvatarName(e.target.value)}
                            placeholder="Custom name for this avatar in your platform"
                            data-testid="input-import-avatar-name"
                          />
                        </div>
                        <Button
                          onClick={() => importAvatarMutation.mutate({ 
                            avatarId: importAvatarId, 
                            name: importAvatarName 
                          })}
                          disabled={!importAvatarId || importAvatarMutation.isPending}
                          className="w-full"
                          data-testid="button-import-avatar"
                        >
                          {importAvatarMutation.isPending ? "Importing..." : "Import Avatar"}
                        </Button>
                      </div>
                    </div>

                    {/* Browse Available Avatars */}
                    <div className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4" />
                          <Label className="text-sm font-medium">Browse Your HeyGen Avatars</Label>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => refetchHeygenAvatars()}
                          disabled={isLoadingHeygenAvatars}
                          data-testid="button-refresh-heygen-avatars"
                        >
                          {isLoadingHeygenAvatars ? "Loading..." : "Load Avatars"}
                        </Button>
                      </div>
                      
                      {heygenAvatars && (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {heygenAvatars?.data?.avatars?.length > 0 ? (
                            heygenAvatars.data.avatars.map((avatar: any) => (
                              <div 
                                key={avatar.avatar_id} 
                                className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                                  selectedImportAvatar?.avatar_id === avatar.avatar_id 
                                    ? 'border-primary bg-primary/5' 
                                    : 'border-border hover:bg-muted/50'
                                }`}
                                onClick={() => setSelectedImportAvatar(avatar)}
                                data-testid={`avatar-option-${avatar.avatar_id}`}
                              >
                                <div className="flex items-center space-x-3">
                                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center overflow-hidden relative">
                                    {avatar.preview_image_url ? (
                                      <>
                                        <img 
                                          src={`/api/proxy/heygen-image?url=${encodeURIComponent(avatar.preview_image_url)}`}
                                          alt={avatar.avatar_name} 
                                          className="w-full h-full object-cover"
                                          onLoad={() => console.log('Image loaded successfully:', avatar.preview_image_url)}
                                          onError={(e) => {
                                            console.log('Image failed to load via proxy, trying direct:', avatar.preview_image_url);
                                            const target = e.currentTarget as HTMLImageElement;
                                            // Try direct URL as fallback
                                            if (target.src.includes('/api/proxy/')) {
                                              target.src = avatar.preview_image_url;
                                            } else {
                                              // If direct URL also fails, show fallback icon
                                              target.style.display = 'none';
                                              const fallback = target.parentElement?.querySelector('.fallback-icon') as HTMLElement;
                                              if (fallback) {
                                                fallback.style.display = 'flex';
                                              }
                                            }
                                          }}
                                        />
                                        <User className="fallback-icon h-6 w-6 text-muted-foreground absolute inset-0 m-auto hidden" />
                                      </>
                                    ) : (
                                      <User className="h-6 w-6 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <div className="font-medium text-sm flex items-center gap-2">
                                      {avatar.avatar_name}
                                      {avatar.avatar_type === 'studio' && (
                                        <Badge variant="default" className="text-xs">
                                          🖐️ Gestures
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground">ID: {avatar.avatar_id}</div>
                                    <div className="text-xs text-muted-foreground">
                                      Status: {avatar.status}
                                      {avatar.avatar_type && ` • Type: ${avatar.avatar_type}`}
                                    </div>
                                  </div>
                                  {selectedImportAvatar?.avatar_id === avatar.avatar_id && (
                                    <div className="text-primary">
                                      ✓ Selected
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-6 text-muted-foreground">
                              <User className="mx-auto h-8 w-8 mb-2" />
                              <p className="text-sm">No avatars found in your HeyGen account</p>
                              <p className="text-xs">Create avatars in HeyGen first, then refresh to import them</p>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {selectedImportAvatar && (
                        <Button
                          onClick={() => importAvatarMutation.mutate({ 
                            avatarId: selectedImportAvatar.avatar_id, 
                            name: selectedImportAvatar.avatar_name 
                          })}
                          disabled={importAvatarMutation.isPending}
                          className="w-full"
                          data-testid="button-import-selected-avatar"
                        >
                          {importAvatarMutation.isPending ? "Importing..." : `Import "${selectedImportAvatar.avatar_name}"`}
                        </Button>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground text-center">
                      💡 Tip: Make sure you have the necessary permissions to access the avatar in your HeyGen account
                    </div>
                  </div>
                </TabsContent>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={handleResetForm}
                    data-testid="button-cancel-avatar"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateAvatar}
                    disabled={createAvatarMutation.isPending}
                    data-testid="button-save-avatar"
                  >
                    {createAvatarMutation.isPending ? "Creating..." : "Create Avatar"}
                  </Button>
                </div>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
        <p className="text-sm text-muted-foreground">
          Create AI avatars that look and sound like you for professional video content
        </p>
      </CardHeader>
      
      <CardContent>
        {avatars?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <User className="mx-auto h-8 w-8 mb-2" />
            <p>No avatars created yet</p>
            <p className="text-xs">Create your first AI avatar to start making videos</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {avatars?.map((avatar) => (
              <div key={avatar.id} className="border rounded-lg p-4 space-y-3" data-testid={`avatar-card-${avatar.id}`}>
                {/* Avatar Preview */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center overflow-hidden">
                      {avatar.avatarImageUrl ? (
                        <img src={avatar.avatarImageUrl} alt={avatar.name} className="w-full h-full object-cover" />
                      ) : (
                        <User className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium text-sm">{avatar.name}</h3>
                      <p className="text-xs text-muted-foreground">{avatar.style}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    {avatar.isActive && (
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => toggleAvatarActive(avatar.id, avatar.isActive)}
                      data-testid={`toggle-avatar-${avatar.id}`}
                    >
                      <Settings className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Avatar Details */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Gender:</span>
                    <Badge variant="outline" className="text-xs">
                      {avatar.gender}
                    </Badge>
                  </div>
                  
                  {avatar.voiceId && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Voice:</span>
                      <div className="flex items-center">
                        <Mic className="h-3 w-3 mr-1" />
                        <span className="text-xs">{avatar.voiceId.includes('midwest') ? 'Midwest' : 'General'}</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="text-xs text-muted-foreground">
                    {avatar.description}
                  </div>
                </div>

                {/* Avatar Status */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <Badge 
                    className={`text-xs ${avatar.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}
                  >
                    {avatar.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  
                  <div className="flex space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-6"
                      onClick={() => testAvatar(avatar.id)}
                      disabled={testingAvatarId === avatar.id}
                      data-testid={`test-avatar-${avatar.id}`}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      {testingAvatarId === avatar.id ? 'Testing...' : 'Test'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-6"
                      onClick={() => handleEditAvatar(avatar)}
                      data-testid={`edit-avatar-${avatar.id}`}
                    >
                      <Edit2 className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Edit Avatar Modal */}
        {editingAvatar && (
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Avatar</DialogTitle>
                <DialogDescription>
                  Update your avatar's details and settings
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Photo Upload Section */}
                <div className="space-y-3">
                  <Label>Avatar Photo</Label>
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center overflow-hidden border">
                      {editPhotoPreview ? (
                        <img 
                          src={editPhotoPreview} 
                          alt="Avatar preview" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleEditPhotoUpload}
                        className="hidden"
                        id="edit-avatar-photo"
                        data-testid="input-edit-avatar-photo"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('edit-avatar-photo')?.click()}
                        data-testid="button-change-avatar-photo"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Change Photo
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">
                        Upload a clear photo showing your face
                      </p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="edit-name">Avatar Name</Label>
                  <Input
                    id="edit-name"
                    value={editingAvatar.name}
                    onChange={(e) => setEditingAvatar({ ...editingAvatar, name: e.target.value })}
                    placeholder="Enter avatar name"
                    data-testid="input-edit-avatar-name"
                  />
                </div>
                
                <div>
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editingAvatar.description}
                    onChange={(e) => setEditingAvatar({ ...editingAvatar, description: e.target.value })}
                    placeholder="Describe your avatar"
                    rows={3}
                    data-testid="textarea-edit-avatar-description"
                  />
                </div>
                
                <div>
                  <Label htmlFor="edit-style">Style</Label>
                  <Select
                    value={editingAvatar.style}
                    onValueChange={(value) => setEditingAvatar({ ...editingAvatar, style: value })}
                  >
                    <SelectTrigger data-testid="select-edit-avatar-style">
                      <SelectValue placeholder="Select style" />
                    </SelectTrigger>
                    <SelectContent>
                      {avatarStyles.map((style) => (
                        <SelectItem key={style.value} value={style.value}>
                          {style.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="edit-gender">Gender</Label>
                  <Select
                    value={editingAvatar.gender}
                    onValueChange={(value) => setEditingAvatar({ ...editingAvatar, gender: value })}
                  >
                    <SelectTrigger data-testid="select-edit-avatar-gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {genderOptions.map((gender) => (
                        <SelectItem key={gender.value} value={gender.value}>
                          {gender.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Voice Selection and Recording */}
                <div>
                  <Label htmlFor="edit-voice">Voice</Label>
                  <Select
                    value={editingAvatar.voiceId || ""}
                    onValueChange={(value) => setEditingAvatar({ ...editingAvatar, voiceId: value })}
                  >
                    <SelectTrigger data-testid="select-edit-avatar-voice">
                      <SelectValue placeholder="Select voice or record your own" />
                    </SelectTrigger>
                    <SelectContent>
                      {voiceOptions.map((voice) => (
                        <SelectItem key={voice.value} value={voice.value}>
                          {voice.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Voice Recording Section for Edit Mode */}
                {editingAvatar.voiceId === 'record_voice' && (
                  <div className="bg-muted/50 p-4 rounded-lg border space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Record Your Voice</Label>
                      {microphonePermission === 'denied' && (
                        <div className="flex items-center text-xs text-red-500">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          <span>Microphone access denied</span>
                        </div>
                      )}
                    </div>
                    
                    {microphonePermission === 'prompt' ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground mb-3">
                          We need permission to access your microphone
                        </p>
                        <Button onClick={requestMicrophonePermission} size="sm">
                          <Mic className="mr-2 h-4 w-4" />
                          Grant Microphone Access
                        </Button>
                      </div>
                    ) : microphonePermission === 'granted' ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-center space-x-3">
                          {!isRecording && !hasRecordedVoice && (
                            <Button 
                              onClick={startRecording}
                              variant="outline"
                              size="sm"
                              data-testid="button-start-recording-edit"
                            >
                              <Mic className="mr-2 h-3 w-3" />
                              Start Recording
                            </Button>
                          )}
                          
                          {isRecording && (
                            <Button 
                              onClick={stopRecording}
                              variant="destructive"
                              size="sm"
                              data-testid="button-stop-recording-edit"
                            >
                              <Square className="mr-2 h-3 w-3" />
                              Stop Recording ({recordingDuration}s)
                            </Button>
                          )}
                          
                          {hasRecordedVoice && !isRecording && (
                            <div className="flex space-x-2">
                              <Button 
                                onClick={isPlayingVoice ? stopPlayback : playRecordedVoice}
                                variant="outline"
                                size="sm"
                                data-testid="button-play-voice-edit"
                              >
                                {isPlayingVoice ? (
                                  <>
                                    <Pause className="mr-2 h-3 w-3" />
                                    Stop Playback
                                  </>
                                ) : (
                                  <>
                                    <Play className="mr-2 h-3 w-3" />
                                    Play Recording
                                  </>
                                )}
                              </Button>
                              
                              <Button
                                onClick={() => {
                                  setHasRecordedVoice(false);
                                  setRecordedAudioBlob(null);
                                }}
                                variant="outline"
                                size="sm"
                                data-testid="button-rerecord-edit"
                              >
                                <RotateCcw className="mr-2 h-3 w-3" />
                                Re-record
                              </Button>
                            </div>
                          )}
                        </div>
                        
                        {isRecording && (
                          <div className="text-center">
                            <div className="inline-flex items-center text-red-500">
                              <div className="animate-pulse mr-2">
                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                              </div>
                              <span className="text-sm">Recording... Speak clearly into your microphone</span>
                            </div>
                          </div>
                        )}
                        
                        {hasRecordedVoice && (
                          <div className="text-center">
                            <div className="inline-flex items-center text-green-600 text-sm">
                              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                              Voice recorded successfully!
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm text-red-500">
                          Microphone access is blocked. Please enable it in your browser settings.
                        </p>
                      </div>
                    )}
                    
                    <p className="text-xs text-muted-foreground">
                      Record a 5-15 second sample of your voice. This will be used to clone your voice for video generation.
                    </p>
                  </div>
                )}
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsEditDialogOpen(false)}
                    data-testid="button-cancel-edit-avatar"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleUpdateAvatar}
                    disabled={updateAvatarMutation.isPending}
                    data-testid="button-save-edit-avatar"
                  >
                    {updateAvatarMutation.isPending ? "Updating..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        
        {/* Test Result Modal */}
        {testResult && (
          <Dialog open={!!testResult} onOpenChange={() => setTestResult(null)}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Avatar Test Result</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                {testResult.videoUrl ? (
                  <div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Your avatar test is complete! Here's how your AI avatar looks and sounds:
                    </p>
                    {testResult.videoUrl.includes('example.com') ? (
                      <div className="aspect-video bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border-2 border-dashed border-blue-200 dark:border-blue-700 flex items-center justify-center">
                        <div className="text-center p-6">
                          <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <User className="h-8 w-8 text-white" />
                          </div>
                          <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Avatar Test Successful!</h3>
                          <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                            Your avatar has been processed and is ready for video generation.
                          </p>
                          <div className="flex items-center justify-center space-x-2 text-xs text-blue-600 dark:text-blue-400">
                            <Video className="h-4 w-4" />
                            <span>Demo Mode - Video generation ready</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-video bg-black rounded-lg overflow-hidden">
                        <video 
                          src={testResult.videoUrl} 
                          controls 
                          className="w-full h-full"
                          data-testid="test-video-player"
                          onError={() => {
                            console.error('Failed to load video:', testResult.videoUrl);
                          }}
                        >
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      This is how your avatar will appear in generated videos. You can now use this avatar to create professional real estate content.
                    </p>
                  </div>
                ) : testResult.error ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-red-600 mb-2">Test Failed</p>
                    <p className="text-xs text-muted-foreground">{testResult.error}</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3"
                      onClick={() => testAvatar(testResult.avatarId)}
                    >
                      Try Again
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Generating your test video...</p>
                    <p className="text-xs text-muted-foreground mt-1">This usually takes 3-5 minutes</p>
                  </div>
                )}
                
                <div className="flex justify-end">
                  <Button onClick={() => setTestResult(null)} variant="outline">
                    Close
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}