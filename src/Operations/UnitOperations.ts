import type { Logger } from 'pino';
import type { IUnitAdapter } from '../Data/Interfaces/IAdapter';
import type { IUnitOperations } from '../Data/Interfaces/IOperations';
import type { RequestContext } from '../Data/Types/Contexts';
import type { CreateUnitInput, UpdateUnitInput } from '../Data/Schemas/Unit';
import { UnitDTO } from '../Data/Types/DTOs/UnitDTO';
import { OperationResult } from '../Data/Types/OperationResult';
import { NotFoundError } from '../Data/Exceptions/Index';


// ─── UnitOperations ────────────────────────────────────────────────────────

export class UnitOperations implements IUnitOperations {

  private readonly _unitAdapter: IUnitAdapter;
  private readonly _log: Logger;

  constructor({
    UnitAdapter,
    Logger,
  }: {
    UnitAdapter: IUnitAdapter;
    Logger: Logger;
  }) {
    this._unitAdapter = UnitAdapter;
    this._log = Logger;
  }

  async GetAll(): Promise<OperationResult<UnitDTO[]>> {
    const rows = await this._unitAdapter.FindAll();
    return OperationResult.Ok(rows.map(UnitDTO.FromModel));
  }

  async GetById(id: number): Promise<OperationResult<UnitDTO>> {
    const unit = await this._unitAdapter.FindById(id);
    if (!unit) throw new NotFoundError('Unit not found');
    return OperationResult.Ok(UnitDTO.FromModel(unit));
  }

  async Create(input: CreateUnitInput, context: RequestContext): Promise<OperationResult<UnitDTO>> {
    const unit = await this._unitAdapter.Create({
      name: input.name,
      team_id: input.team_id,
      is_active: input.is_active ?? true,
      created_by: context.UserId,
      updated_by: context.UserId,
    });
    const refreshed = await this._unitAdapter.FindById(unit.id);
    if (!refreshed) throw new NotFoundError('Unit not found');
    this._log.info({ unitId: unit.id, userId: context.UserId }, 'Unit created');
    return OperationResult.Ok(UnitDTO.FromModel(refreshed));
  }

  async Update(id: number, input: UpdateUnitInput, context: RequestContext): Promise<OperationResult<UnitDTO>> {
    const updated = await this._unitAdapter.Update(id, {
      name: input.name,
      team_id: input.team_id,
      is_active: input.is_active,
      updated_by: context.UserId,
    });
    if (!updated) throw new NotFoundError('Unit not found');
    const refreshed = await this._unitAdapter.FindById(id);
    if (!refreshed) throw new NotFoundError('Unit not found');
    this._log.info({ unitId: id, userId: context.UserId }, 'Unit updated');
    return OperationResult.Ok(UnitDTO.FromModel(refreshed));
  }

  async Delete(id: number, context: RequestContext): Promise<OperationResult<void>> {
    const unit = await this._unitAdapter.FindById(id);
    if (!unit) throw new NotFoundError('Unit not found');
    await this._unitAdapter.SoftDelete(id, context.UserId);
    this._log.info({ unitId: id, userId: context.UserId }, 'Unit soft-deleted');
    return OperationResult.Void();
  }
}
