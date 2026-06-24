import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { promisify } from 'util';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const readdir = promisify(fs.readdir);

export type KenBurnsEffect = 
  | 'zoom-in' 
  | 'zoom-out' 
  | 'pan-left' 
  | 'pan-right' 
  | 'pan-up' 
  | 'pan-down'
  | 'zoom-in-pan-left'
  | 'zoom-in-pan-right';

export interface ImageClip {
  imageUrl: string;
  effect: KenBurnsEffect;
  durationSeconds: number;
}

export interface VideoGenerationOptions {
  clips: ImageClip[];
  outputWidth?: number;
  outputHeight?: number;
  fps?: number;
  audioUrl?: string;
}

export interface VideoGenerationResult {
  success: boolean;
  videoPath?: string;
  error?: string;
}

const TEMP_DIR = '/tmp/kenburns-videos';
const OUTPUT_DIR = '/tmp/kenburns-output';

async function ensureDirectories(): Promise<void> {
  await mkdir(TEMP_DIR, { recursive: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
}

async function downloadImage(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadImage(redirectUrl, destPath).then(resolve).catch(reject);
          return;
        }
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
      file.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

function getZoompanFilter(effect: KenBurnsEffect, width: number, height: number, durationSeconds: number, fps: number): string {
  const totalFrames = durationSeconds * fps;
  
  switch (effect) {
    case 'zoom-in':
      return `zoompan=z='min(zoom+0.001,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;
    
    case 'zoom-out':
      return `zoompan=z='if(lte(zoom,1.0),1.5,max(1.001,zoom-0.001))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;
    
    case 'pan-left':
      return `zoompan=z='1.1':x='iw-(iw/zoom)*on/${totalFrames}':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;
    
    case 'pan-right':
      return `zoompan=z='1.1':x='(iw/zoom)*on/${totalFrames}':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;
    
    case 'pan-up':
      return `zoompan=z='1.1':x='iw/2-(iw/zoom/2)':y='ih-(ih/zoom)*on/${totalFrames}':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;
    
    case 'pan-down':
      return `zoompan=z='1.1':x='iw/2-(iw/zoom/2)':y='(ih/zoom)*on/${totalFrames}':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;
    
    case 'zoom-in-pan-left':
      return `zoompan=z='min(zoom+0.001,1.4)':x='iw/zoom*0.6-iw/zoom*0.2*on/${totalFrames}':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;
    
    case 'zoom-in-pan-right':
      return `zoompan=z='min(zoom+0.001,1.4)':x='iw/zoom*0.2+iw/zoom*0.2*on/${totalFrames}':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;
    
    default:
      return `zoompan=z='min(zoom+0.001,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=${fps}`;
  }
}

function runFFmpeg(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', args);
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
      }
    });
    
    process.on('error', (err) => {
      reject(err);
    });
  });
}

async function createClipVideo(
  imagePath: string, 
  effect: KenBurnsEffect, 
  durationSeconds: number, 
  outputPath: string,
  width: number,
  height: number,
  fps: number
): Promise<void> {
  const filter = getZoompanFilter(effect, width, height, durationSeconds, fps);
  
  const args = [
    '-y',
    '-loop', '1',
    '-i', imagePath,
    '-vf', `scale=${width * 2}:${height * 2},${filter},format=yuv420p`,
    '-t', durationSeconds.toString(),
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    outputPath
  ];
  
  await runFFmpeg(args);
}

async function concatenateVideos(clipPaths: string[], outputPath: string): Promise<void> {
  const listFilePath = path.join(TEMP_DIR, `concat_${Date.now()}.txt`);
  const listContent = clipPaths.map(p => `file '${p}'`).join('\n');
  await writeFile(listFilePath, listContent);
  
  const args = [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listFilePath,
    '-c', 'copy',
    outputPath
  ];
  
  try {
    await runFFmpeg(args);
  } finally {
    await unlink(listFilePath).catch(() => {});
  }
}

async function addAudioToVideo(videoPath: string, audioUrl: string, outputPath: string): Promise<void> {
  const audioPath = path.join(TEMP_DIR, `audio_${Date.now()}.mp3`);
  await downloadImage(audioUrl, audioPath);
  
  const args = [
    '-y',
    '-i', videoPath,
    '-i', audioPath,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    outputPath
  ];
  
  try {
    await runFFmpeg(args);
  } finally {
    await unlink(audioPath).catch(() => {});
  }
}

export async function generatePropertyTourVideo(options: VideoGenerationOptions): Promise<VideoGenerationResult> {
  const {
    clips,
    outputWidth = 1920,
    outputHeight = 1080,
    fps = 30,
    audioUrl
  } = options;
  
  if (!clips || clips.length === 0) {
    return { success: false, error: 'No clips provided' };
  }
  
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const sessionDir = path.join(TEMP_DIR, sessionId);
  
  try {
    await ensureDirectories();
    await mkdir(sessionDir, { recursive: true });
    
    console.log(`🎬 Starting Ken Burns video generation for ${clips.length} clips`);
    
    const clipVideoPaths: string[] = [];
    
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      console.log(`📸 Processing clip ${i + 1}/${clips.length}: ${clip.effect}`);
      
      const ext = clip.imageUrl.includes('.png') ? '.png' : '.jpg';
      const imagePath = path.join(sessionDir, `image_${i}${ext}`);
      const clipPath = path.join(sessionDir, `clip_${i}.mp4`);
      
      await downloadImage(clip.imageUrl, imagePath);
      await createClipVideo(imagePath, clip.effect, clip.durationSeconds, clipPath, outputWidth, outputHeight, fps);
      
      clipVideoPaths.push(clipPath);
      
      await unlink(imagePath).catch(() => {});
    }
    
    console.log(`🔗 Concatenating ${clipVideoPaths.length} video clips`);
    
    const concatenatedPath = path.join(sessionDir, 'concatenated.mp4');
    await concatenateVideos(clipVideoPaths, concatenatedPath);
    
    let finalVideoPath: string;
    
    if (audioUrl) {
      console.log(`🔊 Adding audio to video`);
      finalVideoPath = path.join(OUTPUT_DIR, `property_tour_${sessionId}.mp4`);
      await addAudioToVideo(concatenatedPath, audioUrl, finalVideoPath);
    } else {
      finalVideoPath = path.join(OUTPUT_DIR, `property_tour_${sessionId}.mp4`);
      await fs.promises.copyFile(concatenatedPath, finalVideoPath);
    }
    
    for (const clipPath of clipVideoPaths) {
      await unlink(clipPath).catch(() => {});
    }
    await unlink(concatenatedPath).catch(() => {});
    await fs.promises.rmdir(sessionDir).catch(() => {});
    
    console.log(`✅ Ken Burns video generated: ${finalVideoPath}`);
    
    return {
      success: true,
      videoPath: finalVideoPath
    };
    
  } catch (error) {
    console.error('❌ Ken Burns video generation failed:', error);
    
    await fs.promises.rm(sessionDir, { recursive: true, force: true }).catch(() => {});
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export function getEffectCycle(): KenBurnsEffect[] {
  return [
    'zoom-in',
    'pan-right',
    'zoom-out',
    'pan-left',
    'zoom-in-pan-right',
    'pan-down',
    'zoom-in-pan-left',
    'pan-up'
  ];
}

export function assignEffectsToImages(imageUrls: string[], durationPerImage: number): ImageClip[] {
  const effects = getEffectCycle();
  
  return imageUrls.map((imageUrl, index) => ({
    imageUrl,
    effect: effects[index % effects.length],
    durationSeconds: durationPerImage
  }));
}
