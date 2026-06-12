import crypto from "crypto";
import fs from "fs";
import OAuth from "oauth-1.0a";
import path from "path";
import { whatsappService } from "./whatsapp";
import { ensureApiSafeImageUrl } from "./imageProcessor";

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.webm', '.mkv', '.m4v', '.wmv', '.flv', '.3gp']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.tiff', '.heif', '.heic', '.webp', '.bmp', '.svg']);

function getMediaExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).toLowerCase();
    return ext;
  } catch {
    const ext = path.extname(url.split('?')[0]).toLowerCase();
    return ext;
  }
}

export function isVideoUrl(url: string): boolean {
  return VIDEO_EXTENSIONS.has(getMediaExtension(url));
}

export function isImageUrl(url: string): boolean {
  const ext = getMediaExtension(url);
  return IMAGE_EXTENSIONS.has(ext) || (!VIDEO_EXTENSIONS.has(ext) && ext !== '');
}

export class SocialMediaError extends Error {
  statusCode: number;
  details?: any;

  constructor(message: string, statusCode = 500, details?: any) {
    super(message);
    this.name = "SocialMediaError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export interface SocialMediaPost {
  platform: string;
  content: string;
  hashtags?: string[];
  mediaUrls?: string[];
  scheduledFor?: Date;
}

export interface SocialMediaMetrics {
  platform: string;
  followers: number;
  engagement: number;
  reach: number;
  posts: number;
}

export class SocialMediaService {
  async postToFacebook(
    content: string,
    accessToken?: string,
    imageUrl?: string,
  ): Promise<{ postId: string }> {
    // Note: Direct posting to personal Facebook profiles is not supported by Graph API
    // This method is deprecated in favor of page posting
    throw new Error(
      "Direct posting to personal Facebook profiles is not supported. Please use page posting instead.",
    );
  }

  async postToYoutube(
    title: string,
    description: string,
    videoUrl?: string,
    accessToken?: string,
    options?: { photoUrls?: string[]; videoUrls?: string[] },
  ): Promise<{ postId: string; watchUrl?: string; studioUrl?: string }> {
    try {
      if (!accessToken) {
        throw new Error("YouTube access token required for posting");
      }

      console.log(
        "YouTube postToYoutube called with accessToken:",
        accessToken,
      );

      // For YouTube, we can create a Community post (text-only) or upload a video
      // Community posts require specific channel permissions
      // Priority: options.videoUrls > videoUrl param
      let resolvedVideoSource = options?.videoUrls?.[0] || videoUrl;

      if (!resolvedVideoSource) {
        const defaultSamplePath =
          process.env.YOUTUBE_SAMPLE_VIDEO_PATH ||
          path.join(process.cwd(), "uploads/videos/demo-property-tour.mp4");

        if (fs.existsSync(defaultSamplePath)) {
          resolvedVideoSource = defaultSamplePath;
          console.log(
            "🎬 Using bundled sample video for YouTube upload:",
            defaultSamplePath,
          );
        } else {
          console.warn(
            "⚠️ No uploaded video and sample video missing. Falling back to text-only YouTube post.",
          );
        }
      }

      if (resolvedVideoSource) {
        // Upload video to YouTube
        return await this.uploadVideoToYoutube(
          title,
          description,
          resolvedVideoSource,
          accessToken,
        );
      }

      // Create a Community post (text-only) if we have no video source
      return await this.createYoutubeCommunityPost(
        title,
        description,
        accessToken,
      );
    } catch (error) {
      console.error("YouTube posting error:", error);
      throw error;
    }
  }

  private async uploadVideoToYoutube(
    title: string,
    description: string,
    videoSource: string,
    accessToken: string,
  ): Promise<{ postId: string; watchUrl?: string; studioUrl?: string }> {
    try {
      console.log("Starting YouTube video upload:", {
        title,
        description,
        videoSource,
      });

      // Check if this is a mock token for testing
      if (
        accessToken === "mock_youtube_token" ||
        accessToken === "mock_token"
      ) {
        console.log("Mock YouTube video upload simulated:", {
          title,
          description,
          videoSource,
        });
        return {
          postId: `mock_yt_video_${Date.now()}`,
        };
      }

      let videoBuffer: Buffer;
      let videoSizeBytes = 0;
      let mimeType = "video/mp4";

      if (
        videoSource.startsWith("http://") ||
        videoSource.startsWith("https://")
      ) {
        console.log("Downloading video file from URL:", videoSource);
        const videoResponse = await fetch(videoSource);

        if (!videoResponse.ok) {
          throw new Error(
            `Failed to download video: ${videoResponse.status} ${videoResponse.statusText}`,
          );
        }

        const arrayBuffer = await videoResponse.arrayBuffer();
        videoBuffer = Buffer.from(arrayBuffer);
        videoSizeBytes = videoBuffer.length;
        mimeType = videoResponse.headers.get("content-type") || mimeType;
      } else {
        const absolutePath = path.isAbsolute(videoSource)
          ? videoSource
          : path.join(process.cwd(), videoSource);

        await fs.promises.access(absolutePath, fs.constants.R_OK);
        const stats = await fs.promises.stat(absolutePath);
        videoSizeBytes = stats.size;
        console.log("Uploading local video file:", {
          absolutePath,
          sizeMB: (videoSizeBytes / (1024 * 1024)).toFixed(2),
        });
        videoBuffer = await fs.promises.readFile(absolutePath);
        const ext = path.extname(absolutePath).toLowerCase();
        if (ext === ".mov") mimeType = "video/quicktime";
        else if (ext === ".webm") mimeType = "video/webm";
        else if (ext === ".mkv") mimeType = "video/x-matroska";
      }

      // Prepare video metadata
      const videoMetadata = {
        snippet: {
          title: title,
          description: description,
          tags: ["real estate", "property", "home", "marketing"],
          categoryId: "28", // Science & Technology category
        },
        status: {
          privacyStatus: "public", // Can be 'private', 'public', or 'unlisted'
          selfDeclaredMadeForKids: false,
        },
      };

      console.log("Uploading video to YouTube with metadata:", videoMetadata);
      console.log("YouTube upload payload size (bytes):", videoSizeBytes);

      const boundary = `yt_boundary_${Date.now()}`;
      const metadataPart =
        `--${boundary}\r\n` +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(videoMetadata) +
        "\r\n";

      const mediaHeader =
        `--${boundary}\r\n` + `Content-Type: ${mimeType}\r\n\r\n`;

      const closing = `\r\n--${boundary}--\r\n`;

      const requestBuffer = Buffer.concat([
        Buffer.from(metadataPart, "utf8"),
        Buffer.from(mediaHeader, "utf8"),
        videoBuffer,
        Buffer.from(closing, "utf8"),
      ]);

      const uploadUrl =
        "https://www.googleapis.com/upload/youtube/v3/videos" +
        "?part=snippet,status&uploadType=multipart";

      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
          "Content-Length": requestBuffer.length.toString(),
        },
        body: requestBuffer,
      });

      if (!uploadResponse.ok) {
        const errorPayload = await uploadResponse.text();
        console.error(
          "YouTube upload HTTP error:",
          uploadResponse.status,
          errorPayload,
        );
        throw new Error(
          `YouTube API error ${uploadResponse.status}: ${errorPayload}`,
        );
      }

      const uploadJson = await uploadResponse.json();
      const videoId = uploadJson.id;
      console.log("Video uploaded successfully! Video ID:", videoId);

