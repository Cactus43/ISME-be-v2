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
import type { PriorityTrackingWeekResult } from './IAdapter';
import type { PriorityTrackingTimelineResult } from './IAdapter';
import type { InterventionDTO } from '../Types/DTOs/InterventionDTO';
import type { TeamDTO } from '../Types/DTOs/TeamDTO';
import type { UnitDTO } from '../Types/DTOs/UnitDTO';
import type { OperatorDTO } from '../Types/DTOs/OperatorDTO';
import type { MediaDTO } from '../Types/DTOs/MediaDTO';
import type { MediaSlot, UploadedMediaFile } from '../Types/Media';
import type { LoginInput, MobileLoginInput } from '../Schemas/Auth';
import type { CreateInterventionInput, UpdateInterventionInput, ListInterventionsQuery, ToggleDeleteInput } from '../Schemas/Intervention';
import type { CreateTeamInput, UpdateTeamInput } from '../Schemas/Team';
import type { CreateUnitInput, UpdateUnitInput } from '../Schemas/Unit';
import type { CreateOperatorInput, UpdateOperatorInput } from '../Schemas/Operator';

export interface ExportCsvOptions {
  Separator?: ',' | ';';
  QuoteMode?: 'always' | 'auto';
  NewLine?: '\n' | '\r\n';
  Language?: 'it' | 'en';
  IncludeHeader?: boolean;
  IncludeBom?: boolean;
  Ids?: number[];
  Columns?: string[];
}

export interface ExportExcelOptions {
  Language?: 'it' | 'en';
  IncludeHeader?: boolean;
  AutoFilter?: boolean;
  Ids?: number[];
  Columns?: string[];
}

export interface MobileSyncPullDTO {
  Items: InterventionDTO[];
  DeletedIds: number[];
  HasMore: boolean;
  NextCursor: string | null;
  SyncPoint: string;
}

export interface MobileSyncPullRequest {
  UpdatedAfter: Date | null;
  SyncPoint: Date;
  Cursor: string | null;
  Limit: number;
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
  GetAllForMobile(teamCode: string, options: MobileSyncPullRequest): Promise<OperationResult<MobileSyncPullDTO>>;
  Create(input: CreateInterventionInput, context: RequestContext): Promise<OperationResult<InterventionDTO>>;
  Update(id: number, input: UpdateInterventionInput, context: RequestContext): Promise<OperationResult<InterventionDTO>>;
  ToggleDelete(input: ToggleDeleteInput, context: RequestContext): Promise<OperationResult<{ Affected: number }>>;
  GetPriorityTrackingWeek(weekStart: Date, weekEnd: Date): Promise<OperationResult<PriorityTrackingWeekResult>>;
  GetPriorityTrackingTimeline(weekStart: Date, weekEnd: Date): Promise<OperationResult<PriorityTrackingTimelineResult>>;
  UpdatePriorityTrackingItem(itemId: number, patch: {
    selection?: boolean;
    ps9?: boolean;
    po?: boolean;
    workPermit?: boolean;
    rationale?: 'Mancanza Operatore' | 'Difficolta Intercetto' | 'Mancanza materiali' | 'Permesso non aperto' | null;
  }, context: RequestContext): Promise<OperationResult<void>>;
  ExportCsv(teamCode?: string, options?: ExportCsvOptions): Promise<OperationResult<string>>;
  ExportExcel(teamCode?: string, options?: ExportExcelOptions): Promise<OperationResult<Buffer>>;
  SyncFromMobile(interventions: any[], context: RequestContext): Promise<OperationResult<Record<string, number | 'conflict'>>>;
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


// ─── IUnitOperations ───────────────────────────────────────────────────────

export interface IUnitOperations {
  GetAll(): Promise<OperationResult<UnitDTO[]>>;
  GetById(id: number): Promise<OperationResult<UnitDTO>>;
  Create(input: CreateUnitInput, context: RequestContext): Promise<OperationResult<UnitDTO>>;
  Update(id: number, input: UpdateUnitInput, context: RequestContext): Promise<OperationResult<UnitDTO>>;
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
