import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();

  console.log("🔍 PHYSICAL DATABASE AUDIT:\n");

  try {
    // 1. Check Table Existence and Columns
    const tableRes = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'media_assets'
      ORDER BY ordinal_position;
    `);
    
    console.log("📋 Columns in table 'media_assets':");
    if (tableRes.rows.length === 0) {
      console.log("❌ Table 'media_assets' DOES NOT EXIST!");
    } else {
      tableRes.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type}, Nullable: ${col.is_nullable}, Default: ${col.column_default})`);
      });
    }
    console.log("");

    // 2. Check Enum values
    const enumRes = await client.query(`
      SELECT enumlabel 
      FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE pg_type.typname = 'asset_type';
    `);

    console.log("📋 Values in enum 'asset_type':");
    if (enumRes.rows.length === 0) {
      console.log("❌ Enum 'asset_type' DOES NOT EXIST!");
    } else {
      enumRes.rows.forEach(row => {
        console.log(`  - ${row.enumlabel}`);
      });
    }
    console.log("");

    // 3. Check Indexes
    const indexRes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'media_assets';
    `);

    console.log("📋 Indexes on 'media_assets':");
    indexRes.rows.forEach(idx => {
      console.log(`  - ${idx.indexname}: ${idx.indexdef}`);
    });
    console.log("");

    // 4. Check Foreign Keys
    const fkRes = await client.query(`
      SELECT
        tc.constraint_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='media_assets';
    `);

    console.log("📋 Foreign Keys on 'media_assets':");
    fkRes.rows.forEach(fk => {
      console.log(`  - ${fk.column_name} -> ${fk.foreign_table_name}(${fk.foreign_column_name}) [${fk.constraint_name}]`);
    });
    console.log("");

  } catch (err) {
    console.error("❌ Error querying DB metadata:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
