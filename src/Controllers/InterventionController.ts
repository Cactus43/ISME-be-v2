import type { FastifyInstance, FastifyReply } from 'fastify';
import type { IAuthenticatedRequest } from '../Data/Types/Http';
import type { IInterventionOperations } from '../Data/Interfaces/IOperations';
import type { ITeamAdapter } from '../Data/Interfaces/IAdapter';
import { RequestContext } from '../Data/Types/Contexts';
import {
  CREATE_INTERVENTION_SCHEMA,
  UPDATE_INTERVENTION_SCHEMA,
  LIST_INTERVENTIONS_QUERY_SCHEMA,
  MOBILE_SYNC_PULL_QUERY_SCHEMA,
  PRIORITY_TRACKING_QUERY_SCHEMA,
  PRIORITY_TRACKING_UPDATE_SCHEMA,
  TOGGLE_DELETE_SCHEMA,
  type CreateInterventionInput,
  type PriorityTrackingQuery,
  type PriorityTrackingUpdateInput,
  type MobileSyncPullQuery,
  type UpdateInterventionInput,
  type ToggleDeleteInput,
} from '../Data/Schemas/Intervention';
import { Authenticate, RequireRole } from '../Middleware/Authenticate';
import { Validate, ValidateQuery } from '../Middleware/Validate';
import { ParseId } from '../Utils/ParseId';
import type { ExportCsvOptions, ExportExcelOptions } from '../Data/Interfaces/IOperations';


type ControllerHandler = (req: IAuthenticatedRequest, reply: FastifyReply) => Promise<void>;


// ─── Intervention Controller ───────────────────────────────────────────────

export class InterventionController {

  private readonly _ops: IInterventionOperations;
  private readonly _teamAdapter: ITeamAdapter;

  constructor({ InterventionOperations, TeamAdapter }: { InterventionOperations: IInterventionOperations; TeamAdapter: ITeamAdapter }) {
    this._ops = InterventionOperations;
    this._teamAdapter = TeamAdapter;
  }


  // ─── Route Registration ────────────────────────────────────────────────

  public RegisterRoutes(app: FastifyInstance): void {
    app.get('/stats', { preHandler: [Authenticate('backoffice')] }, this.Handle(this.Stats));
    app.get('/recent', { preHandler: [Authenticate('backoffice')] }, this.Handle(this.Recent));
    app.get('/dashboard/charts', { preHandler: [Authenticate('backoffice')] }, this.Handle(this.DashboardCharts));
    app.get('/dashboard', { preHandler: [Authenticate('backoffice')] }, this.Handle(this.Dashboard));
    app.get('/priority-tracking', {
      preHandler: [Authenticate('backoffice'), ValidateQuery(PRIORITY_TRACKING_QUERY_SCHEMA)],
    }, this.Handle(this.GetPriorityTrackingWeek));
    app.get('/priority-tracking/timeline', {
      preHandler: [Authenticate('backoffice'), ValidateQuery(PRIORITY_TRACKING_QUERY_SCHEMA)],
    }, this.Handle(this.GetPriorityTrackingTimeline));
    app.put('/priority-tracking/items/:id', {
      preHandler: [Authenticate('backoffice'), RequireRole('admin', 'approval_manager', 'execution_manager'), Validate(PRIORITY_TRACKING_UPDATE_SCHEMA)],
    }, this.Handle(this.UpdatePriorityTrackingItem));

    app.get('/', { preHandler: [Authenticate('backoffice'), ValidateQuery(LIST_INTERVENTIONS_QUERY_SCHEMA)] }, this.Handle(this.List));
    app.get('/export/csv', { preHandler: [Authenticate('backoffice')] }, this.Handle(this.ExportCsv));
    app.get('/export/excel', { preHandler: [Authenticate('backoffice')] }, this.Handle(this.ExportExcel));
    app.get('/:id', { preHandler: [Authenticate('backoffice')] }, this.Handle(this.GetById));
    app.post('/', { preHandler: [Authenticate(), RequireRole('admin', 'execution_manager'), Validate(CREATE_INTERVENTION_SCHEMA)] }, this.Handle(this.Create));
    app.put('/:id', { preHandler: [Authenticate('backoffice'), RequireRole('admin', 'execution_manager'), Validate(UPDATE_INTERVENTION_SCHEMA)] }, this.Handle(this.Update));
    app.post('/toggle-delete', { preHandler: [Authenticate('backoffice'), RequireRole('admin', 'execution_manager'), Validate(TOGGLE_DELETE_SCHEMA)] }, this.Handle(this.ToggleDelete));

    app.get('/mobile/sync', { preHandler: [Authenticate('mobile'), ValidateQuery(MOBILE_SYNC_PULL_QUERY_SCHEMA)] }, this.Handle(this.MobileSync));
    app.post('/mobile/sync', { preHandler: [Authenticate('mobile')] }, this.Handle(this.MobileSyncUpload));
  }

