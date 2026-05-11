import { createReadStream } from 'fs';
import { realpath, stat } from 'fs/promises';
import path from 'path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Config } from '../Config/Index';
import { Authenticate } from '../Middleware/Authenticate';


// ─── Images Controller (v1-compatible photo serving) ───────────────────────
// Serves photos from disk by filename convention: {tag}.jpg
// Files stored under Config.DataPath/photo_before/ and Config.DataPath/photo_after/

export class ImagesController {

  public RegisterRoutes(app: FastifyInstance): void {
    app.get('/photo_before/:name', { preHandler: [Authenticate()] }, async (request, reply) => {
      await this._servePhotoBefore(request, reply);
    });
    app.get('/photo_after/:name', { preHandler: [Authenticate()] }, async (request, reply) => {
      await this._servePhotoAfter(request, reply);
    });
  }

  private async _servePhotoBefore(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this._servePhoto(req, reply, 'photo_before');
  }

  private async _servePhotoAfter(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this._servePhoto(req, reply, 'photo_after');
  }

  private async _servePhoto(req: FastifyRequest, reply: FastifyReply, folder: string): Promise<void> {
    const name = (req.params as Record<string, string>).name;
    if (!name || path.basename(name) !== name || name.includes('\0')) {
      reply.status(404).send();
      return;
    }

    const dataRoot = path.resolve(Config.DataPath);
    const filePath = path.resolve(dataRoot, folder, name);
    const relativePath = path.relative(dataRoot, filePath);

    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      reply.status(403).send();
      return;
    }

    try {
      const [resolvedDataRoot, resolvedFilePath] = await Promise.all([
        realpath(dataRoot),
        realpath(filePath),
      ]);
      const normalizedRoot = resolvedDataRoot.endsWith(path.sep)
        ? resolvedDataRoot
        : `${resolvedDataRoot}${path.sep}`;

      if (!resolvedFilePath.startsWith(normalizedRoot)) {
        reply.status(403).send();
        return;
      }

      const fileStat = await stat(resolvedFilePath);
      if (!fileStat.isFile()) {
        reply.status(404).send();
        return;
      }

      reply.type(this._getMimeType(resolvedFilePath));
      reply.send(createReadStream(resolvedFilePath));
    } catch {
      reply.status(404).send();
    }
  }

  private _getMimeType(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();

    if (extension === '.png') return 'image/png';
    if (extension === '.gif') return 'image/gif';
    if (extension === '.webp') return 'image/webp';

    return 'image/jpeg';
  }
}
