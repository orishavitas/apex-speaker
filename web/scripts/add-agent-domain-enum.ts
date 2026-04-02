import { getNeon } from '../lib/db/index';

async function main() {
  const sql = getNeon();
  const existing = await sql`
    SELECT enumlabel FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'agent_domain'
  `;
  const labels = (existing as { enumlabel: string }[]).map((r) => r.enumlabel);
  console.log('Current agent_domain values:', labels);

  if (!labels.includes('design_wizard')) {
    await sql`ALTER TYPE agent_domain ADD VALUE 'design_wizard'`;
    console.log('Added: design_wizard');
  } else {
    console.log('Already exists: design_wizard');
  }
  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
