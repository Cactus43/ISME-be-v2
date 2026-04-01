import { Sequelize, Model, DataTypes, Optional } from 'sequelize';

/* ─── Column contract ─────────────────────────────────────────── */
export interface InterventionHistoryAttributes {
  id: number;
  intervention_id: number;
  version: number;
  snapshot: object;
  changed_by_user_id: number | null;
  change_reason: string | null;
  created_at: Date;
}

type IHCreation = Optional<InterventionHistoryAttributes, 'id' | 'version' | 'changed_by_user_id' | 'change_reason' | 'created_at'>;

/* ─── Sequelize model ─────────────────────────────────────────── */
export class InterventionHistory extends Model<InterventionHistoryAttributes, IHCreation> implements InterventionHistoryAttributes {
  declare id: number;
  declare intervention_id: number;
  declare version: number;
  declare snapshot: object;
  declare changed_by_user_id: number | null;
  declare change_reason: string | null;
  declare readonly created_at: Date;

  static InitModel(sequelize: Sequelize): void {
    InterventionHistory.init(
      {
        id:                  { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        intervention_id:     { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        version:             { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
        snapshot:            { type: DataTypes.JSON, allowNull: false },
        changed_by_user_id:  { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        change_reason:       { type: DataTypes.STRING(255), allowNull: true },
        created_at:          { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      },
      {
        sequelize,
        tableName: 'interventions_history',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
      },
    );
  }
}
