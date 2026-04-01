import type { Logger } from 'pino';
import type { ITeamAdapter } from '../Data/Interfaces/IAdapter';
import type { ITeamOperations } from '../Data/Interfaces/IOperations';
import type { RequestContext } from '../Data/Types/Contexts';
import type { CreateTeamInput, UpdateTeamInput } from '../Data/Schemas/Team';
import { TeamDTO } from '../Data/Types/DTOs/TeamDTO';
import { OperationResult } from '../Data/Types/OperationResult';
import { NotFoundError } from '../Data/Exceptions/Index';
import type { EventBus } from '../Infra/EventBus';


// ─── TeamOperations ────────────────────────────────────────────────────────

export class TeamOperations implements ITeamOperations {

  private readonly _teamAdapter: ITeamAdapter;
  private readonly _log: Logger;
  private readonly _eventBus: EventBus;

  constructor({
    TeamAdapter,
    Logger,
    EventBus: Bus,
  }: {
    TeamAdapter: ITeamAdapter;
    Logger: Logger;
    EventBus: EventBus;
  }) {
    this._teamAdapter = TeamAdapter;
    this._log = Logger;
    this._eventBus = Bus;
  }

  async GetAll(): Promise<OperationResult<TeamDTO[]>> {
    const rows = await this._teamAdapter.FindAll();
    return OperationResult.Ok(rows.map(TeamDTO.FromModel));
  }

  async GetById(id: number): Promise<OperationResult<TeamDTO>> {
    const team = await this._teamAdapter.FindById(id);
    if (!team) throw new NotFoundError('Team not found');
    return OperationResult.Ok(TeamDTO.FromModel(team));
  }

  async Create(input: CreateTeamInput, context: RequestContext): Promise<OperationResult<TeamDTO>> {
    const team = await this._teamAdapter.Create({ ...input, created_by: context.UserId });
    this._log.info({ teamId: team.id }, 'Team created');
    this._eventBus.Publish({ Type: 'Team.Created', Source: 'backoffice', Timestamp: new Date(), Context: context, Payload: { TeamId: team.id, Code: input.code, Message: `Created team: ${input.code}` } });
    return OperationResult.Ok(TeamDTO.FromModel(team));
  }

  async Update(id: number, input: UpdateTeamInput, context: RequestContext): Promise<OperationResult<TeamDTO>> {
    const team = await this._teamAdapter.Update(id, { ...input, updated_by: context.UserId });
    if (!team) throw new NotFoundError('Team not found');
    this._log.info({ teamId: id }, 'Team updated');
    this._eventBus.Publish({ Type: 'Team.Updated', Source: 'backoffice', Timestamp: new Date(), Context: context, Payload: { TeamId: id, Fields: Object.keys(input) } });
    return OperationResult.Ok(TeamDTO.FromModel(team));
  }

  async Delete(id: number, context: RequestContext): Promise<OperationResult<void>> {
    const team = await this._teamAdapter.FindById(id);
    if (!team) throw new NotFoundError('Team not found');
    await this._teamAdapter.SoftDelete(id, context.UserId);
    this._log.info({ teamId: id }, 'Team soft-deleted');
    this._eventBus.Publish({ Type: 'Team.Deleted', Source: 'backoffice', Timestamp: new Date(), Context: context, Payload: { TeamId: id } });
    return OperationResult.Void();
  }
}
