import { Op, WhereOptions } from 'sequelize';
import { Intervention } from '../Data/Models/Intervention';
import { User } from '../Data/Models/User';
import { Media } from '../Data/Models/Media';
import { Sequelize } from '../Infra/Database';
import type { InterventionAttributes } from '../Data/Models/Intervention';
import type { IInterventionAdapter, DashboardStats } from '../Data/Interfaces/IAdapter';
import type { PaginatedResult } from '../Data/Types/Pagination';


// ─── Shared include specs ──────────────────────────────────────────────────

const OperatorInclude = { model: User, as: 'Operator', attributes: ['id', 'firstname', 'lastname', 'username'] };
const MediaInclude    = { model: Media, as: 'Media', where: { deleted_at: null } as any, required: false };


// ─── InterventionAdapter ───────────────────────────────────────────────────

export class InterventionAdapter implements IInterventionAdapter {

  async FindById(id: number): Promise<InterventionAttributes | null> {
    const row = await Intervention.findByPk(id, {
      include: [
        OperatorInclude,
        { ...MediaInclude },
      ],
    });
    return (row as unknown as InterventionAttributes) ?? null;
  }

  async FindAllPaginated(filters: Record<string, unknown>): Promise<PaginatedResult<InterventionAttributes>> {
    const page = Math.max(1, parseInt(String(filters.page ?? '1'), 10));
    const limit = Math.min(200, Math.max(1, parseInt(String(filters.pageSize ?? filters.limit ?? '50'), 10)));
    const offset = (page - 1) * limit;

    const where: WhereOptions<InterventionAttributes> = {};
    if (filters.team) where.business_team = filters.team as string;
    if (filters.status) where.status = parseInt(String(filters.status), 10);
    if (filters.type) where.intervention_type = parseInt(String(filters.type), 10);

    // Soft-delete filter via deleted_at
    if (filters.deleted === 'true') {
      (where as any).deleted_at = { [Op.ne]: null };
    } else {
      (where as any).deleted_at = null;
    }

    // Full-text search across key columns
    if (filters.search && String(filters.search).trim()) {
      const term = `%${String(filters.search).trim()}%`;
      (where as any)[Op.or] = [
        { tag: { [Op.like]: term } },
        { location: { [Op.like]: term } },
        { component_equipment: { [Op.like]: term } },
        { business_team: { [Op.like]: term } },
      ];
    }

    const { count, rows } = await Intervention.findAndCountAll({
      where,
      include: [
        OperatorInclude,
        { ...MediaInclude },
      ],
      order: [[String(filters.sort ?? 'created_at'), String(filters.order ?? 'DESC').toUpperCase()]],
      limit,
      offset,
      distinct: true,
    });

    return {
      Data: rows as unknown as InterventionAttributes[],
      Pagination: { Total: count, Page: page, Limit: limit, Pages: Math.ceil(count / limit) },
    };
  }

  async FindAllForMobile(teamCode: string): Promise<InterventionAttributes[]> {
    const where: Record<string, unknown> = { deleted_at: null };
    // Only filter by team if a teamCode is provided
    if (teamCode) {
      where.business_team = teamCode;
    }

    const rows = await Intervention.findAll({
      where,
      include: [
        OperatorInclude,
        { ...MediaInclude, attributes: ['id', 'media_type', 'filename', 'storage_path'] },
      ],
      order: [['created_at', 'DESC']],
    });
    return rows as unknown as InterventionAttributes[];
  }

  async FindRecent(limit: number): Promise<InterventionAttributes[]> {
    const rows = await Intervention.findAll({
      where: { deleted_at: null },
      include: [OperatorInclude],
      order: [['created_at', 'DESC']],
      limit,
    });
    return rows as unknown as InterventionAttributes[];
  }


  // ─── Dashboard aggregate stats ──────────────────────────────────────

