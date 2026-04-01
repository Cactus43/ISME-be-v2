/**
 * Adapter interfaces — repository-pattern contracts.
 * Inner layers depend on these; outer layers implement them.
 * Unified: operators merged into users, tokens merged into access_tokens.
 */

import type { AccessTokenAttributes } from '../Models/AccessToken';
import type { MobileDeviceAttributes } from '../Models/MobileDevice';
import type { UserAttributes } from '../Models/User';
import type { TeamAttributes } from '../Models/Team';
import type { InterventionAttributes } from '../Models/Intervention';
import type { MediaAttributes } from '../Models/Media';
import type { PaginatedResult } from '../Types/Pagination';


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

export interface IInterventionAdapter {
  FindById(id: number): Promise<InterventionAttributes | null>;
  FindAllPaginated(filters: Record<string, unknown>): Promise<PaginatedResult<InterventionAttributes>>;
  FindAllForMobile(teamCode: string): Promise<InterventionAttributes[]>;
  FindRecent(limit: number): Promise<InterventionAttributes[]>;
  AggregateStats(): Promise<DashboardStats>;
  Create(data: Partial<InterventionAttributes>, transaction?: unknown): Promise<InterventionAttributes>;
  Update(id: number, data: Partial<InterventionAttributes>): Promise<InterventionAttributes | null>;
  ToggleDelete(ids: number[], deleted: boolean, deletedBy?: number | null): Promise<number>;
  FindAllForExport(teamCode?: string): Promise<InterventionAttributes[]>;
  FindAllForDashboard(filters?: { interventionType?: number; year?: number; dateFrom?: string; dateTo?: string }): Promise<InterventionAttributes[]>;
}


// ─── IMediaAdapter ─────────────────────────────────────────────────────────

export interface IMediaAdapter {
  FindById(id: number): Promise<MediaAttributes | null>;
  FindByInterventionId(interventionId: number): Promise<MediaAttributes[]>;
  Create(data: Partial<MediaAttributes>, transaction?: unknown): Promise<MediaAttributes>;
  SoftDelete(id: number, deletedBy?: number | null): Promise<void>;
}
