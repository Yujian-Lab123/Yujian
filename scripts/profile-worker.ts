import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });

async function main() {
  const { claimNextProfileJob, heartbeatWorker, processProfileJob } = await import('../lib/profile/jobs');
  const { pool } = await import('../lib/db/client');
  let stopping = false;
  const stop = () => { stopping = true; };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  console.log('Profile worker started.');
  try {
    while (!stopping) {
      await heartbeatWorker();
      const job = await claimNextProfileJob();
      if (job) await processProfileJob(job, process.cwd());
      else await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
