import { Team } from '../Data/Models/Team';
import { Unit } from '../Data/Models/Unit';
import type { TeamAttributes } from '../Data/Models/Team';
import type { ITeamAdapter } from '../Data/Interfaces/IAdapter';


// ─── TeamAdapter ───────────────────────────────────────────────────────────

export class TeamAdapter implements ITeamAdapter {

  async FindById(id: number): Promise<TeamAttributes | null> {
    const team = await Team.findOne({
      where: { id, deleted_at: null },
      include: [{ model: Unit, as: 'Units', required: false }],
    });
    return team?.get({ plain: true }) ?? null;
  }

  async FindAll(): Promise<TeamAttributes[]> {
    const rows = await Team.findAll({
      where: { deleted_at: null },
      include: [{ model: Unit, as: 'Units', required: false }],
      order: [['name', 'ASC']],
    });
    return rows.map(r => r.get({ plain: true }));
  }

  async Create(data: Partial<TeamAttributes>): Promise<TeamAttributes> {
    const team = await Team.create(data as TeamAttributes);
    return team.get({ plain: true });
  }

  async Update(id: number, data: Partial<TeamAttributes>): Promise<TeamAttributes | null> {
    const team = await Team.findByPk(id);
    if (!team || team.deleted_at) return null;
    await team.update(data);
    return team.get({ plain: true });
  }

  async ReplaceUnits(teamId: number, units: string[], actorUserId?: number | null): Promise<void> {
    const normalized = [...new Set(units.map((u) => u.trim()).filter(Boolean))];
    const actor = actorUserId ?? null;
    const existingRows = await Unit.findAll({ where: { team_id: teamId } });
    const existingByName = new Map(existingRows.map((row) => [row.name, row]));

    // Soft-delete units removed from the current team payload.
    for (const row of existingRows) {
      if (normalized.includes(row.name)) continue;
      if (row.deleted_at) continue;
      await row.update({ deleted_at: new Date(), deleted_by: actor, is_active: false, updated_by: actor });
    }

    // Upsert current units while preserving audit info.
    for (const name of normalized) {
      const existing = existingByName.get(name);
      if (!existing) {
        await Unit.create({
          team_id: teamId,
          name,
          is_active: true,
          created_by: actor,
          updated_by: actor,
          deleted_by: null,
          deleted_at: null,
        });
        continue;
      }

      if (existing.deleted_at || !existing.is_active) {
        await existing.update({ deleted_at: null, deleted_by: null, is_active: true, updated_by: actor });
      }
    }
  }

  async SoftDelete(id: number, deletedBy?: number | null): Promise<void> {
    const team = await Team.findByPk(id);
    if (!team || team.deleted_at) return;
    await team.update({ deleted_at: new Date(), deleted_by: deletedBy ?? null, is_active: false });
  }
}
