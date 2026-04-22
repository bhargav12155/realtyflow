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

  beforeEach(() => {
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
