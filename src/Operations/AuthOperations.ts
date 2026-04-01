import dayjs from 'dayjs';
import type { Logger } from 'pino';
import type { IUserAdapter, ITokenAdapter, IDeviceAdapter } from '../Data/Interfaces/IAdapter';
import type { IAuthOperations } from '../Data/Interfaces/IOperations';
import type { BackofficeLoginResult, BackofficeSessionResult, MobileLoginResult, MobileSessionResult } from '../Data/Types/Auth';
import type { RequestContext } from '../Data/Types/Contexts';
import type { AuthPolicy } from '../Data/Types/Policies';
import type { LoginInput, MobileLoginInput } from '../Data/Schemas/Auth';
import { OperationResult } from '../Data/Types/OperationResult';
import { UnauthorizedError } from '../Data/Exceptions/Index';
import { ComparePassword, HashPassword, JwtSign, JwtSignature, Sha256 } from '../Utils/Crypto';
import { Config } from '../Config/Index';
import type { EventBus } from '../Infra/EventBus';


// ─── AuthOperations ────────────────────────────────────────────────────────
// Unified: both backoffice and mobile auth work against the users table.

export class AuthOperations implements IAuthOperations {

  private readonly _userAdapter: IUserAdapter;
  private readonly _tokenAdapter: ITokenAdapter;
  private readonly _deviceAdapter: IDeviceAdapter;
  private readonly _log: Logger;
  private readonly _eventBus: EventBus;
  private readonly _policy: AuthPolicy;

  constructor({
    UserAdapter,
    TokenAdapter,
    DeviceAdapter,
    Logger,
    EventBus: Bus,
    Policy,
  }: {
    UserAdapter: IUserAdapter;
    TokenAdapter: ITokenAdapter;
    DeviceAdapter: IDeviceAdapter;
    Logger: Logger;
    EventBus: EventBus;
    Policy: AuthPolicy;
  }) {
    this._userAdapter = UserAdapter;
    this._tokenAdapter = TokenAdapter;
    this._deviceAdapter = DeviceAdapter;
    this._log = Logger;
    this._eventBus = Bus;
    this._policy = Policy;
    this._log.debug({ maxAttempts: this._policy.MaxFailedAttempts, lockoutMinutes: this._policy.LockoutMinutes }, 'Auth policy loaded');
  }


  // ─── Backoffice ────────────────────────────────────────────────────

  async LoginBackoffice(input: LoginInput, context: RequestContext): Promise<OperationResult<BackofficeLoginResult>> {
    const user = await this._userAdapter.FindByEmail(input.email);
    if (!user) {
      this._eventBus.Publish({ Type: 'Auth.BackofficeLoginFailed', Source: 'backoffice', Timestamp: new Date(), Context: context, Payload: { Email: input.email, Reason: 'unknown_email', Message: `Unknown email: ${input.email}` } });
      throw new UnauthorizedError('Invalid credentials');
    }

    const passwordValid = await ComparePassword(input.password, user.password);
    if (!passwordValid) {
      this._eventBus.Publish({ Type: 'Auth.BackofficeLoginFailed', Source: 'backoffice', Timestamp: new Date(), Context: context, Payload: { Email: input.email, Reason: 'wrong_password', Message: 'Wrong password' } });
      throw new UnauthorizedError('Invalid credentials');
    }

    // Transparent re-hash: migrate legacy SHA-256 passwords to bcrypt on successful login
    if (!user.password.startsWith('$2b$') && !user.password.startsWith('$2a$')) {
      const bcryptHash = await HashPassword(input.password);
      await this._userAdapter.Update(user.id, { password: bcryptHash });
      this._log.info({ userId: user.id }, 'Password migrated from SHA-256 to bcrypt');
    }

    // Build session token and persist hashed copy
    const expiresAt = dayjs().add(Config.Jwt.SessionMinutes, 'minute').toDate();
    const payload = { userId: user.id, email: user.email, role: user.role, exp: Math.floor(expiresAt.getTime() / 1000) };
    const token = JwtSign(payload);
    const sig = JwtSignature(token);

    await this._tokenAdapter.CreateToken({
      user_id: user.id,
      source: 'backoffice',
      token: Sha256(token),
      signature: sig,
      expires_at: expiresAt,
      ip_address: context.IpAddress,
      user_agent: context.UserAgent ?? null,
    });

    this._log.info({ userId: user.id, email: user.email }, 'Backoffice login success');
    this._eventBus.Publish({ Type: 'Auth.BackofficeLogin', Source: 'backoffice', Timestamp: new Date(), Context: context, Payload: { Email: user.email, Message: `Login from ${context.IpAddress}` } });

    return OperationResult.Ok({
      Token: token,
      User: { Id: user.id, Firstname: user.firstname, Lastname: user.lastname, Email: user.email, Role: user.role, Lang: user.lang },
    });
  }

  async LogoutBackoffice(signature: string): Promise<OperationResult<void>> {
    const affected = await this._tokenAdapter.RevokeToken(signature, 'backoffice');
    if (affected === 0) {
      this._log.warn({ signature: signature.slice(0, 8) + '...' }, 'Logout: token not found or already revoked');
    }
    this._eventBus.Publish({ Type: 'Auth.BackofficeLogout', Source: 'backoffice', Timestamp: new Date(), Payload: { Message: affected > 0 ? 'Session revoked' : 'Token already revoked' } });
    return OperationResult.Void();
  }

