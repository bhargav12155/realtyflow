import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

const LUMA_API_BASE = "https://api.lumalabs.ai/dream-machine/v1";
const ATLAS_API_BASE = "https://api.atlascloud.ai/api/v1";

function isPrivateOrReservedIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local / metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (family === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80:")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
    if (lower.startsWith("ff")) return true; // multicast
    if (lower.startsWith("::ffff:")) {
      const v4 = lower.slice("::ffff:".length);
      if (isIP(v4) === 4) return isPrivateOrReservedIp(v4);
    }
    return false;
  }
  return true;
}

async function assertSafeFetchUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid image URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Refusing to fetch image with unsupported protocol: ${parsed.protocol}`);
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  if (!hostname || hostname === "localhost") {
    throw new Error("Refusing to fetch image from localhost");
  }
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await dnsLookup(hostname, { all: true }).catch(() => []);
  if (addresses.length === 0) {
    throw new Error(`Could not resolve image host: ${hostname}`);
  }
  for (const addr of addresses) {
    if (isPrivateOrReservedIp(addr.address)) {
      throw new Error(`Refusing to fetch image from private/reserved address: ${addr.address}`);
    }
  }
}

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

export interface LumaBatchInfo {
  batchId: string;
  userId: string;
  totalClips: number;
  completedClips: number;
  currentClipIndex: number;
  currentTaskId: string | null;
  clipVideoUrls: Map<number, string>;
  failedClip: number | null;
  prompt: string;
  model: LumaModel;
  aspectRatio?: LumaAspectRatio;
  keyframeImageUrl?: string;
  transition: "crossfade" | "cut";
  stitchedVideoUrl?: string;
  status: "pending" | "processing" | "stitching" | "completed" | "failed";
  error?: string;
  createdAt: number;
}

const lumaBatches = new Map<string, LumaBatchInfo>();
const BATCH_TTL_MS = 60 * 60 * 1000;

function cleanupStaleBatches() {
  const now = Date.now();
  for (const [id, batch] of lumaBatches) {
    if (now - batch.createdAt > BATCH_TTL_MS) {
      lumaBatches.delete(id);
    }
  }
}

setInterval(cleanupStaleBatches, 5 * 60 * 1000);

export function createLumaBatch(
  userId: string,
  totalClips: number,
  prompt: string,
  model: LumaModel,
  aspectRatio?: LumaAspectRatio,
  keyframeImageUrl?: string,
  transition: "crossfade" | "cut" = "crossfade"
): string {
  cleanupStaleBatches();
  const batchId = crypto.randomUUID();
  lumaBatches.set(batchId, {
    batchId,
    userId,
    totalClips,
    completedClips: 0,
    currentClipIndex: 0,
    currentTaskId: null,
    clipVideoUrls: new Map(),
    failedClip: null,
    prompt,
    model,
    aspectRatio,
    keyframeImageUrl,
    transition,
    status: "pending",
    createdAt: Date.now(),
  });
  return batchId;
}

export function getLumaBatch(batchId: string): LumaBatchInfo | undefined {
  return lumaBatches.get(batchId);
}

export function updateLumaBatch(batchId: string, updates: Partial<LumaBatchInfo>) {
  const batch = lumaBatches.get(batchId);
  if (batch) {
    Object.assign(batch, updates);
    batch.createdAt = Date.now();
  }
}

export function deleteLumaBatch(batchId: string) {
  lumaBatches.delete(batchId);
}

function hasDirectKey(): boolean {
  return Boolean(process.env.LUMA_API_KEY);
}

function hasAtlasKey(): boolean {
  return Boolean(process.env.ATLAS_API_KEY);
}

function noTransportError(): Error {
  return new Error(
    "No Luma transport configured. Set LUMA_API_KEY for direct access or ATLAS_API_KEY for the Atlas Cloud fallback."
  );
}

function directAuthHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.LUMA_API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function atlasAuthHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.ATLAS_API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function atlasModelFor(model: LumaModel): string {
  // Atlas Cloud's Luma Ray model identifiers.
  return model === "ray-flash-2" ? "luma-ray-flash-2" : "luma-ray-2";
}

// In-memory hint so getTaskStatus knows which transport produced a given
// task ID. This is a best-effort cache; on cache miss we fall back to
// trying the direct transport first and then Atlas on failure.
const atlasTaskIds = new Set<string>();

function rememberAtlasTask(taskId: string) {
  atlasTaskIds.add(taskId);
  if (atlasTaskIds.size > 5000) {
    const first = atlasTaskIds.values().next().value;
    if (first) atlasTaskIds.delete(first);
  }
}

interface AtlasUploadResponse {
  url?: string;
  data?: { url?: string };
}

async function uploadImageToAtlas(imageUrl: string): Promise<string> {
  await assertSafeFetchUrl(imageUrl);
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`Failed to fetch source image for Atlas upload: ${imgRes.status}`);
  }
  const contentType = imgRes.headers.get("content-type") || "image/jpeg";
  const buf = Buffer.from(await imgRes.arrayBuffer());

  const form = new FormData();
  const blob = new Blob([buf], { type: contentType });
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  form.append("file", blob, `source.${ext}`);

  const res = await fetch(`${ATLAS_API_BASE}/model/uploadMedia`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.ATLAS_API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Atlas uploadMedia error ${res.status}: ${text}`);
  }
  const data = (await res.json().catch(() => ({}))) as AtlasUploadResponse;
  const url = data.url || data.data?.url;
  if (!url) {
    throw new Error("Atlas uploadMedia did not return a URL");
  }
  return url;
}

