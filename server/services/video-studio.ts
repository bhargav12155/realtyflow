/**
 * Unified Video Studio Service
 * 
 * Consolidates all HeyGen video generation flows into one simple interface:
 * 1. UPLOAD - Create avatar from image or select existing
 * 2. ASK - Provide script or generate from topic
 * 3. GET IT - Generate and retrieve video
 * 
 * This replaces the fragmented heygen.ts, heygen-photo-avatar.ts, heygen-template.ts, etc.
 */

import { HeyGenService } from "./heygen";
import { HeyGenPhotoAvatarService } from "./heygen-photo-avatar";
import { HeyGenAvatarIVService } from "./heygen-avatar-iv";

export interface StudioAvatar {
  id: string;
  name: string;
  type: "preset" | "photo" | "custom";
  previewUrl?: string;
  thumbnailUrl?: string;
  groupId?: string; // For avatars that belong to a group
  avatarType?: "avatar" | "talking_photo"; // HeyGen character type for video generation
  defaultVoiceId?: string; // Default voice for this avatar (from group or avatar)
  isMotion?: boolean; // Whether this avatar has motion/video preview
  motionPreviewUrl?: string; // URL to the motion preview video
  imageKey?: string; // For Avatar IV API - the image_key from upload
}

export interface VideoGenerationRequest {
  avatarId: string;
  avatarType?: "avatar" | "talking_photo";
  imageKey?: string; // For Avatar IV API
  script: string;
  title?: string;
  voiceId?: string;
  voiceMode?: "tts" | "record" | "upload";
  audioUrl?: string; // For recorded/uploaded audio
  aspectRatio?: "16:9" | "9:16" | "1:1";
  quality?: "1080p" | "720p" | "480p";
  gestureIntensity?: number;
}

export interface VideoStatus {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

export interface QuickVideoRequest {
  imageUrl?: string;
  avatarId?: string;
  topic?: string;
  script?: string;
  title?: string;
  voiceId?: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
}

export class VideoStudioService {
  private heygenService: HeyGenService;
  private photoAvatarService: HeyGenPhotoAvatarService;
  private avatarIVService: HeyGenAvatarIVService;
  private apiKey: string;
  private baseUrl = "https://api.heygen.com";

  constructor() {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      throw new Error("HEYGEN_API_KEY is not set");
    }
    this.apiKey = apiKey;
    this.heygenService = new HeyGenService();
    this.photoAvatarService = new HeyGenPhotoAvatarService();
    this.avatarIVService = new HeyGenAvatarIVService();
  }

  /**
   * STEP 1: UPLOAD
   * Create avatar from uploaded image using Avatar IV API
   * Uses the newer /v2/video/av4 endpoint for better quality
   */
  async createAvatarFromImage(
    imageUrl: string,
    name: string
  ): Promise<StudioAvatar> {
    console.log("🎭 Video Studio: Creating avatar using Avatar IV API...");

    // First, download the image from the URL
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }
    
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    const imageBuffer = await imageResponse.arrayBuffer();
    
    console.log(`🎭 Video Studio: Downloaded image, size: ${imageBuffer.byteLength} bytes, type: ${contentType}`);
    
    // Use Avatar IV API to upload and get image_key
    const uploadResult = await this.avatarIVService.uploadPhoto(
      Buffer.from(imageBuffer),
      contentType
    );

    // HeyGen returns image_key in snake_case
    const imageKey = uploadResult.image_key;
    if (!imageKey) {
      console.error("🎭 Video Studio: Upload result:", JSON.stringify(uploadResult, null, 2));
      throw new Error("Failed to upload image - no image_key returned");
    }

    console.log(`🎭 Video Studio: Avatar IV image uploaded with key: ${imageKey}`);

