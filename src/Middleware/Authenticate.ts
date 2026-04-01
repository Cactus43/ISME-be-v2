import type { Response, NextFunction } from 'express';
import type { IAuthenticatedRequest } from '../Data/Types/Express';
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

  return async (req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {

    // ── Extract signature from transport (try both when no Source) ──
    let RawToken: string | undefined;
    let ResolvedSource: 'backoffice' | 'mobile' | undefined;

    if (!Source || Source === 'backoffice') {
      const CookieValue = req.cookies?.['session'];
      if (CookieValue) {
        RawToken = CookieValue;
        ResolvedSource = 'backoffice';
      }
    }

    if (!RawToken && (!Source || Source === 'mobile')) {
      const Header = req.headers.authorization;
      if (Header?.startsWith('Bearer ')) {
        RawToken = Header.slice(7);
        ResolvedSource = 'mobile';
      }
    }

    if (!RawToken || !ResolvedSource) {
      console.log('[Auth] 401 Authentication required |', req.method, req.originalUrl, '| authHeader:', req.headers.authorization?.slice(0, 30) ?? 'NONE', '| source:', Source ?? 'any');
      res.status(401).json({ Error: 'Authentication required' });
      return;
    }

    // Extract the JWT signature part (third segment) for DB lookup
    const Signature = JwtSignature(RawToken);

    if (!Signature) {
      console.log('[Auth] 401 Malformed token |', req.method, req.originalUrl, '| tokenLen:', RawToken.length, '| parts:', RawToken.split('.').length);
      res.status(401).json({ Error: 'Malformed token' });
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
      console.log('[Auth] 401 Invalid or expired session |', req.method, req.originalUrl,
        '| sig:', Signature.slice(0, 12) + '...',
        '| resolvedSource:', ResolvedSource,
        '| anyRecordInDB:', anyRecord ? `id=${anyRecord.id} source=${anyRecord.source} revoked=${anyRecord.revoked_at} expires=${anyRecord.expires_at}` : 'NONE');
      res.status(401).json({ Error: 'Invalid or expired session' });
      return;
    }

    if (new Date(TokenRecord.expires_at) < new Date()) {
      console.log('[Auth] 401 Session expired |', req.method, req.originalUrl,
        '| sig:', Signature.slice(0, 12) + '...',
        '| expiresAt:', TokenRecord.expires_at,
        '| now:', new Date().toISOString());
      res.status(401).json({ Error: 'Session expired' });
      return;
    }

    // ── Populate request context (unified for both flows) ──
    req.User = {
      Id: TokenRecord.User.id,
      Firstname: TokenRecord.User.firstname,
      Lastname: TokenRecord.User.lastname,
      Email: TokenRecord.User.email,
      Username: TokenRecord.User.username,
      Role: TokenRecord.User.role,
      TeamId: TokenRecord.User.team_id,
      Lang: TokenRecord.User.lang,
    };

    req.AuthSource = ResolvedSource;
    req.RawToken = RawToken;
    req.RawTokenSignature = Signature;

    next();
  };
}


/* ──────────────────────────────────────────────────────────────────
   RequireRole — gate that checks req.User.Role against an allow-list.
   Must be placed AFTER Authenticate in the middleware chain.
   ────────────────────────────────────────────────────────────────── */

export function RequireRole(...Roles: Array<'admin' | 'viewer' | 'operator'>) {

  return (req: IAuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.User) {
      res.status(401).json({ Error: 'Authentication required' });
      return;
    }

    if (!Roles.includes(req.User.Role)) {
      res.status(403).json({ Error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}
