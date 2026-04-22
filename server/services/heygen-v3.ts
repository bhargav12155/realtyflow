/**
 * HeyGen Photo Avatar v3 service.
 *
 * The legacy v1/v2 photo-avatar endpoints sunset on Oct 31, 2026. This service
 * targets the v3 endpoints documented at https://docs.heygen.com (Photo
 * Avatars v3, Voices, Video Generation).
 *
 * Existing v2 callers should keep using `HeyGenPhotoAvatarService` from
 * `./heygen-photo-avatar.ts` — both services can coexist while we migrate
 * features over one at a time.
 */

import {
  parseHeygenConsentResponse,
  parseHeygenV3DesignVoiceResponse,
  parseHeygenV3LooksPageResponse,
  parseHeygenV3VoicesPageResponse,
  type ConsentStatus as SharedConsentStatus,
} from "@shared/heygenPhotoAvatarSchemas";

export type ConsentStatus = SharedConsentStatus;

export interface V3CreateAvatarOptions {
  /** User-facing avatar group name. */
  name: string;
  /** HeyGen image_key returned by the upload endpoint. */
  imageKey: string;
}

export interface V3LooksPage<T = unknown> {
  data: T[];
  /** Cursor for the next page, or null when this is the final page. */
  nextCursor: string | null;
}

export interface V3VoiceQuery {
  search?: string;
  language?: string;
  gender?: string;
  cursor?: string;
}

export interface V3DesignVoiceOptions {
  name: string;
  description: string;
  language?: string;
  gender?: string;
}

export class HeyGenV3Service {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.heygen.com/v3";

  constructor() {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      throw new Error("HEYGEN_API_KEY is not set in environment variables");
    }
    this.apiKey = apiKey;
  }

  private async request<T = unknown>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: {
        "X-Api-Key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new HeyGenV3Error(
        `HeyGen v3 ${method} ${endpoint} failed (${response.status})`,
        response.status,
        text,
      );
    }

    // Some HeyGen endpoints respond 204 No Content.
    if (response.status === 204) return undefined as T;

    const json = (await response.json()) as { code?: number; data?: T; message?: string };
    if (json.code !== undefined && json.code !== 100) {
      throw new HeyGenV3Error(
        `HeyGen v3 ${method} ${endpoint} returned code ${json.code}: ${json.message ?? "unknown"}`,
        response.status,
        JSON.stringify(json),
      );
    }
    return (json.data ?? (json as unknown as T)) as T;
  }

  // ------------------------------------------------------------------
  // Avatar lifecycle
  // ------------------------------------------------------------------

  async createAvatar(opts: V3CreateAvatarOptions): Promise<{ group_id: string }> {
    return this.request<{ group_id: string }>("/photo_avatars", "POST", {
      name: opts.name,
      image_key: opts.imageKey,
    });
  }

  async listAvatarGroups(cursor?: string): Promise<V3LooksPage> {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    const data = await this.request<{ items?: unknown[]; next_cursor?: string | null }>(
      `/photo_avatars${qs}`,
    );
    return {
      data: data.items ?? [],
      nextCursor: data.next_cursor ?? null,
    };
  }

  async listLooks(groupId: string, cursor?: string): Promise<V3LooksPage> {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    const raw = await this.request<unknown>(
      `/photo_avatars/${encodeURIComponent(groupId)}/looks${qs}`,
    );
    const data = parseHeygenV3LooksPageResponse(raw, groupId);
    return {
      data: data.items ?? [],
      nextCursor: data.next_cursor ?? null,
    };
  }

  // ------------------------------------------------------------------
  // Consent
  // ------------------------------------------------------------------

  /**
   * Create a v3 consent record for a likeness. HeyGen requires this before
   * generating any new avatar or look from a real person's image.
   */
  async createConsent(params: {
    groupId: string;
    consentVideoUrl?: string;
    signature?: string;
  }): Promise<{ consent_id: string; status: ConsentStatus }> {
    const raw = await this.request<unknown>("/consent", "POST", {
      group_id: params.groupId,
      consent_video_url: params.consentVideoUrl,
      signature: params.signature,
    });
    return parseHeygenConsentResponse(raw);
  }

  // ------------------------------------------------------------------
  // Voices
  // ------------------------------------------------------------------

  async listVoices(query: V3VoiceQuery = {}): Promise<V3LooksPage> {
    const params = new URLSearchParams();
    if (query.search) params.set("search", query.search);
    if (query.language) params.set("language", query.language);
    if (query.gender) params.set("gender", query.gender);
    if (query.cursor) params.set("cursor", query.cursor);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const raw = await this.request<unknown>(`/voices${qs}`);
    const data = parseHeygenV3VoicesPageResponse(raw);
    return {
      data: data.items ?? [],
      nextCursor: data.next_cursor ?? null,
    };
  }

  /**
   * HeyGen Voice Designer — synthesises a brand-new voice from a text
   * description rather than from a recorded sample.
   */
  async designVoice(opts: V3DesignVoiceOptions): Promise<{ voice_id: string; preview_url?: string }> {
    const raw = await this.request<unknown>("/voices/design", "POST", {
      name: opts.name,
      description: opts.description,
      language: opts.language,
      gender: opts.gender,
    });
    return parseHeygenV3DesignVoiceResponse(raw);
  }
}

export class HeyGenV3Error extends Error {
  readonly status: number;
  readonly body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "HeyGenV3Error";
    this.status = status;
    this.body = body;
  }
}

/**
 * Verify the HMAC signature HeyGen attaches to webhook deliveries.
 * Returns true on a valid signature, false otherwise. The secret is read
 * from `HEYGEN_WEBHOOK_SECRET`; when unset the function returns false so
 * the caller can decide whether to accept unverified events in dev.
 */
export function verifyHeygenWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
): boolean {
  const secret = process.env.HEYGEN_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  // Lazy require to avoid pulling crypto into the client bundle.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require("crypto") as typeof import("crypto");
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  // Constant-time comparison; both buffers must be the same length.
  const sigBuf = Buffer.from(signatureHeader, "utf8");
  const expBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}
