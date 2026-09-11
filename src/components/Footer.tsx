/**
 * Issue #42, Layer B (comment 5570885896): restyled to match the
 * Owner-supplied combined Testimonials/Articles/Footer Master
 * reference — same brand lockup and column structure as before, with
 * two real additions the Master shows: a "บทความ" menu link (points
 * to the real `#articles` in-page anchor already on this Home page)
 * and a 4th ช่วยเหลือ item ("ข้อกำหนดการใช้งาน"). Menu labels keep this
 * site's own established product terminology (Header.tsx's
 * "ค้นหาผู้รับเหมา" / "เข้าร่วมเป็นผู้รับเหมา") rather than the Master's
 * shorter "ค้นหาช่าง" / "สำหรับช่าง" mockup wording — Issue #42 Section
 * 8's own QA rule says to use the site's actual product terminology
 * consistently, and "หาช่าง" elsewhere in this codebase is deliberately
 * scoped to the brand lockup only, not general "ผู้รับเหมา" copy (see
 * this file's own prior comment / Header.tsx).
 *
 * No real destination exists for "เกี่ยวกับเรา" or any ช่วยเหลือ item
 * (คำถามที่พบบ่อย/ติดต่อเรา/ข้อกำหนดการใช้งาน/นโยบายความเป็นส่วนตัว) as of
 * this original pass — this comment's own "Do not invent destination
 * URLs/actions" rule (the Owner will specify these later), so they stay
 * honest, non-clickable text with a "(เร็ว ๆ นี้)" label rather than a
 * fake href. (The ติดตามเรา social links started the same way here, but
 * see the Issue #46 note below — the Owner has since supplied real
 * URLs for those specifically.)
 *
 * The Master's "ติดตามเรา" column shows real Facebook/YouTube/TikTok/
 * Line icon glyphs (not text) — reproduced here with the Master's own
 * visual style (a circular translucent-white badge per icon).
 *
 * The right-side yellow rotated tagline sticker reuses the Home Page's
 * own already-locked tagline text (Issue #42 Section 5.3:
 * "หาช่างดี สร้างบ้านดี สร้างอนาคตที่ดีกว่า") — real, approved copy,
 * not something invented for this pass; it's baked into Hero's own
 * artwork elsewhere on the page and shown here again decoratively, the
 * same way the Master repeats it.
 *
 * Logo: still a reserved `AssetPlaceholder` slot, same reasoning as
 * Header.tsx — the Owner has supplied section artwork for this pass,
 * not a standalone logo file, so nothing is invented here.
 *
 * Issue #42, Layer A calibration note: the previous `lg:min-h-[346px]`
 * lock (from the Master's older reference canvas) is not reapplied —
 * this pass matches the NEW combined Master screenshot's own
 * proportions/spacing instead, and the resulting live height is
 * reported/measured directly rather than assumed.
 *
 * Issue #46 ("Complete Final Footer Implementation"): that issue's own
 * requirement is stricter for the Menu column specifically — "ensure
 * all displayed navigation items are real links and route correctly"
 * (no "where they exist" qualifier, unlike the Help column's wording)
 * — so the "เกี่ยวกับเรา (เร็ว ๆ นี้)" entry is removed here rather than
 * kept as inert text: no `/about` route exists anywhere in this app,
 * and building one is out of this issue's explicit "Footer only" scope
 * (a whole new page is not a Footer change). The remaining 4 Menu
 * items were already real, working routes and are untouched.
 *
 * The Help column is deliberately left as-is: its own requirement
 * ("real links/routes *where they exist*; do not invent destinations")
 * already matches the current honest non-clickable-with-"(เร็ว ๆ นี้)"
 * treatment, since no FAQ/contact/terms/privacy route exists in this
 * app and creating one is out of "Footer only" scope.
 *
 * Issue #46, Owner Input (comment 5601967986): the Owner supplied real
 * company social URLs, so the Social column is now real `<a>` links
 * (not `<span>`s) — see `SOCIAL_LINKS`' own comment for the LINE-URL
 * reasoning specifically. Logo was still the `AssetPlaceholder` as of
 * this pass: the Owner's first attempt to attach the real brand-mark
 * file (comment 5601993652) sits at a `github.com/user-attachments/
 * assets/...` URL that this sandbox's egress proxy hard-403s on direct
 * fetch (confirmed via `curl -sIL`) — flagged back to the Owner rather
 * than retried.
 *
 * Issue #46, Footer Master image (comment 5632900497 + instruction
 * 5632932151): the Owner posted a full Footer mockup (mascot logo +
 * "หาช่าง" wordmark, all 4 columns, the right-side tagline, the
 * copyright row) as a pure visual reference — never as an `<img>`/
 * background, per the Owner's own explicit instruction — and asked for
 * this component's real HTML/CSS to match its proportions/spacing/
 * styling as closely as possible. Concretely, from that image:
 * - Left column restructured: the logo placeholder moved from a small
 *   inline circle beside the wordmark to a large square block ABOVE
 *   it, with the wordmark itself much larger/bolder ("หา" white,
 *   "ช่าง" in the brand yellow, split into two `<span>`s) — matching
 *   the Master's actual visual hierarchy there. The description text
 *   below was updated to the Master's own two-line copy (a genuine
 *   content difference, but real Owner-supplied text from their own
 *   reference image, not invented).
 * - Social icons recolored to distinct per-brand square badges (blue/
 *   red/black/green) instead of one uniform translucent-gray circle,
 *   matching the Master's app-icon-like styling — see `SOCIAL_LINKS`'
 *   own comment for why the Facebook/YouTube glyph paths specifically
 *   needed simplifying to just their silhouette.
 * - The right-side tagline's underline now sits only under its last
 *   line (a `<span>`), not under all three lines — the Master shows
 *   one decorative swoosh under the final line only, not a literal
 *   underline on every line.
 * - Copyright row copy updated to include the period after "หาช่าง"
 *   that the Master's own text shows ("หาช่าง. สงวนลิขสิทธิ์ทุกประการ").
 * - The left (logo+description) column now spans 2 of 5 grid tracks
 *   at desktop width instead of 1 of 4 (the other three columns keep
 *   1 track each) — the Master's own left section is visibly wider
 *   relative to the other columns than an even 4-way split gave it,
 *   and the extra width is also what lets the two-line description
 *   copy above actually render as two lines instead of wrapping to a
 *   third from being squeezed into too narrow a column.
 *
 * What did NOT change despite the Master showing it differently: the
 * Menu column's wording stays this site's established product
 * terminology ("ค้นหาผู้รับเหมา" / "เข้าร่วมเป็นผู้รับเหมา", not the
 * Master's shorter mockup wording — see this file's own Issue #42
 * comment above, never rescinded) and still omits "เกี่ยวกับเรา" (the
 * Master shows it as a plain, unlabeled item, but the *original* Issue
 * #46 body's own Menu-column rule — "ensure ALL displayed navigation
 * items are real links and route correctly", no "where they exist"
 * qualifier — was never relaxed by this later comment, which asks for
 * visual-fidelity changes, not a reopening of that content decision;
 * no `/about` route exists and building one is still out of this
 * issue's "Footer only" scope). Flagged explicitly in this round's own
 * GitHub report in case the Owner actually wants that wording changed
 * too.
 */
