import { sanitizeScriptForTTS } from './heygen-avatar-iv';
import {
  parseHeygenVideoGenerateResponse,
  parseHeygenVideoStatusResponse,
  type HeygenVideoGenerateResponse,
} from '@shared/heygenPhotoAvatarSchemas';

interface HeyGenAPIResponse {
  code: number;
  message: string;
  data?: any;
}

interface CreateAvatarResponse extends HeyGenAPIResponse {
  data?: {
    avatar_id?: string;
    avatar_group_id?: string; // For talking photo avatars
    talking_photo_id?: string; // For simple talking photos
    avatar_name?: string;
    name?: string;
    status?: string;
    preview_image_url?: string;
  };
}

type GenerateVideoResponse = HeygenVideoGenerateResponse;

export class HeyGenService {
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
    method: "GET" | "POST" | "PUT" = "GET",
    body?: any
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        "X-Api-Key": this.apiKey, // Consistent with getVideo method
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `HeyGen API error at ${endpoint}:`,
        response.status,
        errorText
      );
      throw new Error(
        `HeyGen API error: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  }

  // Create a simple talking photo by uploading an image directly
  // This endpoint works with Pro/Scale plans (doesn't require Enterprise)
  async uploadTalkingPhoto(imageData: Buffer | ArrayBuffer, contentType: string = "image/jpeg"): Promise<CreateAvatarResponse> {
    const uploadUrl = "https://upload.heygen.com/v1/talking_photo";
    
    console.log("📤 Uploading talking photo directly to HeyGen...");
    console.log(`📤 Content type: ${contentType}`);
    console.log(`📤 Image size: ${imageData instanceof Buffer ? imageData.length : imageData.byteLength} bytes`);
    
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "X-Api-Key": this.apiKey,
        "Content-Type": contentType,
      },
      body: imageData,
    });
    
    console.log(`📤 Upload response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Talking photo upload failed:", response.status, errorText);
      throw new Error(`Failed to upload talking photo: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log("✅ Talking photo uploaded:", JSON.stringify(result, null, 2));
    
    // Response format: { data: { talking_photo_id: "...", talking_photo_url: "..." } }
    return result;
  }

  // Create a talking photo avatar from an uploaded image
  // Note: This uses the Enterprise-only avatar_group/create endpoint
  // For non-Enterprise users, use uploadTalkingPhoto instead
  async createTalkingPhotoAvatar(
    imageUrl: string,
    avatarName: string,
    voiceId?: string
  ): Promise<CreateAvatarResponse> {
    // Extract image_key from the uploaded URL
    // URL format: https://resource2.heygen.ai/image/xxxxx/original
    // Need to extract: image/xxxxx/original
    let imageKey = imageUrl;
    if (imageUrl.includes("heygen.ai/")) {
      const parts = imageUrl.split("heygen.ai/");
      if (parts.length > 1) {
        imageKey = parts[1];
      }
    } else if (imageUrl.includes("heygen.com/")) {
      const parts = imageUrl.split("heygen.com/");
      if (parts.length > 1) {
        imageKey = parts[1];
      }
    }

    const payload = {
      name: avatarName,
      image_key: imageKey,
    };

    console.log("Creating talking photo avatar with payload:", payload);
    const response = await this.makeRequest(
      "/photo_avatar/avatar_group/create",
      "POST",
      payload
    );
    console.log(
      "HeyGen response for talking photo avatar:",
      JSON.stringify(response)
    );
    return response;
  }

  // Get avatar details and status
  async getAvatar(avatarId: string): Promise<any> {
    return await this.makeRequest(`/avatars/${avatarId}`);
  }

  // List all avatars for the user's account (per official documentation)
  async listAvatars(): Promise<any> {
    const response = await this.makeRequest("/avatars");
    return response;
  }

  // List all available voices (per official documentation)
  async listVoices(): Promise<any> {
    const response = await this.makeRequest("/voices");
    return response;
  }

  // Import an existing avatar by ID (validate it exists)
  async importAvatar(avatarId: string): Promise<any> {
    try {
      // First check if the avatar exists in HeyGen's list
      const avatarsList = await this.listAvatars();
      if (avatarsList.data?.avatars) {
        const foundAvatar = avatarsList.data.avatars.find(
          (a: any) => a.avatar_id === avatarId
        );
        if (foundAvatar) {
          return { data: foundAvatar };
        }
      }
      throw new Error(`Avatar with ID ${avatarId} not found in HeyGen`);
    } catch (error) {
      throw new Error(
        `Failed to import avatar: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Generate a video with the avatar (following official documentation)
  async generateVideo({
    avatarId,
    script,
    title,
    voiceId,
    audioAssetId,
    audioUrl,
    aspectRatio = "16:9",
    quality = "720p",
    isTalkingPhoto = false,
    speed = 1.0,
    gestureIntensity = 0,
  }: {
    avatarId: string;
    script: string;
    title: string;
    voiceId?: string;
    audioAssetId?: string;
    audioUrl?: string;
    aspectRatio?: "16:9" | "9:16" | "1:1";
    quality?: "1080p" | "720p" | "480p";
    isTalkingPhoto?: boolean;
    speed?: number;
    gestureIntensity?: number;
  }): Promise<GenerateVideoResponse> {
    // Build character object based on avatar type
    const character = isTalkingPhoto
      ? {
          type: "talking_photo" as const,
          talking_photo_id: avatarId,
        }
      : {
          type: "avatar" as const,
          avatar_id: avatarId,
          avatar_style: "normal",
          // Add gesture intensity if greater than 0
          ...(gestureIntensity > 0 && {
            gesture: {
              intensity: gestureIntensity, // 0 (off) to 3 (expressive)
            },
          }),
        };

    // Build voice object - priority: audioAssetId > audioUrl > text-to-speech
    let voice: any;
    if (audioAssetId) {
      // Use HeyGen audio asset ID (best quality)
      voice = {
        type: "audio" as const,
        audio_asset_id: audioAssetId,
      };
    } else if (audioUrl) {
      // Use direct audio URL (for user recordings stored in S3)
      voice = {
        type: "audio" as const,
        audio_url: audioUrl,
      };
    } else {
      // Use text-to-speech — sanitize script to remove tone/direction markers
      const cleanedScript = sanitizeScriptForTTS(script);
      voice = {
        type: "text" as const,
        input_text: cleanedScript.substring(0, 1500), // Limit to 1500 characters as per docs
        voice_id: voiceId || "119caed25533477ba63822d5d1552d25", // Default voice from docs
        speed: speed,
      };
    }

    // Follow the exact structure from the official documentation
    const payload = {
      video_inputs: [
        {
          character,
          voice,
        },
      ],
      dimension: {
        width:
          aspectRatio === "16:9" ? 1280 : aspectRatio === "9:16" ? 720 : 1080,
        height:
          aspectRatio === "16:9" ? 720 : aspectRatio === "9:16" ? 1280 : 1080,
      },
      // Add title if provided (though not in official docs, it was in original code)
      ...(title ? { title } : {}),
    };

    console.log(
      "Generating video with payload:",
      JSON.stringify(payload, null, 2)
    );
    const raw = await this.makeRequest("/video/generate", "POST", payload);
    return parseHeygenVideoGenerateResponse(raw);
  }

  // Get video generation status and download URL
  async getVideo(videoId: string): Promise<any> {
    // Use the correct v1 endpoint for video status as per documentation
    const url = `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Api-Key": this.apiKey,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      // Propagate 404 as soft state for callers that want to treat it as pending
      const err = new Error(
        `HeyGen API error: ${response.status} ${response.statusText}`
      ) as any;
      (err.status = response.status), (err.statusText = response.statusText);
      throw err;
    }

    return await response.json();
  }

  // Convenience wrapper that normalizes status response shape
  async getVideoStatus(videoId: string): Promise<{
    video_id?: string;
    status?: string;
    video_url?: string;
    thumbnail_url?: string;
    error?: string;
  }> {
    try {
      const raw = await this.getVideo(videoId);
      // v1 API typically returns { code, message, data: { status, video_id, video_url, thumbnail_url } }
      const parsed = parseHeygenVideoStatusResponse(raw, videoId);
      const data = parsed.data ?? {};
      const errVal = data.error;
      return {
        video_id: data.video_id || videoId,
        status: data.status,
        video_url: data.video_url ?? undefined,
        thumbnail_url: data.thumbnail_url ?? undefined,
        error:
          typeof errVal === "string"
            ? errVal
            : errVal
              ? JSON.stringify(errVal)
              : undefined,
      };
    } catch (e: any) {
      // Treat 404 as a transient state (job not yet registered in status service)
      if (e?.status === 404) {
        return { video_id: videoId, status: "processing" };
      }
      throw e;
    }
  }

  // Upload an image and get the URL for avatar creation
  async uploadImage(imageBlob: Blob): Promise<string> {
    // Convert Blob to ArrayBuffer for binary upload
    const arrayBuffer = await imageBlob.arrayBuffer();

    // Determine content type from blob
    const contentType = imageBlob.type || "image/jpeg";

    // Use the correct upload endpoint for HeyGen
    const uploadUrl = "https://upload.heygen.com/v1/asset";

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "X-Api-Key": this.apiKey,
        "Content-Type": contentType,
      },
      body: arrayBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("HeyGen upload failed:", response.status, errorText);
      throw new Error(
        `Failed to upload image: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();
    if (result.code === 100 && result.data?.url) {
      console.log("HeyGen upload successful, asset URL:", result.data.url);
      return result.data.url;
    } else {
      throw new Error(
        `HeyGen upload failed: ${
          result.msg || result.message || "Unknown error"
        }`
      );
    }
  }

  // Upload an audio file and get the audio asset ID for voice cloning
  async uploadAudio(audioBuffer: Buffer, contentType: string): Promise<string> {
    // Use the HeyGen upload endpoint for audio
    const uploadUrl = "https://upload.heygen.com/v1/asset";

    // Normalize content type for HeyGen (it expects audio/x-wav for WAV files)
    const normalizedContentType = contentType === 'audio/wav' ? 'audio/x-wav' : contentType;

    console.log("🌐 HeyGen Audio Upload:", {
      url: uploadUrl,
      originalContentType: contentType,
      normalizedContentType,
      bufferSize: audioBuffer.length
    });

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "X-Api-Key": this.apiKey,
        "Content-Type": normalizedContentType,
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ HeyGen audio upload failed:", response.status, errorText);
      throw new Error(
        `Failed to upload audio: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();
    console.log("📨 HeyGen audio upload response:", result);
    
    if (result.code === 100 && result.data?.id) {
      console.log("✅ HeyGen audio upload successful, asset ID:", result.data.id);
      return result.data.id; // Return the audio_asset_id
    } else {
      throw new Error(
        `HeyGen audio upload failed: ${
          result.msg || result.message || "Unknown error"
        }`
      );
    }
  }

  /**
   * Clone an instant voice from an already-uploaded HeyGen audio asset.
   * Returns a HeyGen voice_id that can be used as the narration voice for
   * any subsequent talking-avatar generation (TTS-based, not audio-driven).
   *
   * HeyGen endpoint: POST /v1/voice/clone
   * Body: { audio_asset_id, name, language?, gender? }
   * Response shape (per HeyGen API):
   *   { code: 100, data: { voice_id: string, preview_audio_url?: string }, msg?: string }
   *
   * Throws an Error with a user-friendly message on failure.
   */
  async cloneVoice(params: {
    audioAssetId: string;
    name: string;
    language?: string;
    gender?: string;
  }): Promise<{ voiceId: string; previewAudioUrl?: string }> {
    const url = `https://api.heygen.com/v1/voice/clone`;
    const payload: Record<string, unknown> = {
      audio_asset_id: params.audioAssetId,
      name: params.name,
    };
    if (params.language) payload.language = params.language;
    if (params.gender) payload.gender = params.gender;

    console.log("🧬 HeyGen Voice Clone request:", { url, name: params.name, language: params.language, gender: params.gender });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-Api-Key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    let parsed: { code?: number; msg?: string; message?: string; data?: { voice_id?: string; preview_audio_url?: string; preview_audio?: string } } = {};
    try {
      parsed = (await response.json()) as typeof parsed;
    } catch {
      const txt = await response.text().catch(() => "");
      console.error("❌ HeyGen voice clone non-JSON response:", response.status, txt);
      throw new Error(`Voice cloning failed (HTTP ${response.status}). Please try again.`);
    }

    if (!response.ok || (parsed.code !== undefined && parsed.code !== 100) || !parsed.data?.voice_id) {
      const msg = (parsed.msg || parsed.message || "").toString().toLowerCase();
      console.error("❌ HeyGen voice clone failed:", response.status, parsed);
      // Map common HeyGen failures to user-friendly messages.
      if (response.status === 401 || response.status === 403) {
        throw new Error("Voice cloning is not available on the current HeyGen plan.");
      }
      if (response.status === 429 || msg.includes("quota") || msg.includes("limit")) {
        throw new Error("Voice cloning quota reached on your HeyGen plan. Delete an unused cloned voice or upgrade and try again.");
      }
      if (msg.includes("short") || msg.includes("duration") || msg.includes("too brief")) {
        throw new Error("Recording is too short. Please record at least 30 seconds of clear speech.");
      }
      if (msg.includes("noise") || msg.includes("quality") || msg.includes("unclear")) {
        throw new Error("Audio quality is too low to clone. Try a quieter room and speak clearly.");
      }
      if (msg.includes("not found") || msg.includes("invalid")) {
        throw new Error("Audio sample could not be read by HeyGen. Please re-upload and try again.");
      }
      throw new Error(parsed.msg || parsed.message || `Voice cloning failed (HTTP ${response.status}).`);
    }

    console.log("✅ HeyGen voice clone succeeded:", parsed.data.voice_id);
    return {
      voiceId: parsed.data.voice_id,
      previewAudioUrl: parsed.data.preview_audio_url || parsed.data.preview_audio,
    };
  }

  // Create avatar with voice cloning from audio file
  async createAvatarWithVoiceCloning(
    imageUrl: string,
    audioUrl: string,
    avatarName: string
  ): Promise<CreateAvatarResponse> {
    const payload = {
      avatar_name: avatarName,
      avatar_image_url: imageUrl,
      voice_cloning: {
        audio_url: audioUrl,
        language: "en",
      },
    };

    return await this.makeRequest("/avatars/talking_photo", "POST", payload);
  }
}
