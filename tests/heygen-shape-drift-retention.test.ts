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
  InsertHeygenShapeDriftIncident,
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
};

const originalPrune =
  (storage as MutableStorage).pruneHeygenShapeDriftIncidents.bind(storage);

afterEach(() => {
  (storage as MutableStorage).pruneHeygenShapeDriftIncidents = originalPrune;
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
