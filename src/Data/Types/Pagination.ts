/**
 * Shared pagination types.
 */

export interface PaginationMeta {
  Total: number;
  Page: number;
  Limit: number;
  Pages: number;
}

export interface PaginatedResult<T> {
  Data: T[];
  Pagination: PaginationMeta;
}
