import dotenv from "dotenv";
dotenv.config({ override: true });

import { Pool } from "pg";

import { buildPgPoolConfig, buildSearchPath } from "../server/pgPoolConfig";

type TableRef = { schema: string; name: string };

const sourceUrl = process.env.SOURCE_DATABASE_URL;
const destUrl = process.env.DEST_DATABASE_URL;

if (!sourceUrl || !destUrl) {
  throw new Error(
    "SOURCE_DATABASE_URL and DEST_DATABASE_URL are required (set them in your shell or .env)."
  );
}

const sourceSchema = (process.env.SOURCE_SCHEMA || "public").trim();
const destSchema = (process.env.DEST_SCHEMA || "onrestuanrants").trim();
const batchSize = Math.max(1, parseInt(process.env.BATCH_SIZE || "1000", 10));
const clearDest = (process.env.CLEAR_DEST || "false").toLowerCase() === "true";

function quoteIdent(ident: string): string {
  return `"${ident.replace(/\"/g, '""')}"`;
}

async function listTables(pool: Pool, schemaName: string): Promise<TableRef[]> {
  const res = await pool.query(
    `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
    `,
    [schemaName]
  );

  return res.rows.map((r) => ({ schema: schemaName, name: r.table_name as string }));
}

async function listColumns(pool: Pool, schemaName: string, tableName: string): Promise<string[]> {
  const res = await pool.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name = $2
    ORDER BY ordinal_position
    `,
    [schemaName, tableName]
  );

  return res.rows.map((r) => r.column_name as string);
}

async function listFkDeps(pool: Pool, schemaName: string): Promise<Map<string, Set<string>>> {
  // Map: table -> set(of tables it depends on)
  const deps = new Map<string, Set<string>>();

  const res = await pool.query(
    `
    SELECT
      tc.table_name AS table_name,
      ccu.table_name AS referenced_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = $1
      AND ccu.table_schema = $1
    `,
    [schemaName]
  );

  for (const row of res.rows) {
    const tableName = row.table_name as string;
    const ref = row.referenced_table as string;
    if (!deps.has(tableName)) deps.set(tableName, new Set());
    deps.get(tableName)!.add(ref);
  }

  return deps;
}

function topoSortTables(tables: TableRef[], deps: Map<string, Set<string>>): TableRef[] {
  const tableNames = new Set(tables.map((t) => t.name));
  const inDegree = new Map<string, number>();
  const reverse = new Map<string, Set<string>>();

  for (const t of tableNames) {
    inDegree.set(t, 0);
    reverse.set(t, new Set());
  }

  for (const [t, needs] of deps.entries()) {
    if (!tableNames.has(t)) continue;
    for (const dep of needs) {
      if (!tableNames.has(dep)) continue;
      inDegree.set(t, (inDegree.get(t) || 0) + 1);
      reverse.get(dep)!.add(t);
    }
  }

  const queue: string[] = [];
  for (const [t, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(t);
  }

  const ordered: string[] = [];
  while (queue.length) {
    const t = queue.shift()!;
    ordered.push(t);
    for (const dependent of reverse.get(t) || []) {
      inDegree.set(dependent, (inDegree.get(dependent) || 0) - 1);
      if ((inDegree.get(dependent) || 0) === 0) queue.push(dependent);
    }
  }

  // Any cycles/unresolved tables go last (still attempted)
  for (const t of tableNames) {
    if (!ordered.includes(t)) ordered.push(t);
  }

  const map = new Map(tables.map((t) => [t.name, t] as const));
  return ordered.map((name) => map.get(name)!).filter(Boolean);
}

async function copyTableData(
  src: Pool,
  dst: Pool,
  srcSchema: string,
  dstSchema: string,
  tableName: string
) {
  const columns = await listColumns(src, srcSchema, tableName);
  if (columns.length === 0) return;

  const qualifiedSrc = `${quoteIdent(srcSchema)}.${quoteIdent(tableName)}`;
  const qualifiedDst = `${quoteIdent(dstSchema)}.${quoteIdent(tableName)}`;
  const columnList = columns.map(quoteIdent).join(", ");

  if (clearDest) {
    await dst.query(`TRUNCATE TABLE ${qualifiedDst} RESTART IDENTITY CASCADE`);
  }

  let offset = 0;
  while (true) {
    const res = await src.query(
      `SELECT ${columnList} FROM ${qualifiedSrc} OFFSET $1 LIMIT $2`,
      [offset, batchSize]
    );

    if (res.rows.length === 0) break;

    const values: unknown[] = [];
    const rowsSql: string[] = [];

    for (const row of res.rows) {
      const placeholders: string[] = [];
      for (const col of columns) {
        values.push((row as any)[col]);
        placeholders.push(`$${values.length}`);
      }
      rowsSql.push(`(${placeholders.join(", ")})`);
    }

    await dst.query(
      `INSERT INTO ${qualifiedDst} (${columnList}) VALUES ${rowsSql.join(", ")}`,
      values
    );

    offset += res.rows.length;
  }
}

async function syncIdentitySequences(dst: Pool, schemaName: string, tableName: string) {
  // Find identity/serial columns and bump sequences to max(column)
  const res = await dst.query(
    `
    SELECT
      a.attname AS column_name,
      pg_get_serial_sequence(format('%I.%I', $1::text, $2::text), a.attname) AS seq
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1
      AND c.relname = $2
      AND a.attnum > 0
      AND NOT a.attisdropped
    `,
    [schemaName, tableName]
  );

  for (const row of res.rows) {
    const seq = row.seq as string | null;
    const col = row.column_name as string;
    if (!seq) continue;

    const qTable = `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`;
    const qCol = quoteIdent(col);
    await dst.query(`SELECT setval($1, COALESCE((SELECT MAX(${qCol}) FROM ${qTable}), 1))`, [seq]);
  }
}

async function main() {
  const src = new Pool(buildPgPoolConfig(sourceUrl));
  const dst = new Pool(buildPgPoolConfig(destUrl));

  try {
    // Ensure destination schema exists and becomes the default.
    await dst.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(destSchema)}`);
    await dst.query(`SET search_path TO ${buildSearchPath(destSchema)}`);

    const tables = await listTables(src, sourceSchema);
    const deps = await listFkDeps(src, sourceSchema);
    const ordered = topoSortTables(tables, deps);

    console.log(
      `[db:copy-schema] Copying ${ordered.length} tables from ${sourceSchema} -> ${destSchema} (batchSize=${batchSize}, clearDest=${clearDest})`
    );

    for (const t of ordered) {
      process.stdout.write(`[db:copy-schema] ${t.name}... `);
      await copyTableData(src, dst, sourceSchema, destSchema, t.name);
      await syncIdentitySequences(dst, destSchema, t.name);
      console.log("ok");
    }

    console.log("[db:copy-schema] Done.");
  } finally {
    await src.end();
    await dst.end();
  }
}

await main();
