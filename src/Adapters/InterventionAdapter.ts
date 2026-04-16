import { Op, QueryTypes, WhereOptions, literal } from 'sequelize';
import { Intervention } from '../Data/Models/Intervention';
import { User } from '../Data/Models/User';
import { Media } from '../Data/Models/Media';
import { Sequelize } from '../Infra/Database';
import type { InterventionAttributes } from '../Data/Models/Intervention';
import type {
  IInterventionAdapter,
  DashboardStats,
  MobileSyncPullOptions,
  MobileSyncPullResult,
  PriorityTrackingRationale,
  PriorityTrackingTimelineResult,
  PriorityTrackingWeekResult,
} from '../Data/Interfaces/IAdapter';
import type { PaginatedResult } from '../Data/Types/Pagination';


// ─── Shared include specs ──────────────────────────────────────────────────

/** Format a Date as YYYY-MM-DD using LOCAL calendar (not UTC). */
function ToLocalIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const OperatorInclude = { model: User, as: 'Operator', attributes: ['id', 'firstname', 'lastname', 'username'] };
const MediaInclude    = { model: Media, as: 'Media', where: { deleted_at: null } as any, required: false };


// ─── InterventionAdapter ───────────────────────────────────────────────────

export class InterventionAdapter implements IInterventionAdapter {

  private async EnsureInterventionsSyncColumns(): Promise<void> {
    const RowVersionColumn = await Sequelize.query<{ c: number }>(
      `SELECT COUNT(*) AS c
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'interventions'
         AND COLUMN_NAME = 'row_version'`,
      { type: QueryTypes.SELECT },
    )

    if (Number(RowVersionColumn[0]?.c ?? 0) === 0) {
      await Sequelize.query(`
        ALTER TABLE interventions
        ADD COLUMN row_version BIGINT UNSIGNED NOT NULL DEFAULT 0
      `)
    }
  }

