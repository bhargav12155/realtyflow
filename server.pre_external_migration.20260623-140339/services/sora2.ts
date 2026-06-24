const SORA2_API_BASE = "https://api.sora2api.ai/api/v1/sora2api";

export type Sora2AspectRatio = "landscape" | "portrait";
export type Sora2Quality = "standard" | "hd";
export type Sora2Status = "pending" | "processing" | "completed" | "failed";

export interface Sora2TaskResult {
  taskId: string;
}

export interface Sora2StatusResult {
  status: Sora2Status;
  videoUrl?: string;
  error?: string;
  errorCode?: "missing_video_url" | "task_creation_failed" | "generation_failed";
}

function getApiKey(): string {
  const key = process.env.SORA2_API_KEY;
  if (!key) {
    throw new Error("SORA2_API_KEY is not configured. Please add it in Settings.");
  }
  return key;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
  };
}

export async function createVideoTask(
  prompt: string,
  options: {
    aspectRatio?: Sora2AspectRatio;
    quality?: Sora2Quality;
    imageUrls?: string[];
  } = {}
): Promise<Sora2TaskResult> {
  const body: Record<string, any> = {
    prompt,
    aspectRatio: options.aspectRatio || "landscape",
    quality: options.quality || "hd",
  };

  if (options.imageUrls && options.imageUrls.length > 0) {
    body.imageUrls = options.imageUrls;
  }

  console.log(`🎬 [Sora2] Creating video task: prompt="${prompt.substring(0, 80)}..." aspect=${body.aspectRatio} quality=${body.quality}`);

  const response = await fetch(`${SORA2_API_BASE}/generate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Sora2 API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  console.log("[Sora2] generate response:", JSON.stringify(data));

  if (data.code !== 200) {
    throw new Error(`Sora2 task creation failed (code ${data.code}): ${data.msg || "Unknown error"}`);
  }

  if (!data.data?.taskId) {
    throw new Error("Sora2 API did not return a taskId");
  }

  return {
    taskId: data.data.taskId,
  };
}

export async function getTaskStatus(taskId: string): Promise<Sora2StatusResult> {
  const response = await fetch(`${SORA2_API_BASE}/record-info?taskId=${encodeURIComponent(taskId)}`, {
    method: "GET",
    headers: authHeaders(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Sora2 status error ${response.status}: ${text}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    throw new Error(`Sora2 status query failed (code ${data.code}): ${data.msg || "Unknown error"}`);
  }

  const taskData = data.data;

  if (!taskData) {
    return { status: "pending" };
  }

  const successFlag = taskData.successFlag;

  if (successFlag === 0) {
    return { status: "processing" };
  }

  if (successFlag === 1) {
    const videoUrl = taskData.response?.imageUrl;
    if (videoUrl) {
      return { status: "completed", videoUrl };
    }
    console.error(`⚠️ [Sora2] Task ${taskId} completed (successFlag=1) but no videoUrl found. Full response:`, JSON.stringify(taskData));
    return { 
      status: "failed", 
      errorCode: "missing_video_url",
      error: "Video generation completed but no video was returned. This may be a temporary issue — please try again." 
    };
  }

  if (successFlag === 2) {
    return {
      status: "failed",
      error: taskData.errorMessage || "Task creation failed",
    };
  }

  if (successFlag === 3) {
    return {
      status: "failed",
      error: taskData.errorMessage || "Video generation failed",
    };
  }

  return { status: "processing" };
}

export const sora2Service = {
  createVideoTask,
  getTaskStatus,
};
