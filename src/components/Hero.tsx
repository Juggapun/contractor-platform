import type { Category } from '../lib/data/categories';
import type { Province } from '../lib/data/provinces';
import { SearchEntry } from './SearchEntry';
import { AuthStatus } from './AuthStatus';

/**
 * Issue #47 round 2 (Owner chat direction, 2026-09-11): the Owner
 * explicitly reversed this round's own earlier "crop the Master into
 * separate Header/Hero/Category images" approach and asked for the
 * OPPOSITE — the entire `public/home/master-full.webp` (the Owner's full
 * 1536x1024 attachment from issue comment 5634320406, saved uncropped,
 * a plain re-encode with no redraw) is now the single visual layer for
 * the whole Home top area: Header, Hero, the 7 category cards, AND the
 * stats banner. Real, working hotspots sit on top of it at the image's
 * own button positions, same technique already established for
 * Footer.tsx (see that file's own header comment) and extended here from
 * this round's earlier Hero-only version.
 *
 * Because this one image now covers what Header.tsx / CategoryGrid.tsx /
 * StatsBanner.tsx used to render separately on this page:
 * - `Header.tsx` returns `null` on `/` specifically (see its own header
 *   comment) — otherwise the Home page would show two header bars
 *   stacked on top of each other. Every other route still gets the real,
 *   independently-sticky Header as before; only Home swaps it for this
 *   image's own baked-in header strip, which is NOT sticky — a known,
 *   Owner-accepted trade-off for this round ("match the Master first,
 *   we'll fix the rest later"), not an oversight.
 * - `CategoryGrid.tsx` is no longer rendered on the homepage (its 7-card
 *   mapping logic is reused here instead, see `CATEGORY_CARDS` below).
 * - `StatsBanner.tsx` is no longer rendered on the homepage either — the
 *   Owner explicitly asked for this round to use the Master's own
 *   baked-in placeholder numbers (5,000+ / 20,000+ / 4.8/5 / ปลอดภัย) as-
 *   is, with no code wiring real data into this section for now ("ใช้ของ
 *   ปลอมตามภาพนี้ไปก่อนโดยไม่ต้องแก้โค๊ดอะไรเราจะมาทำภายหลัง"). Neither
 *   component's own file was touched — both stay intact, unused only on
 *   this page, ready to come back once the Owner wants this section
 *   wired to real numbers again.
 *
 * All coordinates below are percentages of the image's own 1536x1024
 * pixel space, measured with a gridline-overlay crop (never eyeballed) —
 * with the `<img>` always `w-full h-auto`, percentage hotspots stay
 * aligned to the same visual spot at any viewport width, including
 * 375px, the same way Footer's hotspots already do. There is no
 * responsive reflow (a single raster image can only scale down
 * uniformly) — at narrow widths every hotspot (nav labels especially)
 * gets proportionally small along with the artwork; this is the direct,
 * expected consequence of using the whole image rather than a
 * separately-designed mobile layout, and is the same explicitly-accepted
 * trade-off noted above for "later."
 *
 * `AuthStatus` and the real `SearchEntry` form are mounted as actual
 * components (not plain hotspot links) inside percentage-positioned
 * wrapper boxes over the image's own login/signup buttons and decorative
 * search-bar mockup, so real auth state (logged-in greeting/admin links,
 * not just the Master's anonymous-state buttons) and real search
 * functionality keep working exactly as before.
 */
const HOTSPOTS: { label: string; href: string; style: { left: string; top: string; width: string; height: string } }[] = [
  // Logo — links home, same as every other page's Header logo.
  { label: 'หาช่าง - กลับหน้าแรก', href: '/', style: { left: '0%', top: '0%', width: '20.18%', height: '10.45%' } },

  // Header nav — same 5 items/destinations as Header.tsx's own NAV_LINKS
  // (see that file's header comment for the ค้นหาช่าง/สำหรับช่าง/บทความ/
  // เกี่ยวกับเรา route reasoning, unchanged this round).
  { label: 'หน้าแรก', href: '/', style: { left: '21.81%', top: '3.91%', width: '6.51%', height: '5.37%' } },
  { label: 'ค้นหาช่าง', href: '/search', style: { left: '29.30%', top: '3.91%', width: '7.49%', height: '5.37%' } },
  {
    label: 'สำหรับช่าง',
    href: '/contractors/register',
    style: { left: '37.76%', top: '3.91%', width: '7.49%', height: '5.37%' },
  },
  { label: 'บทความ', href: '/#articles', style: { left: '45.90%', top: '3.91%', width: '6.84%', height: '5.37%' } },
  { label: 'เกี่ยวกับเรา', href: '/', style: { left: '53.39%', top: '3.91%', width: '10.42%', height: '5.37%' } },

  // Header search icon — same /search destination as the ค้นหาช่าง nav
  // item and the real search form below.
  { label: 'ค้นหาช่าง', href: '/search', style: { left: '68.36%', top: '3.42%', width: '3.58%', height: '5.86%' } },

  // 7 popular category cards — same slug mapping/reasoning as this
  // round's earlier CategoryGrid.tsx (kept below in CATEGORY_CARDS).
];

