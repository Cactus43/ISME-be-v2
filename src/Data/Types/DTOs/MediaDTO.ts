import type { MediaAttributes } from '../../Models/Media';


// ─── MediaDTO ──────────────────────────────────────────────────────────────

/**
 * Media projected for API consumption — storage_path is internal-only.
 */
export interface MediaDTO {
  Id: number;
  InterventionId: number;
  MediaType: 'photo_before' | 'photo_after' | 'document' | 'other';
  Filename: string;
  OriginalFilename: string | null;
  MimeType: string | null;
  FileSize: number | null;
  CreatedAt: Date;
}


// ─── Factory ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const MediaDTO = {

  FromModel(m: MediaAttributes): MediaDTO {
    return {
      Id: m.id,
      InterventionId: m.intervention_id,
      MediaType: m.media_type,
      Filename: m.filename,
      OriginalFilename: m.original_filename,
      MimeType: m.mime_type,
      FileSize: m.file_size,
      CreatedAt: m.created_at,
    };
  },
};
