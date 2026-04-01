/**
 * Generic operation result wrapper.
 * Enriches success responses with optional warnings and duration metadata.
 * Errors continue to flow through AppError / exception handling.
 */


// ─── OperationResult ───────────────────────────────────────────────────────

export class OperationResult<T = void> {

  readonly Data: T;
  readonly Warnings: string[];

  private constructor(data: T, warnings: string[]) {
    this.Data = data;
    this.Warnings = warnings;
  }

  get HasWarnings(): boolean {
    return this.Warnings.length > 0;
  }

  /** Successful result with data. */
  static Ok<T>(data: T, warnings?: string[]): OperationResult<T> {
    return new OperationResult(data, warnings ?? []);
  }

  /** Successful void result (Delete, Logout, etc.). */
  static Void(warnings?: string[]): OperationResult<void> {
    return new OperationResult<void>(void 0, warnings ?? []);
  }
}
