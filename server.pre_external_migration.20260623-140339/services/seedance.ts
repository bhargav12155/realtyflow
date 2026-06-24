const DEFAULT_BASE = "https://ark.ap-southeast.bytepluses.com/api/v3";

export type SeedanceModel =
  | "seedance-1-0-pro-250528"
  | "seedance-1-0-lite-t2v-250428"
  | "seedance-1-0-lite-i2v-250428";

export type SeedanceAspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
export type SeedanceDuration = 5 | 10;

export interface SeedanceTaskResult {
  taskId: string;
}

export type SeedanceStatus =
  | "queued"
  | "generating"
  | "ready"
  | "failed";

export interface SeedanceStatusResult {
  status: SeedanceStatus;
  videoUrl?: string;
  error?: string;
}

export interface SeedanceCreateTextToVideoOptions {
  prompt: string;
  model?: SeedanceModel;
  aspectRatio?: SeedanceAspectRatio;
  durationSeconds?: SeedanceDuration;
  resolution?: "480p" | "720p" | "1080p";
  seed?: number;
}

export interface SeedanceCreateImageToVideoOptions {
  prompt: string;
  sourceImageUrl: string;
  model?: SeedanceModel;
  aspectRatio?: SeedanceAspectRatio;
  durationSeconds?: SeedanceDuration;
  resolution?: "480p" | "720p" | "1080p";
  seed?: number;
}

function getApiKey(): string {
  const key = process.env.SEEDANCE_API_KEY;
  if (!key) {
    throw new Error("SEEDANCE_API_KEY is not configured. Please add it in Settings.");
  }
  return key;
}

function getApiBase(): string {
  return process.env.SEEDANCE_API_BASE || DEFAULT_BASE;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function buildPromptText(opts: {
  prompt: string;
  aspectRatio?: SeedanceAspectRatio;
  durationSeconds?: SeedanceDuration;
  resolution?: "480p" | "720p" | "1080p";
  seed?: number;
}): string {
  const tokens: string[] = [opts.prompt.trim()];
  if (opts.aspectRatio) tokens.push(`--ratio ${opts.aspectRatio}`);
  if (opts.durationSeconds) tokens.push(`--duration ${opts.durationSeconds}`);
  if (opts.resolution) tokens.push(`--resolution ${opts.resolution}`);
  if (typeof opts.seed === "number") tokens.push(`--seed ${opts.seed}`);
  return tokens.join(" ");
}

async function postTask(body: Record<string, unknown>): Promise<SeedanceTaskResult> {
  const res = await fetch(`${getApiBase()}/contents/generations/tasks`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Seedance API error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { id?: string };
  if (!data.id) {
    throw new Error("Seedance API did not return a task ID");
  }
  return { taskId: data.id };
}

export async function createTextToVideo(
  options: SeedanceCreateTextToVideoOptions
): Promise<SeedanceTaskResult> {
  if (!options.prompt || typeof options.prompt !== "string") {
    throw new Error("prompt is required");
  }
  const model = options.model || "seedance-1-0-pro-250528";
  const text = buildPromptText({
    prompt: options.prompt,
    aspectRatio: options.aspectRatio,
    durationSeconds: options.durationSeconds,
    resolution: options.resolution,
    seed: options.seed,
  });
  console.log(
    `🌱 [Seedance] Creating t2v task: model=${model} text="${text.substring(0, 80)}..."`
  );
  return postTask({
    model,
    content: [{ type: "text", text }],
  });
}

export async function createImageToVideo(
  options: SeedanceCreateImageToVideoOptions
): Promise<SeedanceTaskResult> {
  if (!options.prompt || typeof options.prompt !== "string") {
    throw new Error("prompt is required");
  }
  if (!options.sourceImageUrl || typeof options.sourceImageUrl !== "string") {
    throw new Error("sourceImageUrl is required");
  }
  const model = options.model || "seedance-1-0-lite-i2v-250428";
  const text = buildPromptText({
    prompt: options.prompt,
    aspectRatio: options.aspectRatio,
    durationSeconds: options.durationSeconds,
    resolution: options.resolution,
    seed: options.seed,
  });
  console.log(
    `🌱 [Seedance] Creating i2v task: model=${model} src=${options.sourceImageUrl.substring(0, 80)}...`
  );
  return postTask({
    model,
    content: [
      { type: "text", text },
      { type: "image_url", image_url: { url: options.sourceImageUrl } },
    ],
  });
}

export async function getStatus(taskId: string): Promise<SeedanceStatusResult> {
  if (!taskId || typeof taskId !== "string") {
    throw new Error("taskId is required");
  }
  const res = await fetch(
    `${getApiBase()}/contents/generations/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: authHeaders(),
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Seedance status error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as {
    status?: string;
    content?: { video_url?: string };
    error?: { message?: string } | string;
  };
  const state = (data.status || "").toLowerCase();
  if (state === "succeeded" || state === "completed") {
    const videoUrl = data.content?.video_url;
    if (videoUrl) {
      return { status: "ready", videoUrl };
    }
    return {
      status: "failed",
      error: "Seedance reported success but no video URL was returned.",
    };
  }
  if (state === "failed" || state === "cancelled" || state === "canceled") {
    const errMsg =
      typeof data.error === "string"
        ? data.error
        : data.error?.message || "Seedance generation failed";
    return { status: "failed", error: errMsg };
  }
  if (state === "running" || state === "processing" || state === "in_progress") {
    return { status: "generating" };
  }
  return { status: "queued" };
}

export const seedanceService = {
  createTextToVideo,
  createImageToVideo,
  getStatus,
};
