import type { FastifyInstance, FastifyReply } from 'fastify';
import type { IAuthenticatedRequest } from '../Data/Types/Http';
import type { IOperatorOperations } from '../Data/Interfaces/IOperations';
import { RequestContext } from '../Data/Types/Contexts';
import { CREATE_OPERATOR_SCHEMA, UPDATE_OPERATOR_SCHEMA, type CreateOperatorInput, type UpdateOperatorInput } from '../Data/Schemas/Operator';
import { Authenticate } from '../Middleware/Authenticate';
import { Validate } from '../Middleware/Validate';
import { ParseId } from '../Utils/ParseId';


type ControllerHandler = (req: IAuthenticatedRequest, reply: FastifyReply) => Promise<void>;


// ─── Operator Controller ───────────────────────────────────────────────────

export class OperatorController {

  private readonly _ops: IOperatorOperations;

  constructor({ OperatorOperations }: { OperatorOperations: IOperatorOperations }) {
    this._ops = OperatorOperations;
  }


  // ─── Route Registration ────────────────────────────────────────────────

  public RegisterRoutes(app: FastifyInstance): void {
    app.get('/', { preHandler: [Authenticate('backoffice')] }, this.Handle(this.GetAll));
    app.get('/:id', { preHandler: [Authenticate('backoffice')] }, this.Handle(this.GetById));
    app.post('/', { preHandler: [Authenticate('backoffice'), Validate(CREATE_OPERATOR_SCHEMA)] }, this.Handle(this.Create));
    app.put('/:id', { preHandler: [Authenticate('backoffice'), Validate(UPDATE_OPERATOR_SCHEMA)] }, this.Handle(this.Update));
    app.delete('/:id', { preHandler: [Authenticate('backoffice')] }, this.Handle(this.Delete));
  }

  private Handle(handler: ControllerHandler) {
    return async (request: IAuthenticatedRequest, reply: FastifyReply): Promise<void> => {
      await handler.call(this, request, reply);
    };
  }


  // ─── Handlers ─────────────────────────────────────────────────────────

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
    const result = await this._ops.Create(req.body as CreateOperatorInput, context);
    reply.status(201).send({ status: 'ok', data: result.Data });
  }

  private async Update(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const context = RequestContext.FromRequest(req);
    const result = await this._ops.Update(ParseId((req.params as Record<string, string>).id), req.body as UpdateOperatorInput, context);
    reply.send({ status: 'ok', data: result.Data });
  }

  private async Delete(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const context = RequestContext.FromRequest(req);
    await this._ops.Delete(ParseId((req.params as Record<string, string>).id), context);
    reply.send({ status: 'ok' });
  }
}
