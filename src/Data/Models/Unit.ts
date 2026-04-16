import { Sequelize, Model, DataTypes, Optional } from 'sequelize';

export interface UnitAttributes {
  id: number;
  team_id: number;
  name: string;
  is_active: boolean;
  created_by: number | null;
  updated_by: number | null;
  deleted_by: number | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

type UnitCreation = Optional<UnitAttributes, 'id' | 'is_active' | 'created_by' | 'updated_by' | 'deleted_by' | 'deleted_at' | 'created_at' | 'updated_at'>;

export class Unit extends Model<UnitAttributes, UnitCreation> implements UnitAttributes {
  declare id: number;
  declare team_id: number;
  declare name: string;
  declare is_active: boolean;
  declare created_by: number | null;
  declare updated_by: number | null;
  declare deleted_by: number | null;
  declare deleted_at: Date | null;
  declare created_at: Date;
  declare updated_at: Date;

  static InitModel(sequelize: Sequelize): void {
    Unit.init(
      {
        id:         { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        team_id:    { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        name:       { type: DataTypes.STRING(64), allowNull: false, unique: true },
        is_active:  { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
        created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, defaultValue: null },
        updated_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, defaultValue: null },
        deleted_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, defaultValue: null },
        deleted_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      },
      {
        sequelize,
        tableName: 'units',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
          { unique: true, fields: ['name'] },
          { fields: ['team_id'] },
        ],
      },
    );
  }
}
