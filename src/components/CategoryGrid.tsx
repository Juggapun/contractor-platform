/**
 * Issue #47, Final QA item 3 (comment 5634035539 + Owner approval
 * 5634333481): the Owner locked this section down to exactly 7 display
 * cards, in this exact order/wording, replacing the previous "render
 * every row from public.categories" approach:
 * สร้างบ้าน / รีโนเวท/ต่อเติม / โครงสร้างเหล็ก / ไฟฟ้า / ประปา /
 * รับตรวจบ้าน / อื่นๆ — this supersedes Issue #42 Layer A's original
 * "show all 10 real categories, don't reduce to 8 buckets" rule for
 * *this section specifically*; the underlying `categories` table,
 * `/search`'s own filter dropdown (SearchEntry.tsx), and RLS are all
 * untouched, so nothing here reduces the real taxonomy, only what this
 * one homepage section chooses to surface.
 *
 * Each display card's `href` still resolves to a REAL row in
 * `public.categories` (`/search?category=<real slug>`) — no new
 * category, filter, or backend concept was invented. Three of the 7
 * display labels don't have an exact 1:1 name match in the table, so
 * per the Owner's own explicit "choose the most semantically fitting
 * existing category without building a new system" instruction:
 * - "รีโนเวท/ต่อเติม" (a combined label) → `รีโนเวท` alone (the table
 *   only supports a single category per search filter — no multi-
 *   category query exists anywhere in this codebase — so one of the two
 *   real categories has to be chosen; รีโนเวท is named first in the
 *   Owner's own label).
 * - "โครงสร้างเหล็ก" → `โครงสร้าง` (the table has no separate "เหล็ก"/
 *   steel-specific row; โครงสร้าง — general structural work — is the
 *   closest real match).
 * - "รับตรวจบ้าน" (home inspection) → `งานระบบ` (no category in the
 *   table represents an inspection *service* at all — every real row is
 *   a construction *trade*; งานระบบ, the general "building systems"
 *   category, has the closest conceptual overlap with "inspecting a
 *   home's systems" among the remaining unused rows, and keeps every
 *   one of the 7 cards pointing at a distinct category rather than two
 *   cards silently converging on the same search results).
 * `ต่อเติม`, `หลังคา`, and `ถนน` stay real, selectable rows — just not
 * surfaced as one of this section's 7 cards — still reachable from
 * SearchEntry's own full category dropdown and directly via `/search`.
 *
 * Icons: cropped directly from the Owner's supplied Final Home Master
 * image (issue comment 5634320406) at `public/icons/categories/*.webp`
 * — the exact mascot artwork the Owner specified (pink floral shorts,
 * light-blue sandals), never redrawn/generated. `CATEGORY_CARDS` below
 * is this section's own fixed display list; it intentionally does NOT
 * read `category.icon` from the database (unset for every real row —
 * see the removed AssetPlaceholder-fallback logic this replaced).
 *
 * If a mapped slug isn't present in the categories actually returned by
 * the database (e.g. a future rename), that one card is quietly
 * dropped rather than linking to a broken filter — no fabricated
 * destination, matching this file's Issue #42 "do not invent
 * categories" rule.
 *
 * Layer A geometry (unchanged from Issue #42/#47 item 1&2): section
 * height + shared `max-w-[1173px]` content-width token, same as every
 * other Home section.
 */
import type { Category } from '../lib/data/categories';

const CATEGORY_CARDS: { label: string; slug: string; icon: string }[] = [
  { label: 'สร้างบ้าน', slug: 'สร้างบ้าน', icon: '/icons/categories/home-building.webp' },
  { label: 'รีโนเวท/ต่อเติม', slug: 'รีโนเวท', icon: '/icons/categories/renovation-extension.webp' },
  { label: 'โครงสร้างเหล็ก', slug: 'โครงสร้าง', icon: '/icons/categories/steel-structure.webp' },
  { label: 'ไฟฟ้า', slug: 'ไฟฟ้า', icon: '/icons/categories/electrical.webp' },
  { label: 'ประปา', slug: 'ประปา', icon: '/icons/categories/plumbing.webp' },
  { label: 'รับตรวจบ้าน', slug: 'งานระบบ', icon: '/icons/categories/home-inspection.webp' },
  { label: 'อื่นๆ', slug: 'อื่นๆ', icon: '/icons/categories/other.webp' },
];

export function CategoryGrid({ categories }: { categories: Category[] }) {
  const realSlugs = new Set(categories.map((c) => c.slug));
  const cards = CATEGORY_CARDS.filter((card) => realSlugs.has(card.slug));

  return (
    <section id="categories" className="scroll-mt-20 bg-white lg:flex lg:min-h-[144px] lg:items-center">
      <div className="mx-auto w-full max-w-[1173px] px-4 py-4 sm:px-[53px] lg:py-1">
        <h2 className="text-center text-2xl font-bold text-master-text lg:text-base">ประเภทงานยอดนิยม</h2>
        <p className="mx-auto mt-1 max-w-xl text-center text-[15px] leading-relaxed text-slate-600 lg:mt-0.5 lg:text-[11px]">
          เลือกประเภทงานที่ต้องการ เพื่อเริ่มค้นหาผู้รับเหมาที่เหมาะสม
        </p>

        {cards.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-6 text-center text-[15px] leading-relaxed text-slate-500">
            ยังไม่มีข้อมูลหมวดหมู่ในขณะนี้
          </p>
        ) : (
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:mt-1 lg:grid-cols-7 lg:gap-[10px]">
            {cards.map((card) => (
              <li key={card.slug}>
                <a
                  href={`/search?category=${encodeURIComponent(card.slug)}`}
                  className="flex h-full flex-col items-center gap-1 rounded-lg border border-master-border p-1.5 text-center hover:border-brand-400 hover:bg-brand-50"
                >
                  <img src={card.icon} alt="" className="h-12 w-12 lg:h-10 lg:w-10" />
                  <span className="text-[11px] font-medium text-master-text">{card.label}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
