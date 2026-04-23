import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { RealtimeService } from "../server/websocket";

// Minimal fake socket that records what's sent to it. Mirrors just enough
// of the `ws` WebSocket surface that RealtimeService.sendToClient uses.
class FakeSocket {
  static OPEN = 1;
  readyState = 1;
  sent: string[] = [];
  send(data: string) {
    this.sent.push(data);
  }
}

// Patch the global WebSocket constant the way RealtimeService imports it.
// We can't easily monkey-patch the imported `WebSocket` symbol from `ws`,
// so we rely on the FakeSocket reporting `readyState === 1` (OPEN), which
// matches `ws.WebSocket.OPEN`. RealtimeService's `sendToClient` only checks
// `ws.readyState === WebSocket.OPEN`, and `WebSocket.OPEN` is `1`.

describe("RealtimeService.broadcastAdminAlert", () => {
  let service: RealtimeService;
  let admin: FakeSocket;
  let nonAdmin: FakeSocket;

  beforeEach(async () => {
    // broadcastAdminAlert internally fires `persistAdminAlertForAdmins`
    // as a fire-and-forget promise that touches the real storage
    // singleton (and the real DB). If those background writes land
    // while a sibling test suite is monkey-patching the same singleton,
    // the writes leak into the sibling's mocks. Stub `getAllUsers` to
    // return no admins so the background persist is a no-op for this
    // suite's broadcasts. The other suite restores its own patches.
    const storageModule = (await import("../server/storage")) as unknown as {
      storage: { getAllUsers: () => Promise<unknown[]> };
    };
    storageModule.storage.getAllUsers = async () => [];

    service = new RealtimeService();
    admin = new FakeSocket();
    nonAdmin = new FakeSocket();

    // Simulate two connected clients: one admin, one regular user.
    // We poke the private fields directly because there's no test harness
    // for spinning up a real ws server in unit tests.
    const anyService = service as unknown as {
      clients: Map<string, Set<unknown>>;
      adminClients: Set<unknown>;
    };
    anyService.clients.set("admin-1", new Set([admin]));
    anyService.clients.set("user-1", new Set([nonAdmin]));
    anyService.adminClients.add(admin);
  });

  it("sends to admin sockets only and never to non-admin sockets", () => {
    service.broadcastAdminAlert({
      source: "heygen",
      severity: "error",
      title: "HeyGen response failed schema validation",
      message: "drift detected",
      context: { endpoint: "/v2/avatar_group.list" },
    });

    assert.equal(admin.sent.length, 1);
    const parsed = JSON.parse(admin.sent[0]);
    assert.equal(parsed.type, "admin_alert");
    assert.equal(parsed.data.source, "heygen");
    assert.equal(parsed.data.severity, "error");
    assert.deepEqual(parsed.data.context, {
      endpoint: "/v2/avatar_group.list",
    });

    // Critical access-control assertion: ordinary users must NOT receive
    // any admin alert payload.
    assert.equal(
      nonAdmin.sent.length,
      0,
      "non-admin sockets must not receive admin_alert messages",
    );
  });

  it("emits nothing when no admin sockets are connected", () => {
    const anyService = service as unknown as {
      adminClients: Set<unknown>;
    };
    anyService.adminClients.clear();

    service.broadcastAdminAlert({
      source: "heygen",
      severity: "warning",
      title: "drift",
      message: "no admins",
    });

    assert.equal(admin.sent.length, 0);
    assert.equal(nonAdmin.sent.length, 0);
  });

  it("getAdminSocketCount reflects the number of admin sockets", () => {
    assert.equal(service.getAdminSocketCount(), 1);
    const anyService = service as unknown as { adminClients: Set<unknown> };
    anyService.adminClients.clear();
    assert.equal(service.getAdminSocketCount(), 0);
  });
});