  async VerifyBackofficeSession(signature: string): Promise<OperationResult<BackofficeSessionResult>> {
    const record = await this._tokenAdapter.FindActiveToken(signature, 'backoffice');
    if (!record) return OperationResult.Ok({ Valid: false });

    const user = await this._userAdapter.FindById(record.user_id, { excludePassword: true });
    if (!user) return OperationResult.Ok({ Valid: false });

    return OperationResult.Ok({
      Valid: true,
      User: { Id: user.id, Firstname: user.firstname, Lastname: user.lastname, Email: user.email, Role: user.role, Lang: user.lang },
    });
  }


  // ─── Mobile ────────────────────────────────────────────────────────

  async LoginMobile(input: MobileLoginInput): Promise<OperationResult<MobileLoginResult>> {
    // Unified: operators are users with role='operator', looked up by username or email
    let user = await this._userAdapter.FindByUsername(input.username);
    
    // Fallback: if username not found, try email (for operators that have email but no username)
    if (!user) {
      user = await this._userAdapter.FindByEmail(input.username);
    }
    
    if (!user) {
      this._log.warn({ username: input.username }, 'Mobile login failed: user not found');
      this._eventBus.Publish({ Type: 'Auth.MobileLoginFailed', Source: 'mobile', Timestamp: new Date(), Payload: { Username: input.username, Reason: 'unknown_username', Message: `Unknown username/email: ${input.username}` } });
      throw new UnauthorizedError('Invalid credentials');
    }

    this._log.debug({ userId: user.id, username: user.username, role: user.role, isActive: user.is_active, deletedAt: user.deleted_at, passwordFormat: user.password.startsWith('$2') ? 'bcrypt' : 'sha256' }, 'Mobile login: user found, checking password');

    const passwordValid = await ComparePassword(input.password, user.password);
    if (!passwordValid) {
      this._log.warn({ userId: user.id, username: user.username }, 'Mobile login failed: invalid password');
      this._eventBus.Publish({ Type: 'Auth.MobileLoginFailed', Source: 'mobile', Timestamp: new Date(), Payload: { Username: input.username, Reason: 'wrong_password', Message: 'Wrong password' } });
      throw new UnauthorizedError('Invalid credentials');
    }

    // Transparent re-hash: migrate legacy SHA-256 passwords to bcrypt on successful login
    if (!user.password.startsWith('$2b$') && !user.password.startsWith('$2a$')) {
      const bcryptHash = await HashPassword(input.password);
      await this._userAdapter.Update(user.id, { password: bcryptHash });
      this._log.info({ userId: user.id }, 'Password migrated from SHA-256 to bcrypt');
    }

    // Upsert device
    const device = await this._deviceAdapter.Upsert({
      device_uuid: input.deviceUuid,
      device_name: input.deviceName ?? null,
      platform: input.platform ?? 'android',
      os_version: input.osVersion ?? null,
      app_version: input.appVersion ?? null,
      last_seen_at: new Date(),
      is_active: true,
    });

    // Build session token and persist hashed copy
    const expiresAt = dayjs().add(Config.Jwt.SessionMinutes, 'minute').toDate();
    const payload = { userId: user.id, username: user.username, deviceId: device.id, exp: Math.floor(expiresAt.getTime() / 1000) };
    const token = JwtSign(payload);
    const sig = JwtSignature(token);

    await this._tokenAdapter.CreateToken({
      user_id: user.id,
      device_id: device.id,
      source: 'mobile',
      token: Sha256(token),
      signature: sig,
      expires_at: expiresAt,
    });

    this._log.info({ userId: user.id, username: user.username, deviceUuid: input.deviceUuid }, 'Mobile login success');
    this._eventBus.Publish({ Type: 'Auth.MobileLogin', Source: 'mobile', Timestamp: new Date(), Payload: { Username: user.username, Message: `Mobile login: ${user.username}` } });

    return OperationResult.Ok({
      Token: token,
      User: { Id: user.id, Firstname: user.firstname, Lastname: user.lastname, Username: user.username, TeamId: user.team_id },
    });
  }

  async LogoutMobile(signature: string): Promise<OperationResult<void>> {
    const affected = await this._tokenAdapter.RevokeToken(signature, 'mobile');
    if (affected === 0) {
      this._log.warn({ signature: signature.slice(0, 8) + '...' }, 'Mobile logout: token not found or already revoked');
    }
    this._eventBus.Publish({ Type: 'Auth.MobileLogout', Source: 'mobile', Timestamp: new Date(), Payload: { Message: affected > 0 ? 'Mobile session revoked' : 'Mobile token already revoked' } });
    return OperationResult.Void();
  }

  async VerifyMobileSession(signature: string): Promise<OperationResult<MobileSessionResult>> {
    const record = await this._tokenAdapter.FindActiveToken(signature, 'mobile');
    if (!record) return OperationResult.Ok({ Valid: false });

    const user = await this._userAdapter.FindById(record.user_id, { excludePassword: true });
    if (!user) return OperationResult.Ok({ Valid: false });

    return OperationResult.Ok({
      Valid: true,
      User: { Id: user.id, Firstname: user.firstname, Lastname: user.lastname, Username: user.username, TeamId: user.team_id },
    });
  }
}
