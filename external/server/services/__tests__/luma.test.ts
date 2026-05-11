import { test, describe, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// Silence the chatty console.log/console.warn calls inside luma.ts. When this
// suite runs alongside other test files via `node --test`, the test runner
// streams worker stdout over IPC; very large per-test logs can intermittently
// produce "Unable to deserialize cloned data" errors in sibling test files.
const realConsoleLog = console.log;
const realConsoleWarn = console.warn;
before(() => {
  console.log = () => {};
  console.warn = () => {};
});
after(() => {
  console.log = realConsoleLog;
  console.warn = realConsoleWarn;
});

type FetchInit = Parameters<typeof fetch>[1];
interface FetchCall {
  url: string;
  init: FetchInit | undefined;
}

interface FetchResponseSpec {
  status?: number;
  body?: unknown;
  text?: string;
}

type FetchHandler = (call: FetchCall) => FetchResponseSpec | Promise<FetchResponseSpec>;

const realFetch = globalThis.fetch;
let fetchCalls: FetchCall[] = [];
let fetchHandler: FetchHandler = () => ({ status: 200, body: {} });

function installFetchStub(handler: FetchHandler) {
  fetchHandler = handler;
  fetchCalls = [];
  globalThis.fetch = (async (input: unknown, init?: unknown) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as { url?: string })?.url ?? String(input);
    const call: FetchCall = { url, init: init as FetchInit | undefined };
    fetchCalls.push(call);
    const spec = await fetchHandler(call);
    const status = spec.status ?? 200;
    const body =
      spec.text !== undefined
        ? spec.text
        : spec.body !== undefined
          ? JSON.stringify(spec.body)
          : "";
    return new Response(body, {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = realFetch;
}

const ORIG_LUMA_KEY = process.env.LUMA_API_KEY;
const ORIG_ATLAS_KEY = process.env.ATLAS_API_KEY;

function setEnv(direct?: string, atlas?: string) {
  if (direct === undefined) delete process.env.LUMA_API_KEY;
  else process.env.LUMA_API_KEY = direct;
  if (atlas === undefined) delete process.env.ATLAS_API_KEY;
  else process.env.ATLAS_API_KEY = atlas;
}

function restoreEnv() {
  if (ORIG_LUMA_KEY === undefined) delete process.env.LUMA_API_KEY;
  else process.env.LUMA_API_KEY = ORIG_LUMA_KEY;
  if (ORIG_ATLAS_KEY === undefined) delete process.env.ATLAS_API_KEY;
  else process.env.ATLAS_API_KEY = ORIG_ATLAS_KEY;
}

const { createVideoTask, getTaskStatus } = await import("../luma");

describe("luma transport selection", () => {
  beforeEach(() => {
    setEnv(undefined, undefined);
  });
  afterEach(() => {
    restoreFetch();
    restoreEnv();
  });

  test("uses direct Luma when LUMA_API_KEY is set", async () => {
    setEnv("direct-key", undefined);
    installFetchStub(() => ({ body: { id: "direct-task-1" } }));

    const result = await createVideoTask("a sunset", { model: "ray-2", aspectRatio: "16:9" });

    assert.equal(result.taskId, "direct-task-1");
    assert.equal(fetchCalls.length, 1);
    const call = fetchCalls[0];
    assert.ok(call.url.startsWith("https://api.lumalabs.ai/dream-machine/v1/generations"));
    const headers = (call.init?.headers ?? {}) as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer direct-key");
    const body = JSON.parse(call.init!.body as string);
    assert.equal(body.prompt, "a sunset");
    assert.equal(body.model, "ray-2");
    assert.equal(body.aspect_ratio, "16:9");
  });

  test("uses Atlas fallback when only ATLAS_API_KEY is set", async () => {
    setEnv(undefined, "atlas-key");
    installFetchStub(() => ({ body: { data: { id: "atlas-task-1" } } }));

    const result = await createVideoTask("a sunset", { model: "ray-flash-2" });

    assert.equal(result.taskId, "atlas-task-1");
    assert.equal(fetchCalls.length, 1);
    const call = fetchCalls[0];
    assert.equal(call.url, "https://api.atlascloud.ai/api/v1/model/generateVideo");
    const headers = (call.init?.headers ?? {}) as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer atlas-key");
    const body = JSON.parse(call.init!.body as string);
    assert.equal(body.prompt, "a sunset");
    assert.equal(body.model, "luma-ray-flash-2");
    assert.equal(body.image_url, undefined);
  });

  test("throws a clear error when no transport is configured", async () => {
    setEnv(undefined, undefined);
    installFetchStub(() => {
      throw new Error("fetch should not be called");
    });

    await assert.rejects(
      () => createVideoTask("a sunset"),
      /No Luma transport configured/
    );
    assert.equal(fetchCalls.length, 0);
  });

  test("falls back from direct to atlas when direct fails and atlas key is present", async () => {
    setEnv("bad-direct-key", "atlas-key");
    let n = 0;
    installFetchStub(() => {
      n += 1;
      if (n === 1) return { status: 500, text: "boom" };
      return { body: { data: { id: "atlas-after-fail" } } };
    });

    const result = await createVideoTask("hello");
    assert.equal(result.taskId, "atlas-after-fail");
    assert.equal(fetchCalls.length, 2);
    assert.ok(fetchCalls[0].url.includes("api.lumalabs.ai"));
    assert.ok(fetchCalls[1].url.includes("api.atlascloud.ai"));
  });
});

describe("luma atlas createVideoTask request shape", () => {
  beforeEach(() => setEnv(undefined, "atlas-key"));
  afterEach(() => {
    restoreFetch();
    restoreEnv();
  });

  test("uploads non-http(s)-hosted keyframes via uploadMedia and sends returned url", async () => {
    // Use an IP literal URL so assertSafeFetchUrl skips DNS resolution.
    const sourceImage = "https://93.184.216.34/source.jpg";
    installFetchStub((call) => {
      if (call.url === sourceImage) {
        // The image fetch performed by uploadImageToAtlas.
        return { body: {}, text: "fakeimagebytes" };
      }
      if (call.url.endsWith("/model/uploadMedia")) {
        return { body: { url: "https://atlas-cdn/example.jpg" } };
      }
      if (call.url.endsWith("/model/generateVideo")) {
        return { body: { id: "task-with-image" } };
      }
      throw new Error(`Unexpected fetch: ${call.url}`);
    });

    const result = await createVideoTask("animate this", {
      keyframeImageUrl: sourceImage,
      aspectRatio: "9:16",
      duration: "5s",
      loop: false,
    });

    assert.equal(result.taskId, "task-with-image");
    assert.equal(fetchCalls.length, 3);

    // 1) Source image fetched
    assert.equal(fetchCalls[0].url, sourceImage);

    // 2) Multipart upload to Atlas uploadMedia with auth header
    const uploadCall = fetchCalls[1];
    assert.equal(uploadCall.url, "https://api.atlascloud.ai/api/v1/model/uploadMedia");
    assert.equal(uploadCall.init?.method, "POST");
    const uploadHeaders = (uploadCall.init?.headers ?? {}) as Record<string, string>;
    assert.equal(uploadHeaders.Authorization, "Bearer atlas-key");
    assert.ok(
      uploadCall.init?.body instanceof FormData,
      "upload body should be FormData (multipart)"
    );

    // 3) generateVideo request includes the uploaded image URL and atlas model id
    const genCall = fetchCalls[2];
    assert.equal(genCall.url, "https://api.atlascloud.ai/api/v1/model/generateVideo");
    const genBody = JSON.parse(genCall.init!.body as string);
    assert.equal(genBody.model, "luma-ray-2");
    assert.equal(genBody.prompt, "animate this");
    assert.equal(genBody.aspect_ratio, "9:16");
    assert.equal(genBody.duration, "5s");
    assert.equal(genBody.loop, false);
    assert.equal(genBody.image_url, "https://atlas-cdn/example.jpg");
  });

  test("preserves the atlas-returned task ID (data.id wins over top-level id)", async () => {
    installFetchStub(() => ({ body: { id: "ignored", data: { id: "preferred-id" } } }));
    const result = await createVideoTask("foo");
    assert.equal(result.taskId, "preferred-id");
  });

  test("throws when Atlas returns no prediction ID", async () => {
    installFetchStub(() => ({ body: { data: {} } }));
    await assert.rejects(() => createVideoTask("foo"), /did not return a prediction ID/);
  });
});

describe("luma atlas getTaskStatus response normalization", () => {
  beforeEach(() => setEnv(undefined, "atlas-key"));
  afterEach(() => {
    restoreFetch();
    restoreEnv();
  });

  async function createAtlasTask(id: string): Promise<string> {
    installFetchStub(() => ({ body: { data: { id } } }));
    const result = await createVideoTask("seed");
    return result.taskId;
  }

  test("normalizes completed with videoUrl from outputs array", async () => {
    const taskId = await createAtlasTask("status-completed-1");
    installFetchStub(() => ({
      body: { data: { status: "completed", outputs: [{ url: "https://cdn/v1.mp4" }] } },
    }));
    const status = await getTaskStatus(taskId);
    assert.deepEqual(status, { status: "completed", videoUrl: "https://cdn/v1.mp4" });
  });

  test("normalizes succeeded with videoUrl from output.video_url", async () => {
    const taskId = await createAtlasTask("status-succeeded-1");
    installFetchStub(() => ({
      body: { status: "succeeded", output: { video_url: "https://cdn/v2.mp4" } },
    }));
    const status = await getTaskStatus(taskId);
    assert.deepEqual(status, { status: "completed", videoUrl: "https://cdn/v2.mp4" });
  });

  test("normalizes failed with error message from inner.error", async () => {
    const taskId = await createAtlasTask("status-failed-1");
    installFetchStub(() => ({
      body: { data: { status: "failed", error: "model exploded" } },
    }));
    const status = await getTaskStatus(taskId);
    assert.equal(status.status, "failed");
    assert.equal(status.error, "model exploded");
  });

  test("normalizes failed with object error message", async () => {
    const taskId = await createAtlasTask("status-failed-2");
    installFetchStub(() => ({
      body: { data: { status: "error", error: { message: "nested failure" } } },
    }));
    const status = await getTaskStatus(taskId);
    assert.equal(status.status, "failed");
    assert.equal(status.error, "nested failure");
  });

  test("normalizes processing", async () => {
    const taskId = await createAtlasTask("status-processing-1");
    installFetchStub(() => ({ body: { data: { status: "running" } } }));
    const status = await getTaskStatus(taskId);
    assert.deepEqual(status, { status: "processing" });
  });

  test("normalizes pending for unknown/queued states", async () => {
    const taskId = await createAtlasTask("status-pending-1");
    installFetchStub(() => ({ body: { data: { status: "queued" } } }));
    const status = await getTaskStatus(taskId);
    assert.deepEqual(status, { status: "pending" });
  });

  test("treats completed-without-url as failed", async () => {
    const taskId = await createAtlasTask("status-completed-empty");
    installFetchStub(() => ({ body: { data: { status: "completed", outputs: [] } } }));
    const status = await getTaskStatus(taskId);
    assert.equal(status.status, "failed");
    assert.match(status.error || "", /no video URL/i);
  });
});

describe("luma getTaskStatus routing across env changes", () => {
  afterEach(() => {
    restoreFetch();
    restoreEnv();
  });

  test("an Atlas-created task ID is polled against Atlas even after LUMA_API_KEY appears", async () => {
    // Create the task with only Atlas configured.
    setEnv(undefined, "atlas-key");
    installFetchStub(() => ({ body: { data: { id: "atlas-sticky-1" } } }));
    const { taskId } = await createVideoTask("foo");
    assert.equal(taskId, "atlas-sticky-1");

    // Now also set a direct key — status polling must still hit Atlas.
    setEnv("direct-key", "atlas-key");
    installFetchStub((call) => {
      if (call.url.includes("api.lumalabs.ai")) {
        throw new Error(`should not hit direct Luma for atlas task, got ${call.url}`);
      }
      assert.ok(call.url.startsWith("https://api.atlascloud.ai/api/v1/model/prediction/"));
      assert.ok(call.url.endsWith("atlas-sticky-1"));
      return { body: { data: { status: "running" } } };
    });
    const status = await getTaskStatus(taskId);
    assert.deepEqual(status, { status: "processing" });
    assert.equal(fetchCalls.length, 1);
  });
});
