import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { __testing, editImage, generateImage } from "../server/services/luma-agents";

const { mapAspectRatio, enforceMangaPortrait } = __testing;

// Stub the persistImageBufferPublic indirection so editImage's downloadAndPersist
// step doesn't require S3/object storage configured under tests.
type FetchCall = { url: string; init?: RequestInit };
function withMockedFetchAndKey(handler: (call: FetchCall) => Response | Promise<Response>) {
  const prevFetch = globalThis.fetch;
  const prevKey = process.env.LUMA_AGENTS_API_KEY;
  process.env.LUMA_AGENTS_API_KEY = "test-key";
  globalThis.fetch = (async (url: any, init?: RequestInit) =>
    handler({ url: String(url), init })) as any;
  return () => {
    globalThis.fetch = prevFetch;
    if (prevKey === undefined) delete process.env.LUMA_AGENTS_API_KEY;
    else process.env.LUMA_AGENTS_API_KEY = prevKey;
  };
}

describe("luma-agents editImage / generateImage wire format", () => {
  it("editImage POSTs type=image_edit with the source field set", async () => {
    const calls: FetchCall[] = [];
    const restore = withMockedFetchAndKey(async (call) => {
      calls.push(call);
      if (call.url.endsWith("/generations") && call.init?.method === "POST") {
        return new Response(
          JSON.stringify({
            id: "gen_1",
            state: "completed",
            assets: { image: "https://example.com/result.png" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      // downloadAndPersist
      return new Response(Buffer.from("fake"), {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    });
    try {
      const out = await editImage({
        prompt: "make it watercolour",
        source: "https://example.com/source.png",
        model: "uni-1-max",
        aspectRatio: "1:1",
        referenceImageUrls: ["https://example.com/extra.png"],
      });
      assert.ok(out.length > 0, "editImage should return a stored or data URL");
      const post = calls.find(
        (c) => c.url.endsWith("/generations") && c.init?.method === "POST",
      );
      assert.ok(post, "should have POSTed to /generations");
      const body = JSON.parse(String(post!.init!.body));
      assert.equal(body.type, "image_edit");
      assert.equal(body.source, "https://example.com/source.png");
      assert.equal(body.model, "uni-1-max");
      assert.equal(body.aspect_ratio, "1:1");
      assert.deepEqual(body.image_ref, ["https://example.com/extra.png"]);
    } finally {
      restore();
    }
  });

  it("generateImage POSTs type=image (no source field)", async () => {
    const calls: FetchCall[] = [];
    const restore = withMockedFetchAndKey(async (call) => {
      calls.push(call);
      if (call.url.endsWith("/generations") && call.init?.method === "POST") {
        return new Response(
          JSON.stringify({
            id: "gen_2",
            state: "completed",
            assets: { image: "https://example.com/result2.png" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(Buffer.from("fake"), {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    });
    try {
      await generateImage({ prompt: "a beach", model: "uni-1", aspectRatio: "16:9" });
      const post = calls.find(
        (c) => c.url.endsWith("/generations") && c.init?.method === "POST",
      );
      const body = JSON.parse(String(post!.init!.body));
      assert.equal(body.type, "image");
      assert.equal(body.source, undefined);
      assert.equal(body.aspect_ratio, "16:9");
    } finally {
      restore();
    }
  });

  it("editImage surfaces 401 verbatim so callers can classify it as permanent", async () => {
    const restore = withMockedFetchAndKey(async () => {
      return new Response("invalid_api_key", { status: 401 });
    });
    try {
      await assert.rejects(
        () =>
          editImage({
            prompt: "x",
            source: "https://example.com/s.png",
            model: "uni-1",
          }),
        /401/,
      );
    } finally {
      restore();
    }
  });
});

describe("luma-agents mapAspectRatio", () => {
  it("passes through the 9 supported ratios verbatim", () => {
    for (const r of ["1:1", "16:9", "9:16", "4:3", "3:4", "4:5", "5:4", "3:2", "2:3"]) {
      assert.equal(mapAspectRatio(r), r);
    }
  });
  it("maps common aliases to the closest supported ratio", () => {
    assert.equal(mapAspectRatio("square"), "1:1");
    assert.equal(mapAspectRatio("landscape"), "16:9");
    assert.equal(mapAspectRatio("portrait"), "9:16");
    assert.equal(mapAspectRatio("story"), "9:16");
  });
  it("approximates numeric ratios that aren't directly supported", () => {
    // 21:9 (~2.33) is closest to 16:9 (~1.78) among supported ratios.
    assert.equal(mapAspectRatio("21:9"), "16:9");
  });
  it("falls back to 1:1 for unparseable input", () => {
    assert.equal(mapAspectRatio(""), "1:1");
    assert.equal(mapAspectRatio(undefined), "1:1");
    assert.equal(mapAspectRatio("garbage"), "1:1");
  });
});

describe("luma-agents enforceMangaPortrait", () => {
  it("leaves non-manga styles untouched", () => {
    assert.equal(enforceMangaPortrait("16:9", "photoreal"), "16:9");
    assert.equal(enforceMangaPortrait("1:1", "illustration"), "1:1");
    assert.equal(enforceMangaPortrait("16:9"), "16:9");
  });
  it("snaps non-portrait ratios to portrait when style is manga", () => {
    assert.equal(enforceMangaPortrait("16:9", "manga"), "9:16");
    assert.equal(enforceMangaPortrait("3:2", "manga"), "2:3");
    assert.equal(enforceMangaPortrait("5:4", "manga"), "4:5");
    assert.equal(enforceMangaPortrait("4:3", "manga"), "3:4");
    assert.equal(enforceMangaPortrait("1:1", "manga"), "9:16");
  });
  it("leaves already-portrait ratios alone for manga", () => {
    assert.equal(enforceMangaPortrait("9:16", "manga"), "9:16");
    assert.equal(enforceMangaPortrait("3:4", "manga"), "3:4");
    assert.equal(enforceMangaPortrait("4:5", "manga"), "4:5");
    assert.equal(enforceMangaPortrait("2:3", "manga"), "2:3");
  });
});
