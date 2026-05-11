import path from 'path';
import dotenv from 'dotenv';
import mysql, { Pool, RowDataPacket } from 'mysql2/promise';

const RootEnvPath = path.resolve(__dirname, '..', '..', '.env');
const MigrationEnvPath = path.resolve(__dirname, '.env');

dotenv.config({ path: RootEnvPath });
dotenv.config({ path: MigrationEnvPath, override: true });

type DbConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

const TABLES_TO_TRUNCATE = [
  'logs',
  'media',
  'intervention_history',
  'access_tokens',
  'interventions',
  'mobile_devices',
  'units',
  'users',
  'teams',
] as const;

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

function optionalInt(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getTargetDbConfig(): DbConfig {
  return {
    host: optional('MIGRATION_TARGET_DB_HOST', required('DB_HOST')),
    port: optionalInt('MIGRATION_TARGET_DB_PORT', optionalInt('DB_PORT', 3306)),
    user: optional('MIGRATION_TARGET_DB_USER', required('DB_USER')),
    password: optional('MIGRATION_TARGET_DB_PASSWORD', required('DB_PASSWORD')),
    database: optional('MIGRATION_TARGET_DB_NAME', required('DB_NAME')),
  };
}

function createPool(config: DbConfig): Pool {
  return mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: 4,
  });
}

async function tableExists(pool: Pool, dbName: string, tableName: string): Promise<boolean> {
  const [rows] = await pool.query<(RowDataPacket & { c: number })[]>(
    `SELECT COUNT(*) AS c
     FROM information_schema.tables
     WHERE table_schema = ? AND table_name = ?`,
    [dbName, tableName],
  );

  return Number(rows[0]?.c ?? 0) > 0;
}

async function countRows(pool: Pool, tableName: string): Promise<number | null> {
  try {
    const [rows] = await pool.query<(RowDataPacket & { c: number })[]>(`SELECT COUNT(*) AS c FROM ${tableName}`);
    return Number(rows[0]?.c ?? 0);
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const cfg = getTargetDbConfig();
  const confirmation = process.env.MIGRATION_CLEAN_CONFIRM?.trim() || '';

  if (confirmation !== 'YES') {
    throw new Error(
      [
        'Refusing to clean DB without explicit confirmation.',
        'Set MIGRATION_CLEAN_CONFIRM=YES in migration/v1tov2/.env and run again.',
      ].join(' '),
    );
  }

  const pool = createPool(cfg);

  try {
    console.log('[MIGRATION:CLEAN] Starting target DB cleanup');
    console.log(`[MIGRATION:CLEAN] Target: ${cfg.host}:${cfg.port}/${cfg.database}`);

    const existingTables: string[] = [];
    for (const table of TABLES_TO_TRUNCATE) {
      if (await tableExists(pool, cfg.database, table)) {
        existingTables.push(table);
      }
    }

    if (existingTables.length === 0) {
      console.log('[MIGRATION:CLEAN] No known migration tables found. Nothing to clean.');
      return;
    }

    console.log(`[MIGRATION:CLEAN] Tables: ${existingTables.join(', ')}`);

    for (const table of existingTables) {
      const before = await countRows(pool, table);
      if (before !== null) {
        console.log(`[MIGRATION:CLEAN] ${table}: ${before} rows before truncate`);
      }
    }

    await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
      for (const table of existingTables) {
        await pool.query(`TRUNCATE TABLE ${table}`);
      }
    } finally {
      await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    for (const table of existingTables) {
      const after = await countRows(pool, table);
      if (after !== null) {
        console.log(`[MIGRATION:CLEAN] ${table}: ${after} rows after truncate`);
      }
    }

    console.log('[MIGRATION:CLEAN] Cleanup completed.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[MIGRATION:CLEAN] Failed:', error);
  process.exitCode = 1;
});
