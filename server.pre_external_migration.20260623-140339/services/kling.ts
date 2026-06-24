import jwt from "jsonwebtoken";

interface KlingImageToVideoRequest {
  imageUrl: string;
  prompt: string;
  duration?: "5" | "10";
  modelName?: string;
  mode?: "std" | "pro";
  negativePrompt?: string;
  cfgScale?: number;
}

interface KlingGenerationResult {
  success: boolean;
  videoUrl?: string;
  taskId?: string;
  status?: "pending" | "processing" | "completed" | "failed";
  error?: string;
}

interface KlingTaskStatus {
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  videoUrl?: string;
  error?: string;
}

interface KlingApiResponse {
  code: number;
  message: string;
  request_id: string;
  data?: {
    task_id?: string;
    task_status?: string;
    task_status_msg?: string;
    task_result?: {
      videos?: Array<{
        id: string;
        url: string;
        duration: string;
      }>;
    };
  };
}

function generateJwtToken(accessKey: string, secretKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    iss: accessKey,
    exp: now + 1800,
    nbf: now - 5,
  };
  
  return jwt.sign(payload, secretKey, { 
    algorithm: "HS256",
    header: {
      alg: "HS256",
      typ: "JWT",
    }
  });
}

export class KlingService {
  private accessKey: string;
  private secretKey: string;
  private baseUrl = "https://api-singapore.klingai.com";

  constructor(accessKey?: string, secretKey?: string) {
    this.accessKey = accessKey || process.env.KLING_ACCESS_KEY || "";
    this.secretKey = secretKey || process.env.KLING_SECRET_KEY || "";
    
    if (!this.accessKey || !this.secretKey) {
      throw new Error("Kling API credentials not configured. Please set KLING_ACCESS_KEY and KLING_SECRET_KEY.");
    }
  }

  private getAuthToken(): string {
    return generateJwtToken(this.accessKey, this.secretKey);
  }

