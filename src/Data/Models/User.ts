import { Sequelize, Model, DataTypes, Optional } from 'sequelize';

/* ─── Column contract ─────────────────────────────────────────── */
export interface UserAttributes {
  id: number;
  firstname: string;
  lastname: string;
  email: string | null;
  username: string | null;
  password: string;
  role: 'admin' | 'approval_manager' | 'execution_manager' | 'operator';
  team_id: number | null;
  lang: string;
  is_active: boolean;
  created_at: Date;
  created_by: number | null;
  updated_at: Date;
  updated_by: number | null;
  deleted_at: Date | null;
  deleted_by: number | null;
}

type UserCreation = Optional<
  UserAttributes,
  'id' | 'email' | 'username' | 'role' | 'team_id' | 'lang' | 'is_active' | 'created_at' | 'created_by' | 'updated_at' | 'updated_by' | 'deleted_at' | 'deleted_by'
>;

/* ─── Sequelize model ─────────────────────────────────────────── */
export class User extends Model<UserAttributes, UserCreation> implements UserAttributes {
  declare id: number;
  declare firstname: string;
  declare lastname: string;
  declare email: string | null;
  declare username: string | null;
  declare password: string;
  declare role: 'admin' | 'approval_manager' | 'execution_manager' | 'operator';
  declare team_id: number | null;
  declare lang: string;
  declare is_active: boolean;
  declare readonly created_at: Date;
  declare created_by: number | null;
  declare readonly updated_at: Date;
  declare updated_by: number | null;
  declare deleted_at: Date | null;
  declare deleted_by: number | null;

  // Association helpers (set by Database.SetupAssociations)
  declare Team?: any;

  static InitModel(sequelize: Sequelize): void {
    User.init(
      {
        id:         { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        firstname:  { type: DataTypes.STRING(255), allowNull: false },
        lastname:   { type: DataTypes.STRING(255), allowNull: false },
        email:      { type: DataTypes.STRING(128), allowNull: true, unique: true },
        username:   { type: DataTypes.STRING(128), allowNull: true, unique: true },
        password:   { type: DataTypes.STRING(255), allowNull: false },
        role:       { type: DataTypes.ENUM('admin', 'approval_manager', 'execution_manager', 'operator', 'viewer'), allowNull: false, defaultValue: 'operator' },
        team_id:    { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        lang:       { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'eng' },
        is_active:  { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        deleted_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
        deleted_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      },
      {
        sequelize,
        tableName: 'users',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    );
  }
}