// Kept separate from HOTSPOTS (rather than folded in) because each
// entry's href depends on which real `categories` slugs actually exist
// — see the render body below.
const CATEGORY_CARDS: { label: string; slug: string }[] = [
  { label: 'สร้างบ้าน', slug: 'สร้างบ้าน' },
  { label: 'รีโนเวท/ต่อเติม', slug: 'รีโนเวท' },
  { label: 'โครงสร้างเหล็ก', slug: 'โครงสร้าง' },
  { label: 'ไฟฟ้า', slug: 'ไฟฟ้า' },
  { label: 'ประปา', slug: 'ประปา' },
  { label: 'รับตรวจบ้าน', slug: 'งานระบบ' },
  { label: 'อื่นๆ', slug: 'อื่นๆ' },
];
const CATEGORY_LEFTS = ['0.52%', '13.87%', '27.21%', '40.56%', '53.91%', '67.25%', '80.60%'];
const CATEGORY_TOP = '62.99%';
const CATEGORY_HEIGHT = '17.09%';
const CATEGORY_WIDTH = '13.02%';

export function Hero({ categories, provinces }: { categories: Category[]; provinces: Province[] }) {
  const realSlugs = new Set(categories.map((c) => c.slug));

  return (
    <section className="relative overflow-hidden bg-white">
      <div className="relative mx-auto w-full max-w-[1173px]">
        <h1 className="sr-only">ศูนย์รวมผู้รับเหมาไทย — ค้นหาช่าง ดูผลงานได้ ติดต่อโดยตรง</h1>

        <div className="relative w-full">
          <img
            src="/home/master-full.webp"
            alt="หาช่าง — ศูนย์รวมผู้รับเหมาไทย ค้นหาช่าง ดูผลงานได้ ติดต่อโดยตรง — ช่างดีมีทั่วไทย เชื่อมต่อเจ้าของบ้านกับช่างคุณภาพ — หาช่างดี สร้างบ้านดี สร้างอนาคตที่ดีกว่า — ประเภทงาน: สร้างบ้าน รีโนเวท/ต่อเติม โครงสร้างเหล็ก ไฟฟ้า ประปา รับตรวจบ้าน อื่นๆ"
            width={1536}
            height={1024}
            className="block h-auto w-full"
          />

          {HOTSPOTS.map((hotspot) => (
            <a key={hotspot.label} href={hotspot.href} aria-label={hotspot.label} className="absolute" style={hotspot.style} />
          ))}

          {CATEGORY_CARDS.map((card, i) =>
            realSlugs.has(card.slug) ? (
              <a
                key={card.slug}
                href={`/search?category=${encodeURIComponent(card.slug)}`}
                aria-label={card.label}
                className="absolute"
                style={{ left: CATEGORY_LEFTS[i], top: CATEGORY_TOP, width: CATEGORY_WIDTH, height: CATEGORY_HEIGHT }}
              />
            ) : null
          )}

          {/* Real auth widget over the image's login/signup pill buttons.
              Unlike the plain hotspots above, this box is opaque white
              (matching the image's own white header background) and
              spans the full header height/right edge — AuthStatus's
              buttons render at their own natural size, not stretched to
              the image's baked pixel bounds, so a transparent box here
              would leave two mismatched copies of "เข้าสู่ระบบ" visible
              at once. A solid cover fully hides the baked-in anonymous-
              state pixels underneath instead, so a signed-in visitor
              correctly sees their real greeting/admin links here rather
              than the Master's static buttons, and the anonymous case
              (already restyled to match the Master's pill look — see
              AuthStatus.tsx) reads as one clean set of buttons, not two. */}
          <div
            className="absolute flex items-center justify-end overflow-hidden bg-white pr-2"
            style={{ left: '71.94%', top: '0%', width: '28.06%', height: '10.45%' }}
          >
            <AuthStatus />
          </div>

          {/* Real functional search overlay, over the image's own
              decorative search-bar mockup. `items-stretch` so
              SearchEntry's own white background fills this box edge-to-
              edge, fully covering the fake one underneath. */}
          <div
            className="absolute flex items-stretch overflow-hidden"
            style={{ left: '14.65%', top: '47.85%', width: '69.99%', height: '8.30%' }}
          >
            <SearchEntry categories={categories} provinces={provinces} />
          </div>
        </div>
      </div>
    </section>
  );
}
