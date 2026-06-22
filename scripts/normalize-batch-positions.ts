/**
 * One-off migration: clear the legacy auto-stagger offsets from generated
 * batch tiles so old batches lay out in clean flex-wrap rows like new ones.
 *
 * Background: batch tiles used to be created with a baked-in transform offset
 *   positionX = 40 + i * (width + 20)
 *   positionY = 40
 * The client *also* flows tiles in a flex-wrap row and applies positionX/Y as
 * an additive transform on top, so those offsets double-positioned the tiles
 * and made them overlap. New tiles are now created at (0, 0); this script
 * retro-fixes the already-saved ones.
 *
 * SAFETY: we only reset a tile when its stored position *exactly* matches the
 * old formula — positionY === 40 AND positionX >= 40 AND (positionX - 40) is a
 * whole multiple of (width + 20). A tile a user dragged would essentially never
 * satisfy all three, so intentionally-moved tiles are left untouched.
 *
 * Usage (from realtyflow/):
 *   npx tsx scripts/normalize-batch-positions.ts            # dry run (default)
 *   npx tsx scripts/normalize-batch-positions.ts --apply    # actually write
 */
import { and, eq, gte, inArray } from "drizzle-orm";

import { db, pool } from "../external/server/db";
import { boardAssets } from "@shared/schema";

const LEGACY_Y = 40;
const LEGACY_X_BASE = 40;
const STAGGER_GAP = 20; // step was width + 20
// Only generated media tiles ever went through the staggering code path.
const GENERATED_KINDS = ["image", "video", "audio"] as const;

const apply = process.argv.includes("--apply");

function matchesLegacyStagger(positionX: number, width: number): boolean {
  if (positionX < LEGACY_X_BASE) return false;
  const step = width + STAGGER_GAP;
  if (step <= 0) return false;
  const delta = positionX - LEGACY_X_BASE;
  // Allow a hair of float tolerance since the column is `real`.
  const mod = delta % step;
  return mod < 0.001 || Math.abs(mod - step) < 0.001;
}

async function main() {
  // Pull the cheap candidates first (Y === 40, X past the origin, generated
  // kind) and apply the exact-multiple test in JS.
  const candidates = await db
    .select({
      id: boardAssets.id,
      batchId: boardAssets.batchId,
      batchLabel: boardAssets.batchLabel,
      kind: boardAssets.kind,
      positionX: boardAssets.positionX,
      positionY: boardAssets.positionY,
      width: boardAssets.width,
    })
    .from(boardAssets)
    .where(
      and(
        eq(boardAssets.positionY, LEGACY_Y),
        gte(boardAssets.positionX, LEGACY_X_BASE),
        inArray(boardAssets.kind, [...GENERATED_KINDS]),
      ),
    );

  const toReset = candidates.filter((c) =>
    matchesLegacyStagger(c.positionX, c.width),
  );

  const skipped = candidates.length - toReset.length;
  console.log(
    `Scanned ${candidates.length} candidate tile(s) at Y=${LEGACY_Y}; ` +
      `${toReset.length} match the legacy stagger, ${skipped} look hand-moved (left alone).`,
  );

  if (toReset.length === 0) {
    console.log("Nothing to do. ✅");
    return;
  }

  // Group for a readable preview.
  const byBatch = new Map<string, typeof toReset>();
  for (const t of toReset) {
    const list = byBatch.get(t.batchId) ?? [];
    list.push(t);
    byBatch.set(t.batchId, list);
  }
  for (const [batchId, tiles] of byBatch) {
    const label = tiles[0].batchLabel ?? "(no label)";
    console.log(
      `  • ${label} [${batchId.slice(0, 8)}] — ${tiles.length} tile(s): ` +
        tiles.map((t) => `x=${t.positionX}`).join(", "),
    );
  }

  if (!apply) {
    console.log(
      `\nDRY RUN — no changes written. Re-run with --apply to reset ${toReset.length} tile(s) to (0, 0).`,
    );
    return;
  }

  const ids = toReset.map((t) => t.id);
  await db
    .update(boardAssets)
    .set({ positionX: 0, positionY: 0 })
    .where(inArray(boardAssets.id, ids));

  console.log(`\nReset ${ids.length} tile(s) to (0, 0). ✅`);
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
