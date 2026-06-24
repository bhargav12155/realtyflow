import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { AddressInfo } from "node:net";
import express, { type Express, type Request, type Response } from "express";
import sharp from "sharp";
import { ensureApiSafeFormat } from "../imageProcessor";

const ROUTES_PATH = path.resolve(import.meta.dirname, "..", "..", "routes.ts");

function loadRoutesSource(): string {
  return fs.readFileSync(ROUTES_PATH, "utf8");
}

interface CapturedUpload {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

// ----- Static guard against accidental regressions in routes.ts --------------

describe("HeyGen upload routes content-type guarantees (static)", () => {
  test("every HeyGen image upload call site uses safeImage.contentType (from ensureApiSafeFormat)", () => {
    const src = loadRoutesSource();

    interface CallSitePattern {
      name: string;
      regex: RegExp;
    }

    const callPatterns: CallSitePattern[] = [
      {
        name: "heygenService.uploadTalkingPhoto",
        regex: /heygenService\.uploadTalkingPhoto\s*\(([\s\S]*?)\)\s*;/g,
      },
      {
        name: "photoAvatarService.uploadCustomPhoto",
        regex: /photoAvatarService\.uploadCustomPhoto\s*\(([\s\S]*?)\)\s*;/g,
      },
      {
        name: "avatarIVService.uploadPhoto",
        regex: /avatarIVService\.uploadPhoto\s*\(([\s\S]*?)\)\s*;/g,
      },
    ];

    for (const { name, regex } of callPatterns) {
      const matches = [...src.matchAll(regex)];
      assert.ok(matches.length > 0, `expected at least one ${name} call site`);
      for (const m of matches) {
        const args = m[1];
        const idx = m.index ?? 0;
        const window = src.slice(Math.max(0, idx - 1500), idx);

        const passesSafeImageDirectly = /safeImage\.contentType/.test(args);
        const passesContentTypeLocal =
          /\bcontentType\b/.test(args) &&
          /const\s+contentType\s*=\s*safeImage\.contentType/.test(window);

        assert.ok(
          passesSafeImageDirectly || passesContentTypeLocal,
          `${name} must pass safeImage.contentType (directly or via a local 'contentType' alias). args: ${args
            .trim()
            .slice(0, 200)}`
        );

        assert.match(
          window,
          /await\s+ensureApiSafeFormat\s*\(/,
          `${name} call site must be preceded by ensureApiSafeFormat(...) in the same handler`
        );
      }
    }
  });

  test("proxy fetch uploads to /api/heygen/assets use safeImage.contentType in their Blob", () => {
    const src = loadRoutesSource();
    const fetchRegex = /fetch\(\s*`\$\{externalServiceUrl\}\/api\/heygen\/assets`/g;
    const matches = [...src.matchAll(fetchRegex)];
    assert.ok(matches.length > 0, "expected at least one /api/heygen/assets fetch call");

    for (const m of matches) {
      const idx = m.index ?? 0;
      const window = src.slice(Math.max(0, idx - 2000), idx);
      assert.match(
        window,
        /new Blob\(\[\s*safeImage\.buffer\s*\]\s*,\s*\{\s*type:\s*safeImage\.contentType\s*\}\)/,
        "proxy upload must build Blob with safeImage.buffer + safeImage.contentType"
      );
    }
  });
});

// ----- Runtime integration: actually exercise the upload pipeline ------------
//
// Spins up a small Express app whose handler mirrors the structure of every
// HeyGen image upload route in server/routes.ts: it receives a multipart-style
// payload, runs ensureApiSafeFormat, then forwards the result to a fake
// "uploader" that captures the content-type. We then POST images of every
// non-safe format the production routes might receive and assert the captured
// content-type is always image/jpeg or image/png.

async function makeBuffer(format: keyof sharp.FormatEnum, opts?: { alpha?: boolean }): Promise<Buffer> {
  const channels = opts?.alpha ? 4 : 3;
  const background = opts?.alpha
    ? { r: 0, g: 0, b: 0, alpha: 0 }
    : { r: 50, g: 100, b: 150 };
  return sharp({ create: { width: 16, height: 16, channels: channels as 3 | 4, background } })
    .toFormat(format)
    .toBuffer();
}

function buildHeygenLikeApp(captured: CapturedUpload[]): Express {
  const app = express();
  // Read the whole body as a Buffer; the route reads two headers that
  // mirror what multer would expose: x-mock-mimetype and x-mock-filename.
  app.use(express.raw({ type: "*/*", limit: "20mb" }));

  // Mirrors the structure of every HeyGen upload route in server/routes.ts:
  //   const safeImage = await ensureApiSafeFormat(buf, mime, name);
  //   await uploader(safeImage.buffer, safeImage.contentType);
  app.post("/mock-heygen-upload", async (req: Request, res: Response) => {
    try {
      const rawBuffer = req.body as Buffer;
      const declaredMime = (req.header("x-mock-mimetype") || "").toString();
      const filename = (req.header("x-mock-filename") || "").toString();

      const safeImage = await ensureApiSafeFormat(rawBuffer, declaredMime, filename);

      // Fake uploader stand-in for heygenService.uploadTalkingPhoto /
      // photoAvatarService.uploadCustomPhoto / avatarIVService.uploadPhoto.
      // It just captures what would be sent to HeyGen.
      captured.push({
        buffer: safeImage.buffer,
        contentType: safeImage.contentType,
        filename,
      });

      res.json({ ok: true, contentType: safeImage.contentType });
    } catch (err) {
      res.status(500).json({ ok: false, error: (err as Error).message });
    }
  });

  return app;
}

interface PostResult {
  status: number;
  body: { ok: boolean; contentType?: string; error?: string };
}

function postBuffer(
  port: number,
  buffer: Buffer,
  mimetype: string,
  filename: string
): Promise<PostResult> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/mock-heygen-upload",
        method: "POST",
        headers: {
          "content-type": mimetype || "application/octet-stream",
          "content-length": buffer.length,
          "x-mock-mimetype": mimetype,
          "x-mock-filename": filename,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let body: PostResult["body"];
          try {
            body = JSON.parse(text);
          } catch {
            body = { ok: false, error: text };
          }
          resolve({ status: res.statusCode || 0, body });
        });
      }
    );
    req.on("error", reject);
    req.write(buffer);
    req.end();
  });
}

