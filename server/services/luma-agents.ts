// Luma Agents (UNI-1) image generation + editing service.
//
// This is a SEPARATE Luma product from the Dream Machine video API wired up
// in `server/services/luma.ts`. UNI-1 is image-only and uses its own base
// URL and its own API key (LUMA_AGENTS_API_KEY). Do NOT cross the wires.
//
// API surface used here:
//   POST  https://agents.lumalabs.ai/v1/generations   { prompt, model, type, ... }
//   GET   https://agents.lumalabs.ai/v1/generations/:id
// Generations return a presigned image URL that expires ~1 hour after
// creation, so we eagerly download the bytes and re-host them through the
// app's standard public object storage.

import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { persistImageBufferPublic } from "../objectStorage";

const LUMA_AGENTS_BASE = "https://agents.lumalabs.ai/v1";

export type LumaAgentsModel = "uni-1" | "uni-1-max";

// The 9 aspect ratios documented for UNI-1.
export type LumaAgentsAspectRatio =
  | "1:1"
  | "16:9"
  | "9:16"
  | "4:3"
  | "3:4"
  | "4:5"
  | "5:4"
  | "3:2"
  | "2:3";

export type LumaAgentsStyle = "photoreal" | "illustration" | "manga";
export type LumaAgentsOutputFormat = "png" | "jpeg" | "webp";

const SUPPORTED_RATIOS: LumaAgentsAspectRatio[] = [
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "4:5",
  "5:4",
  "3:2",
  "2:3",
];

// Map app-side aspect-ratio strings to the closest UNI-1 supported ratio.
// Anything we don't recognize falls back to 1:1.
export function mapAspectRatio(input?: string | null): LumaAgentsAspectRatio {
  if (!input) return "1:1";
  const normalized = input.trim();
  if ((SUPPORTED_RATIOS as string[]).includes(normalized)) {
    return normalized as LumaAgentsAspectRatio;
  }
  // Common aliases we've seen elsewhere in the app.
  switch (normalized) {
    case "square":
      return "1:1";
    case "landscape":
    case "wide":
      return "16:9";
    case "portrait":
    case "tall":
      return "9:16";
    case "story":
      return "9:16";
    default:
      // Try a numeric-ratio approximation: pick the supported ratio with the
      // smallest |w/h - target| distance.
      const m = /^(\d+(?:\.\d+)?)[:x\/](\d+(?:\.\d+)?)$/.exec(normalized);
      if (m) {
        const target = Number(m[1]) / Number(m[2]);
        if (Number.isFinite(target) && target > 0) {
          let best: LumaAgentsAspectRatio = "1:1";
          let bestDist = Infinity;
          for (const r of SUPPORTED_RATIOS) {
            const [w, h] = r.split(":").map(Number);
            const dist = Math.abs(w / h - target);
            if (dist < bestDist) {
              bestDist = dist;
              best = r;
            }
          }
          return best;
        }
      }
      return "1:1";
  }
}

const PORTRAIT_RATIOS = new Set<LumaAgentsAspectRatio>([
  "9:16",
  "3:4",
  "4:5",
  "2:3",
]);

// Manga style is documented as portrait-only (the API will 422 otherwise).
// Snap landscape / square requests to the closest portrait ratio.
export function enforceMangaPortrait(
  ratio: LumaAgentsAspectRatio,
  style?: LumaAgentsStyle,
): LumaAgentsAspectRatio {
  if (style !== "manga") return ratio;
  if (PORTRAIT_RATIOS.has(ratio)) return ratio;
  switch (ratio) {
    case "16:9":
      return "9:16";
    case "3:2":
      return "2:3";
    case "5:4":
      return "4:5";
    case "4:3":
      return "3:4";
    default:
      return "9:16";
  }
}

// Per the docs UNI-1 accepts up to 9 reference images for text→image, and up
// to 8 reference images plus a `source` for image-edit.
const MAX_T2I_REFS = 9;
const MAX_EDIT_REFS = 8;

