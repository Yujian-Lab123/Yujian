import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://yujian:yujian_dev@localhost:54329/yujian';
const globalForDb = globalThis as unknown as { yujianPool?: Pool };

export const pool = globalForDb.yujianPool ?? new Pool({ connectionString, max: 10 });
if (process.env.NODE_ENV !== 'production') globalForDb.yujianPool = pool;

export const db = drizzle(pool, { schema });

export async function checkDatabase(): Promise<{ ok: true; latencyMs: number } | { ok: false; error: string }> {
  const started = Date.now();
  try {
    await pool.query('select 1');
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
