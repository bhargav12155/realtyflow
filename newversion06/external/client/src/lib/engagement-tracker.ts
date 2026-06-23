// Engagement Tracking Library for Nebraska Home Hub
// Tracks user behavior, generates leads automatically

interface EngagementTracker {
  sessionId: string;
  agentSlug: string;
  startTime: number;
  lastHeartbeatTime: number;
  propertyViews: Map<string, number>;
  interactions: Array<{ type: string; timestamp: number; propertyId?: string }>;
  isTracking: boolean;
}

class PropertyEngagementService {
  private tracker: EngagementTracker | null = null;
  private pageStartTime: number = Date.now();
  private currentPropertyId: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string = "") {
    this.apiBaseUrl = apiBaseUrl;
  }

  public initialize(options: { page: string; agentSlug: string }): void {
    const { page, agentSlug } = options;
    
    if (typeof window === "undefined") return;

    // Get or create session ID
    let sessionId = sessionStorage.getItem("engagement-session-id");
    if (!sessionId) {
      sessionId = this.generateSessionId();
      sessionStorage.setItem("engagement-session-id", sessionId);
    }

    this.tracker = {
      sessionId,
      agentSlug,
      startTime: Date.now(),
      lastHeartbeatTime: Date.now(),
      propertyViews: new Map(),
      interactions: [],
      isTracking: true,
    };

    // Initialize session with backend
    this.trackSession(page);

    // Start heartbeat
    this.startHeartbeat();

    // Setup cleanup listeners
    this.setupPageVisibilityTracking();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async trackSession(page: string): Promise<void> {
    if (!this.tracker) return;

    try {
      await fetch(`${this.apiBaseUrl}/api/track/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.tracker.sessionId,
          agentSlug: this.tracker.agentSlug,
          pageVisited: page,
          deviceType: this.getDeviceType(),
        }),
      });
    } catch (error) {
      console.warn("Failed to track session:", error);
    }
  }

  private getDeviceType(): string {
    if (typeof window === "undefined") return "desktop";
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return "tablet";
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return "mobile";
    }
    return "desktop";
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.tracker?.isTracking) {
        this.updateSessionTime();
      }
    }, 30000); // Every 30 seconds
  }

  private async updateSessionTime(): Promise<void> {
    if (!this.tracker) return;

    const now = Date.now();
    const timeDelta = Math.floor((now - this.tracker.lastHeartbeatTime) / 1000);
    
    // Update last heartbeat time
    this.tracker.lastHeartbeatTime = now;

    try {
      await fetch(`${this.apiBaseUrl}/api/track/property-interaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.tracker.sessionId,
          agentSlug: this.tracker.agentSlug,
          interactionType: "session_heartbeat",
          timeSpentSeconds: timeDelta,
          currentUrl: window.location.pathname,
        }),
      });
    } catch (error) {
      console.warn("Failed to update session time:", error);
    }
  }

  private setupPageVisibilityTracking(): void {
    if (typeof window === "undefined") return;

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.pauseTracking();
      } else {
        this.resumeTracking();
      }
    });

    window.addEventListener("beforeunload", () => {
      this.endPropertyView();
    });
  }

  private pauseTracking(): void {
    if (this.tracker) {
      this.tracker.isTracking = false;
    }
    this.endPropertyView();
  }

  private resumeTracking(): void {
    if (this.tracker) {
      this.tracker.isTracking = true;
      this.tracker.lastHeartbeatTime = Date.now();
    }
  }

  public async trackPropertyView(propertyId: string): Promise<void> {
    if (!this.tracker) return;

    // End previous property view
    this.endPropertyView();

    // Start new property view
    this.currentPropertyId = propertyId;
    this.pageStartTime = Date.now();

    // Track the view
    const viewCount = (this.tracker.propertyViews.get(propertyId) || 0) + 1;
    this.tracker.propertyViews.set(propertyId, viewCount);

    this.tracker.interactions.push({
      type: "view",
      timestamp: Date.now(),
      propertyId,
    });

    try {
      await fetch(`${this.apiBaseUrl}/api/track/property-interaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.tracker.sessionId,
          agentSlug: this.tracker.agentSlug,
          propertyId,
          interactionType: "view",
          currentUrl: window.location.pathname,
        }),
      });
    } catch (error) {
      console.warn("Failed to track property view:", error);
    }
  }

  private endPropertyView(): void {
    if (!this.currentPropertyId || !this.tracker) return;

    const timeSpent = Math.floor((Date.now() - this.pageStartTime) / 1000);

    if (timeSpent > 2) {
      fetch(`${this.apiBaseUrl}/api/track/property-interaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.tracker.sessionId,
          agentSlug: this.tracker.agentSlug,
          propertyId: this.currentPropertyId,
          interactionType: "view_end",
          timeSpentSeconds: timeSpent,
          currentUrl: window.location.pathname,
        }),
      }).catch(() => {});
    }

    this.currentPropertyId = null;
  }

  public async trackPropertyLike(propertyId: string, liked: boolean): Promise<void> {
    if (!this.tracker) return;

    this.tracker.interactions.push({
      type: liked ? "like" : "unlike",
      timestamp: Date.now(),
      propertyId,
    });

    try {
      await fetch(`${this.apiBaseUrl}/api/track/property-like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.tracker.sessionId,
          agentSlug: this.tracker.agentSlug,
          propertyId,
          liked,
        }),
      });
    } catch (error) {
      console.warn("Failed to track property like:", error);
    }

    // Check if engagement threshold met
    this.checkEngagementLevel();
  }

  public async trackInteraction(
    type: string,
    propertyId?: string,
    value?: string,
    timeSpentSeconds?: number
  ): Promise<void> {
    if (!this.tracker) return;

    this.tracker.interactions.push({
      type,
      timestamp: Date.now(),
      propertyId,
    });

    try {
      await fetch(`${this.apiBaseUrl}/api/track/property-interaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.tracker.sessionId,
          agentSlug: this.tracker.agentSlug,
          propertyId: propertyId || null,
          interactionType: type,
          interactionValue: value || null,
          timeSpentSeconds: timeSpentSeconds || 0,
          currentUrl: window.location.pathname,
        }),
      });
    } catch (error) {
      console.warn("Failed to track interaction:", error);
    }
  }

  public async checkEngagementLevel(): Promise<{
    score: number;
    shouldGenerateLead: boolean;
    reason?: string;
  }> {
    if (!this.tracker) {
      return { score: 0, shouldGenerateLead: false };
    }

    let score = 0;
    let reason = "";

    const sessionTime = Math.floor((Date.now() - this.tracker.startTime) / 1000);
    const likeCount = this.tracker.interactions.filter((i) => i.type === "like").length;
    const viewCount = this.tracker.propertyViews.size;
    const interactionCount = this.tracker.interactions.length;

    // Scoring algorithm
    if (sessionTime > 300) score += 20; // > 5 minutes
    if (viewCount > 3) score += 15; // Viewed multiple properties
    if (likeCount > 0) score += likeCount * 10; // Liked properties
    if (interactionCount > 5) score += 10; // High interaction
    if (sessionTime > 600) score += 15; // > 10 minutes

    // Determine reason
    if (likeCount >= 2) {
      reason = "liked_multiple_properties";
    } else if (sessionTime > 600) {
      reason = "spent_long_time_on_site";
    } else if (viewCount > 5) {
      reason = "viewed_many_properties";
    } else if (interactionCount > 8) {
      reason = "high_interaction_activity";
    }

    const shouldGenerateLead = score >= 25 && reason.length > 0;

    if (shouldGenerateLead) {
      await this.generateEngagementLead();
    }

    return { score, shouldGenerateLead, reason };
  }

  private async generateEngagementLead(): Promise<boolean> {
    if (!this.tracker) return false;

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/track/generate-engagement-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.tracker.sessionId,
          agentSlug: this.tracker.agentSlug,
        }),
      });

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.warn("Failed to generate engagement lead:", error);
      return false;
    }
  }

  public getEngagementSummary() {
    if (!this.tracker) return null;

    return {
      sessionId: this.tracker.sessionId,
      sessionDuration: Math.floor((Date.now() - this.tracker.startTime) / 1000),
      propertiesViewed: this.tracker.propertyViews.size,
      interactions: this.tracker.interactions.length,
    };
  }

  public destroy(): void {
    this.endPropertyView();
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.tracker = null;
  }
}

