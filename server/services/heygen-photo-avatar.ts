interface PhotoGenerationOptions {
  name: string;
  age: 'Child' | 'Young Adult' | 'Middle Age' | 'Senior';
  gender: 'Man' | 'Woman' | 'Person';
  ethnicity: string;
  orientation: 'horizontal' | 'vertical';
  pose: 'full_body' | 'half_body' | 'close_up';
  style: 'Realistic' | 'Artistic' | 'Professional';
  appearance: string;
}

interface AvatarGroup {
  group_id: string;
  name: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  created_at: string;
}

export class HeyGenPhotoAvatarService {
  private apiKey: string;
  private baseUrl = 'https://api.heygen.com/v2';

  constructor() {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      throw new Error('HEYGEN_API_KEY is not set in environment variables');
    }
    this.apiKey = apiKey;
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' = 'GET', body?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      method,
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HeyGen Photo Avatar API error at ${endpoint}:`, response.status, errorText);
      throw new Error(`HeyGen API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
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
      num_images: 5 // Generate 5 photos
    };

    const response = await this.makeRequest('/photo_avatar/photo/generate', 'POST', payload);
    return response.data;
  }

  // Get generation status
  async getGenerationStatus(generationId: string) {
    const response = await this.makeRequest(`/photo_avatar/photo/generate/${generationId}`);
    return response.data;
  }

  // Create avatar group from photos
  async createAvatarGroup(name: string, imageKey: string) {
    const payload = {
      name,
      image_key: imageKey
    };

    const response = await this.makeRequest('/photo_avatar/avatar_group/create', 'POST', payload);
    return response.data;
  }

  // Add photos to existing avatar group
  async addPhotosToGroup(groupId: string, imageKeys: string[], name?: string) {
    const payload = {
      group_id: groupId,
      image_keys: imageKeys,
      name: name || 'Additional photos'
    };

    const response = await this.makeRequest('/photo_avatar/avatar_group/add', 'POST', payload);
    return response.data;
  }

  // List avatar groups
  async listAvatarGroups() {
    const response = await this.makeRequest('/avatar_group.list');
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
  async trainAvatarGroup(groupId: string) {
    const payload = {
      group_id: groupId,
      training_mode: 'lora_training'
    };

    const response = await this.makeRequest('/photo_avatar/avatar_group/train', 'POST', payload);
    return response.data;
  }

  // Generate new looks for trained avatar
  async generateNewLooks(groupId: string, numLooks: number = 3) {
    const payload = {
      group_id: groupId,
      num_looks: numLooks,
      style_preferences: {
        clothing: ['business', 'casual', 'formal'],
        backgrounds: ['office', 'outdoor', 'studio']
      }
    };

    const response = await this.makeRequest('/photo_avatar/avatar_group/generate_looks', 'POST', payload);
    return response.data;
  }

  // Check training status
  async checkTrainingStatus(groupId: string) {
    const response = await this.makeRequest(`/photo_avatar/avatar_group/${groupId}/status`);
    return response.data;
  }

  // Delete avatar group
  async deleteAvatarGroup(groupId: string) {
    const response = await this.makeRequest(`/avatar_group/${groupId}`, 'DELETE');
    return response.data;
  }

  // Upload custom photo for avatar
  async uploadCustomPhoto(imageBlob: Blob): Promise<string> {
    // Use the upload service from main HeyGen service
    const arrayBuffer = await imageBlob.arrayBuffer();
    const contentType = imageBlob.type || 'image/jpeg';
    
    const uploadUrl = 'https://upload.heygen.com/v1/asset';
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': contentType,
      },
      body: arrayBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Photo upload failed:', response.status, errorText);
      throw new Error(`Failed to upload photo: ${response.status}`);
    }

    const result = await response.json();
    if (result.code === 100 && result.data?.id) {
      // Return the image key in the format expected by photo avatar API
      return `image/${result.data.id}/original`;
    } else {
      throw new Error(`Upload failed: ${result.msg || result.message || 'Unknown error'}`);
    }
  }

  // Create talking photo from uploaded image (simplified version)
  async createTalkingPhoto(imageKey: string, name: string) {
    const payload = {
      name,
      image_key: imageKey
    };

    const response = await this.makeRequest('/talking_photo/add', 'POST', payload);
    return response.data;
  }
}