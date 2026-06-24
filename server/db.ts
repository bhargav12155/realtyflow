import dotenv from "dotenv";
dotenv.config();

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "@shared/schema";

const resolvedDatabaseUrl =
  process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!resolvedDatabaseUrl) {
  throw new Error(
    "DATABASE_URL or NEON_DATABASE_URL must be set. Did you forget to provision a database?"
  );
}

const databaseUrl = new URL(resolvedDatabaseUrl);
const requiresSsl = databaseUrl.searchParams.get("sslmode") === "require";

if (requiresSsl) {
  databaseUrl.searchParams.delete("sslmode");
}

const poolConfig: PoolConfig = {
  connectionString: databaseUrl.toString(),
  // Keep pool connections healthy during long idle periods so background
  // workers don't fail their next query with terminated-socket errors.
  max: Number.parseInt(process.env.PG_POOL_MAX ?? "10", 10),
  idleTimeoutMillis: Number.parseInt(process.env.PG_IDLE_TIMEOUT_MS ?? "30000", 10),
  connectionTimeoutMillis: Number.parseInt(process.env.PG_CONNECTION_TIMEOUT_MS ?? "10000", 10),
  keepAlive: true,
  keepAliveInitialDelayMillis: Number.parseInt(process.env.PG_KEEPALIVE_INITIAL_DELAY_MS ?? "10000", 10),
};

if (requiresSsl) {
  poolConfig.ssl = {
    rejectUnauthorized: process.env.NODE_ENV === "production",
  };
}

export const pool = new Pool(poolConfig);

pool.on("error", (error) => {
  console.error("[db] unexpected idle client error", error);
});

export const db = drizzle({ client: pool, schema });
