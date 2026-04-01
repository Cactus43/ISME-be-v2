import { Router, Response, NextFunction } from 'express';
import type { IAuthenticatedRequest } from '../Data/Types/Express';
import type { IInterventionOperations } from '../Data/Interfaces/IOperations';
import type { ITeamAdapter } from '../Data/Interfaces/IAdapter';
import { RequestContext } from '../Data/Types/Contexts';
import { CREATE_INTERVENTION_SCHEMA, UPDATE_INTERVENTION_SCHEMA, LIST_INTERVENTIONS_QUERY_SCHEMA, TOGGLE_DELETE_SCHEMA } from '../Data/Schemas/Intervention';
import { Authenticate } from '../Middleware/Authenticate';
import { Validate } from '../Middleware/Validate';
import { ValidateQuery } from '../Middleware/Validate';
import { ParseId } from '../Utils/ParseId';
import type { ExportCsvOptions, ExportExcelOptions } from '../Data/Interfaces/IOperations';


// ─── Intervention Controller ───────────────────────────────────────────────

export class InterventionController {

  public readonly Router: Router;
  private readonly _ops: IInterventionOperations;
  private readonly _teamAdapter: ITeamAdapter;

  constructor({ InterventionOperations, TeamAdapter }: { InterventionOperations: IInterventionOperations; TeamAdapter: ITeamAdapter }) {
    this._ops = InterventionOperations;
    this._teamAdapter = TeamAdapter;
    this.Router = Router();
    this._registerRoutes();
  }


  // ─── Route Registration ────────────────────────────────────────────────

  private _registerRoutes(): void {
    // Dashboard endpoints (before parameterized routes to avoid conflicts)
    this.Router.get('/stats', Authenticate('backoffice'), this.Stats.bind(this));
    this.Router.get('/recent', Authenticate('backoffice'), this.Recent.bind(this));
    this.Router.get('/dashboard/charts', Authenticate('backoffice'), this.DashboardCharts.bind(this));
    this.Router.get('/dashboard', Authenticate('backoffice'), this.Dashboard.bind(this));

    // Backoffice
    this.Router.get('/', Authenticate('backoffice'), ValidateQuery(LIST_INTERVENTIONS_QUERY_SCHEMA), this.List.bind(this));
    this.Router.get('/export/csv', Authenticate('backoffice'), this.ExportCsv.bind(this));
    this.Router.get('/export/excel', Authenticate('backoffice'), this.ExportExcel.bind(this));
    this.Router.get('/:id', Authenticate('backoffice'), this.GetById.bind(this));
    this.Router.post('/', Authenticate(), Validate(CREATE_INTERVENTION_SCHEMA), this.Create.bind(this));
    this.Router.put('/:id', Authenticate('backoffice'), Validate(UPDATE_INTERVENTION_SCHEMA), this.Update.bind(this));
    this.Router.post('/toggle-delete', Authenticate('backoffice'), Validate(TOGGLE_DELETE_SCHEMA), this.ToggleDelete.bind(this));

    // Mobile
    this.Router.get('/mobile/sync', Authenticate('mobile'), this.MobileSync.bind(this));
    this.Router.post('/mobile/sync', Authenticate('mobile'), this.MobileSyncUpload.bind(this));
  }


  // ─── Handlers ─────────────────────────────────────────────────────────

  private async List(req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this._ops.List(req.query as any);
      const { Data, Pagination } = result.Data;
      res.json({
        status: 'ok',
        data: {
          Items: Data,
          Total: Pagination.Total,
          Page: Pagination.Page,
          PageSize: Pagination.Limit,
          TotalPages: Pagination.Pages,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  private async Stats(_req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this._ops.GetStats();
      res.json({ status: 'ok', data: result.Data });
    } catch (err) {
      next(err);
    }
  }

  private async Recent(req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
      const result = await this._ops.GetRecent(limit);
      res.json({ status: 'ok', data: result.Data });
    } catch (err) {
      next(err);
    }
  }

  private async Dashboard(req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const interventionType = req.query.type ? parseInt(req.query.type as string, 10) : undefined;
      const result = await this._ops.GetAllForDashboard(interventionType);
      res.json({ status: 'ok', data: result.Data });
    } catch (err) {
      next(err);
    }
  }

  // ─── Dashboard charts (server-side aggregation + polynomial regression) ──

  private async DashboardCharts(req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = req.query;
      const result = await this._ops.GetChartBundle({
        interventionType: q.type ? parseInt(q.type as string, 10) : undefined,
        year: q.year ? parseInt(q.year as string, 10) : undefined,
        dateFrom: q.dateFrom as string | undefined,
        dateTo: q.dateTo as string | undefined,
        steamPrice: q.steamPrice ? parseFloat(q.steamPrice as string) : undefined,
        timeFrame: (q.timeFrame as string) || 'month',
      });
      res.json({ status: 'ok', data: result.Data });
    } catch (err) {
      next(err);
    }
  }

