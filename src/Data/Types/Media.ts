export type MediaSlot = 'photo_before' | 'photo_after';

export const MEDIA_SLOTS: readonly MediaSlot[] = ['photo_before', 'photo_after'] as const;

export interface UploadedMediaFile {
  Buffer: Buffer;
  OriginalName: string;
  MimeType: string;
  Size: number;
}
