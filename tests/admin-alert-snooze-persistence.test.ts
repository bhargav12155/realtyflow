import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";

import { MemStorage, isAdminAlertSnoozedFromUser } from "../server/storage";
import { db } from "../server/db";
import { users } from "@shared/schema";

// End-to-end coverage for the durable admin-alert snooze that task #200
// moved from an in-memory Map to the `users.admin_alert_snoozed_until`
// column. We exercise the real Drizzle-backed storage (no method stubs)
// against the test Postgres so the test catches schema drift, SQL
// mapping bugs, and serialization regressions — not just method
// control flow.

const TEST_USERNAMES = [
  "task220-snooze-roundtrip",
  "task220-snooze-helper",
  "task220-snooze-expiry",
  "task220-snooze-clear",
];

async function deleteTestUsers(): Promise<void> {
  await db.delete(users).where(inArray(users.username, TEST_USERNAMES));
}

async function seedAdminUser(username: string): Promise<string> {
  const [row] = await db
    .insert(users)
    .values({
      username,
      password: "x",
      name: username,
      email: `${username}@example.com`,
      role: "agent",
      adminAlertSnoozedUntil: null,
    })
    .returning({ id: users.id });
  return row.id;
}

async function loadUserRow(id: string) {
  const [row] = await db
    .select({
      id: users.id,
      adminAlertSnoozedUntil: users.adminAlertSnoozedUntil,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row;
}

describe("admin-alert snooze is persisted to users.admin_alert_snoozed_until", () => {
  beforeEach(async () => {
    await deleteTestUsers();
  });

  afterEach(async () => {
    await deleteTestUsers();
  });

  it("a snooze written by one MemStorage instance is visible to a freshly constructed one", async () => {
    const userId = await seedAdminUser("task220-snooze-roundtrip");

    const writer = new MemStorage();
    const until = new Date(Date.now() + 60 * 60_000);
    // Drop sub-second precision so the equality assertion below is
    // robust against Postgres `timestamp` truncation (microseconds at
    // best, full seconds in some configs).
    until.setMilliseconds(0);

    await writer.setAdminAlertSnoozeUntil(userId, until);

    // Confirm the column itself was written, independent of any
    // storage-side caching the writer might have.
    const dbRow = await loadUserRow(userId);
    assert.ok(
      dbRow?.adminAlertSnoozedUntil instanceof Date,
      "the snooze column was populated in Postgres",
    );
    assert.equal(
      dbRow!.adminAlertSnoozedUntil!.getTime(),
      until.getTime(),
      "the snooze timestamp round-trips through the column exactly",
    );

    // Simulate a server restart by throwing away the writer and
    // constructing a brand-new storage instance.
    const reader = new MemStorage();
    const readBack = await reader.getAdminAlertSnoozeUntil(userId);

    assert.ok(readBack, "getAdminAlertSnoozeUntil returns a Date after restart");
    assert.equal(
      readBack!.getTime(),
      until.getTime(),
      "the post-restart read sees the same snooze timestamp",
    );
  });

  it("isAdminAlertSnoozedFromUser agrees with a user row loaded after the simulated restart", async () => {
    const userId = await seedAdminUser("task220-snooze-helper");
    const writer = new MemStorage();
    const until = new Date(Date.now() + 30 * 60_000);
    until.setMilliseconds(0);
    await writer.setAdminAlertSnoozeUntil(userId, until);

    // Discard the writer; load the user row from Postgres just like
    // the websocket broadcast loop does, then ask the helper.
    const reloaded = await loadUserRow(userId);
    assert.ok(reloaded, "the user row exists after the writer is gone");
    assert.equal(
      isAdminAlertSnoozedFromUser(reloaded),
      true,
      "helper recognizes a future snooze persisted in the column",
    );

    // Negative control: a user row whose column is null is not snoozed.
    assert.equal(
      isAdminAlertSnoozedFromUser({ adminAlertSnoozedUntil: null }),
      false,
    );
  });

  it("an expired persisted snooze is lazily cleared on the next read after restart", async () => {
    const userId = await seedAdminUser("task220-snooze-expiry");

    // Backdate the column directly to simulate a snooze that was set
    // yesterday and has now expired. We bypass setAdminAlertSnoozeUntil
    // here on purpose — the setter intentionally collapses past
    // timestamps to null on the way in, but the lazy-clear behavior on
    // the read side is what we want to assert.
    const expired = new Date(Date.now() - 60_000);
    await db
      .update(users)
      .set({ adminAlertSnoozedUntil: expired })
      .where(eq(users.id, userId));

    const beforeRead = await loadUserRow(userId);
    assert.ok(
      beforeRead?.adminAlertSnoozedUntil instanceof Date,
      "expired snooze is present in the column before the read",
    );

    const reader = new MemStorage();
    const readBack = await reader.getAdminAlertSnoozeUntil(userId);
    assert.equal(readBack, null, "expired snooze reads back as null");

    const afterRead = await loadUserRow(userId);
    assert.equal(
      afterRead?.adminAlertSnoozedUntil,
      null,
      "expired snooze was lazily cleared from the column by the read",
    );

    // The helper, fed the now-cleared row, also reports not-snoozed.
    assert.equal(isAdminAlertSnoozedFromUser(afterRead!), false);
  });

  it("setAdminAlertSnoozeUntil(null) from a different instance clears a persisted snooze across restarts", async () => {
    const userId = await seedAdminUser("task220-snooze-clear");

    const writer = new MemStorage();
    await writer.setAdminAlertSnoozeUntil(
      userId,
      new Date(Date.now() + 5 * 60_000),
    );
    const afterWrite = await loadUserRow(userId);
    assert.ok(afterWrite?.adminAlertSnoozedUntil instanceof Date);

    // A second "process" decides to clear it.
    const clearer = new MemStorage();
    await clearer.setAdminAlertSnoozeUntil(userId, null);
    const afterClear = await loadUserRow(userId);
    assert.equal(afterClear?.adminAlertSnoozedUntil, null);

    // Yet another fresh instance reads back null.
    const reader = new MemStorage();
    assert.equal(await reader.getAdminAlertSnoozeUntil(userId), null);
    assert.equal(isAdminAlertSnoozedFromUser(afterClear!), false);
  });
});
