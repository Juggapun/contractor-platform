import type { Category } from '../lib/data/categories';
import type { Province } from '../lib/data/provinces';

/**
 * Home Page search entry point (Phase 4 scope: navigation/UI foundation
 * only). Submits as a plain GET form — no client-side JavaScript, no
 * search/filter business logic here. /search (Phase 5) will read these
 * same query params and do the real work.
 *
 * Issue #42, Layer A — restyled yellow (bg-brand-400, matching Hero.tsx
 * exactly) so this section reads as the SAME hero block continuing
 * downward to the search bar near its bottom edge, per the Master
 * Design Reference crop. The visible "เริ่มค้นหาผู้รับเหมา" heading is
 * gone (the reference has no heading above its search bar at all) —
 * replaced with an sr-only one so the form still has an accessible
 * name. Field ORDER changed to match the reference's left-to-right
 * layout (province, then job type), but the real keyword field (`q`)
 * is kept — the reference crop simply doesn't show it (a tighter crop
 * of just this bar), and removing a real, already-shipped, tested
 * search capability (Issue #40's search-suggestion logic reads this
 * same `q` param) would be a functional regression this Layer-A
 * geometry pass has no business making.
 */
export function SearchEntry({
  categories,
  provinces,
}: {
  categories: Category[];
  provinces: Province[];
}) {
  return (
    <section id="search" className="scroll-mt-20 bg-brand-400">
      <div className="mx-auto max-w-4xl px-4 pb-10 pt-2 sm:px-6 sm:pb-14">
        <h2 className="sr-only">เริ่มค้นหาผู้รับเหมา</h2>
        <form
          action="/search"
          method="get"
          className="grid gap-4 rounded-xl bg-white p-4 shadow-lg sm:grid-cols-4 sm:items-end sm:p-6"
        >
          <div className="sm:col-span-1">
            <label htmlFor="search-province" className="block text-sm font-medium text-slate-700">
              จังหวัด
            </label>
            <select
              id="search-province"
              name="province"
              defaultValue=""
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

          <div className="sm:col-span-1">
            <label htmlFor="search-category" className="block text-sm font-medium text-slate-700">
              ประเภทงาน
            </label>
            <select
              id="search-category"
              name="category"
              defaultValue=""
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

          <div className="sm:col-span-1">
            <label htmlFor="search-q" className="block text-sm font-medium text-slate-700">
              คำค้นหา (ไม่บังคับ)
            </label>
            <input
              id="search-q"
              name="q"
              type="text"
              placeholder="เช่น ต่อเติมครัว"
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="sm:col-span-1">
            <button
              type="submit"
              className="w-full rounded-md bg-brand-400 px-6 py-2.5 text-base font-semibold text-slate-900 shadow-sm hover:bg-brand-500"
            >
              ค้นหาช่าง
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
