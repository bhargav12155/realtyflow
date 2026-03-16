import dotenv from "dotenv";
dotenv.config({ override: true });

import { execFileSync } from "node:child_process";
import { Pool } from "pg";

import { buildPgPoolConfig, quoteIdent } from "../server/pgPoolConfig";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const schemaName = (process.env.DB_SCHEMA || "onrestuanrants").trim();
if (!schemaName) {
  throw new Error("DB_SCHEMA is empty");
}

const resetSchema = (process.env.RESET_SCHEMA || "false").toLowerCase() === "true";

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";

  let inSingle = false;
  let inDouble = false;
  let dollarTag: string | null = null;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    current += ch;

    // Handle escaping in single-quoted strings
    if (inSingle) {
      if (ch === "'" && next === "'") {
        current += next;
        i++;
        continue;
      }
      if (ch === "'") inSingle = false;
      continue;
    }

    // Handle double-quoted identifiers
    if (inDouble) {
      if (ch === '"') inDouble = false;
      continue;
    }

    // Handle dollar-quoted blocks
    if (dollarTag) {
      if (current.endsWith(dollarTag)) {
        dollarTag = null;
      }
      continue;
    }

    // Enter string/identifier modes
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }

    // Enter dollar-quote mode if we see $tag$
    if (ch === "$" && typeof next === "string") {
      const rest = sql.slice(i);
      const match = rest.match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        dollarTag = match[0];
        // current already has first '$'; append remaining tag chars
        current += dollarTag.slice(1);
        i += dollarTag.length - 1;
        continue;
      }
    }

    // Statement delimiter
    if (ch === ";") {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
    }
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

function getDrizzleExportSql(): string {
  const bin = process.platform === "win32" ? "npx.cmd" : "npx";
  const stdout = execFileSync(
    bin,
    [
      "-y",
      "drizzle-kit",
      "export",
      "--dialect",
      "postgresql",
      "--schema",
      "./shared/schema.ts",
      "--sql",
    ],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "inherit"],
      env: process.env,
      encoding: "utf-8",
    }
  );

  return stdout;
}

async function main() {
  const sql = getDrizzleExportSql();
  const statements = splitSqlStatements(sql).filter((s) => s.length > 0);

  const pool = new Pool(buildPgPoolConfig(databaseUrl));

  try {
    if (resetSchema && schemaName !== "public") {
      console.log(`[db:bootstrap-schema] Resetting schema ${schemaName} (DROP SCHEMA ... CASCADE)`);
      await pool.query(`DROP SCHEMA IF EXISTS ${quoteIdent(schemaName)} CASCADE`);
    }

    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schemaName)}`);
    await pool.query(`SET search_path TO ${quoteIdent(schemaName)}`);

    console.log(
      `[db:bootstrap-schema] Applying ${statements.length} statements into schema ${schemaName}`
    );

    for (const stmt of statements) {
      await pool.query(stmt);
    }

    const res = await pool.query(
      `SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema=$1 AND table_type='BASE TABLE'`,
      [schemaName]
    );

    console.log(
      `[db:bootstrap-schema] Done. tables=${res.rows?.[0]?.n ?? 0} schema=${schemaName}`
    );
  } finally {
    await pool.end();
  }
}

await main();
