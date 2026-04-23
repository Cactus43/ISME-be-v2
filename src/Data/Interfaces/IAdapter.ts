/**
 * Adapter interfaces — repository-pattern contracts.
 * Inner layers depend on these; outer layers implement them.
 * Unified: operators merged into users, tokens merged into access_tokens.
 */

import type { AccessTokenAttributes } from '../Models/AccessToken';
import type { MobileDeviceAttributes } from '../Models/MobileDevice';
import type { UserAttributes } from '../Models/User';
import type { TeamAttributes } from '../Models/Team';
import type { UnitAttributes } from '../Models/Unit';
import type { InterventionAttributes } from '../Models/Intervention';
import type { MediaAttributes } from '../Models/Media';
import type { PaginatedResult } from '../Types/Pagination';
import type { MediaSlot } from '../Types/Media';


// ─── IUserAdapter ──────────────────────────────────────────────────────────
// Covers both backoffice users (admin/viewer) and operators — role-filtered.

export interface IUserAdapter {
  FindByEmail(email: string): Promise<UserAttributes | null>;
  FindByUsername(username: string): Promise<UserAttributes | null>;
  FindById(id: number, opts?: { excludePassword?: boolean; includeInactive?: boolean }): Promise<UserAttributes | null>;
  FindAllByRole(role: string, opts?: { excludePassword?: boolean; includeInactive?: boolean }): Promise<UserAttributes[]>;
  Create(data: Partial<UserAttributes>): Promise<UserAttributes>;
  Update(id: number, data: Partial<UserAttributes>): Promise<UserAttributes | null>;
  SoftDelete(id: number, deletedBy?: number | null): Promise<void>;
}


// ─── ITokenAdapter ─────────────────────────────────────────────────────────
// Unified access_tokens with source discriminator.

export interface ITokenAdapter {
  CreateToken(data: Partial<AccessTokenAttributes>): Promise<void>;
  FindActiveToken(signature: string, source: 'backoffice' | 'mobile'): Promise<AccessTokenAttributes | null>;
  RevokeToken(signature: string, source: 'backoffice' | 'mobile'): Promise<number>;
}


// ─── IDeviceAdapter ────────────────────────────────────────────────────────

export interface IDeviceAdapter {
  Upsert(data: Partial<MobileDeviceAttributes>): Promise<MobileDeviceAttributes>;
}


// ─── ITeamAdapter ──────────────────────────────────────────────────────────

export interface ITeamAdapter {
  FindById(id: number): Promise<TeamAttributes | null>;
  FindAll(): Promise<TeamAttributes[]>;
  Create(data: Partial<TeamAttributes>): Promise<TeamAttributes>;
  Update(id: number, data: Partial<TeamAttributes>): Promise<TeamAttributes | null>;
  ReplaceUnits(teamId: number, units: string[], actorUserId?: number | null): Promise<void>;
  SoftDelete(id: number, deletedBy?: number | null): Promise<void>;
}


// ─── IUnitAdapter ──────────────────────────────────────────────────────────

export interface IUnitAdapter {
  FindById(id: number): Promise<UnitAttributes | null>;
  FindAll(): Promise<UnitAttributes[]>;
  Create(data: Partial<UnitAttributes>): Promise<UnitAttributes>;
  Update(id: number, data: Partial<UnitAttributes>): Promise<UnitAttributes | null>;
  SoftDelete(id: number, deletedBy?: number | null): Promise<void>;
}


// ─── IInterventionAdapter ──────────────────────────────────────────────────

export interface DashboardStats {
  Total: number;
  Open: number;
  Closed: number;
  TotalSteamFlowKg: number;
  TotalSteamFlowTonne: number;
  PriorityDistribution: { Priority: number; Count: number }[];
  StatusDistribution: { Status: number; Count: number }[];
  MonthlyTrend: { Month: string; Count: number; SteamFlowKg: number }[];
}

export interface MobileSyncPullOptions {
  UpdatedAfter: Date | null;
  SyncPoint: Date;
  Cursor: { UpdatedAt: Date; Id: number } | null;
  Limit: number;
}

export interface MobileSyncPullResult {
  Items: InterventionAttributes[];
  DeletedIds: number[];
  HasMore: boolean;
}

export type PriorityTrackingRationale =
  | 'Mancanza Operatore'
  | 'Difficolta Intercetto'
  | 'Mancanza materiali'
  | 'Permesso non aperto';

