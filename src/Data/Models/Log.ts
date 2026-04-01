import { Sequelize, Model, DataTypes, Optional } from 'sequelize';

/* ─── Column contract ─────────────────────────────────────────── */
export interface LogAttributes {
  id: number;
  source: 'backoffice' | 'mobile' | 'system';
  level: 'info' | 'warn' | 'error' | 'debug';
  user_id: number | null;
  device_id: number | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  message: string | null;
  metadata: object | null;
  ip_address: string | null;
  created_at: Date;
}

type LogCreation = Optional<
  LogAttributes,
  'id' | 'source' | 'level' | 'user_id' | 'device_id' | 'entity_type' | 'entity_id' | 'message' | 'metadata' | 'ip_address' | 'created_at'
>;

/* ─── Sequelize model ─────────────────────────────────────────── */
export class Log extends Model<LogAttributes, LogCreation> implements LogAttributes {
  declare id: number;
  declare source: 'backoffice' | 'mobile' | 'system';
  declare level: 'info' | 'warn' | 'error' | 'debug';
  declare user_id: number | null;
  declare device_id: number | null;
  declare action: string;
  declare entity_type: string | null;
  declare entity_id: number | null;
  declare message: string | null;
  declare metadata: object | null;
  declare ip_address: string | null;
  declare readonly created_at: Date;

  static InitModel(sequelize: Sequelize): void {
    Log.init(
      {
        id:          { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        source:      { type: DataTypes.ENUM('backoffice', 'mobile', 'system'), allowNull: false, defaultValue: 'system' },
        level:       { type: DataTypes.ENUM('info', 'warn', 'error', 'debug'), allowNull: false, defaultValue: 'info' },
        user_id:     { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        device_id:   { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        action:      { type: DataTypes.STRING(128), allowNull: false },
        entity_type: { type: DataTypes.STRING(64), allowNull: true },
        entity_id:   { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        message:     { type: DataTypes.STRING(2048), allowNull: true },
        metadata:    { type: DataTypes.JSON, allowNull: true },
        ip_address:  { type: DataTypes.STRING(45), allowNull: true },
        created_at:  { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      },
      {
        sequelize,
        tableName: 'logs',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
      },
    );
  }
}
