import type { DomainEvent, EventType } from '../Data/Types/Events';
import { Logger } from '../Utils/Logger';


const _log = Logger.child({ module: 'eventbus' });


// ─── Event Handler Signature ──────────────────────────────────────────────

type EventHandler = (event: DomainEvent) => void;


// ─── EventBus ──────────────────────────────────────────────────────────────

/**
 * Synchronous in-process event bus.
 * Handlers execute within the caller's context — keep them lightweight.
 * Each handler is defensively wrapped so a failing subscriber never
 * breaks the publishing operation.
 */
export class EventBus {

  private readonly _handlers = new Map<string, EventHandler[]>();
  private readonly _wildcardHandlers: EventHandler[] = [];


  // ─── Subscribe ─────────────────────────────────────────────────────

  /**
   * Register a handler for a specific event type, or '*' for all events.
   */
  Subscribe(eventType: EventType | '*', handler: EventHandler): void {
    if (eventType === '*') {
      this._wildcardHandlers.push(handler);
      return;
    }

    const list = this._handlers.get(eventType) ?? [];
    list.push(handler);
    this._handlers.set(eventType, list);
  }


  // ─── Publish ───────────────────────────────────────────────────────

  /**
   * Dispatch an event to all matching handlers.
   * Wildcard handlers run first, then type-specific handlers.
   * Errors are caught per-handler to ensure isolation.
   */
  Publish<T>(event: DomainEvent<T>): void {
    // Wildcard handlers
    for (const handler of this._wildcardHandlers) {
      try {
        handler(event as DomainEvent);
      } catch (err) {
        _log.error({ err, eventType: event.Type }, 'Wildcard event handler failed');
      }
    }

    // Type-specific handlers
    const handlers = this._handlers.get(event.Type) ?? [];
    for (const handler of handlers) {
      try {
        handler(event as DomainEvent);
      } catch (err) {
        _log.error({ err, eventType: event.Type }, 'Event handler failed');
      }
    }
  }
}
