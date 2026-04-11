import type { FastifyInstance, FastifyReply } from 'fastify';
import type { IAuthenticatedRequest } from '../Data/Types/Http';
import type { IAuthOperations } from '../Data/Interfaces/IOperations';
import { RequestContext } from '../Data/Types/Contexts';
import { LOGIN_SCHEMA, MOBILE_LOGIN_SCHEMA, type LoginInput, type MobileLoginInput } from '../Data/Schemas/Auth';
import { Authenticate } from '../Middleware/Authenticate';
import { Validate } from '../Middleware/Validate';
import { AUTH_LIMITER } from '../Middleware/RateLimiter';
import { Config } from '../Config/Index';


type ControllerHandler = (req: IAuthenticatedRequest, reply: FastifyReply) => Promise<void>;


// ─── Auth Controller ───────────────────────────────────────────────────────

export class AuthController {

  private readonly _auth: IAuthOperations;

  constructor({ AuthOperations }: { AuthOperations: IAuthOperations }) {
    this._auth = AuthOperations;
  }


  // ─── Route Registration ────────────────────────────────────────────────

  public RegisterRoutes(app: FastifyInstance): void {
    // Backoffice
    app.post('/login', { preHandler: [AUTH_LIMITER, Validate(LOGIN_SCHEMA)] }, this.Handle(this.Login));
    app.post('/logout', { preHandler: [Authenticate('backoffice')] }, this.Handle(this.Logout));
    app.get('/verify', { preHandler: [Authenticate('backoffice')] }, this.Handle(this.Verify));

    // Mobile
    app.post('/mobile/login', { preHandler: [AUTH_LIMITER, Validate(MOBILE_LOGIN_SCHEMA)] }, this.Handle(this.MobileLogin));
    app.post('/mobile/logout', { preHandler: [Authenticate('mobile')] }, this.Handle(this.MobileLogout));
    app.get('/mobile/verify', { preHandler: [Authenticate('mobile')] }, this.Handle(this.MobileVerify));
  }

  private Handle(handler: ControllerHandler) {
    return async (request: IAuthenticatedRequest, reply: FastifyReply): Promise<void> => {
      await handler.call(this, request, reply);
    };
  }


  // ─── Backoffice Handlers ───────────────────────────────────────────────

  private async Login(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const context = RequestContext.FromRequest(req);
    const result = await this._auth.LoginBackoffice(req.body as LoginInput, context);

    reply.setCookie('session', result.Data.Token, {
      httpOnly: true,
      secure: Config.Cookie.Secure,
      sameSite: 'lax',
      maxAge: Config.Jwt.SessionMinutes * 60 * 1000,
      path: '/',
    });

    reply.send({ status: 'ok', data: result.Data.User });
  }

  private async Logout(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    await this._auth.LogoutBackoffice(req.RawTokenSignature!);
    reply.clearCookie('session', { path: '/' });
    reply.send({ status: 'ok' });
  }

  private async Verify(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const result = await this._auth.VerifyBackofficeSession(req.RawTokenSignature!);
    reply.send({ status: 'ok', data: result.Data });
  }


  // ─── Mobile Handlers ──────────────────────────────────────────────────

  private async MobileLogin(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const result = await this._auth.LoginMobile(req.body as MobileLoginInput);
    reply.send({ status: 'ok', data: result.Data });
  }

  private async MobileLogout(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    await this._auth.LogoutMobile(req.RawTokenSignature!);
    reply.send({ status: 'ok' });
  }

  private async MobileVerify(req: IAuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const result = await this._auth.VerifyMobileSession(req.RawTokenSignature!);
    reply.send({ status: 'ok', data: result.Data });
  }
}
