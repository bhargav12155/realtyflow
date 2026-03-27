const LUMA_API_BASE = "https://api.lumalabs.ai/dream-machine/v1";

export type LumaModel = "ray-2" | "ray-flash-2";
export type LumaAspectRatio = "16:9" | "9:16" | "1:1";
export type LumaStatus = "dreaming" | "completed" | "failed";

export interface LumaTaskResult {
  taskId: string;
}

export interface LumaStatusResult {
  status: "pending" | "processing" | "completed" | "failed";
  videoUrl?: string;
  error?: string;
}

function getApiKey(): string {
  const key = process.env.LUMA_API_KEY;
  if (!key) {
    throw new Error("LUMA_API_KEY is not configured. Please add it in Settings.");
  }
  return key;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function createVideoTask(
  prompt: string,
  options: {
    model?: LumaModel;
    aspectRatio?: LumaAspectRatio;
    duration?: string;
    loop?: boolean;
    keyframeImageUrl?: string;
  } = {}
): Promise<LumaTaskResult> {
  const body: Record<string, any> = {
    prompt,
    model: options.model || "ray-2",
  };

  if (options.aspectRatio) {
    body.aspect_ratio = options.aspectRatio;
  }

  if (options.duration) {
    body.duration = options.duration;
  }

  if (options.loop !== undefined) {
    body.loop = options.loop;
  }

  if (options.keyframeImageUrl) {
    body.keyframes = {
      frame0: {
        type: "image",
        url: options.keyframeImageUrl,
      },
    };
  }

  console.log(`🎬 [Luma] Creating video task: prompt="${prompt.substring(0, 80)}..." model=${body.model} aspect=${body.aspect_ratio || "default"}`);

  const response = await fetch(`${LUMA_API_BASE}/generations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Luma API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  console.log("[Luma] generate response:", JSON.stringify(data));

  if (!data.id) {
    throw new Error("Luma API did not return a generation ID");
  }

  return {
    taskId: data.id,
  };
}

export async function getTaskStatus(taskId: string): Promise<LumaStatusResult> {
  const response = await fetch(`${LUMA_API_BASE}/generations/${encodeURIComponent(taskId)}`, {
    method: "GET",
    headers: authHeaders(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Luma status error ${response.status}: ${text}`);
  }

  const data = await response.json();

  const state = data.state;

  if (state === "completed") {
    const videoUrl = data.assets?.video;
    if (videoUrl) {
      return { status: "completed", videoUrl };
    }
    return {
      status: "failed",
      error: "Video generation completed but no video URL was returned.",
    };
  }

  if (state === "failed") {
    return {
      status: "failed",
      error: data.failure_reason || "Video generation failed",
    };
  }

  if (state === "dreaming") {
    return { status: "processing" };
  }

  return { status: "pending" };
}

export const lumaService = {
  createVideoTask,
  getTaskStatus,
};