  private Handle(handler: ControllerHandler) {
    return async (request: IAuthenticatedRequest, reply: FastifyReply): Promise<void> => {
      await handler.call(this, request, reply);
    };
  }


  // ─── Handlers ─────────────────────────────────────────────────────────

  private async List(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const result = await this._ops.List(req.query as any);
    const { Data, Pagination } = result.Data;
    reply.send({
      status: 'ok',
      data: {
        Items: Data,
        Total: Pagination.Total,
        Page: Pagination.Page,
        PageSize: Pagination.Limit,
        TotalPages: Pagination.Pages,
      },
    });
  }

  private async Stats(_req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const result = await this._ops.GetStats();
    reply.send({ status: 'ok', data: result.Data });
  }

  private async Recent(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const query = req.query as Record<string, string | undefined>;
    const limit = Math.min(50, Math.max(1, parseInt(query.limit ?? '10', 10) || 10));
    const result = await this._ops.GetRecent(limit);
    reply.send({ status: 'ok', data: result.Data });
  }

  private async Dashboard(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const query = req.query as Record<string, string | undefined>;
    const interventionType = query.type ? parseInt(query.type, 10) : undefined;
    const result = await this._ops.GetAllForDashboard(interventionType);
    reply.send({ status: 'ok', data: result.Data });
  }

  // ─── Dashboard charts (server-side aggregation + polynomial regression) ──

  private async DashboardCharts(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const query = req.query as Record<string, string | undefined>;
    const result = await this._ops.GetChartBundle({
      interventionType: query.type ? parseInt(query.type, 10) : undefined,
      year: query.year ? parseInt(query.year, 10) : undefined,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      steamPrice: query.steamPrice ? parseFloat(query.steamPrice) : undefined,
      timeFrame: query.timeFrame || 'month',
    });
    reply.send({ status: 'ok', data: result.Data });
  }

  private async GetPriorityTrackingWeek(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const query = req.query as PriorityTrackingQuery;
    const WeekStart = new Date(`${query.weekStart}T00:00:00`);
    const WeekEnd = new Date(WeekStart);
    WeekEnd.setDate(WeekStart.getDate() + 6);
    const result = await this._ops.GetPriorityTrackingWeek(WeekStart, WeekEnd);
    reply.send({ status: 'ok', data: result.Data });
  }

  private async GetPriorityTrackingTimeline(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const query = req.query as PriorityTrackingQuery;
    const WeekStart = new Date(`${query.weekStart}T00:00:00`);
    const WeekEnd = new Date(WeekStart);
    WeekEnd.setDate(WeekStart.getDate() + 6);
    const result = await this._ops.GetPriorityTrackingTimeline(WeekStart, WeekEnd);
    reply.send({ status: 'ok', data: result.Data });
  }

  private async UpdatePriorityTrackingItem(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const context = RequestContext.FromRequest(req);
    const itemId = ParseId((req.params as Record<string, string>).id);
    await this._ops.UpdatePriorityTrackingItem(itemId, req.body as PriorityTrackingUpdateInput, context);
    reply.send({ status: 'ok', data: { Updated: true } });
  }

  private async GetById(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const result = await this._ops.GetById(ParseId((req.params as Record<string, string>).id));
    reply.send({ status: 'ok', data: result.Data });
  }

  private async MobileSync(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.raw.removeHeader('ETag');

    let teamCode = '';
    if (req.User?.TeamId) {
      const team = await this._teamAdapter.FindById(req.User.TeamId);
      teamCode = team?.code ?? '';
    }

    const query = req.query as MobileSyncPullQuery
    const limitRaw = query.limit ? Number(query.limit) : 300
    const limit = Number.isFinite(limitRaw) ? Math.max(50, Math.min(1000, limitRaw)) : 300

    const updatedAfter = query.updatedAfter ? new Date(query.updatedAfter) : null
    const syncPoint = query.syncPoint ? new Date(query.syncPoint) : new Date()

    const result = await this._ops.GetAllForMobile(teamCode, {
      UpdatedAfter: updatedAfter && !Number.isNaN(updatedAfter.getTime()) ? updatedAfter : null,
      SyncPoint: !Number.isNaN(syncPoint.getTime()) ? syncPoint : new Date(),
      Cursor: query.cursor ?? null,
      Limit: limit,
    });
    reply.send({ status: 'ok', data: result.Data });
  }

