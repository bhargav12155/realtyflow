import dotenv from "dotenv";
dotenv.config({ override: true });

import { Pool } from "pg";

import { buildPgPoolConfig, buildSearchPath, quoteIdent } from "../server/pgPoolConfig";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const dbSchema = (process.env.DB_SCHEMA || "public").trim();
if (!dbSchema) {
  throw new Error("DB_SCHEMA is empty");
}

const pool = new Pool(buildPgPoolConfig(databaseUrl));

try {
  if (dbSchema !== "public") {
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(dbSchema)}`);
  }

  // Confirm search_path can be set (helpful when debugging)
  await pool.query(`SET search_path TO ${buildSearchPath(dbSchema)}`);
  const res = await pool.query("SHOW search_path");
  // Intentionally minimal output (no secrets)
  console.log(`[db:init-schema] search_path=${res.rows?.[0]?.search_path ?? ""}`);
} finally {
  await pool.end();
}
