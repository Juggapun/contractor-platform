import type { ParsedSearchParams } from '../lib/search/params';

function buildHref(current: ParsedSearchParams, page: number): string {
  const params = new URLSearchParams();
  if (current.category) params.set('category', current.category);
  if (current.province) params.set('province', current.province);
  if (current.q) params.set('q', current.q);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `/search?${qs}` : '/search';
}

export function SearchPagination({
  current,
  page,
  totalPages,
}: {
  current: ParsedSearchParams;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav aria-label="หน้าผลการค้นหา" className="flex items-center justify-center gap-3">
      {hasPrev ? (
        <a
          href={buildHref(current, page - 1)}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          ← ก่อนหน้า
        </a>
      ) : (
        <span
          aria-disabled="true"
          className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-300"
        >
          ← ก่อนหน้า
        </span>
      )}

      <span className="text-sm text-slate-600">
        หน้า {page} จาก {totalPages}
      </span>

      {hasNext ? (
        <a
          href={buildHref(current, page + 1)}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          ถัดไป →
        </a>
      ) : (
        <span
          aria-disabled="true"
          className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-300"
        >
          ถัดไป →
        </span>
      )}
    </nav>
  );
}
