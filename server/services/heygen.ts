interface HeyGenAPIResponse {
  code: number;
  message: string;
  data?: any;
}

interface CreateAvatarResponse extends HeyGenAPIResponse {
  data?: {
    avatar_id?: string;
    avatar_group_id?: string; // For talking photo avatars
    avatar_name?: string;
    name?: string;
    status?: string;
    preview_image_url?: string;
  };
}

interface GenerateVideoResponse extends HeyGenAPIResponse {
  data?: {
    video_id: string;
    status: string;
    video_url?: string;
    thumbnail_url?: string;
  };
}

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

  // Create a talking photo avatar from an uploaded image
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
    aspectRatio = "16:9",
    quality = "720p",
    isTalkingPhoto = false,
    speed = 1.0,
  }: {
    avatarId: string;
    script: string;
    title: string;
    voiceId?: string;
    aspectRatio?: "16:9" | "9:16" | "1:1";
    quality?: "1080p" | "720p" | "480p";
    isTalkingPhoto?: boolean;
    speed?: number;
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
        };

    // Follow the exact structure from the official documentation
    const payload = {
      video_inputs: [
        {
          character,
          voice: {
            type: "text",
            input_text: script.substring(0, 1500), // Limit to 1500 characters as per docs
            voice_id: voiceId || "119caed25533477ba63822d5d1552d25", // Default voice from docs
            speed: speed,
          },
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
    return await this.makeRequest("/video/generate", "POST", payload);
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
      const data = raw?.data || raw;
      return {
        video_id: data?.video_id || videoId,
        status: data?.status,
        video_url: data?.video_url,
        thumbnail_url: data?.thumbnail_url,
        error: data?.error,
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
