import type { Category } from '../lib/data/categories';
import type { Province } from '../lib/data/provinces';

/**
 * Home Page search entry point (Phase 4 scope: navigation/UI foundation
 * only). Submits as a plain GET form — no client-side JavaScript, no
 * search/filter business logic here. /search (Phase 5) will read these
 * same query params and do the real work.
 *
 * Issue #42, Layer A final calibration — the Master's "FINAL GEOMETRY +
 * COLOR CALIBRATION" comment reserves an explicit ~380px-wide search
 * slot "centered in the lower part of Hero" and is explicit that
 * "search must remain visually inside Hero; it must NOT increase Hero
 * height" — so this is no longer its own `<section>` with its own
 * background/padding budget (that made Hero+Search's combined height
 * uncontrolled). It's now a plain nested `<div id="search">` rendered
 * BY Hero.tsx, sized to the reserved slot, sharing Hero's single fixed
 * height budget. Field labels are `sr-only` (kept for accessibility)
 * since the reserved slot width is too narrow for stacked visible
 * labels above every field without exceeding Hero's height budget —
 * placeholder text remains the visible affordance. The real keyword
 * field (`q`) is kept — Issue #40's search-suggestion logic reads this
 * same param, and dropping it would be a functional regression this
 * geometry-only pass has no business making.
 */
export function SearchEntry({
  categories,
  provinces,
}: {
  categories: Category[];
  provinces: Province[];
}) {
  return (
    <div id="search" className="mx-auto w-full max-w-[597px]">
      <h2 className="sr-only">เริ่มค้นหาผู้รับเหมา</h2>
      <form
        action="/search"
        method="get"
        className="grid grid-cols-2 gap-2 rounded-xl bg-white p-3 shadow-lg sm:grid-cols-4 sm:items-end"
      >
        <div>
          <label htmlFor="search-province" className="sr-only">
            จังหวัด
          </label>
          <select
            id="search-province"
            name="province"
            defaultValue=""
            className="block w-full rounded-md border border-master-border bg-white px-2 py-2 text-xs text-master-text sm:text-sm"
          >
            <option value="">ทุกจังหวัด</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.slug}>
                {p.name_th}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="search-category" className="sr-only">
            ประเภทงาน
          </label>
          <select
            id="search-category"
            name="category"
            defaultValue=""
            className="block w-full rounded-md border border-master-border bg-white px-2 py-2 text-xs text-master-text sm:text-sm"
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
          <label htmlFor="search-q" className="sr-only">
            คำค้นหา (ไม่บังคับ)
          </label>
          <input
            id="search-q"
            name="q"
            type="text"
            placeholder="เช่น ต่อเติมครัว"
            className="block w-full rounded-md border border-master-border bg-white px-2 py-2 text-xs text-master-text placeholder:text-slate-400 sm:text-sm"
          />
        </div>

        <div>
          <button
            type="submit"
            className="w-full rounded-md bg-master-yellow-accent px-3 py-2 text-xs font-semibold text-master-text shadow-sm hover:brightness-95 sm:text-sm"
          >
            ค้นหาช่าง
          </button>
        </div>
      </form>
    </div>
  );
}
