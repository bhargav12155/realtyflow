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
    avatars: Array<{
      avatar_id: string;
      avatar_name: string;
      avatar_type: string; // 'instant_avatar', 'public', 'talking_photo'
      gender?: string;
      preview_image_url?: string;
      preview_video_url?: string;
    }>;
  };
  message?: string;
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
   * List All Video Avatars (Instant Avatars)
   *
   * Retrieve all avatars from your account and filter for instant avatars
   * Uses the /avatars endpoint which returns all avatar types
   *
   * @returns List of video avatars with their status
   */
  async listVideoAvatars(): Promise<VideoAvatarListResponse> {
    console.log("📋 Listing custom avatars from HeyGen avatar groups");

    // Use avatar_group.list to get ONLY user's custom avatar groups
    // This is the proper way to get custom avatars without the public library
    const customAvatars: any[] = [];
    
    try {
      const groupsResponse = await this.listAvatarGroups();
      
      // HeyGen API returns avatar_group_list (not avatar_groups)
      const groups = groupsResponse.data?.avatar_group_list || groupsResponse.data?.avatar_groups || [];
      
      if (Array.isArray(groups) && groups.length > 0) {
        console.log(`📋 Found ${groups.length} total avatar groups`);
        
        // Filter for PRIVATE groups only (user-created instant avatars from video)
        // group_type: "PRIVATE" = instant avatars (video-based, these are the custom ones!)
        // group_type: "PHOTO" = photo avatars (photo-based)
        const privateGroups = groups.filter((group: any) => 
          group.group_type === 'PRIVATE'
        );
        
        console.log(`📋 Found ${privateGroups.length} PRIVATE (instant avatar) groups`);
        
        // Add instant avatars from PRIVATE groups directly
        for (const group of privateGroups) {
          console.log(`📋 Adding instant avatar: ${group.name} (ID: ${group.id})`);
          customAvatars.push({
            avatar_id: group.id,
            avatar_name: group.name,
            avatar_type: 'instant_avatar',
            preview_image_url: group.preview_image,
            preview_video_url: null,
            created_at: group.created_at,
            default_voice_id: group.default_voice_id,
          });
        }
        
        // Also include user's PHOTO avatar groups that are trained (usable for video generation)
        const photoGroups = groups.filter((group: any) => 
          group.group_type === 'PHOTO' && group.train_status === 'ready'
        );
        
        console.log(`📋 Found ${photoGroups.length} trained PHOTO avatar groups`);
        
        for (const group of photoGroups) {
          console.log(`📋 Adding photo avatar group: ${group.name} (ID: ${group.id})`);
          customAvatars.push({
            avatar_id: group.id,
            avatar_name: group.name,
            avatar_type: 'photo_avatar',
            preview_image_url: group.preview_image,
            preview_video_url: null,
            created_at: group.created_at,
            default_voice_id: group.default_voice_id,
            train_status: group.train_status,
          });
        }
      } else {
        console.log("📋 No avatar groups found in response");
      }
    } catch (groupError) {
      console.error("📋 Could not fetch avatar groups:", groupError);
    }

    console.log(`📋 Total custom avatars for Video Avatar Manager: ${customAvatars.length}`);
    
    return {
      code: 100,
      data: {
        avatars: customAvatars.map((avatar: any) => ({
          avatar_id: avatar.avatar_id,
          avatar_name: avatar.avatar_name,
          avatar_type: avatar.avatar_type || 'instant_avatar',
          gender: avatar.gender,
          preview_image_url: avatar.preview_image_url,
          preview_video_url: avatar.preview_video_url,
          default_voice_id: avatar.default_voice_id,
        }))
      }
    };
  }

  /**
   * List All Avatar Groups
   * 
   * Retrieves all avatar groups from the account
   * Avatar groups contain custom avatars created by the user
   */
  async listAvatarGroups(): Promise<any> {
    console.log("📋 Listing avatar groups from HeyGen");
    
    try {
      const response = await this.makeRequest("/avatar_group.list");
      console.log("📋 Avatar groups response:", JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      console.error("❌ Failed to list avatar groups:", error);
      return { data: { avatar_groups: [] } };
    }
  }

  /**
   * List Avatars in a Group
   * 
   * Retrieves all avatars in a specific avatar group
   */
  async listAvatarsInGroup(groupId: string): Promise<any> {
    console.log(`📋 Listing avatars in group: ${groupId}`);
    
    try {
      const response = await this.makeRequest(`/avatar_group/${groupId}/avatars`);
      console.log(`📋 Avatars in group ${groupId}:`, JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      console.error(`❌ Failed to list avatars in group ${groupId}:`, error);
      return { data: { avatars: [] } };
    }
  }

  /**
   * Delete Avatar Group
   *
   * Permanently remove an avatar group (works for both photo and instant avatars)
   *
   * @param groupId The avatar group ID to delete
   * @returns Success confirmation
   */
  async deleteAvatarGroup(groupId: string): Promise<{ success: boolean }> {
    console.log("🗑️ Deleting avatar group:", groupId);

    try {
      const response = await this.makeRequest(
        `/avatar_group/${groupId}`,
        "DELETE"
      );

      console.log("✅ Avatar group deleted:", groupId);
      return {
        success: response.code === 100 || response.error === null,
      };
    } catch (error: any) {
      console.error("❌ Failed to delete avatar group:", error.message);
      throw error;
    }
  }

  /**
   * Delete Video Avatar (legacy - for instant avatars only)
   *
   * Permanently remove a video avatar
   *
   * @param avatarId The avatar ID to delete
   * @returns Success confirmation
   */
  async deleteVideoAvatar(avatarId: string): Promise<{ success: boolean }> {
    console.log("🗑️ Deleting video avatar:", avatarId);

    // First try to delete as avatar group (works for both types)
    try {
      return await this.deleteAvatarGroup(avatarId);
    } catch (groupError: any) {
      console.log("⚠️ Avatar group delete failed, trying video_avatar endpoint...");
      
      // Fall back to video_avatar endpoint for legacy instant avatars
      try {
        const response = await this.makeRequest(
          `/video_avatar/${avatarId}`,
          "DELETE"
        );
        return {
          success: response.code === 100,
        };
      } catch (videoError: any) {
        console.error("❌ Both delete methods failed");
        throw new Error(`Failed to delete avatar: ${groupError.message}`);
      }
    }
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
