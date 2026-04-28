import path from 'path';
import fs from 'fs/promises';
import ExcelJS from 'exceljs';
import type { Logger } from 'pino';
import type { IInterventionAdapter, IMediaAdapter, DashboardStats } from '../Data/Interfaces/IAdapter';
import type { ExportCsvOptions, ExportExcelOptions, IInterventionOperations, MobileSyncPullDTO, MobileSyncPullRequest } from '../Data/Interfaces/IOperations';
import type { InterventionAttributes } from '../Data/Models/Intervention';
import type { PaginatedResult } from '../Data/Types/Pagination';
import type { RequestContext } from '../Data/Types/Contexts';
import type { InterventionPolicy } from '../Data/Types/Policies';
import type { CreateInterventionInput, UpdateInterventionInput, ListInterventionsQuery, ToggleDeleteInput, PriorityTrackingAddInput, ApprovalNoteUpdateInput } from '../Data/Schemas/Intervention';
import { InterventionDTO } from '../Data/Types/DTOs/InterventionDTO';
import { OperationResult } from '../Data/Types/OperationResult';
import { ComputeChartBundle, type ChartBundle } from '../Utils/ChartEngine';
import { BuildInterventionExportRow, ResolveInterventionExportColumns } from '../Utils/InterventionExport';
import { BadRequestError, NotFoundError } from '../Data/Exceptions/Index';
import { NormalizeInterventionData } from '../Utils/Normalize';
import { CalculateSteamFlow } from '../Utils/SteamFlow';
import { Sequelize } from '../Infra/Database';
import type { EventBus } from '../Infra/EventBus';
import type { MediaSlot } from '../Data/Types/Media';
import { BuildMediaStorageTarget, DecodeBase64Image } from '../Utils/MediaStorage';


function ToLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function GetNextMonday(d: Date): Date {
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  const day = monday.getDay();
  const daysUntil = day === 1 ? 7 : (1 - day + 7) % 7;
  monday.setDate(monday.getDate() + daysUntil);
  return monday;
}

function ParseMobileSyncCursor(cursor: string | null): { UpdatedAt: Date; Id: number } | null {
  if (!cursor) return null
  const [UpdatedAtRaw, IdRaw] = cursor.split('|')
  if (!UpdatedAtRaw || !IdRaw) return null

  const UpdatedAt = new Date(UpdatedAtRaw)
  const Id = Number(IdRaw)
  if (Number.isNaN(UpdatedAt.getTime()) || !Number.isFinite(Id) || Id <= 0) return null
  return { UpdatedAt, Id }
}

function BuildMobileSyncCursor(updatedAt: Date, id: number): string {
  return `${updatedAt.toISOString()}|${id}`
}

function NonNullableText(value: string | null): string {
  return value ?? '';
}


// ─── InterventionOperations ────────────────────────────────────────────────

export class InterventionOperations implements IInterventionOperations {

  private readonly _interventionAdapter: IInterventionAdapter;
  private readonly _mediaAdapter: IMediaAdapter;
  private readonly _log: Logger;
  private readonly _eventBus: EventBus;
  private readonly _policy: InterventionPolicy;

  constructor({
    InterventionAdapter,
    MediaAdapter,
    Logger,
    EventBus: Bus,
    Policy,
  }: {
    InterventionAdapter: IInterventionAdapter;
    MediaAdapter: IMediaAdapter;
    Logger: Logger;
    EventBus: EventBus;
    Policy: InterventionPolicy;
  }) {
    this._interventionAdapter = InterventionAdapter;
    this._mediaAdapter = MediaAdapter;
    this._log = Logger;
    this._eventBus = Bus;
    this._policy = Policy;
  }


  // ─── List (backoffice, paginated) ──────────────────────────────────

  async List(query: ListInterventionsQuery): Promise<OperationResult<PaginatedResult<InterventionDTO>>> {
    const raw = await this._interventionAdapter.FindAllPaginated(query as unknown as Record<string, unknown>);
    return OperationResult.Ok({
      Data: raw.Data.map(InterventionDTO.FromModel),
      Pagination: raw.Pagination,
    });
  }


  // ─── Get single ───────────────────────────────────────────────────