  private async EnsurePriorityTrackingTables(): Promise<void> {
    await Sequelize.query(`
      CREATE TABLE IF NOT EXISTS priority_tracking_sessions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        week_start_date DATE NOT NULL,
        week_end_date DATE NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_priority_tracking_week_start (week_start_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await Sequelize.query(`
      CREATE TABLE IF NOT EXISTS priority_tracking_items (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        session_id BIGINT UNSIGNED NOT NULL,
        intervention_id BIGINT UNSIGNED NOT NULL,
        rank_order INT NOT NULL,
        selection TINYINT(1) NOT NULL DEFAULT 0,
        ps9 TINYINT(1) NOT NULL DEFAULT 0,
        po TINYINT(1) NOT NULL DEFAULT 0,
        work_permit TINYINT(1) NOT NULL DEFAULT 0,
        executed TINYINT(1) NOT NULL DEFAULT 0,
        rationale ENUM('Mancanza Operatore', 'Difficolta Intercetto', 'Mancanza materiali', 'Permesso non aperto') NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_priority_tracking_session_intervention (session_id, intervention_id),
        KEY ix_priority_tracking_session (session_id),
        CONSTRAINT fk_priority_tracking_items_session FOREIGN KEY (session_id)
          REFERENCES priority_tracking_sessions(id) ON DELETE CASCADE,
        CONSTRAINT fk_priority_tracking_items_intervention FOREIGN KEY (intervention_id)
          REFERENCES interventions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    // Backward-compatible migration for existing DBs (works also on MySQL versions
    // where ALTER TABLE ... ADD COLUMN IF NOT EXISTS is not supported).
    const ExecutedColumn = await Sequelize.query<{ c: number }>(
      `SELECT COUNT(*) AS c
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'priority_tracking_items'
         AND COLUMN_NAME = 'executed'`,
      { type: QueryTypes.SELECT },
    )

    if (Number(ExecutedColumn[0]?.c ?? 0) === 0) {
      await Sequelize.query(`
        ALTER TABLE priority_tracking_items
        ADD COLUMN executed TINYINT(1) NOT NULL DEFAULT 0
      `)
    }
  }

  async EnsurePriorityTrackingSchema(): Promise<void> {
    await this.EnsureInterventionsSyncColumns()
    await this.EnsurePriorityTrackingTables()
  }

  async EnsurePriorityTrackingWeek(weekStart: Date, weekEnd: Date): Promise<number> {
    await this.EnsurePriorityTrackingTables()

    const WeekStartKey = ToLocalIsoDate(weekStart)
    const WeekEndKey = ToLocalIsoDate(weekEnd)

    const ExistingSession = await Sequelize.query<{ id: number }>(
      'SELECT id FROM priority_tracking_sessions WHERE week_start_date = :weekStart LIMIT 1',
      {
        replacements: { weekStart: WeekStartKey },
        type: QueryTypes.SELECT,
      },
    )

    const SessionId = ExistingSession[0]?.id
    if (SessionId) return SessionId

    await Sequelize.query(
      'INSERT INTO priority_tracking_sessions (week_start_date, week_end_date) VALUES (:weekStart, :weekEnd)',
      {
        replacements: { weekStart: WeekStartKey, weekEnd: WeekEndKey },
        type: QueryTypes.INSERT,
      },
    )

    const CreatedSession = await Sequelize.query<{ id: number }>(
      'SELECT id FROM priority_tracking_sessions WHERE week_start_date = :weekStart LIMIT 1',
      {
        replacements: { weekStart: WeekStartKey },
        type: QueryTypes.SELECT,
      },
    )
    const CreatedSessionId = CreatedSession[0]?.id
    if (!CreatedSessionId) throw new Error('Unable to create priority tracking session')

    const TopOldestOpen = await Sequelize.query<{ id: number; steam_flow_kg: number | null }>(
      `SELECT iv.id, iv.steam_flow_kg
       FROM interventions iv
       WHERE iv.deleted_at IS NULL
         AND iv.status = 1
         AND iv.repair_date IS NULL
         AND COALESCE((
           SELECT pti.executed
           FROM priority_tracking_items pti
           INNER JOIN priority_tracking_sessions ps ON ps.id = pti.session_id
           WHERE pti.intervention_id = iv.id
           ORDER BY ps.week_start_date DESC, ps.id DESC, pti.id DESC
           LIMIT 1
         ), 0) = 0
       ORDER BY iv.inspection_date ASC
       LIMIT 5`,
      { type: QueryTypes.SELECT },
    )

    const Ranked = [...TopOldestOpen].sort((A, B) => (Number(B.steam_flow_kg ?? 0) - Number(A.steam_flow_kg ?? 0)))

    const PreviousSession = await Sequelize.query<{ id: number }>(
      `SELECT id
       FROM priority_tracking_sessions
       WHERE week_start_date < :weekStart
       ORDER BY week_start_date DESC
       LIMIT 1`,
      {
        replacements: { weekStart: WeekStartKey },
        type: QueryTypes.SELECT,
      },
    )

    const PreviousByIntervention = new Map<number, {
      selection: number;
      ps9: number;
      po: number;
      work_permit: number;
    }>()

    if (PreviousSession[0]?.id && Ranked.length > 0) {
      const PreviousItems = await Sequelize.query<{
        intervention_id: number;
        selection: number;
        ps9: number;
        po: number;
        work_permit: number;
      }>(
        `SELECT intervention_id, selection, ps9, po, work_permit
         FROM priority_tracking_items
         WHERE session_id = :sessionId
           AND intervention_id IN (:interventionIds)`,
        {
          replacements: {
            sessionId: PreviousSession[0].id,
            interventionIds: Ranked.map((Row) => Row.id),
          },
          type: QueryTypes.SELECT,
        },
      )

      for (const Item of PreviousItems) {
        PreviousByIntervention.set(Item.intervention_id, {
          selection: Item.selection,
          ps9: Item.ps9,
          po: Item.po,
          work_permit: Item.work_permit,
        })
      }
    }

    for (let Index = 0; Index < Ranked.length; Index += 1) {
      const Row = Ranked[Index]
      const PreviousValues = PreviousByIntervention.get(Row.id)
      await Sequelize.query(
        `INSERT INTO priority_tracking_items
          (session_id, intervention_id, rank_order, selection, ps9, po, work_permit)
         VALUES (:sessionId, :interventionId, :rankOrder, :selection, :ps9, :po, :workPermit)
         ON DUPLICATE KEY UPDATE
           rank_order = VALUES(rank_order),
           selection = VALUES(selection),
           ps9 = VALUES(ps9),
           po = VALUES(po),
           work_permit = VALUES(work_permit)`,
        {
          replacements: {
            sessionId: CreatedSessionId,
            interventionId: Row.id,
            rankOrder: Index + 1,
            selection: PreviousValues?.selection ?? 0,
            ps9: PreviousValues?.ps9 ?? 0,
            po: PreviousValues?.po ?? 0,
            workPermit: PreviousValues?.work_permit ?? 0,
          },
          type: QueryTypes.INSERT,
        },
      )
    }

    return CreatedSessionId
  }

  async GetPriorityTrackingWeek(weekStart: Date): Promise<PriorityTrackingWeekResult> {
    const WeekStartKey = ToLocalIsoDate(weekStart)

    const Sessions = await Sequelize.query<{ id: number; week_start_date: string; week_end_date: string }>(
      'SELECT id, week_start_date, week_end_date FROM priority_tracking_sessions WHERE week_start_date = :weekStart LIMIT 1',
      {
        replacements: { weekStart: WeekStartKey },
        type: QueryTypes.SELECT,
      },
    )

    if (!Sessions[0]) {
      throw new Error('Priority tracking session not found')
    }

    const Session = Sessions[0]

    const Rows = await Sequelize.query<{
      id: number;
      session_id: number;
      intervention_id: number;
      rank_order: number;
      selection: number;
      ps9: number;
      po: number;
      work_permit: number;
      rationale: PriorityTrackingRationale | null;
      calculated_rationale: PriorityTrackingRationale | null;
      executed: number;
      tag: string;
      business_team: string;
      unit: string | null;
      location: string;
      steam_flow_kg: number | null;
      inspection_date: Date;
      status: number;
    }>(
      `SELECT
         i.id,
         i.session_id,
         i.intervention_id,
         i.rank_order,
         i.selection,
         i.ps9,
         i.po,
         i.work_permit,
         i.rationale,
         (
           SELECT x.rationale
           FROM priority_tracking_items x
           WHERE x.intervention_id = i.intervention_id
             AND x.rationale IS NOT NULL
           GROUP BY x.rationale
           ORDER BY COUNT(*) DESC, MAX(x.updated_at) DESC
           LIMIT 1
         ) AS calculated_rationale,
         i.executed AS executed,
         iv.tag,
         iv.business_team,
         iv.unit,
         iv.location,
         iv.steam_flow_kg,
         iv.inspection_date,
         iv.status
       FROM priority_tracking_items i
       INNER JOIN interventions iv ON iv.id = i.intervention_id
       WHERE i.session_id = :sessionId
         AND iv.deleted_at IS NULL
       ORDER BY i.rank_order ASC`,
      {
        replacements: { sessionId: Session.id },
        type: QueryTypes.SELECT,
      },
    )

    return {
      SessionId: Session.id,
      WeekStart: new Date(Session.week_start_date),
      WeekEnd: new Date(Session.week_end_date),
      Items: Rows.map((Row) => ({
        Id: Row.id,
        SessionId: Row.session_id,
        InterventionId: Row.intervention_id,
        RankOrder: Row.rank_order,
        Selection: Row.selection === 1,
        PS9: Row.ps9 === 1,
        PO: Row.po === 1,
        WorkPermit: Row.work_permit === 1,
        Rationale: Row.rationale,
        CalculatedRationale: Row.calculated_rationale,
        Executed: Row.executed === 1,
        Tag: Row.tag,
        BusinessTeam: Row.business_team,
        Unit: Row.unit,
        Location: Row.location,
        SteamFlowKg: Row.steam_flow_kg,
        InspectionDate: new Date(Row.inspection_date),
        Status: Row.status,
      })),
    }
  }

  async GetPriorityTrackingTimeline(weekStart: Date): Promise<PriorityTrackingTimelineResult> {
    const WeekStartKey = ToLocalIsoDate(weekStart)

    const Sessions = await Sequelize.query<{ id: number; week_start_date: string; week_end_date: string }>(
      'SELECT id, week_start_date, week_end_date FROM priority_tracking_sessions WHERE week_start_date = :weekStart LIMIT 1',
      {
        replacements: { weekStart: WeekStartKey },
        type: QueryTypes.SELECT,
      },
    )
    if (!Sessions[0]) throw new Error('Priority tracking session not found')
    const AnchorSession = Sessions[0]

    const AnchorRows = await Sequelize.query<{
      intervention_id: number;
      rank_order: number;
      tag: string;
      business_team: string;
      unit: string | null;
      location: string;
      steam_flow_kg: number | null;
      inspection_date: Date;
      status: number;
    }>(
      `SELECT
         i.intervention_id,
         i.rank_order,
         iv.tag,
         iv.business_team,
         iv.unit,
         iv.location,
         iv.steam_flow_kg,
         iv.inspection_date,
         iv.status
       FROM priority_tracking_items i
       INNER JOIN interventions iv ON iv.id = i.intervention_id
       WHERE i.session_id = :sessionId
         AND iv.deleted_at IS NULL
         AND iv.status = 1
         AND iv.repair_date IS NULL
       ORDER BY i.rank_order ASC`,
      {
        replacements: { sessionId: AnchorSession.id },
        type: QueryTypes.SELECT,
      },
    )

    const InterventionIds = AnchorRows.map((R) => R.intervention_id)
    if (InterventionIds.length === 0) {
      return {
        AnchorSessionId: AnchorSession.id,
        AnchorWeekStart: new Date(AnchorSession.week_start_date),
        AnchorWeekEnd: new Date(AnchorSession.week_end_date),
        Weeks: [{ SessionId: AnchorSession.id, WeekStart: new Date(AnchorSession.week_start_date), WeekEnd: new Date(AnchorSession.week_end_date) }],
        Rows: [],
      }
    }

    const IdList = InterventionIds.join(',')

    const WeekRows = await Sequelize.query<{ id: number; week_start_date: string; week_end_date: string }>(
      `SELECT DISTINCT s.id, s.week_start_date, s.week_end_date
       FROM priority_tracking_sessions s
       INNER JOIN priority_tracking_items i ON i.session_id = s.id
       WHERE i.intervention_id IN (${IdList})
       GROUP BY s.id, s.week_start_date, s.week_end_date
       ORDER BY s.week_start_date DESC`,
      { type: QueryTypes.SELECT },
    )

    const SessionIds = WeekRows.map((W) => W.id)
    const SessionList = SessionIds.join(',')

    const TimelineItems = await Sequelize.query<{
      item_id: number;
      session_id: number;
      intervention_id: number;
      selection: number;
      ps9: number;
      po: number;
      work_permit: number;
      rationale: PriorityTrackingRationale | null;
      executed: number;
    }>(
      `SELECT
         i.id AS item_id,
         i.session_id,
         i.intervention_id,
         i.selection,
         i.ps9,
         i.po,
         i.work_permit,
         i.rationale,
         i.executed AS executed
       FROM priority_tracking_items i
       WHERE i.session_id IN (${SessionList})
         AND i.intervention_id IN (${IdList})`,
      { type: QueryTypes.SELECT },
    )

    const RationaleAgg = await Sequelize.query<{
      intervention_id: number;
      rationale: PriorityTrackingRationale;
      c: number;
      last_u: Date;
    }>(
      `SELECT
         intervention_id,
         rationale,
         COUNT(*) AS c,
         MAX(updated_at) AS last_u
       FROM priority_tracking_items
       WHERE intervention_id IN (${IdList})
         AND rationale IS NOT NULL
       GROUP BY intervention_id, rationale`,
      { type: QueryTypes.SELECT },
    )

    const CalculatedByIntervention = new Map<number, PriorityTrackingRationale | null>()
    for (const Id of InterventionIds) {
      const Candidates = RationaleAgg
        .filter((R) => R.intervention_id === Id)
        .sort((A, B) => {
          if (Number(B.c) !== Number(A.c)) return Number(B.c) - Number(A.c)
          return new Date(B.last_u).getTime() - new Date(A.last_u).getTime()
        })
      CalculatedByIntervention.set(Id, Candidates[0]?.rationale ?? null)
    }

    return {
      AnchorSessionId: AnchorSession.id,
      AnchorWeekStart: new Date(AnchorSession.week_start_date),
      AnchorWeekEnd: new Date(AnchorSession.week_end_date),
      Weeks: WeekRows.map((W) => ({
        SessionId: W.id,
        WeekStart: new Date(W.week_start_date),
        WeekEnd: new Date(W.week_end_date),
      })),
      Rows: AnchorRows.map((Base) => {
        const Weeks: Record<string, {
          ItemId: number;
          SessionId: number;
          Selection: boolean;
          PS9: boolean;
          PO: boolean;
          WorkPermit: boolean;
          Rationale: PriorityTrackingRationale | null;
          Executed: boolean;
        }> = {}

        for (const Item of TimelineItems.filter((I) => I.intervention_id === Base.intervention_id)) {
          Weeks[String(Item.session_id)] = {
            ItemId: Item.item_id,
            SessionId: Item.session_id,
            Selection: Item.selection === 1,
            PS9: Item.ps9 === 1,
            PO: Item.po === 1,
            WorkPermit: Item.work_permit === 1,
            Rationale: Item.rationale,
            Executed: Item.executed === 1,
          }
        }

        return {
          InterventionId: Base.intervention_id,
          RankOrder: Base.rank_order,
          Tag: Base.tag,
          BusinessTeam: Base.business_team,
          Unit: Base.unit,
          Location: Base.location,
          SteamFlowKg: Base.steam_flow_kg,
          InspectionDate: new Date(Base.inspection_date),
          Status: Base.status,
          CalculatedRationale: CalculatedByIntervention.get(Base.intervention_id) ?? null,
          Weeks,
        }
      }),
    }
  }

  async UpdatePriorityTrackingItem(itemId: number, patch: {
    Selection?: boolean;
    PS9?: boolean;
    PO?: boolean;
    WorkPermit?: boolean;
    Rationale?: PriorityTrackingRationale | null;
  }): Promise<void> {
    const Fields: string[] = []
    const Replacements: Record<string, unknown> = { itemId }

    if (patch.Selection !== undefined) {
      Fields.push('selection = :selection')
      Replacements.selection = patch.Selection ? 1 : 0
    }
    if (patch.PS9 !== undefined) {
      Fields.push('ps9 = :ps9')
      Replacements.ps9 = patch.PS9 ? 1 : 0
    }
    if (patch.PO !== undefined) {
      Fields.push('po = :po')
      Replacements.po = patch.PO ? 1 : 0
    }
    if (patch.WorkPermit !== undefined) {
      Fields.push('work_permit = :workPermit')
      Replacements.workPermit = patch.WorkPermit ? 1 : 0
    }
    if (patch.Rationale !== undefined) {
      Fields.push('rationale = :rationale')
      Replacements.rationale = patch.Rationale
    }

    if (Fields.length === 0) return

    await Sequelize.query(
      `UPDATE priority_tracking_items
       SET ${Fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = :itemId`,
      {
        replacements: Replacements,
        type: QueryTypes.UPDATE,
      },
    )
  }

  async MarkLatestPriorityTrackingItemExecuted(interventionId: number): Promise<void> {
    await this.EnsurePriorityTrackingTables()

    await Sequelize.query(
      `UPDATE priority_tracking_items
       SET executed = 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = (
         SELECT latest.id
         FROM (
           SELECT i.id
           FROM priority_tracking_items i
           INNER JOIN priority_tracking_sessions s ON s.id = i.session_id
           WHERE i.intervention_id = :interventionId
           ORDER BY s.week_start_date DESC, s.id DESC
           LIMIT 1
         ) AS latest
       )`,
      {
        replacements: { interventionId },
        type: QueryTypes.UPDATE,
      },
    )
  }

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

  async FindMobileSyncDelta(teamCode: string, options: MobileSyncPullOptions): Promise<MobileSyncPullResult> {
    const where: Record<string, unknown> = {
      deleted_at: null,
      updated_at: { [Op.lte]: options.SyncPoint },
    }

    if (teamCode) {
      where.business_team = teamCode
    }

    if (options.Cursor) {
      (where as any)[Op.or] = [
        { updated_at: { [Op.gt]: options.Cursor.UpdatedAt, [Op.lte]: options.SyncPoint } },
        { updated_at: options.Cursor.UpdatedAt, id: { [Op.gt]: options.Cursor.Id } },
      ]
    } else if (options.UpdatedAfter) {
      where.updated_at = {
        [Op.gt]: options.UpdatedAfter,
        [Op.lte]: options.SyncPoint,
      }
    }

    const rows = await Intervention.findAll({
      where: where as any,
      include: [
        OperatorInclude,
        { ...MediaInclude, attributes: ['id', 'media_type', 'filename', 'storage_path'] },
      ],
      order: [['updated_at', 'ASC'], ['id', 'ASC']],
      limit: options.Limit + 1,
    })

    const hasMore = rows.length > options.Limit
    const items = (hasMore ? rows.slice(0, options.Limit) : rows) as unknown as InterventionAttributes[]

    let deletedIds: number[] = []
    if (options.UpdatedAfter && !options.Cursor) {
      const Deleted = await Sequelize.query<{ id: number }>(
        `SELECT id
         FROM interventions
         WHERE deleted_at IS NOT NULL
           AND deleted_at > :updatedAfter
           AND deleted_at <= :syncPoint
           ${teamCode ? 'AND business_team = :teamCode' : ''}
         ORDER BY deleted_at ASC, id ASC`,
        {
          replacements: {
            updatedAfter: options.UpdatedAfter,
            syncPoint: options.SyncPoint,
            teamCode,
          },
          type: QueryTypes.SELECT,
        },
      )
      deletedIds = Deleted.map((row) => Number(row.id)).filter((id) => Number.isFinite(id))
    }

    return {
      Items: items,
      DeletedIds: deletedIds,
      HasMore: hasMore,
    }
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

  async Update(id: number, data: Partial<InterventionAttributes>, transaction?: unknown, expectedRowVersion?: number): Promise<InterventionAttributes | null> {
    const options = transaction ? { transaction: transaction as import('sequelize').Transaction } : undefined;
    const updatePayload: Record<string, unknown> = {
      ...data,
      row_version: literal('row_version + 1'),
    }

    const where: Record<string, unknown> = { id }
    if (expectedRowVersion !== undefined) {
      where.row_version = expectedRowVersion
    }

    const [affected] = await Intervention.update(updatePayload as any, {
      where,
      ...(options ?? {}),
    })
    if (!affected) return null

    const row = await Intervention.findByPk(id, options)
    return row as unknown as InterventionAttributes | null
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
