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

function setEnv(direct?: string) {
  if (direct === undefined) delete process.env.LUMA_API_KEY;
  else process.env.LUMA_API_KEY = direct;
}

function restoreEnv() {
  if (ORIG_LUMA_KEY === undefined) delete process.env.LUMA_API_KEY;
  else process.env.LUMA_API_KEY = ORIG_LUMA_KEY;
}

// Stub S3 keyframe hosting so tests never touch AWS. We record the calls so we
// can assert the decoded image bytes/content-type are forwarded correctly.
const { S3UploadService } = await import("../s3Upload");
const realUploadBuffer = S3UploadService.prototype.uploadBuffer;
interface UploadCall {
  buffer: Buffer;
  key: string;
  contentType: string;
}
let uploadCalls: UploadCall[] = [];
let uploadReturn = "https://s3.example.com/hosted-keyframe.png";

function installS3Stub() {
  uploadCalls = [];
  S3UploadService.prototype.uploadBuffer = (async (
    buffer: Buffer,
    key: string,
    contentType: string
  ) => {
    uploadCalls.push({ buffer, key, contentType });
    return uploadReturn;
  }) as typeof realUploadBuffer;
}

function restoreS3() {
  S3UploadService.prototype.uploadBuffer = realUploadBuffer;
}

const { createVideoTask, getTaskStatus } = await import("../luma");

describe("luma transport selection", () => {
  beforeEach(() => setEnv(undefined));
  afterEach(() => {
    restoreFetch();
    restoreEnv();
  });

  test("uses direct Luma when LUMA_API_KEY is set", async () => {
    setEnv("direct-key");
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

  test("throws a clear error when LUMA_API_KEY is not configured", async () => {
    setEnv(undefined);
    installFetchStub(() => {
      throw new Error("fetch should not be called");
    });

    await assert.rejects(
      () => createVideoTask("a sunset"),
      /No Luma transport configured/
    );
    assert.equal(fetchCalls.length, 0);
  });

  test("surfaces a clear quota message on 402/429", async () => {
    setEnv("direct-key");
    installFetchStub(() => ({ status: 402, text: "insufficient credits" }));
    await assert.rejects(() => createVideoTask("foo"), /credits\/quota exhausted/);
  });
});

describe("luma createVideoTask keyframe hosting (image-to-video)", () => {
  beforeEach(() => {
    setEnv("direct-key");
    installS3Stub();
  });
  afterEach(() => {
    restoreFetch();
    restoreEnv();
    restoreS3();
  });

  test("hosts a base64 data: URI frame on S3 and sends the hosted URL to Luma", async () => {
    // 1x1 transparent PNG.
    const dataUri =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    uploadReturn = "https://s3.example.com/luma-keyframes/abc.png";
    installFetchStub((call) => {
      if (call.url.includes("/generations")) {
        return { body: { id: "task-with-image" } };
      }
      throw new Error(`Unexpected fetch: ${call.url}`);
    });

    const result = await createVideoTask("animate this", {
      keyframeImageUrl: dataUri,
      aspectRatio: "9:16",
      duration: "5s",
      loop: false,
    });

    assert.equal(result.taskId, "task-with-image");

    // S3 received the decoded bytes with the right content type.
    assert.equal(uploadCalls.length, 1);
    assert.equal(uploadCalls[0].contentType, "image/png");
    assert.ok(uploadCalls[0].buffer.length > 0);

    // Only the Luma generations call hits the network (no AWS via fetch).
    assert.equal(fetchCalls.length, 1);
    const genBody = JSON.parse(fetchCalls[0].init!.body as string);
    assert.equal(genBody.prompt, "animate this");
    assert.equal(genBody.aspect_ratio, "9:16");
    assert.equal(genBody.duration, "5s");
    assert.equal(genBody.loop, false);
    assert.deepEqual(genBody.keyframes, {
      frame0: { type: "image", url: "https://s3.example.com/luma-keyframes/abc.png" },
    });
  });

  test("passes an already-hosted http(s) keyframe URL straight through (no S3 upload)", async () => {
    installFetchStub(() => ({ body: { id: "task-hosted" } }));

    await createVideoTask("animate", { keyframeImageUrl: "https://cdn.example.com/frame.jpg" });

    assert.equal(uploadCalls.length, 0);
    const genBody = JSON.parse(fetchCalls[0].init!.body as string);
    assert.deepEqual(genBody.keyframes, {
      frame0: { type: "image", url: "https://cdn.example.com/frame.jpg" },
    });
  });
});

describe("luma getTaskStatus (direct) response normalization", () => {
  beforeEach(() => setEnv("direct-key"));
  afterEach(() => {
    restoreFetch();
    restoreEnv();
  });

  test("normalizes completed with assets.video", async () => {
    installFetchStub(() => ({ body: { state: "completed", assets: { video: "https://cdn/v1.mp4" } } }));
    const status = await getTaskStatus("t1");
    assert.deepEqual(status, { status: "completed", videoUrl: "https://cdn/v1.mp4" });
    assert.ok(fetchCalls[0].url.startsWith("https://api.lumalabs.ai/dream-machine/v1/generations/"));
  });

  test("normalizes failed with failure_reason", async () => {
    installFetchStub(() => ({ body: { state: "failed", failure_reason: "model exploded" } }));
    const status = await getTaskStatus("t2");
    assert.equal(status.status, "failed");
    assert.equal(status.error, "model exploded");
  });

  test("normalizes dreaming as processing", async () => {
    installFetchStub(() => ({ body: { state: "dreaming" } }));
    const status = await getTaskStatus("t3");
    assert.deepEqual(status, { status: "processing" });
  });

  test("normalizes unknown/queued states as pending", async () => {
    installFetchStub(() => ({ body: { state: "queued" } }));
    const status = await getTaskStatus("t4");
    assert.deepEqual(status, { status: "pending" });
  });

  test("treats completed-without-url as failed", async () => {
    installFetchStub(() => ({ body: { state: "completed", assets: {} } }));
    const status = await getTaskStatus("t5");
    assert.equal(status.status, "failed");
    assert.match(status.error || "", /no video URL/i);
  });

  test("throws when LUMA_API_KEY is not configured", async () => {
    setEnv(undefined);
    installFetchStub(() => {
      throw new Error("fetch should not be called");
    });
    await assert.rejects(() => getTaskStatus("t6"), /No Luma transport configured/);
    assert.equal(fetchCalls.length, 0);
  });
});
