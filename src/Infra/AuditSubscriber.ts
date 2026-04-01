import type { Logger } from 'pino';
import type { DomainEvent } from '../Data/Types/Events';
import { AuditLogger, type AuditEntry } from '../Utils/AuditLogger';
import type { EventBus } from './EventBus';


/* ──────────────────────────────────────────────────────────────────
   AuditSubscriber — listens to all domain events and writes audit logs.
   Subscribes with '*' wildcard on the EventBus.
   ────────────────────────────────────────────────────────────────── */

export class AuditSubscriber {

  private readonly _audit: AuditLogger;

  constructor(Bus: EventBus, Log: Logger) {
    this._audit = new AuditLogger(Log.child({ module: 'AuditSubscriber' }));
    Bus.Subscribe('*', (event) => this._handle(event));
  }

  private _handle(event: DomainEvent): void {
    const Payload = event.Payload as Record<string, unknown> | undefined;

    // Resolve entity id from payload (first Id-like field found)
    const EntityId = (
      Payload?.InterventionId ?? Payload?.TeamId ?? Payload?.UserId ?? Payload?.MediaId ?? null
    ) as number | null;

    // Derive entity type from event name (e.g. 'Intervention.Created' → 'Intervention')
    const EntityType = event.Type.split('.')[0] ?? null;

    const Entry: AuditEntry = {
      Source: event.Source,
      Level: 'info',
      UserId: event.Context?.UserId ?? null,
      Action: event.Type,
      EntityType,
      EntityId,
      Message: (Payload?.Message as string) ?? null,
      Metadata: Payload ? { ...Payload } : null,
      IpAddress: event.Context?.IpAddress ?? null,
    };

    this._audit.Write(Entry);
  }
}
