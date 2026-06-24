import { SocialMediaError } from "./socialMedia";
import { ensureApiSafeImageUrl } from "./imageProcessor";

function getPublicBaseUrl(): string {
  return (
    process.env.REPLIT_DEPLOYMENT_URL ||
    process.env.CLIENT_URL ||
    "http://localhost:5000"
  );
}

function toAbsoluteUrl(url: string, baseUrl: string): string {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

export class FacebookService {
  /**
   * Post to a Facebook Page with support for multiple images
   */
  async postToPage(
    pageId: string,
    content: string,
    accessToken: string,
    photoUrls: string[] = []
  ): Promise<{ postId: string }> {
    try {
      console.log(`FB: Posting to page ${pageId} with ${photoUrls.length} photos`);

      const baseUrl = getPublicBaseUrl();

      // Ensure all photo URLs point to API-safe formats (JPEG/PNG) before sending
      // to Meta Graph API. WebP/AVIF/HEIC etc. may be rejected. Then resolve
      // any relative paths (like /public-objects/...) to absolute public URLs
      // since Meta fetches images by URL.
      const safePhotoUrls = await Promise.all(
        photoUrls.map(async (u) => {
          const safe = await ensureApiSafeImageUrl(u, { baseUrl });
          return toAbsoluteUrl(safe, baseUrl);
        })
      );

      if (safePhotoUrls.length > 1) {
        return this.postMultiPhoto(pageId, content, safePhotoUrls, accessToken);
      }

      const formData = new URLSearchParams();
      formData.append("message", content);
      formData.append("access_token", accessToken);

      if (safePhotoUrls.length === 1) {
        formData.append("url", safePhotoUrls[0]);
      }

      const endpoint = safePhotoUrls.length === 1
        ? `https://graph.facebook.com/v22.0/${pageId}/photos`
        : `https://graph.facebook.com/v22.0/${pageId}/feed`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new SocialMediaError(
          result.error?.message || "Failed to post to Facebook page",
          response.status,
          result
        );
      }

      return { postId: result.id };
    } catch (error) {
      console.error("Facebook post error:", error);
      throw error;
    }
  }

  private async postMultiPhoto(
    pageId: string,
    content: string,
    photoUrls: string[],
    accessToken: string
  ): Promise<{ postId: string }> {
    const attachedMedia = [];
    
    for (const url of photoUrls) {
      const uploadData = new URLSearchParams();
      uploadData.append("url", url);
      uploadData.append("published", "false");
      uploadData.append("access_token", accessToken);

      const res = await fetch(`https://graph.facebook.com/v22.0/${pageId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: uploadData.toString(),
      });

      const data = await res.json();
      if (res.ok) {
        attachedMedia.push({ media_fbid: data.id });
      }
    }

    if (attachedMedia.length === 0) {
      throw new Error("Failed to upload any photos for multi-photo post");
    }

    const postData = new URLSearchParams();
    postData.append("message", content);
    postData.append("access_token", accessToken);
    attachedMedia.forEach((m, i) => {
      postData.append(`attached_media[${i}]`, JSON.stringify(m));
    });

    const finalRes = await fetch(`https://graph.facebook.com/v22.0/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: postData.toString(),
    });

    const finalData = await finalRes.json();
    if (!finalRes.ok) {
      throw new SocialMediaError(finalData.error?.message || "Multi-photo post failed", finalRes.status, finalData);
    }

    return { postId: finalData.id };
  }
}

export const facebookService = new FacebookService();
