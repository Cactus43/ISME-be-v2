import type { FastifyRequest } from 'fastify';


// ─── Authenticated Request ─────────────────────────────────────────────────

export interface IAuthenticatedRequest extends FastifyRequest {

  User?: {
    Id: number;
    Firstname: string;
    Lastname: string;
    Email: string | null;
    Username: string | null;
    Role: 'admin' | 'approval_manager' | 'execution_manager' | 'operator' | 'viewer';
    TeamId: number | null;
    Lang: string;
  };

  RawToken?: string;
  RawTokenSignature?: string;
  AuthSource?: 'backoffice' | 'mobile';
}