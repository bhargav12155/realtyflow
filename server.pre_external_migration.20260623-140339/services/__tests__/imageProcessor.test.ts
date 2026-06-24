import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const require = Module.createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type HeicConvertOptions = { buffer: Buffer; format: "JPEG" | "PNG"; quality?: number };
type HeicConvertFn = (opts: HeicConvertOptions) => Promise<Uint8Array>;

// Capture the real heic-convert implementation BEFORE installing the stub
// below so the "real HEIC fixture" test can delegate to it via passthrough
// mode. Resolving once here populates require.cache with the genuine module;
// we then snapshot the exported function and overwrite the cache entry.
const realHeicConvert: HeicConvertFn = require("heic-convert");

// A minimal valid 1x1 JPEG used as the canned output of the stubbed
// heic-convert. Avoids shipping a real HEIC binary fixture while still
// exercising the full success branch of ensureApiSafeFormat.
const TINY_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
  0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
  0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
  0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
  0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d,
  0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
  0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
  0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
  0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
  0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45,
  0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
  0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
  0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
  0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3,
  0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
  0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9,
  0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
  0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4,
  0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01,
  0x00, 0x00, 0x3f, 0x00, 0xfb, 0xd0, 0xff, 0xd9,
]);

// --- Typed heic-convert stub installed before importing the SUT --------------
//
// Rationale: ensureApiSafeFormat lazily calls `await import("heic-convert")`
// from inside `convertHeicToJpeg`. ESM caches the resolved namespace on first
// use, so the stub must be installed before the SUT is imported. We populate
// require.cache (which the CJS-via-ESM bridge consults) with a Module-shaped
// record whose `exports` is our typed stub function.

interface HeicState {
  mode: "real-failure" | "stub-success" | "passthrough";
  calls: number;
  lastInput: Buffer | undefined;
}

const heicState: HeicState = {
  mode: "real-failure",
  calls: 0,
  lastInput: undefined,
};

const heicStub: HeicConvertFn = (opts) => {
  heicState.calls += 1;
  heicState.lastInput = opts?.buffer;
  if (heicState.mode === "real-failure") {
    return Promise.reject(new Error("input buffer is not a HEIC image"));
  }
  if (heicState.mode === "passthrough") {
    return realHeicConvert(opts);
  }
  return Promise.resolve(new Uint8Array(TINY_JPEG));
};

const HEIC_PATH = require.resolve("heic-convert");
const heicCacheEntry: NodeJS.Module = {
  id: HEIC_PATH,
  filename: HEIC_PATH,
  loaded: true,
  exports: heicStub,
  children: [],
  paths: [],
  path: HEIC_PATH,
  require,
  parent: null,
  isPreloading: false,
};
require.cache[HEIC_PATH] = heicCacheEntry;

// Imported AFTER the stub is installed so the inner dynamic import sees it.
const { ensureApiSafeFormat } = await import("../imageProcessor");

const RED = { r: 255, g: 0, b: 0 };
const TRANSPARENT_PIXEL = { r: 0, g: 0, b: 0, alpha: 0 };

async function makeBuffer(format: keyof sharp.FormatEnum, opts?: { alpha?: boolean }): Promise<Buffer> {
  const channels = opts?.alpha ? 4 : 3;
  const background = opts?.alpha ? TRANSPARENT_PIXEL : RED;
  const pipeline = sharp({
    create: { width: 8, height: 8, channels: channels as 3 | 4, background },
  });
  return pipeline.toFormat(format).toBuffer();
}

async function detectFormat(buf: Buffer): Promise<string | undefined> {
  return (await sharp(buf, { failOn: "none" }).metadata()).format;
}