    return {
      id: imageKey, // Use imageKey as the ID for Avatar IV
      name: name,
      type: "photo",
      previewUrl: uploadResult.url || imageUrl,
      imageKey: imageKey,
    };
  }

  /**
   * STEP 1 (Alternative): Create avatar directly from image buffer
   * Uses Avatar IV API for direct buffer upload
   */
  async createAvatarFromBuffer(
    imageBuffer: Buffer,
    name: string,
    contentType: string = "image/jpeg"
  ): Promise<StudioAvatar> {
    console.log("🎭 Video Studio: Creating avatar from buffer using Avatar IV API...");
    
    const uploadResult = await this.avatarIVService.uploadPhoto(imageBuffer, contentType);

    // HeyGen returns image_key in snake_case
    const imageKey = uploadResult.image_key;
    if (!imageKey) {
      console.error("🎭 Video Studio: Upload result:", JSON.stringify(uploadResult, null, 2));
      throw new Error("Failed to upload image - no image_key returned");
    }

    console.log(`🎭 Video Studio: Avatar IV image uploaded with key: ${imageKey}`);

    return {
      id: imageKey,
      name: name,
      type: "photo",
      previewUrl: uploadResult.url,
      imageKey: imageKey,
    };
  }

  /**
   * Upload an image file and get a HeyGen-compatible URL
   */
  async uploadImage(imageBlob: Blob): Promise<string> {
    return this.heygenService.uploadImage(imageBlob);
  }

  /**
   * Fetch all avatars from HeyGen and find ones matching a group ID
   * Instant avatars appear in the main /v2/avatars list
   */
  private async fetchAvatarIdForGroup(groupId: string, groupName: string): Promise<string | null> {
    try {
      // Instant avatars appear in /v2/avatars with avatar_id matching or containing group info
      const response = await fetch(`${this.baseUrl}/v2/avatars`, {
        method: "GET",
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.warn(`🎭 Video Studio: Failed to fetch avatars list:`, response.status);
        return null;
      }

      const data = await response.json();
      const allAvatars = data.data?.avatars || [];
      
      // Look for avatar that matches the group ID or name
      // Instant avatars often have avatar_id that relates to the group
      const matchingAvatar = allAvatars.find((avatar: any) => 
        avatar.avatar_id === groupId ||
        avatar.avatar_group_id === groupId ||
        avatar.group_id === groupId ||
        (avatar.avatar_name && avatar.avatar_name.toLowerCase() === groupName.toLowerCase())
      );

      if (matchingAvatar) {
        console.log(`🎭 Video Studio: Found matching avatar: ${matchingAvatar.avatar_id} for group ${groupName}`);
        return matchingAvatar.avatar_id;
      }

      return null;
    } catch (error) {
      console.warn(`🎭 Video Studio: Error finding avatar for group ${groupId}:`, error);
      return null;
    }
  }

  /**
   * List only custom avatars (user-created, not HeyGen's stock library)
   * Filters for PRIVATE groups (instant avatars) and trained PHOTO groups
   * IMPORTANT: Returns actual avatar IDs that can be used for video generation
   */
  async listAvatars(): Promise<StudioAvatar[]> {
    console.log("🎭 Video Studio: Fetching custom avatars only...");

    const avatars: StudioAvatar[] = [];

    try {
      // First, get all avatar groups to identify user's custom avatars
      const groupsResponse = await fetch(`${this.baseUrl}/v2/avatar_group.list`, {
        method: "GET",
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
      });

      if (!groupsResponse.ok) {
        console.error("🎭 Video Studio: Failed to fetch avatar groups:", groupsResponse.status);
        return avatars;
      }

      const groupsData = await groupsResponse.json();
      const groups = groupsData.data?.avatar_group_list || groupsData.data?.avatar_groups || [];

      console.log(`🎭 Video Studio: Found ${groups.length} total avatar groups`);

      // Get the full avatars list to find actual avatar IDs
      const avatarsResponse = await fetch(`${this.baseUrl}/v2/avatars`, {
        method: "GET",
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
      });

      let allAvatars: any[] = [];
      if (avatarsResponse.ok) {
        const avatarsData = await avatarsResponse.json();
        allAvatars = avatarsData.data?.avatars || [];
        console.log(`🎭 Video Studio: Found ${allAvatars.length} total avatars in HeyGen account`);
        
        // Log first few avatars to understand the structure
        const sampleAvatars = allAvatars.slice(0, 5);
        for (const avatar of sampleAvatars) {
          console.log(`🎭 Sample avatar: id=${avatar.avatar_id}, name=${avatar.avatar_name}, type=${avatar.avatar_type}, group_id=${avatar.avatar_group_id || avatar.group_id || 'none'}`);
        }
      }

      // Filter for PRIVATE groups (instant avatars from video training)
      const privateGroups = groups.filter((group: any) => group.group_type === "PRIVATE");
      console.log(`🎭 Video Studio: Found ${privateGroups.length} PRIVATE (instant avatar) groups`);

      // For PRIVATE groups, find the matching avatar in the avatars list
      // According to HeyGen docs, instant avatars are found by NAME in the avatars list
      for (const group of privateGroups) {
        // Try multiple matching strategies
        const matchingAvatar = allAvatars.find((avatar: any) => {
          // Match by group ID
          if (avatar.avatar_group_id === group.id || avatar.group_id === group.id) return true;
          // Match by avatar_id containing group ID
          if (avatar.avatar_id?.includes(group.id)) return true;
          // Match by name (case-insensitive)
          if (avatar.avatar_name?.toLowerCase() === group.name?.toLowerCase()) return true;
          // Match by avatar_type being instant_avatar with similar name
          if (avatar.avatar_type === 'instant_avatar' && avatar.avatar_name?.includes(group.name?.split(' ')[0])) return true;
          return false;
        });

        if (matchingAvatar) {
          console.log(`🎭 Video Studio: Found matching avatar for "${group.name}": id=${matchingAvatar.avatar_id}, type=${matchingAvatar.avatar_type}`);
          avatars.push({
            id: matchingAvatar.avatar_id,
            name: group.name || matchingAvatar.avatar_name || "Custom Avatar",
            type: "custom",
            thumbnailUrl: matchingAvatar.preview_image_url || group.preview_image,
            previewUrl: matchingAvatar.preview_video_url || group.preview_video,
            groupId: group.id,
            avatarType: "avatar",
            defaultVoiceId: group.default_voice_id, // Include the default voice for this avatar
          });
        } else {
          // Log all instant_avatar type avatars for debugging
          const instantAvatars = allAvatars.filter((a: any) => a.avatar_type === 'instant_avatar');
          console.log(`🎭 Video Studio: No match found for "${group.name}". Instant avatars available: ${instantAvatars.map((a: any) => `${a.avatar_name}(${a.avatar_id})`).join(', ') || 'none'}`);
          
          // Still add the group, using group ID as fallback
          console.log(`🎭 Video Studio: Using group ID ${group.id} as avatar ID for ${group.name}`);
          avatars.push({
            id: group.id,
            name: group.name || "Custom Avatar",
            type: "custom",
            thumbnailUrl: group.preview_image,
            previewUrl: group.preview_video,
            groupId: group.id,
            avatarType: "avatar",
            defaultVoiceId: group.default_voice_id,
          });
        }
      }

      // Filter for ALL PHOTO groups (include both trained and empty - they can still be used for video generation)
      // Also include GENERATED_PHOTO groups (AI-generated photo avatars)
      const photoGroups = groups.filter(
        (group: any) => group.group_type === "PHOTO" || group.group_type === "GENERATED_PHOTO"
      );
      console.log(`🎭 Video Studio: Found ${photoGroups.length} PHOTO/GENERATED_PHOTO avatar groups`);

      // For PHOTO groups, fetch looks to get motion preview data
      for (const group of photoGroups) {
        let motionLook: any = null;
        let firstLook: any = null;
        
        // Try to fetch looks for this group to find motion previews
        try {
          const looksResponse = await fetch(`${this.baseUrl}/v2/avatar_group/${group.id}/avatars`, {
            method: "GET",
            headers: {
              "x-api-key": this.apiKey,
              "Content-Type": "application/json",
            },
          });
          
          if (looksResponse.ok) {
            const looksData = await looksResponse.json();
            const looks = looksData.data?.avatar_list || [];
            
            // Find first motion look and first look overall
            firstLook = looks[0];
            motionLook = looks.find((look: any) => look.is_motion && look.motion_preview_url);
          }
        } catch (lookError) {
          console.warn(`🎭 Video Studio: Could not fetch looks for group ${group.id}`);
        }

        const matchingAvatar = allAvatars.find((avatar: any) => 
          avatar.avatar_group_id === group.id ||
          avatar.group_id === group.id
        );

        if (matchingAvatar) {
          avatars.push({
            id: matchingAvatar.avatar_id,
            name: group.name || matchingAvatar.avatar_name || "Photo Avatar",
            type: "photo",
            thumbnailUrl: matchingAvatar.preview_image_url || group.preview_image,
            previewUrl: matchingAvatar.preview_video_url || group.preview_video,
            groupId: group.id,
            avatarType: "avatar",
            isMotion: !!motionLook,
            motionPreviewUrl: motionLook?.motion_preview_url,
          });
        } else {
          // For trained photo avatars, use the group ID
          avatars.push({
            id: group.id,
            name: group.name || "Photo Avatar",
            type: "photo",
            thumbnailUrl: firstLook?.image_url || group.preview_image,
            previewUrl: group.preview_video,
            groupId: group.id,
            avatarType: "talking_photo", // Photo avatars use talking_photo type
            isMotion: !!motionLook,
            motionPreviewUrl: motionLook?.motion_preview_url,
          });
        }
      }

      // Also fetch user's talking photos (simple photo uploads)
      try {
        const talkingPhotosResponse = await fetch(`${this.baseUrl}/v1/talking_photo.list`, {
          method: "GET",
          headers: {
            "x-api-key": this.apiKey,
            "Content-Type": "application/json",
          },
        });

        if (talkingPhotosResponse.ok) {
          const talkingPhotosData = await talkingPhotosResponse.json();
          const talkingPhotos = talkingPhotosData.data?.talking_photos || [];
          console.log(`🎭 Video Studio: Found ${talkingPhotos.length} talking photos`);

          for (const photo of talkingPhotos) {
            avatars.push({
              id: photo.talking_photo_id,
              name: photo.talking_photo_name || "Talking Photo",
              type: "photo",
              thumbnailUrl: photo.preview_image_url || photo.image_url,
              previewUrl: photo.preview_video_url,
              avatarType: "talking_photo",
            });
          }
        }
      } catch (talkingPhotoError) {
        console.warn("🎭 Video Studio: Could not fetch talking photos:", talkingPhotoError);
      }

      console.log(`🎭 Video Studio: Returning ${avatars.length} custom avatars total`);

    } catch (error) {
      console.error("🎭 Video Studio: Error fetching custom avatars:", error);
    }

    return avatars;
  }

  /**
   * List available voices
   */
  async listVoices(): Promise<any[]> {
    console.log("🎤 Video Studio: Fetching available voices...");
    const response = await this.heygenService.listVoices();
    return response.data?.voices || [];
  }

  /**
   * STEP 2: ASK
   * Generate a script from a topic (uses OpenAI)
   */
  async generateScript(
    topic: string,
    type: "marketing" | "educational" | "social" = "marketing",
    duration: number = 60
  ): Promise<string> {
    console.log("📝 Video Studio: Generating script for topic:", topic);

    const prompt = this.buildScriptPrompt(topic, type, duration);

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      const result = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: "You are a professional video script writer. Write concise, engaging scripts for AI avatar videos. Keep scripts under 1500 characters for optimal video generation.",
          maxOutputTokens: 500,
        },
      });

      return result.text || this.getFallbackScript(topic);
    } catch (error) {
      console.error("Script generation failed, using fallback:", error);
      return this.getFallbackScript(topic);
    }
  }

  private buildScriptPrompt(
    topic: string,
    type: string,
    duration: number
  ): string {
    const wordCount = Math.round(duration * 2.5); // ~150 words per minute

    return `Write a ${type} video script about: "${topic}"

Requirements:
- Duration: approximately ${duration} seconds (~${wordCount} words)
- Start with a hook that grabs attention
- Keep it conversational and natural
- End with a clear call-to-action
- Maximum 1500 characters

Write only the script text, no stage directions or notes.`;
  }

  private getFallbackScript(topic: string): string {
    return `Hey there! I'm excited to talk to you about ${topic}. 

This is a topic that can really make a difference in your life. Whether you're just getting started or looking to level up, there's something here for everyone.

Let me break it down for you in a way that's easy to understand and actionable.

The key is to stay curious, keep learning, and take action on what you discover.

Thanks for watching! If you found this helpful, don't forget to like and subscribe for more content like this.`;
  }

  /**
   * STEP 3: GET IT
   * Generate a video with the given parameters
   * Uses Avatar IV API for new uploads with imageKey, falls back to classic API for legacy avatars
   */
  async generateVideo(request: VideoGenerationRequest): Promise<VideoStatus> {
    console.log("🎬 Video Studio: Starting video generation...");
    console.log("📋 Request:", JSON.stringify(request, null, 2));

    // Determine if using custom audio (record/upload) or TTS
    const useCustomAudio = request.voiceMode && request.voiceMode !== "tts" && request.audioUrl;

    // Check if this is an Avatar IV imageKey (format: "image/xxx/original.jpg")
    const isAvatarIVKey = request.imageKey && request.imageKey.startsWith("image/");

    if (isAvatarIVKey) {
      // Use Avatar IV API for new uploads with valid imageKey
      console.log("🎬 Using Avatar IV API with imageKey:", request.imageKey);
      const result = await this.avatarIVService.generateVideo({
        imageKey: request.imageKey!,
        videoTitle: request.title || "Video " + Date.now(),
        script: request.script,
        voiceId: request.voiceId || "119caed25533477ba63822d5d1552d25", // Default voice if not specified
        videoOrientation: request.aspectRatio === "9:16" ? "portrait" : "landscape",
        fit: "contain",
      });

      if (!result.video_id) {
        throw new Error("Video generation failed - no video ID returned");
      }

      console.log("✅ Video generation started with Avatar IV:", result.video_id);

      return {
        id: result.video_id,
        status: "processing",
        progress: 0,
      };
    } else {
      // Fall back to classic HeyGenService for legacy avatars (talking_photo_id format)
      console.log("🎬 Using classic HeyGen API with avatarId:", request.avatarId);
      const response = await this.heygenService.generateVideo({
        avatarId: request.avatarId,
        script: request.script,
        title: request.title || "Video Studio Generation",
        voiceId: useCustomAudio ? undefined : request.voiceId,
        audioUrl: useCustomAudio ? request.audioUrl : undefined,
        aspectRatio: request.aspectRatio || "16:9",
        quality: request.quality || "720p",
        isTalkingPhoto: request.avatarType === "talking_photo",
        gestureIntensity: request.gestureIntensity || 0,
      });

      if (!response.data?.video_id) {
        throw new Error("Video generation failed - no video ID returned");
      }

      console.log("✅ Video generation started with classic API:", response.data.video_id);

      return {
        id: response.data.video_id,
        status: "processing",
        progress: 0,
      };
    }
  }

  /**
   * Check video generation status
   * Both Avatar IV and classic API use the same status endpoint
   */
  async getVideoStatus(videoId: string): Promise<VideoStatus> {
    console.log("📊 Video Studio: Checking status for video:", videoId);

    // Try Avatar IV service first (handles both APIs since status endpoint is unified)
    try {
      const response = await this.avatarIVService.getVideoStatus(videoId);

      let status: VideoStatus["status"] = "processing";
      if (response.status === "completed") {
        status = "completed";
      } else if (response.status === "failed") {
        status = "failed";
      } else if (response.status === "pending") {
        status = "pending";
      }

      return {
        id: videoId,
        status,
        videoUrl: response.video_url,
        thumbnailUrl: response.thumbnail_url,
        error: response.error,
      };
    } catch (error) {
      // Fallback to classic HeyGen service if Avatar IV fails
      console.log("📊 Falling back to classic HeyGen status check");
      const response = await this.heygenService.getVideoStatus(videoId);

      let status: VideoStatus["status"] = "processing";
      if (response.status === "completed") {
        status = "completed";
      } else if (response.status === "failed") {
        status = "failed";
      } else if (response.status === "pending") {
        status = "pending";
      }

      return {
        id: videoId,
        status,
        videoUrl: response.video_url,
        thumbnailUrl: response.thumbnail_url,
        error: response.error,
      };
    }
  }

  /**
   * ALL-IN-ONE: Quick video generation
   * Handles the entire flow: Upload → Ask → Get It using Avatar IV API
   */
  async quickGenerate(request: QuickVideoRequest): Promise<VideoStatus> {
    console.log("🚀 Video Studio: Quick generation starting with Avatar IV...");

    let imageKey = request.avatarId;

    if (request.imageUrl && !request.avatarId) {
      console.log("📸 Step 1: Creating avatar from image...");
      const avatar = await this.createAvatarFromImage(
        request.imageUrl,
        request.title || "Quick Avatar"
      );
      imageKey = avatar.imageKey || avatar.id;
    }

    if (!imageKey) {
      throw new Error("Either imageUrl or avatarId is required");
    }

    let script = request.script;
    if (!script && request.topic) {
      console.log("📝 Step 2: Generating script from topic...");
      script = await this.generateScript(request.topic);
    }

    if (!script) {
      throw new Error("Either script or topic is required");
    }

    console.log("🎬 Step 3: Generating video with Avatar IV...");
    return this.generateVideo({
      avatarId: imageKey,
      imageKey: imageKey,
      script,
      title: request.title,
      voiceId: request.voiceId,
      aspectRatio: request.aspectRatio,
    });
  }

  /**
   * Poll video status until complete or failed
   */
  async waitForCompletion(
    videoId: string,
    maxWaitMs: number = 300000,
    pollIntervalMs: number = 5000
  ): Promise<VideoStatus> {
    console.log(`⏳ Video Studio: Waiting for video ${videoId} to complete...`);

    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.getVideoStatus(videoId);

      if (status.status === "completed") {
        console.log("✅ Video completed:", status.videoUrl);
        return status;
      }

      if (status.status === "failed") {
        console.error("❌ Video generation failed:", status.error);
        throw new Error(`Video generation failed: ${status.error}`);
      }

      console.log(`⏳ Still processing... (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`);
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Video generation timeout after ${maxWaitMs / 1000} seconds`);
  }
}

export const videoStudioService = new VideoStudioService();
