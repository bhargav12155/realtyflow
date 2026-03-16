import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const ACTIVE_DB_SCHEMA = (process.env.DB_SCHEMA || "public").trim() || "public";

async function addBusinessTypeColumns() {
  console.log("🔧 Adding business type columns to public_users table...");

  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Add business_type column
    console.log("Adding business_type column...");
    await pool.query(`
      ALTER TABLE ${ACTIVE_DB_SCHEMA === 'public' ? '' : ACTIVE_DB_SCHEMA + '.'}public_users 
      ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'restaurant'
    `);

    // Add business_subtype column
    console.log("Adding business_subtype column...");
    await pool.query(`
      ALTER TABLE ${ACTIVE_DB_SCHEMA === 'public' ? '' : ACTIVE_DB_SCHEMA + '.'}public_users 
      ADD COLUMN IF NOT EXISTS business_subtype TEXT DEFAULT 'fast_casual'
    `);

    console.log("✅ Business type columns added successfully!");
    console.log("\nColumns added:");
    console.log("  - business_type (default: 'restaurant')");
    console.log("  - business_subtype (default: 'fast_casual')");

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error adding columns:", error);
    await pool.end();
    process.exit(1);
  }
}

addBusinessTypeColumns();
