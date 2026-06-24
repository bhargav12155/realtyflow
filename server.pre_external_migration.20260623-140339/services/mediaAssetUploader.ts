import { UnifiedUploadService } from './unifiedUpload';
import { storage } from '../storage';
import type { MediaAsset, InsertMediaAsset } from '@shared/schema';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execFileAsync = promisify(execFile);

export type MediaType = 'photo' | 'video' | 'avatar' | 'document' | 'audio';
export type MediaSource = 'upload' | 'heygen' | 'library' | 'ai_generated' | 'kling';

interface UploadResult {
  url: string;
  key: string;
  mediaAsset: MediaAsset;
}

interface UploadOptions {
  userId: string;
  type: MediaType;
  source: MediaSource;
  title?: string;
  description?: string;
  avatarId?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  metadata?: Record<string, any>;
}

const s3Service = new UnifiedUploadService();

export async function uploadAndRecord(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  folder: string,
  options: UploadOptions
): Promise<UploadResult> {
  const key = `user-${options.userId}/${folder}/${fileName}`;
  const url = await s3Service.uploadBuffer(fileBuffer, key, contentType);
  
  const mediaAsset = await storage.createMediaAsset({
    userId: options.userId,
    type: options.type,
    source: options.source,
    url,
    title: options.title,
    description: options.description,
    mimeType: contentType,
    fileSize: fileBuffer.length,
    avatarId: options.avatarId,
    durationSeconds: options.durationSeconds,
    width: options.width,
    height: options.height,
    metadata: options.metadata,
  });

  console.log(`✅ Media asset uploaded to S3 and recorded in database: ${mediaAsset.id}`);
  
  return { url, key, mediaAsset };
}

export async function persistImageFromUrlAndRecord(
  imageUrl: string,
  fileName: string,
  folder: string,
  options: UploadOptions
): Promise<UploadResult | null> {
  try {
    console.log(`📥 Downloading image to persist to S3: ${fileName}`);
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`Failed to download image: ${response.status}`);
      return null;
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    return await uploadAndRecord(imageBuffer, fileName, contentType, folder, options);
  } catch (error) {
    console.error('Failed to persist image to S3:', error);
    return null;
  }
}

async function normalizeVideoAudio(videoBuffer: Buffer): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `video-input-${randomUUID()}.mp4`);
  const outputPath = path.join(tmpDir, `video-normalized-${randomUUID()}.mp4`);

  try {
    fs.writeFileSync(inputPath, videoBuffer);

    const detectResult = await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-af', 'volumedetect',
      '-f', 'null',
      '/dev/null'
    ], { maxBuffer: 10 * 1024 * 1024 }).catch(e => ({ stdout: e.stdout || '', stderr: e.stderr || '' }));

    const detectOutput = (detectResult.stderr || '') + (detectResult.stdout || '');
    const meanMatch = String(detectOutput).match(/mean_volume:\s*([-\d.]+)\s*dB/);
    const meanVolume = meanMatch ? parseFloat(meanMatch[1]) : -30;

    console.log(`🔊 Video audio mean volume: ${meanVolume} dB`);

    if (meanVolume > -25) {
      console.log(`✅ Audio level is already good (${meanVolume} dB), skipping normalization`);
      return videoBuffer;
    }

    const boostDb = Math.min(Math.abs(meanVolume) - 16, 30);
    console.log(`🔊 Boosting audio by ${boostDb} dB with compression and limiting...`);

    await execFileAsync('ffmpeg', [
      '-y',
      '-i', inputPath,
      '-af', `volume=${boostDb}dB,compand=attacks=0.01:decays=0.3:points=-80/-80|-45/-25|-27/-15|-10/-10|0/-5:soft-knee=6,alimiter=limit=0.95:attack=5:release=50`,
      '-c:v', 'copy',
      outputPath
    ], { maxBuffer: 10 * 1024 * 1024, timeout: 300000 });

    const normalizedBuffer = fs.readFileSync(outputPath);
    console.log(`✅ Audio normalized successfully (${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB → ${(normalizedBuffer.length / 1024 / 1024).toFixed(1)}MB)`);
    return normalizedBuffer;
  } catch (error) {
    console.error('⚠️ Audio normalization failed, using original video:', error);
    return videoBuffer;
  } finally {
    try { fs.unlinkSync(inputPath); } catch {}
    try { fs.unlinkSync(outputPath); } catch {}
  }
}

export async function persistVideoFromUrlAndRecord(
  videoUrl: string,
  fileName: string,
  folder: string,
  options: UploadOptions
): Promise<UploadResult | null> {
  try {
    console.log(`📥 Downloading video to persist to S3: ${fileName}`);
    const response = await fetch(videoUrl);
    if (!response.ok) {
      console.error(`Failed to download video: ${response.status}`);
      return null;
    }

    let videoBuffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'video/mp4';

    videoBuffer = await normalizeVideoAudio(videoBuffer);

    return await uploadAndRecord(videoBuffer, fileName, contentType, folder, options);
  } catch (error) {
    console.error('Failed to persist video to S3:', error);
    return null;
  }
}

export { s3Service };
