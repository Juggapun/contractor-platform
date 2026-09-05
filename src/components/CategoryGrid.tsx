import type { Category } from '../lib/data/categories';
import { AssetPlaceholder } from './AssetPlaceholder';

/**
 * Sourced entirely from public.categories (Phase 2 schema) — no second,
 * hard-coded category list. If the query returned nothing (Supabase not
 * configured, or the table is genuinely empty), this renders an honest
 * empty state rather than inventing categories.
 *
 * Issue #42, Layer A — each category icon is a real illustrated asset
 * in the Master Design Reference; per that issue's own rule, this must
 * not substitute emoji for it (a prior pass here used emoji — reverted).
 * Every category gets a reserved `AssetPlaceholder` slot instead
 * (`categories.icon`, Phase 2 schema, still wins whenever a real icon
 * URL is populated there — this placeholder only covers today's actual
 * data, where that column is unset for every row).
 *
 * Still all 10 REAL categories from the database, not reduced to the
 * 8 buckets the reference shows — the reference's category set doesn't
 * line up 1:1 with this system's real taxonomy (e.g. it has no separate
 * "โครงสร้าง"/"ถนน" categories, and groups interior/fence work this
 * schema doesn't have at all), and this issue's own "use real
 * database-driven categories... do not fabricate" rule outranks
 * matching the reference's exact bucket count.
 *
 * Issue #42, Layer A final calibration — height locked to ~144px at
 * `lg:` (92/815 of the Master's reference canvas, scaled by this
 * codebase's 1280px desktop QA viewport — see Hero.tsx's comment) via
 * `lg:min-h` + `lg:flex` centering, not padding alone, so the section
 * is the geometry owner and its content is the child (per the Master's
 * own "section padding/container/card sizing owns geometry, never
 * placeholder/content intrinsic size" rule). Container width unified
 * to the Master's ~1173px content-width token (747/815 reference
 * ratio) shared by every Home section.
 */
export function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <section id="categories" className="scroll-mt-20 bg-white lg:flex lg:min-h-[144px] lg:items-center">
      <div className="mx-auto w-full max-w-[1173px] px-4 py-4 sm:px-[53px] lg:py-1">
        <h2 className="text-center text-2xl font-bold text-master-text lg:text-base">ประเภทงานยอดนิยม</h2>
        <p className="mx-auto mt-1 max-w-xl text-center text-[15px] leading-relaxed text-slate-600 lg:mt-0.5 lg:text-[11px]">
          เลือกประเภทงานที่ต้องการ เพื่อเริ่มค้นหาผู้รับเหมาที่เหมาะสม
        </p>

        {categories.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-6 text-center text-[15px] leading-relaxed text-slate-500">
            ยังไม่มีข้อมูลหมวดหมู่ในขณะนี้
          </p>
        ) : (
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-10 lg:mt-1 lg:gap-[10px]">
            {categories.map((category) =>
              category.icon ? (
                <li key={category.id}>
                  <a
                    href={`/search?category=${encodeURIComponent(category.slug)}`}
                    className="flex h-full flex-col items-center gap-1 rounded-lg border border-master-border p-1.5 text-center hover:border-brand-400 hover:bg-brand-50"
                  >
                    <img src={category.icon} alt="" className="h-6 w-6" />
                    <span className="text-[11px] font-medium text-master-text">{category.name_th}</span>
                  </a>
                </li>
              ) : (
                <li key={category.id}>
                  <a
                    href={`/search?category=${encodeURIComponent(category.slug)}`}
                    className="flex h-full flex-col items-center gap-1 rounded-lg border border-master-border p-1.5 text-center hover:border-brand-400 hover:bg-brand-50"
                  >
                    <AssetPlaceholder label="ไอคอน" shape="circle" className="h-6 w-6 text-[8px]" />
                    <span className="text-[11px] font-medium text-master-text">{category.name_th}</span>
                  </a>
                </li>
              )
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
