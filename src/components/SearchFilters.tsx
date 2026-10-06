import type { Category } from '../lib/data/categories';
import type { Province } from '../lib/data/provinces';
import type { ParsedSearchParams } from '../lib/search/params';

/**
 * Plain GET form — no client-side JavaScript. Submitting always drops
 * `page` (a filter change legitimately resets pagination to page 1).
 * `defaultValue`s reflect the currently-active filters (from the URL),
 * so this form always shows what's actually being searched for and can
 * be adjusted and resubmitted, or cleared via the plain `/search` link.
 */
export function SearchFilters({
  categories,
  provinces,
  current,
}: {
  categories: Category[];
  provinces: Province[];
  current: ParsedSearchParams;
}) {
  const hasActiveFilters = Boolean(current.category || current.province || current.q);

  return (
    <form
      action="/search"
      method="get"
      className="search-filter-form"
    >
      <div className="search-filter-heading"><strong>คุณกำลังมองหาช่างแบบไหน?</strong>{hasActiveFilters ? <a href="/search">ล้างตัวกรอง</a> : null}</div>
      <div>
        <label htmlFor="filter-category" className="block text-sm font-medium text-slate-700">
          ประเภทงาน
        </label>
        <select
          id="filter-category"
          name="category"
          defaultValue={current.category ?? ''}
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
        >
          <option value="">ทุกประเภทงาน</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name_th}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="filter-province" className="block text-sm font-medium text-slate-700">
          จังหวัด
        </label>
        <select
          id="filter-province"
          name="province"
          defaultValue={current.province ?? ''}
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
        >
          <option value="">ทุกจังหวัด</option>
          {provinces.map((p) => (
            <option key={p.id} value={p.slug}>
              {p.name_th}
            </option>
          ))}
        </select>
      </div>

      <div className="search-filter-keyword">
        <label htmlFor="filter-q" className="block text-sm font-medium text-slate-700">
          คำค้นหา (ไม่บังคับ)
        </label>
        <input
          id="filter-q"
          name="q"
          type="text"
          defaultValue={current.q ?? ''}
          placeholder="เช่น ต่อเติมครัว"
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400"
        />
      </div>

      <div className="search-filter-actions">
        <button type="submit">ค้นหาช่าง</button>
      </div>
    </form>
  );
}
