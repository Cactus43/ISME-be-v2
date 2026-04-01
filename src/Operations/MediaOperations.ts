import path from 'path';
import fs from 'fs';
import type { Logger } from 'pino';
import type { IMediaAdapter } from '../Data/Interfaces/IAdapter';
import type { IMediaOperations } from '../Data/Interfaces/IOperations';
import type { RequestContext } from '../Data/Types/Contexts';
import { MediaDTO } from '../Data/Types/DTOs/MediaDTO';
import { OperationResult } from '../Data/Types/OperationResult';
import { NotFoundError } from '../Data/Exceptions/Index';
import { Config } from '../Config/Index';
import type { EventBus } from '../Infra/EventBus';


// ─── MediaOperations ───────────────────────────────────────────────────────

export class MediaOperations implements IMediaOperations {

  private readonly _mediaAdapter: IMediaAdapter;
  private readonly _log: Logger;
  private readonly _eventBus: EventBus;

  constructor({
    MediaAdapter,
    Logger,
    EventBus: Bus,
  }: {
    MediaAdapter: IMediaAdapter;
    Logger: Logger;
    EventBus: EventBus;
  }) {
    this._mediaAdapter = MediaAdapter;
    this._log = Logger;
    this._eventBus = Bus;
  }

  async GetFile(id: number): Promise<OperationResult<{ FilePath: string; MimeType: string; Filename: string }>> {
    const media = await this._mediaAdapter.FindById(id);
    if (!media) throw new NotFoundError('Media not found');

    const filePath = path.resolve(Config.DataPath, media.storage_path);
    if (!filePath.startsWith(path.resolve(Config.DataPath))) {
      throw new NotFoundError('Invalid file path');
    }
    if (!fs.existsSync(filePath)) throw new NotFoundError('File not found on disk');

    return OperationResult.Ok({
      FilePath: filePath,
      MimeType: media.mime_type ?? 'application/octet-stream',
      Filename: media.filename,
    });
  }

  async ListByIntervention(interventionId: number): Promise<OperationResult<MediaDTO[]>> {
    const rows = await this._mediaAdapter.FindByInterventionId(interventionId);
    return OperationResult.Ok(rows.map(MediaDTO.FromModel));
  }

  async Delete(id: number, context: RequestContext): Promise<OperationResult<void>> {
    const media = await this._mediaAdapter.FindById(id);
    if (!media) throw new NotFoundError('Media not found');

    await this._mediaAdapter.SoftDelete(id, context.UserId);
    this._log.info({ mediaId: id }, 'Media soft-deleted');
    this._eventBus.Publish({ Type: 'Media.Deleted', Source: 'backoffice', Timestamp: new Date(), Context: context, Payload: { MediaId: id, InterventionId: media.intervention_id } });
    return OperationResult.Void();
  }
}
