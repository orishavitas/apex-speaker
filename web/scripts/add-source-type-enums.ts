// Run ONCE to add new source_type enum values.
// ALTER TYPE ... ADD VALUE cannot run inside a transaction in PostgreSQL.
// Uses raw Neon client, not Drizzle, for that reason.

import { getNeon } from '../lib/db/index';

async function main() {
  const sql = getNeon();

  const existing = await sql`
    SELECT enumlabel FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'source_type'
  `;
  const labels = (existing as { enumlabel: string }[]).map((r) => r.enumlabel);
  console.log('Existing source_type values:', labels);

  if (!labels.includes('community_build')) {
    await sql`ALTER TYPE source_type ADD VALUE 'community_build'`;
    console.log('Added: community_build');
  } else {
    console.log('Already exists: community_build');
  }

  if (!labels.includes('measurement')) {
    await sql`ALTER TYPE source_type ADD VALUE 'measurement'`;
    console.log('Added: measurement');
  } else {
    console.log('Already exists: measurement');
  }

  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
