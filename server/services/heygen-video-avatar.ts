/**
 * HeyGen Video Avatar API Service
 * Enterprise-only feature for creating high-fidelity avatars from training footage
 *
 * Workflow:
 * 1. Upload training footage (2+ min, 720p+) and consent statement to public URL
 * 2. Submit video avatar creation request
 * 3. Monitor status until complete
 * 4. Use avatar_id in video generation
 *
 * @see https://docs.heygen.com/docs/video-avatars-api
 */

interface VideoAvatarCreationRequest {
  avatar_name: string;
  training_footage_url: string;
  video_consent_url: string;
  avatar_group_id?: string; // Optional: ID of existing avatar group
  callback_id?: string; // Optional: Custom ID for callback tracking
  callback_url?: string; // Optional: URL to notify when complete
}

interface VideoAvatarCreationResponse {
  code: number;
  data: {
    avatar_id: string;
    avatar_name: string;
    status: "in_progress" | "complete" | "failed";
    created_at: string;
  };
  message?: string;
}

interface VideoAvatarStatusResponse {
  code: number;
  data: {
    avatar_id: string;
    avatar_name: string;
    status: "in_progress" | "complete" | "failed";
    progress?: number; // Percentage 0-100
    error_message?: string;
    thumbnail_url?: string;
    preview_video_url?: string;
    created_at: string;
    updated_at: string;
  };
  message?: string;
}

interface VideoAvatarListResponse {
  code: number;
  data: {
    video_avatars: Array<{
      avatar_id: string;
      avatar_name: string;
      status: string;
      thumbnail_url?: string;
      created_at: string;
    }>;
    total: number;
  };
}

export class HeyGenVideoAvatarService {
  private apiKey: string;
  private baseUrl = "https://api.heygen.com/v2";

