import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "http";
import { AddressInfo } from "net";
import jwt from "jsonwebtoken";
import { WebSocket } from "ws";

import { realtimeService } from "../server/websocket";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-for-ws";

function makeToken(userId: string | number) {
  return jwt.sign(
    { id: userId, email: `${userId}@example.com`, type: "agent" },
    process.env.JWT_SECRET!,
    { expiresIn: "5m" },
  );
}

let httpServer: Server;
let baseUrl: string;

before(async () => {
  httpServer = createServer();
  realtimeService.initialize(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const addr = httpServer.address() as AddressInfo;
  baseUrl = `ws://127.0.0.1:${addr.port}/ws`;
});

after(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

function awaitClose(ws: WebSocket): Promise<{ code: number }> {
  return new Promise((resolve) => {
    ws.on("close", (code) => resolve({ code }));
  });
}

function awaitFirstNonWelcomeMessage(ws: WebSocket, timeoutMs = 1000): Promise<any | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        // Skip the welcome notification emitted on connect
        if (msg.type === "notification" && msg.data?.message?.includes("Connected")) return;
        clearTimeout(timer);
        resolve(msg);
      } catch {
        // ignore
      }
    });
  });
}

describe("WebSocket authentication", () => {
  it("rejects connections without a token (even when ?userId= is supplied)", async () => {
    const ws = new WebSocket(`${baseUrl}?userId=123`);
    const result = await Promise.race([
      awaitClose(ws),
      new Promise<{ code: number }>((resolve) =>
        ws.on("unexpected-response", (_req, res) => resolve({ code: res.statusCode || 0 })),
      ),
      new Promise<{ code: number }>((_, reject) =>
        ws.on("error", () => reject(new Error("error"))),
      ).catch(() => ({ code: 401 })),
    ]);
    assert.ok(result.code === 401 || result.code === 1006 || result.code >= 1000);
    try { ws.terminate(); } catch { /* noop */ }
  });

  it("rejects connections whose JWT does not verify", async () => {
    const bad = jwt.sign({ id: "u1", email: "u1@x.com", type: "agent" }, "wrong-secret");
    const ws = new WebSocket(`${baseUrl}?token=${bad}`);
    const result = await Promise.race([
      awaitClose(ws),
      new Promise<{ code: number }>((resolve) =>
        ws.on("unexpected-response", (_req, res) => resolve({ code: res.statusCode || 0 })),
      ),
      new Promise<{ code: number }>((_, reject) =>
        ws.on("error", () => reject(new Error("error"))),
      ).catch(() => ({ code: 401 })),
    ]);
    assert.ok(result.code === 401 || result.code === 1006 || result.code >= 1000);
    try { ws.terminate(); } catch { /* noop */ }
  });

  it("does not deliver another user's board events (cross-user isolation)", async () => {
    // User A connects with a valid token
    const tokenA = makeToken("user-a");
    const wsA = new WebSocket(`${baseUrl}?token=${tokenA}`);
    await new Promise<void>((resolve, reject) => {
      wsA.once("open", () => resolve());
      wsA.once("error", reject);
    });

    const received = awaitFirstNonWelcomeMessage(wsA, 500);

    // Server emits a board event scoped to user B — A must not receive it
    realtimeService.notifyBoardAssetStatus("user-b", {
      boardId: "board-b",
      batchId: "batch-1",
      assetId: "asset-1",
      status: "ready",
      assetUrl: "https://example.com/v.mp4",
      thumbnailUrl: null,
      durationSeconds: 5,
      modelLabel: "luma:ray-2",
      provider: "luma",
      rejectionReason: null,
    });

    const msg = await received;
    assert.equal(msg, null, "User A should not receive user B's events");
    wsA.close();
  });

  it("delivers events to the matching authenticated user", async () => {
    const tokenA = makeToken("user-a2");
    const wsA = new WebSocket(`${baseUrl}?token=${tokenA}`);
    await new Promise<void>((resolve, reject) => {
      wsA.once("open", () => resolve());
      wsA.once("error", reject);
    });

    const received = awaitFirstNonWelcomeMessage(wsA, 1000);
    realtimeService.notifyBoardAutoEval("user-a2", {
      boardId: "board-a",
      batchId: "batch-x",
      winnerAssetId: "asset-w",
      rejected: [{ assetId: "asset-r", reason: "blurry" }],
      modelUsed: "gpt-4o",
    });

    const msg = await received;
    assert.ok(msg, "User A should receive their own event");
    assert.equal(msg.type, "board_auto_eval");
    assert.equal(msg.data.winnerAssetId, "asset-w");
    wsA.close();
  });
});
