import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function addAuthColumns() {
  console.log("Adding authentication columns to public_users table...");
  
  try {
    // Add columns one by one to handle existing columns gracefully
    const columns = [
      { name: "password", sql: "ALTER TABLE public_users ADD COLUMN IF NOT EXISTS password TEXT" },
      { name: "email_verified", sql: "ALTER TABLE public_users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false" },
      { name: "verification_token", sql: "ALTER TABLE public_users ADD COLUMN IF NOT EXISTS verification_token TEXT" },
      { name: "verification_token_expiry", sql: "ALTER TABLE public_users ADD COLUMN IF NOT EXISTS verification_token_expiry TIMESTAMP" },
    ];

    for (const col of columns) {
      try {
        await db.execute(sql.raw(col.sql));
        console.log(`✅ Column "${col.name}" ready`);
      } catch (error: any) {
        if (error.code === "42701") {
          console.log(`✅ Column "${col.name}" already exists`);
        } else {
          throw error;
        }
      }
    }

    console.log("\n✅ All authentication columns added successfully!");
  } catch (error) {
    console.error("❌ Migration error:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

addAuthColumns();
