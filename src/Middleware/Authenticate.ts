import type { FastifyReply, FastifyRequest } from 'fastify';
import type { IAuthenticatedRequest } from '../Data/Types/Http';
import { AccessToken } from '../Data/Models/AccessToken';
import { User } from '../Data/Models/User';
import { JwtSignature } from '../Utils/Crypto';


/* ──────────────────────────────────────────────────────────────────
   Authenticate — resolves active token → populates req.User.
   Supports two authentication flows:
     • backoffice  →  cookie-based JWT signature
     • mobile      →  Bearer token signature
   When called with no argument, accepts either flow (tries cookie first).
   Both paths query the unified access_tokens table with a source filter.
   ────────────────────────────────────────────────────────────────── */

export function Authenticate(Source?: 'backoffice' | 'mobile') {

  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const request = req as IAuthenticatedRequest;

    // ── Extract signature from transport (try both when no Source) ──
    let RawToken: string | undefined;
    let ResolvedSource: 'backoffice' | 'mobile' | undefined;

    if (!Source || Source === 'backoffice') {
      const CookieValue = request.cookies?.['session'];
      if (CookieValue) {
        RawToken = CookieValue;
        ResolvedSource = 'backoffice';
      }
    }

    if (!RawToken && (!Source || Source === 'mobile')) {
      const Header = request.headers.authorization;
      if (Header?.startsWith('Bearer ')) {
        RawToken = Header.slice(7);
        ResolvedSource = 'mobile';
      }
    }

    if (!RawToken || !ResolvedSource) {
      console.log('[Auth] 401 Authentication required |', request.method, request.raw.url, '| authHeader:', request.headers.authorization?.slice(0, 30) ?? 'NONE', '| source:', Source ?? 'any');
      reply.status(401).send({ Error: 'Authentication required' });
      return;
    }

    // Extract the JWT signature part (third segment) for DB lookup
    const Signature = JwtSignature(RawToken);

    if (!Signature) {
      console.log('[Auth] 401 Malformed token |', request.method, request.raw.url, '| tokenLen:', RawToken.length, '| parts:', RawToken.split('.').length);
      reply.status(401).send({ Error: 'Malformed token' });
      return;
    }

    // ── Look up active (non-revoked, non-expired) token ──
    const TokenRecord = await AccessToken.findOne({
      where: {
        signature: Signature,
        source: ResolvedSource,
        revoked_at: null,
      },
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['id', 'firstname', 'lastname', 'email', 'username', 'role', 'team_id', 'lang'],
        },
      ],
    });

    if (!TokenRecord || !TokenRecord.User) {
      // Diagnostic: check if the signature exists at all (maybe revoked or wrong source)
      const anyRecord = await AccessToken.findOne({ where: { signature: Signature }, attributes: ['id', 'source', 'revoked_at', 'expires_at'] });
      console.log('[Auth] 401 Invalid or expired session |', request.method, request.raw.url,
        '| sig:', Signature.slice(0, 12) + '...',
        '| resolvedSource:', ResolvedSource,
        '| anyRecordInDB:', anyRecord ? `id=${anyRecord.id} source=${anyRecord.source} revoked=${anyRecord.revoked_at} expires=${anyRecord.expires_at}` : 'NONE');
      reply.status(401).send({ Error: 'Invalid or expired session' });
      return;
    }

    if (new Date(TokenRecord.expires_at) < new Date()) {
      console.log('[Auth] 401 Session expired |', request.method, request.raw.url,
        '| sig:', Signature.slice(0, 12) + '...',
        '| expiresAt:', TokenRecord.expires_at,
        '| now:', new Date().toISOString());
      reply.status(401).send({ Error: 'Session expired' });
      return;
    }

    // ── Populate request context (unified for both flows) ──
    request.User = {
      Id: TokenRecord.User.id,
      Firstname: TokenRecord.User.firstname,
      Lastname: TokenRecord.User.lastname,
      Email: TokenRecord.User.email,
      Username: TokenRecord.User.username,
      Role: TokenRecord.User.role,
      TeamId: TokenRecord.User.team_id,
      Lang: TokenRecord.User.lang,
    };

    request.AuthSource = ResolvedSource;
    request.RawToken = RawToken;
    request.RawTokenSignature = Signature;
  };
}


/* ──────────────────────────────────────────────────────────────────
   RequireRole — gate that checks req.User.Role against an allow-list.
   Must be placed AFTER Authenticate in the middleware chain.
   ────────────────────────────────────────────────────────────────── */

export function RequireRole(...Roles: Array<'admin' | 'viewer' | 'operator'>) {

  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const request = req as IAuthenticatedRequest;

    if (!request.User) {
      reply.status(401).send({ Error: 'Authentication required' });
      return;
    }

    if (!Roles.includes(request.User.Role)) {
      reply.status(403).send({ Error: 'Insufficient permissions' });
      return;
    }
  };
}
