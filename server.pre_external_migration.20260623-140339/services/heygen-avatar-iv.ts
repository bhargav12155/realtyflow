/**
 * HeyGen Avatar IV Service
 * Simplified video generation workflow:
 * 1. Upload photo -> get image_key
 * 2. Generate video with script/voice
 * 3. Check video status
 */

interface AvatarIVVideoOptions {
  imageKey: string;
  videoTitle: string;
  script: string;
  voiceId: string;
  videoOrientation?: "portrait" | "landscape";
  fit?: "cover" | "contain";
  customMotionPrompt?: string;
  enhanceCustomMotionPrompt?: boolean;
}

interface AvatarIVAudioOptions {
  imageKey: string;
  videoTitle: string;
  audioUrl?: string;
  audioAssetId?: string;
  videoOrientation?: "portrait" | "landscape";
  fit?: "cover" | "contain";
  customMotionPrompt?: string;
  enhanceCustomMotionPrompt?: boolean;
}

export interface UploadResponse {
  id: string;
  name: string;
  file_type: string;
  url: string;
  image_key: string;
}

export interface VideoGenerateResponse {
  video_id: string;
}

export interface VideoStatusResponse {
  video_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  video_url?: string;
  thumbnail_url?: string;
  title?: string;
  duration?: number;
  error?: string;
}

export function sanitizeScriptForTTS(script: string): string {
  let cleaned = script;
  cleaned = cleaned.replace(/\[([^\]]*(?:tone|voice|whisper|shout|pause|excited|calm|serious|cheerful|dramatic|soft|loud|slow|fast|emotion|feeling|style|speak|say|read|narrat)[^\]]*)\]/gi, '');
  cleaned = cleaned.replace(/\(([^)]*(?:tone|voice|whisper|shout|pause|excited|calm|serious|cheerful|dramatic|soft|loud|slow|fast|emotion|feeling|style|speak|say|read|narrat)[^)]*)\)/gi, '');
  cleaned = cleaned.replace(/\*([^*]*(?:tone|voice|whisper|shout|pause|excited|calm|serious|cheerful|dramatic|soft|loud|slow|fast|emotion|feeling|style|speak|say|read|narrat)[^*]*)\*/gi, '');
  cleaned = cleaned.replace(/^(?:tone|voice|style|delivery|emotion|feeling|mood)\s*[:=]\s*[^\n]*/gmi, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.replace(/^\s+|\s+$/g, '');
  cleaned = cleaned.replace(/  +/g, ' ');
  return cleaned;
}

export class HeyGenAvatarIVService {
  private apiKey: string;
  private uploadUrl = "https://upload.heygen.com/v1/asset";
  private apiBaseUrl = "https://api.heygen.com";

  constructor() {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      throw new Error("HEYGEN_API_KEY is not set in environment variables");
    }
    this.apiKey = apiKey;
  }

  /**
   * Step 1: Upload a photo to get image_key
   */
  async uploadPhoto(imageBuffer: Buffer, contentType: string = "image/jpeg"): Promise<UploadResponse> {
    console.log(`📤 Uploading photo to HeyGen (${imageBuffer.length} bytes)...`);

    const response = await fetch(this.uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        "X-API-KEY": this.apiKey,
        "Accept": "application/json",
      },
      body: imageBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Upload failed: ${response.status}`, errorText);
      throw new Error(`Failed to upload photo: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ Photo uploaded:`, JSON.stringify(result, null, 2));
    
    if (result.code !== 100) {
      throw new Error(`Upload failed with code ${result.code}: ${JSON.stringify(result)}`);
    }

    return result.data;
  }

  /**
   * Step 2: Generate Avatar IV video with script and voice
   */
  async generateVideo(options: AvatarIVVideoOptions): Promise<VideoGenerateResponse> {
    console.log(`🎬 Generating Avatar IV video...`);
    console.log(`  Image Key: ${options.imageKey}`);
    console.log(`  Title: ${options.videoTitle}`);
    console.log(`  Voice ID: ${options.voiceId}`);

    const cleanedScript = sanitizeScriptForTTS(options.script);
    if (cleanedScript !== options.script) {
      console.log(`🧹 Script sanitized for TTS (removed tone/direction markers)`);
      console.log(`  Original length: ${options.script.length}, Cleaned length: ${cleanedScript.length}`);
    }

    const payload: any = {
      image_key: options.imageKey,
      video_title: options.videoTitle,
      script: cleanedScript,
      voice_id: options.voiceId,
      video_orientation: options.videoOrientation || "landscape",
      fit: options.fit || "contain",
    };

    if (options.customMotionPrompt) {
      payload.custom_motion_prompt = options.customMotionPrompt;
      payload.enhance_custom_motion_prompt = options.enhanceCustomMotionPrompt ?? true;
    }

    const response = await fetch(`${this.apiBaseUrl}/v2/video/av4/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": this.apiKey,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Video generation failed: ${response.status}`, errorText);
      throw new Error(`Failed to generate video: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ Video generation started:`, JSON.stringify(result, null, 2));

    if (result.error) {
      throw new Error(`Video generation error: ${result.error}`);
    }

    return result.data;
  }

  /**
   * Generate video with custom audio (URL or asset ID)
   */
  async generateVideoWithAudio(options: AvatarIVAudioOptions): Promise<VideoGenerateResponse> {
    console.log(`🎬 Generating Avatar IV video with custom audio...`);

    const payload: any = {
      image_key: options.imageKey,
      video_title: options.videoTitle,
      video_orientation: options.videoOrientation || "landscape",
      fit: options.fit || "contain",
    };

    if (options.audioUrl) {
      payload.audio_url = options.audioUrl;
    } else if (options.audioAssetId) {
      payload.audio_asset_id = options.audioAssetId;
    } else {
      throw new Error("Either audioUrl or audioAssetId is required");
    }

    if (options.customMotionPrompt) {
      payload.custom_motion_prompt = options.customMotionPrompt;
      payload.enhance_custom_motion_prompt = options.enhanceCustomMotionPrompt ?? true;
    }

    const response = await fetch(`${this.apiBaseUrl}/v2/video/av4/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": this.apiKey,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Video generation failed: ${response.status}`, errorText);
      throw new Error(`Failed to generate video: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ Video generation started:`, JSON.stringify(result, null, 2));

    if (result.error) {
      throw new Error(`Video generation error: ${result.error}`);
    }

    return result.data;
  }

  /**
   * Step 3: Check video generation status
   */
  async getVideoStatus(videoId: string): Promise<VideoStatusResponse> {
    console.log(`🔍 Checking video status for: ${videoId}`);

    const response = await fetch(
      `${this.apiBaseUrl}/v1/video_status.get?video_id=${videoId}`,
      {
        method: "GET",
        headers: {
          "X-Api-Key": this.apiKey,
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Status check failed: ${response.status}`, errorText);
      throw new Error(`Failed to get video status: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`📊 Video status:`, JSON.stringify(result, null, 2));

    if (result.code !== 100) {
      throw new Error(`Status check failed with code ${result.code}`);
    }

    return result.data;
  }

  /**
   * Get available voices (v2 API)
   */
  async getVoices(): Promise<any[]> {
    console.log("🎤 Fetching voices from HeyGen v2 API...");
    
    const response = await fetch(`${this.apiBaseUrl}/v2/voices`, {
      method: "GET",
      headers: {
        "X-Api-Key": this.apiKey,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get voices: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ Retrieved ${result.data?.voices?.length || 0} voices`);
    return result.data?.voices || [];
  }
}
