import { Request } from 'express';


// ─── Authenticated Request ─────────────────────────────────────────────────

/**
 * Extended Express Request with authenticated user context.
 * Unified: both backoffice and mobile auth set req.User.
 * Set by the Authenticate middleware.
 */
export interface IAuthenticatedRequest extends Request {

  /** Authenticated user (any role — admin, viewer, operator) */
  User?: {
    Id: number;
    Firstname: string;
    Lastname: string;
    Email: string | null;
    Username: string | null;
    Role: 'admin' | 'viewer' | 'operator';
    TeamId: number | null;
    Lang: string;
  };

  /** Raw JWT token string */
  RawToken?: string;

  /** JWT signature (last segment) */
  RawTokenSignature?: string;

  /** Auth source channel */
  AuthSource?: 'backoffice' | 'mobile';
}
