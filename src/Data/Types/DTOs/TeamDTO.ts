import type { TeamAttributes } from '../../Models/Team';


// ─── TeamDTO ───────────────────────────────────────────────────────────────

export interface TeamDTO {
  Id: number;
  Name: string;
  Code: string;
  Description: string | null;
  Units: string[];
  IsActive: boolean;
  UpdatedAt: Date;
  CreatedAt: Date;
}


// ─── Factory ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const TeamDTO = {

  FromModel(m: TeamAttributes): TeamDTO {
    const unitRows = ((m as any).Units ?? []) as Array<{ name: string; is_active?: boolean }>;
    const units = unitRows
      .filter((u) => u?.name && (u.is_active ?? true))
      .map((u) => u.name)
      .sort((a, b) => a.localeCompare(b));

    return {
      Id: m.id,
      Name: m.name,
      Code: m.code,
      Description: m.description,
      Units: units,
      IsActive: m.is_active,
      UpdatedAt: m.updated_at,
      CreatedAt: m.created_at,
    };
  },
};
