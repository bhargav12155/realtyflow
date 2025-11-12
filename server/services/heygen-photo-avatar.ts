interface PhotoGenerationOptions {
  name: string;
  age:
    | "Young Adult"
    | "Early Middle Age"
    | "Late Middle Age"
    | "Senior"
    | "Unspecified";
  gender: "Man" | "Woman" | "Person";
  ethnicity: string;
  orientation: "horizontal" | "vertical";
  pose: "full_body" | "half_body" | "close_up";
  style:
    | "Realistic"
    | "Pixar"
    | "Cinematic"
    | "Vintage"
    | "Noir"
    | "Cyberpunk"
    | "Unspecified";
  appearance: string;
}

interface AvatarGroup {
  group_id: string;
  name: string;
  status: "pending" | "processing" | "ready" | "failed";
  created_at: string;
}

export class HeyGenPhotoAvatarService {
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
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: any
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;

    console.log(`🌐 HeyGen API Request: ${method} ${url}`);
    console.log(`🌐 HeyGen API Endpoint: ${endpoint}`);
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
      `🌐 HeyGen API Response status: ${response.status} ${response.statusText}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `❌ HeyGen API error at ${endpoint}:`,
        response.status,
        errorText
      );
      console.error(`❌ HeyGen API full URL: ${url}`);
      console.error(`❌ HeyGen API method: ${method}`);

      // Try to parse error as JSON for better error messages
      try {
        const errorJson = JSON.parse(errorText);
        const errorMessage = errorJson.message || errorJson.error || errorText;
        throw new Error(
          `HeyGen API error (${response.status}): ${errorMessage}`
        );
      } catch {
        throw new Error(
          `HeyGen API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }
    }

    const result = await response.json();
    console.log(`✅ HeyGen API Response:`, JSON.stringify(result, null, 2));
    return result;
  }

  // Generate AI photos for avatars
  async generateAIPhotos(options: PhotoGenerationOptions) {
    const payload = {
      name: options.name,
      age: options.age,
      gender: options.gender,
      ethnicity: options.ethnicity,
      orientation: options.orientation,
      pose: options.pose,
      style: options.style,
      appearance: options.appearance,
      num_images: 5, // Generate 5 photos
    };

    const response = await this.makeRequest(
      "/photo_avatar/photo/generate",
      "POST",
      payload
    );
    return response.data;
  }

  // Get generation status
  async getGenerationStatus(generationId: string) {
    const response = await this.makeRequest(
      `/photo_avatar/photo/generate/${generationId}`
    );
    return response.data;
  }

  // Create avatar group from photos
  async createAvatarGroup(name: string, imageKeys: string | string[]) {
    console.log("🎭 HeyGen: Creating avatar group");
    console.log("🎭 HeyGen: Input name:", name);
    console.log("🎭 HeyGen: Input imageKeys:", imageKeys);

    // HeyGen API requires image_key to be a single string, not an array
    // If multiple images are provided, create with first and add the rest
    const keysArray = Array.isArray(imageKeys) ? imageKeys : [imageKeys];

    console.log("🎭 HeyGen: Processed keysArray:", keysArray);
    console.log("🎭 HeyGen: KeysArray length:", keysArray.length);

    if (keysArray.length === 0) {
      throw new Error("At least one image key is required");
    }

    // Create group with first image
    const payload = {
      name,
      image_key: keysArray[0], // Must be a string, not array
    };

    console.log(
      "🎭 HeyGen: Creating group with first image, payload:",
      JSON.stringify(payload, null, 2)
    );
    const response = await this.makeRequest(
      "/photo_avatar/avatar_group/create",
      "POST",
      payload
    );

    console.log(
      "🎭 HeyGen: Create group response:",
      JSON.stringify(response, null, 2)
    );

    // If there are more images, add them to the group
    // HeyGen returns group_id, not avatar_group_id
    const groupId = response.data?.group_id || response.data?.avatar_group_id;
    console.log("🎭 HeyGen: Extracted groupId:", groupId);

    if (keysArray.length > 1 && groupId) {
      console.log(
        `🎭 HeyGen: Adding ${
          keysArray.length - 1
        } more images to group ${groupId}...`
      );
      await this.addPhotosToGroup(
        groupId,
        keysArray.slice(1), // Remaining images
        name
      );
    }

    console.log(
      "🎭 HeyGen: Final createAvatarGroup result:",
      JSON.stringify(response.data, null, 2)
    );
    return response.data;
  }

  // Add photos to existing avatar group
  async addPhotosToGroup(groupId: string, imageKeys: string[], name?: string) {
    console.log("➕ HeyGen: Adding photos to group");
    console.log("➕ HeyGen: Group ID:", groupId);
    console.log("➕ HeyGen: Image keys to add:", imageKeys);
    console.log("➕ HeyGen: Image keys count:", imageKeys.length);

    // Add images one by one as HeyGen expects single images
    const results = [];
    for (let i = 0; i < imageKeys.length; i++) {
      const payload = {
        group_id: groupId,
        image_keys: [imageKeys[i]], // Single image in array
        name: name || `Photo ${i + 1}`,
      };

      console.log(
        `➕ HeyGen: Adding image ${i + 1}/${imageKeys.length}, payload:`,
        JSON.stringify(payload, null, 2)
      );
      const response = await this.makeRequest(
        "/photo_avatar/avatar_group/add",
        "POST",
        payload
      );
      console.log(
        `➕ HeyGen: Add image ${i + 1} response:`,
        JSON.stringify(response, null, 2)
      );
      results.push(response.data);
    }

    console.log(
      "➕ HeyGen: All add operations completed, results:",
      JSON.stringify(results, null, 2)
    );
    return results;
  }

  // List avatar groups
  async listAvatarGroups() {
    console.log("📋 HeyGen: Listing avatar groups...");
    const response = await this.makeRequest("/avatar_group.list");
    console.log(
      "📋 HeyGen: Raw list response:",
      JSON.stringify(response, null, 2)
    );
    console.log(
      "📋 HeyGen: Avatar group list count:",
      response.data?.avatar_group_list?.length || 0
    );
    if (response.data?.avatar_group_list?.length > 0) {
      console.log(
        "📋 HeyGen: First group sample:",
        JSON.stringify(response.data.avatar_group_list[0], null, 2)
      );
    }
    return response.data;
  }

  // Get specific avatar group
  async getAvatarGroup(groupId: string) {
    const response = await this.makeRequest(`/avatar_group/${groupId}`);
    return response.data;
  }

  // Get avatar group looks (trained avatars)
  async getAvatarGroupLooks(groupId: string) {
    const response = await this.makeRequest(`/avatar_group/${groupId}/avatars`);
    return response.data;
  }

  // Train avatar group (LORA model)
  async trainAvatarGroup(groupId: string, defaultVoiceId?: string) {
    const payload: any = {
      group_id: groupId,
      training_mode: "lora_training",
    };

    // Add default voice if provided
    if (defaultVoiceId) {
      payload.default_voice_id = defaultVoiceId;
    }

    console.log(
      "🚀 HeyGen: Training avatar group with payload:",
      JSON.stringify(payload, null, 2)
    );

    // Try the correct training endpoint - might be /photo_avatar/train instead of /photo_avatar/avatar_group/train
    const response = await this.makeRequest(
      "/photo_avatar/train",
      "POST",
      payload
    );
    return response.data;
  }

  // Generate new looks for trained avatar
  async generateNewLooks(groupId: string, numLooks: number = 3) {
    const payload = {
      group_id: groupId,
      num_looks: numLooks,
      style_preferences: {
        clothing: ["business", "casual", "formal"],
        backgrounds: ["office", "outdoor", "studio"],
      },
    };

    const response = await this.makeRequest(
      "/photo_avatar/avatar_group/generate_looks",
      "POST",
      payload
    );
    return response.data;
  }

  // Check training status
  async checkTrainingStatus(groupId: string) {
    const response = await this.makeRequest(
      `/photo_avatar/avatar_group/${groupId}/status`
    );
    return response.data;
  }

  // Delete avatar group
  async deleteAvatarGroup(groupId: string) {
    const response = await this.makeRequest(
      `/photo_avatar_group/${groupId}`,
      "DELETE"
    );
    return response.data;
  }

  // Delete individual avatar (photo/look within a group)
  async deleteIndividualAvatar(avatarId: string) {
    const response = await this.makeRequest(
      `/photo_avatar/${avatarId}`,
      "DELETE"
    );
    return response.data;
  }

  // Edit/Generate look with custom prompt (for modifying existing looks)
  async editLook(params: {
    groupId: string;
    prompt: string;
    orientation?: "square" | "landscape" | "portrait";
    pose?: "half_body" | "full_body";
    style?: string;
    referenceImages?: string[];
  }) {
    const payload = {
      group_id: params.groupId,
      prompt: params.prompt,
      orientation: params.orientation || "square",
      pose: params.pose || "half_body",
      style: params.style || "Realistic",
      ...(params.referenceImages && params.referenceImages.length > 0
        ? { reference_image_keys: params.referenceImages }
        : {}),
    };

    const response = await this.makeRequest(
      "/photo_avatar/look/generate",
      "POST",
      payload
    );
    return response.data;
  }

  // Add looks to existing avatar group
  async addLooks(params: {
    groupId: string;
    imageKeys: string[];
    name?: string;
  }) {
    const payload = {
      group_id: params.groupId,
      image_keys: params.imageKeys,
      ...(params.name ? { name: params.name } : {}),
    };

    const response = await this.makeRequest(
      "/photo_avatar/avatar_group/add",
      "POST",
      payload
    );
    return response.data;
  }

  // Upload custom photo for avatar (supports both Blob and Buffer)
  async uploadCustomPhoto(
    imageData: Blob | Buffer,
    contentType: string = "image/jpeg"
  ): Promise<string> {
    const uploadUrl = "https://upload.heygen.com/v1/asset";

    console.log(`📤 HeyGen: Starting photo upload...`);
    console.log(`📤 HeyGen: Upload URL: ${uploadUrl}`);
    console.log(`📤 HeyGen: Content type: ${contentType}`);
    console.log(
      `📤 HeyGen: Image data type: ${
        imageData instanceof Blob ? "Blob" : "Buffer"
      }`
    );
    console.log(
      `📤 HeyGen: Image data size: ${
        imageData instanceof Blob ? imageData.size : imageData.length
      } bytes`
    );

    let body: ArrayBuffer | Buffer;
    if (imageData instanceof Blob) {
      body = await imageData.arrayBuffer();
      console.log(
        `📤 HeyGen: Converted Blob to ArrayBuffer, size: ${body.byteLength} bytes`
      );
    } else {
      body = imageData;
      console.log(
        `📤 HeyGen: Using Buffer directly, size: ${
          (body as Buffer).length
        } bytes`
      );
    }

    console.log(`📤 HeyGen: Making upload request...`);
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "X-Api-Key": this.apiKey,
        "Content-Type": contentType,
      },
      body: body as any,
    });

    console.log(
      `📤 HeyGen: Upload response status: ${response.status} ${response.statusText}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "❌ HeyGen: Photo upload failed:",
        response.status,
        errorText
      );
      throw new Error(`Failed to upload photo: ${response.status}`);
    }

    const result = await response.json();
    console.log("📦 HeyGen: Upload result:", JSON.stringify(result, null, 2));

    if (result.code === 100 && result.data?.image_key) {
      // Use the image_key provided by HeyGen (e.g., "image/{id}/original")
      const imageKey = result.data.image_key;
      console.log(
        "✅ HeyGen: Photo uploaded successfully, image key:",
        imageKey
      );
      return imageKey;
    } else if (result.code === 100 && result.data?.id) {
      // Fallback: construct the image_key if not provided
      const imageKey = `image/${result.data.id}/original`;
      console.log(
        "✅ HeyGen: Photo uploaded successfully, constructed image key:",
        imageKey
      );
      return imageKey;
    } else {
      console.error("❌ HeyGen: Upload failed with result:", result);
      throw new Error(
        `Upload failed: ${result.msg || result.message || "Unknown error"}`
      );
    }
  }

  // Upload multiple photos and get their keys
  async uploadMultiplePhotos(photoBuffers: Buffer[]): Promise<string[]> {
    const imageKeys: string[] = [];

    for (const buffer of photoBuffers) {
      const imageKey = await this.uploadCustomPhoto(buffer, "image/jpeg");
      imageKeys.push(imageKey);
    }

    return imageKeys;
  }

  // Create talking photo from uploaded image (simplified version)
  async createTalkingPhoto(imageKey: string, name: string) {
    const payload = {
      name,
      image_key: imageKey,
    };

    const response = await this.makeRequest(
      "/talking_photo/add",
      "POST",
      payload
    );
    return response.data;
  }

  // Add motion to photo avatar
  async addMotion(avatarId: string) {
    console.log(`🎬 HeyGen: Adding motion to avatar ${avatarId}`);
    const payload = {
      id: avatarId,
    };

    const response = await this.makeRequest(
      "/photo_avatar/add_motion",
      "POST",
      payload
    );
    console.log(
      "🎬 HeyGen: Add motion response:",
      JSON.stringify(response, null, 2)
    );
    return response.data;
  }

  // Add sound effect to photo avatar
  async addSoundEffect(avatarId: string) {
    console.log(`🔊 HeyGen: Adding sound effect to avatar ${avatarId}`);
    const payload = {
      id: avatarId,
    };

    const response = await this.makeRequest(
      "/photo_avatar/add_sound_effect",
      "POST",
      payload
    );
    console.log(
      "🔊 HeyGen: Add sound effect response:",
      JSON.stringify(response, null, 2)
    );
    return response.data;
  }

  // Get avatar status (for checking motion/sound effect status)
  async getAvatarStatus(avatarId: string) {
    const response = await this.makeRequest(`/photo_avatar/${avatarId}`);
    return response.data;
  }
}
