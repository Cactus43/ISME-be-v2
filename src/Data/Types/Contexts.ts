import type { IAuthenticatedRequest } from './Http';


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
   * Build a RequestContext from an authenticated HTTP request.
   */
  FromRequest(req: IAuthenticatedRequest): RequestContext {
    const userAgent = req.headers['user-agent'];

    return {
      UserId: req.User?.Id ?? null,
      DeviceId: null,
      IpAddress: req.ip || req.socket?.remoteAddress || null,
      AuthSource: req.AuthSource ?? null,
      UserAgent: Array.isArray(userAgent) ? userAgent.join(', ') : userAgent,
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
