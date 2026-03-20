import { S3UploadService } from './s3Upload';
import { objectStorageClient, ObjectStorageService } from '../objectStorage';

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const parts = path.split("/");
  if (parts.length < 3) throw new Error("Invalid path: must contain at least a bucket name");
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

function hasS3Credentials(): boolean {
  return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

function isS3CredentialError(error: any): boolean {
  const msg = String(error?.message || error?.Code || "");
  return (
    msg.includes("InvalidAccessKeyId") ||
    msg.includes("SignatureDoesNotMatch") ||
    msg.includes("InvalidClientTokenId") ||
    msg.includes("ExpiredToken") ||
    msg.includes("credentials") ||
    error?.Code === "InvalidAccessKeyId" ||
    error?.$metadata?.httpStatusCode === 403
  );
}

export class UnifiedUploadService {
  private s3Service: S3UploadService | null = null;
  private objStorage: ObjectStorageService;
  private s3Disabled = false;

  constructor() {
    this.objStorage = new ObjectStorageService();
    if (hasS3Credentials()) {
      try {
        this.s3Service = new S3UploadService();
      } catch {
        console.warn("⚠️ [UnifiedUpload] Failed to initialize S3, using Object Storage");
        this.s3Disabled = true;
      }
    } else {
      console.log("📦 [UnifiedUpload] No AWS credentials, using Replit Object Storage");
      this.s3Disabled = true;
    }
  }

  private canUseS3(): boolean {
    return !this.s3Disabled && this.s3Service !== null;
  }

  private getBaseUrl(): string {
    const replitDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(",")[0] || "";
    if (replitDomain) return `https://${replitDomain}`;
    return "";
  }

  private async uploadToObjectStorage(
    buffer: Buffer,
    key: string,
    contentType: string
  ): Promise<string> {
    if (!this.objStorage.isConfigured()) {
      throw new Error("Object Storage not configured");
    }
    const publicPaths = this.objStorage.getPublicObjectSearchPaths();
    const basePath = publicPaths[0];
    const fullPath = `${basePath}/${key}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    await file.save(buffer, {
      contentType,
      resumable: false,
      metadata: { cacheControl: "public, max-age=31536000" },
    });

    const publicUrl = `${this.getBaseUrl()}/public-objects/${key}`;
    console.log(`✅ [UnifiedUpload] File saved to Object Storage: ${publicUrl}`);
    return publicUrl;
  }

  private async readFromObjectStorage(key: string): Promise<Buffer> {
    if (!this.objStorage.isConfigured()) {
      throw new Error("Object Storage not configured for read");
    }
    const publicPaths = this.objStorage.getPublicObjectSearchPaths();
    const basePath = publicPaths[0];
    const fullPath = `${basePath}/${key}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    const [exists] = await file.exists();
    if (exists) {
      const [contents] = await file.download();
      return contents;
    }

    const privateDir = this.objStorage.getPrivateObjectDir();
    const privatePath = `${privateDir}/${key}`;
    const { bucketName: pBucket, objectName: pObject } = parseObjectPath(privatePath);
    const pFile = objectStorageClient.bucket(pBucket).file(pObject);
    const [pExists] = await pFile.exists();
    if (pExists) {
      const [contents] = await pFile.download();
      return contents;
    }

    throw new Error(`File not found in Object Storage: ${key}`);
  }

  async uploadBuffer(
    fileBuffer: Buffer,
    key: string,
    contentType: string,
    returnPresignedUrl: boolean = false,
    expiresInSeconds: number = 3600
  ): Promise<string> {
    if (this.canUseS3()) {
      try {
        return await this.s3Service!.uploadBuffer(fileBuffer, key, contentType, returnPresignedUrl, expiresInSeconds);
      } catch (error: any) {
        if (isS3CredentialError(error)) {
          console.warn("⚠️ [UnifiedUpload] S3 credentials invalid, falling back to Object Storage");
          this.s3Disabled = true;
        } else {
          throw error;
        }
      }
    }
    return this.uploadToObjectStorage(fileBuffer, key, contentType);
  }

  async uploadFile(
    userId: number,
    fileBuffer: Buffer,
    fileName: string,
    contentType: string
  ): Promise<string> {
    const key = `user-${userId}/photo-avatars/${fileName}`;
    if (this.canUseS3()) {
      try {
        return await this.s3Service!.uploadFile(userId, fileBuffer, fileName, contentType);
      } catch (error: any) {
        if (isS3CredentialError(error)) {
          console.warn("⚠️ [UnifiedUpload] S3 credentials invalid, falling back to Object Storage");
          this.s3Disabled = true;
        } else {
          throw error;
        }
      }
    }
    return this.uploadToObjectStorage(fileBuffer, key, contentType);
  }

  async getFile(key: string): Promise<Buffer> {
    if (this.canUseS3()) {
      try {
        return await this.s3Service!.getFile(key);
      } catch (error: any) {
        if (isS3CredentialError(error)) {
          console.warn("⚠️ [UnifiedUpload] S3 credentials invalid for getFile, trying Object Storage");
          this.s3Disabled = true;
        } else {
          throw error;
        }
      }
    }
    return this.readFromObjectStorage(key);
  }

  async deleteFile(key: string): Promise<void> {
    if (this.canUseS3()) {
      try {
        return await this.s3Service!.deleteFile(key);
      } catch (error: any) {
        if (isS3CredentialError(error)) {
          this.s3Disabled = true;
        } else {
          throw error;
        }
      }
    }
    console.warn("⚠️ [UnifiedUpload] deleteFile via Object Storage not implemented, skipping");
  }

  getS3Url(key: string): string {
    if (this.canUseS3()) {
      return this.s3Service!.getS3Url(key);
    }
    return `${this.getBaseUrl()}/public-objects/${key}`;
  }

  async getPresignedUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
    if (this.canUseS3()) {
      try {
        return await this.s3Service!.getPresignedUrl(key, expiresInSeconds);
      } catch (error: any) {
        if (isS3CredentialError(error)) {
          this.s3Disabled = true;
        } else {
          throw error;
        }
      }
    }
    return `${this.getBaseUrl()}/public-objects/${key}`;
  }

  async getPresignedPutUrl(key: string, contentType: string, expiresInSeconds: number = 3600): Promise<string> {
    if (this.canUseS3()) {
      try {
        return await this.s3Service!.getPresignedPutUrl(key, contentType, expiresInSeconds);
      } catch (error: any) {
        if (isS3CredentialError(error)) {
          this.s3Disabled = true;
        } else {
          throw error;
        }
      }
    }
    throw new Error("S3_FALLBACK_USE_UPLOAD_BUFFER");
  }

  async uploadOrPresignedPut(
    fileBuffer: Buffer,
    key: string,
    contentType: string,
    expiresInSeconds: number = 900
  ): Promise<{ url: string; method: "presigned" | "direct" }> {
    if (this.canUseS3()) {
      try {
        const putUrl = await this.s3Service!.getPresignedPutUrl(key, contentType, expiresInSeconds);
        return { url: putUrl, method: "presigned" };
      } catch (error: any) {
        if (isS3CredentialError(error)) {
          this.s3Disabled = true;
        } else {
          throw error;
        }
      }
    }
    const url = await this.uploadToObjectStorage(fileBuffer, key, contentType);
    return { url, method: "direct" };
  }

  async persistImageFromUrl(imageUrl: string, filename: string, folder: string = 'avatars'): Promise<string | null> {
    if (this.canUseS3()) {
      try {
        return await this.s3Service!.persistImageFromUrl(imageUrl, filename, folder);
      } catch (error: any) {
        if (isS3CredentialError(error)) {
          console.warn("⚠️ [UnifiedUpload] S3 credentials invalid for persistImageFromUrl, falling back");
          this.s3Disabled = true;
        } else {
          console.error("Failed to persist image to S3:", error);
          return null;
        }
      }
    }
    try {
      console.log(`📥 [UnifiedUpload] Downloading image to persist: ${filename}`);
      const response = await fetch(imageUrl);
      if (!response.ok) {
        console.error(`Failed to download image: ${response.status}`);
        return null;
      }
      const imageBuffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get("content-type") || "image/jpeg";
      const key = `${folder}/${filename}`;
      return await this.uploadToObjectStorage(imageBuffer, key, contentType);
    } catch (error) {
      console.error("Failed to persist image:", error);
      return null;
    }
  }

  async persistVideoFromUrl(videoUrl: string, filename: string, folder: string = 'videos'): Promise<string | null> {
    if (this.canUseS3()) {
      try {
        return await this.s3Service!.persistVideoFromUrl(videoUrl, filename, folder);
      } catch (error: any) {
        if (isS3CredentialError(error)) {
          console.warn("⚠️ [UnifiedUpload] S3 credentials invalid for persistVideoFromUrl, falling back");
          this.s3Disabled = true;
        } else {
          console.error("Failed to persist video to S3:", error);
          return null;
        }
      }
    }
    try {
      console.log(`📥 [UnifiedUpload] Downloading video to persist: ${filename}`);
      const response = await fetch(videoUrl);
      if (!response.ok) {
        console.error(`Failed to download video: ${response.status}`);
        return null;
      }
      const videoBuffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get("content-type") || "video/mp4";
      const key = `${folder}/${filename}`;
      return await this.uploadToObjectStorage(videoBuffer, key, contentType);
    } catch (error) {
      console.error("Failed to persist video:", error);
      return null;
    }
  }

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
}

export const unifiedUploadService = new UnifiedUploadService();
