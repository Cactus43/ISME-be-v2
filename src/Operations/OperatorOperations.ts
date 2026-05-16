import type { Logger } from 'pino';
import type { IUserAdapter } from '../Data/Interfaces/IAdapter';
import type { IOperatorOperations } from '../Data/Interfaces/IOperations';
import type { RequestContext } from '../Data/Types/Contexts';
import type { CreateOperatorInput, UpdateOperatorInput } from '../Data/Schemas/Operator';
import type { UserAttributes } from '../Data/Models/User';
import { OperatorDTO } from '../Data/Types/DTOs/OperatorDTO';
import { OperationResult } from '../Data/Types/OperationResult';
import { ConflictError, NotFoundError } from '../Data/Exceptions/Index';
import { HashPassword } from '../Utils/Crypto';
import type { EventBus } from '../Infra/EventBus';


// ─── OperatorOperations ────────────────────────────────────────────────────
// Operators are users with role='operator'. CRUD proxies to UserAdapter.

export class OperatorOperations implements IOperatorOperations {

  private readonly _userAdapter: IUserAdapter;
  private readonly _log: Logger;
  private readonly _eventBus: EventBus;

  constructor({
    UserAdapter,
    Logger,
    EventBus: Bus,
  }: {
    UserAdapter: IUserAdapter;
    Logger: Logger;
    EventBus: EventBus;
  }) {
    this._userAdapter = UserAdapter;
    this._log = Logger;
    this._eventBus = Bus;
  }

  async GetAll(): Promise<OperationResult<OperatorDTO[]>> {
    const rows = await this._userAdapter.FindAllByRole('operator', { excludePassword: true, includeInactive: true });
    return OperationResult.Ok(rows.map(OperatorDTO.FromModel));
  }

  async GetById(id: number): Promise<OperationResult<OperatorDTO>> {
    const user = await this._userAdapter.FindById(id, { excludePassword: true, includeInactive: true });
    if (!user || user.role !== 'operator') throw new NotFoundError('Operator not found');
    return OperationResult.Ok(OperatorDTO.FromModel(user));
  }

  async Create(input: CreateOperatorInput, context: RequestContext): Promise<OperationResult<OperatorDTO>> {
    await this._ensureUniqueOperatorIdentity(input.email ?? null, input.username);

    const { password, ...rest } = input;
    const user = await this._userAdapter.Create({
      ...rest,
      password: await HashPassword(password),
      role: 'operator',
      created_by: context.UserId,
    } as Partial<UserAttributes>);

    this._log.info({ userId: user.id }, 'Operator created');
    this._eventBus.Publish({ Type: 'User.Created', Source: 'backoffice', Timestamp: new Date(), Context: context, Payload: { UserId: user.id, Username: input.username, Email: input.email ?? null, Role: 'operator', Message: `Created operator: ${input.username}` } });

    return OperationResult.Ok(OperatorDTO.FromModel(user));
  }

  async Update(id: number, input: UpdateOperatorInput, context: RequestContext): Promise<OperationResult<OperatorDTO>> {
    const existing = await this._userAdapter.FindById(id, { includeInactive: true });
    if (!existing || existing.role !== 'operator') throw new NotFoundError('Operator not found');

    await this._ensureUniqueOperatorIdentity(input.email, input.username, id);

    const data = { ...input, updated_by: context.UserId } as Record<string, unknown>;
    if (data.password) {
      data.password = await HashPassword(data.password as string);
    }

    const user = await this._userAdapter.Update(id, data as Partial<UserAttributes>);
    if (!user) throw new NotFoundError('Operator not found');

    this._log.info({ userId: id }, 'Operator updated');
    this._eventBus.Publish({ Type: 'User.Updated', Source: 'backoffice', Timestamp: new Date(), Context: context, Payload: { UserId: id, Fields: Object.keys(input) } });

    return OperationResult.Ok(OperatorDTO.FromModel(user));
  }

  async Delete(id: number, context: RequestContext): Promise<OperationResult<void>> {
    const user = await this._userAdapter.FindById(id, { includeInactive: true });
    if (!user || user.role !== 'operator') throw new NotFoundError('Operator not found');
    await this._userAdapter.SoftDelete(id, context.UserId);
    this._log.info({ userId: id }, 'Operator soft-deleted');
    this._eventBus.Publish({ Type: 'User.Deleted', Source: 'backoffice', Timestamp: new Date(), Context: context, Payload: { UserId: id } });
    return OperationResult.Void();
  }

  private async _ensureUniqueOperatorIdentity(email?: string | null, username?: string | null, currentUserId?: number): Promise<void> {
    const cleanEmail = typeof email === 'string' ? email.trim() : email;
    if (cleanEmail) {
      const existingByEmail = await this._userAdapter.FindByEmail(cleanEmail, { includeInactive: true });
      if (existingByEmail && existingByEmail.id !== currentUserId) {
        throw new ConflictError('Email already in use');
      }
    }

    const cleanUsername = typeof username === 'string' ? username.trim() : username;
    if (cleanUsername) {
      const existingByUsername = await this._userAdapter.FindByUsername(cleanUsername, { includeInactive: true });
      if (existingByUsername && existingByUsername.id !== currentUserId) {
        throw new ConflictError('Username already in use');
      }
    }
  }
}