function authHeaders(): Record<string, string> {
  const key = process.env.LUMA_AGENTS_API_KEY;
  if (!key) {
    throw new Error(
      "Luma Agents not configured: LUMA_AGENTS_API_KEY is not set",
    );
  }
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export function isConfigured(): boolean {
  return Boolean(process.env.LUMA_AGENTS_API_KEY);
}

// ---------------------------------------------------------------------------
// SSRF-safe URL fetcher (mirrors helpers in services/luma.ts so we don't have
// to cross-import).
// ---------------------------------------------------------------------------
function isPrivateOrReservedIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (family === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80:")) return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("ff")) return true;
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
    throw new Error(
      `Refusing to fetch image with unsupported protocol: ${parsed.protocol}`,
    );
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
      throw new Error(
        `Refusing to fetch image from private/reserved address: ${addr.address}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Request shapes
// ---------------------------------------------------------------------------
export interface GenerateImageInput {
  prompt: string;
  model?: LumaAgentsModel;
  aspectRatio?: string | null;
  referenceImageUrls?: string[];
  style?: LumaAgentsStyle;
  outputFormat?: LumaAgentsOutputFormat;
  webSearch?: boolean;
}

export interface EditImageInput {
  prompt: string;
  source: string;
  referenceImageUrls?: string[];
  model?: LumaAgentsModel;
  aspectRatio?: string | null;
  style?: LumaAgentsStyle;
  outputFormat?: LumaAgentsOutputFormat;
}

interface LumaAgentsCreateResponse {
  id?: string;
  state?: string;
  assets?: { image?: string };
  failure_reason?: string;
}

interface LumaAgentsStatusResponse {
  id?: string;
  state?: string;
  assets?: { image?: string };
  image?: { url?: string };
  failure_reason?: string;
}

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 90 * 1000;

async function postGeneration(
  body: Record<string, unknown>,
): Promise<LumaAgentsCreateResponse> {
  const res = await fetch(`${LUMA_AGENTS_BASE}/generations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Surface 401/403 verbatim so the boards-chat classifier can mark the
    // provider down for 30 minutes instead of retrying every request.
    throw new Error(`Luma Agents API ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as LumaAgentsCreateResponse;
}

async function getGeneration(id: string): Promise<LumaAgentsStatusResponse> {
  const res = await fetch(
    `${LUMA_AGENTS_BASE}/generations/${encodeURIComponent(id)}`,
    {
      method: "GET",
      headers: authHeaders(),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Luma Agents status ${res.status}: ${text || res.statusText}`,
    );
  }
  return (await res.json()) as LumaAgentsStatusResponse;
}

function pickImageUrl(resp: LumaAgentsStatusResponse): string | undefined {
  return resp.assets?.image || resp.image?.url || undefined;
}

async function awaitGeneration(initial: LumaAgentsCreateResponse): Promise<string> {
  // Some Luma Agents responses include the asset inline; honor that fast-path.
  const inlineUrl = pickImageUrl(initial as LumaAgentsStatusResponse);
  const state = (initial.state || "").toLowerCase();
  if (inlineUrl && (state === "completed" || state === "")) {
    return inlineUrl;
  }
  if (state === "failed") {
    throw new Error(initial.failure_reason || "Luma Agents generation failed");
  }
  if (!initial.id) {
    throw new Error("Luma Agents did not return a generation id");
  }
  const id = initial.id;
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const status = await getGeneration(id);
    const s = (status.state || "").toLowerCase();
    if (s === "completed" || s === "succeeded" || s === "success") {
      const url = pickImageUrl(status);
      if (url) return url;
      throw new Error("Luma Agents completed without an image URL");
    }
    if (s === "failed" || s === "error" || s === "cancelled" || s === "canceled") {
      throw new Error(status.failure_reason || "Luma Agents generation failed");
    }
  }
  throw new Error("Luma Agents generation timed out");
}

async function downloadAndPersist(remoteUrl: string): Promise<string> {
  await assertSafeFetchUrl(remoteUrl);
  const res = await fetch(remoteUrl);
  if (!res.ok) {
    throw new Error(
      `Failed to download Luma Agents image (${res.status}) — presigned URL may have expired`,
    );
  }
  const contentType = res.headers.get("content-type") || "image/png";
  const ext = contentType.includes("jpeg")
    ? "jpg"
    : contentType.includes("webp")
      ? "webp"
      : "png";
  const buf = Buffer.from(await res.arrayBuffer());
  const filename = `luma-uni-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const stored = await persistImageBufferPublic(buf, filename, contentType);
  if (stored) return stored;
  // Fallback to a base64 data URL so the user still gets a result if storage
  // is unavailable.
  return `data:${contentType};base64,${buf.toString("base64")}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function generateImage(input: GenerateImageInput): Promise<string> {
  const model: LumaAgentsModel = input.model || "uni-1";
  const ratio = enforceMangaPortrait(
    mapAspectRatio(input.aspectRatio),
    input.style,
  );
  const refs = (input.referenceImageUrls || []).slice(0, MAX_T2I_REFS);
  const body: Record<string, unknown> = {
    prompt: input.prompt,
    model,
    type: "image",
    aspect_ratio: ratio,
  };
  if (refs.length > 0) body.image_ref = refs;
  if (input.style) body.style = input.style;
  if (input.outputFormat) body.output_format = input.outputFormat;
  if (input.webSearch) body.web_search = true;

  const created = await postGeneration(body);
  const remoteUrl = await awaitGeneration(created);
  return downloadAndPersist(remoteUrl);
}

export async function editImage(input: EditImageInput): Promise<string> {
  const model: LumaAgentsModel = input.model || "uni-1";
  const ratio = enforceMangaPortrait(
    mapAspectRatio(input.aspectRatio),
    input.style,
  );
  const refs = (input.referenceImageUrls || []).slice(0, MAX_EDIT_REFS);
  const body: Record<string, unknown> = {
    prompt: input.prompt,
    model,
    type: "image_edit",
    aspect_ratio: ratio,
    source: input.source,
  };
  if (refs.length > 0) body.image_ref = refs;
  if (input.style) body.style = input.style;
  if (input.outputFormat) body.output_format = input.outputFormat;

  const created = await postGeneration(body);
  const remoteUrl = await awaitGeneration(created);
  return downloadAndPersist(remoteUrl);
}

export interface LumaAgentsService {
  generateImage(input: GenerateImageInput): Promise<string>;
  editImage(input: EditImageInput): Promise<string>;
  isConfigured(): boolean;
}

export const lumaAgentsService: LumaAgentsService = {
  generateImage,
  editImage,
  isConfigured,
};

// Test seam: export the mappers for direct unit testing.
export const __testing = {
  mapAspectRatio,
  enforceMangaPortrait,
  pickImageUrl,
};
