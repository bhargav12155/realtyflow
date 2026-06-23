import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  MemStorage,
  BOARD_MESSAGES_CAP,
  BOARD_MESSAGES_CAP_MIN,
  BOARD_MESSAGES_CAP_MAX,
  clampBoardMessagesCap,
} from "../server/storage";
import { db } from "../server/db";

// =====================================================
// Helpers — install a chainable stub for db.select / db.delete / db.insert
// so the storage layer can run end-to-end against captured query state
// without touching a real Postgres.
// =====================================================
type LimitCall = { limit: number };

function installDbStubs(opts: {
  // What the trim-time SELECT (...).limit(n) should return as the "keep set".
  // The real method does `if (keep.length < effectiveCap) return;`, so a
  // length >= effectiveCap is required to trigger the DELETE branch.
  keepRows: { id: string }[];
  // The row returned by INSERT INTO board_messages ... RETURNING.
  insertReturn: Record<string, unknown>;
}) {
  const limitCalls: LimitCall[] = [];
  const deleteCalls: { called: boolean }[] = [];
  const insertCalls: { values: unknown }[] = [];

  const selectStub = mock.method(db, "select", () => ({
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: (n: number) => {
            limitCalls.push({ limit: n });
            return Promise.resolve(opts.keepRows);
          },
        }),
      }),
    }),
  }));

  const insertStub = mock.method(db, "insert", () => ({
    values: (v: unknown) => {
      insertCalls.push({ values: v });
      return {
        returning: async () => [opts.insertReturn],
      };
    },
  }));

  const deleteStub = mock.method(db, "delete", () => ({
    where: async () => {
      deleteCalls.push({ called: true });
      return undefined;
    },
  }));

  return {
    limitCalls,
    deleteCalls,
    insertCalls,
    restore() {
      selectStub.mock.restore();
      insertStub.mock.restore();
      deleteStub.mock.restore();
    },
  };
}

function fakeBoard(chatHistoryCap: number) {
  return {
    id: "b1",
    userId: "u1",
    title: "B",
    isShared: false,
    chatHistoryCap,
    createdAt: new Date(),
    updatedAt: new Date(),
    isOwner: true,
  };
}

describe("clampBoardMessagesCap (per-board chat cap bounds)", () => {
  it("returns the historical default for null/undefined/non-finite values", () => {
    assert.equal(clampBoardMessagesCap(undefined), BOARD_MESSAGES_CAP);
    assert.equal(clampBoardMessagesCap(null), BOARD_MESSAGES_CAP);
    assert.equal(clampBoardMessagesCap(Number.NaN), BOARD_MESSAGES_CAP);
    assert.equal(clampBoardMessagesCap(Number.POSITIVE_INFINITY), BOARD_MESSAGES_CAP);
  });

  it("clamps below-min and above-max values to the documented bounds", () => {
    assert.equal(clampBoardMessagesCap(0), BOARD_MESSAGES_CAP_MIN);
    assert.equal(clampBoardMessagesCap(BOARD_MESSAGES_CAP_MIN - 1), BOARD_MESSAGES_CAP_MIN);
    assert.equal(clampBoardMessagesCap(BOARD_MESSAGES_CAP_MAX + 1), BOARD_MESSAGES_CAP_MAX);
    assert.equal(clampBoardMessagesCap(10_000_000), BOARD_MESSAGES_CAP_MAX);
  });

  it("floors fractional values that fall inside the allowed range", () => {
    assert.equal(clampBoardMessagesCap(150.9), 150);
  });

  it("passes through in-range integers unchanged", () => {
    assert.equal(clampBoardMessagesCap(50), 50);
    assert.equal(clampBoardMessagesCap(200), 200);
  });
});

