import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";

// Get database connection from environment
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(sql);

async function createSocialApiKeysTable() {
  try {
    console.log("Creating social_api_keys table...");

    // Create the social_api_keys table
    await sql.query(`
      CREATE TABLE IF NOT EXISTS social_api_keys (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        platform VARCHAR(50) NOT NULL,
        api_key_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, platform)
      );
    `);

    console.log("✅ social_api_keys table created successfully!");

    // Create an index for better performance
    await sql.query(`
      CREATE INDEX IF NOT EXISTS idx_social_api_keys_user_platform 
      ON social_api_keys(user_id, platform);
    `);

    console.log("✅ Index created successfully!");
  } catch (error) {
    console.error("❌ Error creating social_api_keys table:", error);
    process.exit(1);
  } finally {
    await sql.end();
    console.log("Database connection closed.");
    process.exit(0);
  }
}

createSocialApiKeysTable();
