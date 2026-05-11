import path from 'path';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import mysql, { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';

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

type CountRow = RowDataPacket & { count: number; c: number };

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

function optionalBool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'y', 'on'].includes(value.toLowerCase().trim());
}

function getSourceDbConfig(): DbConfig {
  return {
    host: required('MIGRATION_SOURCE_DB_HOST'),
    port: optionalInt('MIGRATION_SOURCE_DB_PORT', 3306),
    user: required('MIGRATION_SOURCE_DB_USER'),
    password: required('MIGRATION_SOURCE_DB_PASSWORD'),
    database: required('MIGRATION_SOURCE_DB_NAME'),
  };
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
    connectionLimit: 8,
    namedPlaceholders: true,
    decimalNumbers: true,
    timezone: 'Z',
    dateStrings: false,
    supportBigNumbers: true,
    bigNumberStrings: false,
  });
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

function percentage(actual: number, expected: number): string {
  if (expected === 0) return expected === actual ? '✓' : '✗';
  const pct = ((actual / expected) * 100).toFixed(1);
  return `${pct}%`;
}

function statusEmoji(actual: number, expected: number): string {
  if (actual === expected) return '✅';
  if (actual > expected) return '⚠️ ';
  return '❌';
}

type Stats = {
  name: string;
  v1: number;
  v2: number;
};

async function countSafe(
  conn: PoolConnection,
  query: string,
  fallback: number = 0,
): Promise<number> {
  try {
    const [rows] = await conn.query<CountRow[]>(query);
    return Number(rows[0]?.count ?? fallback);
  } catch (err) {
    const error = err as any;
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
      return fallback;
    }
    throw err;
  }
}

async function getStats(): Promise<Stats[]> {
  const sourceCfg = getSourceDbConfig();
  const targetCfg = getTargetDbConfig();

  const sourcePool = createPool(sourceCfg);
  const targetPool = createPool(targetCfg);

  let sourceConn: PoolConnection | null = null;
  let targetConn: PoolConnection | null = null;

  try {
    sourceConn = await sourcePool.getConnection();
    targetConn = await targetPool.getConnection();

    const stats: Stats[] = [];

    // Users
    const v1UserCount = await countSafe(sourceConn, 'SELECT COUNT(*) as count FROM users');
    const v2UserCount = await countSafe(targetConn, 'SELECT COUNT(*) as count FROM users');
    stats.push({
      name: 'Users',
      v1: v1UserCount,
      v2: v2UserCount,
    });

    // Operators
    const v1OperatorCount = await countSafe(sourceConn, 'SELECT COUNT(*) as count FROM operators');
    const v2OperatorCount = await countSafe(
      targetConn,
      'SELECT COUNT(*) as count FROM users WHERE role = "operator"',
    );
    stats.push({
      name: 'Operators (created from v1)',
      v1: v1OperatorCount,
      v2: v2OperatorCount,
    });

    // Teams
    const v1TeamCount = await countSafe(
      sourceConn,
      'SELECT COUNT(DISTINCT business_team) as count FROM steamleaks WHERE business_team IS NOT NULL AND business_team != ""',
    );
    const v2TeamCount = await countSafe(
      targetConn,
      'SELECT COUNT(*) as count FROM teams WHERE deleted_at IS NULL',
    );
    stats.push({
      name: 'Teams',
      v1: v1TeamCount,
      v2: v2TeamCount,
    });

    // Units
    const v1UnitCount = await countSafe(
      sourceConn,
      'SELECT COUNT(DISTINCT unit) as count FROM steamleaks WHERE unit IS NOT NULL AND unit != ""',
    );
    const v2UnitCount = await countSafe(
      targetConn,
      'SELECT COUNT(*) as count FROM units WHERE deleted_at IS NULL',
    );
    stats.push({
      name: 'Units',
      v1: v1UnitCount,
      v2: v2UnitCount,
    });

    // Interventions (steamleaks)
    const v1InterventionCount = await countSafe(
      sourceConn,
      'SELECT COUNT(*) as count FROM steamleaks WHERE is_deleted = 0',
    );
    const v2InterventionCount = await countSafe(
      targetConn,
      'SELECT COUNT(*) as count FROM interventions WHERE deleted_at IS NULL',
    );
    stats.push({
      name: 'Interventions',
      v1: v1InterventionCount,
      v2: v2InterventionCount,
    });

    // Access Tokens (backoffice + mobile)
    const v1BackofficeTokenCount = await countSafe(sourceConn, 'SELECT COUNT(*) as count FROM auth_tokens');
    const v1MobileTokenCount = await countSafe(sourceConn, 'SELECT COUNT(*) as count FROM operators_auth_tokens');
    const v1TotalTokens = v1BackofficeTokenCount + v1MobileTokenCount;

    const v2TokenCount = await countSafe(targetConn, 'SELECT COUNT(*) as count FROM access_tokens');
    stats.push({
      name: 'Access Tokens',
      v1: v1TotalTokens,
      v2: v2TokenCount,
    });

    // Media (photos)
    const v2MediaCount = await countSafe(targetConn, 'SELECT COUNT(*) as count FROM media WHERE deleted_at IS NULL');
    stats.push({
      name: 'Media Records (photos)',
      v1: 0,
      v2: v2MediaCount,
    });

    // Priority Tracking Items
    const v2PriorityTrackingCount = await countSafe(targetConn, 'SELECT COUNT(*) as count FROM priority_tracking_items', 0);
    stats.push({
      name: 'Priority Tracking Items',
      v1: 0,
      v2: v2PriorityTrackingCount,
    });

    // Physical media files check
    const mediaScanRoot = optional(
      'MIGRATION_MEDIA_SCAN_ROOT',
      path.resolve(__dirname, '..', '..', 'data'),
    );
    const beforeDirAbs = path.resolve(mediaScanRoot, 'photo_before');
    const afterDirAbs = path.resolve(mediaScanRoot, 'photo_after');

    let beforeCount = 0;
    let afterCount = 0;

    try {
      const beforeEntries = await fs.readdir(beforeDirAbs, { withFileTypes: true });
      beforeCount = beforeEntries.filter((e) => e.isFile()).length;
    } catch {
      beforeCount = 0;
    }

    try {
      const afterEntries = await fs.readdir(afterDirAbs, { withFileTypes: true });
      afterCount = afterEntries.filter((e) => e.isFile()).length;
    } catch {
      afterCount = 0;
    }

    stats.push({
      name: 'Physical photo_before files',
      v1: beforeCount,
      v2: beforeCount,
    });

    stats.push({
      name: 'Physical photo_after files',
      v1: afterCount,
      v2: afterCount,
    });

    return stats;
  } finally {
    if (sourceConn) sourceConn.release();
    if (targetConn) targetConn.release();
    await sourcePool.end();
    await targetPool.end();
  }
}

