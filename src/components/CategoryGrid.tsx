import type { Category } from '../lib/data/categories';

/**
 * Issue #42 — a nicer fallback icon per REAL category name, used only
 * when `categories.icon` (Phase 2 schema) is unset, which it is for
 * every row in this environment today. This is purely cosmetic and adds
 * no category that doesn't already exist in the database — if the
 * database ever gets its own populated `icon` values, or a category is
 * renamed/removed, that data still wins (see the `||` fallback below);
 * this map just replaces the single generic 🔧 every card fell back to
 * before with something closer to the Master Design Reference's
 * per-category icon style.
 */
const CATEGORY_ICON_FALLBACK: Record<string, string> = {
  สร้างบ้าน: '🏠',
  ต่อเติม: '🔨',
  รีโนเวท: '🎨',
  โครงสร้าง: '🏗️',
  ไฟฟ้า: '⚡',
  ประปา: '🚰',
  หลังคา: '🏚️',
  ถนน: '🛣️',
  งานระบบ: '🔧',
  อื่นๆ: '➕',
};

/**
 * Sourced entirely from public.categories (Phase 2 schema) — no second,
 * hard-coded category list. If the query returned nothing (Supabase not
 * configured, or the table is genuinely empty), this renders an honest
 * empty state rather than inventing categories.
 */
export function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <section id="categories" className="scroll-mt-20 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-slate-900">ประเภทงานยอดนิยม</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-[15px] leading-relaxed text-slate-600">
          เลือกประเภทงานที่ต้องการ เพื่อเริ่มค้นหาผู้รับเหมาที่เหมาะสม
        </p>

        {categories.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-slate-300 p-6 text-center text-[15px] leading-relaxed text-slate-500">
            ยังไม่มีข้อมูลหมวดหมู่ในขณะนี้
          </p>
        ) : (
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {categories.map((category) => (
              <li key={category.id}>
                <a
                  href={`/search?category=${encodeURIComponent(category.slug)}`}
                  className="flex h-full flex-col items-center gap-2 rounded-lg border border-slate-200 p-4 text-center hover:border-brand-400 hover:bg-brand-50"
                >
                  <span aria-hidden="true" className="text-2xl">
                    {category.icon || CATEGORY_ICON_FALLBACK[category.name_th] || '🔧'}
                  </span>
                  <span className="text-sm font-medium text-slate-800">{category.name_th}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
