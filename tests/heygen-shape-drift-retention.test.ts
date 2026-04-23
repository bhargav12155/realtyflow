import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";

import {
  getShapeDriftRetentionDays,
  runShapeDriftRetentionSweep,
} from "../server/routes/heygen-v3";
import type {
  HeygenShapeDriftIncident,
  HeygenShapeDriftRetentionRun,
  InsertHeygenShapeDriftIncident,
  InsertHeygenShapeDriftRetentionRun,
} from "@shared/schema";
import { storage } from "../server/storage";

type MutableStorage = typeof storage & {
  pruneHeygenShapeDriftIncidents: (n: number) => Promise<number>;
  recordHeygenShapeDriftIncident: (
    i: InsertHeygenShapeDriftIncident,
  ) => Promise<HeygenShapeDriftIncident>;
  listHeygenShapeDriftIncidents: (
    n?: number,
  ) => Promise<HeygenShapeDriftIncident[]>;
  recordHeygenShapeDriftRetentionRun: (
    r: InsertHeygenShapeDriftRetentionRun,
  ) => Promise<HeygenShapeDriftRetentionRun>;
  listHeygenShapeDriftRetentionRuns: (
    n?: number,
  ) => Promise<HeygenShapeDriftRetentionRun[]>;
};

const originalPrune =
  (storage as MutableStorage).pruneHeygenShapeDriftIncidents.bind(storage);
const originalRecordRun = (storage as MutableStorage)
  .recordHeygenShapeDriftRetentionRun.bind(storage);
const originalListRuns = (storage as MutableStorage)
  .listHeygenShapeDriftRetentionRuns.bind(storage);

afterEach(() => {
  (storage as MutableStorage).pruneHeygenShapeDriftIncidents = originalPrune;
  (storage as MutableStorage).recordHeygenShapeDriftRetentionRun =
    originalRecordRun;
  (storage as MutableStorage).listHeygenShapeDriftRetentionRuns =
    originalListRuns;
  delete process.env.HEYGEN_SHAPE_DRIFT_RETENTION_DAYS;
});

describe("getShapeDriftRetentionDays", () => {
  it("defaults to 30 days when env var is unset", () => {
    delete process.env.HEYGEN_SHAPE_DRIFT_RETENTION_DAYS;
    assert.equal(getShapeDriftRetentionDays(), 30);
  });

  it("respects a positive integer override", () => {
    process.env.HEYGEN_SHAPE_DRIFT_RETENTION_DAYS = "7";
    assert.equal(getShapeDriftRetentionDays(), 7);
  });

  it("falls back to 30 for non-numeric or non-positive values", () => {
    process.env.HEYGEN_SHAPE_DRIFT_RETENTION_DAYS = "not-a-number";
    assert.equal(getShapeDriftRetentionDays(), 30);
    process.env.HEYGEN_SHAPE_DRIFT_RETENTION_DAYS = "0";
    assert.equal(getShapeDriftRetentionDays(), 30);
    process.env.HEYGEN_SHAPE_DRIFT_RETENTION_DAYS = "-5";
    assert.equal(getShapeDriftRetentionDays(), 30);
  });
});

