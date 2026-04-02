import { Media } from '../Data/Models/Media';
import type { MediaAttributes } from '../Data/Models/Media';
import type { IMediaAdapter } from '../Data/Interfaces/IAdapter';
import type { MediaSlot } from '../Data/Types/Media';


// ─── MediaAdapter ──────────────────────────────────────────────────────────

export class MediaAdapter implements IMediaAdapter {

  async FindById(id: number): Promise<MediaAttributes | null> {
    const row = await Media.findByPk(id);
    if (!row || row.deleted_at) return null;
    return row.get({ plain: true });
  }

  async FindByInterventionId(interventionId: number): Promise<MediaAttributes[]> {
    const rows = await Media.findAll({
      where: { intervention_id: interventionId, deleted_at: null },
      order: [['created_at', 'ASC']],
    });
    return rows.map(r => r.get({ plain: true }));
  }

  async FindActiveByInterventionAndType(interventionId: number, mediaType: MediaSlot): Promise<MediaAttributes | null> {
    const row = await Media.findOne({
      where: {
        intervention_id: interventionId,
        media_type: mediaType,
        deleted_at: null,
      },
      order: [['created_at', 'DESC']],
    });
    if (!row) return null;
    return row.get({ plain: true });
  }

  async Create(data: Partial<MediaAttributes>, transaction?: unknown): Promise<MediaAttributes> {
    const row = await Media.create(
      data as MediaAttributes,
      transaction ? { transaction: transaction as import('sequelize').Transaction } : undefined,
    );
    return row.get({ plain: true });
  }

  async Update(id: number, data: Partial<MediaAttributes>, transaction?: unknown): Promise<MediaAttributes | null> {
    const row = await Media.findByPk(id);
    if (!row || row.deleted_at) return null;
    await row.update(
      data,
      transaction ? { transaction: transaction as import('sequelize').Transaction } : undefined,
    );
    return row.get({ plain: true });
  }

  async SoftDelete(id: number, deletedBy?: number | null): Promise<void> {
    const row = await Media.findByPk(id);
    if (!row) return;
    await row.update({ deleted_at: new Date(), deleted_by: deletedBy ?? null });
  }
}
