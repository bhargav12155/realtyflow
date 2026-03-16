// HeyGen Streaming Avatar Service
// Server-side implementation for managing streaming sessions

interface StreamingSession {
  sessionId: string;
  userId: string;
  avatarName: string;
  createdAt: Date;
  iceServers?: any;
  offer?: string;
}

export class HeyGenStreamingService {
  private apiKey: string;
  private sessions: Map<string, StreamingSession> = new Map();

  constructor() {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      throw new Error('HEYGEN_API_KEY is not set in environment variables');
    }
    this.apiKey = apiKey;
  }

  // Create a new streaming session
  async createSession(userId: string, avatarId?: string, gestureIntensity: number = 0) {
    try {
      // Build the request payload with gesture support
      const payload: any = {
        quality: 'medium',
        avatar_id: avatarId || 'Wayne_20240711',
        voice: {
          voice_id: '2d5b0e6cf36f460aa7fc47e3eee4ba54',
          rate: 1.0,
          emotion: 'Friendly'
        },
        video_encoding: 'H264',
        disable_idle_timeout: false,
        activity_idle_timeout: 120,
        version: 'v2'
      };

      // Add gesture support if intensity > 0
      if (gestureIntensity > 0) {
        payload.gesture = {
          intensity: gestureIntensity
        };
      }

      // Start the avatar session via NEW API endpoint
      const response = await fetch('https://api.heygen.com/v1/streaming.new', {
        method: 'POST',
        headers: {
          'X-Api-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('HeyGen Streaming API Error:', JSON.stringify(errorData, null, 2));
        throw new Error(`Failed to create session: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const sessionData = await response.json();
      console.log('✅ HeyGen session created:', sessionData.data?.session_id);
      console.log('🔍 HeyGen API Response Keys:', Object.keys(sessionData.data || {}));
      console.log('🔍 Has ice_servers:', !!sessionData.data?.ice_servers);
      console.log('🔍 Has sdp:', !!sessionData.data?.sdp);
      console.log('🔍 ice_servers value:', sessionData.data?.ice_servers);
      console.log('🔍 sdp value:', sessionData.data?.sdp);

      // Store session
      const session: StreamingSession = {
        sessionId: sessionData.data?.session_id,
        userId,
        avatarName: avatarId || 'default',
        createdAt: new Date(),
        iceServers: sessionData.data?.ice_servers,
        offer: sessionData.data?.sdp?.sdp
      };
      this.sessions.set(session.sessionId, session);

      return {
        sessionId: session.sessionId,
        iceServers: sessionData.data?.ice_servers,
        offer: sessionData.data?.sdp?.sdp,
        url: sessionData.data?.url,
        accessToken: sessionData.data?.access_token,
        realtimeEndpoint: sessionData.data?.realtime_endpoint,
        sessionData: sessionData.data
      };
    } catch (error) {
      console.error('Failed to create streaming session:', error);
      throw error;
    }
  }

  // Submit ICE candidate or SDP answer to complete WebRTC connection
  async submitICE(sessionId: string, candidate?: any, sdp?: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const response = await fetch(`https://api.heygen.com/v1/streaming.ice`, {
      method: 'POST',
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        candidate: candidate,
        sdp: sdp
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to submit ICE:', errorData);
      throw new Error(`Failed to submit ICE: ${response.status}`);
    }

    return await response.json();
  }

  // Start the streaming session
  async startSession(sessionId: string) {
    const response = await fetch(`https://api.heygen.com/v1/streaming.start`, {
      method: 'POST',
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to start session:', errorData);
      throw new Error(`Failed to start session: ${response.status}`);
    }

    console.log('✅ Session started:', sessionId);
    return await response.json();
  }

  // Make avatar speak
  async speak(sessionId: string, text: string, taskType: 'TALK' | 'REPEAT' = 'TALK') {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const response = await fetch(`https://api.heygen.com/v1/streaming.task`, {
      method: 'POST',
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        text,
        task_type: taskType.toLowerCase()
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HeyGen speak error (${response.status}):`, errorText);
      throw new Error(`Failed to make avatar speak: ${response.status}`);
    }

    return await response.json();
  }

  // Start voice chat
  async startVoiceChat(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const response = await fetch(`https://api.heygen.com/v1/streaming.start_voice_chat`, {
      method: 'POST',
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        use_silence_prompt: true
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to start voice chat: ${response.status}`);
    }

    return await response.json();
  }

  // Stop voice chat
  async stopVoiceChat(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const response = await fetch(`https://api.heygen.com/v1/streaming.stop_voice_chat`, {
      method: 'POST',
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to stop voice chat: ${response.status}`);
    }

    return await response.json();
  }

  // Interrupt avatar speaking
  async interrupt(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const response = await fetch(`https://api.heygen.com/v1/streaming.interrupt`, {
      method: 'POST',
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to interrupt: ${response.status}`);
    }

    return await response.json();
  }

  // End streaming session
  async endSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const response = await fetch(`https://api.heygen.com/v1/streaming.stop`, {
      method: 'POST',
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId
      })
    });

    if (!response.ok) {
      console.error(`Failed to stop session: ${response.status}`);
    }

    this.sessions.delete(sessionId);
    return { success: true };
  }

  // Get active sessions for a user
  getActiveSessions(userId: string): string[] {
    const sessions: string[] = [];
    this.sessions.forEach((session, sessionId) => {
      if (session.userId === userId) {
        sessions.push(sessionId);
      }
    });
    return sessions;
  }

  // List available streaming avatars
  async listStreamingAvatars() {
    try {
      const response = await fetch('https://api.heygen.com/v1/streaming.avatar.list', {
        method: 'GET',
        headers: {
          'X-Api-Key': this.apiKey,
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to list avatars: ${response.status}`);
      }

      const data = await response.json();
      return data.data?.avatars || [];
    } catch (error) {
      console.error('Failed to list streaming avatars:', error);
      return [];
    }
  }

  // Cleanup old sessions (call periodically)
  cleanupOldSessions() {
    const now = new Date();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    this.sessions.forEach((session, sessionId) => {
      const age = now.getTime() - session.createdAt.getTime();
      if (age > maxAge) {
        try {
          this.endSession(sessionId);
        } catch (error) {
          console.error(`Failed to cleanup session ${sessionId}:`, error);
        }
      }
    });
  }
}