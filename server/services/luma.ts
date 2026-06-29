import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { S3UploadService } from "./s3Upload";

const LUMA_API_BASE = "https://api.lumalabs.ai/dream-machine/v1";
const LUMA_CREDITS_URL = "https://lumalabs.ai/api/keys";

function normalizeLumaErrorMessage(status: number, text: string): string {
  const lower = text.toLowerCase();
  const looksLikeCreditsOrQuota =
    status === 402 ||
    status === 429 ||
    lower.includes("quota") ||
    lower.includes("credit") ||
    lower.includes("insufficient") ||
    lower.includes("payment") ||
    lower.includes("billing") ||
    lower.includes("resource_exhausted");

  if (looksLikeCreditsOrQuota) {
    return `Luma credits/quota exhausted. Please add more credits in your Luma account: ${LUMA_CREDITS_URL}`;
  }

  return `Luma API error ${status}: ${text}`;
}

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
export type LumaAspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | "9:21" | "21:9";
export type LumaResolution = "540p" | "720p" | "1080p" | "4k";
export type LumaStatus = "dreaming" | "completed" | "failed";

export interface LumaConcept {
  key: string;
  label?: string;
}

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

function noTransportError(): Error {
  return new Error(
    "No Luma transport configured. Set LUMA_API_KEY for direct access."
  );
}

function directAuthHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.LUMA_API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function isDataUri(url: string): boolean {
  return /^data:/i.test(url);
}

function decodeDataUri(dataUri: string): { buffer: Buffer; contentType: string } {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/i.exec(dataUri);
  if (!match) {
    throw new Error("Invalid data URI for keyframe image");
  }
  const contentType = match[1] || "image/jpeg";
  const isBase64 = !!match[2];
  const data = match[3] || "";
  const buffer = isBase64
    ? Buffer.from(data, "base64")
    : Buffer.from(decodeURIComponent(data), "utf8");
  return { buffer, contentType };
}

const s3 = new S3UploadService();