// Singleton instance
let globalTracker: PropertyEngagementService | null = null;

export function initializeEngagementTracking(
  apiBaseUrl?: string
): PropertyEngagementService;
export function initializeEngagementTracking(options: {
  page: string;
  agentSlug: string;
  apiBaseUrl?: string;
}): PropertyEngagementService;
export function initializeEngagementTracking(
  optionsOrUrl?: string | { page: string; agentSlug: string; apiBaseUrl?: string }
): PropertyEngagementService {
  if (typeof window === "undefined") {
    return new PropertyEngagementService("");
  }

  if (!globalTracker) {
    const baseUrl = typeof optionsOrUrl === "string" ? optionsOrUrl : (optionsOrUrl?.apiBaseUrl || "");
    globalTracker = new PropertyEngagementService(baseUrl);
  }

  if (typeof optionsOrUrl === "object") {
    globalTracker.initialize({
      page: optionsOrUrl.page,
      agentSlug: optionsOrUrl.agentSlug,
    });
  }

  return globalTracker;
}

export function getEngagementTracker(): PropertyEngagementService | null {
  return globalTracker;
}

export function trackPropertyView(propertyId: string): void {
  globalTracker?.trackPropertyView(propertyId);
}

export function trackPropertyLike(propertyId: string, liked: boolean): void {
  globalTracker?.trackPropertyLike(propertyId, liked);
}

export function trackPropertyInteraction(
  type: string,
  propertyId?: string,
  value?: string,
  timeSpentSeconds?: number
): void {
  globalTracker?.trackInteraction(type, propertyId, value, timeSpentSeconds);
}
