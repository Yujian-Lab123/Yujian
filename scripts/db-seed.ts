import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });

async function main() {
  const { seedDatabase } = await import('../lib/db/seed-runner');
  const { pool } = await import('../lib/db/client');
  try {
    await seedDatabase();
    console.log('Mock data is ready.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