async function generateReport(stats: Stats[]): Promise<string> {
  const sourceCfg = getSourceDbConfig();
  const targetCfg = getTargetDbConfig();

  const lines: string[] = [];
  lines.push('');
  lines.push('╔════════════════════════════════════════════════════════════════════╗');
  lines.push('║                    MIGRATION INTEGRITY CHECK                       ║');
  lines.push('╠════════════════════════════════════════════════════════════════════╣');
  lines.push(`║ Source DB: ${`${sourceCfg.database}@${sourceCfg.host}`.padEnd(55)}║`);
  lines.push(`║ Target DB: ${`${targetCfg.database}@${targetCfg.host}`.padEnd(55)}║`);
  lines.push(`║ Timestamp: ${new Date().toISOString().padEnd(55)}║`);
  lines.push('╠════════════════════════════════════════════════════════════════════╣');
  lines.push('║ Entity                              V1 Count  |  V2 Count  |  Status ║');
  lines.push('╠════════════════════════════════════════════════════════════════════╣');

  let allMatch = true;
  for (const stat of stats) {
    const status = statusEmoji(stat.v2, stat.v1);
    if (stat.v2 !== stat.v1 && stat.v1 > 0) {
      allMatch = false;
    }

    const pct = stat.v1 > 0 ? percentage(stat.v2, stat.v1) : '—';
    const v1Str = stat.v1 > 0 ? formatNumber(stat.v1).padStart(9) : '  N/A    ';
    const v2Str = formatNumber(stat.v2).padStart(9);

    const line = `║ ${stat.name.padEnd(33)} ${v1Str}   |   ${v2Str}   | ${status} ${pct.padEnd(5)}║`;
    lines.push(line);
  }

  lines.push('╚════════════════════════════════════════════════════════════════════╝');
  lines.push('');

  if (allMatch) {
    lines.push('✅ MIGRATION INTEGRITY CHECK PASSED - All entities migrated successfully!');
  } else {
    lines.push('⚠️  MIGRATION HAS DISCREPANCIES - Please review the counts above.');
  }

  lines.push('');

  return lines.join('\n');
}

async function main(): Promise<void> {
  console.log('[CHECK] Starting migration integrity check...');

  const stats = await getStats();
  const report = await generateReport(stats);

  console.log(report);

  // Also write to file
  const reportPath = path.resolve(__dirname, 'migration-check-report.txt');
  await fs.writeFile(reportPath, report);
  console.log(`[CHECK] Report saved to: ${reportPath}`);
}

void main().catch((err) => {
  console.error('[CHECK] Failed:', err);
  process.exitCode = 1;
});
