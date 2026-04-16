import { QueryTypes, Sequelize as SequelizeInstance } from 'sequelize';
import { Config } from '../Config/Index';
import {
  User,
  AccessToken,
  Team,
  Unit,
  MobileDevice,
  Intervention,
  InterventionHistory,
  Media,
  Log,
} from '../Data/Models/Index';


/* ─── Sequelize singleton ──────────────────────────────────────── */
// Exported so adapters/operations can reference the instance for raw queries / transactions.

export const Sequelize = new SequelizeInstance(
  Config.Db.Name,
  Config.Db.User,
  Config.Db.Password,
  {
    host: Config.Db.Host,
    port: Config.Db.Port,
    dialect: 'mysql',
    logging: false,
    pool: { max: 10, min: 0, acquire: 30_000, idle: 10_000 },
    define: { freezeTableName: true },
  },
);


/* ─── Model initialisation ─────────────────────────────────────── */

function InitModels(): void {
  User.InitModel(Sequelize);
  AccessToken.InitModel(Sequelize);
  Team.InitModel(Sequelize);
  Unit.InitModel(Sequelize);
  MobileDevice.InitModel(Sequelize);
  Intervention.InitModel(Sequelize);
  InterventionHistory.InitModel(Sequelize);
  Media.InitModel(Sequelize);
  Log.InitModel(Sequelize);
}


/* ─── Associations ─────────────────────────────────────────────── */

function SetupAssociations(): void {

  // ── User ↔ Team ──
  Team.hasMany(User, { foreignKey: 'team_id', as: 'Users' });
  User.belongsTo(Team, { foreignKey: 'team_id', as: 'Team' });

  // ── Team ↔ Unit ──
  Team.hasMany(Unit, { foreignKey: 'team_id', as: 'Units' });
  Unit.belongsTo(Team, { foreignKey: 'team_id', as: 'Team' });

  // ── User ↔ AccessToken ──
  User.hasMany(AccessToken, { foreignKey: 'user_id', as: 'Tokens' });
  AccessToken.belongsTo(User, { foreignKey: 'user_id', as: 'User' });

  // ── MobileDevice ↔ AccessToken ──
  MobileDevice.hasMany(AccessToken, { foreignKey: 'device_id', as: 'Tokens' });
  AccessToken.belongsTo(MobileDevice, { foreignKey: 'device_id', as: 'Device' });

  // ── User ↔ Intervention (operator_id keeps its column name; alias 'Operator') ──
  User.hasMany(Intervention, { foreignKey: 'operator_id', as: 'Interventions' });
  Intervention.belongsTo(User, { foreignKey: 'operator_id', as: 'Operator' });

  // ── Intervention ↔ InterventionHistory ──
  Intervention.hasMany(InterventionHistory, { foreignKey: 'intervention_id', as: 'History' });
  InterventionHistory.belongsTo(Intervention, { foreignKey: 'intervention_id', as: 'Intervention' });

  // ── User ↔ InterventionHistory ──
  User.hasMany(InterventionHistory, { foreignKey: 'changed_by_user_id', as: 'HistoryChanges' });
  InterventionHistory.belongsTo(User, { foreignKey: 'changed_by_user_id', as: 'ChangedBy' });

  // ── Intervention ↔ Media ──
  Intervention.hasMany(Media, { foreignKey: 'intervention_id', as: 'Media' });
  Media.belongsTo(Intervention, { foreignKey: 'intervention_id', as: 'Intervention' });

  // ── User ↔ Media (created_by) ──
  User.hasMany(Media, { foreignKey: 'created_by', as: 'UploadedMedia' });
  Media.belongsTo(User, { foreignKey: 'created_by', as: 'UploadedBy' });

  // ── MobileDevice ↔ Media ──
  MobileDevice.hasMany(Media, { foreignKey: 'device_id', as: 'Media' });
  Media.belongsTo(MobileDevice, { foreignKey: 'device_id', as: 'Device' });

  // ── User ↔ Log ──
  User.hasMany(Log, { foreignKey: 'user_id', as: 'Logs' });
  Log.belongsTo(User, { foreignKey: 'user_id', as: 'User' });

  // ── MobileDevice ↔ Log ──
  MobileDevice.hasMany(Log, { foreignKey: 'device_id', as: 'DeviceLogs' });
  Log.belongsTo(MobileDevice, { foreignKey: 'device_id', as: 'Device' });

  // ── Audit self-referencing FKs (User ↔ created_by / updated_by / deleted_by) ──
  // These are logical FK columns. Sequelize associations are optional;
  // the DB schema enforces the FK constraints.
}

async function EnsureUnitColumns(): Promise<void> {
  const RequiredColumns: Array<{ Name: string; Sql: string }> = [
    { Name: 'created_by', Sql: 'ALTER TABLE units ADD COLUMN created_by BIGINT UNSIGNED NULL DEFAULT NULL' },
    { Name: 'updated_by', Sql: 'ALTER TABLE units ADD COLUMN updated_by BIGINT UNSIGNED NULL DEFAULT NULL' },
    { Name: 'deleted_by', Sql: 'ALTER TABLE units ADD COLUMN deleted_by BIGINT UNSIGNED NULL DEFAULT NULL' },
    { Name: 'deleted_at', Sql: 'ALTER TABLE units ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL' },
  ];

  for (const column of RequiredColumns) {
    const Exists = await Sequelize.query<{ c: number }>(
      `SELECT COUNT(*) AS c
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'units'
         AND COLUMN_NAME = :columnName`,
      { replacements: { columnName: column.Name }, type: QueryTypes.SELECT },
    );

    if (Number(Exists[0]?.c ?? 0) === 0) {
      await Sequelize.query(column.Sql);
      console.log(`[DB] Added missing units.${column.Name} column`);
    }
  }
}


/* ─── Public bootstrap ─────────────────────────────────────────── */

export async function ConnectDatabase(): Promise<void> {
  InitModels();
  SetupAssociations();
  await Sequelize.authenticate();
  console.log('[DB] Connection established');
  await Sequelize.sync();
  await EnsureUnitColumns();
  console.log('[DB] Models synchronised');
}
