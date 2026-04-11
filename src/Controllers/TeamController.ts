import type { FastifyInstance, FastifyReply } from 'fastify';
import type { IAuthenticatedRequest } from '../Data/Types/Http';
import type { ITeamOperations } from '../Data/Interfaces/IOperations';
import { RequestContext } from '../Data/Types/Contexts';
import { CREATE_TEAM_SCHEMA, UPDATE_TEAM_SCHEMA, type CreateTeamInput, type UpdateTeamInput } from '../Data/Schemas/Team';
import { Authenticate } from '../Middleware/Authenticate';
import { Validate } from '../Middleware/Validate';
import { ParseId } from '../Utils/ParseId';


type ControllerHandler = (req: IAuthenticatedRequest, reply: FastifyReply) => Promise<void>;


// ─── Team Controller ───────────────────────────────────────────────────────

export class TeamController {

  private readonly _ops: ITeamOperations;

  constructor({ TeamOperations }: { TeamOperations: ITeamOperations }) {
    this._ops = TeamOperations;
  }


  // ─── Route Registration ────────────────────────────────────────────────

  public RegisterRoutes(app: FastifyInstance): void {
    // Mobile endpoint — returns only active teams (id, name, code)
    app.get('/mobile', { preHandler: [Authenticate('mobile')] }, this.Handle(this.GetAllMobile));

    app.get('/', { preHandler: [Authenticate('backoffice')] }, this.Handle(this.GetAll));
    app.get('/:id', { preHandler: [Authenticate('backoffice')] }, this.Handle(this.GetById));
    app.post('/', { preHandler: [Authenticate('backoffice'), Validate(CREATE_TEAM_SCHEMA)] }, this.Handle(this.Create));
    app.put('/:id', { preHandler: [Authenticate('backoffice'), Validate(UPDATE_TEAM_SCHEMA)] }, this.Handle(this.Update));
    app.delete('/:id', { preHandler: [Authenticate('backoffice')] }, this.Handle(this.Delete));
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
      .filter((t) => t.IsActive)
      .map((t) => ({ id: t.Id, name: t.Name, code: t.Code }));
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
    const result = await this._ops.Create(req.body as CreateTeamInput, context);
    reply.status(201).send({ status: 'ok', data: result.Data });
  }

  private async Update(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const context = RequestContext.FromRequest(req);
    const result = await this._ops.Update(ParseId((req.params as Record<string, string>).id), req.body as UpdateTeamInput, context);
    reply.send({ status: 'ok', data: result.Data });
  }

  private async Delete(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const context = RequestContext.FromRequest(req);
    await this._ops.Delete(ParseId((req.params as Record<string, string>).id), context);
    reply.send({ status: 'ok' });
  }
}