  private async MobileSyncUpload(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const context = RequestContext.FromRequest(req);
    const interventions = Array.isArray(req.body) ? req.body : [];
    const result = await this._ops.SyncFromMobile(interventions, context);
    reply.send({ status: 'ok', data: result.Data });
  }

  private async Create(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const context = RequestContext.FromRequest(req);
    const result = await this._ops.Create(req.body as CreateInterventionInput, context);
    reply.status(201).send({ status: 'ok', data: result.Data });
  }

  private async Update(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const context = RequestContext.FromRequest(req);
    const result = await this._ops.Update(ParseId((req.params as Record<string, string>).id), req.body as UpdateInterventionInput, context);
    reply.send({ status: 'ok', data: result.Data });
  }

  private async ToggleDelete(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const context = RequestContext.FromRequest(req);
    const result = await this._ops.ToggleDelete(req.body as ToggleDeleteInput, context);
    reply.send({ status: 'ok', data: result.Data });
  }

  private async ExportCsv(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const query = req.query as Record<string, string | undefined>;
    const teamCode = query.teamCode;

    const separatorRaw = String(query.separator ?? ';');
    const separator: ',' | ';' = separatorRaw === ',' ? ',' : ';';

    const quoteModeRaw = String(query.quoteMode ?? 'always');
    const quoteMode: 'always' | 'auto' = quoteModeRaw === 'auto' ? 'auto' : 'always';

    const newlineRaw = String(query.newline ?? 'crlf');
    const newline: '\n' | '\r\n' = newlineRaw === 'lf' ? '\n' : '\r\n';

    const includeHeader = String(query.includeHeader ?? 'true').toLowerCase() === 'true';
    const includeBom = String(query.includeBom ?? 'true').toLowerCase() === 'true';
    const languageRaw = String(query.lang ?? 'it').toLowerCase();
    const language: 'it' | 'en' = languageRaw === 'en' ? 'en' : 'it';

    const idsRaw = query.ids;
    const ids = idsRaw
      ? idsRaw.split(',').map((v) => parseInt(v.trim(), 10)).filter((v) => Number.isInteger(v) && v > 0)
      : undefined;

    const columnsRaw = query.columns;
    const columns = columnsRaw
      ? columnsRaw.split(',').map((value) => value.trim()).filter(Boolean)
      : undefined;

    const options: ExportCsvOptions = {
      Separator: separator,
      QuoteMode: quoteMode,
      NewLine: newline,
      Language: language,
      IncludeHeader: includeHeader,
      IncludeBom: includeBom,
      Ids: ids && ids.length > 0 ? ids : undefined,
      Columns: columns && columns.length > 0 ? columns : undefined,
    };

    const result = await this._ops.ExportCsv(teamCode, options);
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="interventions.csv"');
    reply.send(result.Data);
  }

  private async ExportExcel(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const query = req.query as Record<string, string | undefined>;
    const teamCode = query.teamCode;
    const includeHeader = String(query.includeHeader ?? 'true').toLowerCase() === 'true';
    const autoFilter = String(query.autoFilter ?? 'true').toLowerCase() === 'true';
    const languageRaw = String(query.lang ?? 'it').toLowerCase();
    const language: 'it' | 'en' = languageRaw === 'en' ? 'en' : 'it';

    const idsRaw = query.ids;
    const ids = idsRaw
      ? idsRaw.split(',').map((v) => parseInt(v.trim(), 10)).filter((v) => Number.isInteger(v) && v > 0)
      : undefined;

    const columnsRaw = query.columns;
    const columns = columnsRaw
      ? columnsRaw.split(',').map((value) => value.trim()).filter(Boolean)
      : undefined;

    const options: ExportExcelOptions = {
      Language: language,
      IncludeHeader: includeHeader,
      AutoFilter: autoFilter,
      Ids: ids && ids.length > 0 ? ids : undefined,
      Columns: columns && columns.length > 0 ? columns : undefined,
    };

    const result = await this._ops.ExportExcel(teamCode, options);
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', 'attachment; filename="interventions.xlsx"');
    reply.send(result.Data);
  }
}