// Luma image-to-video needs a publicly reachable frame URL. The board sends
// the selected frame as a base64 data: URI, which Luma can't fetch. Decode it
// and host it on S3, returning the public URL. Already-hosted http(s) URLs are
// passed straight through for Luma to fetch.
async function hostKeyframeImage(imageUrl: string): Promise<string> {
  if (!isDataUri(imageUrl)) {
    return imageUrl;
  }
  const { buffer, contentType } = decodeDataUri(imageUrl);
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
    ? "webp"
    : "jpg";
  const key = `luma-keyframes/${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
  return s3.uploadBuffer(buffer, key, contentType);
}

interface CreateVideoOptions {
  model?: LumaModel;
  aspectRatio?: LumaAspectRatio;
  resolution?: LumaResolution;
  duration?: string;
  loop?: boolean;
  concepts?: string[];
  callbackUrl?: string;
  keyframeImageUrl?: string;
}

const lumaTaskStatusCache = new Map<string, LumaStatusResult>();

function normalizeConcepts(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const entry of raw) {
    const value = typeof entry === "string"
      ? entry
      : (entry && typeof entry === "object" && "key" in entry ? (entry as { key?: unknown }).key : undefined);
    if (typeof value !== "string") continue;
    const key = value.trim();
    if (!key) continue;
    out.push(key);
  }
  return Array.from(new Set(out));
}

function statusFromGenerationPayload(raw: unknown): { taskId?: string; status: LumaStatusResult } {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const taskId = typeof obj.id === "string" ? obj.id : undefined;
  const state = typeof obj.state === "string" ? obj.state : "";
  const failureReason = typeof obj.failure_reason === "string" ? obj.failure_reason : undefined;
  const assets = obj.assets && typeof obj.assets === "object"
    ? (obj.assets as Record<string, unknown>)
    : null;
  const videoUrl = assets && typeof assets.video === "string" ? assets.video : undefined;

  if (state === "completed") {
    if (videoUrl) return { taskId, status: { status: "completed", videoUrl } };
    return {
      taskId,
      status: {
        status: "failed",
        error: "Video generation completed but no video URL was returned.",
      },
    };
  }
  if (state === "failed") {
    return { taskId, status: { status: "failed", error: failureReason || "Video generation failed" } };
  }
  if (state === "dreaming") {
    return { taskId, status: { status: "processing" } };
  }
  return { taskId, status: { status: "pending" } };
}

interface DirectGenerateResponse {
  id?: string;
}

interface DirectStatusResponse {
  state?: string;
  assets?: { video?: string };
  failure_reason?: string;
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
  if (options.resolution) body.resolution = options.resolution;
  if (options.duration) body.duration = options.duration;
  if (options.loop !== undefined) body.loop = options.loop;
  const concepts = normalizeConcepts(options.concepts);
  if (concepts.length > 0) {
    body.concepts = concepts.map((key) => ({ key }));
  }
  if (options.callbackUrl) body.callback_url = options.callbackUrl;
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
    throw new Error(normalizeLumaErrorMessage(response.status, text));
  }

  const data = (await response.json()) as DirectGenerateResponse;
  console.log("[Luma] generate response:", JSON.stringify(data));

  if (!data.id) {
    throw new Error("Luma API did not return a generation ID");
  }
  return { taskId: data.id };
}

export async function createVideoTask(
  prompt: string,
  options: CreateVideoOptions = {}
): Promise<LumaTaskResult> {
  const model = options.model || "ray-2";

  if (!hasDirectKey()) throw noTransportError();

  // Image-to-video needs a publicly reachable frame URL. The board sends the
  // selected image as a base64 data: URI, which Luma can't fetch — host it on
  // S3 first and pass that URL to Luma. Hosted http(s) URLs pass through.
  if (options.keyframeImageUrl) {
    options = {
      ...options,
      keyframeImageUrl: await hostKeyframeImage(options.keyframeImageUrl),
    };
  }

  console.log(
    `🎬 [Luma] Creating video task: prompt="${prompt.substring(0, 80)}..." model=${model} aspect=${options.aspectRatio || "default"}`
  );
  return createVideoTaskDirect(prompt, options);
}

async function getTaskStatusDirect(taskId: string): Promise<LumaStatusResult> {
  const response = await fetch(`${LUMA_API_BASE}/generations/${encodeURIComponent(taskId)}`, {
    method: "GET",
    headers: directAuthHeaders(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(normalizeLumaErrorMessage(response.status, text));
  }

  const data = (await response.json()) as DirectStatusResponse;
  const normalized = statusFromGenerationPayload(data).status;
  lumaTaskStatusCache.set(taskId, normalized);
  return normalized;
}

export async function getTaskStatus(taskId: string): Promise<LumaStatusResult> {
  if (!hasDirectKey()) throw noTransportError();
  const cached = lumaTaskStatusCache.get(taskId);
  if (cached && (cached.status === "completed" || cached.status === "failed")) {
    return cached;
  }
  return getTaskStatusDirect(taskId);
}

export function ingestGenerationCallback(payload: unknown): void {
  const normalized = statusFromGenerationPayload(payload);
  if (!normalized.taskId) return;
  lumaTaskStatusCache.set(normalized.taskId, normalized.status);
}

export async function listConcepts(): Promise<LumaConcept[]> {
  if (!hasDirectKey()) throw noTransportError();
  const response = await fetch(`${LUMA_API_BASE}/generations/concepts/list`, {
    method: "GET",
    headers: directAuthHeaders(),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(normalizeLumaErrorMessage(response.status, text));
  }
  const data = await response.json().catch(() => ({}));
  const listRaw = Array.isArray(data)
    ? data
    : (data && typeof data === "object" && Array.isArray((data as { concepts?: unknown }).concepts)
      ? (data as { concepts: unknown[] }).concepts
      : []);
  return listRaw
    .map((entry) => {
      if (typeof entry === "string") return { key: entry };
      if (!entry || typeof entry !== "object") return null;
      const key = typeof (entry as { key?: unknown }).key === "string"
        ? String((entry as { key: unknown }).key)
        : "";
      if (!key.trim()) return null;
      const label = typeof (entry as { label?: unknown }).label === "string"
        ? String((entry as { label: unknown }).label)
        : undefined;
      return { key, label };
    })
    .filter((item): item is LumaConcept => !!item);
}

export async function listCameraMotions(): Promise<string[]> {
  if (!hasDirectKey()) throw noTransportError();
  const response = await fetch(`${LUMA_API_BASE}/generations/camera_motion/list`, {
    method: "GET",
    headers: directAuthHeaders(),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(normalizeLumaErrorMessage(response.status, text));
  }
  const data = await response.json().catch(() => ({}));
  const listRaw = Array.isArray(data)
    ? data
    : (data && typeof data === "object"
      ? ((data as { camera_motions?: unknown }).camera_motions
        ?? (data as { cameraMotions?: unknown }).cameraMotions
        ?? (data as { motions?: unknown }).motions)
      : undefined);
  if (!Array.isArray(listRaw)) return [];
  return listRaw
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export const lumaService = {
  createVideoTask,
  getTaskStatus,
  ingestGenerationCallback,
  listConcepts,
  listCameraMotions,
  createLumaBatch,
  getLumaBatch,
  updateLumaBatch,
  deleteLumaBatch,
};
