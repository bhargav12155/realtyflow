import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';

export class S3UploadService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.bucketName = process.env.S3_BUCKET_NAME || 'home-template-images';
  }

  async uploadFile(
    userId: number,
    fileBuffer: Buffer,
    fileName: string,
    contentType: string
  ): Promise<string> {
    const key = `user-${userId}/photo-avatars/${fileName}`;

    const upload = new Upload({
      client: this.s3Client,
      params: {
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      },
    });

    await upload.done();
    return this.getS3Url(key);
  }

  async getFile(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('No file data received from S3');
    }

    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  getS3Url(key: string): string {
    const region = process.env.AWS_REGION || 'us-east-2';
    return `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
  }

  async uploadBuffer(
    fileBuffer: Buffer,
    key: string,
    contentType: string,
    returnPresignedUrl: boolean = false,
    expiresInSeconds: number = 3600
  ): Promise<string> {
    const params = {
      Bucket: this.bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    };

    const upload = new Upload({
      client: this.s3Client,
      params,
    });

    await upload.done();
    
    if (returnPresignedUrl) {
      return this.getPresignedUrl(key, expiresInSeconds);
    }
    
    return this.getS3Url(key);
  }

  async getPresignedUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const presignedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    return presignedUrl;
  }

  async getPresignedPutUrl(key: string, contentType: string, expiresInSeconds: number = 3600): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    return presignedUrl;
  }

  /**
   * Download an image from a URL and persist it to S3
   * Returns the S3 URL of the uploaded file
   */
  async persistImageFromUrl(imageUrl: string, filename: string, folder: string = 'avatars'): Promise<string | null> {
    try {
      console.log(`📥 Downloading image to persist to S3: ${filename}`);
      const response = await fetch(imageUrl);
      if (!response.ok) {
        console.error(`Failed to download image: ${response.status}`);
        return null;
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const key = `${folder}/${filename}`;

      const s3Url = await this.uploadBuffer(imageBuffer, key, contentType);
      console.log(`✅ Image persisted to S3: ${s3Url}`);
      return s3Url;
    } catch (error) {
      console.error('Failed to persist image to S3:', error);
      return null;
    }
  }

  /**
   * Upload a file and store metadata in database
   */
  async uploadWithMetadata(
    userId: string,
    fileBuffer: Buffer,
    fileName: string,
    contentType: string,
    folder: string = 'uploads'
  ): Promise<{ url: string; key: string }> {
    const key = `user-${userId}/${folder}/${fileName}`;
    const url = await this.uploadBuffer(fileBuffer, key, contentType);
    return { url, key };
  }

  /**
   * Download a video from a URL and persist it to S3
   * Returns the S3 URL of the uploaded file
   */
  async persistVideoFromUrl(videoUrl: string, filename: string, folder: string = 'videos'): Promise<string | null> {
    try {
      console.log(`📥 Downloading video to persist to S3: ${filename}`);
      const response = await fetch(videoUrl);
      if (!response.ok) {
        console.error(`Failed to download video: ${response.status}`);
        return null;
      }

      const videoBuffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'video/mp4';
      const key = `${folder}/${filename}`;

      const s3Url = await this.uploadBuffer(videoBuffer, key, contentType);
      console.log(`✅ Video persisted to S3: ${s3Url}`);
      return s3Url;
    } catch (error) {
      console.error('Failed to persist video to S3:', error);
      return null;
    }
  }
}