  async GetById(id: number): Promise<OperationResult<InterventionDTO>> {
    const row = await this._interventionAdapter.FindById(id);
    if (!row) throw new NotFoundError('Intervention not found');
    return OperationResult.Ok(InterventionDTO.FromModel(row));
  }


  // ─── Dashboard stats (aggregated in SQL) ──────────────────────────

  async GetStats(): Promise<OperationResult<DashboardStats>> {
    const stats = await this._interventionAdapter.AggregateStats();
    return OperationResult.Ok(stats);
  }


  // ─── Recent interventions for dashboard ───────────────────────────

  async GetRecent(limit: number): Promise<OperationResult<InterventionDTO[]>> {
    const rows = await this._interventionAdapter.FindRecent(limit);
    return OperationResult.Ok(rows.map(InterventionDTO.FromModel));
  }


  // ─── All interventions for dashboard charts ──────────────────────

  async GetAllForDashboard(interventionType?: number): Promise<OperationResult<InterventionDTO[]>> {
    const rows = await this._interventionAdapter.FindAllForDashboard(
      interventionType !== undefined ? { interventionType } : undefined,
    );
    return OperationResult.Ok(rows.map(InterventionDTO.FromModel));
  }


  // ─── Chart bundle (all aggregation + polynomial regression) ──────

  async GetChartBundle(filters: {
    interventionType?: number;
    year?: number;
    dateFrom?: string;
    dateTo?: string;
    steamPrice?: number;
    timeFrame?: string;
  }): Promise<OperationResult<ChartBundle>> {
    const rows = await this._interventionAdapter.FindAllForDashboard({
      interventionType: filters.interventionType,
      year: filters.year,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });
    const dtos = rows.map(InterventionDTO.FromModel);

    const steamPrice = filters.steamPrice ?? 50;
    const timeFrame = (['day', 'week', 'month', 'year'].includes(filters.timeFrame ?? '') ? filters.timeFrame : 'month') as 'day' | 'week' | 'month' | 'year';

    const bundle = ComputeChartBundle(dtos, steamPrice, timeFrame);
    return OperationResult.Ok(bundle);
  }


  // ─── Get all for mobile sync ──────────────────────────────────────

  async GetAllForMobile(teamCode: string, options: MobileSyncPullRequest): Promise<OperationResult<MobileSyncPullDTO>> {
    const Delta = await this._interventionAdapter.FindMobileSyncDelta(teamCode, {
      UpdatedAfter: options.UpdatedAfter,
      SyncPoint: options.SyncPoint,
      Cursor: ParseMobileSyncCursor(options.Cursor),
      Limit: options.Limit,
    })
    const Items = Delta.Items.map(InterventionDTO.FromModel)

    const Last = Delta.Items.length > 0 ? Delta.Items[Delta.Items.length - 1] : null
    const NextCursor = Last
      ? BuildMobileSyncCursor(Last.updated_at, Last.id)
      : null

    return OperationResult.Ok({
      Items,
      DeletedIds: Delta.DeletedIds,
      HasMore: Delta.HasMore,
      NextCursor,
      SyncPoint: options.SyncPoint.toISOString(),
    })
  }


  // ─── Create (mobile sync) ────────────────────────────────────────

