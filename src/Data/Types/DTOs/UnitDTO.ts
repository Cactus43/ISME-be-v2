import type { UnitAttributes } from '../../Models/Unit';


// ─── UnitDTO ───────────────────────────────────────────────────────────────

export interface UnitDTO {
  Id: number;
  Name: string;
  TeamId: number;
  TeamName: string | null;
  IsActive: boolean;
  UpdatedAt: Date;
  CreatedAt: Date;
}


// ─── Factory ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const UnitDTO = {

  FromModel(m: UnitAttributes): UnitDTO {
    return {
      Id: m.id,
      Name: m.name,
      TeamId: m.team_id,
      TeamName: (m as any).Team?.name ?? null,
      IsActive: m.is_active,
      UpdatedAt: m.updated_at,
      CreatedAt: m.created_at,
    };
  },
};
