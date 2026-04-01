import { Sequelize, Model, DataTypes, Optional } from 'sequelize';

/* ─── Column contract ─────────────────────────────────────────── */
export interface AccessTokenAttributes {
  id: number;
  user_id: number;
  device_id: number | null;
  source: 'backoffice' | 'mobile';
  token: string;
  signature: string;
  expires_at: Date;
  ip_address: string | null;
  user_agent: string | null;
  revoked_at: Date | null;
  created_at: Date;
}

type AccessTokenCreation = Optional<
  AccessTokenAttributes,
  'id' | 'device_id' | 'ip_address' | 'user_agent' | 'revoked_at' | 'created_at'
>;

/* ─── Sequelize model ─────────────────────────────────────────── */
export class AccessToken extends Model<AccessTokenAttributes, AccessTokenCreation> implements AccessTokenAttributes {
  declare id: number;
  declare user_id: number;
  declare device_id: number | null;
  declare source: 'backoffice' | 'mobile';
  declare token: string;
  declare signature: string;
  declare expires_at: Date;
  declare ip_address: string | null;
  declare user_agent: string | null;
  declare revoked_at: Date | null;
  declare readonly created_at: Date;

  // Association helpers
  declare User?: any;
  declare Device?: any;

  static InitModel(sequelize: Sequelize): void {
    AccessToken.init(
      {
        id:         { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        user_id:    { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        device_id:  { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        source:     { type: DataTypes.ENUM('backoffice', 'mobile'), allowNull: false },
        token:      { type: DataTypes.STRING(512), allowNull: false },
        signature:  { type: DataTypes.STRING(255), allowNull: false, unique: true },
        expires_at: { type: DataTypes.DATE, allowNull: false },
        ip_address: { type: DataTypes.STRING(45), allowNull: true },
        user_agent: { type: DataTypes.STRING(512), allowNull: true },
        revoked_at: { type: DataTypes.DATE, allowNull: true },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      },
      {
        sequelize,
        tableName: 'access_tokens',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
      },
    );
  }
}
