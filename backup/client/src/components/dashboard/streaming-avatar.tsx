import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Mic, MicOff, Video, VideoOff, Volume2, VolumeX, Send, StopCircle, Loader2, Phone, Hand, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import * as LiveKitClient from 'livekit-client';

interface StreamingSession {
  sessionId: string;
  url: string;
  accessToken: string;
}

interface Avatar {
  avatar_id: string;
  avatar_name: string;
  preview_image_url?: string;
  avatar_type?: string;
  supportsGestures?: boolean;
}

export function StreamingAvatarComponent() {
  const { toast } = useToast();
  const [selectedAvatar, setSelectedAvatar] = useState<string>('');
  const [session, setSession] = useState<StreamingSession | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [message, setMessage] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [gestureIntensity, setGestureIntensity] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const roomRef = useRef<LiveKitClient.Room | null>(null);

  // Fetch stored custom avatars (streaming-compatible)
  const { data: customAvatarsResponse } = useQuery({
    queryKey: ['/api/avatars'],
  });

  // HeyGen's public streaming avatars
  const defaultStreamingAvatars: Avatar[] = [
    { avatar_id: 'Wayne_20240711', avatar_name: 'Wayne - Professional Male', avatar_type: 'public' },
    { avatar_id: 'Angela-inblackskirt-20220820', avatar_name: 'Angela - Professional Female', avatar_type: 'public' },
    { avatar_id: 'josh_lite3_20230714', avatar_name: 'Josh - Casual Male', avatar_type: 'public' },
    { avatar_id: 'Anna_public_3_20240108', avatar_name: 'Anna - Business Woman', avatar_type: 'public' },
    { avatar_id: 'Tyler-incasualsuit-20220721', avatar_name: 'Tyler - Casual Male', avatar_type: 'public' },
  ];

  // Combine streaming-compatible avatars: stored avatars + public avatars
  // NOTE: Photo avatar groups are NOT included because they only work for video generation, not streaming
  const allAvatars: Avatar[] = [
    // Stored custom streaming avatars (from avatars API with HeyGen streaming IDs)
    ...(customAvatarsResponse || [])
      .filter((avatar: any) => avatar.heygenAvatarId) // Only include if has HeyGen streaming ID
      .map((avatar: any) => ({
        avatar_id: avatar.heygenAvatarId,
        avatar_name: `${avatar.name} (Custom)`,
        avatar_type: 'custom',
        supportsGestures: avatar.supportsGestures || false,
      })),
    // Public HeyGen streaming avatars
    ...defaultStreamingAvatars,
  ];

  // Set default avatar
  useEffect(() => {
    if (!selectedAvatar && allAvatars.length > 0) {
      setSelectedAvatar(allAvatars[0].avatar_id);
    }
  }, [selectedAvatar, allAvatars.length]);

  // Create streaming session and connect with LiveKit
  const startSessionMutation = useMutation({
    mutationFn: async ({ avatarId, gestureIntensity }: { avatarId: string; gestureIntensity: number }) => {
      const res = await apiRequest('POST', '/api/streaming/sessions', { avatarId, gestureIntensity });
      const data = await res.json();
      
      console.log('🔍 Backend response:', {
        hasSessionId: !!data.sessionId,
        hasUrl: !!data.url,
        hasAccessToken: !!data.accessToken,
        sessionData: data.sessionData
      });
      
      return data;
    },
    onSuccess: async (data) => {
      setSession(data);
      setIsConnecting(true);
      await connectLiveKit(data);
    },
    onError: (error) => {
      console.error('❌ Session creation failed:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to create streaming session.",
        variant: "destructive"
      });
      setIsConnecting(false);
    }
  });

  // Connect to LiveKit room
  const connectLiveKit = async (sessionData: StreamingSession) => {
    try {
      console.log('🔌 Connecting to LiveKit...', {
        url: sessionData.url,
        hasToken: !!sessionData.accessToken
      });

      // Start the session first
      await apiRequest('POST', '/api/streaming/start', {
        sessionId: sessionData.sessionId
      });

      const room = new LiveKitClient.Room({
        adaptiveStream: true,
        dynacast: true,
      });

      roomRef.current = room;

      // Handle track subscriptions
      room.on(LiveKitClient.RoomEvent.TrackSubscribed, (
        track: LiveKitClient.RemoteTrack,
        publication: LiveKitClient.RemoteTrackPublication,
        participant: LiveKitClient.RemoteParticipant
      ) => {
        console.log('📹 Track subscribed:', track.kind);
        
        if (track.kind === LiveKitClient.Track.Kind.Video) {
          const videoTrack = track as LiveKitClient.RemoteVideoTrack;
          if (videoRef.current) {
            videoTrack.attach(videoRef.current);
            console.log('✅ Video track attached');
          }
        } else if (track.kind === LiveKitClient.Track.Kind.Audio) {
          const audioTrack = track as LiveKitClient.RemoteAudioTrack;
          if (audioRef.current) {
            audioTrack.attach(audioRef.current);
            console.log('✅ Audio track attached');
          }
        }
      });

      // Handle connection state changes
      room.on(LiveKitClient.RoomEvent.Connected, () => {
        console.log('✅ LiveKit room connected');
        setIsConnected(true);
        setIsConnecting(false);
        toast({
          title: "Connected!",
          description: "Streaming avatar is ready.",
        });
      });

      room.on(LiveKitClient.RoomEvent.Disconnected, () => {
        console.log('❌ LiveKit room disconnected');
        setIsConnected(false);
        setIsConnecting(false);
        toast({
          title: "Disconnected",
          description: "Avatar session ended.",
        });
      });

      room.on(LiveKitClient.RoomEvent.Reconnecting, () => {
        console.log('🔄 LiveKit reconnecting...');
        toast({
          title: "Reconnecting...",
          description: "Connection interrupted, attempting to reconnect.",
        });
      });

      // Connect to the LiveKit room
      await room.connect(sessionData.url, sessionData.accessToken);
      console.log('✅ Room connection initiated');

    } catch (error) {
      console.error('❌ LiveKit connection failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Connection Failed",
        description: `Failed to connect to avatar: ${errorMessage}`,
        variant: "destructive"
      });
      setIsConnecting(false);
    }
  };

  // Stop session
  const stopSession = async () => {
    try {
      if (session) {
        await apiRequest('DELETE', `/api/streaming/sessions/${session.sessionId}`);
      }
      
      if (roomRef.current) {
        await roomRef.current.disconnect();
        roomRef.current = null;
      }
      
      setSession(null);
      setIsConnected(false);
      setIsConnecting(false);
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      toast({
        title: "Session Ended",
        description: "Avatar session has been stopped.",
      });
    } catch (error) {
      console.error('Failed to stop session:', error);
    }
  };

  // Make avatar speak
  const handleSpeak = async () => {
    if (!message.trim() || !session) return;

    try {
      setIsSpeaking(true);
      await apiRequest('POST', `/api/streaming/sessions/${session.sessionId}/speak`, {
        text: message,
        taskType: 'TALK'
      });
      setMessage('');
      
      // Auto-reset speaking status after a delay
      setTimeout(() => setIsSpeaking(false), 2000);
    } catch (error) {
      console.error('Failed to make avatar speak:', error);
      toast({
        title: "Speech Failed",
        description: "Failed to make avatar speak.",
        variant: "destructive"
      });
      setIsSpeaking(false);
    }
  };

  // Toggle mute
  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (videoRef.current) {
      videoRef.current.style.display = isVideoOn ? 'none' : 'block';
      setIsVideoOn(!isVideoOn);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div className="space-y-6" data-testid="streaming-avatar-container">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Streaming Avatar (Real-Time)
          </CardTitle>
          <CardDescription>
            Interact with AI avatars in real-time using HeyGen's streaming technology powered by LiveKit
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Avatar Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Avatar</label>
            <Select
              value={selectedAvatar}
              onValueChange={setSelectedAvatar}
              disabled={isConnected || isConnecting}
              data-testid="avatar-select"
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose an avatar" />
              </SelectTrigger>
              <SelectContent>
                {allAvatars.length === 0 ? (
                  <SelectItem value="loading" disabled>Loading avatars...</SelectItem>
                ) : (
                  allAvatars.map((avatar) => (
                    <SelectItem 
                      key={avatar.avatar_id} 
                      value={avatar.avatar_id}
                      data-testid={`avatar-option-${avatar.avatar_id}`}
                    >
                      {avatar.avatar_name} {avatar.supportsGestures && '✨'}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {allAvatars.length} avatars available • ✨ = Gesture support
            </p>
          </div>

          {/* Gesture Controls - Only show for gesture-enabled avatars */}
          {allAvatars.find(a => a.avatar_id === selectedAvatar)?.supportsGestures && (
            <div className="space-y-3 border rounded-lg p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
              <div className="flex items-center gap-2">
                <Hand className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <Label className="text-base font-semibold text-purple-900 dark:text-purple-100">
                  Real-Time Gesture & Expressiveness
                </Label>
                <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100">
                  Pro Feature
                </Badge>
              </div>
            
            <p className="text-sm text-purple-800 dark:text-purple-200">
              Control how animated and expressive your live avatar will be during the streaming session.
            </p>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-purple-900 dark:text-purple-100">
                  Gesture Intensity
                </Label>
                <span className="text-sm font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900 px-3 py-1 rounded-full">
                  {gestureIntensity === 0 ? 'Off' : gestureIntensity === 1 ? 'Subtle' : gestureIntensity === 2 ? 'Moderate' : 'Expressive'}
                </span>
              </div>
              
              <Slider
                min={0}
                max={3}
                step={1}
                value={[gestureIntensity]}
                onValueChange={(value) => setGestureIntensity(value[0])}
                disabled={isConnected || isConnecting}
                className="cursor-pointer"
                data-testid="slider-streaming-gesture-intensity"
              />
              
              <div className="flex justify-between text-xs text-purple-700 dark:text-purple-300 mt-1">
                <span>Off</span>
                <span>Subtle</span>
                <span>Moderate</span>
                <span>Expressive</span>
              </div>
            </div>
            
              <Alert className="bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800">
                <Info className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <AlertDescription className="text-purple-800 dark:text-purple-200 text-xs">
                  <strong>Note:</strong> Gesture settings must be configured before starting the session. Changes take effect on next connection.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <Badge variant={isConnected ? "default" : "secondary"} data-testid="connection-status">
              {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
            {isSpeaking && (
              <Badge variant="outline" className="animate-pulse" data-testid="speaking-indicator">
                🗣️ Speaking
              </Badge>
            )}
          </div>

          {/* Connection Controls */}
          <div className="flex gap-2">
            {!isConnected ? (
              <Button
                onClick={() => startSessionMutation.mutate({ avatarId: selectedAvatar, gestureIntensity })}
                disabled={isConnecting || !selectedAvatar}
                className="flex-1"
                data-testid="button-start-session"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4 mr-2" />
                    Start Avatar Session
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={stopSession}
                variant="destructive"
                className="flex-1"
                data-testid="button-stop-session"
              >
                <StopCircle className="w-4 h-4 mr-2" />
                End Session
              </Button>
            )}
          </div>

          {/* Video Display */}
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              data-testid="video-stream"
            />
            <audio ref={audioRef} autoPlay />
            
            {!isConnected && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <div className="text-center text-white">
                  <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm opacity-75">
                    {isConnecting ? 'Connecting to avatar...' : 'Select an avatar and click Start'}
                  </p>
                </div>
              </div>
            )}

            {/* Video Controls Overlay */}
            {isConnected && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 bg-black/50 p-2 rounded-lg">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={toggleMute}
                  className="text-white hover:bg-white/20"
                  data-testid="button-toggle-mute"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={toggleVideo}
                  className="text-white hover:bg-white/20"
                  data-testid="button-toggle-video"
                >
                  {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </Button>
              </div>
            )}
          </div>

          {/* Text Input for Avatar Speech */}
          {isConnected && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Make Avatar Speak</label>
              <div className="flex gap-2">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter text for the avatar to speak..."
                  className="min-h-[80px]"
                  disabled={isSpeaking}
                  data-testid="input-message"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSpeak();
                    }
                  }}
                />
              </div>
              <Button
                onClick={handleSpeak}
                disabled={!message.trim() || isSpeaking}
                className="w-full"
                data-testid="button-speak"
              >
                {isSpeaking ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Speaking...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Info Alert */}
          <Alert>
            <AlertDescription className="text-sm">
              <strong>💡 Tip:</strong> Streaming avatars provide real-time interaction with low latency using LiveKit WebRTC technology.
              {!isConnected && ' Select an avatar and click "Start Avatar Session" to begin.'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