describe("RealtimeService.persistAdminAlertForAdmins", () => {
  // The websocket module dynamically imports `./storage` from inside
  // persistAdminAlertForAdmins, so we monkey-patch the singleton's
  // methods to act as a fake storage. The patches are restored after
  // each test to keep the suite hermetic.
  type StorageLike = {
    getAllUsers: () => Promise<Array<{ id: string; role?: string }>>;
    createNotification: (n: {
      userId: string;
      type: string;
      data: Record<string, unknown>;
    }) => Promise<{ id: string; type: string; data: Record<string, unknown> }>;
  };

  let storageModule: { storage: StorageLike };
  let originalGetAllUsers: StorageLike["getAllUsers"];
  let originalCreateNotification: StorageLike["createNotification"];
  let createdNotifications: Array<{
    userId: string;
    type: string;
    data: Record<string, unknown>;
  }>;

  beforeEach(async () => {
    storageModule = (await import("../server/storage")) as unknown as {
      storage: StorageLike;
    };
    originalGetAllUsers = storageModule.storage.getAllUsers;
    originalCreateNotification = storageModule.storage.createNotification;
    createdNotifications = [];

    storageModule.storage.getAllUsers = async () => [
      { id: "admin-1", role: "admin" },
      { id: "admin-2", role: "admin" },
      { id: "user-1", role: "user" },
      { id: "user-2" },
    ];
    let counter = 0;
    storageModule.storage.createNotification = async (n) => {
      counter += 1;
      createdNotifications.push(n);
      return { id: `nid-${counter}`, type: n.type, data: n.data };
    };
  });

  // Restore patched methods so other suites don't see test-injected fakes.
  function restore() {
    storageModule.storage.getAllUsers = originalGetAllUsers;
    storageModule.storage.createNotification = originalCreateNotification;
  }

  it("persists exactly one notification per admin user with the right type and data", async () => {
    const service = new RealtimeService();
    try {
      const anyService = service as unknown as {
        persistAdminAlertForAdmins: (payload: {
          source: string;
          severity: "info" | "warning" | "error";
          title: string;
          message: string;
          context?: Record<string, unknown>;
        }) => Promise<void>;
      };
      await anyService.persistAdminAlertForAdmins({
        source: "heygen",
        severity: "error",
        title: "drift",
        message: "schema mismatch",
        context: { endpoint: "/v2/avatar_group.list" },
      });

      // Two admins → exactly two notifications, no notifications for
      // the non-admin users.
      assert.equal(createdNotifications.length, 2);
      const adminUserIds = createdNotifications.map((n) => n.userId).sort();
      assert.deepEqual(adminUserIds, ["admin-1", "admin-2"]);

      for (const n of createdNotifications) {
        assert.equal(n.type, "admin_alert");
        assert.deepEqual(n.data, {
          source: "heygen",
          severity: "error",
          title: "drift",
          message: "schema mismatch",
          context: { endpoint: "/v2/avatar_group.list" },
        });
      }
    } finally {
      restore();
    }
  });

  it("defaults the persisted context to an empty object when omitted", async () => {
    const service = new RealtimeService();
    try {
      const anyService = service as unknown as {
        persistAdminAlertForAdmins: (payload: {
          source: string;
          severity: "info" | "warning" | "error";
          title: string;
          message: string;
        }) => Promise<void>;
      };
      await anyService.persistAdminAlertForAdmins({
        source: "heygen",
        severity: "warning",
        title: "soft drift",
        message: "non-fatal",
      });

      assert.equal(createdNotifications.length, 2);
      for (const n of createdNotifications) {
        assert.deepEqual(n.data.context, {});
      }
    } finally {
      restore();
    }
  });

  it("broadcastAdminAlert (public entrypoint) also persists one notification per admin", async () => {
    const service = new RealtimeService();
    try {
      // broadcastAdminAlert fires persistAdminAlertForAdmins as a
      // fire-and-forget promise, so we wrap createNotification with a
      // waiter that resolves once the expected number of writes land.
      const expected = 2;
      let resolveDone!: () => void;
      const done = new Promise<void>((r) => {
        resolveDone = r;
      });
      const patched = storageModule.storage.createNotification;
      storageModule.storage.createNotification = async (n) => {
        const result = await patched(n);
        if (createdNotifications.length >= expected) resolveDone();
        return result;
      };

      service.broadcastAdminAlert({
        source: "heygen",
        severity: "error",
        title: "drift via public entrypoint",
        message: "schema mismatch",
        context: { endpoint: "/v2/avatar_group.list" },
      });

      // Fail fast on regressions instead of letting node:test hang.
      await Promise.race([
        done,
        new Promise<void>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  "broadcastAdminAlert did not persist the expected number of notifications in time",
                ),
              ),
            2000,
          ),
        ),
      ]);

      assert.equal(createdNotifications.length, 2);
      const adminUserIds = createdNotifications.map((n) => n.userId).sort();
      assert.deepEqual(adminUserIds, ["admin-1", "admin-2"]);
      for (const n of createdNotifications) {
        assert.equal(n.type, "admin_alert");
        assert.deepEqual(n.data, {
          source: "heygen",
          severity: "error",
          title: "drift via public entrypoint",
          message: "schema mismatch",
          context: { endpoint: "/v2/avatar_group.list" },
        });
      }
    } finally {
      restore();
    }
  });

  it("skips notification creation for admins with an active snooze", async () => {
    // The snooze check inside persistAdminAlertForAdmins reads
    // `adminAlertSnoozedUntil` directly off the admin user row returned
    // by `getAllUsers`. Patch the user fixture so admin-1 has a future
    // snooze and admin-2 does not.
    storageModule.storage.getAllUsers = async () =>
      [
        {
          id: "admin-1",
          role: "admin",
          adminAlertSnoozedUntil: new Date(Date.now() + 60 * 60_000),
        },
        { id: "admin-2", role: "admin", adminAlertSnoozedUntil: null },
        { id: "user-1", role: "user" },
      ] as Array<{ id: string; role?: string }>;

    const service = new RealtimeService();
    try {
      const anyService = service as unknown as {
        persistAdminAlertForAdmins: (payload: {
          source: string;
          severity: "info" | "warning" | "error";
          title: string;
          message: string;
          context?: Record<string, unknown>;
        }) => Promise<void>;
      };
      await anyService.persistAdminAlertForAdmins({
        source: "heygen",
        severity: "error",
        title: "drift while snoozed",
        message: "schema mismatch",
      });

      // admin-1 is snoozed → must be skipped. admin-2 is not snoozed →
      // must still get its notification row. Non-admin users are filtered
      // out before the snooze check, so they never receive one either.
      assert.equal(createdNotifications.length, 1);
      assert.equal(createdNotifications[0].userId, "admin-2");
      assert.equal(createdNotifications[0].type, "admin_alert");
    } finally {
      restore();
    }
  });

  it("expired snoozes are ignored and the admin still gets their notification", async () => {
    storageModule.storage.getAllUsers = async () =>
      [
        {
          id: "admin-1",
          role: "admin",
          // Stale value in the past: must be treated as "not snoozed".
          adminAlertSnoozedUntil: new Date(Date.now() - 60_000),
        },
        { id: "admin-2", role: "admin", adminAlertSnoozedUntil: null },
        { id: "user-1", role: "user" },
      ] as Array<{ id: string; role?: string }>;

    const service = new RealtimeService();
    try {
      const anyService = service as unknown as {
        persistAdminAlertForAdmins: (payload: {
          source: string;
          severity: "info" | "warning" | "error";
          title: string;
          message: string;
        }) => Promise<void>;
      };
      await anyService.persistAdminAlertForAdmins({
        source: "heygen",
        severity: "warning",
        title: "no longer snoozed",
        message: "drift",
      });

      assert.equal(createdNotifications.length, 2);
      const adminUserIds = createdNotifications.map((n) => n.userId).sort();
      assert.deepEqual(adminUserIds, ["admin-1", "admin-2"]);
    } finally {
      restore();
    }
  });

  it("creates zero notifications when no admin users exist", async () => {
    storageModule.storage.getAllUsers = async () => [
      { id: "user-1", role: "user" },
      { id: "user-2" },
    ];
    const service = new RealtimeService();
    try {
      const anyService = service as unknown as {
        persistAdminAlertForAdmins: (payload: {
          source: string;
          severity: "info" | "warning" | "error";
          title: string;
          message: string;
        }) => Promise<void>;
      };
      await anyService.persistAdminAlertForAdmins({
        source: "heygen",
        severity: "info",
        title: "fyi",
        message: "no admins",
      });
      assert.equal(createdNotifications.length, 0);
    } finally {
      restore();
    }
  });
});
