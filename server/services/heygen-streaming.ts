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
  async createSession(userId: string, avatarId?: string) {
    try {
      // Create access token for streaming
      const token = await this.createAccessToken();
      
      // Start the avatar session via API
      const response = await fetch('https://api.heygen.com/v1/streaming.start', {
        method: 'POST',
        headers: {
          'X-Api-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          avatar_name: avatarId || 'default',
          quality: 'high',
          voice: {
            voice_id: '2d5b0e6cf36f460aa7fc47e3eee4ba54',
            rate: 1.1,
            emotion: 'FRIENDLY'
          },
          language: 'en',
          disable_idle_timeout: false
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.status}`);
      }

      const sessionData = await response.json();

      // Store session
      const session: StreamingSession = {
        sessionId: sessionData.data?.session_id || 'demo-session',
        userId,
        avatarName: avatarId || 'default',
        createdAt: new Date(),
        iceServers: sessionData.data?.ice_servers,
        offer: sessionData.data?.sdp?.sdp
      };
      this.sessions.set(session.sessionId, session);

      return {
        sessionId: session.sessionId,
        iceServers: session.iceServers,
        offer: session.offer,
        sessionData: sessionData.data
      };
    } catch (error) {
      console.error('Failed to create streaming session:', error);
      throw error;
    }
  }

  // Create access token for streaming
  private async createAccessToken(): Promise<string> {
    const response = await fetch('https://api.heygen.com/v1/streaming.create_token', {
      method: 'POST',
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      throw new Error(`Failed to create access token: ${response.status}`);
    }

    const data = await response.json();
    return data.data.token;
  }

  // Make avatar speak
  async speak(sessionId: string, text: string, taskType: 'TALK' | 'REPEAT' = 'TALK') {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const response = await fetch(`https://api.heygen.com/v1/streaming.speak`, {
      method: 'POST',
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        text,
        task_type: taskType
      })
    });

    if (!response.ok) {
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