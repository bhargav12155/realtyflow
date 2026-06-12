import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL or NEON_DATABASE_URL, ensure the database is provisioned"
  );
}

export default defineConfig({
  out: "./migrations",
  schema: "./external/shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
