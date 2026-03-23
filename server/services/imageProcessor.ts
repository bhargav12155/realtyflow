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
