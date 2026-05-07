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

// End-to-end coverage against the real (test) Postgres database. We do
// NOT stub any of the storage methods here — instead we let
// `runShapeDriftRetentionSweep` call into the actual Drizzle-backed
// `pruneHeygenShapeDriftIncidents` + `recordHeygenShapeDriftRetentionRun`,
// then make a real HTTP GET against the admin endpoint that reads via
// `listHeygenShapeDriftRetentionRuns`. This catches schema drift, SQL
// mapping bugs, and JSON serialization regressions that the per-method
// spies above cannot.
import { db } from "../server/db";
import {
  heygenShapeDriftIncidents,
  heygenShapeDriftRetentionRuns,
} from "@shared/schema";
import { gte, like } from "drizzle-orm";

// Each test gets its own unique fixture tag so its inserts can be
// distinguished from any rows that other processes (e.g. the dev
// server, a concurrent test file, or a prior crashed run that didn't
// clean up after itself) may have written to the same Postgres tables.
let currentTestTag = "";
let testStartedAt = new Date(0);

function makeTestTag(): string {
  return `e2e-retention-test-${process.pid}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function endpointPrefix(tag: string): string {
  return `/v3/${tag}/`;
}

async function clearTestRetentionRows(tag: string): Promise<void> {
  // Only delete rows this test created. Both audit tables are shared
  // with the running dev server in development, so a wholesale wipe
  // could race with a real incident insert and either lose production
  // data or leave the test asserting against rows it did not own.
  await db
    .delete(heygenShapeDriftIncidents)
    .where(like(heygenShapeDriftIncidents.endpoint, `${endpointPrefix(tag)}%`));
  await db
    .delete(heygenShapeDriftRetentionRuns)
    .where(gte(heygenShapeDriftRetentionRuns.createdAt, testStartedAt));
}

async function seedOldIncidents(
  count: number,
  ageDays: number,
): Promise<void> {
  // Insert `count` incidents with explicit `created_at` values older
  // than the retention window so the sweep actually deletes them.
  const cutoff = new Date(Date.now() - (ageDays + 1) * 24 * 60 * 60 * 1000);
  for (let i = 0; i < count; i++) {
    await db.insert(heygenShapeDriftIncidents).values({
      endpoint: `${endpointPrefix(currentTestTag)}${i}`,
      issuePaths: [`data.test.${i}`],
      message: `${currentTestTag} seeded incident ${i}`,
      userId: null,
      groupId: null,
      createdAt: cutoff,
    });
  }
}

// All test-scoped reads (DB + API) filter by `createdAt >= testStartedAt`
// so concurrent writers (dev server, other workers) cannot inject phantom
// rows into our assertions.
function selectTestRetentionRuns() {
  return db
    .select()
    .from(heygenShapeDriftRetentionRuns)
    .where(gte(heygenShapeDriftRetentionRuns.createdAt, testStartedAt));
}

function selectTestIncidentIds() {
  return db
    .select({ id: heygenShapeDriftIncidents.id })
    .from(heygenShapeDriftIncidents)
    .where(
      like(
        heygenShapeDriftIncidents.endpoint,
        `${endpointPrefix(currentTestTag)}%`,
      ),
    );
}

function filterApiRunsToThisTest(
  runs: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  // The GET endpoint returns every retention run in the table; scope
  // it down to rows created during this specific test so concurrent
  // inserts elsewhere can't fail our length/order assertions.
  const startMs = testStartedAt.getTime();
  return runs.filter((r) => {
    const t = new Date(r.createdAt as string).getTime();
    return Number.isFinite(t) && t >= startMs;
  });
}

describe("end-to-end: runShapeDriftRetentionSweep -> GET /retention-runs (real DB)", () => {
  let app: express.Express;

  beforeEach(async () => {
    currentTestTag = makeTestTag();
    // Anchor the start-of-test boundary just before any inserts. We
    // subtract 1ms because Postgres `now()` is evaluated server-side
    // and could be a hair earlier than the JS clock under skew, and
    // we want strictly-greater-than-or-equal to include our own rows.
    testStartedAt = new Date(Date.now() - 1);
    await clearTestRetentionRows(currentTestTag);
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

  afterEach(async () => {
    await clearTestRetentionRows(currentTestTag);
  });

  it("persists an audit row to the DB and the GET endpoint returns it", async () => {
    process.env.HEYGEN_SHAPE_DRIFT_RETENTION_DAYS = "5";
    await seedOldIncidents(4, 5);

    // Sanity: the GET endpoint sees no rows from this test to start.
    {
      const { status, body } = await getJson(
        app,
        "/api/v3/admin/heygen-shape-drift-retention-runs",
      );
      assert.equal(status, 200);
      const startRuns = filterApiRunsToThisTest(
        body.runs as Array<Record<string, unknown>>,
      );
      assert.deepEqual(startRuns, []);
    }

    const deleted = await runShapeDriftRetentionSweep();
    assert.equal(deleted, 4);

    // Confirm the row exists in the DB itself before hitting the API,
    // so a failure in the GET path is unambiguously a handler bug.
    const dbRows = await selectTestRetentionRuns();
    assert.equal(dbRows.length, 1);
    assert.equal(dbRows[0].deletedCount, 4);
    assert.equal(dbRows[0].retentionDays, 5);
    assert.ok(typeof dbRows[0].id === "string" && dbRows[0].id.length > 0);

    // Now walk the GET endpoint; the handler must return the same row.
    const { status, body } = await getJson(
      app,
      "/api/v3/admin/heygen-shape-drift-retention-runs",
    );
    assert.equal(status, 200);
    const apiRuns = filterApiRunsToThisTest(
      body.runs as Array<Record<string, unknown>>,
    );
    assert.equal(apiRuns.length, 1);
    assert.equal(apiRuns[0].id, dbRows[0].id);
    assert.equal(apiRuns[0].deletedCount, 4);
    assert.equal(apiRuns[0].retentionDays, 5);
    // createdAt is serialized over the wire as an ISO date string.
    assert.equal(typeof apiRuns[0].createdAt, "string");
    assert.ok(
      !Number.isNaN(new Date(apiRuns[0].createdAt as string).getTime()),
      "createdAt must round-trip as a parseable date",
    );

    // And the real prune actually removed the seeded rows.
    const remaining = await selectTestIncidentIds();
    assert.equal(remaining.length, 0);
  });

  it("orders multiple sweeps newest-first via the real list query", async () => {
    process.env.HEYGEN_SHAPE_DRIFT_RETENTION_DAYS = "7";
    // No seeded incidents — each sweep records an audit row with
    // `deletedCount: 0`, but with distinct `retention_days` so we can
    // unambiguously assert sort order.
    await runShapeDriftRetentionSweep();

    process.env.HEYGEN_SHAPE_DRIFT_RETENTION_DAYS = "8";
    await runShapeDriftRetentionSweep();

    process.env.HEYGEN_SHAPE_DRIFT_RETENTION_DAYS = "9";
    // Pin the two existing rows to a fixed instant just inside this
    // test's window so they stay visible to `selectTestRetentionRuns`
    // (which filters by `createdAt >= testStartedAt`) but are still
    // strictly older than the next sweep's row at millisecond
    // precision. Sleep briefly so the next `now()` is provably after.
    const pinnedAt = new Date(testStartedAt.getTime() + 1);
    await db
      .update(heygenShapeDriftRetentionRuns)
      .set({ createdAt: pinnedAt })
      .where(gte(heygenShapeDriftRetentionRuns.createdAt, testStartedAt));
    await new Promise((r) => setTimeout(r, 5));
    await runShapeDriftRetentionSweep();

    const { status, body } = await getJson(
      app,
      "/api/v3/admin/heygen-shape-drift-retention-runs",
    );
    assert.equal(status, 200);
    const apiRuns = filterApiRunsToThisTest(
      body.runs as Array<Record<string, unknown>>,
    );
    assert.equal(apiRuns.length, 3);
    // Newest (retentionDays=9) must be first.
    assert.equal(apiRuns[0].retentionDays, 9);
    // The other two retentionDays values must both be present.
    const remainingDays = [apiRuns[1].retentionDays, apiRuns[2].retentionDays];
    assert.deepEqual(
      [...remainingDays].sort(),
      [7, 8],
      "older two rows should contain retentionDays 7 and 8",
    );
    for (const r of apiRuns) {
      assert.equal(r.deletedCount, 0);
    }
  });

  it("still persists an audit row when the sweep deleted nothing", async () => {
    process.env.HEYGEN_SHAPE_DRIFT_RETENTION_DAYS = "30";
    // No incidents seeded — sweep deletes 0 rows.
    await runShapeDriftRetentionSweep();

    const dbRows = await selectTestRetentionRuns();
    assert.equal(dbRows.length, 1);
    assert.equal(dbRows[0].deletedCount, 0);
    assert.equal(dbRows[0].retentionDays, 30);

    const { body } = await getJson(
      app,
      "/api/v3/admin/heygen-shape-drift-retention-runs",
    );
    const apiRuns = filterApiRunsToThisTest(
      body.runs as Array<Record<string, unknown>>,
    );
    assert.equal(apiRuns.length, 1);
    assert.equal(apiRuns[0].deletedCount, 0);
    assert.equal(apiRuns[0].retentionDays, 30);
  });
});

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
