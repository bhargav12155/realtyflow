import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

process.env.HEYGEN_API_KEY = process.env.HEYGEN_API_KEY || "test-key";

import { HeyGenService } from "../server/services/heygen";

type FetchMock = (url: string, init?: RequestInit) => Promise<Response>;

const realFetch = global.fetch;

function mockFetchOnce(handler: FetchMock) {
  global.fetch = handler as typeof global.fetch;
}

describe("HeyGenService.cloneVoice", () => {
  beforeEach(() => {
    global.fetch = realFetch;
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("returns the cloned voice_id and preview URL on success", async () => {
    let captured: { url: string; body: unknown } | null = null;
    mockFetchOnce(async (url, init) => {
      captured = {
        url: String(url),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      };
      return new Response(
        JSON.stringify({
          code: 100,
          data: {
            voice_id: "voice_abc123",
            preview_audio_url: "https://heygen/preview.mp3",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const svc = new HeyGenService();
    const result = await svc.cloneVoice({
      audioAssetId: "asset_xyz",
      name: "Casey's Voice",
      language: "en",
      gender: "female",
    });

    assert.equal(result.voiceId, "voice_abc123");
    assert.equal(result.previewAudioUrl, "https://heygen/preview.mp3");
    assert.ok(captured, "fetch should have been called");
    assert.equal(captured!.url, "https://api.heygen.com/v1/voice/clone");
    assert.deepEqual(captured!.body, {
      audio_asset_id: "asset_xyz",
      name: "Casey's Voice",
      language: "en",
      gender: "female",
    });
  });

  it("throws a friendly message when the sample is too short", async () => {
    mockFetchOnce(async () => {
      return new Response(
        JSON.stringify({ code: 400, msg: "audio is too short for cloning" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    });

    const svc = new HeyGenService();
    await assert.rejects(
      () => svc.cloneVoice({ audioAssetId: "asset_short", name: "Short" }),
      /at least 30 seconds/i
    );
  });

  it("throws a friendly message when the plan does not allow cloning", async () => {
    mockFetchOnce(async () => {
      return new Response(JSON.stringify({ code: 401, msg: "forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    });

    const svc = new HeyGenService();
    await assert.rejects(
      () => svc.cloneVoice({ audioAssetId: "asset", name: "n" }),
      /plan/i
    );
  });
});