  async AggregateStats(): Promise<DashboardStats> {
    const [totals] = await Sequelize.query(`
      SELECT
        COUNT(*)                                           AS Total,
        SUM(CASE WHEN status IN (0, 1) THEN 1 ELSE 0 END) AS \`Open\`,
        SUM(CASE WHEN status IN (2, 3) THEN 1 ELSE 0 END) AS Closed,
        COALESCE(SUM(steam_flow_kg), 0)                    AS TotalSteamFlowKg,
        COALESCE(SUM(steam_flow_tonne), 0)                 AS TotalSteamFlowTonne
      FROM interventions
      WHERE deleted_at IS NULL
    `, { type: 'SELECT' as any }) as unknown as Record<string, string | number>[];

    const row = totals ?? { Total: 0, Open: 0, Closed: 0, TotalSteamFlowKg: 0, TotalSteamFlowTonne: 0 };

    const priorityRows = await Sequelize.query(`
      SELECT priority AS Priority, COUNT(*) AS Count
      FROM interventions WHERE deleted_at IS NULL
      GROUP BY priority ORDER BY priority
    `, { type: 'SELECT' as any }) as unknown as { Priority: number; Count: number }[];

    const statusRows = await Sequelize.query(`
      SELECT status AS Status, COUNT(*) AS Count
      FROM interventions WHERE deleted_at IS NULL
      GROUP BY status ORDER BY status
    `, { type: 'SELECT' as any }) as unknown as { Status: number; Count: number }[];

    const trendRows = await Sequelize.query(`
      SELECT
        DATE_FORMAT(inspection_date, '%Y-%m') AS Month,
        COUNT(*) AS Count,
        COALESCE(SUM(steam_flow_kg), 0) AS SteamFlowKg
      FROM interventions
      WHERE deleted_at IS NULL AND inspection_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(inspection_date, '%Y-%m')
      ORDER BY Month
    `, { type: 'SELECT' as any }) as unknown as { Month: string; Count: number; SteamFlowKg: number }[];

    return {
      Total: Number(row.Total ?? 0),
      Open: Number(row.Open ?? 0),
      Closed: Number(row.Closed ?? 0),
      TotalSteamFlowKg: Number(row.TotalSteamFlowKg ?? 0),
      TotalSteamFlowTonne: Number(row.TotalSteamFlowTonne ?? 0),
      PriorityDistribution: (priorityRows ?? []).map(r => ({ Priority: Number(r.Priority), Count: Number(r.Count) })),
      StatusDistribution: (statusRows ?? []).map(r => ({ Status: Number(r.Status), Count: Number(r.Count) })),
      MonthlyTrend: (trendRows ?? []).map(r => ({ Month: String(r.Month), Count: Number(r.Count), SteamFlowKg: Number(r.SteamFlowKg) })),
    };
  }

  async Create(data: Partial<InterventionAttributes>, transaction?: unknown): Promise<InterventionAttributes> {
    const row = await Intervention.create(
      data as InterventionAttributes,
      transaction ? { transaction: transaction as import('sequelize').Transaction } : undefined,
    );
    return row as unknown as InterventionAttributes;
  }

  async Update(id: number, data: Partial<InterventionAttributes>): Promise<InterventionAttributes | null> {
    const row = await Intervention.findByPk(id);
    if (!row) return null;
    await row.update(data);
    return row as unknown as InterventionAttributes;
  }

  async ToggleDelete(ids: number[], deleted: boolean, deletedBy?: number | null): Promise<number> {
    const sequelize = Sequelize;
    const t = await sequelize.transaction();
    try {
      const updateData: Partial<InterventionAttributes> = deleted
        ? { deleted_at: new Date(), deleted_by: deletedBy ?? null }
        : { deleted_at: null as any, deleted_by: null };
      const [affected] = await Intervention.update(
        updateData,
        { where: { id: { [Op.in]: ids } }, transaction: t },
      );
      await t.commit();
      return affected;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async FindAllForExport(teamCode?: string): Promise<InterventionAttributes[]> {
    const where: any = { deleted_at: null };
    if (teamCode) where.business_team = teamCode;

    const rows = await Intervention.findAll({
      where,
      include: [{ model: User, as: 'Operator', attributes: ['firstname', 'lastname'] }],
      order: [['created_at', 'DESC']],
      raw: true,
      nest: true,
    });
    return rows as unknown as InterventionAttributes[];
  }

  async FindAllForDashboard(filters?: { interventionType?: number; year?: number; dateFrom?: string; dateTo?: string }): Promise<InterventionAttributes[]> {
    const where: any = { deleted_at: null };

    if (filters?.interventionType !== undefined && filters.interventionType >= 0) {
      where.intervention_type = filters.interventionType;
    }

    if (filters?.year) {
      (where as any).inspection_date = {
        [Op.gte]: new Date(`${filters.year}-01-01`),
        [Op.lte]: new Date(`${filters.year}-12-31T23:59:59`),
      };
    }

    if (filters?.dateFrom || filters?.dateTo) {
      const dateCond: any = {};
      if (filters.dateFrom) dateCond[Op.gte] = new Date(filters.dateFrom);
      if (filters.dateTo) {
        const end = new Date(filters.dateTo);
        end.setHours(23, 59, 59, 999);
        dateCond[Op.lte] = end;
      }
      (where as any).inspection_date = dateCond;
    }

    const rows = await Intervention.findAll({
      where,
      include: [OperatorInclude],
      order: [['inspection_date', 'DESC']],
    });
    return rows as unknown as InterventionAttributes[];
  }
}
