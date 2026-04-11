import { createReadStream, existsSync } from 'fs';
import path from 'path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Config } from '../Config/Index';
import { Authenticate } from '../Middleware/Authenticate';


// ─── Images Controller (v1-compatible photo serving) ───────────────────────
// Serves photos from disk by filename convention: {tag}.jpg
// Files stored under Config.DataPath/fotoPerdita/ and Config.DataPath/fotoRiparazione/

export class ImagesController {

  public RegisterRoutes(app: FastifyInstance): void {
    app.get('/fotoPerdita/:name', { preHandler: [Authenticate()] }, async (request, reply) => {
      await this._serveFotoPerdita(request, reply);
    });
    app.get('/fotoRiparazione/:name', { preHandler: [Authenticate()] }, async (request, reply) => {
      await this._serveFotoRiparazione(request, reply);
    });
  }

  private async _serveFotoPerdita(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    this._servePhoto(req, reply, 'fotoPerdita');
  }

  private async _serveFotoRiparazione(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    this._servePhoto(req, reply, 'fotoRiparazione');
  }

  private _servePhoto(req: FastifyRequest, reply: FastifyReply, folder: string): void {
    const name = (req.params as Record<string, string>).name;
    if (!name) {
      reply.status(404).send();
      return;
    }

    const filePath = path.resolve(Config.DataPath, folder, name);
    const dataRoot = path.resolve(Config.DataPath);

    if (!filePath.startsWith(dataRoot)) {
      reply.status(403).send();
      return;
    }

    if (!existsSync(filePath)) {
      reply.status(404).send();
      return;
    }

    reply.type(this._getMimeType(filePath));
    reply.send(createReadStream(filePath));
  }

  private _getMimeType(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();

    if (extension === '.png') return 'image/png';
    if (extension === '.gif') return 'image/gif';
    if (extension === '.webp') return 'image/webp';

    return 'image/jpeg';
  }
}
