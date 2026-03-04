import { GoogleGenAI } from "@google/genai";

interface VeoVideoRequest {
  imageUrl: string;
  prompt: string;
  aspectRatio?: "16:9" | "9:16";
  duration?: number;
  agentPhotoUrl?: string;
}

interface VeoVideoResult {
  success: boolean;
  videoUrl?: string;
  operationId?: string;
  error?: string;
  quotaExceeded?: boolean;
}

interface VeoOperationStatus {
  done: boolean;
  videoUrl?: string;
  error?: string;
  quotaExceeded?: boolean;
}

export class VeoVideoService {
  private client: GoogleGenAI | null = null;
  private pendingOperations: Map<string, any> = new Map();
  private lastApiKey: string | null = null;

  private getClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn("⚠️ [VeoVideo] No GEMINI_API_KEY found in environment");
      return null;
    }
    
    if (this.client && this.lastApiKey === apiKey) {
      return this.client;
    }
    
    console.log("✅ [VeoVideo] Initializing Gemini client with API key");
    this.client = new GoogleGenAI({ apiKey });
    this.lastApiKey = apiKey;
    return this.client;
  }

  async generateVideo(request: VeoVideoRequest): Promise<VeoVideoResult> {
    const client = this.getClient();
    
    if (!client) {
      console.error("❌ [VeoVideo] Cannot generate video - GEMINI_API_KEY not configured");
      return { success: false, error: "Gemini API key not configured. Please add GEMINI_API_KEY to secrets." };
    }

    try {
      console.log(`🎬 [VeoVideo] Starting VEO 3.1 video generation from image`);
      console.log(`📝 [VeoVideo] Prompt: ${request.prompt.substring(0, 100)}...`);
      console.log(`🖼️ [VeoVideo] Image URL: ${request.imageUrl.substring(0, 80)}...`);
      if (request.agentPhotoUrl) {
        console.log(`👤 [VeoVideo] Agent photo will be included in prompt context: ${request.agentPhotoUrl.substring(0, 50)}...`);
      }

      const imageData = await this.fetchImageAsBase64(request.imageUrl);
      if (!imageData) {
        return { success: false, error: "Failed to fetch image for video generation" };
      }

      console.log(`📤 [VeoVideo] Sending to VEO 3.1 API...`);
      
      const VEO_MAX_DURATION = 8;
      const requestedDuration = request.duration && request.duration > 0 ? request.duration : 8;
      const segmentDuration = Math.min(requestedDuration, VEO_MAX_DURATION);

      const config: Record<string, any> = {
        aspectRatio: request.aspectRatio || "16:9",
        numberOfVideos: 1,
        durationSeconds: segmentDuration,
      };

      console.log(`⏱️ [VeoVideo] Requested ${requestedDuration}s, segment duration: ${segmentDuration}s`);

      const operation = await client.models.generateVideos({
        model: "veo-3.1-generate-preview",
        prompt: request.prompt,
        image: {
          imageBytes: imageData.bytes,
          mimeType: imageData.mimeType,
        },
        config,
      });

      const operationId = `veo-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      this.pendingOperations.set(operationId, operation);

      console.log(`✅ [VeoVideo] VEO 3.1 operation started successfully: ${operationId}`);

      return {
        success: true,
        operationId,
      };
    } catch (error: any) {
      const errorStr = JSON.stringify(error);
      console.error("❌ [VeoVideo] VEO 3.1 generation error:", errorStr);
      
      // Check for quota exceeded / rate limit errors
      if (
        error.status === 429 || 
        error.code === 429 ||
        errorStr.includes("429") ||
        errorStr.includes("RESOURCE_EXHAUSTED") ||
        errorStr.includes("quota") ||
        error.message?.includes("quota") ||
        error.message?.includes("rate limit") ||
        error.message?.includes("exceeded")
      ) {
        console.error("⚠️ [VeoVideo] QUOTA EXCEEDED - Gemini API rate limit hit");
        return { 
          success: false, 
          error: "Gemini VEO quota exceeded. Please wait for your quota to reset or upgrade your API plan.", 
          quotaExceeded: true 
        };
      }
      
      if (error.message?.includes("API key")) {
        return { success: false, error: "Invalid Gemini API key. Please check your GEMINI_API_KEY secret." };
      }
      return { success: false, error: error.message || "Unknown VEO error" };
    }
  }

  async checkOperationStatus(operationId: string): Promise<VeoOperationStatus> {
    const operation = this.pendingOperations.get(operationId);
    if (!operation) {
      return { done: false, error: "Operation not found" };
    }

    try {
      const client = this.getClient();
      if (!client) {
        return { done: false, error: "Client not initialized" };
      }

      console.log(`🔄 [VeoVideo] Checking VEO operation status: ${operationId}`);
      
      const updatedOperation = await client.operations.getVideosOperation({
        operation: operation,
      });
      
      if (updatedOperation.done) {
        this.pendingOperations.delete(operationId);
        console.log(`✅ [VeoVideo] VEO operation completed: ${operationId}`);

        const response = updatedOperation.response as any;
        const generatedVideos = response?.generatedVideos || response?.generated_videos;
        if (generatedVideos && generatedVideos.length > 0) {
          const video = generatedVideos[0].video;
          
          if (video) {
            const fs = await import("fs");
            const path = await import("path");
            
            const outputDir = "/tmp/veo-output";
            if (!fs.existsSync(outputDir)) {
              fs.mkdirSync(outputDir, { recursive: true });
            }
            
            const filename = `property-tour-${operationId}.mp4`;
            const filepath = path.join(outputDir, filename);
            
            console.log(`📥 [VeoVideo] Downloading VEO video to: ${filepath}`);
            await client.files.download({ file: video, downloadPath: filepath });
            
            console.log(`✅ [VeoVideo] VEO 3.1 video saved: ${filepath}`);
            // Return local file path for internal use (ffmpeg combining)
            // The API route /api/property-tour/veo-video/ can serve these files externally
            return { done: true, videoUrl: filepath };
          }
        }
        
        console.error(`❌ [VeoVideo] No video in VEO response`);
        return { done: true, error: "No video in response" };
      }

      this.pendingOperations.set(operationId, updatedOperation);
      console.log(`⏳ [VeoVideo] VEO operation still processing: ${operationId}`);

      return { done: false };
    } catch (error: any) {
      const errorStr = JSON.stringify(error);
      console.error("❌ [VeoVideo] VEO status check error:", errorStr);
      
      // Check for quota exceeded during operation polling
      if (
        error.status === 429 || 
        error.code === 429 ||
        errorStr.includes("429") ||
        errorStr.includes("RESOURCE_EXHAUSTED") ||
        errorStr.includes("quota") ||
        error.message?.includes("quota") ||
        error.message?.includes("rate limit")
      ) {
        console.error("⚠️ [VeoVideo] QUOTA EXCEEDED during operation polling");
        return { done: true, error: "Quota exceeded during video processing", quotaExceeded: true };
      }
      
      return { done: false, error: error.message || "Unknown status check error" };
    }
  }

  async waitForCompletion(operationId: string, maxWaitMs: number = 180000): Promise<VeoOperationStatus> {
    const startTime = Date.now();
    console.log(`⏳ [VeoVideo] Waiting for VEO completion (max ${maxWaitMs/1000}s): ${operationId}`);
    
    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.checkOperationStatus(operationId);
      
      if (status.done) {
        return status;
      }
      
      if (status.error && !status.error.includes("not found")) {
        return status;
      }

      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    console.error(`❌ [VeoVideo] VEO operation timed out after ${maxWaitMs/1000}s`);
    return { done: false, error: "Video generation timed out" };
  }

  private async fetchImageAsBase64(url: string): Promise<{ bytes: string; mimeType: string } | null> {
    try {
      console.log(`📷 [VeoVideo] Fetching image from URL...`);
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://www.paragonrels.com/",
          "Cache-Control": "no-cache",
        },
      });
      if (!response.ok) {
        console.error(`❌ [VeoVideo] Failed to fetch image: HTTP ${response.status}`);
        return null;
      }

      const contentType = response.headers.get("content-type") || "image/jpeg";
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      console.log(`✅ [VeoVideo] Image fetched: ${contentType}, ${Math.round(arrayBuffer.byteLength/1024)}KB`);
      return { bytes: base64, mimeType: contentType };
    } catch (error: any) {
      console.error(`❌ [VeoVideo] Image fetch error:`, error.message);
      return null;
    }
  }

  isConfigured(): boolean {
    const hasKey = !!process.env.GEMINI_API_KEY;
    console.log(`🔑 [VeoVideo] isConfigured check: GEMINI_API_KEY ${hasKey ? 'present' : 'missing'}`);
    return hasKey;
  }
}

export const veoVideoService = new VeoVideoService();
