import path from 'path';
import { Config } from '../Config/Index';
import { BadRequestError } from '../Data/Exceptions/Index';
import type { MediaSlot, UploadedMediaFile } from '../Data/Types/Media';

const MEDIA_SLOT_FOLDERS: Record<MediaSlot, string> = {
  photo_before: 'photo_before',
  photo_after: 'photo_after',
};

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

function ResolveExtension(originalName: string, mimeType: string): string {
  const normalizedMime = mimeType.toLowerCase();
  if (MIME_EXTENSION_MAP[normalizedMime]) return MIME_EXTENSION_MAP[normalizedMime];

  const ext = path.extname(originalName).toLowerCase();
  if (ext) return ext;

  return '.jpg';
}

export function BuildMediaStorageTarget(interventionId: number, slot: MediaSlot, file: UploadedMediaFile): {
  Filename: string;
  StoragePath: string;
  AbsolutePath: string;
} {
  const extension = ResolveExtension(file.OriginalName, file.MimeType);
  const folder = MEDIA_SLOT_FOLDERS[slot];
  const filename = `${interventionId}_${slot}${extension}`;
  const storagePath = `${folder}/${filename}`;
  const dataRoot = path.resolve(Config.DataPath);
  const absolutePath = path.resolve(dataRoot, storagePath);
  const relativePath = path.relative(dataRoot, absolutePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new BadRequestError('Invalid media storage path');
  }

  return {
    Filename: filename,
    StoragePath: storagePath,
    AbsolutePath: absolutePath,
  };
}

export function DecodeBase64Image(base64Data: string): UploadedMediaFile {
  const trimmed = base64Data.trim();
  const match = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);

  const mimeType = match?.[1]?.toLowerCase() ?? 'image/jpeg';
  const rawBase64 = match?.[2] ?? trimmed;
  const buffer = Buffer.from(rawBase64, 'base64');

  if (!buffer.length) {
    throw new BadRequestError('Empty image payload');
  }

  const extension = ResolveExtension('', mimeType);

  return {
    Buffer: buffer,
    MimeType: mimeType,
    OriginalName: `upload${extension}`,
    Size: buffer.length,
  };
}