describe("runShapeDriftRetentionSweep", () => {
  it("calls storage.prune with the configured retention window", async () => {
    process.env.HEYGEN_SHAPE_DRIFT_RETENTION_DAYS = "14";
    const calls: number[] = [];
    (storage as MutableStorage).pruneHeygenShapeDriftIncidents = async (
      days: number,
    ) => {
      calls.push(days);
      return 3;
    };
    (storage as MutableStorage).recordHeygenShapeDriftRetentionRun =
      async () => ({
        id: "run-1",
        deletedCount: 0,
        retentionDays: 0,
        createdAt: new Date(),
      });
    const deleted = await runShapeDriftRetentionSweep();
    assert.deepEqual(calls, [14]);
    assert.equal(deleted, 3);
  });

  it("returns 0 and swallows storage errors so it never crashes the server", async () => {
    (storage as MutableStorage).pruneHeygenShapeDriftIncidents = async () => {
      throw new Error("db unavailable");
    };
    const deleted = await runShapeDriftRetentionSweep();
    assert.equal(deleted, 0);
  });

  it("records an audit row with the deleted count and retention window", async () => {
    process.env.HEYGEN_SHAPE_DRIFT_RETENTION_DAYS = "9";
    (storage as MutableStorage).pruneHeygenShapeDriftIncidents = async () => 7;
    const recorded: InsertHeygenShapeDriftRetentionRun[] = [];
    (storage as MutableStorage).recordHeygenShapeDriftRetentionRun = async (
      run,
    ) => {
      recorded.push(run);
      return {
        id: "run-2",
        deletedCount: run.deletedCount,
        retentionDays: run.retentionDays,
        createdAt: new Date(),
      };
    };
    await runShapeDriftRetentionSweep();
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].deletedCount, 7);
    assert.equal(recorded[0].retentionDays, 9);
  });

  it("still records an audit row when nothing was deleted", async () => {
    (storage as MutableStorage).pruneHeygenShapeDriftIncidents = async () => 0;
    const recorded: InsertHeygenShapeDriftRetentionRun[] = [];
    (storage as MutableStorage).recordHeygenShapeDriftRetentionRun = async (
      run,
    ) => {
      recorded.push(run);
      return {
        id: "run-3",
        deletedCount: run.deletedCount,
        retentionDays: run.retentionDays,
        createdAt: new Date(),
      };
    };
    await runShapeDriftRetentionSweep();
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].deletedCount, 0);
  });

  it("does not record an audit row when the prune itself fails", async () => {
    (storage as MutableStorage).pruneHeygenShapeDriftIncidents = async () => {
      throw new Error("db down");
    };
    let recordCalls = 0;
    (storage as MutableStorage).recordHeygenShapeDriftRetentionRun =
      async () => {
        recordCalls += 1;
        return {
          id: "run-x",
          deletedCount: 0,
          retentionDays: 0,
          createdAt: new Date(),
        };
      };
    await runShapeDriftRetentionSweep();
    assert.equal(recordCalls, 0);
  });

  it("ignores audit-log persistence failures so the sweep result stands", async () => {
    (storage as MutableStorage).pruneHeygenShapeDriftIncidents = async () => 4;
    (storage as MutableStorage).recordHeygenShapeDriftRetentionRun =
      async () => {
        throw new Error("audit insert failed");
      };
    const deleted = await runShapeDriftRetentionSweep();
    assert.equal(deleted, 4);
  });
});

// Exercise the DELETE admin endpoint end-to-end with the storage spy so we
// know the operator "prune now" button (or curl) wires through correctly.
async function deleteJson(
  app: express.Express,
  url: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return await new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      try {
        const port = (server.address() as { port: number }).port;
        const r = await fetch(`http://127.0.0.1:${port}${url}`, {
          method: "DELETE",
        });
        const json = (await r.json().catch(() => ({}))) as Record<
          string,
          unknown
        >;
        resolve({ status: r.status, body: json });
      } catch (e) {
        reject(e);
      } finally {
        server.close();
      }
    });
  });
}