export interface PriorityTrackingItem {
  Id: number;
  SessionId: number;
  InterventionId: number;
  RankOrder: number;
  Selection: boolean;
  PS9: boolean;
  PO: boolean;
  WorkPermit: boolean;
  Rationale: PriorityTrackingRationale | null;
  CalculatedRationale: PriorityTrackingRationale | null;
  Executed: boolean;
  Tag: string;
  BusinessTeam: string;
  Unit: string | null;
  Location: string;
  Pressure: string | null;
  PlumeLength: string | null;
  PlumeSpec: string | null;
  SteamFlowKg: number | null;
  InterventionType: number;
  Euro: number;
  ExecutedAt: Date | null;
  InspectionDate: Date;
  Status: number;
}

export interface PriorityTrackingWeekResult {
  SessionId: number;
  WeekStart: Date;
  WeekEnd: Date;
  Items: PriorityTrackingItem[];
}

export interface PriorityTrackingTimelineWeek {
  SessionId: number;
  WeekStart: Date;
  WeekEnd: Date;
}

export interface PriorityTrackingTimelineCell {
  ItemId: number;
  SessionId: number;
  Selection: boolean;
  PS9: boolean;
  PO: boolean;
  WorkPermit: boolean;
  Rationale: PriorityTrackingRationale | null;
  Executed: boolean;
}

export interface PriorityTrackingTimelineRow {
  InterventionId: number;
  RankOrder: number;
  Tag: string;
  BusinessTeam: string;
  Unit: string | null;
  Location: string;
  Pressure: string | null;
  PlumeLength: string | null;
  PlumeSpec: string | null;
  SteamFlowKg: number | null;
  InterventionType: number;
  Euro: number;
  ExecutedAt: Date | null;
  InspectionDate: Date;
  Status: number;
  CalculatedRationale: PriorityTrackingRationale | null;
  Weeks: Record<string, PriorityTrackingTimelineCell>;
}

export interface PriorityTrackingTimelineResult {
  AnchorSessionId: number;
  AnchorWeekStart: Date;
  AnchorWeekEnd: Date;
  Weeks: PriorityTrackingTimelineWeek[];
  Rows: PriorityTrackingTimelineRow[];
}

export interface IInterventionAdapter {
  FindById(id: number): Promise<InterventionAttributes | null>;
  FindAllPaginated(filters: Record<string, unknown>): Promise<PaginatedResult<InterventionAttributes>>;
  FindAllForMobile(teamCode: string): Promise<InterventionAttributes[]>;
  FindMobileSyncDelta(teamCode: string, options: MobileSyncPullOptions): Promise<MobileSyncPullResult>;
  FindRecent(limit: number): Promise<InterventionAttributes[]>;
  AggregateStats(): Promise<DashboardStats>;
  Create(data: Partial<InterventionAttributes>, transaction?: unknown): Promise<InterventionAttributes>;
  Update(id: number, data: Partial<InterventionAttributes>, transaction?: unknown, expectedRowVersion?: number): Promise<InterventionAttributes | null>;
  ToggleDelete(ids: number[], deleted: boolean, deletedBy?: number | null): Promise<number>;
  FindAllForExport(teamCode?: string): Promise<InterventionAttributes[]>;
  FindAllForDashboard(filters?: { interventionType?: number; year?: number; dateFrom?: string; dateTo?: string }): Promise<InterventionAttributes[]>;
  EnsurePriorityTrackingSchema(): Promise<void>;
  EnsurePriorityTrackingWeek(weekStart: Date, weekEnd: Date): Promise<number>;
  GetPriorityTrackingWeek(weekStart: Date): Promise<PriorityTrackingWeekResult>;
  GetPriorityTrackingTimeline(weekStart: Date): Promise<PriorityTrackingTimelineResult>;
  MarkLatestPriorityTrackingItemExecuted(interventionId: number): Promise<void>;
  UpdatePriorityTrackingItem(itemId: number, patch: {
    Selection?: boolean;
    PS9?: boolean;
    PO?: boolean;
    WorkPermit?: boolean;
    Rationale?: PriorityTrackingRationale | null;
  }): Promise<void>;
}


// ─── IMediaAdapter ─────────────────────────────────────────────────────────

export interface IMediaAdapter {
  FindById(id: number): Promise<MediaAttributes | null>;
  FindByInterventionId(interventionId: number): Promise<MediaAttributes[]>;
  FindActiveByInterventionAndType(interventionId: number, mediaType: MediaSlot): Promise<MediaAttributes | null>;
  Create(data: Partial<MediaAttributes>, transaction?: unknown): Promise<MediaAttributes>;
  Update(id: number, data: Partial<MediaAttributes>, transaction?: unknown): Promise<MediaAttributes | null>;
  SoftDelete(id: number, deletedBy?: number | null): Promise<void>;
}
