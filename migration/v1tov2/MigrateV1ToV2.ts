import path from 'path';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import mysql, { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';


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

type V1User = {
  id: number;
  name: string;
  email: string;
  password: string;
  role: string;
  lang: string;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type V1Operator = {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  username: string;
  password: string;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type V1Token = {
  signature: string;
  value: string;
  user_id: number | null;
  expiring_ts: number;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type V1OperatorToken = {
  signature: string;
  value: string;
  operator_id: number | null;
  expiring_ts: number;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type V1SteamLeak = {
  id: number;
  priority: number | null;
  tag: string;
  unit: string | null;
  business_team: string;
  location: string;
  component_equipment: string;
  size: string | null;
  operator: string;
  inspection_date: Date;
  pressure: string | null;
  plume_length: string | null;
  plume_spec: string | null;
  scaffolding: string | null;
  interception_possibility: string | null;
  interception_valve_status: number | null;
  competence: string | null;
  need_for_insulation: number | null;
  asbestos: number | null;
  notification: number | null;
  img_url: string | null;
  status: number | null;
  closure_notification: string | null;
  after_img_url: string | null;
  repair_date: Date | null;
  intervention_type: number | null;
  intervention_description: string | null;
  post_date: string | null;
  reason: string | null;
  steam_flow_kg: number | null;
  steam_flow_tonne: number | null;
  trait_length: string | null;
  metal_sheet: string | null;
  metal_sheet_temperature: string | null;
  insulation_material: string | null;
  pipe_temperature: string | null;
  nominal_flow: string | null;
  dn_discharger: string | null;
  malfunctioning_type: string | null;
  discharger_type: string | null;
  service: string | null;
  steam_discharge_to_closed_system: number | null;
  created_at: Date;
  updated_at: Date;
  is_deleted: number | null;
};

type V1UserRow = RowDataPacket & V1User;
type V1OperatorRow = RowDataPacket & V1Operator;
type V1TokenRow = RowDataPacket & V1Token;
type V1OperatorTokenRow = RowDataPacket & V1OperatorToken;
type V1SteamLeakRow = RowDataPacket & V1SteamLeak;

type NumericRow = RowDataPacket & { c: number };

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

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function normalizeKey(value: string | null | undefined): string {
  return normalizeText(value).toLowerCase().replace(/\s+/g, ' ');
}

function splitLegacyName(fullName: string): { firstname: string; lastname: string } {
  const clean = normalizeText(fullName);
  if (!clean) return { firstname: 'Unknown', lastname: 'User' };

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstname: parts[0], lastname: '-' };

  return {
    firstname: parts.slice(0, -1).join(' ').slice(0, 255),
    lastname: parts.slice(-1).join(' ').slice(0, 255),
  };
}

function roleToV2(value: string): 'admin' | 'approval_manager' | 'execution_manager' | 'operator' | 'viewer' {
  const role = normalizeText(value).toLowerCase();
  if (role === 'admin') return 'admin';
  if (role === 'approval_manager') return 'approval_manager';
  if (role === 'execution_manager') return 'execution_manager';
  if (role === 'operator') return 'operator';
  return 'viewer';
}

function toNullableString(value: string | null | undefined): string | null {
  const clean = normalizeText(value);
  return clean ? clean : null;
}

function normalizeTeamCode(value: string | null | undefined): string {
  const raw = normalizeText(value).toUpperCase();
  if (!raw) return 'N_A';

  const safe = raw
    .replace(/[^A-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 16);

  return safe || 'N_A';
}

function unixTimestampToDate(value: number): Date {
  if (!Number.isFinite(value) || value <= 0) {
    return new Date('2099-12-31T23:59:59.000Z');
  }
  return value > 1e12 ? new Date(value) : new Date(value * 1000);
}

function safeFilename(input: string, fallback: string): string {
  const cleaned = input
    .replace(/[?#].*$/, '')
    .split('/')
    .filter(Boolean)
    .pop();

  const base = (cleaned || fallback)
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .slice(0, 255);

  return base || fallback;
}

function mimeFromFilename(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || '';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'bmp') return 'image/bmp';
  return 'application/octet-stream';
}

function toStoragePath(relativePath: string): string {
  return relativePath.split(path.sep).join('/');
}

function getMediaScanConfig(): {
  rootDir: string;
  beforeDirName: string;
  afterDirName: string;
  includeDbUrls: boolean;
  targetDataRoot: string;
} {
  const rootDir = optional(
    'MIGRATION_MEDIA_SCAN_ROOT',
    path.resolve(__dirname, '..', '..', 'data'),
  );

  const targetDataRoot = optional(
    'MIGRATION_MEDIA_TARGET_ROOT',
    path.resolve(__dirname, '..', '..', 'data'),
  );

  return {
    rootDir,
    beforeDirName: optional('MIGRATION_MEDIA_BEFORE_DIR', 'photo_before'),
    afterDirName: optional('MIGRATION_MEDIA_AFTER_DIR', 'photo_after'),
    includeDbUrls: optionalBool('MIGRATION_MEDIA_FROM_DB_URLS', false),
    targetDataRoot,
  };
}

async function loadInterventionIds(conn: PoolConnection): Promise<Set<number>> {
  const [rows] = await conn.query<(RowDataPacket & { id: number })[]>('SELECT id FROM interventions');
  return new Set(rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0));
}

async function upsertMediaBySlot(
  conn: PoolConnection,
  payload: {
    interventionId: number;
    mediaType: 'photo_before' | 'photo_after';
    filename: string;
    originalFilename: string | null;
    mimeType: string;
    fileSize: number | null;
    storagePath: string;
    createdAt: Date;
    updatedAt: Date;
  },
): Promise<void> {
  const [existingRows] = await conn.query<(RowDataPacket & { id: number })[]>(
    `SELECT id
     FROM media
     WHERE intervention_id = ?
       AND media_type = ?
       AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [payload.interventionId, payload.mediaType],
  );

  const existingId = Number(existingRows[0]?.id ?? 0);

  if (existingId > 0) {
    await conn.query<ResultSetHeader>(
      `UPDATE media
       SET filename = ?,
           original_filename = ?,
           mime_type = ?,
           file_size = ?,
           storage_path = ?,
           updated_at = ?,
           updated_by = NULL,
           deleted_at = NULL,
           deleted_by = NULL
       WHERE id = ?`,
      [
        payload.filename,
        payload.originalFilename,
        payload.mimeType,
        payload.fileSize,
        payload.storagePath,
        payload.updatedAt,
        existingId,
      ],
    );
    return;
  }

  await conn.query<ResultSetHeader>(
    `INSERT INTO media
      (intervention_id, media_type, filename, original_filename, mime_type, file_size, storage_path,
       device_id, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
     VALUES
      (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, NULL, NULL, NULL)`,
    [
      payload.interventionId,
      payload.mediaType,
      payload.filename,
      payload.originalFilename,
      payload.mimeType,
      payload.fileSize,
      payload.storagePath,
      payload.createdAt,
      payload.updatedAt,
    ],
  );
}

async function readFilesSafe(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

// Build stem→id lookup from steamleaks (files are named after the tag, e.g. "CPX-A-0001-24.jpg")
function buildTagToIdMap(leaks: V1SteamLeak[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const leak of leaks) {
    const stem = normalizeText(leak.tag).toLowerCase();
    if (stem) map.set(stem, leak.id);
  }
  return map;
}

// Resolve intervention id from a filename using:
// 1. "{id}_photo_before.*" naming (migration re-run safe)
// 2. stem matching a tag (original v1 naming convention, may have numeric suffixes)
function resolveInterventionIdFromFile(
  filename: string,
  slot: 'photo_before' | 'photo_after',
  tagToIdMap: Map<string, number>,
): number | null {
  // Try id-based naming first (e.g. 123_photo_before.jpg)
  const escaped = slot.replace('_', '\\_');
  const reId = new RegExp(`^(\\d+)_${escaped}(?:\\.[A-Za-z0-9]+)?$`, 'i');
  const matchId = filename.match(reId);
  if (matchId) {
    const id = Number(matchId[1]);
    if (Number.isFinite(id) && id > 0) return id;
  }

  // Try tag-based naming: strip extension and look up in map
  // v1 files may have numeric suffixes (e.g. "CPX-A-0001-24.jpg" where -24 is photo counter)
  const stem = path.parse(filename).name.toLowerCase();
  
  // First, try exact match
  let result = tagToIdMap.get(stem);
  if (result) return result;
  
  // If no exact match, progressively strip trailing -N patterns
  // e.g. "cpx-a-0001-24" -> try "cpx-a-0001" -> "cpx-a-0001" -> try "cpx-a-0001"
  let current = stem;
  const stripPattern = /^(.+)-\d+$/;
  while (stripPattern.test(current)) {
    current = current.replace(stripPattern, '$1');
    result = tagToIdMap.get(current);
    if (result) return result;
  }
  
  return null;
}

// Copy a photo file to the target data directory using the v2 standard naming:
// {targetDataRoot}/{slot}/{interventionId}_{slot}{ext}
// Returns the written filename and storage_path, or null if source missing.
async function copyPhotoToTarget(
  sourceAbsPath: string,
  targetDataRoot: string,
  interventionId: number,
  slot: 'photo_before' | 'photo_after',
  dryRun: boolean,
): Promise<{ filename: string; storagePath: string; fileSize: number } | null> {
  try {
    await fs.access(sourceAbsPath);
  } catch {
    return null; // source file not found
  }

  const stat = await fs.stat(sourceAbsPath);
  const ext = path.extname(sourceAbsPath).toLowerCase() || '.jpg';
  const filename = `${interventionId}_${slot}${ext}`;
  const storagePath = `${slot}/${filename}`;
  const destAbsPath = path.resolve(targetDataRoot, storagePath);

  if (!dryRun) {
    await fs.mkdir(path.dirname(destAbsPath), { recursive: true });
    await fs.copyFile(sourceAbsPath, destAbsPath);
  }

  return { filename, storagePath, fileSize: stat.size };
}

async function readSourceData(sourcePool: Pool): Promise<{
  users: V1User[];
  operators: V1Operator[];
  backofficeTokens: V1Token[];
  mobileTokens: V1OperatorToken[];
  steamLeaks: V1SteamLeak[];
}> {
  const [usersRows] = await sourcePool.query<V1UserRow[]>(
    `SELECT id, name, email, password, role, lang, deleted_at, created_at, updated_at
     FROM users
     ORDER BY id ASC`,
  );

  const [operatorsRows] = await sourcePool.query<V1OperatorRow[]>(
    `SELECT id, firstname, lastname, email, username, password, deleted_at, created_at, updated_at
     FROM operators
     ORDER BY id ASC`,
  );

  const [backofficeTokenRows] = await sourcePool.query<V1TokenRow[]>(
    `SELECT signature, value, user_id, expiring_ts, deleted_at, created_at, updated_at
     FROM auth_tokens`,
  );

  const [mobileTokenRows] = await sourcePool.query<V1OperatorTokenRow[]>(
    `SELECT signature, value, operator_id, expiring_ts, deleted_at, created_at, updated_at
     FROM operators_auth_tokens`,
  );

  const [steamLeakRows] = await sourcePool.query<V1SteamLeakRow[]>(
    `SELECT
      id,
      priority,
      tag,
      unit,
      business_team,
      location,
      component_equipment,
      size,
      operator,
      inspection_date,
      pressure,
      plume_length,
      plume_spec,
      scaffolding,
      interception_possibility,
      interception_valve_status,
      competence,
      need_for_insulation,
      asbestos,
      notification,
      img_url,
      status,
      closure_notification,
      after_img_url,
      repair_date,
      intervention_type,
      intervention_description,
      post_date,
      reason,
      steam_flow_kg,
      steam_flow_tonne,
      trait_length,
      metal_sheet,
      metal_sheet_temperature,
      insulation_material,
      pipe_temperature,
      nominal_flow,
      dn_discharger,
      malfunctioning_type,
      discharger_type,
      service,
      steam_discharge_to_closed_system,
      created_at,
      updated_at,
      is_deleted
     FROM steamleaks
     ORDER BY id ASC`,
  );

  const users = usersRows.map((row) => ({ ...row }));
  const operators = operatorsRows.map((row) => ({ ...row }));
  const backofficeTokens = backofficeTokenRows.map((row) => ({ ...row }));
  const mobileTokens = mobileTokenRows.map((row) => ({ ...row }));
  const steamLeaks = steamLeakRows.map((row) => ({ ...row }));

  return { users, operators, backofficeTokens, mobileTokens, steamLeaks };
}

async function assertDestinationState(conn: PoolConnection, allowNonEmptyDestination: boolean): Promise<void> {
  const [rows] = await conn.query<NumericRow[]>(
    `SELECT
      (SELECT COUNT(*) FROM users) AS c`,
  );
  const usersCount = Number(rows[0]?.c ?? 0);

  const [rowsInterventions] = await conn.query<NumericRow[]>(
    `SELECT
      (SELECT COUNT(*) FROM interventions) AS c`,
  );
  const interventionsCount = Number(rowsInterventions[0]?.c ?? 0);

  const [rowsTeams] = await conn.query<NumericRow[]>(
    `SELECT
      (SELECT COUNT(*) FROM teams) AS c`,
  );
  const teamsCount = Number(rowsTeams[0]?.c ?? 0);

  const total = usersCount + interventionsCount + teamsCount;
  if (!allowNonEmptyDestination && total > 0) {
    throw new Error(
      [
        'Destination DB is not empty (users/interventions/teams already contain data).',
        'Set MIGRATION_ALLOW_NON_EMPTY_DESTINATION=true or MIGRATION_TRUNCATE_TARGET=true to proceed.',
      ].join(' '),
    );
  }
}

async function truncateDestination(conn: PoolConnection): Promise<void> {
  const tables = [
    'logs',
    'media',
    'intervention_history',
    'access_tokens',
    'interventions',
    'mobile_devices',
    'units',
    'users',
    'teams',
  ];

  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    for (const table of tables) {
      try {
        await conn.query(`TRUNCATE TABLE ${table}`);
      } catch (err: any) {
        if (err?.code === 'ER_NO_SUCH_TABLE') continue; // skip non-existent tables
        throw err;
      }
    }
  } finally {
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}

async function upsertTeam(
  conn: PoolConnection,
  code: string,
  defaultActorId: number,
): Promise<number> {
  const name = code;

  await conn.query<ResultSetHeader>(
    `INSERT INTO teams
      (name, code, description, is_active, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
     VALUES
      (?, ?, ?, 1, NOW(), ?, NOW(), ?, NULL, NULL)
     ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      description = VALUES(description),
      is_active = 1,
      updated_at = NOW(),
      updated_by = VALUES(updated_by),
      deleted_at = NULL,
      deleted_by = NULL`,
    [name, code, `Imported from v1 team code ${code}`, defaultActorId, defaultActorId],
  );

  const [rows] = await conn.query<(RowDataPacket & { id: number })[]>(
    'SELECT id FROM teams WHERE code = ? LIMIT 1',
    [code],
  );

  const id = Number(rows[0]?.id ?? 0);
  if (!id) throw new Error(`Unable to resolve team_id for team code ${code}`);
  return id;
}

async function upsertUnit(
  conn: PoolConnection,
  teamId: number,
  unitName: string,
  defaultActorId: number,
): Promise<void> {
  await conn.query<ResultSetHeader>(
    `INSERT INTO units
      (team_id, name, is_active, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
     VALUES
      (?, ?, 1, NOW(), ?, NOW(), ?, NULL, NULL)
     ON DUPLICATE KEY UPDATE
      team_id = VALUES(team_id),
      is_active = 1,
      updated_at = NOW(),
      updated_by = VALUES(updated_by),
      deleted_at = NULL,
      deleted_by = NULL`,
    [teamId, unitName, defaultActorId, defaultActorId],
  );
}

async function migrateUsers(
  conn: PoolConnection,
  users: V1User[],
): Promise<void> {
  for (const user of users) {
    const split = splitLegacyName(user.name);
    const usernameFromEmail = normalizeText(user.email).toLowerCase().split('@')[0] || `legacy_user_${user.id}`;

    await conn.query<ResultSetHeader>(
      `INSERT INTO users
        (id, firstname, lastname, email, username, password, role, team_id, lang, is_active,
         created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
       VALUES
        (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, ?, NULL, ?, NULL)
       ON DUPLICATE KEY UPDATE
         firstname = VALUES(firstname),
         lastname = VALUES(lastname),
         email = VALUES(email),
         username = VALUES(username),
         password = VALUES(password),
         role = VALUES(role),
         lang = VALUES(lang),
         is_active = VALUES(is_active),
         updated_at = VALUES(updated_at),
         deleted_at = VALUES(deleted_at),
         deleted_by = VALUES(deleted_by)`,
      [
        user.id,
        split.firstname,
        split.lastname,
        toNullableString(user.email),
        usernameFromEmail.slice(0, 128),
        user.password,
        roleToV2(user.role),
        normalizeText(user.lang) || 'eng',
        user.deleted_at ? 0 : 1,
        user.created_at,
        user.updated_at,
        user.deleted_at,
      ],
    );
  }
}

async function migrateOperators(
  conn: PoolConnection,
  operators: V1Operator[],
): Promise<Map<number, number>> {
  const legacyOperatorToUserId = new Map<number, number>();

  for (const operator of operators) {
    const email = toNullableString(operator.email);
    const username = (normalizeText(operator.username) || `legacy_operator_${operator.id}`).slice(0, 128);

    await conn.query<ResultSetHeader>(
      `INSERT INTO users
        (firstname, lastname, email, username, password, role, team_id, lang, is_active,
         created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
       VALUES
        (?, ?, ?, ?, ?, 'operator', NULL, 'eng', ?, ?, NULL, ?, NULL, ?, NULL)
       ON DUPLICATE KEY UPDATE
         firstname = VALUES(firstname),
         lastname = VALUES(lastname),
         email = VALUES(email),
         username = VALUES(username),
         password = VALUES(password),
         role = 'operator',
         is_active = VALUES(is_active),
         updated_at = VALUES(updated_at),
         deleted_at = VALUES(deleted_at),
         deleted_by = VALUES(deleted_by)`,
      [
        normalizeText(operator.firstname) || 'Unknown',
        normalizeText(operator.lastname) || '-',
        email,
        username,
        operator.password,
        operator.deleted_at ? 0 : 1,
        operator.created_at,
        operator.updated_at,
        operator.deleted_at,
      ],
    );

    const [rows] = await conn.query<(RowDataPacket & { id: number })[]>(
      'SELECT id FROM users WHERE username = ? LIMIT 1',
      [username],
    );

    const userId = Number(rows[0]?.id ?? 0);
    if (!userId) {
      throw new Error(`Unable to resolve target user for legacy operator id ${operator.id}`);
    }
    legacyOperatorToUserId.set(operator.id, userId);
  }

  return legacyOperatorToUserId;
}

function buildOperatorLookup(
  users: V1User[],
  operators: V1Operator[],
  operatorMap: Map<number, number>,
): Map<string, number> {
  const lookup = new Map<string, number>();

  for (const u of users) {
    const keyByName = normalizeKey(u.name);
    if (keyByName) lookup.set(keyByName, u.id);

    const split = splitLegacyName(u.name);
    const full = normalizeKey(`${split.firstname} ${split.lastname}`);
    if (full) lookup.set(full, u.id);

    const keyByEmail = normalizeKey(u.email);
    if (keyByEmail) lookup.set(keyByEmail, u.id);
  }

  for (const op of operators) {
    const userId = operatorMap.get(op.id);
    if (!userId) continue;

    const full = normalizeKey(`${op.firstname} ${op.lastname}`);
    const inverted = normalizeKey(`${op.lastname} ${op.firstname}`);
    const byUsername = normalizeKey(op.username);
    const byEmail = normalizeKey(op.email);

    if (full) lookup.set(full, userId);
    if (inverted) lookup.set(inverted, userId);
    if (byUsername) lookup.set(byUsername, userId);
    if (byEmail) lookup.set(byEmail, userId);
  }

  return lookup;
}

async function migrateTeamsAndUnits(
  conn: PoolConnection,
  leaks: V1SteamLeak[],
  defaultActorId: number,
): Promise<Map<string, number>> {
  const teamCodes = new Set<string>();
  for (const leak of leaks) {
    teamCodes.add(normalizeTeamCode(leak.business_team));
  }

  const teamMap = new Map<string, number>();
  const sortedCodes = [...teamCodes].sort();

  for (const code of sortedCodes) {
    const teamId = await upsertTeam(conn, code, defaultActorId);
    teamMap.set(code, teamId);
  }

  const seenUnits = new Set<string>();
  for (const leak of leaks) {
    const unitName = normalizeText(leak.unit);
    if (!unitName) continue;

    const teamCode = normalizeTeamCode(leak.business_team);
    const teamId = teamMap.get(teamCode);
    if (!teamId) continue;

    const dedupeKey = `${teamId}|${unitName.toLowerCase()}`;
    if (seenUnits.has(dedupeKey)) continue;
    seenUnits.add(dedupeKey);

    await upsertUnit(conn, teamId, unitName.slice(0, 64), defaultActorId);
  }

  return teamMap;
}

async function migrateInterventions(
  conn: PoolConnection,
  leaks: V1SteamLeak[],
  operatorLookup: Map<string, number>,
): Promise<void> {
  for (const row of leaks) {
    const opKey = normalizeKey(row.operator);
    const operatorId = opKey ? (operatorLookup.get(opKey) ?? null) : null;
    const deleted = Number(row.is_deleted ?? 0) === 1;

    await conn.query<ResultSetHeader>(
      `INSERT INTO interventions
      (
        id,
        tag,
        business_team,
        unit,
        intervention_type,
        priority,
        status,
        location,
        component_equipment,
        size,
        operator_id,
        inspection_date,
        device_id,
        pressure,
        plume_length,
        plume_spec,
        steam_flow_kg,
        steam_flow_tonne,
        nominal_flow,
        pipe_temperature,
        malfunctioning_type,
        discharger_type,
        dn_discharger,
        service,
        steam_discharge_to_closed_system,
        scaffolding,
        interception_possibility,
        interception_valve_status,
        competence,
        need_for_insulation,
        insulation_material,
        metal_sheet,
        metal_sheet_temperature,
        trait_length,
        asbestos,
        notification,
        closure_notification,
        repair_date,
        manually_added_at,
        approval_note,
        intervention_description,
        post_date,
        reason,
        created_at,
        created_by,
        updated_at,
        updated_by,
        row_version,
        deleted_at,
        deleted_by
      )
      VALUES
      (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        NULL, NULL, ?, ?, ?,
        ?, NULL, ?, NULL, 0, ?, NULL
      )
      ON DUPLICATE KEY UPDATE
        tag = VALUES(tag),
        business_team = VALUES(business_team),
        unit = VALUES(unit),
        intervention_type = VALUES(intervention_type),
        priority = VALUES(priority),
        status = VALUES(status),
        location = VALUES(location),
        component_equipment = VALUES(component_equipment),
        size = VALUES(size),
        operator_id = VALUES(operator_id),
        inspection_date = VALUES(inspection_date),
        pressure = VALUES(pressure),
        plume_length = VALUES(plume_length),
        plume_spec = VALUES(plume_spec),
        steam_flow_kg = VALUES(steam_flow_kg),
        steam_flow_tonne = VALUES(steam_flow_tonne),
        nominal_flow = VALUES(nominal_flow),
        pipe_temperature = VALUES(pipe_temperature),
        malfunctioning_type = VALUES(malfunctioning_type),
        discharger_type = VALUES(discharger_type),
        dn_discharger = VALUES(dn_discharger),
        service = VALUES(service),
        steam_discharge_to_closed_system = VALUES(steam_discharge_to_closed_system),
        scaffolding = VALUES(scaffolding),
        interception_possibility = VALUES(interception_possibility),
        interception_valve_status = VALUES(interception_valve_status),
        competence = VALUES(competence),
        need_for_insulation = VALUES(need_for_insulation),
        insulation_material = VALUES(insulation_material),
        metal_sheet = VALUES(metal_sheet),
        metal_sheet_temperature = VALUES(metal_sheet_temperature),
        trait_length = VALUES(trait_length),
        asbestos = VALUES(asbestos),
        notification = VALUES(notification),
        closure_notification = VALUES(closure_notification),
        repair_date = VALUES(repair_date),
        intervention_description = VALUES(intervention_description),
        post_date = VALUES(post_date),
        reason = VALUES(reason),
        updated_at = VALUES(updated_at),
        deleted_at = VALUES(deleted_at),
        deleted_by = VALUES(deleted_by)`,
      [
        row.id,
        normalizeText(row.tag),
        normalizeTeamCode(row.business_team),
        toNullableString(row.unit),
        Number(row.intervention_type ?? 0),
        Number(row.priority ?? 0),
        Number(row.status ?? 0),
        normalizeText(row.location),
        normalizeText(row.component_equipment),
        toNullableString(row.size),
        operatorId,
        row.inspection_date,
        toNullableString(row.pressure),
        toNullableString(row.plume_length),
        toNullableString(row.plume_spec),
        row.steam_flow_kg ?? 0,
        row.steam_flow_tonne ?? 0,
        toNullableString(row.nominal_flow),
        toNullableString(row.pipe_temperature),
        toNullableString(row.malfunctioning_type),
        toNullableString(row.discharger_type),
        toNullableString(row.dn_discharger),
        toNullableString(row.service),
        row.steam_discharge_to_closed_system,
        toNullableString(row.scaffolding),
        toNullableString(row.interception_possibility),
        row.interception_valve_status,
        toNullableString(row.competence),
        row.need_for_insulation,
        toNullableString(row.insulation_material),
        toNullableString(row.metal_sheet),
        toNullableString(row.metal_sheet_temperature),
        toNullableString(row.trait_length),
        row.asbestos,
        row.notification,
        toNullableString(row.closure_notification),
        row.repair_date,
        toNullableString(row.intervention_description),
        toNullableString(row.post_date),
        toNullableString(row.reason),
        row.created_at,
        row.updated_at,
        deleted ? row.updated_at : null,
      ],
    );
  }
}

async function migrateTokens(
  conn: PoolConnection,
  backofficeTokens: V1Token[],
  mobileTokens: V1OperatorToken[],
  operatorMap: Map<number, number>,
): Promise<void> {
  for (const token of backofficeTokens) {
    if (!token.user_id) continue;

    await conn.query<ResultSetHeader>(
      `INSERT INTO access_tokens
        (user_id, device_id, source, token, signature, expires_at, ip_address, user_agent, revoked_at, created_at)
       VALUES
        (?, NULL, 'backoffice', ?, ?, ?, NULL, NULL, ?, ?)
       ON DUPLICATE KEY UPDATE
        user_id = VALUES(user_id),
        token = VALUES(token),
        expires_at = VALUES(expires_at),
        revoked_at = VALUES(revoked_at)`,
      [
        token.user_id,
        token.value,
        token.signature,
        unixTimestampToDate(Number(token.expiring_ts)),
        token.deleted_at,
        token.created_at,
      ],
    );
  }

  for (const token of mobileTokens) {
    if (!token.operator_id) continue;

    const mappedUserId = operatorMap.get(token.operator_id);
    if (!mappedUserId) continue;

    await conn.query<ResultSetHeader>(
      `INSERT INTO access_tokens
        (user_id, device_id, source, token, signature, expires_at, ip_address, user_agent, revoked_at, created_at)
       VALUES
        (?, NULL, 'mobile', ?, ?, ?, NULL, NULL, ?, ?)
       ON DUPLICATE KEY UPDATE
        user_id = VALUES(user_id),
        token = VALUES(token),
        expires_at = VALUES(expires_at),
        revoked_at = VALUES(revoked_at)`,
      [
        mappedUserId,
        token.value,
        token.signature,
        unixTimestampToDate(Number(token.expiring_ts)),
        token.deleted_at,
        token.created_at,
      ],
    );
  }
}

async function migrateMedia(
  conn: PoolConnection,
  leaks: V1SteamLeak[],
  dryRun: boolean,
): Promise<number> {
  const interventionIds = await loadInterventionIds(conn);
  const tagToIdMap = buildTagToIdMap(leaks);
  let insertedOrUpdated = 0;
  let skipped = 0;

  const mediaScan = getMediaScanConfig();
  const beforeDirAbs = path.resolve(mediaScan.rootDir, mediaScan.beforeDirName);
  const afterDirAbs = path.resolve(mediaScan.rootDir, mediaScan.afterDirName);
  const targetDataRoot = path.resolve(mediaScan.targetDataRoot);

  // ── Phase 1: DB fields (img_url / after_img_url) ─────────────────
  // img_url / after_img_url store the full filesystem path or URL.
  // Extract the basename, find the actual file in the source dir, copy it.
  //
  // NOTE: disabled by default (MIGRATION_MEDIA_FROM_DB_URLS=false) because v1 often
  // stores stale absolute desktop paths that don't exist on the migration host.
  // Phase 2 (filesystem scan) is the primary and reliable mechanism.
  if (mediaScan.includeDbUrls) {
    const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.heic', '.heif']);

    for (const row of leaks) {
      if (!interventionIds.has(row.id)) continue;

      const beforeRaw = normalizeText(row.img_url);
      const afterRaw = normalizeText(row.after_img_url);

      for (const [rawPath, slot, sourceDir] of [
        [beforeRaw, 'photo_before' as const, beforeDirAbs],
        [afterRaw, 'photo_after' as const, afterDirAbs],
      ] as const) {
        if (!rawPath) continue;

        // Extract just the basename from a full path or URL
        const basename = rawPath.replace(/[?#].*$/, '').split(/[\\/]/).filter(Boolean).pop();
        if (!basename) continue;

        // Skip null-equivalents (e.g. "0") and non-image filenames
        const ext = path.extname(basename).toLowerCase();
        if (!IMAGE_EXTS.has(ext)) continue;

        const sourceAbsPath = path.resolve(sourceDir, basename);
        const result = await copyPhotoToTarget(sourceAbsPath, targetDataRoot, row.id, slot, dryRun);

        // Silently skip if not found — Phase 2 will cover files present on disk
        if (!result) continue;

        await upsertMediaBySlot(conn, {
          interventionId: row.id,
          mediaType: slot,
          filename: result.filename,
          originalFilename: basename,
          mimeType: mimeFromFilename(result.filename),
          fileSize: result.fileSize,
          storagePath: result.storagePath,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
        insertedOrUpdated += 1;
      }
    }
  }

  // ── Phase 2: Filesystem scan (catches photos not referenced in DB) ─
  // Files are named by tag (e.g. CPX-A-0001-24.jpg) or by legacy id pattern.
  console.log(`[MIGRATION:MEDIA:PHASE2] Tag map has ${tagToIdMap.size} entries`);
  console.log(`[MIGRATION:MEDIA:PHASE2] Valid intervention IDs: ${interventionIds.size} total`);
  
  for (const [sourceDir, slot] of [
    [beforeDirAbs, 'photo_before' as const],
    [afterDirAbs, 'photo_after' as const],
  ] as const) {
    const files = await readFilesSafe(sourceDir);
    let matchedInSlot = 0;
    let unresolvedInSlot = 0;

    console.log(`[MIGRATION:MEDIA:PHASE2] Found ${files.length} files in ${slot} directory`);

    for (const file of files) {
      const interventionId = resolveInterventionIdFromFile(file, slot, tagToIdMap);
      if (!interventionId) {
        unresolvedInSlot += 1;
        if (unresolvedInSlot <= 5) console.log(`[MIGRATION:MEDIA:PHASE2:UNRESOLVED] ${file}`);
        continue;
      }
      if (!interventionIds.has(interventionId)) {
        console.log(`[MIGRATION:MEDIA:PHASE2] File ${file} resolved to id=${interventionId} but intervention not in target DB`);
        continue;
      }
      matchedInSlot += 1;

      const sourceAbsPath = path.resolve(sourceDir, file);
      const result = await copyPhotoToTarget(sourceAbsPath, targetDataRoot, interventionId, slot, dryRun);

      if (!result) {
        skipped += 1;
        continue;
      }

      const stat = await fs.stat(sourceAbsPath);
      await upsertMediaBySlot(conn, {
        interventionId,
        mediaType: slot,
        filename: result.filename,
        originalFilename: file.slice(0, 255),
        mimeType: mimeFromFilename(result.filename),
        fileSize: result.fileSize,
        storagePath: result.storagePath,
        createdAt: stat.mtime,
        updatedAt: stat.mtime,
      });
      insertedOrUpdated += 1;
    }

    console.log(`[MIGRATION:MEDIA:PHASE2] ${slot}: matched=${matchedInSlot} unresolved=${unresolvedInSlot}`);
  }

  if (skipped > 0) {
    console.warn(`[MIGRATION:MEDIA] Skipped ${skipped} files (source not found or unresolvable intervention id)`);
  }

  return insertedOrUpdated;
}

async function main(): Promise<void> {
  const dryRun = optionalBool('MIGRATION_DRY_RUN', true);
  const truncateTarget = optionalBool('MIGRATION_TRUNCATE_TARGET', false);
  const allowNonEmptyDestination = optionalBool('MIGRATION_ALLOW_NON_EMPTY_DESTINATION', false);
  const includeMedia = optionalBool('MIGRATION_INCLUDE_MEDIA', true);
  const mediaScan = getMediaScanConfig();

  const sourceCfg = getSourceDbConfig();
  const targetCfg = getTargetDbConfig();

  console.log('[MIGRATION] Starting v1 -> v2');
  console.log(`[MIGRATION] Source: ${sourceCfg.host}:${sourceCfg.port}/${sourceCfg.database}`);
  console.log(`[MIGRATION] Target: ${targetCfg.host}:${targetCfg.port}/${targetCfg.database}`);
  console.log(`[MIGRATION] Options: dryRun=${dryRun} truncateTarget=${truncateTarget} includeMedia=${includeMedia}`);
  console.log(`[MIGRATION] Media scan: root=${mediaScan.rootDir} beforeDir=${mediaScan.beforeDirName} afterDir=${mediaScan.afterDirName} fromDbUrls=${mediaScan.includeDbUrls}`);
  console.log(`[MIGRATION] Media target: ${mediaScan.targetDataRoot}`);

  const sourcePool = createPool(sourceCfg);
  const targetPool = createPool(targetCfg);

  let targetConn: PoolConnection | null = null;

  try {
    const sourceData = await readSourceData(sourcePool);
    console.log(
      `[MIGRATION] Loaded from source: users=${sourceData.users.length}, operators=${sourceData.operators.length}, steamleaks=${sourceData.steamLeaks.length}, backoffice_tokens=${sourceData.backofficeTokens.length}, mobile_tokens=${sourceData.mobileTokens.length}`,
    );

    targetConn = await targetPool.getConnection();
    await targetConn.beginTransaction();

    await assertDestinationState(targetConn, allowNonEmptyDestination || truncateTarget);

    if (truncateTarget) {
      console.log('[MIGRATION] Truncating destination tables...');
      await truncateDestination(targetConn);
    }

    await migrateUsers(targetConn, sourceData.users);

    const operatorMap = await migrateOperators(targetConn, sourceData.operators);
    const operatorLookup = buildOperatorLookup(sourceData.users, sourceData.operators, operatorMap);

    const defaultActorId = sourceData.users[0]?.id ?? 1;
    await migrateTeamsAndUnits(targetConn, sourceData.steamLeaks, defaultActorId);

    await migrateInterventions(targetConn, sourceData.steamLeaks, operatorLookup);
    await migrateTokens(targetConn, sourceData.backofficeTokens, sourceData.mobileTokens, operatorMap);

    let mediaInserted = 0;
    if (includeMedia) {
      mediaInserted = await migrateMedia(targetConn, sourceData.steamLeaks, dryRun);
    }

    if (dryRun) {
      await targetConn.rollback();
      console.log('[MIGRATION] Dry-run completed. Transaction rolled back.');
    } else {
      await targetConn.commit();
      console.log('[MIGRATION] Commit completed.');
    }

    console.log(
      [
        '[MIGRATION] Summary:',
        `users=${sourceData.users.length}`,
        `operators=${sourceData.operators.length}`,
        `interventions=${sourceData.steamLeaks.length}`,
        `backoffice_tokens=${sourceData.backofficeTokens.length}`,
        `mobile_tokens=${sourceData.mobileTokens.length}`,
        `media_rows=${mediaInserted}`,
      ].join(' '),
    );
  } catch (error) {
    if (targetConn) {
      try {
        await targetConn.rollback();
      } catch {
        // No-op rollback safeguard
      }
    }
    console.error('[MIGRATION] Failed:', error);
    process.exitCode = 1;
  } finally {
    if (targetConn) targetConn.release();
    await sourcePool.end();
    await targetPool.end();
  }
}

void main();