  constructor() {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      throw new Error("HEYGEN_API_KEY is not set in environment variables");
    }
    this.apiKey = apiKey;
  }

  private async makeRequest(
    endpoint: string,
    method: "GET" | "POST" | "DELETE" = "GET",
    body?: any
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;

    console.log(`🎬 HeyGen Video Avatar API: ${method} ${url}`);
    if (body) {
      console.log("📦 Request body:", JSON.stringify(body, null, 2));
    }

    const response = await fetch(url, {
      method,
      headers: {
        "X-Api-Key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    console.log(
      `📡 Response status: ${response.status} ${response.statusText}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ HeyGen Video Avatar API error:`, errorText);

      // Special handling for 403 errors (Enterprise feature)
      if (response.status === 403) {
        throw new Error(
          `Video Avatar API is an Enterprise-only feature. Your HeyGen account may not have access. ` +
            `Please contact HeyGen support to enable Enterprise API features. Error: ${errorText}`
        );
      }

      try {
        const errorJson = JSON.parse(errorText);
        const errorMessage = errorJson.message || errorJson.error || errorText;
        throw new Error(
          `HeyGen Video Avatar API error (${response.status}): ${errorMessage}`
        );
      } catch {
        throw new Error(
          `HeyGen Video Avatar API error: ${response.status} - ${errorText}`
        );
      }
    }

    const result = await response.json();
    console.log("✅ Response:", JSON.stringify(result, null, 2));
    return result;
  }

  /**
   * Submit Video Avatar Creation Request
   *
   * Creates a high-fidelity avatar from training footage
   *
   * Requirements:
   * - Training footage: MP4, 2+ minutes, 720p or higher
   * - Consent statement: MP4 with explicit permission
   * - Both files must be publicly accessible URLs
   *
   * @param request Avatar creation parameters
   * @returns Avatar ID and initial status
   */
  async createVideoAvatar(
    request: VideoAvatarCreationRequest
  ): Promise<VideoAvatarCreationResponse> {
    console.log("🎬 Creating video avatar:", request.avatar_name);

    // Validate URLs
    if (!request.training_footage_url.startsWith("http")) {
      throw new Error("Training footage URL must be a valid HTTP/HTTPS URL");
    }
    if (!request.video_consent_url.startsWith("http")) {
      throw new Error("Consent video URL must be a valid HTTP/HTTPS URL");
    }

    // Properly encode URLs to handle special characters
    const encodedTrainingUrl = encodeURI(request.training_footage_url);
    const encodedConsentUrl = encodeURI(request.video_consent_url);

    const payload: any = {
      avatar_name: request.avatar_name,
      training_footage_url: encodedTrainingUrl,
      video_consent_url: encodedConsentUrl,
    };

    // Add optional fields if provided
    if (request.avatar_group_id)
      payload.avatar_group_id = request.avatar_group_id;
    if (request.callback_id) payload.callback_id = request.callback_id;
    if (request.callback_url) payload.callback_url = request.callback_url;

    const response = await this.makeRequest("/video_avatar", "POST", payload);

    return response;
  }

  /**
   * Check Video Avatar Generation Status
   *
   * Monitor the progress of avatar creation
   *
   * Status values:
   * - in_progress: Avatar is being processed
   * - complete: Avatar ready to use
   * - failed: Processing failed (check error_message)
   *
   * @param avatarId The avatar ID from creation request
   * @returns Current status and details
   */
  async checkVideoAvatarStatus(
    avatarId: string
  ): Promise<VideoAvatarStatusResponse> {
    console.log("📊 Checking video avatar status:", avatarId);

    const response = await this.makeRequest(`/video_avatar/${avatarId}/status`);

    return response;
  }

  /**
   * List All Video Avatars
   *
   * Retrieve all video avatars created in your account
   *
   * @returns List of video avatars with their status
   */
  async listVideoAvatars(): Promise<VideoAvatarListResponse> {
    console.log("📋 Listing all video avatars");

    const response = await this.makeRequest("/video_avatar/list");

    return response;
  }

  /**
   * Delete Video Avatar
   *
   * Permanently remove a video avatar
   *
   * @param avatarId The avatar ID to delete
   * @returns Success confirmation
   */
  async deleteVideoAvatar(avatarId: string): Promise<{ success: boolean }> {
    console.log("🗑️ Deleting video avatar:", avatarId);

    const response = await this.makeRequest(
      `/video_avatar/${avatarId}`,
      "DELETE"
    );

    return {
      success: response.code === 100,
    };
  }

  /**
   * Poll Video Avatar Status Until Complete
   *
   * Utility method to wait for avatar creation to finish
   *
   * @param avatarId Avatar ID to monitor
   * @param maxAttempts Maximum polling attempts (default: 60)
   * @param intervalMs Polling interval in milliseconds (default: 10000 = 10s)
   * @returns Final status when complete or failed
   */
  async waitForAvatarCompletion(
    avatarId: string,
    maxAttempts: number = 60, // 10 minutes max
    intervalMs: number = 10000
  ): Promise<VideoAvatarStatusResponse> {
    console.log(
      `⏳ Waiting for avatar ${avatarId} to complete (max ${maxAttempts} attempts)`
    );

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const status = await this.checkVideoAvatarStatus(avatarId);

      console.log(
        `Attempt ${attempt}/${maxAttempts}: Status = ${status.data.status}${
          status.data.progress ? ` (${status.data.progress}%)` : ""
        }`
      );

      if (status.data.status === "complete") {
        console.log("✅ Avatar creation completed!");
        return status;
      }

      if (status.data.status === "failed") {
        console.error("❌ Avatar creation failed:", status.data.error_message);
        throw new Error(`Avatar creation failed: ${status.data.error_message}`);
      }

      // Wait before next check
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    throw new Error(`Avatar creation timeout after ${maxAttempts} attempts`);
  }

  /**
   * Validate Training Footage Requirements
   *
   * Helper to check if video meets minimum requirements
   * Note: This only checks basic requirements, not actual content quality
   *
   * @param videoUrl URL to the training footage
   * @returns Validation result
   */
  async validateTrainingFootage(videoUrl: string): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check URL format
    if (!videoUrl.startsWith("http")) {
      issues.push("URL must be a valid HTTP/HTTPS URL");
    }

    // Check file extension
    if (!videoUrl.toLowerCase().endsWith(".mp4")) {
      issues.push("Training footage must be MP4 format");
    }

    // Note: Actual duration and resolution checks require downloading the video
    // which should be done client-side before upload

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}

export default HeyGenVideoAvatarService;
