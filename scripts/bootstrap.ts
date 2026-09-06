import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';

async function main() {
  const root = process.cwd();
  const envPath = path.join(root, '.env.local');
  const examplePath = path.join(root, '.env.example');
  if (!fs.existsSync(envPath)) {
    fs.copyFileSync(examplePath, envPath);
    console.log('Created .env.local from .env.example.');
  }
  dotenv.config({ path: envPath, quiet: true });
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 24) throw new Error(`Node.js 24+ is required; current version is ${process.version}.`);
  const docker = spawnSync('docker', ['compose', 'up', '-d', 'postgres'], { cwd: root, stdio: 'inherit', shell: false });
  if (docker.error || docker.status !== 0) throw new Error('Docker Compose failed. Start Docker Desktop and retry npm run bootstrap.');
  const { pool } = await import('../lib/db/client');
  try {
    const deadline = Date.now() + 60_000;
    while (true) {
      try { await pool.query('select 1'); break; }
      catch (error) {
        if (Date.now() >= deadline) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
    }
    const { runMigrations } = await import('../lib/db/migrate');
    const { seedDatabase } = await import('../lib/db/seed-runner');
    await runMigrations();
    await seedDatabase();
    const crawlerDir = path.join(root, 'data', 'crawler');
    const fixtureTarget = path.join(crawlerDir, 'lin-yizhou.json');
    fs.mkdirSync(crawlerDir, { recursive: true });
    if (!fs.existsSync(fixtureTarget)) fs.copyFileSync(path.join(root, 'scripts', 'fixtures', 'lin-yizhou.json'), fixtureTarget);
  } finally {
    await pool.end();
  }
  console.log('Bootstrap complete. Run: npm run dev');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