describe("createBoardMessageForUser auto-trim respects per-board cap", () => {
  it("uses the board's chatHistoryCap (e.g. 15), not the global default of 200", async () => {
    const storage = new MemStorage();
    const customCap = 15;
    storage.getAccessibleBoardForUser = (async () => fakeBoard(customCap)) as unknown as typeof storage.getAccessibleBoardForUser;

    const stubs = installDbStubs({
      // Returning exactly cap rows triggers the DELETE branch.
      keepRows: Array.from({ length: customCap }, (_, i) => ({ id: `keep_${i}` })),
      insertReturn: {
        id: "msg_1",
        boardId: "b1",
        authorUserId: "u1",
        role: "user",
        content: "hi",
        notice: null,
        cta: null,
        createdAt: new Date(),
      },
    });

    try {
      const created = await storage.createBoardMessageForUser("b1", "u1", {
        role: "user",
        content: "hi",
      } as never);

      assert.ok(created, "the new message should be returned even when trimming runs");
      assert.equal(stubs.limitCalls.length, 1, "trim should issue exactly one keep-set SELECT");
      assert.equal(
        stubs.limitCalls[0].limit,
        customCap,
        "trim must use the per-board cap, not the global BOARD_MESSAGES_CAP default",
      );
      assert.notEqual(stubs.limitCalls[0].limit, BOARD_MESSAGES_CAP);
      assert.equal(stubs.deleteCalls.length, 1, "DELETE should fire when row count meets the cap");
    } finally {
      stubs.restore();
    }
  });

  it("falls back to the global default when the board row has no cap set", async () => {
    const storage = new MemStorage();
    const accessNoCap = {
      id: "b1",
      userId: "u1",
      title: "B",
      isShared: false,
      // chatHistoryCap intentionally omitted to simulate a legacy row.
      createdAt: new Date(),
      updatedAt: new Date(),
      isOwner: true,
    };
    storage.getAccessibleBoardForUser = (async () => accessNoCap) as unknown as typeof storage.getAccessibleBoardForUser;

    const stubs = installDbStubs({
      keepRows: Array.from({ length: BOARD_MESSAGES_CAP }, (_, i) => ({ id: `keep_${i}` })),
      insertReturn: {
        id: "msg_1",
        boardId: "b1",
        authorUserId: "u1",
        role: "user",
        content: "hi",
        notice: null,
        cta: null,
        createdAt: new Date(),
      },
    });

    try {
      await storage.createBoardMessageForUser("b1", "u1", {
        role: "user",
        content: "hi",
      } as never);
      assert.equal(stubs.limitCalls[0].limit, BOARD_MESSAGES_CAP);
    } finally {
      stubs.restore();
    }
  });

  it("clamps absurd per-board caps before issuing the trim query", async () => {
    const storage = new MemStorage();
    storage.getAccessibleBoardForUser = (async () => fakeBoard(10_000_000)) as unknown as typeof storage.getAccessibleBoardForUser;

    const stubs = installDbStubs({
      keepRows: [],
      insertReturn: {
        id: "msg_1",
        boardId: "b1",
        authorUserId: "u1",
        role: "user",
        content: "hi",
        notice: null,
        cta: null,
        createdAt: new Date(),
      },
    });

    try {
      await storage.createBoardMessageForUser("b1", "u1", {
        role: "user",
        content: "hi",
      } as never);
      assert.equal(stubs.limitCalls[0].limit, BOARD_MESSAGES_CAP_MAX);
    } finally {
      stubs.restore();
    }
  });

  it("does not run a DELETE when the message count is still below the cap", async () => {
    const storage = new MemStorage();
    const customCap = 25;
    storage.getAccessibleBoardForUser = (async () => fakeBoard(customCap)) as unknown as typeof storage.getAccessibleBoardForUser;

    const stubs = installDbStubs({
      // Fewer rows than the cap → trim returns early without deleting.
      keepRows: Array.from({ length: customCap - 1 }, (_, i) => ({ id: `keep_${i}` })),
      insertReturn: {
        id: "msg_1",
        boardId: "b1",
        authorUserId: "u1",
        role: "user",
        content: "hi",
        notice: null,
        cta: null,
        createdAt: new Date(),
      },
    });

    try {
      await storage.createBoardMessageForUser("b1", "u1", {
        role: "user",
        content: "hi",
      } as never);
      assert.equal(stubs.limitCalls[0].limit, customCap);
      assert.equal(stubs.deleteCalls.length, 0, "DELETE must not fire when below the cap");
    } finally {
      stubs.restore();
    }
  });

  it("returns undefined (and skips trimming entirely) when the user can't access the board", async () => {
    const storage = new MemStorage();
    storage.getAccessibleBoardForUser = (async () => undefined) as unknown as typeof storage.getAccessibleBoardForUser;

    const stubs = installDbStubs({
      keepRows: [],
      insertReturn: {},
    });

    try {
      const created = await storage.createBoardMessageForUser("b1", "u1", {
        role: "user",
        content: "hi",
      } as never);
      assert.equal(created, undefined);
      assert.equal(stubs.insertCalls.length, 0, "no INSERT for an unauthorized caller");
      assert.equal(stubs.limitCalls.length, 0, "no trim work when access is denied");
    } finally {
      stubs.restore();
    }
  });
});
