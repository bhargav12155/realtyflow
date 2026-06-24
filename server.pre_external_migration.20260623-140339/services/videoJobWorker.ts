/**
 * Video Job Worker Service
 * Background worker that polls for pending/processing video generation jobs
 * and updates their status by checking the HeyGen API
 */

import { storage } from "../storage.js";
import { realtimeService } from "../websocket.js";
import type { VideoGenerationJob } from "@shared/schema";

interface HeyGenVideoStatusResponse {
  video_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  error?: string;
}

const POLL_INTERVAL_MS = 10000; // 10 seconds
const HEYGEN_API_BASE_URL = "https://api.heygen.com";

let isRunning = false;
let pollInterval: NodeJS.Timeout | null = null;

/**
 * Check video status from HeyGen API
 */
async function checkHeyGenVideoStatus(videoId: string): Promise<HeyGenVideoStatusResponse | null> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    console.error("❌ [VideoJobWorker] HEYGEN_API_KEY is not set");
    return null;
  }

  try {
    const response = await fetch(
      `${HEYGEN_API_BASE_URL}/v1/video_status.get?video_id=${videoId}`,
      {
        method: "GET",
        headers: {
          "X-Api-Key": apiKey,
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [VideoJobWorker] Status check failed for ${videoId}: ${response.status}`, errorText);
      return null;
    }

    const result = await response.json();
    
    if (result.code !== 100) {
      console.error(`❌ [VideoJobWorker] Status check failed with code ${result.code}:`, result);
      return null;
    }

    return result.data;
  } catch (error) {
    console.error(`❌ [VideoJobWorker] Error checking status for ${videoId}:`, error);
    return null;
  }
}

/**
 * Process a single video generation job
 */
async function processJob(job: VideoGenerationJob): Promise<void> {
  if (!job.heygenVideoId) {
    console.warn(`⚠️ [VideoJobWorker] Job ${job.id} has no HeyGen video ID, skipping`);
    return;
  }

  console.log(`🔍 [VideoJobWorker] Checking status for job ${job.id} (HeyGen: ${job.heygenVideoId})`);

  const statusResult = await checkHeyGenVideoStatus(job.heygenVideoId);
  if (!statusResult) {
    console.warn(`⚠️ [VideoJobWorker] Could not get status for job ${job.id}`);
    return;
  }

  const heygenStatus = statusResult.status;
  const currentStatus = job.status;

  // Map HeyGen status to our job status
  let newStatus: string = currentStatus;
  let updates: Partial<VideoGenerationJob> = {};

  switch (heygenStatus) {
    case "pending":
      if (currentStatus === "pending") {
        // Still pending, no update needed
        return;
      }
      newStatus = "pending";
      break;

    case "processing":
      if (currentStatus !== "processing") {
        newStatus = "processing";
        updates = { status: "processing" };
      }
      break;

    case "completed":
      newStatus = "completed";
      updates = {
        status: "completed",
        videoUrl: statusResult.video_url || null,
        thumbnailUrl: statusResult.thumbnail_url || null,
        completedAt: new Date(),
      };
      break;

    case "failed":
      newStatus = "failed";
      updates = {
        status: "failed",
        errorMessage: statusResult.error || "Video generation failed",
        completedAt: new Date(),
      };
      break;
  }

  // Update the job if status changed
  if (Object.keys(updates).length > 0) {
    console.log(`📝 [VideoJobWorker] Updating job ${job.id}: ${currentStatus} -> ${newStatus}`);
    await storage.updateVideoGenerationJob(job.id, updates);

    // Send WebSocket notification for completed or failed jobs
    if (newStatus === "completed" || newStatus === "failed") {
      const eventType = newStatus === "completed" ? "video_generation_complete" : "video_generation_failed";
      
      console.log(`📢 [VideoJobWorker] Sending ${eventType} notification to user ${job.userId}`);

      if (newStatus === "completed") {
        realtimeService.notifyVideoGenerationComplete(
          parseInt(job.userId, 10) || 0,
          job.id,
          statusResult.video_url || "",
          job.title || undefined
        );
      } else {
        realtimeService.notifyVideoGenerationFailed(
          parseInt(job.userId, 10) || 0,
          job.id,
          statusResult.error || "Video generation failed",
          job.title || undefined
        );
      }

      // Also send a custom message with full job details
      realtimeService.sendToUser(job.userId, {
        type: newStatus === "completed" ? "video_generation_complete" : "video_generation_failed",
        data: {
          jobId: job.id,
          videoId: job.heygenVideoId, // HeyGen video ID for navigation
          title: job.title,
          videoUrl: statusResult.video_url || null,
          source: job.source,
          status: newStatus,
          thumbnailUrl: statusResult.thumbnail_url || null,
          error: statusResult.error || null, // Error message for failed jobs
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
}

/**
 * Poll for jobs and process them
 */
async function pollJobs(): Promise<void> {
  if (!isRunning) return;

  try {
    // Get all pending and processing jobs
    const [pendingJobs, processingJobs] = await Promise.all([
      storage.getPendingVideoGenerationJobs(),
      storage.getProcessingVideoGenerationJobs(),
    ]);

    const allJobs = [...pendingJobs, ...processingJobs];
    
    if (allJobs.length > 0) {
      console.log(`🔄 [VideoJobWorker] Processing ${allJobs.length} job(s) (${pendingJobs.length} pending, ${processingJobs.length} processing)`);
    }

    // Process each job
    for (const job of allJobs) {
      await processJob(job);
    }
  } catch (error) {
    console.error("❌ [VideoJobWorker] Error polling jobs:", error);
  }
}

/**
 * Start the video job worker
 */
export function startVideoJobWorker(): void {
  if (isRunning) {
    console.log("⚠️ [VideoJobWorker] Already running");
    return;
  }

  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ [VideoJobWorker] HEYGEN_API_KEY not set, worker will not start");
    return;
  }

  isRunning = true;
  console.log("🚀 [VideoJobWorker] Starting video job worker (polling every 10 seconds)");

  // Initial poll
  pollJobs();

  // Set up recurring poll
  pollInterval = setInterval(pollJobs, POLL_INTERVAL_MS);
}

/**
 * Stop the video job worker
 */
export function stopVideoJobWorker(): void {
  if (!isRunning) {
    console.log("⚠️ [VideoJobWorker] Not running");
    return;
  }

  isRunning = false;
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }

  console.log("🛑 [VideoJobWorker] Stopped video job worker");
}

/**
 * Check if the worker is running
 */
export function isVideoJobWorkerRunning(): boolean {
  return isRunning;
}