import { AssetPlaceholder } from './AssetPlaceholder';

// Issue #46, Owner Input (comment 5601967986) — these are the Owner's own
// literal, supplied destinations, never invented: the LINE entry is built
// from the exact LINE Official Account ID the Owner gave ("@321cvbmm")
// through LINE's own documented Add-Friend redirect scheme
// (https://line.me/R/ti/p/<id>, id including its "@") — the SAME mechanism
// already used for a contractor's personal LINE id elsewhere in this
// codebase (app/contractors/[slug]/page.tsx), just the Official-Account
// variant since this id itself has the "@" prefix a personal id never has.
//
// Issue #46, Footer Master image (comment 5632900497): each icon there is
// a distinct brand-colored square badge (blue/red/black/green), not a
// uniform gray circle — `bg` below is that per-brand color, and `path` was
// simplified to just the glyph silhouette (a lowercase "f", a play
// triangle) for Facebook/YouTube specifically, since their previous paths
// had a circle/rounded-rect baked into the shape itself, which visually
// fought with the new colored badge behind it. TikTok's and LINE's paths
// were already glyph-only and are unchanged.
const SOCIAL_LINKS = [
  {
    name: 'Facebook',
    href: 'https://www.facebook.com/ChiphiEngineering/',
    bg: 'bg-[#1877F2]',
    path: 'M14 13.5h2.5l.5-4H14V7c0-1 .3-1.5 1.7-1.5H17V2.1C16.6 2 15.5 2 14.2 2 11.5 2 10 3.6 10 6.5v3H7v4h3V22h4V13.5Z',
  },
  {
    name: 'YouTube',
    href: 'https://www.youtube.com/@%E0%B8%8A%E0%B8%B4%E0%B8%9B%E0%B8%AB%E0%B8%B2%E0%B8%A2%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%8A%E0%B9%88%E0%B8%B2%E0%B8%87',
    bg: 'bg-[#FF0000]',
    path: 'M9.5 7.5v9l8-4.5Z',
  },
  {
    name: 'TikTok',
    href: 'https://www.tiktok.com/@chiphi_engineering',
    bg: 'bg-black',
    path: 'M16.6 3c.3 2 1.6 3.7 3.6 4.3v3a7 7 0 0 1-3.6-1v6.8a5.9 5.9 0 1 1-5-5.8v3.1a2.8 2.8 0 1 0 2 2.7V3Z',
  },
  {
    name: 'Line',
    href: `https://line.me/R/ti/p/${encodeURIComponent('@321cvbmm')}`,
    bg: 'bg-[#06C755]',
    path: 'M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.2 7.9.3.1.8.3.9.6.1.3 0 .8 0 1.1l-.2 1c-.1.3-.2 1 .9.6 1.1-.5 6-3.5 8.2-6C21.5 14.4 22 12.8 22 11c0-4.4-4.5-8-10-8Z',
  },
];

