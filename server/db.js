"use strict";
var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.pool = void 0;
var dotenv_1 = require("dotenv");
dotenv_1.default.config();
var node_postgres_1 = require("drizzle-orm/node-postgres");
var pg_1 = require("pg");
var schema = require("@shared/schema");
var resolvedDatabaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!resolvedDatabaseUrl) {
    throw new Error("DATABASE_URL or NEON_DATABASE_URL must be set. Did you forget to provision a database?");
}
var databaseUrl = new URL(resolvedDatabaseUrl);
var requiresSsl = databaseUrl.searchParams.get("sslmode") === "require";
if (requiresSsl) {
    databaseUrl.searchParams.delete("sslmode");
}
var poolConfig = {
    connectionString: databaseUrl.toString(),
    // Keep pool connections healthy during long idle periods so background
    // workers don't fail their next query with terminated-socket errors.
    max: Number.parseInt((_a = process.env.PG_POOL_MAX) !== null && _a !== void 0 ? _a : "10", 10),
    idleTimeoutMillis: Number.parseInt((_b = process.env.PG_IDLE_TIMEOUT_MS) !== null && _b !== void 0 ? _b : "30000", 10),
    connectionTimeoutMillis: Number.parseInt((_c = process.env.PG_CONNECTION_TIMEOUT_MS) !== null && _c !== void 0 ? _c : "10000", 10),
    keepAlive: true,
    keepAliveInitialDelayMillis: Number.parseInt((_d = process.env.PG_KEEPALIVE_INITIAL_DELAY_MS) !== null && _d !== void 0 ? _d : "10000", 10),
};
if (requiresSsl) {
    poolConfig.ssl = {
        rejectUnauthorized: process.env.NODE_ENV === "production",
    };
}
exports.pool = new pg_1.Pool(poolConfig);
exports.pool.on("error", function (error) {
    console.error("[db] unexpected idle client error", error);
});
exports.db = (0, node_postgres_1.drizzle)({ client: exports.pool, schema: schema });