interface CreateVideoOptions {
  model?: LumaModel;
  aspectRatio?: LumaAspectRatio;
  duration?: string;
  loop?: boolean;
  keyframeImageUrl?: string;
}

interface DirectGenerateResponse {
  id?: string;
}

interface DirectStatusResponse {
  state?: string;
  assets?: { video?: string };
  failure_reason?: string;
}

interface AtlasGenerateResponse {
  id?: string;
  data?: { id?: string };
}

interface AtlasOutputObject {
  url?: string;
  video_url?: string;
  video?: string;
}

interface AtlasPredictionInner {
  status?: string;
  outputs?: unknown;
  output?: unknown;
  result?: unknown;
  error?: string | { message?: string };
  message?: string;
}

interface AtlasPredictionResponse {
  status?: string;
  outputs?: unknown;
  output?: unknown;
  result?: unknown;
  error?: string | { message?: string };
  message?: string;
  data?: AtlasPredictionInner;
}

async function createVideoTaskDirect(
  prompt: string,
  options: CreateVideoOptions
): Promise<LumaTaskResult> {
  const body: Record<string, unknown> = {
    prompt,
    model: options.model || "ray-2",
  };
  if (options.aspectRatio) body.aspect_ratio = options.aspectRatio;
  if (options.duration) body.duration = options.duration;
  if (options.loop !== undefined) body.loop = options.loop;
  if (options.keyframeImageUrl) {
    body.keyframes = {
      frame0: { type: "image", url: options.keyframeImageUrl },
    };
  }

  const response = await fetch(`${LUMA_API_BASE}/generations`, {
    method: "POST",
    headers: directAuthHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Luma API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as DirectGenerateResponse;
  console.log("[Luma] generate response:", JSON.stringify(data));

  if (!data.id) {
    throw new Error("Luma API did not return a generation ID");
  }
  return { taskId: data.id };
}

async function createVideoTaskAtlas(
  prompt: string,
  options: CreateVideoOptions
): Promise<LumaTaskResult> {
  const model: LumaModel = options.model || "ray-2";
  const body: Record<string, unknown> = {
    model: atlasModelFor(model),
    prompt,
  };
  if (options.aspectRatio) body.aspect_ratio = options.aspectRatio;
  if (options.duration) body.duration = options.duration;
  if (options.loop !== undefined) body.loop = options.loop;

  if (options.keyframeImageUrl) {
    // Per Atlas docs, image-to-video requires an Atlas-hosted URL via uploadMedia.
    body.image_url = await uploadImageToAtlas(options.keyframeImageUrl);
  }

  const response = await fetch(`${ATLAS_API_BASE}/model/generateVideo`, {
    method: "POST",
    headers: atlasAuthHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Luma (via Atlas) API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as AtlasGenerateResponse;
  console.log("[Luma/Atlas] generate response:", JSON.stringify(data));

  const taskId = data.data?.id || data.id;
  if (!taskId) {
    throw new Error("Atlas Cloud did not return a prediction ID");
  }
  rememberAtlasTask(taskId);
  return { taskId };
}

export async function createVideoTask(
  prompt: string,
  options: CreateVideoOptions = {}
): Promise<LumaTaskResult> {
  const model = options.model || "ray-2";

  // Prefer direct Luma when its key is set; on any failure (e.g. invalid
  // key, transient outage), fall back to Atlas Cloud if available.
  if (hasDirectKey()) {
    try {
      console.log(
        `🎬 [Luma] Creating video task via direct: prompt="${prompt.substring(0, 80)}..." model=${model} aspect=${options.aspectRatio || "default"}`
      );
      return await createVideoTaskDirect(prompt, options);
    } catch (err) {
      if (!hasAtlasKey()) throw err;
      console.warn(
        `⚠️ [Luma] Direct transport failed (${(err as Error).message}); falling back to atlas`
      );
    }
  }

  if (!hasAtlasKey()) throw noTransportError();

  console.log(
    `🎬 [Luma] Creating video task via atlas: prompt="${prompt.substring(0, 80)}..." model=${model} aspect=${options.aspectRatio || "default"}`
  );
  return createVideoTaskAtlas(prompt, options);
}

async function getTaskStatusDirect(taskId: string): Promise<LumaStatusResult> {
  const response = await fetch(`${LUMA_API_BASE}/generations/${encodeURIComponent(taskId)}`, {
    method: "GET",
    headers: directAuthHeaders(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Luma status error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as DirectStatusResponse;
  const state = data.state;

  if (state === "completed") {
    const videoUrl = data.assets?.video;
    if (videoUrl) return { status: "completed", videoUrl };
    return {
      status: "failed",
      error: "Video generation completed but no video URL was returned.",
    };
  }
  if (state === "failed") {
    return { status: "failed", error: data.failure_reason || "Video generation failed" };
  }
  if (state === "dreaming") return { status: "processing" };
  return { status: "pending" };
}

function extractAtlasVideoUrl(output: unknown): string | undefined {
  if (!output) return undefined;
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    const first = output[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") {
      const o = first as AtlasOutputObject;
      return o.url || o.video_url || o.video || undefined;
    }
    return undefined;
  }
  if (typeof output === "object") {
    const o = output as AtlasOutputObject;
    return o.url || o.video_url || o.video || undefined;
  }
  return undefined;
}

async function getTaskStatusAtlas(taskId: string): Promise<LumaStatusResult> {
  const response = await fetch(
    `${ATLAS_API_BASE}/model/prediction/${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: atlasAuthHeaders(),
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Luma (via Atlas) status error ${response.status}: ${text}`);
  }

  const raw = (await response.json()) as AtlasPredictionResponse;
  const inner: AtlasPredictionInner = raw.data ?? raw;
  const state = String(inner.status || "").toLowerCase();

  if (state === "completed" || state === "succeeded" || state === "success") {
    const videoUrl =
      extractAtlasVideoUrl(inner.outputs) ||
      extractAtlasVideoUrl(inner.output) ||
      extractAtlasVideoUrl(inner.result);
    if (videoUrl) return { status: "completed", videoUrl };
    return {
      status: "failed",
      error: "Video generation completed but no video URL was returned.",
    };
  }
  if (state === "failed" || state === "error" || state === "cancelled" || state === "canceled") {
    const errMsg =
      (typeof inner.error === "string" && inner.error) ||
      (typeof inner.error === "object" && inner.error?.message) ||
      inner.message ||
      "Video generation failed";
    return { status: "failed", error: errMsg };
  }
  if (
    state === "running" ||
    state === "processing" ||
    state === "in_progress" ||
    state === "started"
  ) {
    return { status: "processing" };
  }
  return { status: "pending" };
}

export async function getTaskStatus(taskId: string): Promise<LumaStatusResult> {
  // If we know this task was created via Atlas, route to Atlas directly.
  if (atlasTaskIds.has(taskId)) {
    return getTaskStatusAtlas(taskId);
  }

  // Otherwise prefer direct Luma when available; on failure fall back to
  // Atlas. This handles both unknown task origin (e.g. after a process
  // restart) and invalid direct keys.
  if (hasDirectKey()) {
    try {
      return await getTaskStatusDirect(taskId);
    } catch (err) {
      if (!hasAtlasKey()) throw err;
      console.warn(
        `⚠️ [Luma] Direct status failed (${(err as Error).message}); falling back to atlas`
      );
      const result = await getTaskStatusAtlas(taskId);
      rememberAtlasTask(taskId);
      return result;
    }
  }

  if (!hasAtlasKey()) throw noTransportError();
  return getTaskStatusAtlas(taskId);
}

export const lumaService = {
  createVideoTask,
  getTaskStatus,
  createLumaBatch,
  getLumaBatch,
  updateLumaBatch,
  deleteLumaBatch,
};