describe("HeyGen upload routes content-type guarantees (runtime)", () => {
  let server: http.Server;
  let port: number;
  const captured: CapturedUpload[] = [];

  before(async () => {
    const app = buildHeygenLikeApp(captured);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    port = (server.address() as AddressInfo).port;
  });

  test.after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  });

  test("uploads of every non-safe format yield only image/jpeg or image/png downstream", async () => {
    const cases: Array<{
      label: string;
      buffer: () => Promise<Buffer>;
      mimetype: string;
      filename: string;
    }> = [
      { label: "WebP", buffer: () => makeBuffer("webp"), mimetype: "image/webp", filename: "a.webp" },
      { label: "AVIF", buffer: () => makeBuffer("avif"), mimetype: "image/avif", filename: "a.avif" },
      { label: "TIFF", buffer: () => makeBuffer("tiff"), mimetype: "image/tiff", filename: "a.tiff" },
      { label: "GIF", buffer: () => makeBuffer("gif"), mimetype: "image/gif", filename: "a.gif" },
      {
        label: "transparent PNG",
        buffer: () => makeBuffer("png", { alpha: true }),
        mimetype: "image/webp",
        filename: "a.webp",
      },
    ];

    for (const c of cases) {
      const buf = await c.buffer();
      const before = captured.length;
      const res = await postBuffer(port, buf, c.mimetype, c.filename);
      assert.equal(res.status, 200, `${c.label}: handler should succeed, got ${res.status} ${res.body.error}`);
      assert.equal(captured.length, before + 1, `${c.label}: uploader must be invoked exactly once`);
      const last = captured[captured.length - 1];
      assert.ok(
        ["image/jpeg", "image/png"].includes(last.contentType),
        `${c.label}: downstream content-type must be jpeg/png, got ${last.contentType}`
      );
      // Sanity check: the buffer the uploader received actually decodes as
      // the claimed format. This catches regressions where the contentType
      // is correct but the bytes were never re-encoded.
      const meta = await sharp(last.buffer).metadata();
      const expectedFmt = last.contentType === "image/png" ? "png" : "jpeg";
      assert.equal(meta.format, expectedFmt, `${c.label}: bytes must decode as ${expectedFmt}`);
    }
  });

  test("safe formats (JPEG, PNG) are forwarded with their original content-type", async () => {
    const jpeg = await makeBuffer("jpeg");
    const png = await makeBuffer("png");

    const r1 = await postBuffer(port, jpeg, "image/jpeg", "x.jpg");
    assert.equal(r1.status, 200);
    assert.equal(captured[captured.length - 1].contentType, "image/jpeg");

    const r2 = await postBuffer(port, png, "image/png", "x.png");
    assert.equal(r2.status, 200);
    assert.equal(captured[captured.length - 1].contentType, "image/png");
  });
});

// ----- Stress assertion across formats (no HTTP, pure function level) --------

describe("ensureApiSafeFormat output content-type contract", () => {
  test("output content-type is always image/jpeg or image/png across formats", async () => {
    const formats: Array<{ fmt: keyof sharp.FormatEnum; mime: string; ext: string }> = [
      { fmt: "jpeg", mime: "image/jpeg", ext: ".jpg" },
      { fmt: "png", mime: "image/png", ext: ".png" },
      { fmt: "webp", mime: "image/webp", ext: ".webp" },
      { fmt: "avif", mime: "image/avif", ext: ".avif" },
      { fmt: "tiff", mime: "image/tiff", ext: ".tiff" },
      { fmt: "gif", mime: "image/gif", ext: ".gif" },
    ];

    for (const { fmt, mime, ext } of formats) {
      const buf = await makeBuffer(fmt);
      const result = await ensureApiSafeFormat(buf, mime, `pic${ext}`);
      assert.ok(
        ["image/jpeg", "image/png"].includes(result.contentType),
        `format ${fmt} produced unsafe content-type ${result.contentType}`
      );
    }
  });
});