  async Create(
    input: CreateInterventionInput,
    context: RequestContext,
  ): Promise<OperationResult<InterventionDTO>> {
    const t = await Sequelize.transaction();

    try {
      const normalized = NormalizeInterventionData({ ...input } as Record<string, unknown>);

      // Calculate steam flow from pressure + plume length
      if (normalized.pressure && normalized.plume_length) {
        const pressureNum = parseFloat(String(normalized.pressure));
        const plumeNum = parseFloat(String(normalized.plume_length));
        if (!isNaN(pressureNum) && !isNaN(plumeNum)) {
          const flow = CalculateSteamFlow(plumeNum, pressureNum);
          normalized.steam_flow_kg = flow.Kg;
          normalized.steam_flow_tonne = flow.Tonne;
        }
      }

      // Extract and remove base64 photos from the insert payload
      const fotoPerdita = normalized.fotoPerdita as string | undefined;
      const fotoRiparazione = normalized.fotoRiparazione as string | undefined;
      delete normalized.fotoPerdita;
      delete normalized.fotoRiparazione;

      const intervention = await this._interventionAdapter.Create(
        {
          ...normalized,
          operator_id: context.UserId,
          device_id: context.DeviceId,
          created_by: context.UserId,
          inspection_date: new Date(normalized.inspection_date as string),
          repair_date: normalized.repair_date ? new Date(normalized.repair_date as string) : null,
        } as unknown as Partial<InterventionAttributes>,
        t,
      );

      // Persist attached photos as media
      if (fotoPerdita) {
        await this._savePhoto(intervention.id, fotoPerdita, 'photo_before', context.UserId, context.DeviceId, t);
      }
      if (fotoRiparazione) {
        await this._savePhoto(intervention.id, fotoRiparazione, 'photo_after', context.UserId, context.DeviceId, t);
      }

      await t.commit();
      this._log.info({ interventionId: intervention.id, tag: intervention.tag }, 'Intervention created');
      this._eventBus.Publish({ Type: 'Intervention.Created', Source: context.AuthSource ?? 'system', Timestamp: new Date(), Context: context, Payload: { InterventionId: intervention.id, Tag: intervention.tag, Message: `Created: ${intervention.tag}` } });
      return OperationResult.Ok(InterventionDTO.FromModel(intervention));
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }


  // ─── Update (backoffice) ──────────────────────────────────────────

  async Update(id: number, input: UpdateInterventionInput, context: RequestContext): Promise<OperationResult<InterventionDTO>> {
    const updateData: Partial<InterventionAttributes> = {};

    // Anagrafica Intervento
    if (input.tag !== undefined) updateData.tag = NonNullableText(input.tag);
    if (input.unit !== undefined) updateData.unit = input.unit;
    if (input.business_team !== undefined) updateData.business_team = NonNullableText(input.business_team);
    if (input.location !== undefined) updateData.location = NonNullableText(input.location);
    if (input.competence !== undefined) updateData.competence = input.competence;
    if (input.service !== undefined) updateData.service = input.service;
    if (input.component_equipment !== undefined) updateData.component_equipment = NonNullableText(input.component_equipment);
    if (input.size !== undefined) updateData.size = input.size;
    if (input.dn_discharger !== undefined) updateData.dn_discharger = input.dn_discharger;
    if (input.operator_id !== undefined) updateData.operator_id = input.operator_id;
    if (input.notification !== undefined) updateData.notification = input.notification;
    if (input.closure_notification !== undefined) updateData.closure_notification = input.closure_notification;
    if (input.intervention_description !== undefined) updateData.intervention_description = input.intervention_description;

    // Dettagli Intervento
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.status !== undefined) updateData.status = input.status;

    // Dettagli di Campo
    if (input.malfunctioning_type !== undefined) updateData.malfunctioning_type = input.malfunctioning_type as any;
    if (input.discharger_type !== undefined) updateData.discharger_type = input.discharger_type;
    if (input.plume_length !== undefined) updateData.plume_length = input.plume_length;
    if (input.plume_spec !== undefined) updateData.plume_spec = input.plume_spec as any;
    if (input.need_for_insulation !== undefined) updateData.need_for_insulation = input.need_for_insulation as any;
    if (input.asbestos !== undefined) updateData.asbestos = input.asbestos as any;
    if (input.metal_sheet !== undefined) updateData.metal_sheet = input.metal_sheet;
    if (input.metal_sheet_temperature !== undefined) updateData.metal_sheet_temperature = input.metal_sheet_temperature;
    if (input.pipe_temperature !== undefined) updateData.pipe_temperature = input.pipe_temperature;
    if (input.insulation_material !== undefined) updateData.insulation_material = input.insulation_material;
    if (input.scaffolding !== undefined) updateData.scaffolding = input.scaffolding;
    if (input.steam_discharge_to_closed_system !== undefined) updateData.steam_discharge_to_closed_system = input.steam_discharge_to_closed_system as any;
    if (input.trait_length !== undefined) updateData.trait_length = input.trait_length;

    // Valvola
    if (input.interception_possibility !== undefined) updateData.interception_possibility = input.interception_possibility as any;
    if (input.interception_valve_status !== undefined) updateData.interception_valve_status = input.interception_valve_status as any;
    if (input.reason !== undefined) updateData.reason = input.reason;

    // Valori Perdita
    if (input.pressure !== undefined) updateData.pressure = input.pressure;
    if (input.nominal_flow !== undefined) updateData.nominal_flow = input.nominal_flow;
    if (input.steam_flow_kg !== undefined) updateData.steam_flow_kg = input.steam_flow_kg;
    if (input.steam_flow_tonne !== undefined) updateData.steam_flow_tonne = input.steam_flow_tonne;

    // Tempo Intervento
    if (input.post_date !== undefined) updateData.post_date = input.post_date;
    if (input.repair_date !== undefined) {
      updateData.repair_date = input.repair_date ? new Date(input.repair_date) : null;
      // Status follows repair_date deterministically in backoffice updates:
      // repair_date set -> closed (0), repair_date removed -> open (1).
      updateData.status = input.repair_date ? 0 : 1;
    }

    // Audit
    updateData.updated_by = context.UserId;

    const row = await this._interventionAdapter.Update(id, updateData);
    if (!row) throw new NotFoundError('Intervention not found');

    if (Number(row.status) !== 1 || row.repair_date != null) {
      await this._interventionAdapter.MarkLatestPriorityTrackingItemExecuted(id)
    } else {
      await this._interventionAdapter.ResetLatestPriorityTrackingItemExecuted(id)
      // Se la repair_date è stata rimossa e l'intervento era selezionato nella sessione
      // corrente, va reintrodotto nella pianificazione della settimana successiva.
      if (input.repair_date === null || input.repair_date === '') {
        await this._interventionAdapter.AddOpenInterventionToNextSessionIfSelected(id)
      }
    }

    this._log.info({ interventionId: id }, 'Intervention updated');
    this._eventBus.Publish({ Type: 'Intervention.Updated', Source: 'backoffice', Timestamp: new Date(), Context: context, Payload: { InterventionId: id, Fields: Object.keys(input) } });
    return OperationResult.Ok(InterventionDTO.FromModel(row));
  }

