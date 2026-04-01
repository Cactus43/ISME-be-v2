import type { RequestContext } from './Contexts';


// ─── Event Type Registry ──────────────────────────────────────────────────

export type EventType =
  // Intervention lifecycle
  | 'Intervention.Created'
  | 'Intervention.Updated'
  | 'Intervention.Deleted'
  | 'Intervention.Restored'
  // Team lifecycle
  | 'Team.Created'
  | 'Team.Updated'
  | 'Team.Deleted'
  // User lifecycle (replaces Operator.*)
  | 'User.Created'
  | 'User.Updated'
  | 'User.Deleted'
  // Media lifecycle
  | 'Media.Deleted'
  // Auth events
  | 'Auth.BackofficeLogin'
  | 'Auth.BackofficeLogout'
  | 'Auth.BackofficeLoginFailed'
  | 'Auth.MobileLogin'
  | 'Auth.MobileLogout'
  | 'Auth.MobileLoginFailed';


// ─── Domain Event Envelope ─────────────────────────────────────────────────

export interface DomainEvent<T = unknown> {
  Type: EventType;
  Source: 'backoffice' | 'mobile' | 'system';
  Timestamp: Date;
  Payload: T;
  Context?: RequestContext;
}


// ─── Typed Payloads ────────────────────────────────────────────────────────

export interface InterventionCreatedPayload {
  InterventionId: number;
  Tag: string;
  Message: string;
}

export interface InterventionUpdatedPayload {
  InterventionId: number;
  Fields: string[];
  Message?: string;
}

export interface InterventionDeletedPayload {
  InterventionIds: number[];
  Deleted: boolean;
  Affected: number;
  Message: string;
}

export interface TeamCreatedPayload {
  TeamId: number;
  Code: string;
  Message: string;
}

export interface TeamUpdatedPayload {
  TeamId: number;
  Fields: string[];
}

export interface TeamDeletedPayload {
  TeamId: number;
}

export interface UserCreatedPayload {
  UserId: number;
  Username: string | null;
  Email: string | null;
  Role: string;
  Message: string;
}

export interface UserUpdatedPayload {
  UserId: number;
  Fields: string[];
}

export interface UserDeletedPayload {
  UserId: number;
}

export interface MediaDeletedPayload {
  MediaId: number;
  InterventionId: number;
}

export interface AuthLoginPayload {
  Email?: string;
  Username?: string;
  Message: string;
}

export interface AuthLogoutPayload {
  Message: string;
}

export interface AuthLoginFailedPayload {
  Email?: string;
  Username?: string;
  Reason: string;
  Message: string;
}
