import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const [isListening, setIsListening] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const roomRef = useRef<LiveKitClient.Room | null>(null);
  const recognitionRef = useRef<any>(null);

  // Fetch stored custom avatars (locally saved with HeyGen streaming IDs)
  const { data: customAvatarsResponse } = useQuery({
    queryKey: ['/api/avatars'],
  });

  // Fetch Interactive Avatars from HeyGen account (created via HeyGen Labs)
  const { data: streamingAvatarsData, isLoading: streamingAvatarsLoading } = useQuery({
    queryKey: ['/api/streaming/avatars'],
  });

  // HeyGen's public streaming avatars (fallback / always shown)
  const defaultStreamingAvatars: Avatar[] = [
    { avatar_id: 'Wayne_20240711', avatar_name: 'Wayne - Professional Male', avatar_type: 'public' },
    { avatar_id: 'Angela-inblackskirt-20220820', avatar_name: 'Angela - Professional Female', avatar_type: 'public' },
    { avatar_id: 'josh_lite3_20230714', avatar_name: 'Josh - Casual Male', avatar_type: 'public' },
    { avatar_id: 'Anna_public_3_20240108', avatar_name: 'Anna - Business Woman', avatar_type: 'public' },
    { avatar_id: 'Tyler-incasualsuit-20220721', avatar_name: 'Tyler - Casual Male', avatar_type: 'public' },
  ];

  const defaultIds = new Set(defaultStreamingAvatars.map(a => a.avatar_id));

  // Interactive avatars created by the user in HeyGen Labs
  const heygenInteractiveAvatars: Avatar[] = ((streamingAvatarsData as any)?.avatars || [])
    .filter((a: any) => !defaultIds.has(a.avatar_id))
    .map((a: any) => ({
      avatar_id: a.avatar_id,
      avatar_name: a.avatar_name,
      preview_image_url: a.preview_image_url,
      avatar_type: 'interactive',
      supportsGestures: true,
    }));

  // Locally stored custom avatars (uploaded via Avatar Creator)
  const localCustomAvatars: Avatar[] = (customAvatarsResponse || [])
    .filter((avatar: any) => avatar.heygenAvatarId)
    .map((avatar: any) => ({
      avatar_id: avatar.heygenAvatarId,
      avatar_name: `${avatar.name} (Custom)`,
      avatar_type: 'custom',
      supportsGestures: avatar.supportsGestures || false,
    }));

  // All avatars combined (for default selection logic)
  const allAvatars: Avatar[] = [
    ...heygenInteractiveAvatars,
    ...localCustomAvatars,
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

  // Speech to Text - Interactive voice mode
  const handleStartListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({
        title: "Not Supported",
        description: "Speech recognition is not supported in your browser. Use Chrome, Edge, or Safari.",
        variant: "destructive"
      });
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      console.log('🎤 Speech recognition started');
      setIsListening(true);
    };

    recognition.onend = () => {
      console.log('🎤 Speech recognition ended');
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript;
      console.log('🎤 Transcript:', transcript);
      
      if (transcript.trim()) {
        setMessage(transcript.trim());
        toast({
          title: "Voice captured",
          description: `"${transcript.trim()}"`,
        });
      }
    };

    recognition.onerror = (event: any) => {
      console.error('🎤 Speech recognition error:', event.error);
      setIsListening(false);
      
      if (event.error === 'no-speech') {
        toast({
          title: "No speech detected",
          description: "Please try speaking again.",
        });
      } else if (event.error === 'not-allowed') {
        toast({
          title: "Microphone access denied",
          description: "Please allow microphone access in your browser settings.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Speech Recognition Error",
          description: event.error,
          variant: "destructive"
        });
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // Auto-send message after voice capture (interactive mode)
  const handleVoiceAndSend = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({
        title: "Not Supported",
        description: "Speech recognition is not supported in your browser. Use Chrome, Edge, or Safari.",
        variant: "destructive"
      });
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      console.log('🎤 Interactive mode: listening...');
      setIsListening(true);
    };

    recognition.onend = () => {
      console.log('🎤 Interactive mode: finished');
      setIsListening(false);
    };

    recognition.onresult = async (event: any) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript;
      console.log('🎤 Interactive transcript:', transcript);
      
      if (transcript.trim() && session) {
        toast({
          title: "Sending to avatar...",
          description: `"${transcript.trim()}"`,
        });
        
        try {
          setIsSpeaking(true);
          await apiRequest('POST', `/api/streaming/sessions/${session.sessionId}/speak`, {
            text: transcript.trim(),
            taskType: 'TALK'
          });
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
      }
    };

    recognition.onerror = (event: any) => {
      console.error('🎤 Interactive mode error:', event.error);
      setIsListening(false);
      
      if (event.error === 'no-speech') {
        toast({
          title: "No speech detected",
          description: "Please try speaking again.",
        });
      } else if (event.error === 'not-allowed') {
        toast({
          title: "Microphone access denied",
          description: "Please allow microphone access in your browser settings.",
          variant: "destructive"
        });
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
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
                {streamingAvatarsLoading && (
                  <SelectItem value="loading-placeholder" disabled>
                    <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />
                    Loading your avatars...
                  </SelectItem>
                )}
                {heygenInteractiveAvatars.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Your Interactive Avatars</SelectLabel>
                    {heygenInteractiveAvatars.map((avatar) => (
                      <SelectItem
                        key={avatar.avatar_id}
                        value={avatar.avatar_id}
                        data-testid={`avatar-option-${avatar.avatar_id}`}
                      >
                        {avatar.avatar_name} ✨
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {localCustomAvatars.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Custom (Locally Saved)</SelectLabel>
                    {localCustomAvatars.map((avatar) => (
                      <SelectItem
                        key={avatar.avatar_id}
                        value={avatar.avatar_id}
                        data-testid={`avatar-option-${avatar.avatar_id}`}
                      >
                        {avatar.avatar_name} {avatar.supportsGestures && '✨'}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                <SelectGroup>
                  <SelectLabel>Public Avatars</SelectLabel>
                  {defaultStreamingAvatars.map((avatar) => (
                    <SelectItem
                      key={avatar.avatar_id}
                      value={avatar.avatar_id}
                      data-testid={`avatar-option-${avatar.avatar_id}`}
                    >
                      {avatar.avatar_name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {allAvatars.length} avatars available • ✨ = Gesture support
            </p>
          </div>

          {/* Custom Avatar Creation Info */}
          <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-900 dark:text-blue-100">
              <div className="space-y-2">
                <div>
                  <strong>Creating a Custom Interactive Avatar</strong>
                </div>
                <div className="text-sm">
                  You can create your own Interactive Avatar on HeyGen and use it with the Streaming API! Go to <a href="https://www.heygen.com/labs" target="_blank" rel="noopener noreferrer" className="underline font-semibold hover:text-blue-700 dark:hover:text-blue-300">HeyGen Labs</a> and click "Create Interactive Avatar" to get started.
                </div>
                <div className="text-sm">
                  <a href="https://www.youtube.com/watch?v=your-video-id" target="_blank" rel="noopener noreferrer" className="underline font-semibold hover:text-blue-700 dark:hover:text-blue-300">Here is an instructions video for filming the footage!</a>
                </div>
                <div className="text-sm border-t border-blue-200 dark:border-blue-800 pt-2 mt-2">
                  Need help? <strong>Contact admin (Mike)</strong> for additional assistance.
                </div>
              </div>
            </AlertDescription>
          </Alert>

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

          {/* Interactive Voice Mode */}
          {isConnected && (
            <div className="space-y-4">
              {/* Quick Talk Button - Main interactive feature */}
              <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-3">
                  <Mic className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <label className="text-base font-semibold text-green-900 dark:text-green-100">Talk to Avatar</label>
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                    Interactive
                  </Badge>
                </div>
                <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                  Click the button below and speak - your voice will be transcribed and sent directly to the avatar!
                </p>
                <Button
                  onClick={handleVoiceAndSend}
                  disabled={isSpeaking}
                  size="lg"
                  className={`w-full h-16 text-lg transition-all ${
                    isListening 
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                  data-testid="button-talk-interactive"
                >
                  {isListening ? (
                    <>
                      <Mic className="w-6 h-6 mr-2 animate-bounce" />
                      Listening... (click to stop)
                    </>
                  ) : isSpeaking ? (
                    <>
                      <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                      Avatar Speaking...
                    </>
                  ) : (
                    <>
                      <Mic className="w-6 h-6 mr-2" />
                      Click to Talk
                    </>
                  )}
                </Button>
              </div>

              {/* Manual Text Input - Secondary option */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Or type a message:</label>
                <div className="flex gap-2">
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type text for the avatar to speak..."
                    className="min-h-[60px]"
                    disabled={isSpeaking}
                    data-testid="input-message"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSpeak();
                      }
                    }}
                  />
                  <div className="flex flex-col gap-1">
                    <Button
                      onClick={handleStartListening}
                      variant={isListening ? "default" : "outline"}
                      size="sm"
                      className="h-[28px]"
                      data-testid="button-listen"
                      title={isListening ? "Stop listening" : "Dictate text"}
                    >
                      {isListening ? (
                        <Mic className="w-4 h-4 animate-pulse text-red-500" />
                      ) : (
                        <Mic className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      onClick={handleSpeak}
                      disabled={!message.trim() || isSpeaking}
                      size="sm"
                      className="h-[28px]"
                      data-testid="button-speak"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
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
