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
 */
export function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <section id="categories" className="scroll-mt-20 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-slate-900">ประเภทงานยอดนิยม</h2>
        <p className="mx-auto mt-1 max-w-xl text-center text-[15px] leading-relaxed text-slate-600">
          เลือกประเภทงานที่ต้องการ เพื่อเริ่มค้นหาผู้รับเหมาที่เหมาะสม
        </p>

        {categories.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-6 text-center text-[15px] leading-relaxed text-slate-500">
            ยังไม่มีข้อมูลหมวดหมู่ในขณะนี้
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-10">
            {categories.map((category) =>
              category.icon ? (
                <li key={category.id}>
                  <a
                    href={`/search?category=${encodeURIComponent(category.slug)}`}
                    className="flex h-full flex-col items-center gap-2 rounded-lg border border-slate-200 p-2 text-center hover:border-brand-400 hover:bg-brand-50"
                  >
                    <img src={category.icon} alt="" className="h-8 w-8" />
                    <span className="text-xs font-medium text-slate-800">{category.name_th}</span>
                  </a>
                </li>
              ) : (
                <li key={category.id}>
                  <a
                    href={`/search?category=${encodeURIComponent(category.slug)}`}
                    className="flex h-full flex-col items-center gap-2 rounded-lg border border-slate-200 p-2 text-center hover:border-brand-400 hover:bg-brand-50"
                  >
                    <AssetPlaceholder label="ไอคอน" shape="circle" className="h-8 w-8 text-[9px]" />
                    <span className="text-xs font-medium text-slate-800">{category.name_th}</span>
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
