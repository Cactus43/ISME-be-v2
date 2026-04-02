/**
 * Operations interfaces — business logic contracts.
 * All mutations receive a RequestContext for identity/audit propagation.
 * All return types are wrapped in OperationResult for uniform handling.
 * Unified: MobileOperatorDTO → MobileUserDTO, operators are users with role='operator'.
 */

import type { BackofficeLoginResult, BackofficeSessionResult, MobileLoginResult, MobileSessionResult } from '../Types/Auth';
import type { OperationResult } from '../Types/OperationResult';
import type { PaginatedResult } from '../Types/Pagination';
import type { RequestContext } from '../Types/Contexts';
import type { InterventionDTO } from '../Types/DTOs/InterventionDTO';
import type { TeamDTO } from '../Types/DTOs/TeamDTO';
import type { OperatorDTO } from '../Types/DTOs/OperatorDTO';
import type { MediaDTO } from '../Types/DTOs/MediaDTO';
import type { MediaSlot, UploadedMediaFile } from '../Types/Media';
import type { LoginInput, MobileLoginInput } from '../Schemas/Auth';
import type { CreateInterventionInput, UpdateInterventionInput, ListInterventionsQuery, ToggleDeleteInput } from '../Schemas/Intervention';
import type { CreateTeamInput, UpdateTeamInput } from '../Schemas/Team';
import type { CreateOperatorInput, UpdateOperatorInput } from '../Schemas/Operator';

export interface ExportCsvOptions {
  Separator?: ',' | ';';
  QuoteMode?: 'always' | 'auto';
  NewLine?: '\n' | '\r\n';
  IncludeHeader?: boolean;
  IncludeBom?: boolean;
  Ids?: number[];
  Columns?: string[];
}

export interface ExportExcelOptions {
  IncludeHeader?: boolean;
  AutoFilter?: boolean;
  Ids?: number[];
  Columns?: string[];
}


// ─── IAuthOperations ───────────────────────────────────────────────────────

export interface IAuthOperations {
  LoginBackoffice(input: LoginInput, context: RequestContext): Promise<OperationResult<BackofficeLoginResult>>;
  LogoutBackoffice(signature: string): Promise<OperationResult<void>>;
  VerifyBackofficeSession(signature: string): Promise<OperationResult<BackofficeSessionResult>>;
  LoginMobile(input: MobileLoginInput): Promise<OperationResult<MobileLoginResult>>;
  LogoutMobile(signature: string): Promise<OperationResult<void>>;
  VerifyMobileSession(signature: string): Promise<OperationResult<MobileSessionResult>>;
}


// ─── IInterventionOperations ───────────────────────────────────────────────

export interface IInterventionOperations {
  List(query: ListInterventionsQuery): Promise<OperationResult<PaginatedResult<InterventionDTO>>>;
  GetById(id: number): Promise<OperationResult<InterventionDTO>>;
  GetRecent(limit: number): Promise<OperationResult<InterventionDTO[]>>;
  GetStats(): Promise<OperationResult<import('../Interfaces/IAdapter').DashboardStats>>;
  GetAllForDashboard(interventionType?: number): Promise<OperationResult<InterventionDTO[]>>;
  GetChartBundle(filters: { interventionType?: number; year?: number; dateFrom?: string; dateTo?: string; steamPrice?: number; timeFrame?: string }): Promise<OperationResult<import('../../Utils/ChartEngine').ChartBundle>>;
  GetAllForMobile(teamCode: string): Promise<OperationResult<InterventionDTO[]>>;
  Create(input: CreateInterventionInput, context: RequestContext): Promise<OperationResult<InterventionDTO>>;
  Update(id: number, input: UpdateInterventionInput, context: RequestContext): Promise<OperationResult<InterventionDTO>>;
  ToggleDelete(input: ToggleDeleteInput, context: RequestContext): Promise<OperationResult<{ Affected: number }>>;
  ExportCsv(teamCode?: string, options?: ExportCsvOptions): Promise<OperationResult<string>>;
  ExportExcel(teamCode?: string, options?: ExportExcelOptions): Promise<OperationResult<Buffer>>;
  SyncFromMobile(interventions: any[], context: RequestContext): Promise<OperationResult<Record<string, number | 'delete'>>>;
}


// ─── IMediaOperations ──────────────────────────────────────────────────────

export interface IMediaOperations {
  GetFile(id: number): Promise<OperationResult<{ FilePath: string; MimeType: string; Filename: string }>>;
  ListByIntervention(interventionId: number): Promise<OperationResult<MediaDTO[]>>;
  UploadForIntervention(interventionId: number, slot: MediaSlot, file: UploadedMediaFile, context: RequestContext): Promise<OperationResult<MediaDTO>>;
  Delete(id: number, context: RequestContext): Promise<OperationResult<void>>;
}


// ─── ITeamOperations ───────────────────────────────────────────────────────

export interface ITeamOperations {
  GetAll(): Promise<OperationResult<TeamDTO[]>>;
  GetById(id: number): Promise<OperationResult<TeamDTO>>;
  Create(input: CreateTeamInput, context: RequestContext): Promise<OperationResult<TeamDTO>>;
  Update(id: number, input: UpdateTeamInput, context: RequestContext): Promise<OperationResult<TeamDTO>>;
  Delete(id: number, context: RequestContext): Promise<OperationResult<void>>;
}


// ─── IOperatorOperations ───────────────────────────────────────────────────
// Operators are users with role='operator' — same CRUD contract, same DTO shape.

export interface IOperatorOperations {
  GetAll(): Promise<OperationResult<OperatorDTO[]>>;
  GetById(id: number): Promise<OperationResult<OperatorDTO>>;
  Create(input: CreateOperatorInput, context: RequestContext): Promise<OperationResult<OperatorDTO>>;
  Update(id: number, input: UpdateOperatorInput, context: RequestContext): Promise<OperationResult<OperatorDTO>>;
  Delete(id: number, context: RequestContext): Promise<OperationResult<void>>;
}
