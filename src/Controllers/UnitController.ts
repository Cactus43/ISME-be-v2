import type { FastifyInstance, FastifyReply } from 'fastify';
import type { IAuthenticatedRequest } from '../Data/Types/Http';
import type { IUnitOperations } from '../Data/Interfaces/IOperations';
import { RequestContext } from '../Data/Types/Contexts';
import { CREATE_UNIT_SCHEMA, UPDATE_UNIT_SCHEMA, type CreateUnitInput, type UpdateUnitInput } from '../Data/Schemas/Unit';
import { Authenticate, RequireRole } from '../Middleware/Authenticate';
import { Validate } from '../Middleware/Validate';
import { ParseId } from '../Utils/ParseId';


type ControllerHandler = (req: IAuthenticatedRequest, reply: FastifyReply) => Promise<void>;


// ─── Unit Controller ───────────────────────────────────────────────────────

export class UnitController {

  private readonly _ops: IUnitOperations;

  constructor({ UnitOperations }: { UnitOperations: IUnitOperations }) {
    this._ops = UnitOperations;
  }


  // ─── Route Registration ────────────────────────────────────────────────

  public RegisterRoutes(app: FastifyInstance): void {
    app.get('/mobile', { preHandler: [Authenticate('mobile')] }, this.Handle(this.GetAllMobile));
    app.get('/', { preHandler: [Authenticate('backoffice')] }, this.Handle(this.GetAll));
    app.get('/:id', { preHandler: [Authenticate('backoffice')] }, this.Handle(this.GetById));
    app.post('/', { preHandler: [Authenticate('backoffice'), RequireRole('admin', 'execution_manager'), Validate(CREATE_UNIT_SCHEMA)] }, this.Handle(this.Create));
    app.put('/:id', { preHandler: [Authenticate('backoffice'), RequireRole('admin', 'execution_manager'), Validate(UPDATE_UNIT_SCHEMA)] }, this.Handle(this.Update));
    app.delete('/:id', { preHandler: [Authenticate('backoffice'), RequireRole('admin', 'execution_manager')] }, this.Handle(this.Delete));
  }

  private Handle(handler: ControllerHandler) {
    return async (request: IAuthenticatedRequest, reply: FastifyReply): Promise<void> => {
      await handler.call(this, request, reply);
    };
  }


  // ─── Handlers ─────────────────────────────────────────────────────────

  private async GetAllMobile(_req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const result = await this._ops.GetAll();
    const slim = result.Data
      .filter((u) => u.IsActive)
      .map((u) => ({ id: u.Id, name: u.Name, teamId: u.TeamId }));
    reply.send({ status: 'ok', data: slim });
  }

  private async GetAll(_req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const result = await this._ops.GetAll();
    reply.send({ status: 'ok', data: result.Data });
  }

  private async GetById(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const result = await this._ops.GetById(ParseId((req.params as Record<string, string>).id));
    reply.send({ status: 'ok', data: result.Data });
  }

  private async Create(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const context = RequestContext.FromRequest(req);
    const result = await this._ops.Create(req.body as CreateUnitInput, context);
    reply.status(201).send({ status: 'ok', data: result.Data });
  }

  private async Update(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const context = RequestContext.FromRequest(req);
    const result = await this._ops.Update(ParseId((req.params as Record<string, string>).id), req.body as UpdateUnitInput, context);
    reply.send({ status: 'ok', data: result.Data });
  }

  private async Delete(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const context = RequestContext.FromRequest(req);
    await this._ops.Delete(ParseId((req.params as Record<string, string>).id), context);
    reply.send({ status: 'ok' });
  }
}
