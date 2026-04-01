import { Router, Response, NextFunction } from 'express';
import type { IAuthenticatedRequest } from '../Data/Types/Express';
import type { IAuthOperations } from '../Data/Interfaces/IOperations';
import { RequestContext } from '../Data/Types/Contexts';
import { LOGIN_SCHEMA, MOBILE_LOGIN_SCHEMA } from '../Data/Schemas/Auth';
import { Authenticate } from '../Middleware/Authenticate';
import { Validate } from '../Middleware/Validate';
import { AUTH_LIMITER } from '../Middleware/RateLimiter';
import { Config } from '../Config/Index';


// ─── Auth Controller ───────────────────────────────────────────────────────

export class AuthController {

  public readonly Router: Router;
  private readonly _auth: IAuthOperations;

  constructor({ AuthOperations }: { AuthOperations: IAuthOperations }) {
    this._auth = AuthOperations;
    this.Router = Router();
    this._registerRoutes();
  }


  // ─── Route Registration ────────────────────────────────────────────────

  private _registerRoutes(): void {
    // Backoffice
    this.Router.post('/login', AUTH_LIMITER, Validate(LOGIN_SCHEMA), this.Login.bind(this));
    this.Router.post('/logout', Authenticate('backoffice'), this.Logout.bind(this));
    this.Router.get('/verify', Authenticate('backoffice'), this.Verify.bind(this));

    // Mobile
    this.Router.post('/mobile/login', AUTH_LIMITER, Validate(MOBILE_LOGIN_SCHEMA), this.MobileLogin.bind(this));
    this.Router.post('/mobile/logout', Authenticate('mobile'), this.MobileLogout.bind(this));
    this.Router.get('/mobile/verify', Authenticate('mobile'), this.MobileVerify.bind(this));
  }


  // ─── Backoffice Handlers ───────────────────────────────────────────────

  private async Login(req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const context = RequestContext.FromRequest(req);
      const result = await this._auth.LoginBackoffice(req.body, context);

      res.cookie('session', result.Data.Token, {
        httpOnly: true,
        secure: Config.Cookie.Secure,
        sameSite: 'lax',
        maxAge: Config.Jwt.SessionMinutes * 60 * 1000,
      });

      res.json({ status: 'ok', data: result.Data.User });
    } catch (err) {
      next(err);
    }
  }

  private async Logout(req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await this._auth.LogoutBackoffice(req.RawTokenSignature!);
      res.clearCookie('session');
      res.json({ status: 'ok' });
    } catch (err) {
      next(err);
    }
  }

  private async Verify(req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this._auth.VerifyBackofficeSession(req.RawTokenSignature!);
      res.json({ status: 'ok', data: result.Data });
    } catch (err) {
      next(err);
    }
  }


  // ─── Mobile Handlers ──────────────────────────────────────────────────

  private async MobileLogin(req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this._auth.LoginMobile(req.body);
      res.json({ status: 'ok', data: result.Data });
    } catch (err) {
      next(err);
    }
  }

  private async MobileLogout(req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await this._auth.LogoutMobile(req.RawTokenSignature!);
      res.json({ status: 'ok' });
    } catch (err) {
      next(err);
    }
  }

  private async MobileVerify(req: IAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this._auth.VerifyMobileSession(req.RawTokenSignature!);
      res.json({ status: 'ok', data: result.Data });
    } catch (err) {
      next(err);
    }
  }
}
