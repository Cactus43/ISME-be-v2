import type { Logger } from 'pino';
import { Log } from '../Data/Models/Log';


/* ──────────────────────────────────────────────────────────────────
   AuditLogger — writes structured audit entries to the logs table.
   ────────────────────────────────────────────────────────────────── */

export interface AuditEntry {
  Source: 'backoffice' | 'mobile' | 'system';
  Level: 'info' | 'warn' | 'error' | 'debug';
  UserId: number | null;
  DeviceId?: number | null;
  Action: string;
  EntityType: string | null;
  EntityId: number | null;
  Message: string | null;
  Metadata?: object | null;
  IpAddress?: string | null;
}

export class AuditLogger {

  private readonly _log: Logger;

  constructor(Log: Logger) {
    this._log = Log;
  }

  async Write(Entry: AuditEntry): Promise<void> {
    try {
      await Log.create({
        source: Entry.Source,
        level: Entry.Level,
        user_id: Entry.UserId,
        device_id: Entry.DeviceId ?? null,
        action: Entry.Action,
        entity_type: Entry.EntityType,
        entity_id: Entry.EntityId,
        message: Entry.Message,
        metadata: Entry.Metadata ?? null,
        ip_address: Entry.IpAddress ?? null,
      });
    } catch (err) {
      this._log.error({ err, Entry }, 'Failed to write audit log');
    }
  }
}
