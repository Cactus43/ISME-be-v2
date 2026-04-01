/**
 * Auth-related DTOs.
 * Unified: operators are now users with role='operator'.
 */


// ─── Backoffice ────────────────────────────────────────────────────────────

export interface BackofficeUserDTO {
  Id: number;
  Firstname: string;
  Lastname: string;
  Email: string | null;
  Role: string;
  Lang: string;
}

export interface BackofficeLoginResult {
  Token: string;
  User: BackofficeUserDTO;
}

export interface BackofficeSessionResult {
  Valid: boolean;
  User?: BackofficeUserDTO;
}


// ─── Mobile ────────────────────────────────────────────────────────────────

export interface MobileUserDTO {
  Id: number;
  Firstname: string;
  Lastname: string;
  Username: string | null;
  TeamId: number | null;
}

export interface MobileLoginResult {
  Token: string;
  User: MobileUserDTO;
}

export interface MobileSessionResult {
  Valid: boolean;
  User?: MobileUserDTO;
}
