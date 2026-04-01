import { Router, Response, NextFunction } from 'express';
import type { IAuthenticatedRequest } from '../Data/Types/Express';
import type { ITeamOperations } from '../Data/Interfaces/IOperations';
import { RequestContext } from '../Data/Types/Contexts';
import { CREATE_TEAM_SCHEMA, UPDATE_TEAM_SCHEMA } from '../Data/Schemas/Team';
import { Authenticate } from '../Middleware/Authenticate';
import { Validate } from '../Middleware/Validate';
import { ParseId } from '../Utils/ParseId';


// ─── Team Controller ───────────────────────────────────────────────────────

export class TeamController {

  public readonly Router: Router;
  private readonly _ops: ITeamOperations;

  constructor({ TeamOperations }: { TeamOperations: ITeamOperations }) {
    this._ops = TeamOperations;
    this.Router = Router();
    this._registerRoutes();
  }


  // ─── Route Registration ────────────────────────────────────────────────

  private _registerRoutes(): void {
    // Mobile endpoint — returns only active teams (id, name, code)
    this.Router.get('/mobile', Authenticate('mobile'), this.GetAllMobile.bind(this));

    this.Router.get('/', Authenticate('backoffice'), this.GetAll.bind(this));
    this.Router.get('/:id', Authenticate('backoffice'), this.GetById.bind(this));
    this.Router.post('/', Authenticate('backoffice'), Validate(CREATE_TEAM_SCHEMA), this.Create.bind(this));
    this.Router.put('/:id', Authenticate('backoffice'), Validate(UPDATE_TEAM_SCHEMA), this.Update.bind(this));
    this.Router.delete('/:id', Authenticate('backoffice'), this.Delete.bind(this));
  }


  // ─── Handlers ─────────────────────────────────────────────────────────

  private async GetAllMobile(_req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this._ops.GetAll();
      // Return a slim payload for mobile/tablet clients
      const slim = result.Data
        .filter((t) => t.IsActive)
        .map((t) => ({ id: t.Id, name: t.Name, code: t.Code }));
      res.json({ status: 'ok', data: slim });
    } catch (err) {
      next(err);
    }
  }

  private async GetAll(_req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this._ops.GetAll();
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
