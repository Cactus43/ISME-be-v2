import { Team } from '../Data/Models/Team';
import { Unit } from '../Data/Models/Unit';
import type { UnitAttributes } from '../Data/Models/Unit';
import type { IUnitAdapter } from '../Data/Interfaces/IAdapter';


// ─── UnitAdapter ───────────────────────────────────────────────────────────

export class UnitAdapter implements IUnitAdapter {

  async FindById(id: number): Promise<UnitAttributes | null> {
    const unit = await Unit.findOne({
      where: { id, deleted_at: null },
      include: [{ model: Team, as: 'Team', required: false }],
    });
    return unit?.get({ plain: true }) ?? null;
  }

  async FindAll(): Promise<UnitAttributes[]> {
    const rows = await Unit.findAll({
      where: { deleted_at: null },
      include: [{ model: Team, as: 'Team', required: false, where: { deleted_at: null } }],
      order: [['name', 'ASC']],
    });
    return rows.map((r) => r.get({ plain: true }));
  }

  async Create(data: Partial<UnitAttributes>): Promise<UnitAttributes> {
    const unit = await Unit.create({
      ...data,
      created_by: data.created_by ?? null,
      updated_by: data.updated_by ?? null,
      deleted_by: null,
      deleted_at: null,
    } as UnitAttributes);
    return unit.get({ plain: true });
  }

  async Update(id: number, data: Partial<UnitAttributes>): Promise<UnitAttributes | null> {
    const unit = await Unit.findOne({ where: { id, deleted_at: null } });
    if (!unit) return null;
    await unit.update(data);
    return unit.get({ plain: true });
  }

  async SoftDelete(id: number, deletedBy?: number | null): Promise<void> {
    const unit = await Unit.findOne({ where: { id, deleted_at: null } });
    if (!unit) return;
    await unit.update({ deleted_at: new Date(), deleted_by: deletedBy ?? null, is_active: false });
  }
}
