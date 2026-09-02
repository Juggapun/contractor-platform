import type { Category } from '../lib/data/categories';
import type { Province } from '../lib/data/provinces';

/**
 * Home Page search entry point (Phase 4 scope: navigation/UI foundation
 * only). Submits as a plain GET form — no client-side JavaScript, no
 * search/filter business logic here. /search (Phase 5) will read these
 * same query params and do the real work.
 */
export function SearchEntry({
  categories,
  provinces,
}: {
  categories: Category[];
  provinces: Province[];
}) {
  return (
    <section id="search" className="scroll-mt-20 bg-white">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-slate-900">เริ่มค้นหาผู้รับเหมา</h2>
        <form
          action="/search"
          method="get"
          className="mt-6 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3 sm:p-6"
        >
          <div className="sm:col-span-1">
            <label htmlFor="search-category" className="block text-sm font-medium text-slate-700">
              ประเภทงาน
            </label>
            <select
              id="search-category"
              name="category"
              defaultValue=""
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-brand-500"
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
            <label htmlFor="search-province" className="block text-sm font-medium text-slate-700">
              จังหวัด
            </label>
            <select
              id="search-province"
              name="province"
              defaultValue=""
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-brand-500"
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
            <label htmlFor="search-q" className="block text-sm font-medium text-slate-700">
              คำค้นหา (ไม่บังคับ)
            </label>
            <input
              id="search-q"
              name="q"
              type="text"
              placeholder="เช่น ต่อเติมครัว"
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-brand-500"
            />
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              className="w-full rounded-md bg-brand-600 px-6 py-3 text-base font-semibold text-white hover:bg-brand-700 sm:w-auto"
            >
              ค้นหาผู้รับเหมา
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
