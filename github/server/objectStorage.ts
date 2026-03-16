import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// The object storage client is used to interact with the object storage service.
export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// The object storage service is used to interact with the object storage service.
export class ObjectStorageService {
  constructor() {}

  // Checks if public object search paths are configured
  hasPublicPaths(): boolean {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = pathsStr
      .split(",")
      .map((path) => path.trim())
      .filter((path) => path.length > 0);
    
    return paths.length > 0;
  }

  // Checks if private object directory is configured
  hasPrivateDir(): boolean {
    const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
    return privateDir.length > 0;
  }

  // Checks if object storage is properly configured (both public and private)
  isConfigured(): boolean {
    return this.hasPublicPaths() && this.hasPrivateDir();
  }

  // Gets the public object search paths.
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  // Gets the private object directory.
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  // Search for a public object from the search paths.
  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      // Full path format: /<bucket_name>/<object_name>
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      // Check if file exists
      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  // Downloads an object to the response.
  async downloadObject(file: File, res: Response, cacheTtlSec: number = 3600) {
    try {
      // Get file metadata
      const [metadata] = await file.getMetadata();
      // Get the ACL policy for the object.
      const aclPolicy = await getObjectAclPolicy(file);
      const isPublic = aclPolicy?.visibility === "public";
      // Set appropriate headers
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `${
          isPublic ? "public" : "private"
        }, max-age=${cacheTtlSec}`,
      });

      // Stream the file to the response
      const stream = file.createReadStream();

      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Gets the upload URL for an object entity.
  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }

    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    // Sign URL for PUT method with TTL
    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
  }

  // Gets the object entity file from the object path.
  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    
    // Check if entityId already contains 'uploads/', if not prepend it
    const finalEntityId = entityId.startsWith('uploads/') ? entityId : `uploads/${entityId}`;
    const objectEntityPath = `${entityDir}${finalEntityId}`;
    
    console.log(`🔍 Looking for object: ${objectPath} -> ${objectEntityPath}`);
    
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      console.log(`❌ Object not found at: ${objectEntityPath}`);
      throw new ObjectNotFoundError();
    }
    console.log(`✅ Object found at: ${objectEntityPath}`);
    return objectFile;
  }

  normalizeObjectEntityPath(
    rawPath: string,
  ): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }
  
    // Extract the path from the URL by removing query parameters and domain
    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;
  
    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }
  
    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }
  
    // Extract the entity ID from the path
    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  // Tries to set the ACL policy for the object entity and return the normalized path.
  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  // Checks if the user can access the object entity.
  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}

export async function persistVideoFromUrl(
  videoUrl: string,
  filename: string
): Promise<string | null> {
  try {
    const objectStorage = new ObjectStorageService();
    if (!objectStorage.isConfigured()) {
      console.warn("Object storage not configured, cannot persist video");
      return null;
    }

    console.log(`📥 Downloading video to persist: ${filename}`);
    const response = await fetch(videoUrl);
    if (!response.ok) {
      console.error(`Failed to download video: ${response.status}`);
      return null;
    }

    const videoBuffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "video/mp4";

    const privateDir = objectStorage.getPrivateObjectDir();
    const fullPath = `${privateDir}/videos/${filename}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    await file.save(videoBuffer, {
      contentType,
      resumable: false,
      metadata: {
        cacheControl: "private, max-age=31536000",
      },
    });

    console.log(`✅ Video persisted to: ${fullPath}`);
    return `/objects/videos/${filename}`;
  } catch (error) {
    console.error("Failed to persist video:", error);
    return null;
  }
}

export async function persistImageBuffer(
  imageBuffer: Buffer,
  filename: string,
  contentType: string = "image/jpeg"
): Promise<string | null> {
  try {
    const objectStorage = new ObjectStorageService();
    if (!objectStorage.isConfigured()) {
      console.warn("Object storage not configured, cannot persist image");
      return null;
    }

    console.log(`📥 Saving image buffer to storage: ${filename}`);
    
    const privateDir = objectStorage.getPrivateObjectDir();
    const fullPath = `${privateDir}/photos/${filename}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    await file.save(imageBuffer, {
      contentType,
      resumable: false,
      metadata: {
        cacheControl: "private, max-age=31536000",
      },
    });

    console.log(`✅ Image saved to: ${fullPath}`);
    return `/objects/photos/${filename}`;
  } catch (error) {
    console.error("Failed to persist image buffer:", error);
    return null;
  }
}

export async function uploadToObjectStorage(
  buffer: Buffer,
  filename: string,
  contentType: string = "audio/webm",
  userId?: string
): Promise<string | null> {
  try {
    const objectStorage = new ObjectStorageService();
    if (!objectStorage.isConfigured()) {
      console.warn("Object storage not configured, cannot upload file");
      return null;
    }

    console.log(`📤 Uploading to object storage: ${filename}`);
    
    // Use private directory for uploads (has write permissions)
    const privateDir = objectStorage.getPrivateObjectDir();
    // Include userId in path for proper access control
    const userPath = userId ? `user-${userId}/audio` : "audio";
    const fullPath = `${privateDir}/${userPath}/${filename}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    await file.save(buffer, {
      contentType,
      resumable: false,
      metadata: {
        cacheControl: "private, max-age=31536000",
      },
    });

    // Return the internal path for serving through our API
    const internalPath = userId ? `/objects/user-${userId}/audio/${filename}` : `/objects/audio/${filename}`;
    console.log(`✅ File uploaded to: ${fullPath}, accessible at: ${internalPath}`);
    return internalPath;
  } catch (error) {
    console.error("Failed to upload to object storage:", error);
    return null;
  }
}

export async function persistImageFromUrl(
  imageUrl: string,
  filename: string
): Promise<string | null> {
  try {
    const objectStorage = new ObjectStorageService();
    if (!objectStorage.isConfigured()) {
      console.warn("Object storage not configured, cannot persist image");
      return null;
    }

    console.log(`📥 Downloading image to persist: ${filename}`);
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`Failed to download image: ${response.status}`);
      return null;
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/jpeg";

    const publicPaths = objectStorage.getPublicObjectSearchPaths();
    const basePath = publicPaths[0];
    const fullPath = `${basePath}/avatars/${filename}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    await file.save(imageBuffer, {
      contentType,
      resumable: false,
      metadata: {
        cacheControl: "public, max-age=31536000",
      },
    });

    console.log(`✅ Image persisted to: ${fullPath}`);
    return `/public-objects/avatars/${filename}`;
  } catch (error) {
    console.error("Failed to persist image:", error);
    return null;
  }
}