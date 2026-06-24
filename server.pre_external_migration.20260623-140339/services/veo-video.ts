import { GoogleGenAI } from "@google/genai";

interface VeoVideoRequest {
  imageUrl: string;
  prompt: string;
  aspectRatio?: "16:9" | "9:16";
  duration?: number;
  agentPhotoUrl?: string;
}

type VeoErrorType = "safety_filter" | "transient" | "quota_exceeded" | "unknown";

interface VeoVideoResult {
  success: boolean;
  videoUrl?: string;
  operationId?: string;
  error?: string;
  errorType?: VeoErrorType;
  quotaExceeded?: boolean;
}

interface VeoOperationStatus {
  done: boolean;
  videoUrl?: string;
  error?: string;
  errorType?: VeoErrorType;
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
        
        console.error(`❌ [VeoVideo] No video in VEO response. Full response: ${JSON.stringify(response, null, 2)}`);
        
        const responseStr = JSON.stringify(response || {}).toLowerCase();
        const blockedReason = response?.blockedReason || response?.blocked_reason;
        const finishReason = response?.finishReason || response?.finish_reason;
        const safetyRatings = response?.safetyRatings || response?.safety_ratings;
        const promptFeedback = response?.promptFeedback || response?.prompt_feedback;
        
        const hasStructuredSignal = 
          blockedReason ||
          finishReason === "SAFETY" ||
          finishReason === "BLOCKED" ||
          (safetyRatings && Array.isArray(safetyRatings) && safetyRatings.some((r: any) => r.blocked || r.probability === "HIGH")) ||
          (promptFeedback?.blockReason || promptFeedback?.block_reason);
        
        const hasTextSignal = !hasStructuredSignal && (
          responseStr.includes("blockedreason") ||
          responseStr.includes("blocked_reason") ||
          responseStr.includes("safety_filter") ||
          responseStr.includes("content_policy") ||
          responseStr.includes("prohibited_content")
        );
        
        const isSafetyBlock = hasStructuredSignal || hasTextSignal;
        
        if (isSafetyBlock) {
          const reason = blockedReason || finishReason || promptFeedback?.blockReason || "content policy violation";
          console.error(`🚫 [VeoVideo] Video blocked by safety/content filter: ${reason}`);
          return { 
            done: true, 
            error: `Video was blocked by content filters (${reason}). Try rephrasing your prompt or using a different image.`,
            errorType: "safety_filter" as VeoErrorType,
          };
        }
        
        return { done: true, error: "No video in response", errorType: "transient" as VeoErrorType };
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

  async generateVideoWithRetry(request: VeoVideoRequest, maxWaitMs: number = 180000): Promise<VeoOperationStatus> {
    console.log(`🔄 [VeoVideo] generateVideoWithRetry: starting first attempt`);
    
    const result1 = await this.generateVideo(request);
    if (!result1.success || !result1.operationId) {
      return { done: true, error: result1.error || "Generation failed", errorType: result1.errorType, quotaExceeded: result1.quotaExceeded };
    }
    
    const status1 = await this.waitForCompletion(result1.operationId, maxWaitMs);
    
    if (status1.done && status1.videoUrl) {
      return status1;
    }
    
    if (status1.errorType === "safety_filter" || status1.quotaExceeded) {
      return status1;
    }
    
    if (status1.done && status1.errorType === "transient") {
      console.log(`🔄 [VeoVideo] First attempt returned no video (transient). Retrying with modified prompt...`);
      
      const retryPrompt = `High quality cinematic footage. ${request.prompt}`;
      const retryRequest = { ...request, prompt: retryPrompt };
      
      const result2 = await this.generateVideo(retryRequest);
      if (!result2.success || !result2.operationId) {
        return { done: true, error: result2.error || "Retry generation failed", errorType: result2.errorType, quotaExceeded: result2.quotaExceeded };
      }
      
      const status2 = await this.waitForCompletion(result2.operationId, maxWaitMs);
      
      if (status2.done && status2.videoUrl) {
        console.log(`✅ [VeoVideo] Retry succeeded!`);
        return status2;
      }
      
      if (status2.quotaExceeded) {
        return status2;
      }
      
      const finalError = status2.errorType === "safety_filter"
        ? status2.error
        : "Video generation failed after retry. The API returned no video data. Please try a different image or prompt.";
      return { done: true, error: finalError, errorType: status2.errorType || "unknown", quotaExceeded: status2.quotaExceeded };
    }
    
    return status1;
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