  async generateImageToVideo(request: KlingImageToVideoRequest): Promise<KlingGenerationResult> {
    try {
      console.log("🎬 Kling: Starting image-to-video generation...");
      console.log("📸 Image URL:", request.imageUrl);
      console.log("📝 Prompt:", request.prompt);
      console.log("🎯 Model:", request.modelName || "kling-v1-6");
      console.log("⚡ Mode:", request.mode || "pro");
      console.log("🔑 Access Key (first 8 chars):", this.accessKey.substring(0, 8) + "...");

      const token = this.getAuthToken();
      console.log("🎫 JWT Token (first 50 chars):", token.substring(0, 50) + "...");

      const response = await fetch(`${this.baseUrl}/v1/videos/image2video`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model_name: request.modelName || "kling-v1-6",
          mode: request.mode || "pro",
          duration: request.duration || "5",
          image: request.imageUrl,
          prompt: request.prompt,
          negative_prompt: request.negativePrompt || "blur, distort, low quality, pixelated, deformed",
          cfg_scale: request.cfgScale ?? 0.5,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Kling API error:", response.status, errorText);
        return {
          success: false,
          error: `Kling API error: ${response.status} - ${errorText}`,
        };
      }

      const result: KlingApiResponse = await response.json();
      console.log("✅ Kling API response:", JSON.stringify(result, null, 2));

      if (result.code !== 0) {
        return {
          success: false,
          error: result.message || "Unknown Kling API error",
        };
      }

      const taskId = result.data?.task_id;
      if (!taskId) {
        return {
          success: false,
          error: "No task ID returned from Kling API",
        };
      }

      return {
        success: true,
        taskId: taskId,
        status: "pending",
      };
    } catch (error) {
      console.error("❌ Kling generation error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async checkTaskStatus(taskId: string): Promise<KlingTaskStatus> {
    try {
      const token = this.getAuthToken();

      const response = await fetch(`${this.baseUrl}/v1/videos/image2video/${taskId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Kling status check error:", response.status, errorText);
        return {
          status: "failed",
          error: `Failed to check status: ${response.status} - ${errorText}`,
        };
      }

      const result: KlingApiResponse = await response.json();
      console.log("📊 Kling task status:", taskId, result.data?.task_status);

      if (result.code !== 0) {
        return {
          status: "failed",
          error: result.message || "Status check failed",
        };
      }

      const taskStatus = result.data?.task_status;
      const videos = result.data?.task_result?.videos;

      if (taskStatus === "succeed" && videos && videos.length > 0) {
        return {
          status: "completed",
          videoUrl: videos[0].url,
        };
      }

      if (taskStatus === "failed") {
        return {
          status: "failed",
          error: result.data?.task_status_msg || "Generation failed",
        };
      }

      const statusMap: Record<string, KlingTaskStatus["status"]> = {
        "submitted": "pending",
        "processing": "processing",
      };

      return {
        status: statusMap[taskStatus || ""] || "processing",
      };
    } catch (error) {
      console.error("❌ Error checking Kling task status:", error);
      return {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async waitForCompletion(taskId: string, maxWaitMs: number = 300000): Promise<KlingTaskStatus> {
    const startTime = Date.now();
    const pollInterval = 5000;

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.checkTaskStatus(taskId);

      if (status.status === "completed" || status.status === "failed") {
        return status;
      }

      console.log(`⏳ Kling task ${taskId} still ${status.status}, waiting...`);
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    return {
      status: "failed",
      error: "Timeout waiting for video generation",
    };
  }

  async generateLipSync(request: { videoUrl: string; text: string; voiceId?: string; mode?: "text2video" | "audio2video"; audioUrl?: string }): Promise<{
    success: boolean;
    videoUrl?: string;
    taskId?: string;
    status?: "pending" | "processing" | "completed" | "failed";
    error?: string;
  }> {
    try {
      console.log("🎤 Kling: Starting lip-sync generation...");
      console.log("🎬 Video URL:", request.videoUrl);
      console.log("📝 Text:", request.text.substring(0, 50) + (request.text.length > 50 ? "..." : ""));
      console.log("📝 Text length:", request.text.length, "chars");
      console.log("🔊 Voice timbre:", request.voiceId || "female_calm");
      console.log("🎤 Mode:", request.mode || "text2video");
      console.log("🔗 Audio URL:", request.audioUrl ? request.audioUrl.substring(0, 50) + "..." : "N/A");

      const token = this.getAuthToken();

      let requestBody: { input: Record<string, unknown> };

      if (request.mode === "audio2video" && request.audioUrl) {
        console.log("🎵 Using audio2video mode with provided audio");
        requestBody = {
          input: {
            video_url: request.videoUrl,
            mode: "audio2video",
            audio_type: "url",
            audio_url: request.audioUrl,
          },
        };
      } else {
        const voiceTimbreMap: Record<string, string> = {
          "female_calm": "The Reader",
          "male_calm": "Businessman",
          "female_professional": "Commercial Lady",
          "male_professional": "Businessman",
          "female_warm": "Sweet Girl",
          "male_warm": "Rock",
          "neutral": "The Reader",
        };
        const ttsTimbre = voiceTimbreMap[request.voiceId || "female_calm"] || "The Reader";

        const truncatedText = request.text.length > 120 ? request.text.substring(0, 117) + "..." : request.text;

        console.log("🎙️ Using TTS timbre:", ttsTimbre);
        console.log("📝 Truncated text for TTS:", truncatedText);

        requestBody = {
          input: {
            video_url: request.videoUrl,
            mode: "text2video",
            text: truncatedText,
            voice_id: ttsTimbre,
            voice_speed: 1.0,
          },
        };
      }

      console.log("📤 Kling Lip-Sync request body:", JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${this.baseUrl}/v1/videos/lip-sync`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      console.log("📡 Kling Lip-Sync API raw response:", response.status, responseText);

      if (!response.ok) {
        console.error("❌ Kling Lip-Sync API error:", response.status, responseText);
        return {
          success: false,
          error: `Kling Lip-Sync API error: ${response.status} - ${responseText}`,
        };
      }

      let result: KlingApiResponse;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.error("❌ Failed to parse Kling response:", e);
        return {
          success: false,
          error: "Failed to parse Kling API response",
        };
      }
      
      console.log("✅ Kling Lip-Sync API response:", JSON.stringify(result, null, 2));

      if (result.code !== 0) {
        return {
          success: false,
          error: result.message || "Unknown Kling API error",
        };
      }

      const taskId = result.data?.task_id;
      if (!taskId) {
        return {
          success: false,
          error: "No task ID returned from Kling Lip-Sync API",
        };
      }

      return {
        success: true,
        taskId: taskId,
        status: "pending",
      };
    } catch (error) {
      console.error("❌ Kling lip-sync generation error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async checkLipSyncTaskStatus(taskId: string): Promise<KlingTaskStatus> {
    try {
      const token = this.getAuthToken();

      const response = await fetch(`${this.baseUrl}/v1/videos/lip-sync/${taskId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Kling lip-sync status check error:", response.status, errorText);
        return {
          status: "failed",
          error: `Failed to check lip-sync status: ${response.status} - ${errorText}`,
        };
      }

      const result: KlingApiResponse = await response.json();
      console.log("📊 Kling lip-sync task status:", taskId, result.data?.task_status);

      if (result.code !== 0) {
        return {
          status: "failed",
          error: result.message || "Lip-sync status check failed",
        };
      }

      const taskStatus = result.data?.task_status;
      const videos = result.data?.task_result?.videos;

      if (taskStatus === "succeed" && videos && videos.length > 0) {
        return {
          status: "completed",
          videoUrl: videos[0].url,
        };
      }

      if (taskStatus === "failed") {
        return {
          status: "failed",
          error: result.data?.task_status_msg || "Lip-sync generation failed",
        };
      }

      const statusMap: Record<string, KlingTaskStatus["status"]> = {
        "submitted": "pending",
        "processing": "processing",
      };

      return {
        status: statusMap[taskStatus || ""] || "processing",
      };
    } catch (error) {
      console.error("❌ Error checking Kling lip-sync task status:", error);
      return {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export async function generateMotionVideo(
  imageUrl: string,
  prompt: string,
  options?: {
    duration?: "5" | "10";
    modelName?: string;
    mode?: "std" | "pro";
    waitForCompletion?: boolean;
  }
): Promise<KlingGenerationResult> {
  const service = new KlingService();

  const result = await service.generateImageToVideo({
    imageUrl,
    prompt,
    duration: options?.duration || "5",
    modelName: options?.modelName || "kling-v1-6",
    mode: options?.mode || "pro",
  });

  if (!result.success || !result.taskId) {
    return result;
  }

  if (options?.waitForCompletion) {
    const finalStatus = await service.waitForCompletion(result.taskId);
    return {
      success: finalStatus.status === "completed",
      videoUrl: finalStatus.videoUrl,
      taskId: result.taskId,
      status: finalStatus.status,
      error: finalStatus.error,
    };
  }

  return result;
}

export async function checkMotionVideoStatus(taskId: string): Promise<KlingTaskStatus> {
  const service = new KlingService();
  return service.checkTaskStatus(taskId);
}

interface KlingLipSyncRequest {
  videoUrl: string;
  text: string;
  voiceId?: string;
  mode?: "text2video" | "audio2video";
  audioUrl?: string;
}

interface KlingLipSyncResult {
  success: boolean;
  videoUrl?: string;
  taskId?: string;
  status?: "pending" | "processing" | "completed" | "failed";
  error?: string;
}

export async function generateLipSyncVideo(request: KlingLipSyncRequest): Promise<KlingLipSyncResult> {
  const service = new KlingService();
  return service.generateLipSync(request);
}

export async function checkLipSyncStatus(taskId: string): Promise<KlingTaskStatus> {
  const service = new KlingService();
  return service.checkLipSyncTaskStatus(taskId);
}
