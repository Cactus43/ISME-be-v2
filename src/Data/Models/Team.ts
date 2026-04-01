import { Sequelize, Model, DataTypes, Optional } from 'sequelize';

/* ─── Column contract ─────────────────────────────────────────── */
export interface TeamAttributes {
  id: number;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  created_at: Date;
  created_by: number | null;
  updated_at: Date;
  updated_by: number | null;
  deleted_at: Date | null;
  deleted_by: number | null;
}

type TeamCreation = Optional<
  TeamAttributes,
  'id' | 'description' | 'is_active' | 'created_at' | 'created_by' | 'updated_at' | 'updated_by' | 'deleted_at' | 'deleted_by'
>;

/* ─── Sequelize model ─────────────────────────────────────────── */
export class Team extends Model<TeamAttributes, TeamCreation> implements TeamAttributes {
  declare id: number;
  declare name: string;
  declare code: string;
  declare description: string | null;
  declare is_active: boolean;
  declare readonly created_at: Date;
  declare created_by: number | null;
  declare readonly updated_at: Date;
  declare updated_by: number | null;
  declare deleted_at: Date | null;
  declare deleted_by: number | null;

  static InitModel(sequelize: Sequelize): void {
    Team.init(
      {
        id:          { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        name:        { type: DataTypes.STRING(128), allowNull: false, unique: true },
        code:        { type: DataTypes.STRING(16), allowNull: false, unique: true },
        description: { type: DataTypes.STRING(512), allowNull: true },
        is_active:   { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
        created_at:  { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        created_by:  { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        updated_at:  { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated_by:  { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        deleted_at:  { type: DataTypes.DATE, allowNull: true, defaultValue: null },
        deleted_by:  { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      },
      {
        sequelize,
        tableName: 'teams',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    );
  }
}
