import { Router, Response, NextFunction } from 'express';
import type { IAuthenticatedRequest } from '../Data/Types/Express';
import type { IMediaOperations } from '../Data/Interfaces/IOperations';
import { RequestContext } from '../Data/Types/Contexts';
import { Authenticate } from '../Middleware/Authenticate';
import { ParseId } from '../Utils/ParseId';


// ─── Media Controller ──────────────────────────────────────────────────────

export class MediaController {

  public readonly Router: Router;
  private readonly _ops: IMediaOperations;

  constructor({ MediaOperations }: { MediaOperations: IMediaOperations }) {
    this._ops = MediaOperations;
    this.Router = Router();
    this._registerRoutes();
  }


  // ─── Route Registration ────────────────────────────────────────────────

  private _registerRoutes(): void {
    this.Router.get('/intervention/:interventionId', Authenticate(), this.ListByIntervention.bind(this));
    this.Router.get('/:id/file', Authenticate(), this.GetFile.bind(this));
    this.Router.delete('/:id', Authenticate('backoffice'), this.Delete.bind(this));
  }


  // ─── Handlers ─────────────────────────────────────────────────────────

  private async GetFile(req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this._ops.GetFile(ParseId(req.params.id));
      res.setHeader('Content-Type', result.Data.MimeType);
      res.setHeader('Content-Disposition', `inline; filename="${result.Data.Filename}"`);
      res.sendFile(result.Data.FilePath);
    } catch (err) {
      next(err);
    }
  }

  private async ListByIntervention(req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this._ops.ListByIntervention(ParseId(req.params.interventionId, 'interventionId'));
      res.json({ status: 'ok', data: result.Data });
    } catch (err) {
      next(err);
    }
  }

  private async Delete(req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const context = RequestContext.FromRequest(req);
      await this._ops.Delete(ParseId(req.params.id), context);
      res.json({ status: 'ok' });
    } catch (err) {
      next(err);
    }
  }
}