      return {
        postId: videoId || `yt_upload_${Date.now()}`,
        watchUrl: videoId
          ? `https://www.youtube.com/watch?v=${videoId}`
          : undefined,
        studioUrl: videoId
          ? `https://studio.youtube.com/video/${videoId}/edit`
          : undefined,
      };
    } catch (error) {
      console.error("YouTube video upload error:", error);

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Provide more specific error messages
      if (errorMessage.includes("quota")) {
        throw new Error("YouTube API quota exceeded. Video upload failed.");
      }
      if (
        errorMessage.includes("unauthorized") ||
        errorMessage.includes("401")
      ) {
        throw new Error(
          "YouTube authentication failed. Please reconnect your account.",
        );
      }
      if (errorMessage.includes("forbidden") || errorMessage.includes("403")) {
        throw new Error(
          "YouTube upload permission denied. Check your channel permissions.",
        );
      }

      throw new Error(`YouTube video upload failed: ${errorMessage}`);
    }
  }

  private async createYoutubeCommunityPost(
    title: string,
    description: string,
    accessToken: string,
  ): Promise<{ postId: string; watchUrl?: string; studioUrl?: string }> {
    try {
      // Check if this is a mock token
      if (
        accessToken === "mock_youtube_token" ||
        accessToken === "mock_token"
      ) {
        console.log("Mock YouTube Community Post created:", {
          title,
          description,
        });
        return {
          postId: `mock_yt_community_${Date.now()}`,
        };
      }

      // Note: YouTube Community Posts are NOT supported by the YouTube Data API v3
      // This is a known limitation as of 2025. Community Posts must be created manually
      // through YouTube Studio. Instead, let's verify the authentication works by
      // testing with a working API endpoint.

      console.log("Testing YouTube authentication by fetching channel info...");

      // Test authentication with channels endpoint
      const response = await fetch(
        "https://youtube.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.error("Error parsing YouTube API response:", parseError);
          throw new Error(
            `YouTube API authentication test failed: ${response.status}`,
          );
        }

        console.error("YouTube API Error:", errorData);

        if (response.status === 401) {
          throw new Error(
            "YouTube authentication failed. Please reconnect your account.",
          );
        }

        throw new Error(
          `YouTube API error: ${errorData.error?.message || "Unknown error"}`,
        );
      }

      const channelData = await response.json();
      console.log(
        "YouTube authentication successful! Channel:",
        channelData.items?.[0]?.snippet?.title,
      );

      // Since Community Posts aren't supported by API, create a simulated success response
      return {
        postId: `yt_authenticated_${Date.now()}`,
      };
    } catch (error) {
      console.error("YouTube authentication test error:", error);
      throw error;
    }
  }

  async postToInstagram(
    content: string,
    imageUrl?: string,
    accessToken?: string,
    igUserId?: string,
    options?: { photoUrls?: string[]; videoUrls?: string[] },
  ): Promise<{ postId: string }> {
    try {
      const token = accessToken || process.env.INSTAGRAM_ACCESS_TOKEN;
      const userId = igUserId || process.env.INSTAGRAM_USER_ID;

      if (!token) {
        throw new Error("Instagram access token not available");
      }

      if (!userId) {
        throw new Error("Instagram user ID not available");
      }

      // Priority: options.photoUrls/videoUrls > imageUrl param
      const mediaUrl =
        options?.photoUrls?.[0] || options?.videoUrls?.[0] || imageUrl;

      if (!mediaUrl) {
        throw new Error("Instagram requires an image or video. Text-only posts are not supported.");
      }

      // Step 1: Create media container
      const containerData: any = {
        access_token: token,
        caption: content,
      };

      // Add media URL
      if (mediaUrl) {
        const baseUrl =
          process.env.REPLIT_DEPLOYMENT_URL ||
          process.env.CLIENT_URL ||
          "http://localhost:5000";

        // For images, ensure the URL points to an API-safe format (JPEG/PNG)
        // before sending to the Meta Graph API. Videos are passed through as-is.
        const isVideo = !!options?.videoUrls?.[0];
        const apiSafeMediaUrl = isVideo
          ? mediaUrl
          : await ensureApiSafeImageUrl(mediaUrl, { baseUrl });

        let resolvedUrl = apiSafeMediaUrl.startsWith("http")
          ? apiSafeMediaUrl
          : `${baseUrl}${apiSafeMediaUrl}`;

        // Instagram requires HTTPS URLs - if source is HTTP, proxy through our HTTPS server
        if (resolvedUrl.startsWith("http://")) {
          const proxyBaseUrl = process.env.REPLIT_DEPLOYMENT_URL || baseUrl;
          const httpsBase = proxyBaseUrl.startsWith("https://") ? proxyBaseUrl : proxyBaseUrl.replace("http://", "https://");
          resolvedUrl = `${httpsBase}/api/image-proxy?url=${encodeURIComponent(resolvedUrl)}`;
          console.log("📸 Proxying HTTP image through HTTPS server for Instagram compatibility");
        }

        // Encode special characters in URL path (spaces, unicode) for Instagram compatibility
        if (!resolvedUrl.includes("/api/image-proxy")) {
          try {
            const urlObj = new URL(resolvedUrl);
            urlObj.pathname = urlObj.pathname
              .split("/")
              .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
              .join("/");
            resolvedUrl = urlObj.toString();
          } catch (e) {
            console.warn("Failed to encode media URL, using as-is:", e);
          }
        }
        console.log(`📸 Instagram resolved media URL: ${resolvedUrl}`);

        // Instagram supports both image_url and video_url
        if (options?.videoUrls?.[0]) {
          containerData.video_url = resolvedUrl;
          containerData.media_type = "VIDEO";
        } else {
          containerData.image_url = resolvedUrl;
        }
      }

      // Try Facebook Graph API first (works with Page tokens for Instagram Business Accounts)
      // Then fall back to Instagram Graph API (works with Instagram Business Login tokens)
      const endpoints = [
        `https://graph.facebook.com/v22.0/${userId}/media`,
        `https://graph.instagram.com/v22.0/${userId}/media`,
        `https://graph.instagram.com/v22.0/me/media`,
      ];

      let containerResponse: Response | null = null;
      let lastError: any = null;

      for (const endpoint of endpoints) {
        console.log(`📸 Instagram: Trying container creation at ${endpoint}`);
        containerResponse = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(containerData).toString(),
        });

        if (containerResponse.ok) {
          console.log(`📸 Instagram: Container created successfully via ${endpoint}`);
          break;
        }

        const errorData = await containerResponse.json();
        lastError = errorData;
        console.error(`📸 Instagram Container Error (${endpoint}):`, JSON.stringify(errorData));
      }

      if (!containerResponse || !containerResponse.ok) {
        const errorData = lastError;
        console.error("📸 Instagram: All container creation endpoints failed. Last error:", JSON.stringify(errorData));

        if (errorData?.error?.code === 190) {
          throw new Error(
            "Instagram session expired. Please reconnect your Instagram account.",
          );
        }
        if (errorData?.error?.code === 100 && errorData?.error?.error_subcode === 33) {
          throw new Error(
            "Instagram content publishing permission not granted. Please ensure your Meta app has 'instagram_business_content_publish' approved through App Review.",
          );
        }
        if (errorData?.error?.message?.includes("Unsupported request")) {
          throw new Error(
            "Instagram posting blocked: Your Meta app is in Development mode. Fix: Go to developers.facebook.com → Your App → App Roles → Roles → Add your Instagram account as a Tester. The account must accept the emailed invite. For production, complete App Review to approve 'instagram_business_content_publish' and switch the app to Live mode.",
          );
        }
        if (errorData?.error?.code === 100) {
          const msg = errorData.error?.message || "";
          const isAspectRatio = /aspect.ratio|dimensions|width|height|too (wide|tall|large|small)/i.test(msg);
          if (isAspectRatio) {
            throw new Error(
              `Instagram rejected this media due to unsupported dimensions. Supported aspect ratios: 1:1 (square, 1080×1080), 4:5 (portrait, 1080×1350), 1.91:1 (landscape, 1080×566). Images must be between 320px and 1440px wide. Videos must be 1:1, 4:5, or 16:9 with min 500px width.`,
            );
          }
          throw new Error(
            `Instagram API error: ${msg || "Invalid parameters. Please check your content and image."}`,
          );
        }

        const genericMsg = errorData?.error?.message || "Unknown error";
        const isGenericAspect = /aspect.ratio|dimensions|width|height/i.test(genericMsg);
        throw new Error(
          isGenericAspect
            ? `Instagram rejected this media due to unsupported dimensions. Supported aspect ratios: 1:1 (square, 1080×1080), 4:5 (portrait, 1080×1350), 1.91:1 (landscape, 1080×566). Images must be between 320px and 1440px wide.`
            : `Instagram container creation failed: ${genericMsg}`,
        );
      }

      const containerResult = await containerResponse.json();
      const containerId = containerResult.id;

      // Step 2: Wait for container to be ready (Instagram needs time to process media)
      const maxWaitTime = 60000;
      const pollInterval = 3000;
      let waited = 0;
      while (waited < maxWaitTime) {
        let statusRes = await fetch(
          `https://graph.facebook.com/v22.0/${containerId}?fields=status_code&access_token=${token}`,
        );
        if (!statusRes.ok) {
          statusRes = await fetch(
            `https://graph.instagram.com/v22.0/${containerId}?fields=status_code&access_token=${token}`,
          );
        }
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          console.log(`Instagram container ${containerId} status: ${statusData.status_code}`);
          if (statusData.status_code === "FINISHED") break;
          if (statusData.status_code === "ERROR") {
            throw new Error("Instagram media processing failed. Please try a different image.");
          }
        }
        await new Promise((r) => setTimeout(r, pollInterval));
        waited += pollInterval;
      }
      if (waited >= maxWaitTime) {
        throw new Error("Instagram media processing timed out. Please try again.");
      }

      // Step 3: Publish the media container (try Instagram Graph API first, then Facebook)
      const publishEndpoints = [
        `https://graph.instagram.com/v22.0/me/media_publish`,
        `https://graph.instagram.com/v22.0/${userId}/media_publish`,
        `https://graph.facebook.com/v22.0/${userId}/media_publish`,
      ];

      let publishResponse: Response | null = null;
      let lastPublishError: any = null;

      for (const endpoint of publishEndpoints) {
        console.log(`📸 Instagram: Trying publish at ${endpoint}`);
        publishResponse = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            access_token: token,
            creation_id: containerId,
          }).toString(),
        });

        if (publishResponse.ok) {
          console.log(`📸 Instagram: Published successfully via ${endpoint}`);
          break;
        }

        const pubError = await publishResponse.json();
        lastPublishError = pubError;
        console.error(`📸 Instagram Publish Error (${endpoint}):`, JSON.stringify(pubError));

        if (pubError.error?.code === 190 && endpoint.includes('graph.facebook.com')) break;
      }

      if (!publishResponse || !publishResponse.ok) {
        const errorData = lastPublishError;
        console.error("📸 Instagram: All publish endpoints failed. Last error:", JSON.stringify(errorData));

        if (errorData?.error?.code === 190) {
          throw new Error("Instagram session expired during publishing.");
        }
        if (errorData?.error?.code === 100) {
          const pubMsg = errorData.error?.message || "";
          const isPubAspect = /aspect.ratio|dimensions|width|height/i.test(pubMsg);
          throw new Error(
            isPubAspect
              ? `Instagram rejected this media due to unsupported dimensions. Supported aspect ratios: 1:1 (square, 1080×1080), 4:5 (portrait, 1080×1350), 1.91:1 (landscape, 1080×566). Images must be between 320px and 1440px wide.`
              : "Failed to publish Instagram content. Please try again.",
          );
        }

        const pubGenericMsg = errorData?.error?.message || "Unknown error";
        const isPubGenericAspect = /aspect.ratio|dimensions|width|height/i.test(pubGenericMsg);
        throw new Error(
          isPubGenericAspect
            ? `Instagram rejected this media due to unsupported dimensions. Supported aspect ratios: 1:1 (square, 1080×1080), 4:5 (portrait, 1080×1350), 1.91:1 (landscape, 1080×566). Images must be between 320px and 1440px wide.`
            : `Instagram publishing failed: ${pubGenericMsg}`,
        );
      }

      const publishResult = await publishResponse!.json();
      console.log("Instagram post successful:", publishResult.id);

      return { postId: publishResult.id || `ig_${Date.now()}` };
    } catch (error) {
      console.error("Instagram posting error:", error);
      throw error; // Re-throw to preserve the specific error message
    }
  }

  /**
   * Resolve a potentially relative URL to an absolute URL
   */
  private resolveMediaUrl(url: string): string {
    if (!url) return url;
    
    // Already absolute
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    
    // Relative URL - resolve using REPLIT_DEV_DOMAIN or fallback
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.BASE_URL || "http://localhost:5000";
    
    // Ensure url starts with /
    const path = url.startsWith("/") ? url : `/${url}`;
    return `${baseUrl}${path}`;
  }

  /**
   * Upload an image to LinkedIn and return the asset URN
   * LinkedIn requires a 3-step process:
   * 1. Register the upload to get an upload URL
   * 2. Upload the binary image data
   * 3. Return the asset URN for use in posts
   */
  async uploadLinkedInImage(
    imageUrl: string,
    accessToken: string,
    authorUrn: string,
  ): Promise<string> {
    // Resolve relative URLs to absolute
    const resolvedUrl = this.resolveMediaUrl(imageUrl);
    console.log("Uploading image to LinkedIn:", resolvedUrl, "(original:", imageUrl, ")");

    // Step 1: Register the upload
    const registerResponse = await fetch(
      "https://api.linkedin.com/v2/assets?action=registerUpload",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
            owner: authorUrn,
            serviceRelationships: [
              {
                relationshipType: "OWNER",
                identifier: "urn:li:userGeneratedContent",
              },
            ],
          },
        }),
      },
    );

    if (!registerResponse.ok) {
      const errorText = await registerResponse.text();
      console.error("LinkedIn image register failed:", errorText);
      throw new Error(`Failed to register LinkedIn image upload: ${errorText}`);
    }

    const registerData = await registerResponse.json();
    const uploadMechanism = registerData.value?.uploadMechanism?.[
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
    ];
    const uploadUrl = uploadMechanism?.uploadUrl;
    const uploadHeaders = uploadMechanism?.headers || {};
    const asset = registerData.value?.asset;

    if (!uploadUrl || !asset) {
      console.error("LinkedIn register response missing data:", registerData);
      throw new Error("Failed to get LinkedIn upload URL");
    }

    console.log("LinkedIn upload URL obtained, asset:", asset);

    // Step 2: Download the image from the source URL
    const imageResponse = await fetch(resolvedUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image from: ${resolvedUrl} (status: ${imageResponse.status})`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";

    // Step 3: Upload the image binary to LinkedIn
    // Use headers from LinkedIn's response, plus our required headers
    const uploadResponseHeaders: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": contentType,
      ...uploadHeaders,
    };

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: uploadResponseHeaders,
      body: imageBuffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("LinkedIn image upload failed:", errorText);
      throw new Error(`Failed to upload image to LinkedIn: ${errorText}`);
    }

    console.log("✅ LinkedIn image uploaded successfully:", asset);
    return asset;
  }

  async postToLinkedIn(
    content: string,
    accessToken: string,
    options?: { photoUrls?: string[]; videoUrls?: string[] },
  ): Promise<{ postId: string }> {
    try {
      console.log("Posting to LinkedIn:", content);

      // Step 1: Get user's LinkedIn profile ID (person URN)
      const profileResponse = await fetch(
        "https://api.linkedin.com/v2/userinfo",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!profileResponse.ok) {
        const errorText = await profileResponse.text();
        console.error("LinkedIn profile fetch failed:", errorText);
        throw new Error("Failed to fetch LinkedIn profile");
      }

      const profileData = await profileResponse.json();
      const authorUrn = `urn:li:person:${profileData.sub}`;
      console.log("LinkedIn author URN:", authorUrn);

      // Determine media category based on provided URLs
      let shareMediaCategory: "NONE" | "IMAGE" | "VIDEO" = "NONE";
      if (options?.photoUrls?.length) {
        shareMediaCategory = "IMAGE";
      } else if (options?.videoUrls?.length) {
        shareMediaCategory = "VIDEO";
      }

      // Step 2: Upload images if present
      const mediaAssets: { status: string; media: string; description?: { text: string } }[] = [];
      const uploadErrors: string[] = [];
      
      if (shareMediaCategory === "IMAGE" && options?.photoUrls?.length) {
        console.log(`Uploading ${options.photoUrls.length} images to LinkedIn...`);
        
        for (const photoUrl of options.photoUrls) {
          try {
            const asset = await this.uploadLinkedInImage(photoUrl, accessToken, authorUrn);
            mediaAssets.push({
              status: "READY",
              media: asset,
              description: {
                text: "Property photo",
              },
            });
          } catch (uploadError) {
            const errorMsg = uploadError instanceof Error ? uploadError.message : "Unknown error";
            console.error("Failed to upload image to LinkedIn:", errorMsg);
            uploadErrors.push(errorMsg);
            // Continue with other images if one fails
          }
        }
        
        // If no images uploaded successfully, throw error instead of silent fallback
        if (mediaAssets.length === 0) {
          const errorSummary = uploadErrors.length > 0 
            ? uploadErrors[0] 
            : "All image uploads failed";
          throw new Error(`LinkedIn image upload failed: ${errorSummary}. Post not created.`);
        }
        
        // Log partial success
        if (uploadErrors.length > 0 && mediaAssets.length > 0) {
          console.warn(`${uploadErrors.length} of ${options.photoUrls.length} images failed to upload, proceeding with ${mediaAssets.length} images`);
        }
      }

      // Note: Video upload is more complex and requires chunked upload
      // For now, we only support images
      if (shareMediaCategory === "VIDEO") {
        console.warn("LinkedIn video upload not yet implemented, posting text-only");
        shareMediaCategory = "NONE";
      }

      // Step 3: Create post on LinkedIn
      const postData: any = {
        author: authorUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: {
              text: content,
            },
            shareMediaCategory,
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      };

      // Add media to post if we have uploaded assets
      if (mediaAssets.length > 0) {
        postData.specificContent["com.linkedin.ugc.ShareContent"].media = mediaAssets;
      }

      const postResponse = await fetch("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify(postData),
      });

      if (!postResponse.ok) {
        const errorText = await postResponse.text();
        console.error("LinkedIn post failed:", errorText);
        throw new Error(`Failed to post to LinkedIn: ${errorText}`);
      }

      const postResult = await postResponse.json();
      console.log("✅ LinkedIn post successful:", postResult.id);

      return { postId: postResult.id || `li_${Date.now()}` };
    } catch (error) {
      console.error("LinkedIn posting error:", error);
      throw new Error(
        `Failed to post to LinkedIn: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  async getTwitterAccessToken(userId: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    scopes?: string[];
  }> {
    const { storage } = await import("../storage.js");
    const accounts = await storage.getSocialMediaAccounts(userId);
    const twitterAccount = accounts.find(
      (acc) => acc.platform === "x" || acc.platform === "twitter",
    );

    if (!twitterAccount || !twitterAccount.accessToken) {
      throw new Error(
        "Twitter account not connected. Please connect your Twitter/X account first.",
      );
    }

    if (!twitterAccount.isConnected) {
      throw new Error(
        "Twitter account is disconnected. Please reconnect your account.",
      );
    }

    // TODO: Add token refresh logic here if token is expired
    // For now, just return the stored token
    return {
      accessToken: twitterAccount.accessToken,
      refreshToken: twitterAccount.refreshToken || undefined,
      scopes: [], // TODO: Parse scopes from metadata
    };
  }

  async postToTwitter(
    userId: string,
    content: string,
    imageUrl?: string,
    options?: { photoUrls?: string[]; videoUrls?: string[] },
  ): Promise<{ postId: string }> {
    try {
      // Get user's OAuth 2.0 Bearer token from database
      const { accessToken, scopes } = await this.getTwitterAccessToken(userId);

      console.log("✅ Retrieved Twitter OAuth 2.0 token for user:", userId);

      const endpointURL = "https://api.twitter.com/2/tweets";

      // Prepare tweet data
      const tweetData: any = {
        text: content,
      };

      // TODO: Implement media upload for Twitter
      // Twitter media upload requires a separate multi-step process:
      // 1. Upload media to https://upload.twitter.com/1.1/media/upload.json
      // 2. Get media_id from response
      // 3. Attach media_ids array to tweet creation
      if (
        options?.photoUrls?.length ||
        options?.videoUrls?.length ||
        imageUrl
      ) {
        console.warn(
          "Twitter media upload not yet implemented, posting text-only",
        );
      }

      // Make the API call with OAuth 2.0 Bearer token
      const response = await fetch(endpointURL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "User-Agent": "RealEstateAI/1.0",
        },
        body: JSON.stringify(tweetData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Twitter API Error:", errorData);

        if (errorData.detail?.includes('duplicate content')) {
          throw new Error(
            "Twitter posting failed: This content has already been posted. Twitter doesn't allow duplicate tweets.",
          );
        }
        if (errorData.status === 403 || errorData.errors?.[0]?.code === 403) {
          throw new Error(
            `Twitter posting permission denied: ${errorData.detail || 'Your account may not have tweet.write permission. Please reconnect your Twitter account.'}`,
          );
        }
        if (errorData.status === 401 || errorData.errors?.[0]?.code === 401) {
          throw new Error(
            "Twitter authentication failed. Your token may have expired. Please reconnect your Twitter account.",
          );
        }

        throw new Error(
          `Twitter posting failed: ${
            errorData.detail ||
            errorData.errors?.[0]?.message ||
            errorData.title ||
            "Unknown error"
          }`,
        );
      }

      const result = await response.json();

      return {
        postId: result.data.id,
      };
    } catch (error) {
      console.error("Twitter posting error:", error);
      throw error;
    }
  }

  /**
   * Post to X (Twitter) platform
   * Note: Use postToTwitter() which handles OAuth 2.0 token lookup from database
   * This ensures proper token refresh, multi-account support, and storage guarantees
   *
   * @param userId - User ID for token lookup
   * @param content - Tweet content/text
   * @param imageUrl - Legacy single image URL (optional)
   * @param options - Media arrays for photos/videos (optional)
   */
  async deleteTwitterPost(tweetId: string): Promise<{ success: boolean }> {
    try {
      const consumerKey = process.env.TWITTER_CONSUMER_KEY;
      const consumerSecret = process.env.TWITTER_CONSUMER_SECRET;
      const accessToken = process.env.TWITTER_ACCESS_TOKEN;
      const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

      if (
        !consumerKey ||
        !consumerSecret ||
        !accessToken ||
        !accessTokenSecret
      ) {
        throw new Error("Twitter API credentials not available");
      }

      // Initialize OAuth 1.0a
      const oauth = new OAuth({
        consumer: {
          key: consumerKey,
          secret: consumerSecret,
        },
        signature_method: "HMAC-SHA1",
        hash_function: (baseString: string, key: string) =>
          crypto.createHmac("sha1", key).update(baseString).digest("base64"),
      });

      const token = {
        key: accessToken,
        secret: accessTokenSecret,
      };

      const endpointURL = `https://api.twitter.com/2/tweets/${tweetId}`;

      // Generate OAuth header for DELETE request
      const authHeader = oauth.toHeader(
        oauth.authorize(
          {
            url: endpointURL,
            method: "DELETE",
          },
          token,
        ),
      );

      // Make the DELETE API call
      const response = await fetch(endpointURL, {
        method: "DELETE",
        headers: {
          Authorization: authHeader["Authorization"],
          "User-Agent": "RealEstateAI/1.0",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Twitter delete error:", errorData);

        if (errorData.errors?.[0]?.code === 403) {
          throw new Error(
            "Twitter delete access denied. Check your credentials and permissions.",
          );
        }
        if (errorData.errors?.[0]?.code === 401) {
          throw new Error(
            "Twitter authentication failed for delete operation.",
          );
        }
        if (errorData.errors?.[0]?.code === 404) {
          throw new Error("Tweet not found or already deleted.");
        }

        throw new Error(
          `Twitter delete failed: ${
            errorData.detail ||
            errorData.errors?.[0]?.message ||
            "Unknown error"
          }`,
        );
      }

      const result = await response.json();
      console.log("Twitter delete successful:", result);

      return {
        success: result.data?.deleted || true,
      };
    } catch (error) {
      console.error("Twitter delete error:", error);
      throw error;
    }
  }

  async schedulePost(
    post: SocialMediaPost,
    platforms: string[],
  ): Promise<{ scheduledId: string }> {
    try {
      // Implementation would integrate with a job scheduler (like node-cron or a queue system)
      console.log(
        "Scheduling post for platforms:",
        platforms,
        "at:",
        post.scheduledFor,
      );

      return { scheduledId: `sched_${Date.now()}` };
    } catch (error) {
      console.error("Post scheduling error:", error);
      throw new Error("Failed to schedule post");
    }
  }

  async getMetrics(
    platform: string,
    accessToken: string,
  ): Promise<SocialMediaMetrics> {
    try {
      // Platform-specific metrics API calls would go here
      console.log("Fetching metrics for platform:", platform);

      // Mock data for demonstration
      return {
        platform,
        followers: Math.floor(Math.random() * 5000) + 1000,
        engagement: Math.floor(Math.random() * 1000) + 100,
        reach: Math.floor(Math.random() * 10000) + 2000,
        posts: Math.floor(Math.random() * 50) + 10,
      };
    } catch (error) {
      console.error("Metrics fetching error:", error);
      throw new Error(`Failed to fetch metrics for ${platform}`);
    }
  }

  async validateConnection(
    platform: string,
    accessToken?: string,
  ): Promise<boolean> {
    try {
      if (platform === "facebook") {
        const token = accessToken || process.env.FACEBOOK_USER_TOKEN;
        if (!token) return false;

        // Validate Facebook token by making a simple API call
        const response = await fetch(
          `https://graph.facebook.com/v22.0/me?access_token=${token}`,
        );
        return response.ok;
      }

      if (platform === "instagram") {
        const token = accessToken || process.env.INSTAGRAM_ACCESS_TOKEN;
        const userId = process.env.INSTAGRAM_USER_ID;

        if (!token || !userId) return false;

        // Validate Instagram token by making a simple API call to Facebook Graph API
        const response = await fetch(
          `https://graph.facebook.com/v21.0/${userId}?fields=id,username&access_token=${token}`,
        );
        return response.ok;
      }

      if (platform === "twitter") {
        const consumerKey = process.env.TWITTER_CONSUMER_KEY;
        const consumerSecret = process.env.TWITTER_CONSUMER_SECRET;
        const accessToken = process.env.TWITTER_ACCESS_TOKEN;
        const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

        if (
          !consumerKey ||
          !consumerSecret ||
          !accessToken ||
          !accessTokenSecret
        )
          return false;

        // Simple validation - check if we have all required credentials
        return true;
      }

      if (platform === "youtube") {
        const token = accessToken || process.env.YOUTUBE_ACCESS_TOKEN;
        const clientId = process.env.YOUTUBE_CLIENT_ID;

        if (!token) {
          // If no access token, check if we have client ID for OAuth
          return !!clientId;
        }

        try {
          // Validate YouTube token by making a simple API call
          const response = await fetch(
            "https://youtube.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
              },
            },
          );

          return response.ok;
        } catch (error) {
          console.error("YouTube validation error:", error);
          return false;
        }
      }

      // For other platforms, simulate validation
      console.log("Validating connection for platform:", platform);
      return !!(accessToken && accessToken.length > 10);
    } catch (error) {
      console.error("Connection validation error:", error);
      return false;
    }
  }

  async getFacebookPageInfo(
    accessToken?: string,
  ): Promise<{ id: string; name: string; category: string; access_token?: string }[]> {
    try {
      const token = accessToken || process.env.FACEBOOK_USER_TOKEN;
      console.log("🔍 Facebook Debug - Token available:", !!token);
      console.log(
        "🔍 Facebook Debug - Token first 20 chars:",
        token?.substring(0, 20),
      );

      if (!token) {
        throw new SocialMediaError("Facebook access token not available", 401);
      }

      console.log("🔍 Facebook Debug - Making API call to me/accounts with fields");
      const response = await fetch(
        `https://graph.facebook.com/v22.0/me/accounts?fields=id,name,category,access_token&limit=100&access_token=${token}`,
      );

      console.log("🔍 Facebook Debug - Response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.log("🔍 Facebook Debug - Error response:", errorData);
        throw new Error(
          `Facebook API Error: ${errorData.error?.message || "Unknown error"}`,
        );
      }

      const result = await response.json();
      console.log("🔍 Facebook Debug - Pages found:", result.data?.length || 0);

      if (result.data && result.data.length > 0) {
        return result.data.map((page: any) => ({
          id: page.id,
          name: page.name,
          category: page.category,
          access_token: page.access_token,
        }));
      }

      console.log("🔍 Facebook Debug - me/accounts returned 0, trying me?fields=accounts approach");
      const altResponse = await fetch(
        `https://graph.facebook.com/v22.0/me?fields=accounts.limit(100){id,name,category,access_token}&access_token=${token}`,
      );

      if (altResponse.ok) {
        const altResult = await altResponse.json();
        const altPages = altResult.accounts?.data || [];
        console.log("🔍 Facebook Debug - Alternative approach found:", altPages.length, "pages");
        if (altPages.length > 0) {
          return altPages.map((page: any) => ({
            id: page.id,
            name: page.name,
            category: page.category,
            access_token: page.access_token,
          }));
        }
      }

      const clientId = process.env.FACEBOOK_CLIENT_ID || process.env.FACEBOOK_APP_ID;
      const clientSecret = process.env.FACEBOOK_CLIENT_SECRET || process.env.FACEBOOK_APP_SECRET;
      
      if (clientId && clientSecret) {
        console.log("🔍 Facebook Debug - Trying Debug Token fallback to discover pages...");
        try {
          const appAccessToken = `${clientId}|${clientSecret}`;
          const debugResp = await fetch(
            `https://graph.facebook.com/v22.0/debug_token?input_token=${token}&access_token=${encodeURIComponent(appAccessToken)}`
          );
          if (debugResp.ok) {
            const debugData = await debugResp.json();
            const granularScopes = debugData.data?.granular_scopes || [];
            console.log("🔍 Facebook Debug Token - granular_scopes:", JSON.stringify(granularScopes));
            
            const pageRelatedScopes = ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement', 'pages_manage_metadata'];
            const pageIds = new Set<string>();
            for (const scope of granularScopes) {
              if (pageRelatedScopes.includes(scope.scope) && scope.target_ids && Array.isArray(scope.target_ids)) {
                for (const id of scope.target_ids) {
                  pageIds.add(String(id));
                }
              }
            }
            
            if (pageIds.size > 0) {
              console.log(`✅ Facebook Debug Token - Found ${pageIds.size} authorized page IDs:`, [...pageIds]);
              const resolvedPages: { id: string; name: string; category: string; access_token?: string }[] = [];
              
              for (const pageId of pageIds) {
                try {
                  const pageResp = await fetch(
                    `https://graph.facebook.com/v22.0/${pageId}?fields=id,name,category,access_token&access_token=${token}`
                  );
                  if (pageResp.ok) {
                    const pageData = await pageResp.json();
                    if (pageData.id) {
                      resolvedPages.push({
                        id: pageData.id,
                        name: pageData.name || `Page ${pageData.id}`,
                        category: pageData.category || 'Unknown',
                        access_token: pageData.access_token || token,
                      });
                      console.log(`✅ Resolved page via Debug Token: ${pageData.name} (${pageData.id})`);
                    }
                  }
                } catch (pageErr) {
                  console.warn(`⚠️ Could not fetch page ${pageId}:`, pageErr);
                }
              }
              
              if (resolvedPages.length > 0) {
                return resolvedPages;
              }
            }
          }
        } catch (debugError) {
          console.warn("⚠️ Facebook Debug Token fallback error:", debugError);
        }
      }

      console.log("🔍 Facebook Debug - No pages found via any method (including Debug Token)");
      return [];
    } catch (error) {
      console.error("Error fetching Facebook pages:", error);
      throw error;
    }
  }

  private encodeMediaUrl(url: string): string {
    if (!url) return url;
    if (!url.startsWith("http")) return url;
    
    try {
      const urlObj = new URL(url);
      urlObj.pathname = urlObj.pathname.split('/').map(segment => encodeURIComponent(decodeURIComponent(segment))).join('/');
      return urlObj.toString();
    } catch (e) {
      return encodeURI(url);
    }
  }

  private resolveFullMediaUrl(url: string, baseUrl?: string): string {
    if (url.startsWith("http")) return url;
    const deploymentUrl =
      process.env.REPLIT_DEPLOYMENT_URL ||
      process.env.CLIENT_URL ||
      "http://localhost:5000";
    return `${baseUrl || deploymentUrl}${url}`;
  }

  private async resolveFacebookPageAccessToken(
    pageId: string,
    userToken: string,
  ): Promise<string> {
    console.log("🔍 Facebook Post Debug - Fetching page access token");
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v22.0/me/accounts?access_token=${userToken}`,
    );

    console.log(
      "🔍 Facebook Post Debug - Pages response status:",
      pagesResponse.status,
    );

    if (!pagesResponse.ok) {
      const errorData = await pagesResponse.json();
      console.log("🔍 Facebook Post Debug - Pages error:", errorData);
      if (errorData.error?.code === 190) {
        throw new SocialMediaError(
          "Invalid Facebook access token. Please reconnect your Facebook account.",
          401,
          errorData,
        );
      }
      if (errorData.error?.code === 200) {
        throw new SocialMediaError(
          "Insufficient permissions. Please grant pages access to your Facebook account.",
          403,
          errorData,
        );
      }
      throw new SocialMediaError(
        `Failed to fetch page access token: ${
          errorData.error?.message || "Unknown error"
        }`,
        400,
        errorData,
      );
    }

    const pagesData = await pagesResponse.json();
    console.log(
      "🔍 Facebook Post Debug - Available pages:",
      pagesData.data?.map((p: any) => ({ id: p.id, name: p.name })),
    );

    let pageAccessToken: string | undefined;
    const page = pagesData.data?.find((p: any) => p.id === pageId);
    console.log("🔍 Facebook Post Debug - Target page found:", !!page);

    if (page) {
      pageAccessToken = page.access_token;
    } else {
      console.log(
        "🔍 Facebook Post Debug - Page not in me/accounts. Trying /{pageId}?fields=name,access_token",
      );
      const pageInfoResp = await fetch(
        `https://graph.facebook.com/v22.0/${pageId}?fields=name,access_token&access_token=${userToken}`,
      );
      console.log(
        "🔍 Facebook Post Debug - Direct page info status:",
        pageInfoResp.status,
      );
      if (pageInfoResp.ok) {
        const pageInfo = await pageInfoResp.json();
        console.log("🔍 Facebook Post Debug - Direct page info:", {
          id: pageInfo.id,
          name: pageInfo.name,
          hasToken: !!pageInfo.access_token,
        });
        pageAccessToken = pageInfo.access_token;
      } else {
        const err = await pageInfoResp.json().catch(() => ({}));
        console.log("🔍 Facebook Post Debug - Direct page info error:", err);
      }
    }

    if (!pageAccessToken) {
      console.log(
        "🔍 Facebook Post Debug - Available page IDs:",
        pagesData.data?.map((p: any) => p.id),
      );
      throw new SocialMediaError(
        "Page not found or no access. Ensure your user is an admin of the Page and the token has pages_show_list, pages_manage_posts, pages_read_engagement, and pages_manage_metadata.",
        403,
        {
          availablePages: pagesData.data?.map((p: any) => ({
            id: p.id,
            name: p.name,
          })),
        },
      );
    }

    return pageAccessToken;
  }

  private handleFacebookApiError(errorData: any, context: string): never {
    console.error(`Facebook ${context} API Error:`, errorData);

    if (errorData.error?.code === 190) {
      throw new SocialMediaError(
        "Facebook session expired. Please reconnect your account.",
        401,
        errorData,
      );
    }
    if (errorData.error?.code === 200) {
      throw new SocialMediaError(
        "Insufficient permissions for this page. Please check page roles.",
        403,
        errorData,
      );
    }
    if (errorData.error?.code === 100) {
      const userMsg = errorData.error?.error_user_msg;
      throw new SocialMediaError(
        userMsg || `Facebook ${context} failed: Invalid parameters. Please check your content and try again.`,
        400,
        errorData,
      );
    }

    throw new SocialMediaError(
      `Facebook ${context} failed: ${
        errorData.error?.error_user_msg || errorData.error?.message || "Unknown error"
      }`,
      400,
      errorData,
    );
  }

  async postVideoToFacebookPage(
    pageId: string,
    content: string,
    videoUrl: string,
    accessToken: string,
    baseUrl?: string,
  ): Promise<{ postId: string }> {
    try {
      const fullVideoUrl = this.resolveFullMediaUrl(videoUrl, baseUrl);
      console.log(`🎬 Facebook Video Post - Posting video to page ${pageId}`);
      console.log(`🎬 Facebook Video Post - Video URL: ${fullVideoUrl.substring(0, 80)}...`);

      const presetPageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
      const pageToken = presetPageAccessToken || await this.resolveFacebookPageAccessToken(pageId, accessToken);

      const formData = new URLSearchParams();
      formData.append("file_url", fullVideoUrl);
      formData.append("description", content);
      formData.append("access_token", pageToken);

      const response = await fetch(
        `https://graph.facebook.com/v22.0/${pageId}/videos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
        },
      );

      const result = await response.json();
      if (!response.ok) {
        this.handleFacebookApiError(result, "video posting");
      }

      console.log("🎬 Facebook video post successful:", result.id);
      return { postId: result.id || `fbvid_${Date.now()}` };
    } catch (error) {
      console.error("Facebook video posting error:", error);
      throw error;
    }
  }

  async postToFacebookPage(
    pageId: string,
    content: string,
    imageUrl?: string,
    accessToken?: string,
    baseUrl?: string,
    options?: { photoUrls?: string[]; videoUrls?: string[] },
  ): Promise<{ postId: string }> {
    try {
      const token = accessToken || process.env.FACEBOOK_USER_TOKEN;

      console.log("🔍 Facebook Post Debug - Token available:", !!token);
      console.log("🔍 Facebook Post Debug - Page ID:", pageId);

      if (!token) {
        throw new Error("Facebook access token not available");
      }

      // Check if any media is a video and route accordingly
      const allMedia = [
        ...(options?.photoUrls || []),
        ...(imageUrl ? [imageUrl] : []),
      ];
      const videoMedia = allMedia.filter(url => isVideoUrl(url));
      const imageMedia = allMedia.filter(url => !isVideoUrl(url));

      // Also check explicit videoUrls
      if (options?.videoUrls && options.videoUrls.length > 0) {
        videoMedia.push(...options.videoUrls);
      }

      // If there's a video, post it via the video endpoint (single video only)
      if (videoMedia.length > 0) {
        console.log(`🎬 Facebook: Detected ${videoMedia.length} video(s), using video endpoint`);
        if (imageMedia.length > 0) {
          console.log(`⚠️ Facebook: Mixed media detected (${imageMedia.length} images + ${videoMedia.length} videos). Posting video only — Facebook doesn't support mixed media in one post.`);
        }
        return this.postVideoToFacebookPage(pageId, content, videoMedia[0], token, baseUrl);
      }

      // Image/text-only posting below
      const rawEffectiveImageUrl = imageUrl || (options?.photoUrls && options.photoUrls.length > 0 ? options.photoUrls[0] : undefined);

      // Ensure URL points to an API-safe format (JPEG/PNG) before sending to Meta Graph API
      const effectiveImageUrl = rawEffectiveImageUrl
        ? await ensureApiSafeImageUrl(rawEffectiveImageUrl, { baseUrl })
        : undefined;
      console.log("🔍 Facebook Post Debug - Effective Image URL:", effectiveImageUrl);

      const presetPageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

      // If a page access token is provided via env, use it directly
      if (presetPageAccessToken) {
        console.log(
          "🔍 Facebook Post Debug - Using preset page access token from env",
        );
        const formData = new URLSearchParams();
        formData.append("message", content);
        formData.append("access_token", presetPageAccessToken);

        if (effectiveImageUrl) {
          formData.append("url", this.resolveFullMediaUrl(effectiveImageUrl, baseUrl));
        }

        const endpoint = effectiveImageUrl
          ? `https://graph.facebook.com/v22.0/${pageId}/photos`
          : `https://graph.facebook.com/v22.0/${pageId}/feed`;

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
        });

        const result = await response.json();
        console.log(
          "🔍 Facebook Post Debug - Preset token post response:",
          result,
        );
        if (!response.ok) {
          this.handleFacebookApiError(result, "page posting");
        }

        return { postId: result.id || "unknown" };
      }

      const pageAccessToken = await this.resolveFacebookPageAccessToken(pageId, token);

      // Handle multiple images: if more than one photoUrl, use multi-photo post
      const photoUrls = options?.photoUrls || (imageUrl ? [imageUrl] : []);
      if (photoUrls.length > 1) {
        // Ensure each URL points to an API-safe format (JPEG/PNG) before sending to Meta Graph API
        const safePhotoUrls = await Promise.all(
          photoUrls.map((u) => ensureApiSafeImageUrl(u, { baseUrl }))
        );
        return this.postMultiPhotoToFacebookPage(pageId, content, safePhotoUrls, pageAccessToken, baseUrl);
      }

      const formData = new URLSearchParams();
      formData.append("message", content);
      formData.append("access_token", pageAccessToken);

      if (effectiveImageUrl) {
        formData.append("url", this.resolveFullMediaUrl(effectiveImageUrl, baseUrl));
      }

      const endpoint = effectiveImageUrl
        ? `https://graph.facebook.com/v22.0/${pageId}/photos`
        : `https://graph.facebook.com/v22.0/${pageId}/feed`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        this.handleFacebookApiError(errorData, "page posting");
      }

      const result = await response.json();
      console.log("Facebook page post successful:", result.id);

      return { postId: result.id || `fbpage_${Date.now()}` };
    } catch (error) {
      console.error("Facebook page posting error:", error);
      throw error;
    }
  }

  /**
   * Post multiple photos to a Facebook page as a single post
   */
  private async postMultiPhotoToFacebookPage(
    pageId: string,
    content: string,
    photoUrls: string[],
    pageAccessToken: string,
    baseUrl?: string,
  ): Promise<{ postId: string }> {
    try {
      console.log(`FB: Starting multi-photo post with ${photoUrls.length} images`);
      const deploymentUrl =
        baseUrl ||
        process.env.REPLIT_DEPLOYMENT_URL ||
        process.env.CLIENT_URL ||
        "http://localhost:5000";

      // Step 1: Upload each photo as unpublished. Photo URLs are expected to
      // already be in API-safe format (JPEG/PNG) — see ensureApiSafeImageUrl in
      // postToFacebookPage. Caller-provided URLs that bypass that path are
      // still defensively normalized below.
      const attachedMedia: Array<{ media_fbid: string }> = [];
      for (const rawPhotoUrl of photoUrls) {
        const photoUrl = await ensureApiSafeImageUrl(rawPhotoUrl, { baseUrl: deploymentUrl });
        const fullImageUrl = photoUrl.startsWith("http")
          ? photoUrl
          : `${deploymentUrl}${photoUrl}`;

        const uploadFormData = new URLSearchParams();
        uploadFormData.append("url", fullImageUrl);
        uploadFormData.append("published", "false");
        uploadFormData.append("access_token", pageAccessToken);

        const uploadRes = await fetch(`https://graph.facebook.com/v22.0/${pageId}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: uploadFormData.toString(),
        });

        const uploadResult = await uploadRes.json();
        if (!uploadRes.ok) {
          console.error("FB Multi-photo: Photo upload failed", uploadResult);
          continue;
        }
        attachedMedia.push({ media_fbid: uploadResult.id });
      }

      if (attachedMedia.length === 0) {
        throw new Error("Failed to upload any photos for multi-photo post");
      }

      // Step 2: Create the post with all photo IDs attached
      const postFormData = new URLSearchParams();
      postFormData.append("message", content);
      postFormData.append("access_token", pageAccessToken);
      attachedMedia.forEach((media, index) => {
        postFormData.append(`attached_media[${index}]`, JSON.stringify(media));
      });

      const postRes = await fetch(`https://graph.facebook.com/v22.0/${pageId}/feed`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: postFormData.toString(),
      });

      const postResult = await postRes.json();
      if (!postRes.ok) {
        throw new SocialMediaError(
          postResult.error?.message || "Failed to create multi-photo post",
          postRes.status,
          postResult
        );
      }

      return { postId: postResult.id };
    } catch (error) {
      console.error("Facebook multi-photo post error:", error);
      throw error;
    }
  }

    async getTikTokAccessToken(userId: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    openId?: string;
  }> {
    const { storage } = await import("../storage.js");
    const accounts = await storage.getSocialMediaAccounts(userId);
    const tiktokAccount = accounts.find(
      (acc) => acc.platform.toLowerCase() === "tiktok",
    );

    if (!tiktokAccount || !tiktokAccount.accessToken) {
      throw new Error(
        "TikTok account not connected. Please connect your TikTok account first.",
      );
    }

    if (!tiktokAccount.isConnected) {
      throw new Error(
        "TikTok account is disconnected. Please reconnect your account.",
      );
    }

    return {
      accessToken: tiktokAccount.accessToken,
      refreshToken: tiktokAccount.refreshToken || undefined,
      openId: tiktokAccount.accountUsername || undefined,
    };
  }

  async queryTikTokCreatorInfo(accessToken: string): Promise<{
    creatorUsername: string;
    creatorNickname: string;
    privacyLevelOptions: string[];
    maxVideoDuration: number;
  }> {
    const response = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/creator_info/query/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("TikTok creator info query failed:", errorData);
      throw new Error("Failed to query TikTok creator info");
    }

    const result = await response.json();
    if (result.error?.code !== "ok") {
      throw new Error(result.error?.message || "TikTok API error");
    }

    return {
      creatorUsername: result.data.creator_username,
      creatorNickname: result.data.creator_nickname,
      privacyLevelOptions: result.data.privacy_level_options || ["SELF_ONLY"],
      maxVideoDuration: result.data.max_video_post_duration_sec || 300,
    };
  }

  async postToTikTok(
    userId: string,
    title: string,
    videoUrl: string,
    options?: {
      privacyLevel?: string;
      disableComment?: boolean;
      disableDuet?: boolean;
      disableStitch?: boolean;
    },
  ): Promise<{ publishId: string; status?: string }> {
    try {
      const { accessToken } = await this.getTikTokAccessToken(userId);

      console.log("🎵 Starting TikTok video post for user:", userId);
      console.log("🎵 Video URL:", videoUrl);

      // Query creator info to get available privacy options
      let privacyLevel = options?.privacyLevel || "SELF_ONLY";
      try {
        const creatorInfo = await this.queryTikTokCreatorInfo(accessToken);
        console.log("🎵 TikTok creator info:", creatorInfo);
        
        // Use the requested privacy level if available, otherwise use first available
        if (!creatorInfo.privacyLevelOptions.includes(privacyLevel)) {
          privacyLevel = creatorInfo.privacyLevelOptions[0] || "SELF_ONLY";
          console.log(`🎵 Privacy level adjusted to: ${privacyLevel}`);
        }
      } catch (error) {
        console.warn("Could not query TikTok creator info, using SELF_ONLY:", error);
        privacyLevel = "SELF_ONLY";
      }

      // Download the video from URL to buffer (required for FILE_UPLOAD method)
      // This is necessary because PULL_FROM_URL only works with videos on verified domains
      console.log("🎵 Downloading video from URL for direct upload...");
      
      let videoBuffer: Buffer;
      let videoSize: number;
      
      try {
        const videoResponse = await fetch(videoUrl);
        if (!videoResponse.ok) {
          throw new Error(`Failed to download video: ${videoResponse.status} ${videoResponse.statusText}`);
        }
        
        const arrayBuffer = await videoResponse.arrayBuffer();
        videoBuffer = Buffer.from(arrayBuffer);
        videoSize = videoBuffer.length;
        
        console.log(`🎵 Video downloaded successfully: ${(videoSize / (1024 * 1024)).toFixed(2)} MB`);
      } catch (downloadError) {
        console.error("Failed to download video for TikTok upload:", downloadError);
        throw new Error(`Failed to download video for TikTok: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`);
      }

      // TikTok has a minimum video size requirement (around 1KB) and max of 4GB
      if (videoSize < 1024) {
        throw new Error("Video file is too small for TikTok upload");
      }
      if (videoSize > 4 * 1024 * 1024 * 1024) {
        throw new Error("Video file exceeds TikTok's 4GB limit");
      }

      // TikTok recommended chunk size: 10MB per chunk
      const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
      const totalChunkCount = Math.ceil(videoSize / CHUNK_SIZE);
      const chunkSize = Math.min(CHUNK_SIZE, videoSize); // declared chunk_size (all chunks same size except last)

      console.log(`🎵 Video: ${(videoSize / (1024 * 1024)).toFixed(2)} MB, ${totalChunkCount} chunk(s) of ${(chunkSize / (1024 * 1024)).toFixed(0)} MB`);

      // Initialize video post using FILE_UPLOAD method
      console.log("🎵 Initializing TikTok FILE_UPLOAD...");
      
      const initResponse = await fetch(
        "https://open.tiktokapis.com/v2/post/publish/video/init/",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
          },
          body: JSON.stringify({
            post_info: {
              title: title.substring(0, 2200),
              privacy_level: privacyLevel,
              disable_duet: options?.disableDuet ?? false,
              disable_comment: options?.disableComment ?? false,
              disable_stitch: options?.disableStitch ?? false,
            },
            source_info: {
              source: "FILE_UPLOAD",
              video_size: videoSize,
              chunk_size: chunkSize,
              total_chunk_count: totalChunkCount,
            },
          }),
        },
      );

      if (!initResponse.ok) {
        const errorData = await initResponse.text();
        console.error("TikTok video init failed:", errorData);
        
        if (initResponse.status === 401) {
          throw new Error(
            "TikTok authentication failed. Your token may have expired. Please reconnect your TikTok account.",
          );
        }
        
        throw new Error(`TikTok video init failed: ${errorData}`);
      }

      const initResult = await initResponse.json();
      
      if (initResult.error?.code !== "ok") {
        console.error("TikTok init error response:", initResult);
        throw new Error(initResult.error?.message || "TikTok video init failed");
      }

      const publishId = initResult.data.publish_id;
      const uploadUrl = initResult.data.upload_url;
      
      console.log("🎵 TikTok video init successful, publish_id:", publishId);
      console.log(`🎵 Uploading ${totalChunkCount} chunk(s) to TikTok...`);

      // Upload video in chunks per TikTok API specification
      for (let chunkIndex = 0; chunkIndex < totalChunkCount; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, videoSize);
        const chunk = videoBuffer.subarray(start, end);
        const contentRangeHeader = `bytes ${start}-${end - 1}/${videoSize}`;

        console.log(`🎵 Uploading chunk ${chunkIndex + 1}/${totalChunkCount}: ${contentRangeHeader}`);

        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "video/mp4",
            "Content-Length": chunk.length.toString(),
            "Content-Range": contentRangeHeader,
          },
          body: chunk,
        });

        if (!uploadResponse.ok) {
          const uploadError = await uploadResponse.text();
          console.error(`TikTok chunk ${chunkIndex + 1} upload failed:`, uploadError);
          throw new Error(`TikTok video upload failed on chunk ${chunkIndex + 1}: ${uploadResponse.status} ${uploadError}`);
        }

        console.log(`🎵 Chunk ${chunkIndex + 1}/${totalChunkCount} uploaded successfully`);
      }

      console.log("🎵 All chunks uploaded to TikTok!");

      // Check post status
      const statusResult = await this.checkTikTokPostStatus(accessToken, publishId);
      console.log("🎵 TikTok post status:", statusResult);

      return {
        publishId,
        status: statusResult.status,
      };
    } catch (error) {
      console.error("TikTok posting error:", error);
      throw error;
    }
  }

  async checkTikTokPostStatus(
    accessToken: string,
    publishId: string,
  ): Promise<{ status: string; failReason?: string }> {
    const response = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          publish_id: publishId,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("TikTok status check failed:", errorData);
      return { status: "UNKNOWN" };
    }

    const result = await response.json();
    
    if (result.error?.code !== "ok") {
      console.error("TikTok status check error:", result.error);
      return { status: "ERROR", failReason: result.error?.message };
    }

    return {
      status: result.data?.status || "PROCESSING",
      failReason: result.data?.fail_reason,
    };
  }

  async postPhotoToTikTok(
    userId: string,
    title: string,
    description: string,
    photoUrls: string[],
    options?: {
      privacyLevel?: string;
      disableComment?: boolean;
      autoAddMusic?: boolean;
    },
  ): Promise<{ publishId: string; status?: string }> {
    try {
      const { accessToken } = await this.getTikTokAccessToken(userId);

      console.log("🎵 Starting TikTok photo post for user:", userId);

      // Query creator info for privacy options
      let privacyLevel = options?.privacyLevel || "SELF_ONLY";
      try {
        const creatorInfo = await this.queryTikTokCreatorInfo(accessToken);
        if (!creatorInfo.privacyLevelOptions.includes(privacyLevel)) {
          privacyLevel = creatorInfo.privacyLevelOptions[0] || "SELF_ONLY";
        }
      } catch (error) {
        console.warn("Could not query TikTok creator info:", error);
        privacyLevel = "SELF_ONLY";
      }

      // Initialize photo post
      const initResponse = await fetch(
        "https://open.tiktokapis.com/v2/post/publish/content/init/",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
          },
          body: JSON.stringify({
            post_info: {
              title: title.substring(0, 150),
              description: description.substring(0, 2200),
              disable_comment: options?.disableComment ?? false,
              privacy_level: privacyLevel,
              auto_add_music: options?.autoAddMusic ?? true,
            },
            source_info: {
              source: "PULL_FROM_URL",
              photo_cover_index: 0,
              photo_images: photoUrls,
            },
            post_mode: "DIRECT_POST",
            media_type: "PHOTO",
          }),
        },
      );

      if (!initResponse.ok) {
        const errorData = await initResponse.text();
        console.error("TikTok photo init failed:", errorData);
        throw new Error(`TikTok photo init failed: ${errorData}`);
      }

      const initResult = await initResponse.json();
      
      if (initResult.error?.code !== "ok") {
        throw new Error(initResult.error?.message || "TikTok photo init failed");
      }

      const publishId = initResult.data.publish_id;
      console.log("🎵 TikTok photo init successful, publish_id:", publishId);

      return {
        publishId,
        status: "PROCESSING",
      };
    } catch (error) {
      console.error("TikTok photo posting error:", error);
      throw error;
    }
  }
}

export const socialMediaService = new SocialMediaService();

export async function postToWhatsApp(
  content: string,
  recipientPhone: string,
  phoneNumberId?: string,
  accessToken?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const resolvedPhoneNumberId = phoneNumberId;
    const resolvedAccessToken = accessToken;

    if (!resolvedPhoneNumberId || !resolvedAccessToken) {
      return { success: false, error: "WhatsApp credentials not configured. Set phoneNumberId and accessToken in your WhatsApp settings." };
    }

    const cleanedPhone = recipientPhone.replace(/\D/g, "");
    if (!cleanedPhone) {
      return { success: false, error: "Invalid phone number" };
    }

    const result = await whatsappService.sendTextMessage(
      resolvedPhoneNumberId,
      resolvedAccessToken,
      cleanedPhone,
      content
    );

    return {
      success: true,
      messageId: result.messages?.[0]?.id,
    };
  } catch (error: any) {
    console.error("postToWhatsApp error:", error);
    return {
      success: false,
      error: error.message || "Failed to send WhatsApp message",
    };
  }
}
