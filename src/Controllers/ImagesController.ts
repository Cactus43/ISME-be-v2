import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { Config } from '../Config/Index';
import { Authenticate } from '../Middleware/Authenticate';


// ─── Images Controller (v1-compatible photo serving) ───────────────────────
// Serves photos from disk by filename convention: {tag}.jpg
// Files stored under Config.DataPath/fotoPerdita/ and Config.DataPath/fotoRiparazione/

export class ImagesController {

  public readonly Router: Router;

  constructor() {
    this.Router = Router();
    this._registerRoutes();
  }

  private _registerRoutes(): void {
    this.Router.get('/fotoPerdita/:name', Authenticate(), this._serveFotoPerdita.bind(this));
    this.Router.get('/fotoRiparazione/:name', Authenticate(), this._serveFotoRiparazione.bind(this));
  }

  private async _serveFotoPerdita(req: Request, res: Response, next: NextFunction): Promise<void> {
    this._servePhoto(req, res, next, 'fotoPerdita');
  }

  private async _serveFotoRiparazione(req: Request, res: Response, next: NextFunction): Promise<void> {
    this._servePhoto(req, res, next, 'fotoRiparazione');
  }

  private _servePhoto(req: Request, res: Response, next: NextFunction, folder: string): void {
    try {
      const name = req.params.name as string;
      if (!name) { res.sendStatus(404); return; }

      const filePath = path.resolve(Config.DataPath, folder, name);

      // Security: ensure resolved path stays within DataPath
      if (!filePath.startsWith(path.resolve(Config.DataPath))) {
        res.sendStatus(403);
        return;
      }

      if (!fs.existsSync(filePath)) { res.sendStatus(404); return; }

      res.sendFile(filePath);
    } catch (err) {
      next(err);
    }
  }
}