describe("DELETE /api/v3/admin/heygen-shape-drift-incidents", () => {
  let app: express.Express;
  let pruneCalls: number[] = [];

  beforeEach(async () => {
    pruneCalls = [];
    (storage as MutableStorage).pruneHeygenShapeDriftIncidents = async (
      days: number,
    ) => {
      pruneCalls.push(days);
      return 5;
    };
    app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: { id: string } }).user = { id: "admin-1" };
      next();
    });
    const { registerHeygenV3Routes } = await import(
      "../server/routes/heygen-v3"
    );
    registerHeygenV3Routes(app, {
      requireAdmin: (_req, _res, next) => next(),
    });
  });

  it("uses the env-configured default when no query param is passed", async () => {
    process.env.HEYGEN_SHAPE_DRIFT_RETENTION_DAYS = "21";
    const { status, body } = await deleteJson(
      app,
      "/api/v3/admin/heygen-shape-drift-incidents",
    );
    assert.equal(status, 200);
    assert.equal(body.deleted, 5);
    assert.equal(body.olderThanDays, 21);
    assert.deepEqual(pruneCalls, [21]);
  });

  it("respects an explicit ?olderThanDays= override", async () => {
    const { status, body } = await deleteJson(
      app,
      "/api/v3/admin/heygen-shape-drift-incidents?olderThanDays=3",
    );
    assert.equal(status, 200);
    assert.equal(body.deleted, 5);
    assert.equal(body.olderThanDays, 3);
    assert.deepEqual(pruneCalls, [3]);
  });

  it("ignores garbage query values and falls back to the default", async () => {
    delete process.env.HEYGEN_SHAPE_DRIFT_RETENTION_DAYS;
    const { status, body } = await deleteJson(
      app,
      "/api/v3/admin/heygen-shape-drift-incidents?olderThanDays=not-a-number",
    );
    assert.equal(status, 200);
    assert.equal(body.olderThanDays, 30);
    assert.deepEqual(pruneCalls, [30]);
  });

  it("returns 500 if storage throws", async () => {
    (storage as MutableStorage).pruneHeygenShapeDriftIncidents = async () => {
      throw new Error("db down");
    };
    const { status, body } = await deleteJson(
      app,
      "/api/v3/admin/heygen-shape-drift-incidents",
    );
    assert.equal(status, 500);
    assert.equal(body.error, "shape_drift_incidents_prune_failed");
  });
});

async function getJson(
  app: express.Express,
  url: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return await new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      try {
        const port = (server.address() as { port: number }).port;
        const r = await fetch(`http://127.0.0.1:${port}${url}`);
        const json = (await r.json().catch(() => ({}))) as Record<
          string,
          unknown
        >;
        resolve({ status: r.status, body: json });
      } catch (e) {
        reject(e);
      } finally {
        server.close();
      }
    });
  });
}

describe("GET /api/v3/admin/heygen-shape-drift-retention-runs", () => {
  let app: express.Express;
  const sampleRuns: HeygenShapeDriftRetentionRun[] = [
    {
      id: "run-a",
      deletedCount: 4,
      retentionDays: 30,
      createdAt: new Date("2026-04-22T00:00:00Z"),
    },
    {
      id: "run-b",
      deletedCount: 0,
      retentionDays: 30,
      createdAt: new Date("2026-04-21T00:00:00Z"),
    },
  ];

  beforeEach(async () => {
    (storage as MutableStorage).listHeygenShapeDriftRetentionRuns =
      async () => sampleRuns;
    app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: { id: string } }).user = { id: "admin-1" };
      next();
    });
    const { registerHeygenV3Routes } = await import(
      "../server/routes/heygen-v3"
    );
    registerHeygenV3Routes(app, {
      requireAdmin: (_req, _res, next) => next(),
    });
  });

  it("returns the recent retention runs from storage", async () => {
    const { status, body } = await getJson(
      app,
      "/api/v3/admin/heygen-shape-drift-retention-runs",
    );
    assert.equal(status, 200);
    const runs = body.runs as HeygenShapeDriftRetentionRun[];
    assert.equal(runs.length, 2);
    assert.equal(runs[0].id, "run-a");
    assert.equal(runs[0].deletedCount, 4);
    assert.equal(runs[1].deletedCount, 0);
  });

  it("forwards a positive ?limit= to storage and rejects garbage", async () => {
    const limits: number[] = [];
    (storage as MutableStorage).listHeygenShapeDriftRetentionRuns = async (
      n,
    ) => {
      limits.push(n ?? -1);
      return sampleRuns;
    };
    await getJson(
      app,
      "/api/v3/admin/heygen-shape-drift-retention-runs?limit=5",
    );
    await getJson(
      app,
      "/api/v3/admin/heygen-shape-drift-retention-runs?limit=not-a-number",
    );
    assert.deepEqual(limits, [5, 30]);
  });

  it("returns 500 if storage throws", async () => {
    (storage as MutableStorage).listHeygenShapeDriftRetentionRuns =
      async () => {
        throw new Error("db down");
      };
    const { status, body } = await getJson(
      app,
      "/api/v3/admin/heygen-shape-drift-retention-runs",
    );
    assert.equal(status, 500);
    assert.equal(body.error, "shape_drift_retention_runs_failed");
  });
});
