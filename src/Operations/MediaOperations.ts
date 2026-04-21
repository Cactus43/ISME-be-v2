import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import type { Logger } from 'pino';
import type { IMediaAdapter, IInterventionAdapter } from '../Data/Interfaces/IAdapter';
import type { IMediaOperations } from '../Data/Interfaces/IOperations';
import type { MediaAttributes } from '../Data/Models/Media';
import type { RequestContext } from '../Data/Types/Contexts';
import { MediaDTO } from '../Data/Types/DTOs/MediaDTO';
import { OperationResult } from '../Data/Types/OperationResult';
import { NotFoundError } from '../Data/Exceptions/Index';
import { Config } from '../Config/Index';
import type { EventBus } from '../Infra/EventBus';
import type { MediaSlot, UploadedMediaFile } from '../Data/Types/Media';
import { BuildMediaStorageTarget } from '../Utils/MediaStorage';


// ─── MediaOperations ───────────────────────────────────────────────────────

export class MediaOperations implements IMediaOperations {

  private readonly _mediaAdapter: IMediaAdapter;
  private readonly _interventionAdapter: IInterventionAdapter;
  private readonly _log: Logger;
  private readonly _eventBus: EventBus;

  constructor({
    MediaAdapter,
    InterventionAdapter,
    Logger,
    EventBus: Bus,
  }: {
    MediaAdapter: IMediaAdapter;
    InterventionAdapter: IInterventionAdapter;
    Logger: Logger;
    EventBus: EventBus;
  }) {
    this._mediaAdapter = MediaAdapter;
    this._interventionAdapter = InterventionAdapter;
    this._log = Logger;
    this._eventBus = Bus;
  }

  async GetFile(id: number): Promise<OperationResult<{ FilePath: string; MimeType: string; Filename: string; Size: number }>> {
    const media = await this._mediaAdapter.FindById(id);
    if (!media) throw new NotFoundError('Media not found');

    const filePath = path.resolve(Config.DataPath, media.storage_path);
    if (!filePath.startsWith(path.resolve(Config.DataPath))) {
      throw new NotFoundError('Invalid file path');
    }
    if (!fs.existsSync(filePath)) throw new NotFoundError('File not found on disk');

    const stats = fs.statSync(filePath);
    if (!stats.isFile()) throw new NotFoundError('File not found on disk');

    return OperationResult.Ok({
      FilePath: filePath,
      MimeType: media.mime_type ?? 'application/octet-stream',
      Filename: media.filename,
      Size: stats.size,
    });
  }

  async ListByIntervention(interventionId: number): Promise<OperationResult<MediaDTO[]>> {
    const rows = await this._mediaAdapter.FindByInterventionId(interventionId);
    return OperationResult.Ok(rows.map(MediaDTO.FromModel));
  }

  async UploadForIntervention(
    interventionId: number,
    slot: MediaSlot,
    file: UploadedMediaFile,
    context: RequestContext,
  ): Promise<OperationResult<MediaDTO>> {
    const intervention = await this._interventionAdapter.FindById(interventionId);
    if (!intervention) throw new NotFoundError('Intervention not found');

    const target = BuildMediaStorageTarget(interventionId, slot, file);
    const existing = await this._mediaAdapter.FindActiveByInterventionAndType(interventionId, slot);

    await fsPromises.mkdir(path.dirname(target.AbsolutePath), { recursive: true });
    await fsPromises.writeFile(target.AbsolutePath, file.Buffer);

    let saved: MediaAttributes | null;

    if (existing) {
      const previousPath = path.resolve(Config.DataPath, existing.storage_path);

      saved = await this._mediaAdapter.Update(existing.id, {
        filename: target.Filename,
        original_filename: file.OriginalName || null,
        mime_type: file.MimeType,
        file_size: file.Size,
        storage_path: target.StoragePath,
        updated_by: context.UserId,
      });

      if (previousPath !== target.AbsolutePath && fs.existsSync(previousPath)) {
        await fsPromises.rm(previousPath, { force: true });
      }
    } else {
      saved = await this._mediaAdapter.Create({
        intervention_id: interventionId,
        media_type: slot,
        filename: target.Filename,
        original_filename: file.OriginalName || null,
        mime_type: file.MimeType,
        file_size: file.Size,
        storage_path: target.StoragePath,
        created_by: context.UserId,
        updated_by: context.UserId,
        device_id: context.DeviceId,
      });
    }

    if (!saved) {
      throw new NotFoundError('Media could not be saved');
    }

    await this._touchIntervention(interventionId, context.UserId);
    this._log.info({ interventionId, slot, mediaId: saved.id }, 'Media uploaded');
    return OperationResult.Ok(MediaDTO.FromModel(saved));
  }

  async Delete(id: number, context: RequestContext): Promise<OperationResult<void>> {
    const media = await this._mediaAdapter.FindById(id);
    if (!media) throw new NotFoundError('Media not found');

    await this._mediaAdapter.SoftDelete(id, context.UserId);
    await this._touchIntervention(media.intervention_id, context.UserId);
    this._log.info({ mediaId: id }, 'Media soft-deleted');
    this._eventBus.Publish({ Type: 'Media.Deleted', Source: 'backoffice', Timestamp: new Date(), Context: context, Payload: { MediaId: id, InterventionId: media.intervention_id } });
    return OperationResult.Void();
  }

  private async _touchIntervention(interventionId: number, userId: number | null): Promise<void> {
    await this._interventionAdapter.Update(interventionId, {
      updated_at: new Date(),
      updated_by: userId,
    });
  }
}
