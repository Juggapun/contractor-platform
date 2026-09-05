import type { Category } from '../lib/data/categories';
import type { Province } from '../lib/data/provinces';

/**
 * Home Page search entry point (Phase 4 scope: navigation/UI foundation
 * only). Submits as a plain GET form — no client-side JavaScript, no
 * search/filter business logic here. /search (Phase 5) will read these
 * same query params and do the real work.
 *
 * Issue #42, Layer B revised Hero direction (comment #5553946233) —
 * this is now a real, fully-functional foreground overlay positioned
 * by Hero.tsx directly on top of the full Hero Master artwork's own
 * decorative search-bar mockup (see Hero.tsx's own header comment for
 * the exact overlay position/rationale), rather than a fixed-width
 * slot below a cropped image. Sizing is entirely controlled by Hero's
 * positioning wrapper (`w-full h-full` here), not by this component.
 * Field labels are `sr-only` (kept for accessibility) since the
 * overlay is compact — placeholder text remains the visible
 * affordance. The real keyword field (`q`) is kept — Issue #40's
 * search-suggestion logic reads this same param, and dropping it would
 * be a functional regression this asset-insertion pass has no business
 * making.
 */
export function SearchEntry({
  categories,
  provinces,
}: {
  categories: Category[];
  provinces: Province[];
}) {
  return (
    <div id="search" className="flex h-full w-full items-stretch rounded-xl bg-white shadow-lg">
      <h2 className="sr-only">เริ่มค้นหาผู้รับเหมา</h2>
      <form
        action="/search"
        method="get"
        className="grid w-full grid-cols-2 items-center gap-2 p-3 sm:grid-cols-4"
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
