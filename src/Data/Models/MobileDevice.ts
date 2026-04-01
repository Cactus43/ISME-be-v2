import { Sequelize, Model, DataTypes, Optional } from 'sequelize';

/* ─── Column contract ─────────────────────────────────────────── */
export interface MobileDeviceAttributes {
  id: number;
  device_uuid: string;
  device_name: string | null;
  platform: 'android' | 'ios' | 'other';
  os_version: string | null;
  app_version: string | null;
  push_token: string | null;
  last_seen_at: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  deleted_by: number | null;
}

type DeviceCreation = Optional<
  MobileDeviceAttributes,
  'id' | 'device_name' | 'platform' | 'os_version' | 'app_version' | 'push_token' | 'last_seen_at' | 'is_active' | 'created_at' | 'updated_at' | 'deleted_at' | 'deleted_by'
>;

/* ─── Sequelize model ─────────────────────────────────────────── */
export class MobileDevice extends Model<MobileDeviceAttributes, DeviceCreation> implements MobileDeviceAttributes {
  declare id: number;
  declare device_uuid: string;
  declare device_name: string | null;
  declare platform: 'android' | 'ios' | 'other';
  declare os_version: string | null;
  declare app_version: string | null;
  declare push_token: string | null;
  declare last_seen_at: Date | null;
  declare is_active: boolean;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
  declare deleted_at: Date | null;
  declare deleted_by: number | null;

  static InitModel(sequelize: Sequelize): void {
    MobileDevice.init(
      {
        id:            { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        device_uuid:   { type: DataTypes.STRING(255), allowNull: false, unique: true },
        device_name:   { type: DataTypes.STRING(255), allowNull: true },
        platform:      { type: DataTypes.ENUM('android', 'ios', 'other'), allowNull: false, defaultValue: 'android' },
        os_version:    { type: DataTypes.STRING(64), allowNull: true },
        app_version:   { type: DataTypes.STRING(32), allowNull: true },
        push_token:    { type: DataTypes.STRING(512), allowNull: true },
        last_seen_at:  { type: DataTypes.DATE, allowNull: true },
        is_active:     { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
        created_at:    { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated_at:    { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        deleted_at:    { type: DataTypes.DATE, allowNull: true, defaultValue: null },
        deleted_by:    { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      },
      {
        sequelize,
        tableName: 'mobile_devices',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    );
  }
}
