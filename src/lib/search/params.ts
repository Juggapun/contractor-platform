/**
 * Sanitizes the raw searchParams object Next.js hands a Server
 * Component page into the shape searchContractors() expects. Centralized
 * here (rather than inline in the page) so it has its own unit tests —
 * this is exactly the surface a hostile/malformed query string hits
 * (Issue #2, "malformed/hostile query parameters are handled safely").
 */

export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface ParsedSearchParams {
  category?: string | undefined;
  province?: string | undefined;
  q?: string | undefined;
  page: number;
}

const MAX_FILTER_LENGTH = 100;

/** Next.js types a repeated query key (?x=a&x=b) as string[] — always
 * take the first value rather than let an array reach a query builder
 * that expects a scalar. */
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function sanitizeFilterValue(raw: string | string[] | undefined): string | undefined {
  const value = firstValue(raw);
  if (value === undefined) return undefined;
  const trimmed = value.trim().slice(0, MAX_FILTER_LENGTH);
  return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizePage(raw: string | string[] | undefined): number {
  const value = firstValue(raw);
  if (value === undefined) return 1;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  // A page number this large can only be a mistake or a probe — clamp
  // rather than let it flow into an OFFSET calculation unbounded.
  return Math.min(parsed, 100_000);
}

export function parseSearchParams(raw: RawSearchParams): ParsedSearchParams {
  return {
    category: sanitizeFilterValue(raw.category),
    province: sanitizeFilterValue(raw.province),
    q: sanitizeFilterValue(raw.q),
    page: sanitizePage(raw.page),
  };
}
