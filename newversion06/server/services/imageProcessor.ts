import sharp from "sharp";

const MAX_DIMENSION = 4096;
const TARGET_FILE_SIZE = 5 * 1024 * 1024;
const QUALITY_STEPS = [90, 80, 70, 60, 50];

interface ProcessedImage {
  buffer: Buffer;
  contentType: string;
  width: number;
  height: number;
  originalSize: number;
  processedSize: number;
}

export async function isDecodableImage(input: Buffer): Promise<boolean> {
  try {
    const metadata = await sharp(input, { failOn: "none" }).metadata();
    return !!(metadata.width && metadata.height && metadata.format);
  } catch {
    return false;
  }
}

export async function processImage(
  input: Buffer,
  options?: {
    maxDimension?: number;
    targetFileSize?: number;
    forceFormat?: "jpeg" | "png" | "webp";
  }
): Promise<ProcessedImage> {
  const maxDim = options?.maxDimension ?? MAX_DIMENSION;
  const targetSize = options?.targetFileSize ?? TARGET_FILE_SIZE;
  const originalSize = input.length;

  const metadata = await sharp(input, { failOn: "none" }).metadata();
  const origWidth = metadata.width || 0;
  const origHeight = metadata.height || 0;
  const inputFormat = metadata.format;

  if (!origWidth || !origHeight || !inputFormat) {
    throw new Error("Cannot decode image: invalid or unsupported format");
  }

  const needsResize = origWidth > maxDim || origHeight > maxDim;
  const belowTarget = originalSize <= targetSize;

  if (!needsResize && belowTarget && !options?.forceFormat) {
    console.log(
      `🖼️ [ImageProcessor] ${origWidth}x${origHeight} (${(originalSize / 1024 / 1024).toFixed(1)}MB) — no processing needed`
    );
    const contentType = metadata.format === "png" ? "image/png"
      : metadata.format === "webp" ? "image/webp"
      : metadata.format === "gif" ? "image/gif"
      : "image/jpeg";
    return {
      buffer: input,
      contentType,
      width: origWidth,
      height: origHeight,
      originalSize,
      processedSize: originalSize,
    };
  }

  const hasAlpha = metadata.hasAlpha === true;
  const outputFormat =
    options?.forceFormat ||
    (hasAlpha && (inputFormat === "png" || inputFormat === "gif") ? "png" : "jpeg");

  let pipeline = sharp(input, { failOn: "none" }).rotate();

  if (needsResize) {
    pipeline = pipeline.resize(maxDim, maxDim, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  if (outputFormat === "png") {
    pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
  } else if (outputFormat === "webp") {
    pipeline = pipeline.webp({ quality: 85 });
  } else {
    pipeline = pipeline.jpeg({ quality: 90, mozjpeg: true });
  }

  let result = await pipeline.toBuffer({ resolveWithObject: true });

  if (result.data.length > targetSize) {
    for (const q of QUALITY_STEPS) {
      let retryPipeline = sharp(input, { failOn: "none" }).rotate();

      if (needsResize) {
        retryPipeline = retryPipeline.resize(maxDim, maxDim, {
          fit: "inside",
          withoutEnlargement: true,
        });
      }

      if (outputFormat === "png") {
        retryPipeline = retryPipeline.jpeg({ quality: q, mozjpeg: true });
      } else if (outputFormat === "webp") {
        retryPipeline = retryPipeline.webp({ quality: q });
      } else {
        retryPipeline = retryPipeline.jpeg({ quality: q, mozjpeg: true });
      }

      result = await retryPipeline.toBuffer({ resolveWithObject: true });
      if (result.data.length <= targetSize) {
        if (outputFormat === "png") {
          return {
            buffer: result.data,
            contentType: "image/jpeg",
            width: result.info.width,
            height: result.info.height,
            originalSize,
            processedSize: result.data.length,
          };
        }
        break;
      }
    }

    if (result.data.length > targetSize) {
      const scaleFactor = Math.sqrt(targetSize / result.data.length);
      const newWidth = Math.round((result.info.width || origWidth) * scaleFactor);
      let finalPipeline = sharp(input, { failOn: "none" }).rotate();
      finalPipeline = finalPipeline.resize(newWidth, null, {
        fit: "inside",
        withoutEnlargement: true,
      });
      finalPipeline = finalPipeline.jpeg({ quality: 50, mozjpeg: true });

      result = await finalPipeline.toBuffer({ resolveWithObject: true });

      console.log(
        `🖼️ [ImageProcessor] ${origWidth}x${origHeight} (${(originalSize / 1024 / 1024).toFixed(1)}MB) → ${result.info.width}x${result.info.height} (${(result.data.length / 1024 / 1024).toFixed(1)}MB) [jpeg, aggressive]`
      );

      return {
        buffer: result.data,
        contentType: "image/jpeg",
        width: result.info.width,
        height: result.info.height,
        originalSize,
        processedSize: result.data.length,
      };
    }
  }

  const contentType =
    outputFormat === "png"
      ? "image/png"
      : outputFormat === "webp"
        ? "image/webp"
        : "image/jpeg";

  console.log(
    `🖼️ [ImageProcessor] ${origWidth}x${origHeight} (${(originalSize / 1024 / 1024).toFixed(1)}MB) → ${result.info.width}x${result.info.height} (${(result.data.length / 1024 / 1024).toFixed(1)}MB) [${outputFormat}]`
  );

  return {
    buffer: result.data,
    contentType,
    width: result.info.width,
    height: result.info.height,
    originalSize,
    processedSize: result.data.length,
  };
}

const API_SAFE_MIMETYPES = new Set(["image/jpeg", "image/png"]);
const UNSUPPORTED_EXTENSIONS = new Set([".webp", ".avif", ".heic", ".heif", ".tiff", ".tif", ".bmp", ".gif"]);

export interface ApiSafeImage {
  buffer: Buffer;
  contentType: string;
  converted: boolean;
}

const HEIC_MIMETYPES = new Set(["image/heic", "image/heif"]);
const HEIC_EXTENSIONS = new Set([".heic", ".heif"]);

async function convertHeicToJpeg(input: Buffer): Promise<Buffer | null> {
  try {
    const heicConvert = (await import("heic-convert")).default;
    const outputBuffer = await heicConvert({
      buffer: input,
      format: "JPEG",
      quality: 0.95,
    });
    console.log(`🔄 [ensureApiSafeFormat] HEIC converted via heic-convert (${input.length} → ${outputBuffer.byteLength} bytes)`);
    return Buffer.from(outputBuffer);
  } catch (heicErr: any) {
    console.warn(`⚠️ [ensureApiSafeFormat] heic-convert failed: ${heicErr?.message}, falling back to sharp`);
    return null;
  }
}

export async function ensureApiSafeFormat(
  input: Buffer,
  declaredMimeType?: string,
  originalFilename?: string
): Promise<ApiSafeImage> {
  const ext = originalFilename
    ? "." + originalFilename.split(".").pop()!.toLowerCase()
    : "";

  const mimeNormalized = (declaredMimeType || "").toLowerCase();

  const isHeic =
    HEIC_MIMETYPES.has(mimeNormalized) || HEIC_EXTENSIONS.has(ext);

  if (isHeic) {
    const heicResult = await convertHeicToJpeg(input);
    if (heicResult) {
      return { buffer: heicResult, contentType: "image/jpeg", converted: true };
    }
  }

  const metadata = await sharp(input, { failOn: "none" }).metadata();
  const detectedFormat = metadata.format;

  const isSafeByMime = API_SAFE_MIMETYPES.has(mimeNormalized);
  const isSafeByFormat =
    detectedFormat === "jpeg" || detectedFormat === "jpg" || detectedFormat === "png";
  const hasUnsupportedExt = UNSUPPORTED_EXTENSIONS.has(ext);

  if (isSafeByMime && isSafeByFormat && !hasUnsupportedExt) {
    return { buffer: input, contentType: mimeNormalized, converted: false };
  }

  const hasAlpha = metadata.hasAlpha === true;
  const usePng = hasAlpha && (detectedFormat === "png" || detectedFormat === "gif");

  let pipeline = sharp(input, { failOn: "none" }).rotate();

  if (usePng) {
    pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
  } else {
    pipeline = pipeline.jpeg({ quality: 95, mozjpeg: true });
  }

  const result = await pipeline.toBuffer();
  const outputContentType = usePng ? "image/png" : "image/jpeg";

  console.log(
    `🔄 [ensureApiSafeFormat] Converted from ${detectedFormat || mimeNormalized} → ${outputContentType} (${input.length} → ${result.length} bytes)`
  );

  return { buffer: result, contentType: outputContentType, converted: true };
}

const SAFE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);

/**
 * Best-effort SSRF guard for outbound URL fetches.
 * Rejects: non-http(s), URLs with credentials, IP-literal hosts that resolve
 * to private/loopback/link-local/multicast/reserved ranges. DNS-based hosts
 * are still permitted (full DNS-rebinding protection would require a custom
 * agent that re-checks resolved IPs); this guards the common SSRF attempts
 * via raw IP literals or localhost references.
 */
function isSafeOutboundUrl(rawUrl: string): { ok: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "invalid URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: `unsupported protocol ${parsed.protocol}` };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "URL contains credentials" };
  }
  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) return { ok: false, reason: "missing host" };

  const blockedNames = new Set([
    "localhost",
    "ip6-localhost",
    "ip6-loopback",
    "metadata.google.internal",
  ]);
  if (blockedNames.has(hostname)) {
    return { ok: false, reason: `blocked host ${hostname}` };
  }

  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1, 5).map((n) => parseInt(n, 10));
    if (octets.some((o) => o < 0 || o > 255)) {
      return { ok: false, reason: "invalid IPv4" };
    }
    const [a, b] = octets;
    const isPrivate =
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) || // link-local
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      a === 0 ||
      a >= 224; // multicast/reserved
    if (isPrivate) {
      return { ok: false, reason: `blocked IPv4 ${hostname}` };
    }
  }

  // Block IPv6 loopback, link-local, ULA, and unspecified
  if (hostname.includes(":")) {
    const ipv6 = hostname.startsWith("[") ? hostname.slice(1, -1) : hostname;
    const lower = ipv6.toLowerCase();
    if (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fe80:") ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("ff") // multicast
    ) {
      return { ok: false, reason: `blocked IPv6 ${hostname}` };
    }
  }

  return { ok: true };
}

