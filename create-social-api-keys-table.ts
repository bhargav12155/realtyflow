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
    console.log("Dropping old social_api_keys table if exists...");
    await sql.query(`DROP TABLE IF EXISTS social_api_keys;`);

    console.log("Creating social_api_keys table with correct schema...");

    // Create the social_api_keys table matching schema.ts
    await sql.query(`
      CREATE TABLE social_api_keys (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL,
        facebook_app_id TEXT,
        facebook_app_secret TEXT,
        instagram_token TEXT,
        instagram_business_account_id TEXT,
        tiktok_api_key TEXT,
        tiktok_api_secret TEXT,
        tiktok_access_token TEXT,
        twitter_api_key TEXT,
        twitter_api_secret TEXT,
        twitter_access_token TEXT,
        twitter_access_token_secret TEXT,
        twitter_bearer_token TEXT,
        youtube_api_key TEXT,
        youtube_channel_id TEXT,
        linkedin_access_token TEXT,
        linkedin_organization_id TEXT,
        keys_configured BOOLEAN DEFAULT false,
        last_updated TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("✅ social_api_keys table created successfully!");

    // Create an index for better performance
    await sql.query(`
      CREATE INDEX IF NOT EXISTS idx_social_api_keys_user_id 
      ON social_api_keys(user_id);
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
