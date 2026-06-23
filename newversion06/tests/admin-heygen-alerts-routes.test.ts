import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";

import { registerAdminHeygenAlertsRoutes } from "../server/routes/admin-heygen-alerts";
import type { HeygenAlertsSettings } from "../server/services/heygen-validation-reporter";

interface FakeStore {
  current: HeygenAlertsSettings | null;
  saves: Array<{ settings: HeygenAlertsSettings; updatedBy: string }>;
  probes: string[];
  probeResult: Awaited<
    ReturnType<typeof import("../server/services/heygen-alerts-settings").probeHeygenAlertsWebhook>
  >;
}

function buildApp(store: FakeStore): express.Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { user: { id: string } }).user = { id: "admin-1" };
    next();
  });
  registerAdminHeygenAlertsRoutes(app, {
    requireAdmin: (_req, _res, next) => next(),
    loadSettings: async () => store.current,
    saveSettings: async (settings, updatedBy) => {
      store.saves.push({ settings, updatedBy });
      store.current = settings;
      return settings;
    },
    probeWebhook: async (url) => {
      store.probes.push(url);
      return store.probeResult;
    },
  });
  return app;
}

async function request(
  app: express.Express,
  method: string,
  url: string,
  body?: unknown,
): Promise<{ status: number; body: any }> {
  return await new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      try {
        const port = (server.address() as { port: number }).port;
        const init: RequestInit = {
          method,
          headers: { "Content-Type": "application/json" },
        };
        if (body !== undefined) init.body = JSON.stringify(body);
        const r = await fetch(`http://127.0.0.1:${port}${url}`, init);
        const text = await r.text();
        const parsed = text ? JSON.parse(text) : {};
        server.close(() => resolve({ status: r.status, body: parsed }));
      } catch (err) {
        server.close(() => reject(err));
      }
    });
  });
}

describe("admin-heygen-alerts routes", () => {
  let store: FakeStore;
  let originalEnv: string | undefined;

  beforeEach(() => {
    store = {
      current: null,
      saves: [],
      probes: [],
      probeResult: { ok: true },
    };
    originalEnv = process.env.HEYGEN_BURST_SLACK_WEBHOOK_URL;
    delete process.env.HEYGEN_BURST_SLACK_WEBHOOK_URL;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.HEYGEN_BURST_SLACK_WEBHOOK_URL;
    } else {
      process.env.HEYGEN_BURST_SLACK_WEBHOOK_URL = originalEnv;
    }
  });

  it("GET returns defaults when nothing is configured", async () => {
    const app = buildApp(store);
    const res = await request(app, "GET", "/api/admin/heygen-alerts/settings");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, {
      settings: { enabled: false, webhookUrl: null },
      source: "default",
      envFallbackConfigured: false,
    });
  });

  it("GET reports env fallback when secret is set", async () => {
    process.env.HEYGEN_BURST_SLACK_WEBHOOK_URL = "https://hooks.slack/x";
    const app = buildApp(store);
    const res = await request(app, "GET", "/api/admin/heygen-alerts/settings");
    assert.equal(res.status, 200);
    assert.equal(res.body.source, "env");
    assert.equal(res.body.envFallbackConfigured, true);
    assert.equal(res.body.settings.enabled, true);
    assert.equal(res.body.settings.webhookUrl, null);
  });

  it("GET returns admin-saved settings when present", async () => {
    store.current = {
      enabled: true,
      webhookUrl: "https://hooks.slack/admin",
    };
    const app = buildApp(store);
    const res = await request(app, "GET", "/api/admin/heygen-alerts/settings");
    assert.equal(res.status, 200);
    assert.equal(res.body.source, "admin");
    assert.deepEqual(res.body.settings, store.current);
  });

  it("PUT validates the body and rejects bad URLs", async () => {
    const app = buildApp(store);
    const res = await request(app, "PUT", "/api/admin/heygen-alerts/settings", {
      enabled: true,
      webhookUrl: "not-a-url",
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "Invalid settings");
    assert.equal(store.saves.length, 0);
  });

  it("PUT requires a webhook URL when enabled is true", async () => {
    const app = buildApp(store);
    const res = await request(app, "PUT", "/api/admin/heygen-alerts/settings", {
      enabled: true,
      webhookUrl: null,
    });
    assert.equal(res.status, 400);
    assert.match(JSON.stringify(res.body), /webhookUrl/);
    assert.equal(store.saves.length, 0);
  });

  it("PUT probes the webhook before persisting and surfaces probe failures", async () => {
    store.probeResult = {
      ok: false,
      status: 404,
      detail: "Slack webhook returned HTTP 404: no_team",
    };
    const app = buildApp(store);
    const res = await request(app, "PUT", "/api/admin/heygen-alerts/settings", {
      enabled: true,
      webhookUrl: "https://hooks.slack.example/abc",
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "Webhook test failed");
    assert.equal(res.body.status, 404);
    assert.match(res.body.detail, /no_team/);
    assert.deepEqual(store.probes, ["https://hooks.slack.example/abc"]);
    assert.equal(store.saves.length, 0);
  });

  it("PUT persists settings after a successful probe", async () => {
    const app = buildApp(store);
    const res = await request(app, "PUT", "/api/admin/heygen-alerts/settings", {
      enabled: true,
      webhookUrl: "https://hooks.slack.example/abc",
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.tested, true);
    assert.deepEqual(res.body.settings, {
      enabled: true,
      webhookUrl: "https://hooks.slack.example/abc",
    });
    assert.equal(store.saves.length, 1);
    assert.equal(store.saves[0].updatedBy, "admin-1");
  });

  it("PUT skips the probe when skipTest is true", async () => {
    const app = buildApp(store);
    const res = await request(app, "PUT", "/api/admin/heygen-alerts/settings", {
      enabled: true,
      webhookUrl: "https://hooks.slack.example/abc",
      skipTest: true,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.tested, false);
    assert.equal(store.probes.length, 0);
    assert.equal(store.saves.length, 1);
  });

  it("PUT persists a disabled state without probing", async () => {
    const app = buildApp(store);
    const res = await request(app, "PUT", "/api/admin/heygen-alerts/settings", {
      enabled: false,
      webhookUrl: null,
    });
    assert.equal(res.status, 200);
    assert.equal(store.probes.length, 0);
    assert.equal(store.saves.length, 1);
    assert.deepEqual(store.saves[0].settings, {
      enabled: false,
      webhookUrl: null,
    });
  });
});
