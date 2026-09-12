import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });

async function main() {
  const { runMigrations } = await import('../lib/db/migrate');
  const { pool } = await import('../lib/db/client');
  try {
    await runMigrations();
    console.log('Database migrations are up to date.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
