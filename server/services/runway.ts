const RUNWAY_API_BASE = "https://api.dev.runwayml.com/v1";
const RUNWAY_API_VERSION = "2024-11-06";

export type RunwayModel = "gen4_aleph";

export interface RunwayTaskResult {
  taskId: string;
}

export interface RunwayStatusResult {
  status: "pending" | "processing" | "completed" | "failed";
  videoUrl?: string;
  error?: string;
  progress?: number;
}

function getApiKey(): string {
  const key = process.env.RUNWAY_API_KEY;
  if (!key) {
    throw new Error("RUNWAY_API_KEY is not configured. Please add it in Settings.");
  }
  return key;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Runway-Version": RUNWAY_API_VERSION,
  };
}

export async function createVideoToVideoTask(
  videoUri: string,
  promptText: string,
  options: {
    referenceImageUrl?: string;
    seed?: number;
  } = {}
): Promise<RunwayTaskResult> {
  const body: Record<string, any> = {
    model: "gen4_aleph",
    videoUri,
    promptText,
  };

  if (options.seed !== undefined) {
    body.seed = options.seed;
  }

  if (options.referenceImageUrl) {
    body.references = [
      {
        type: "image",
        uri: options.referenceImageUrl,
      },
    ];
  }

  console.log(`🎬 [Runway] Creating video-to-video task: prompt="${promptText.substring(0, 80)}..."`);

  const response = await fetch(`${RUNWAY_API_BASE}/video_to_video`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Runway API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  console.log("[Runway] create response:", JSON.stringify(data));

  if (!data.id) {
    throw new Error("Runway API did not return a task ID");
  }

  return { taskId: data.id };
}

export async function createImageToVideoTask(
  promptImage: string,
  promptText: string,
  options: {
    model?: string;
    ratio?: string;
    duration?: number;
    seed?: number;
  } = {}
): Promise<RunwayTaskResult> {
  const body: Record<string, any> = {
    model: options.model || "gen4_turbo",
    promptImage,
    promptText,
    ratio: options.ratio || "1280:720",
    duration: options.duration || 5,
  };

  if (options.seed !== undefined) {
    body.seed = options.seed;
  }

  console.log(`🎬 [Runway] Creating image-to-video task: prompt="${promptText.substring(0, 80)}..." model=${body.model}`);

  const response = await fetch(`${RUNWAY_API_BASE}/image_to_video`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Runway API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  console.log("[Runway] create response:", JSON.stringify(data));

  if (!data.id) {
    throw new Error("Runway API did not return a task ID");
  }

  return { taskId: data.id };
}

export async function getTaskStatus(taskId: string): Promise<RunwayStatusResult> {
  const response = await fetch(`${RUNWAY_API_BASE}/tasks/${encodeURIComponent(taskId)}`, {
    method: "GET",
    headers: authHeaders(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Runway status error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const status = data.status;

  if (status === "SUCCEEDED") {
    const videoUrl = data.output?.[0];
    if (videoUrl) {
      return { status: "completed", videoUrl };
    }
    return {
      status: "failed",
      error: "Video generation completed but no video URL was returned.",
    };
  }

  if (status === "FAILED") {
    return {
      status: "failed",
      error: data.failure || data.failureCode || "Video generation failed",
    };
  }

  if (status === "RUNNING") {
    return { status: "processing", progress: data.progress ? Math.round(data.progress * 100) : undefined };
  }

  return { status: "pending" };
}

export const runwayService = {
  createVideoToVideoTask,
  createImageToVideoTask,
  getTaskStatus,
};
