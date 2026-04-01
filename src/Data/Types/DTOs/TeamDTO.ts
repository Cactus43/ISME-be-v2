import type { TeamAttributes } from '../../Models/Team';


// ─── TeamDTO ───────────────────────────────────────────────────────────────

export interface TeamDTO {
  Id: number;
  Name: string;
  Code: string;
  Description: string | null;
  IsActive: boolean;
  UpdatedAt: Date;
  CreatedAt: Date;
}


// ─── Factory ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const TeamDTO = {

  FromModel(m: TeamAttributes): TeamDTO {
    return {
      Id: m.id,
      Name: m.name,
      Code: m.code,
      Description: m.description,
      IsActive: m.is_active,
      UpdatedAt: m.updated_at,
      CreatedAt: m.created_at,
    };
  },
};
