import type { UserAttributes } from '../../Models/User';


// ─── OperatorDTO ───────────────────────────────────────────────────────────

/**
 * Operator projected for API consumption — queries users WHERE role='operator'.
 * Password and audit cols are never exposed.
 */
export interface OperatorDTO {
  Id: number;
  Firstname: string;
  Lastname: string;
  Email: string | null;
  Username: string | null;
  TeamId: number | null;
  IsActive: boolean;
  UpdatedAt: Date;
  CreatedAt: Date;
}


// ─── Factory ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const OperatorDTO = {

  FromModel(m: UserAttributes): OperatorDTO {
    return {
      Id: m.id,
      Firstname: m.firstname,
      Lastname: m.lastname,
      Email: m.email,
      Username: m.username,
      TeamId: m.team_id,
      IsActive: m.is_active,
      UpdatedAt: m.updated_at,
      CreatedAt: m.created_at,
    };
  },
};