  private async GetById(req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this._ops.GetById(ParseId(req.params.id));
      res.json({ status: 'ok', data: result.Data });
    } catch (err) {
      next(err);
    }
  }

  private async MobileSync(req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Disable caching for sync endpoint — always return fresh data
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.removeHeader('ETag');

      // Derive team code from authenticated user — never trust client-supplied value
      let teamCode = '';
      if (req.User?.TeamId) {
        const team = await this._teamAdapter.FindById(req.User.TeamId);
        teamCode = team?.code ?? '';
      }
      const result = await this._ops.GetAllForMobile(teamCode);
      res.json({ status: 'ok', data: result.Data });
    } catch (err) {
      next(err);
    }
  }

  private async MobileSyncUpload(req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const context = RequestContext.FromRequest(req);
      const interventions = Array.isArray(req.body) ? req.body : [];
      const result = await this._ops.SyncFromMobile(interventions, context);
      res.json({ status: 'ok', data: result.Data });
    } catch (err) {
      next(err);
    }
  }

  private async Create(req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const context = RequestContext.FromRequest(req);
      const result = await this._ops.Create(req.body, context);
      res.status(201).json({ status: 'ok', data: result.Data });
    } catch (err) {
      next(err);
    }
  }

  private async Update(req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const context = RequestContext.FromRequest(req);
      const result = await this._ops.Update(ParseId(req.params.id), req.body, context);
      res.json({ status: 'ok', data: result.Data });
    } catch (err) {
      next(err);
    }
  }

  private async ToggleDelete(req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const context = RequestContext.FromRequest(req);
      const result = await this._ops.ToggleDelete(req.body, context);
      res.json({ status: 'ok', data: result.Data });
    } catch (err) {
      next(err);
    }
  }

  private async ExportCsv(req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const teamCode = req.query.teamCode as string | undefined;

      const separatorRaw = String(req.query.separator ?? ';');
      const separator: ',' | ';' = separatorRaw === ',' ? ',' : ';';

      const quoteModeRaw = String(req.query.quoteMode ?? 'always');
      const quoteMode: 'always' | 'auto' = quoteModeRaw === 'auto' ? 'auto' : 'always';

      const newlineRaw = String(req.query.newline ?? 'crlf');
      const newline: '\n' | '\r\n' = newlineRaw === 'lf' ? '\n' : '\r\n';

      const includeHeader = String(req.query.includeHeader ?? 'true').toLowerCase() === 'true';
      const includeBom = String(req.query.includeBom ?? 'true').toLowerCase() === 'true';

      const idsRaw = req.query.ids as string | undefined;
      const ids = idsRaw
        ? idsRaw.split(',').map((v) => parseInt(v.trim(), 10)).filter((v) => Number.isInteger(v) && v > 0)
        : undefined;

      const options: ExportCsvOptions = {
        Separator: separator,
        QuoteMode: quoteMode,
        NewLine: newline,
        IncludeHeader: includeHeader,
        IncludeBom: includeBom,
        Ids: ids && ids.length > 0 ? ids : undefined,
      };

      const result = await this._ops.ExportCsv(teamCode, options);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="interventions.csv"');
      res.send(result.Data);
    } catch (err) {
      next(err);
    }
  }

  private async ExportExcel(req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const teamCode = req.query.teamCode as string | undefined;
      const includeHeader = String(req.query.includeHeader ?? 'true').toLowerCase() === 'true';
      const autoFilter = String(req.query.autoFilter ?? 'true').toLowerCase() === 'true';

      const idsRaw = req.query.ids as string | undefined;
      const ids = idsRaw
        ? idsRaw.split(',').map((v) => parseInt(v.trim(), 10)).filter((v) => Number.isInteger(v) && v > 0)
        : undefined;

      const options: ExportExcelOptions = {
        IncludeHeader: includeHeader,
        AutoFilter: autoFilter,
        Ids: ids && ids.length > 0 ? ids : undefined,
      };

      const result = await this._ops.ExportExcel(teamCode, options);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="interventions.xlsx"');
      res.send(result.Data);
    } catch (err) {
      next(err);
    }
  }
}