const HELP_LINKS = ['คำถามที่พบบ่อย', 'ติดต่อเรา', 'ข้อกำหนดการใช้งาน', 'นโยบายความเป็นส่วนตัว'];

export function Footer() {
  return (
    <footer className="bg-master-navy text-slate-300">
      <div className="mx-auto flex w-full max-w-[1173px] flex-col gap-8 px-4 py-8 sm:px-[53px] lg:flex-row lg:items-start lg:justify-between lg:py-10">
        <div className="grid gap-8 sm:grid-cols-4 lg:flex-1 lg:grid-cols-5 lg:gap-6">
          <div className="sm:col-span-4 lg:col-span-2">
            <AssetPlaceholder label="โลโก้" shape="rect" tone="dark" className="h-16 w-16 text-[9px]" />
            <div className="mt-2 text-3xl font-extrabold leading-none">
              <span className="text-white">หา</span>
              <span className="text-master-yellow-accent">ช่าง</span>
            </div>
            <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-slate-400 lg:text-xs">
              แพลตฟอร์มศูนย์รวมผู้รับเหมาไทย
              <br />
              เชื่อมต่อเจ้าของบ้านกับช่างคุณภาพทั่วประเทศ
            </p>
          </div>

          <nav aria-label="ลิงก์เว็บไซต์">
            <h2 className="text-sm font-semibold text-white">เมนู</h2>
            <ul className="mt-3 space-y-2 text-sm lg:text-xs">
              <li>
                <a href="/" className="hover:text-white hover:underline">
                  หน้าแรก
                </a>
              </li>
              <li>
                <a href="/search" className="hover:text-white hover:underline">
                  ค้นหาผู้รับเหมา
                </a>
              </li>
              <li>
                <a href="/contractors/register" className="hover:text-white hover:underline">
                  เข้าร่วมเป็นผู้รับเหมา
                </a>
              </li>
              <li>
                <a href="/#articles" className="hover:text-white hover:underline">
                  บทความ
                </a>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="text-sm font-semibold text-white">ช่วยเหลือ</h2>
            <ul className="mt-3 space-y-2 text-sm lg:text-xs">
              {HELP_LINKS.map((label) => (
                <li key={label}>{label} (เร็ว ๆ นี้)</li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-white">ติดตามเรา</h2>
            <div className="mt-3 flex items-center gap-2">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.name}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-white opacity-90 hover:opacity-100 ${social.bg}`}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                    <path d={social.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>

        <p
          aria-hidden="true"
          className="hidden -rotate-6 flex-shrink-0 whitespace-nowrap text-right text-sm font-bold leading-snug text-master-yellow-accent lg:block"
        >
          หาช่างดี
          <br />
          สร้างบ้านดี
          <br />
          <span className="underline decoration-2 underline-offset-4">สร้างอนาคตที่ดีกว่า</span>
        </p>
      </div>

      <div className="border-t border-slate-700 px-4 py-4 text-center text-xs text-slate-500 sm:px-6">
        © {new Date().getFullYear()} หาช่าง. สงวนลิขสิทธิ์ทุกประการ
      </div>
    </footer>
  );
}