  async UpdateApprovalNote(id: number, input: ApprovalNoteUpdateInput, context: RequestContext): Promise<OperationResult<InterventionDTO>> {
    if (context.UserRole !== 'admin' && context.UserRole !== 'approval_manager') {
      throw new BadRequestError('Insufficient permissions for approval note')
    }

    const row = await this._interventionAdapter.Update(id, {
      approval_note: input.note ?? null,
      updated_by: context.UserId,
    })

    if (!row) throw new NotFoundError('Intervention not found')
    return OperationResult.Ok(InterventionDTO.FromModel(row))
  }


  // ─── Toggle delete ────────────────────────────────────────────────

  async ToggleDelete(input: ToggleDeleteInput, context: RequestContext): Promise<OperationResult<{ Affected: number }>> {
    if (input.ids.length > this._policy.MaxBulkDeleteCount) {
      throw new BadRequestError(`Bulk delete limited to ${this._policy.MaxBulkDeleteCount} items`);
    }

    const affected = await this._interventionAdapter.ToggleDelete(input.ids, input.deleted, context.UserId);
    this._log.info({ ids: input.ids, deleted: input.deleted }, `Toggled delete for ${affected} interventions`);
    this._eventBus.Publish({
      Type: input.deleted ? 'Intervention.Deleted' : 'Intervention.Restored',
      Source: 'backoffice',
      Timestamp: new Date(),
      Context: context,
      Payload: { InterventionIds: input.ids, Deleted: input.deleted, Affected: affected, Message: `Toggled ${affected} interventions` },
    });
    return OperationResult.Ok({ Affected: affected });
  }

  async GetPriorityTrackingWeek(weekStart: Date, _weekEnd: Date) {
    const NextWeekStart = GetNextMonday(new Date());
    if (ToLocalIsoDate(weekStart) > ToLocalIsoDate(NextWeekStart)) {
      throw new BadRequestError('Priority-tracking weeks beyond next week are not allowed');
    }
    const data = await this._interventionAdapter.GetPriorityTrackingWeek(weekStart);
    return OperationResult.Ok(data);
  }

  async GetPriorityTrackingTimeline(weekStart: Date, _weekEnd: Date) {
    const NextWeekStart = GetNextMonday(new Date());
    if (ToLocalIsoDate(weekStart) > ToLocalIsoDate(NextWeekStart)) {
      throw new BadRequestError('Priority-tracking weeks beyond next week are not allowed');
    }
    const data = await this._interventionAdapter.GetPriorityTrackingTimeline(weekStart);
    return OperationResult.Ok(data);
  }

