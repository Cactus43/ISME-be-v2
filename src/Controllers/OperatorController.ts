import { Router, Response, NextFunction } from 'express';
import type { IAuthenticatedRequest } from '../Data/Types/Express';
import type { IOperatorOperations } from '../Data/Interfaces/IOperations';
import { RequestContext } from '../Data/Types/Contexts';
import { CREATE_OPERATOR_SCHEMA, UPDATE_OPERATOR_SCHEMA } from '../Data/Schemas/Operator';
import { Authenticate } from '../Middleware/Authenticate';
import { Validate } from '../Middleware/Validate';
import { ParseId } from '../Utils/ParseId';


// ─── Operator Controller ───────────────────────────────────────────────────

export class OperatorController {

  public readonly Router: Router;
  private readonly _ops: IOperatorOperations;

  constructor({ OperatorOperations }: { OperatorOperations: IOperatorOperations }) {
    this._ops = OperatorOperations;
    this.Router = Router();
    this._registerRoutes();
  }


  // ─── Route Registration ────────────────────────────────────────────────

  private _registerRoutes(): void {
    this.Router.get('/', Authenticate('backoffice'), this.GetAll.bind(this));
    this.Router.get('/:id', Authenticate('backoffice'), this.GetById.bind(this));
    this.Router.post('/', Authenticate('backoffice'), Validate(CREATE_OPERATOR_SCHEMA), this.Create.bind(this));
    this.Router.put('/:id', Authenticate('backoffice'), Validate(UPDATE_OPERATOR_SCHEMA), this.Update.bind(this));
    this.Router.delete('/:id', Authenticate('backoffice'), this.Delete.bind(this));
  }


  // ─── Handlers ─────────────────────────────────────────────────────────

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