describe("ensureApiSafeFormat", () => {
  beforeEach(() => {
    heicState.mode = "real-failure";
  });

  test("JPEG passes through without re-encoding", async () => {
    const input = await makeBuffer("jpeg");
    const result = await ensureApiSafeFormat(input, "image/jpeg", "photo.jpg");
    assert.equal(result.converted, false);
    assert.equal(result.contentType, "image/jpeg");
    assert.equal(result.buffer, input, "buffer should be the same reference (no re-encode)");
  });

  test("PNG passes through without re-encoding", async () => {
    const input = await makeBuffer("png");
    const result = await ensureApiSafeFormat(input, "image/png", "photo.png");
    assert.equal(result.converted, false);
    assert.equal(result.contentType, "image/png");
    assert.equal(result.buffer, input);
  });

  test("WebP is converted to JPEG", async () => {
    const input = await makeBuffer("webp");
    const result = await ensureApiSafeFormat(input, "image/webp", "photo.webp");
    assert.equal(result.converted, true);
    assert.equal(result.contentType, "image/jpeg");
    assert.equal(await detectFormat(result.buffer), "jpeg");
  });

  test("AVIF is converted to JPEG", async () => {
    const input = await makeBuffer("avif");
    const result = await ensureApiSafeFormat(input, "image/avif", "photo.avif");
    assert.equal(result.converted, true);
    assert.equal(result.contentType, "image/jpeg");
    assert.equal(await detectFormat(result.buffer), "jpeg");
  });

  test("TIFF is converted to JPEG", async () => {
    const input = await makeBuffer("tiff");
    const result = await ensureApiSafeFormat(input, "image/tiff", "photo.tiff");
    assert.equal(result.converted, true);
    assert.equal(result.contentType, "image/jpeg");
    assert.equal(await detectFormat(result.buffer), "jpeg");
  });

  test("GIF is converted to an API-safe format (jpeg or png)", async () => {
    // sharp always emits GIFs with an alpha channel, so output may legitimately
    // be PNG (alpha preservation) or JPEG (no alpha). Either is API-safe.
    const input = await makeBuffer("gif");
    const result = await ensureApiSafeFormat(input, "image/gif", "photo.gif");
    assert.equal(result.converted, true);
    assert.ok(["image/jpeg", "image/png"].includes(result.contentType));
    assert.ok(["jpeg", "png"].includes((await detectFormat(result.buffer)) || ""));
  });

  test("HEIC mimetype with non-HEIC bytes falls back to sharp and yields JPEG", async () => {
    const callsBefore = heicState.calls;
    const input = await makeBuffer("jpeg");
    const result = await ensureApiSafeFormat(input, "image/heic", "photo.heic");
    assert.equal(heicState.calls, callsBefore + 1, "heic-convert must be invoked first");
    assert.equal(result.converted, true);
    assert.equal(result.contentType, "image/jpeg");
    assert.equal(await detectFormat(result.buffer), "jpeg");
  });

  test("HEIC extension with non-HEIC bytes also triggers conversion", async () => {
    const input = await makeBuffer("png");
    const result = await ensureApiSafeFormat(input, "application/octet-stream", "photo.HEIF");
    assert.equal(result.converted, true);
    assert.ok(["image/jpeg", "image/png"].includes(result.contentType));
    assert.ok(["jpeg", "png"].includes((await detectFormat(result.buffer)) || ""));
  });

  test("PNG bytes mislabeled as image/jpeg are still passed through (mime-safe + format-safe)", async () => {
    const input = await makeBuffer("png");
    const result = await ensureApiSafeFormat(input, "image/jpeg", "photo.jpg");
    assert.equal(result.converted, false);
    assert.equal(result.contentType, "image/jpeg");
  });

  test("Mismatch: JPEG bytes with .webp filename are converted (extension wins)", async () => {
    const input = await makeBuffer("jpeg");
    const result = await ensureApiSafeFormat(input, "image/jpeg", "tricky.webp");
    assert.equal(result.converted, true);
    assert.equal(result.contentType, "image/jpeg");
    assert.equal(await detectFormat(result.buffer), "jpeg");
  });

  test("Mismatch: WebP bytes with .jpg filename and image/jpeg mime are converted (sharp detects webp)", async () => {
    const input = await makeBuffer("webp");
    const result = await ensureApiSafeFormat(input, "image/jpeg", "tricky.jpg");
    assert.equal(result.converted, true);
    assert.equal(result.contentType, "image/jpeg");
    assert.equal(await detectFormat(result.buffer), "jpeg");
  });

  test("Alpha channel preserved as PNG when source PNG has transparency", async () => {
    const input = await makeBuffer("png", { alpha: true });
    const meta = await sharp(input).metadata();
    assert.equal(meta.hasAlpha, true);

    const result = await ensureApiSafeFormat(input, "image/webp", "photo.webp");
    assert.equal(result.converted, true);
    assert.equal(result.contentType, "image/png");
    const outMeta = await sharp(result.buffer).metadata();
    assert.equal(outMeta.format, "png");
    assert.equal(outMeta.hasAlpha, true);
  });

  test("Alpha channel preserved as PNG when source GIF has transparency", async () => {
    const input = await makeBuffer("gif", { alpha: true });
    const result = await ensureApiSafeFormat(input, "image/gif", "photo.gif");
    assert.equal(result.converted, true);
    assert.equal(result.contentType, "image/png");
    const outMeta = await sharp(result.buffer).metadata();
    assert.equal(outMeta.format, "png");
    assert.equal(outMeta.hasAlpha, true);
  });

  test("No mimetype + no filename still produces an API-safe output for WebP", async () => {
    const input = await makeBuffer("webp");
    const result = await ensureApiSafeFormat(input);
    assert.equal(result.converted, true);
    assert.equal(result.contentType, "image/jpeg");
  });

  test("BMP input is never returned as image/bmp (either converted or rejected)", async () => {
    // libvips in this environment does not include a BMP loader, so the
    // function should fail loudly rather than silently letting BMP bytes
    // reach a HeyGen upload. This guards against regressions where a
    // BMP-extension or image/bmp mimetype could slip through unconverted.
    const bmp = Buffer.from([
      0x42, 0x4d, 70, 0, 0, 0, 0, 0, 0, 0, 54, 0, 0, 0, 40, 0, 0, 0, 2, 0, 0, 0,
      2, 0, 0, 0, 1, 0, 24, 0, 0, 0, 0, 0, 16, 0, 0, 0, 0x13, 0x0b, 0, 0, 0x13,
      0x0b, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0, 0, 0, 0xff, 0, 0, 0, 0, 0, 0,
      0xff, 0xff, 0xff, 0xff, 0, 0,
    ]);

    let result: Awaited<ReturnType<typeof ensureApiSafeFormat>> | undefined;
    let threw: Error | undefined;
    try {
      result = await ensureApiSafeFormat(bmp, "image/bmp", "photo.bmp");
    } catch (err) {
      threw = err as Error;
    }

    if (result) {
      assert.ok(
        ["image/jpeg", "image/png"].includes(result.contentType),
        `BMP must convert to jpeg/png, got ${result.contentType}`
      );
      assert.equal(result.converted, true);
    } else {
      assert.ok(threw, "BMP without a loader should throw rather than silently succeed");
    }
  });
});

