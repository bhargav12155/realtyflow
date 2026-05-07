import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "http";
import { AddressInfo } from "net";
import jwt from "jsonwebtoken";
import { WebSocket } from "ws";

import { realtimeService } from "../server/websocket";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-for-presence";

function makeToken(userId: string) {
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
  await new Promise<void>((resolve) =>
    httpServer.listen(0, "127.0.0.1", resolve),
  );
  const addr = httpServer.address() as AddressInfo;
  baseUrl = `ws://127.0.0.1:${addr.port}/ws`;
});

after(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

function openSocket(userId: string): Promise<{
  ws: WebSocket;
  messages: any[];
  /** Wait for the next message — already buffered or yet to arrive — that
   *  matches `predicate`. A consumption cursor advances past each returned
   *  message so callers can drive a sequence of state transitions without
   *  picking up stale state from earlier in the test. */
  waitForNext: (predicate: (msg: any) => boolean, timeoutMs?: number) => Promise<any>;
}> {
  const messages: any[] = [];
  let cursor = 0;
  const waiters: Array<{
    predicate: (msg: any) => boolean;
    resolve: (msg: any) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  }> = [];

  function tryDispatch(): void {
    // Each pending waiter consumes the first message at-or-after the cursor
    // that satisfies its predicate; the cursor then advances past it so a
    // subsequent waiter cannot re-claim the same message.
    outer: while (waiters.length > 0) {
      const w = waiters[0];
      for (let i = cursor; i < messages.length; i++) {
        if (w.predicate(messages[i])) {
          cursor = i + 1;
          clearTimeout(w.timer);
          waiters.shift();
          w.resolve(messages[i]);
          continue outer;
        }
      }
      return;
    }
  }

  const ws = new WebSocket(`${baseUrl}?token=${makeToken(userId)}`);
  ws.on("message", (raw) => {
    let parsed: any;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      return;
    }
    // Skip the welcome notification emitted on connect so test waiters
    // never have to filter for it manually.
    if (
      parsed.type === "notification" &&
      parsed.data?.message?.includes("Connected")
    ) {
      return;
    }
    messages.push(parsed);
    tryDispatch();
  });

  function waitForNext(
    predicate: (msg: any) => boolean,
    timeoutMs = 5000,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = waiters.findIndex((w) => w.timer === timer);
        if (idx !== -1) waiters.splice(idx, 1);
        reject(
          new Error(
            `timed out waiting for matching ws message (cursor=${cursor}, total=${messages.length}); received: ${JSON.stringify(
              messages.map((m) => `${m.type}:${JSON.stringify(m.data)}`),
            )}`,
          ),
        );
      }, timeoutMs);
      waiters.push({ predicate, resolve, reject, timer });
      tryDispatch();
    });
  }

  return new Promise((resolve, reject) => {
    ws.once("open", () => resolve({ ws, messages, waitForNext }));
    ws.once("error", reject);
  });
}

function send(ws: WebSocket, payload: unknown) {
  ws.send(JSON.stringify(payload));
}

