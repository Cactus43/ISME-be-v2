import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import type { IAuthenticatedRequest } from '../Data/Types/Express';
import type { IMediaOperations } from '../Data/Interfaces/IOperations';
import { RequestContext } from '../Data/Types/Contexts';
import { Authenticate } from '../Middleware/Authenticate';
import { ParseId } from '../Utils/ParseId';
import { BadRequestError } from '../Data/Exceptions/Index';
import { MEDIA_SLOTS, type MediaSlot } from '../Data/Types/Media';


// ─── Media Controller ──────────────────────────────────────────────────────

export class MediaController {

  public readonly Router: Router;
  private readonly _ops: IMediaOperations;
  private readonly _upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        cb(new BadRequestError('Only image uploads are allowed'));
        return;
      }
      cb(null, true);
    },
  });

  constructor({ MediaOperations }: { MediaOperations: IMediaOperations }) {
    this._ops = MediaOperations;
    this.Router = Router();
    this._registerRoutes();
  }


  // ─── Route Registration ────────────────────────────────────────────────

  private _registerRoutes(): void {
    this.Router.get('/intervention/:interventionId', Authenticate(), this.ListByIntervention.bind(this));
    this.Router.post('/intervention/:interventionId/slot/:slot', Authenticate(), this._upload.single('file'), this.UploadForIntervention.bind(this));
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

  private async UploadForIntervention(req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const slot = this._parseSlot(String(req.params.slot));
      const file = req.file;

      if (!file) {
        throw new BadRequestError('File is required');
      }

      const context = RequestContext.FromRequest(req);
      const result = await this._ops.UploadForIntervention(
        ParseId(req.params.interventionId, 'interventionId'),
        slot,
        {
          Buffer: file.buffer,
          OriginalName: file.originalname,
          MimeType: file.mimetype,
          Size: file.size,
        },
        context,
      );

      res.status(201).json({ status: 'ok', data: result.Data });
    } catch (err) {
      next(err);
    }
  }

  private _parseSlot(value: string): MediaSlot {
    if ((MEDIA_SLOTS as readonly string[]).includes(value)) {
      return value as MediaSlot;
    }

    throw new BadRequestError('Invalid media slot');
  }
}
