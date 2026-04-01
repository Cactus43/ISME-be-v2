import { Team } from '../Data/Models/Team';
import type { TeamAttributes } from '../Data/Models/Team';
import type { ITeamAdapter } from '../Data/Interfaces/IAdapter';


// ─── TeamAdapter ───────────────────────────────────────────────────────────

export class TeamAdapter implements ITeamAdapter {

  async FindById(id: number): Promise<TeamAttributes | null> {
    const team = await Team.findOne({ where: { id, deleted_at: null } });
    return team?.get({ plain: true }) ?? null;
  }

  async FindAll(): Promise<TeamAttributes[]> {
    const rows = await Team.findAll({
      where: { deleted_at: null },
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

  async SoftDelete(id: number, deletedBy?: number | null): Promise<void> {
    const team = await Team.findByPk(id);
    if (!team || team.deleted_at) return;
    await team.update({ deleted_at: new Date(), deleted_by: deletedBy ?? null, is_active: false });
  }
}
