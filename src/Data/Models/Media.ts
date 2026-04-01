import { Sequelize, Model, DataTypes, Optional } from 'sequelize';

/* ─── Column contract ─────────────────────────────────────────── */
export interface MediaAttributes {
  id: number;
  intervention_id: number;
  media_type: 'photo_before' | 'photo_after' | 'document' | 'other';
  filename: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  storage_path: string;
  device_id: number | null;
  created_at: Date;
  created_by: number | null;
  updated_at: Date;
  updated_by: number | null;
  deleted_at: Date | null;
  deleted_by: number | null;
}

type MediaCreation = Optional<
  MediaAttributes,
  'id' | 'original_filename' | 'mime_type' | 'file_size' | 'device_id' | 'created_at' | 'created_by' | 'updated_at' | 'updated_by' | 'deleted_at' | 'deleted_by'
>;

/* ─── Sequelize model ─────────────────────────────────────────── */
export class Media extends Model<MediaAttributes, MediaCreation> implements MediaAttributes {
  declare id: number;
  declare intervention_id: number;
  declare media_type: 'photo_before' | 'photo_after' | 'document' | 'other';
  declare filename: string;
  declare original_filename: string | null;
  declare mime_type: string | null;
  declare file_size: number | null;
  declare storage_path: string;
  declare device_id: number | null;
  declare readonly created_at: Date;
  declare created_by: number | null;
  declare readonly updated_at: Date;
  declare updated_by: number | null;
  declare deleted_at: Date | null;
  declare deleted_by: number | null;

  static InitModel(sequelize: Sequelize): void {
    Media.init(
      {
        id:                { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        intervention_id:   { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        media_type:        { type: DataTypes.ENUM('photo_before', 'photo_after', 'document', 'other'), allowNull: false, defaultValue: 'photo_before' },
        filename:          { type: DataTypes.STRING(255), allowNull: false },
        original_filename: { type: DataTypes.STRING(255), allowNull: true },
        mime_type:         { type: DataTypes.STRING(128), allowNull: true },
        file_size:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
        storage_path:      { type: DataTypes.STRING(512), allowNull: false },
        device_id:         { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        created_at:        { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        created_by:        { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        updated_at:        { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated_by:        { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        deleted_at:        { type: DataTypes.DATE, allowNull: true, defaultValue: null },
        deleted_by:        { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      },
      {
        sequelize,
        tableName: 'media',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    );
  }
}
