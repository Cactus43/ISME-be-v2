import { createReadStream } from 'fs';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { IAuthenticatedRequest } from '../Data/Types/Http';
import type { IMediaOperations } from '../Data/Interfaces/IOperations';
import { RequestContext } from '../Data/Types/Contexts';
import { Authenticate } from '../Middleware/Authenticate';
import { ParseId } from '../Utils/ParseId';
import { BadRequestError } from '../Data/Exceptions/Index';
import { MEDIA_SLOTS, type MediaSlot } from '../Data/Types/Media';


type ControllerHandler = (req: IAuthenticatedRequest, reply: FastifyReply) => Promise<void>;


// ─── Media Controller ──────────────────────────────────────────────────────

export class MediaController {

  private readonly _ops: IMediaOperations;

  constructor({ MediaOperations }: { MediaOperations: IMediaOperations }) {
    this._ops = MediaOperations;
  }


  // ─── Route Registration ────────────────────────────────────────────────

  public RegisterRoutes(app: FastifyInstance): void {
    app.get('/intervention/:interventionId', { preHandler: [Authenticate()] }, this.Handle(this.ListByIntervention));
    app.post('/intervention/:interventionId/slot/:slot', { preHandler: [Authenticate()] }, this.Handle(this.UploadForIntervention));
    app.get('/:id/file', { preHandler: [Authenticate()] }, this.Handle(this.GetFile));
    app.delete('/:id', { preHandler: [Authenticate('backoffice')] }, this.Handle(this.Delete));
  }

  private Handle(handler: ControllerHandler) {
    return async (request: IAuthenticatedRequest, reply: FastifyReply): Promise<void> => {
      await handler.call(this, request, reply);
    };
  }


  // ─── Handlers ─────────────────────────────────────────────────────────

  private async GetFile(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const result = await this._ops.GetFile(ParseId((req.params as Record<string, string>).id));
    reply.header('Content-Type', result.Data.MimeType);
    reply.header('Content-Disposition', `inline; filename="${result.Data.Filename}"`);
    reply.send(createReadStream(result.Data.FilePath));
  }

  private async ListByIntervention(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const params = req.params as Record<string, string>;
    const result = await this._ops.ListByIntervention(ParseId(params.interventionId, 'interventionId'));
    reply.send({ status: 'ok', data: result.Data });
  }

  private async Delete(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const context = RequestContext.FromRequest(req);
    await this._ops.Delete(ParseId((req.params as Record<string, string>).id), context);
    reply.send({ status: 'ok' });
  }

  private async UploadForIntervention(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const params = req.params as Record<string, string>;
    const slot = this._parseSlot(String(params.slot));
    const file = await req.file();

    if (!file) {
      throw new BadRequestError('File is required');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestError('Only image uploads are allowed');
    }

    const buffer = await file.toBuffer();
    const context = RequestContext.FromRequest(req);
    const result = await this._ops.UploadForIntervention(
      ParseId(params.interventionId, 'interventionId'),
      slot,
      {
        Buffer: buffer,
        OriginalName: file.filename,
        MimeType: file.mimetype,
        Size: buffer.length,
      },
      context,
    );

    reply.status(201).send({ status: 'ok', data: result.Data });
  }

  private _parseSlot(value: string): MediaSlot {
    if ((MEDIA_SLOTS as readonly string[]).includes(value)) {
      return value as MediaSlot;
    }

    throw new BadRequestError('Invalid media slot');
  }
}