describe("Board presence over the websocket", () => {
  // Helper: have A and B both join `boardId` and resolve once both sockets
  // have observed each other in a [A, B] viewer broadcast.
  async function joinBoth(
    a: { ws: WebSocket; waitForNext: any },
    b: { ws: WebSocket; waitForNext: any },
    boardId: string,
  ) {
    send(a.ws, { type: "presence_join", boardId });
    await a.waitForNext(
      (m: any) =>
        m.type === "board_presence" &&
        m.data.boardId === boardId &&
        m.data.viewers.length === 1,
    );
    send(b.ws, { type: "presence_join", boardId });
    const aBoth = await a.waitForNext(
      (m: any) =>
        m.type === "board_presence" &&
        m.data.boardId === boardId &&
        m.data.viewers.length === 2,
    );
    const bBoth = await b.waitForNext(
      (m: any) =>
        m.type === "board_presence" &&
        m.data.boardId === boardId &&
        m.data.viewers.length === 2,
    );
    assert.deepEqual(
      aBoth.data.viewers.map((v: any) => v.userId).sort(),
      ["presence-user-a", "presence-user-b"],
    );
    assert.deepEqual(
      bBoth.data.viewers.map((v: any) => v.userId).sort(),
      ["presence-user-a", "presence-user-b"],
    );
  }

  it(
    "broadcasts an updated viewer list to remaining viewers when one user sends presence_leave",
    async () => {
      const boardId = "board-presence-leave";
      const a = await openSocket("presence-user-a");
      const b = await openSocket("presence-user-b");
      await joinBoth(a, b, boardId);

      // B sends an explicit presence_leave; A must be told the new list.
      send(b.ws, { type: "presence_leave", boardId });
      const aAfterLeave = await a.waitForNext(
        (m) =>
          m.type === "board_presence" &&
          m.data.boardId === boardId &&
          m.data.viewers.length === 1,
      );
      assert.deepEqual(
        aAfterLeave.data.viewers.map((v: any) => v.userId),
        ["presence-user-a"],
      );
      assert.deepEqual(
        realtimeService.getBoardViewers(boardId).map((v) => v.userId),
        ["presence-user-a"],
      );

      a.ws.close();
      b.ws.close();
    },
  );

  it(
    "broadcasts an updated viewer list when a viewer's socket closes without an explicit leave",
    async () => {
      const boardId = "board-presence-close";
      const a = await openSocket("presence-user-a");
      const b = await openSocket("presence-user-b");
      await joinBoth(a, b, boardId);

      // Closing B's socket must remove B from the server-side presence map
      // and broadcast an updated viewer list to A — without waiting for an
      // explicit presence_leave from the closing client.
      b.ws.terminate();
      const aAfterClose = await a.waitForNext(
        (m) =>
          m.type === "board_presence" &&
          m.data.boardId === boardId &&
          m.data.viewers.length === 1,
      );
      assert.deepEqual(
        aAfterClose.data.viewers.map((v: any) => v.userId),
        ["presence-user-a"],
      );
      assert.deepEqual(
        realtimeService.getBoardViewers(boardId).map((v) => v.userId),
        ["presence-user-a"],
      );

      a.ws.close();
    },
  );

  it(
    "fans typing events out to other viewers but never echoes them back to the sender",
    async () => {
      const boardId = "board-presence-typing";
      const a = await openSocket("presence-typing-a");
      const b = await openSocket("presence-typing-b");

      send(a.ws, { type: "presence_join", boardId });
      send(b.ws, { type: "presence_join", boardId });
      // Wait until both sockets agree there are 2 viewers — typing fan-out
      // depends on the presence map being populated for both users.
      await a.waitForNext(
        (m) =>
          m.type === "board_presence" &&
          m.data.boardId === boardId &&
          m.data.viewers.length === 2,
      );
      await b.waitForNext(
        (m) =>
          m.type === "board_presence" &&
          m.data.boardId === boardId &&
          m.data.viewers.length === 2,
      );

      // Drain any further board_presence noise so subsequent assertions only
      // see typing events.
      const aBefore = a.messages.length;

      // A starts typing — B must receive the event, A must NOT.
      send(a.ws, { type: "typing", boardId, isTyping: true });
      const bTyping = await b.waitForNext(
        (m) => m.type === "board_typing" && m.data.boardId === boardId,
      );
      assert.equal(bTyping.data.userId, "presence-typing-a");
      assert.equal(bTyping.data.isTyping, true);

      // Give the server a beat to (incorrectly) echo back, then assert it
      // didn't. We allow other unrelated message types but not board_typing.
      await new Promise((r) => setTimeout(r, 50));
      const echoed = a.messages
        .slice(aBefore)
        .some((m) => m.type === "board_typing");
      assert.equal(
        echoed,
        false,
        "sender should not receive their own board_typing events",
      );

      // A stops typing — B receives the matching false update.
      send(a.ws, { type: "typing", boardId, isTyping: false });
      const bStopped = await b.waitForNext(
        (m) =>
          m.type === "board_typing" &&
          m.data.userId === "presence-typing-a" &&
          m.data.isTyping === false,
      );
      assert.equal(bStopped.data.isTyping, false);

      a.ws.close();
      b.ws.close();
    },
  );

  it(
    "fans cursor moves out to other viewers, never echoes them back, and respects isLeave",
    async () => {
      const boardId = "board-presence-cursor";
      const a = await openSocket("presence-cursor-a");
      const b = await openSocket("presence-cursor-b");

      send(a.ws, { type: "presence_join", boardId });
      send(b.ws, { type: "presence_join", boardId });
      // Wait until both sockets agree there are 2 viewers — cursor fan-out
      // depends on the presence map being populated for both users.
      await a.waitForNext(
        (m) =>
          m.type === "board_presence" &&
          m.data.boardId === boardId &&
          m.data.viewers.length === 2,
      );
      await b.waitForNext(
        (m) =>
          m.type === "board_presence" &&
          m.data.boardId === boardId &&
          m.data.viewers.length === 2,
      );

      const aBefore = a.messages.length;

      // A pings a cursor position — B must receive a board_cursor with the
      // rounded coordinates and A's userId, and A must NOT see its own.
      send(a.ws, { type: "cursor", boardId, x: 123.7, y: 456.2 });
      const bCursor = await b.waitForNext(
        (m) => m.type === "board_cursor" && m.data.boardId === boardId,
      );
      assert.equal(bCursor.data.userId, "presence-cursor-a");
      assert.equal(bCursor.data.isLeave, false);
      assert.equal(bCursor.data.x, 124);
      assert.equal(bCursor.data.y, 456);

      await new Promise((r) => setTimeout(r, 50));
      const echoed = a.messages
        .slice(aBefore)
        .some((m) => m.type === "board_cursor");
      assert.equal(
        echoed,
        false,
        "sender should not receive their own board_cursor events",
      );

      // A leaves — B receives an isLeave packet with null coords so it can
      // clear the cursor immediately instead of waiting for the idle timer.
      send(a.ws, { type: "cursor", boardId, isLeave: true });
      const bLeave = await b.waitForNext(
        (m) =>
          m.type === "board_cursor" &&
          m.data.userId === "presence-cursor-a" &&
          m.data.isLeave === true,
      );
      assert.equal(bLeave.data.x, null);
      assert.equal(bLeave.data.y, null);

      a.ws.close();
      b.ws.close();
    },
  );
});