  async AddPriorityTrackingIntervention(input: PriorityTrackingAddInput, _context: RequestContext): Promise<OperationResult<{ Added: boolean }>> {
    const Added = await this._interventionAdapter.AddInterventionToPlanningSession(input.interventionId)
    return OperationResult.Ok({ Added })
  }

  async UpdatePriorityTrackingItem(
    itemId: number,
    patch: {
      selection?: boolean;
      ps9?: boolean;
      po?: boolean;
      workPermit?: boolean;
      nonIntercettabile?: boolean;
      rationale?: 'Mancanza Operatore' | 'Difficolta Intercetto' | 'Mancanza materiali' | 'Permesso non aperto' | null;
    },
    context: RequestContext,
  ): Promise<OperationResult<void>> {
    const Role = context.UserRole;
    if (!Role) throw new BadRequestError('Missing role');

    const CanApproval = Role === 'admin' || Role === 'approval_manager';
    const CanExecution = Role === 'admin' || Role === 'execution_manager';

    const AdapterPatch: {
      Selection?: boolean;
      PS9?: boolean;
      PO?: boolean;
      WorkPermit?: boolean;
      NonIntercettabile?: boolean;
      Rationale?: 'Mancanza Operatore' | 'Difficolta Intercetto' | 'Mancanza materiali' | 'Permesso non aperto' | null;
    } = {};

    if (patch.selection !== undefined || patch.ps9 !== undefined || patch.po !== undefined || patch.workPermit !== undefined || patch.nonIntercettabile !== undefined) {
      if (!CanApproval) throw new BadRequestError('Insufficient permissions for approval fields');
      if (patch.selection !== undefined) AdapterPatch.Selection = patch.selection;
      if (patch.ps9 !== undefined) AdapterPatch.PS9 = patch.ps9;
      if (patch.po !== undefined) AdapterPatch.PO = patch.po;
      if (patch.workPermit !== undefined) AdapterPatch.WorkPermit = patch.workPermit;
      if (patch.nonIntercettabile !== undefined) AdapterPatch.NonIntercettabile = patch.nonIntercettabile;

      // Se uno qualsiasi dei 4 prerequisiti viene rimosso, la selection si azzera.
      if (patch.ps9 === false || patch.po === false || patch.workPermit === false || patch.nonIntercettabile === false) {
        AdapterPatch.Selection = false;
      }
    }

    if (patch.rationale !== undefined) {
      if (!CanExecution) throw new BadRequestError('Insufficient permissions for rationale');
      AdapterPatch.Rationale = patch.rationale;
      // When rationale is set, deselect the item
      if (patch.rationale !== null) {
        AdapterPatch.Selection = false;
      }
      // When rationale is cleared, reselect the item
      if (patch.rationale === null) {
        AdapterPatch.Selection = true;
      }
    }

    const t = await Sequelize.transaction();
    try {
      // Read current selection state BEFORE updating (needed for side-effects below).
      // Under transaction, adapter acquires FOR UPDATE lock on the row.
      const WasSelected = patch.rationale !== undefined
        ? await this._interventionAdapter.GetPriorityTrackingItemSelection(itemId, t)
        : null;

      const WantsSelection = patch.selection === true || patch.rationale === null;
      if (WantsSelection) {
        const ApprovalState = await this._interventionAdapter.GetPriorityTrackingItemApprovalState(itemId, t)
        if (!ApprovalState) throw new NotFoundError('Priority tracking item not found')

        const NextPS9 = patch.ps9 ?? ApprovalState.PS9
        const NextPO = patch.po ?? ApprovalState.PO
        const NextWorkPermit = patch.workPermit ?? ApprovalState.WorkPermit
        const NextNonIntercettabile = patch.nonIntercettabile ?? ApprovalState.NonIntercettabile

        if (!(NextPS9 && NextPO && NextWorkPermit && NextNonIntercettabile)) {
          throw new BadRequestError('Selection requires ps9, po, workPermit and nonIntercettabile to be true')
        }
      }

      await this._interventionAdapter.UpdatePriorityTrackingItem(itemId, AdapterPatch, t);

      // If rationale was set on a previously-selected item, add it to the next session
      if (patch.rationale != null && WasSelected === true) {
        await this._interventionAdapter.AddInterventionToNextSession(itemId, t);
      }

      // If rationale was cleared, remove the intervention from the next session
      if (patch.rationale === null) {
        await this._interventionAdapter.RemoveInterventionFromNextSession(itemId, t);
      }

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    return OperationResult.Void();
  }


  // ─── Export CSV ───────────────────────────────────────────────────

  async ExportCsv(teamCode?: string, options?: ExportCsvOptions): Promise<OperationResult<string>> {
    const separator = options?.Separator ?? ';';
    const quoteMode = options?.QuoteMode ?? 'always';
    const newline = options?.NewLine ?? '\r\n';
    const language = options?.Language ?? 'it';
    const includeHeader = options?.IncludeHeader ?? true;
    const includeBom = options?.IncludeBom ?? true;

    const allRows = await this._interventionAdapter.FindAllForExport(teamCode);
    const rows = options?.Ids && options.Ids.length > 0
      ? allRows.filter((r) => options.Ids!.includes(r.id))
      : allRows;

    if (rows.length === 0) throw new NotFoundError('No interventions found for export');

    const columns = ResolveInterventionExportColumns(options?.Columns, language);
    const headers = columns.map((column) => column.Header);

    const escapeCsvValue = (value: unknown): string => {
      const normalized = value == null ? '' : String(value);
      const escaped = normalized.replace(/"/g, '""');
      const mustQuote = quoteMode === 'always'
        || escaped.includes(separator)
        || escaped.includes('\n')
        || escaped.includes('\r')
        || escaped.includes('"');
      return mustQuote ? `"${escaped}"` : escaped;
    };

    const csvRows = rows.map((row) => BuildInterventionExportRow(row as InterventionAttributes & { Operator?: { firstname?: string | null; lastname?: string | null } | null }, columns)
      .map(escapeCsvValue)
      .join(separator));

    const payload = includeHeader
      ? [headers.map(escapeCsvValue).join(separator), ...csvRows].join(newline)
      : csvRows.join(newline);

    return OperationResult.Ok(includeBom ? `\uFEFF${payload}` : payload);
  }

  async ExportExcel(teamCode?: string, options?: ExportExcelOptions): Promise<OperationResult<Buffer>> {
    const language = options?.Language ?? 'it';
    const includeHeader = options?.IncludeHeader ?? true;
    const autoFilter = options?.AutoFilter ?? true;

    const allRows = await this._interventionAdapter.FindAllForExport(teamCode);
    const rows = options?.Ids && options.Ids.length > 0
      ? allRows.filter((r) => options.Ids!.includes(r.id))
      : allRows;

    if (rows.length === 0) throw new NotFoundError('No interventions found for export');

    const columns = ResolveInterventionExportColumns(options?.Columns, language);
    const headers = columns.map((column) => column.Header);
    const priorityColumnIndex = columns.findIndex((column) => column.Key === 'priority');
    const matrix = rows.map((row) => BuildInterventionExportRow(
      row as InterventionAttributes & { Operator?: { firstname?: string | null; lastname?: string | null } | null },
      columns,
    ));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Interventions');

    if (includeHeader) {
      ws.addRow(headers);
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 20;
      if (autoFilter) {
        ws.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: 1, column: headers.length },
        };
      }
    }

    matrix.forEach((line) => {
      const rowRef = ws.addRow(line);

      if (priorityColumnIndex < 0) return;

      const excelColumn = priorityColumnIndex + 1;
      const cell = rowRef.getCell(excelColumn);
      const rawPriority = line[priorityColumnIndex];
      const priority = typeof rawPriority === 'number' ? rawPriority : Number(rawPriority);

      const colorByPriority: Record<number, string> = {
        0: 'FF9CA3AF', // gray
        1: 'FFE84855', // red
        2: 'FFFFA449', // orange
        3: 'FFDFC44A', // yellow
      };

      const fillColor = colorByPriority[priority];
      if (!fillColor) return;

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: fillColor },
      };

      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.font = {
        bold: true,
        color: { argb: priority === 3 ? 'FF111827' : 'FFFFFFFF' },
      };
    });
    ws.columns.forEach((c) => {
      c.width = 18;
    });

    const data = await wb.xlsx.writeBuffer();
    return OperationResult.Ok(Buffer.from(data));
  }


  // ─── Sync from mobile (batch upload) ─────────────────────────────

  async SyncFromMobile(
    interventions: any[],
    context: RequestContext,
  ): Promise<OperationResult<Record<string, number | 'conflict'>>> {
    const idMap: Record<string, number | 'conflict'> = {};

    for (const item of interventions) {
      const localId = String(item.id ?? '');
      const serverId = item.id && item.id > 0 ? item.id : null;

      try {
        // If has valid server ID and exists, update it
        if (serverId) {
          const existing = await this._interventionAdapter.FindById(serverId);
          if (existing) {
            // Update existing
            const updateData: Partial<InterventionAttributes> = {};
            if (item.tag !== undefined) updateData.tag = item.tag;
            if (item.unit !== undefined) updateData.unit = item.unit;
            if (item.business_team !== undefined) updateData.business_team = item.business_team;
            if (item.location !== undefined) updateData.location = item.location;
            if (item.component_equipment !== undefined) updateData.component_equipment = item.component_equipment;
            if (item.size !== undefined) updateData.size = item.size;
            if (item.pressure !== undefined) updateData.pressure = item.pressure;
            if (item.plume_length !== undefined) updateData.plume_length = item.plume_length;
            if (item.repair_date !== undefined) updateData.repair_date = item.repair_date ? new Date(item.repair_date) : null;
            if (item.status !== undefined) updateData.status = item.status;
            if (item.priority !== undefined) updateData.priority = item.priority;

            const fotoPerdita = item.fotoPerdita as string | undefined;
            const fotoRiparazione = item.fotoRiparazione as string | undefined;

            // Calculate steam flow if pressure + plume provided
            if (updateData.pressure && updateData.plume_length) {
              const plumeNum = parseFloat(String(updateData.plume_length));
              const pressureNum = parseFloat(String(updateData.pressure));
              if (!isNaN(plumeNum) && !isNaN(pressureNum)) {
                const flow = CalculateSteamFlow(plumeNum, pressureNum);
                updateData.steam_flow_kg = flow.Kg;
                updateData.steam_flow_tonne = flow.Tonne;
              }
            }

            const ExpectedRowVersion = typeof item.row_version === 'number'
              ? Number(item.row_version)
              : undefined

            const Updated = await this._interventionAdapter.Update(serverId, updateData, undefined, ExpectedRowVersion)
            if (!Updated) {
              idMap[localId] = 'conflict'
              continue
            }

            const NextStatus = updateData.status ?? existing.status;
            const NextRepairDate = updateData.repair_date !== undefined
              ? updateData.repair_date
              : existing.repair_date;
            const IsClosed = Number(NextStatus) !== 1 || NextRepairDate != null;
            if (IsClosed) {
              await this._interventionAdapter.MarkLatestPriorityTrackingItemExecuted(serverId);
            } else {
              await this._interventionAdapter.ResetLatestPriorityTrackingItemExecuted(serverId)
            }

            if (fotoPerdita) {
              await this._savePhoto(serverId, fotoPerdita, 'photo_before', context.UserId, context.DeviceId);
            }
            if (fotoRiparazione) {
              await this._savePhoto(serverId, fotoRiparazione, 'photo_after', context.UserId, context.DeviceId);
            }
            idMap[localId] = serverId;
            continue;
          }
        }

        // Create new intervention
        const t = await Sequelize.transaction();
        try {
          const normalized = NormalizeInterventionData({ ...item } as Record<string, unknown>);

          // Remove local-only / invalid fields that should not be inserted into MySQL
          delete normalized.id;
          delete normalized.is_dirty;
          delete normalized.is_deleted;
          delete normalized.server_id;
          delete normalized.last_synced_at;
          delete normalized.created_at;
          delete normalized.updated_at;
          delete normalized.report_type;
          delete normalized._deleted;
          delete normalized.deleted;

          // Calculate steam flow
          if (normalized.pressure && normalized.plume_length) {
            const pressureNum = parseFloat(String(normalized.pressure));
            const plumeNum = parseFloat(String(normalized.plume_length));
            if (!isNaN(pressureNum) && !isNaN(plumeNum)) {
              const flow = CalculateSteamFlow(plumeNum, pressureNum);
              normalized.steam_flow_kg = flow.Kg;
              normalized.steam_flow_tonne = flow.Tonne;
            }
          }

          // Extract photos
          const fotoPerdita = normalized.fotoPerdita as string | undefined;
          const fotoRiparazione = normalized.fotoRiparazione as string | undefined;
          delete normalized.fotoPerdita;
          delete normalized.fotoRiparazione;

          const inspectionDateStr = normalized.inspection_date as string;
          const repairDateStr = normalized.repair_date as string;

          this._log.info({ localId, normalizedKeys: Object.keys(normalized) }, 'Creating intervention from mobile sync');

          const intervention = await this._interventionAdapter.Create(
            {
              ...normalized,
              operator_id: context.UserId,
              device_id: context.DeviceId,
              inspection_date: inspectionDateStr ? new Date(inspectionDateStr) : new Date(),
              repair_date: repairDateStr ? new Date(repairDateStr) : null,
            } as unknown as Partial<InterventionAttributes>,
            t,
          );

          // Save photos
          if (fotoPerdita) {
            await this._savePhoto(intervention.id, fotoPerdita, 'photo_before', context.UserId, context.DeviceId, t);
          }
          if (fotoRiparazione) {
            await this._savePhoto(intervention.id, fotoRiparazione, 'photo_after', context.UserId, context.DeviceId, t);
          }

          if (Number(intervention.status) !== 1 || intervention.repair_date != null) {
            await this._interventionAdapter.MarkLatestPriorityTrackingItemExecuted(intervention.id);
          }

          await t.commit();
          idMap[localId] = intervention.id;
          this._log.info({ interventionId: intervention.id, localId }, 'Intervention synced from mobile');
        } catch (error) {
          await t.rollback();
          this._log.error({ localId, error }, 'Failed to sync intervention from mobile');
          // Continue with other items instead of failing entire batch
        }
      } catch (error) {
        this._log.error({ localId, error }, 'Failed to process intervention in sync');
      }
    }

    return OperationResult.Ok(idMap);
  }


  // ─── Private ──────────────────────────────────────────────────────

  private async _savePhoto(
    interventionId: number,
    base64Data: string,
    type: MediaSlot,
    userId: number | null,
    deviceId: number | null,
    transaction?: unknown,
  ): Promise<void> {
    // ~14 MB of base64 encodes ≈ 10 MB of binary data.
    const MAX_PHOTO_BASE64_LENGTH = 14 * 1024 * 1024;
    if (base64Data.length > MAX_PHOTO_BASE64_LENGTH) {
      throw new BadRequestError('Photo exceeds the maximum allowed size (10 MB)');
    }

    const file = DecodeBase64Image(base64Data);
    const target = BuildMediaStorageTarget(interventionId, type, file);
    const existing = await this._mediaAdapter.FindActiveByInterventionAndType(interventionId, type);

    await fs.mkdir(path.dirname(target.AbsolutePath), { recursive: true });
    await fs.writeFile(target.AbsolutePath, file.Buffer);

    if (existing) {
      const previousAbsolutePath = path.resolve(path.dirname(target.AbsolutePath), existing.filename);

      await this._mediaAdapter.Update(
        existing.id,
        {
          filename: target.Filename,
          original_filename: file.OriginalName,
          mime_type: file.MimeType,
          file_size: file.Size,
          storage_path: target.StoragePath,
          updated_by: userId,
          device_id: deviceId,
        },
        transaction,
      );

      if (previousAbsolutePath !== target.AbsolutePath) {
        await fs.rm(previousAbsolutePath, { force: true });
      }

      await this._touchInterventionUpdatedAt(interventionId, userId, transaction);
      return;
    }

    await this._mediaAdapter.Create(
      {
        intervention_id: interventionId,
        media_type: type,
        filename: target.Filename,
        original_filename: file.OriginalName,
        mime_type: file.MimeType,
        file_size: file.Size,
        storage_path: target.StoragePath,
        created_by: userId,
        updated_by: userId,
        device_id: deviceId,
      },
      transaction,
    );

    await this._touchInterventionUpdatedAt(interventionId, userId, transaction);
  }

  private async _touchInterventionUpdatedAt(
    interventionId: number,
    userId: number | null,
    transaction?: unknown,
  ): Promise<void> {
    await this._interventionAdapter.Update(
      interventionId,
      {
        updated_at: new Date(),
        updated_by: userId,
      },
      transaction,
    );
  }
}