describe("ensureApiSafeFormat HEIC success path (heic-convert returns valid JPEG)", () => {
  before(() => {
    heicState.mode = "stub-success";
  });

  after(() => {
    heicState.mode = "real-failure";
  });

  test("HEIC mime triggers heic-convert and yields a JPEG decoded by sharp", async () => {
    const callsBefore = heicState.calls;
    const fakeHeic = Buffer.from([1, 2, 3, 4]);
    const result = await ensureApiSafeFormat(fakeHeic, "image/heic", "photo.heic");
    assert.equal(heicState.calls, callsBefore + 1, "heic-convert stub must be called exactly once");
    assert.equal(heicState.lastInput, fakeHeic, "heic-convert receives the original buffer");
    assert.equal(result.converted, true);
    assert.equal(result.contentType, "image/jpeg");
    const meta = await sharp(result.buffer).metadata();
    assert.equal(meta.format, "jpeg");
  });

  test("HEIF extension also triggers heic-convert", async () => {
    const callsBefore = heicState.calls;
    const fakeHeif = Buffer.from([1, 2, 3, 4]);
    const result = await ensureApiSafeFormat(fakeHeif, "application/octet-stream", "photo.HEIF");
    assert.equal(heicState.calls, callsBefore + 1);
    assert.equal(result.contentType, "image/jpeg");
    assert.equal(result.converted, true);
  });

  test("HEIC mime (uppercase) and .HEIC extension are both detected", async () => {
    const callsBefore = heicState.calls;
    const result = await ensureApiSafeFormat(Buffer.from([1, 2]), "IMAGE/HEIC", "PIC.HEIC");
    assert.equal(heicState.calls, callsBefore + 1);
    assert.equal(result.contentType, "image/jpeg");
  });
});

// End-to-end check against a genuine iPhone-origin HEIC photo. The fixture
// at fixtures/iphone-sample.heic is a real HEIC file produced by an iPhone
// (HEVC Main Still Picture profile, 1320x2868 portrait — iPhone screenshot
// dimensions). The other HEIC tests stub out heic-convert; this one runs the
// real dependency end-to-end to catch regressions from heic-convert version
// upgrades, a broken libheif install, or changes to the conversion pipeline.
describe("ensureApiSafeFormat HEIC real-fixture path (heic-convert exercised end-to-end)", () => {
  before(() => {
    heicState.mode = "passthrough";
  });

  after(() => {
    heicState.mode = "real-failure";
  });

  test("decodes a real HEIC fixture and produces a valid JPEG", async () => {
    const fixturePath = join(__dirname, "fixtures", "iphone-sample.heic");
    const heicBuffer = readFileSync(fixturePath);

    // Sanity check: the fixture really is a HEIC container ('ftypheic',
    // 'ftypmif1', 'ftyphevc', etc. live at offset 4).
    const ftyp = heicBuffer.slice(4, 12).toString("ascii");
    assert.ok(
      ftyp.startsWith("ftyp"),
      `fixture must be an ISO base media file, got header ${JSON.stringify(ftyp)}`
    );

    const callsBefore = heicState.calls;
    const result = await ensureApiSafeFormat(heicBuffer, "image/heic", "iphone-sample.heic");

    assert.equal(heicState.calls, callsBefore + 1, "real heic-convert must be invoked exactly once");
    assert.equal(result.converted, true, "HEIC input must be reported as converted");
    assert.equal(result.contentType, "image/jpeg", "HEIC must be converted to JPEG");

    // JPEG SOI marker (FF D8 FF) — proves we got a real JPEG, not a fallback.
    assert.equal(result.buffer[0], 0xff, "output must start with JPEG SOI byte 0xFF");
    assert.equal(result.buffer[1], 0xd8, "output must start with JPEG SOI byte 0xD8");
    assert.equal(result.buffer[2], 0xff, "output must continue with JPEG marker 0xFF");

    // Round-trip through sharp to confirm the JPEG decodes and has sensible
    // dimensions — guards against truncated or malformed encoder output.
    const meta = await sharp(result.buffer).metadata();
    assert.equal(meta.format, "jpeg");
    assert.ok((meta.width || 0) > 0 && (meta.height || 0) > 0, "decoded JPEG must have non-zero dimensions");
  });
});