function getUrlExtension(url: string): string {
  try {
    const u = new URL(url, "http://placeholder.local");
    const last = u.pathname.split("/").pop() || "";
    const dotIdx = last.lastIndexOf(".");
    return dotIdx >= 0 ? last.slice(dotIdx).toLowerCase() : "";
  } catch {
    const noQuery = url.split("?")[0];
    const last = noQuery.split("/").pop() || "";
    const dotIdx = last.lastIndexOf(".");
    return dotIdx >= 0 ? last.slice(dotIdx).toLowerCase() : "";
  }
}

/**
 * Ensures an image URL points to an API-safe format (JPEG/PNG) suitable for
 * Meta Graph API (Facebook/Instagram) and similar third-party APIs that fetch
 * images by URL. If the URL points to an unsupported format (WebP, AVIF, HEIC,
 * etc.), the image is downloaded, converted via ensureApiSafeFormat, re-uploaded
 * to public object storage, and a new URL is returned.
 *
 * If conversion is not needed, the original URL is returned unchanged.
 * If conversion fails for any reason, the original URL is returned (best-effort)
 * and a warning is logged so the caller can still attempt the upstream post.
 */
export async function ensureApiSafeImageUrl(
  imageUrl: string,
  options?: { baseUrl?: string }
): Promise<string> {
  if (!imageUrl) return imageUrl;

  const ext = getUrlExtension(imageUrl);
  const hasUnsafeExt = UNSUPPORTED_EXTENSIONS.has(ext);

  // Fast path: trusted-safe extension and no unsafe markers
  if (SAFE_EXTENSIONS.has(ext) && !hasUnsafeExt) {
    return imageUrl;
  }

  const baseUrl =
    options?.baseUrl ||
    process.env.REPLIT_DEPLOYMENT_URL ||
    process.env.CLIENT_URL ||
    "http://localhost:5000";
  const wasRelative = !imageUrl.startsWith("http");
  const absoluteUrl = wasRelative
    ? `${baseUrl}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`
    : imageUrl;

  // SSRF guard: only apply to caller-provided absolute URLs. Relative paths
  // are app-internal (resolved against our own baseUrl) and intentionally
  // permitted to allow fetching from our own object storage / proxy routes,
  // even when baseUrl points at localhost in dev.
  if (!wasRelative) {
    const safeCheck = isSafeOutboundUrl(absoluteUrl);
    if (!safeCheck.ok) {
      console.warn(
        `⚠️ [ensureApiSafeImageUrl] Refusing to fetch ${absoluteUrl.substring(0, 120)}: ${safeCheck.reason}; returning original URL`
      );
      return imageUrl;
    }
  }

  let response: Response;
  try {
    response = await fetch(absoluteUrl);
  } catch (err: any) {
    console.warn(
      `⚠️ [ensureApiSafeImageUrl] Could not fetch ${absoluteUrl.substring(0, 120)}: ${err?.message}; returning original URL`
    );
    return imageUrl;
  }

  if (!response.ok) {
    console.warn(
      `⚠️ [ensureApiSafeImageUrl] Fetch failed (${response.status}) for ${absoluteUrl.substring(0, 120)}; returning original URL`
    );
    return imageUrl;
  }

  const rawContentType = (response.headers.get("content-type") || "")
    .toLowerCase()
    .split(";")[0]
    .trim();

  // If server reports a safe content type and there's no unsafe extension hint, trust it
  if (API_SAFE_MIMETYPES.has(rawContentType) && !hasUnsafeExt) {
    return imageUrl;
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await response.arrayBuffer());
  } catch (err: any) {
    console.warn(
      `⚠️ [ensureApiSafeImageUrl] Could not read body of ${absoluteUrl.substring(0, 120)}: ${err?.message}; returning original URL`
    );
    return imageUrl;
  }

  const filename = (() => {
    try {
      const u = new URL(absoluteUrl);
      return u.pathname.split("/").pop() || "image";
    } catch {
      return "image";
    }
  })();

  let safe: ApiSafeImage;
  try {
    safe = await ensureApiSafeFormat(buffer, rawContentType, filename);
  } catch (err: any) {
    console.warn(
      `⚠️ [ensureApiSafeImageUrl] Conversion failed for ${absoluteUrl.substring(0, 120)}: ${err?.message}; returning original URL`
    );
    return imageUrl;
  }

  if (!safe.converted) {
    return imageUrl;
  }

  const newExt = safe.contentType === "image/png" ? "png" : "jpg";
  const baseName = (filename.replace(/\.[^.]+$/, "") || "image").slice(0, 40);
  const safeBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const uniq = Math.random().toString(36).slice(2, 10);
  const newFilename = `${Date.now()}-${uniq}-${safeBaseName}.${newExt}`;

  const { persistImageBufferPublic } = await import("../objectStorage");
  const persistedPath = await persistImageBufferPublic(
    safe.buffer,
    newFilename,
    safe.contentType,
    "api-safe"
  );

  if (!persistedPath) {
    console.warn(
      `⚠️ [ensureApiSafeImageUrl] Could not persist converted image; returning original URL`
    );
    return imageUrl;
  }

  console.log(
    `✅ [ensureApiSafeImageUrl] Converted ${absoluteUrl.substring(0, 80)} → ${persistedPath} (${rawContentType || "?"} → ${safe.contentType})`
  );
  return persistedPath;
}

export async function processImageFile(
  filePath: string,
  options?: {
    maxDimension?: number;
    targetFileSize?: number;
    forceFormat?: "jpeg" | "png" | "webp";
  }
): Promise<ProcessedImage> {
  const fs = await import("fs");
  const buffer = fs.readFileSync(filePath);
  return processImage(buffer, options);
}
