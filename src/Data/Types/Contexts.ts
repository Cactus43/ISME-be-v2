import type { IAuthenticatedRequest } from './Express';


// ─── RequestContext ────────────────────────────────────────────────────────

/**
 * Captures caller identity and transport metadata for operations.
 * Unified: UserId covers both backoffice users and operators (merged into users).
 */
export interface RequestContext {
  UserId: number | null;
  DeviceId: number | null;
  IpAddress: string | null;
  AuthSource: 'backoffice' | 'mobile' | null;
  UserAgent?: string;
}


// ─── Factory ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const RequestContext = {

  /**
   * Build a RequestContext from an authenticated Express request.
   */
  FromRequest(req: IAuthenticatedRequest): RequestContext {
    return {
      UserId: req.User?.Id ?? null,
      DeviceId: null,
      IpAddress: req.ip || req.socket?.remoteAddress || null,
      AuthSource: req.AuthSource ?? null,
      UserAgent: req.headers?.['user-agent'],
    };
  },

  /**
   * Empty context for system-initiated operations (cron, migration, etc.).
   */
  System(): RequestContext {
    return {
      UserId: null,
      DeviceId: null,
      IpAddress: null,
      AuthSource: null,
    };
  },
};
