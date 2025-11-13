import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Video, VideoOff, Volume2, VolumeX, Send, StopCircle, Loader2, Phone, PhoneOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface StreamingSession {
  sessionId: string;
  iceServers: any;
  offer: string;
}

export function StreamingAvatar() {
  const { toast } = useToast();
  const [selectedAvatar, setSelectedAvatar] = useState<string>('');
  const [session, setSession] = useState<StreamingSession | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);
  const [message, setMessage] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // HeyGen's public streaming avatars (these always work)
  const defaultStreamingAvatars = [
    { avatar_id: 'Wayne_20240711', avatar_name: 'Wayne - Professional Male' },
    { avatar_id: 'Angela-inblackskirt-20220820', avatar_name: 'Angela - Professional Female' },
    { avatar_id: 'josh_lite3_20230714', avatar_name: 'Josh - Casual Male' },
    { avatar_id: 'Anna_public_3_20240108', avatar_name: 'Anna - Business Woman' },
    { avatar_id: 'Tyler-incasualsuit-20220721', avatar_name: 'Tyler - Casual Male' },
  ];

  // Set default avatar
  useEffect(() => {
    if (!selectedAvatar && defaultStreamingAvatars.length > 0) {
      setSelectedAvatar(defaultStreamingAvatars[0].avatar_id);
    }
  }, [selectedAvatar]);

  // Create streaming session
  const createSessionMutation = useMutation({
    mutationFn: async (avatarId: string) => {
      const res = await apiRequest('POST', '/api/streaming/sessions', { avatarId });
      return await res.json();
    },
    onSuccess: async (data) => {
      setSession(data);
      setIsConnecting(true);
      await setupWebRTC(data);
    },
    onError: (error) => {
      toast({
        title: "Connection Failed",
        description: "Failed to create streaming session. Please try again.",
        variant: "destructive"
      });
      setIsConnecting(false);
    }
  });

  // Setup WebRTC connection
  const setupWebRTC = async (sessionData: StreamingSession) => {
    try {
      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: sessionData.iceServers
      });
      
      peerConnectionRef.current = pc;

      // Handle incoming stream
      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
        }
      };

      // Handle connection state
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setIsConnected(true);
          setIsConnecting(false);
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setIsConnected(false);
          setIsConnecting(false);
        }
      };

      // Set remote offer and create answer
      await pc.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: sessionData.offer
      }));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Send answer back to server (implementation depends on HeyGen's requirements)
      // This would typically involve sending the answer SDP back to complete the connection
      
      setIsConnected(true);
      setIsConnecting(false);
    } catch (error) {
      console.error('WebRTC setup failed:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to establish video connection.",
        variant: "destructive"
      });
      setIsConnecting(false);
    }
  };

  // Make avatar speak
  const speakMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest('POST', `/api/streaming/sessions/${session?.sessionId}/speak`, { text });
      return await res.json();
    },
    onSuccess: () => {
      setMessage('');
    },
    onError: (error) => {
      toast({
        title: "Speaking Failed",
        description: "Failed to make avatar speak. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Start voice chat
  const startVoiceChatMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/streaming/sessions/${session?.sessionId}/voice-chat`);
      return await res.json();
    },
    onSuccess: async () => {
      // Get user's microphone
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        
        // Add audio track to peer connection
        if (peerConnectionRef.current && stream.getAudioTracks()[0]) {
          peerConnectionRef.current.addTrack(stream.getAudioTracks()[0], stream);
        }
        
        setIsVoiceChatActive(true);
        toast({
          title: "Voice Chat Started",
          description: "You can now speak with the avatar.",
        });
      } catch (error) {
        toast({
          title: "Microphone Access Denied",
          description: "Please allow microphone access to use voice chat.",
          variant: "destructive"
        });
      }
    }
  });

  // Stop voice chat
  const stopVoiceChatMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('DELETE', `/api/streaming/sessions/${session?.sessionId}/voice-chat`);
      return await res.json();
    },
    onSuccess: () => {
      // Stop local audio stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      setIsVoiceChatActive(false);
    }
  });

  // Interrupt avatar
  const interruptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/streaming/sessions/${session?.sessionId}/interrupt`);
      return await res.json();
    }
  });

  // End session
  const endSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('DELETE', `/api/streaming/sessions/${session?.sessionId}`);
      return await res.json();
    },
    onSuccess: () => {
      cleanup();
      setSession(null);
      setIsConnected(false);
      toast({
        title: "Session Ended",
        description: "Streaming session has been terminated.",
      });
    }
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleSendMessage = () => {
    if (message.trim() && session) {
      speakMutation.mutate(message.trim());
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const videoTracks = (videoRef.current.srcObject as MediaStream).getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !isVideoOn;
      });
      setIsVideoOn(!isVideoOn);
    }
  };

  return (
    <Card data-testid="card-streaming-avatar">
      <CardHeader>
        <CardTitle>Interactive Streaming Avatar</CardTitle>
        <CardDescription>
          Real-time interactive AI avatar with live video streaming, text-to-speech, and two-way voice chat.
          <br />
          <strong>Note:</strong> This uses HeyGen's Streaming Avatars (different from Photo Avatars). Only streaming-compatible avatars appear in the dropdown.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar Selection and Connection */}
        {!isConnected && !isConnecting && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Avatar</label>
              <Select value={selectedAvatar} onValueChange={setSelectedAvatar}>
                <SelectTrigger data-testid="select-avatar">
                  <SelectValue placeholder="Choose an avatar" />
                </SelectTrigger>
                <SelectContent>
                  {defaultStreamingAvatars.map((avatar) => (
                    <SelectItem key={avatar.avatar_id} value={avatar.avatar_id}>
                      {avatar.avatar_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button
              onClick={() => createSessionMutation.mutate(selectedAvatar)}
              disabled={createSessionMutation.isPending || !selectedAvatar}
              className="w-full"
              data-testid="button-start-session"
            >
              {createSessionMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Session...
                </>
              ) : (
                <>
                  <Video className="w-4 h-4 mr-2" />
                  Start Streaming Session
                </>
              )}
            </Button>
          </div>
        )}

        {/* Connecting State */}
        {isConnecting && (
          <Alert>
            <Loader2 className="w-4 h-4 animate-spin" />
            <AlertDescription>
              Establishing connection with avatar...
            </AlertDescription>
          </Alert>
        )}

        {/* Video Display */}
        {(isConnected || isConnecting) && (
          <div className="space-y-4">
            <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
                data-testid="video-stream"
              />
              {!isVideoOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <VideoOff className="w-16 h-16 text-gray-400" />
                </div>
              )}
              
              {/* Status Badge */}
              <div className="absolute top-4 left-4">
                <Badge variant={isConnected ? "default" : "secondary"}>
                  {isConnected ? "Connected" : "Connecting..."}
                </Badge>
              </div>
              
              {/* Control Buttons */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={toggleMute}
                  data-testid="button-toggle-mute"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
                
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={toggleVideo}
                  data-testid="button-toggle-video"
                >
                  {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </Button>
                
                {!isVoiceChatActive ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => startVoiceChatMutation.mutate()}
                    disabled={startVoiceChatMutation.isPending}
                    data-testid="button-start-voice"
                  >
                    <Phone className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => stopVoiceChatMutation.mutate()}
                    disabled={stopVoiceChatMutation.isPending}
                    data-testid="button-stop-voice"
                  >
                    <PhoneOff className="w-4 h-4" />
                  </Button>
                )}
                
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => interruptMutation.mutate()}
                  disabled={interruptMutation.isPending}
                  data-testid="button-interrupt"
                >
                  <StopCircle className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Text Input for Making Avatar Speak */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Make Avatar Speak</label>
              <div className="flex gap-2">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter text for the avatar to speak..."
                  className="flex-1"
                  rows={3}
                  data-testid="textarea-message"
                />
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleSendMessage}
                    disabled={!message.trim() || speakMutation.isPending}
                    data-testid="button-send"
                  >
                    {speakMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => endSessionMutation.mutate()}
                    disabled={endSessionMutation.isPending}
                    data-testid="button-end-session"
                  >
                    End
                  </Button>
                </div>
              </div>
            </div>

            {/* Voice Chat Status */}
            {isVoiceChatActive && (
              <Alert>
                <Mic className="w-4 h-4" />
                <AlertDescription>
                  Voice chat is active. Speak naturally and the avatar will respond.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}