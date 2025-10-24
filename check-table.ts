import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkTable() {
  try {
    const client = await pool.connect();

    // Check if table exists
    const tableResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'social_api_keys'
    `);

    if (tableResult.rows.length > 0) {
      console.log("✅ social_api_keys table exists");

      // Check table structure
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'social_api_keys'
        ORDER BY ordinal_position
      `);

      console.log("\nTable structure:");
      columnsResult.rows.forEach((row) => {
        console.log(
          `- ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`
        );
      });
    } else {
      console.log("❌ social_api_keys table does not exist");
    }

    client.release();
    pool.end();
  } catch (error) {
    console.error("Error checking table:", error);
    pool.end();
  }
}

checkTable();
