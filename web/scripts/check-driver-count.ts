import { getNeon } from '../lib/db/index';

async function main() {
  const sql = getNeon();
  const result = (await sql`SELECT COUNT(*) as count FROM driver_database`) as { count: string }[];
  console.log('Total drivers:', result[0].count);
  const types = await sql`SELECT driver_type, COUNT(*) as count FROM driver_database GROUP BY driver_type ORDER BY count DESC`;
  console.log('By type:');
  for (const row of types as { driver_type: string; count: string }[]) {
    console.log(`  ${row.driver_type}: ${row.count}`);
  }
  const sample = (await sql`SELECT manufacturer, model, fs_hz, qts, sensitivity_1m1w FROM driver_database LIMIT 5`) as unknown[];
  console.log('Sample rows:', JSON.stringify(sample, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
