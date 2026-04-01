/**
 * Policy objects — injectable business-rule configurations.
 * Operations consult policies instead of hardcoding thresholds.
 * Swap policies at composition time for testing or environment-specific behaviour.
 */


// ─── InterventionPolicy ───────────────────────────────────────────────────

export interface InterventionPolicy {
  MaxBulkDeleteCount: number;
  RequireRepairDateForClosure: boolean;
  MaxPhotoSizeBytes: number;
}

export const DEFAULT_INTERVENTION_POLICY: InterventionPolicy = {
  MaxBulkDeleteCount: 50,
  RequireRepairDateForClosure: true,
  MaxPhotoSizeBytes: 14_000_000,
};


// ─── MediaPolicy ──────────────────────────────────────────────────────────

export interface MediaPolicy {
  AllowedMimeTypes: string[];
  MaxFileSizeBytes: number;
}

export const DEFAULT_MEDIA_POLICY: MediaPolicy = {
  AllowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  MaxFileSizeBytes: 14_000_000,
};


// ─── AuthPolicy ───────────────────────────────────────────────────────────

export interface AuthPolicy {
  MaxFailedAttempts: number;
  LockoutMinutes: number;
}

export const DEFAULT_AUTH_POLICY: AuthPolicy = {
  MaxFailedAttempts: 5,
  LockoutMinutes: 15,
};
