import type { Category } from '../lib/data/categories';
import type { Province } from '../lib/data/provinces';
import { SearchEntry } from './SearchEntry';

/**
 * Issue #47 round 2 (Owner chat direction, 2026-09-11): the Owner
 * explicitly reversed this round's own earlier "crop the Master into
 * separate Header/Hero/Category images" approach and asked for the
 * OPPOSITE — the entire `public/home/master-full.webp` is now the single
 * visual layer for the whole Home top area: Header, Hero, the 7 category
 * cards, AND the stats banner. Real, working hotspots sit on top of it
 * at the image's own button positions, same technique already
 * established for Footer.tsx (see that file's own header comment).
 * `master-full.webp` itself was replaced once more later the same round:
 * the Owner pasted a cleaner 1536x1024 export of the identical
 * composition directly into chat (not another GitHub issue attachment)
 * and asked for it specifically — a raw pixel diff against the prior
 * GitHub-attachment version confirmed the same layout/content at every
 * coordinate below (edge-only differences consistent with a fresher,
 * less-compressed export, not a redesign), so none of the hotspot
 * coordinates in this file needed to change.
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
 *   is, with no code wiring real data into this section for now. Neither
 *   component's own file was touched — both stay intact, unused only on
 *   this page, ready to come back once the Owner wants this section
 *   wired to real numbers again.
 *
 * Issue #47 round 3 (Owner chat direction, same day): the Owner's first
 * round-2 pass over this file put a REAL, live-rendered `AuthStatus` and
 * `SearchEntry` on top of the image (a white cover box + the actual
 * component, not a plain hotspot) specifically so login/signup could
 * show true auth state and the search form could actually submit. The
 * Owner looked at that result and asked for the opposite for THIS
 * round: plain clickable hotspots over the image's own baked login/
 * signup buttons and search-bar mockup — same treatment as the nav
 * links and category cards below — explicitly deferring the real
 * auth-state widget and real inline search form to a later round
 * ("ไม่ต้องแก้โค๊ดนะ ... เราจะมาทำภายหลัง เอาให้ตรงมาสเตอร์ก่อน"). Login/
 * signup stayed plain hotspots (see below) — but see round 4 for the
 * search bar, which round 3 also flattened to one plain hotspot.
 *
 * Issue #47 round 4 (Owner testing feedback, same day): the Owner tried
 * the round-3 search bar live and reported it — correctly — as broken:
 * clicking "เลือกจังหวัด"/"ประเภทงาน" opened no dropdown at all, and the
 * keyword box couldn't be typed into, because round 3's single flat
 * hotspot was just one big link to `/search` with no real form fields
 * under it. Login/signup were never reported broken (a plain link to a
 * real page needs no dropdown/typing to "work"), so those stay exactly
 * as round 3 left them. The search bar goes back to a real `SearchEntry`
 * overlay — genuine native `<select>`s (a real click opens a real
 * dropdown) and a real text `<input>` — restoring actual search
 * functionality. `AuthStatus` (login/signup) is still not rendered here
 * — only `SearchEntry` came back.
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
  // item and the search-bar hotspot below.
  { label: 'ค้นหาช่าง', href: '/search', style: { left: '68.36%', top: '3.42%', width: '3.58%', height: '5.86%' } },

  // Login/signup — round 3: plain hotspots over the image's own baked
  // pill buttons (see this file's header comment), same real /login and
  // /signup destinations AuthStatus's anonymous state already used.
  {
    label: 'เข้าสู่ระบบ',
    href: '/login?redirect=%2F',
    style: { left: '76.17%', top: '2.73%', width: '8.46%', height: '6.25%' },
  },
  { label: 'สมัครสมาชิก', href: '/signup', style: { left: '87.24%', top: '2.15%', width: '10.42%', height: '7.42%' } },

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

          {HOTSPOTS.map((hotspot, i) => (
            // Index, not `label`/`href`, as the key — several entries
            // share a label (e.g. the ค้นหาช่าง nav item, the header
            // search icon, and the search-bar hotspot) or an href (the
            // logo, หน้าแรก, and เกี่ยวกับเรา all point at "/"), so those
            // alone are not unique.
            <a key={i} href={hotspot.href} aria-label={hotspot.label} className="absolute" style={hotspot.style} />
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

          {/* Real functional search overlay (round 4 — see header
              comment): `items-stretch` + `overflow-hidden` so
              SearchEntry's own white background fills this box edge-to-
              edge, fully covering the decorative mockup underneath
              rather than leaving old baked pixels showing through or
              new content overflowing past the box at narrow widths. */}
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
