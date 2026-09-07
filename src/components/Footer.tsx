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
 * (คำถามที่พบบ่อย/ติดต่อเรา/ข้อกำหนดการใช้งาน/นโยบายความเป็นส่วนตัว) or
 * the ติดตามเรา social links — this comment's own "Do not invent
 * destination URLs/actions" rule (the Owner will specify these later),
 * so all of them stay honest, non-clickable text/icons with a
 * "(เร็ว ๆ นี้)" label, the same convention already used here before
 * this pass (never a fake href, per the Master Design Issue's own
 * anti-fabrication rule).
 *
 * The Master's "ติดตามเรา" column shows real Facebook/YouTube/TikTok/
 * Line icon glyphs (not text) — reproduced here as inert `<span>`s
 * (never `<a>` tags, so nothing implies real navigation) with a single
 * shared `sr-only` "(เร็ว ๆ นี้)" label for assistive tech, keeping the
 * Master's visual recognition without inventing any link.
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
 */
import { AssetPlaceholder } from './AssetPlaceholder';

const SOCIAL_LINKS = [
  {
    name: 'Facebook',
    path: 'M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z',
  },
  {
    name: 'YouTube',
    path: 'M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.5V8.5L15.8 12Z',
  },
  {
    name: 'TikTok',
    path: 'M16.6 3c.3 2 1.6 3.7 3.6 4.3v3a7 7 0 0 1-3.6-1v6.8a5.9 5.9 0 1 1-5-5.8v3.1a2.8 2.8 0 1 0 2 2.7V3Z',
  },
  {
    name: 'Line',
    path: 'M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.2 7.9.3.1.8.3.9.6.1.3 0 .8 0 1.1l-.2 1c-.1.3-.2 1 .9.6 1.1-.5 6-3.5 8.2-6C21.5 14.4 22 12.8 22 11c0-4.4-4.5-8-10-8Z',
  },
];

const HELP_LINKS = ['คำถามที่พบบ่อย', 'ติดต่อเรา', 'ข้อกำหนดการใช้งาน', 'นโยบายความเป็นส่วนตัว'];

export function Footer() {
  return (
    <footer className="bg-master-navy text-slate-300">
      <div className="mx-auto flex w-full max-w-[1173px] flex-col gap-8 px-4 py-8 sm:px-[53px] lg:flex-row lg:items-start lg:justify-between lg:py-10">
        <div className="grid gap-8 sm:grid-cols-4 lg:flex-1 lg:gap-6">
          <div className="sm:col-span-4 lg:col-span-1">
            <div className="flex items-center gap-2 text-lg font-bold text-white">
              <AssetPlaceholder label="โลโก้" shape="circle" tone="dark" className="h-7 w-7 text-[7px]" />
              <span>หาช่าง</span>
            </div>
            <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-slate-400 lg:text-xs">
              แพลตฟอร์มที่เชื่อมต่อเจ้าของบ้านกับช่างคุณภาพทั่วประเทศ เพื่อสร้างบ้านในฝันของคุณให้เป็นจริง
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
              <li>เกี่ยวกับเรา (เร็ว ๆ นี้)</li>
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
                <span
                  key={social.name}
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d={social.path} />
                  </svg>
                </span>
              ))}
              <span className="sr-only">ช่องทางโซเชียลมีเดีย (เร็ว ๆ นี้)</span>
            </div>
          </div>
        </div>

        <p
          aria-hidden="true"
          className="hidden -rotate-6 flex-shrink-0 whitespace-nowrap text-right text-sm font-bold leading-snug text-master-yellow-accent underline decoration-2 underline-offset-4 lg:block"
        >
          หาช่างดี
          <br />
          สร้างบ้านดี
          <br />
          สร้างอนาคตที่ดีกว่า
        </p>
      </div>

      <div className="border-t border-slate-700 px-4 py-4 text-center text-xs text-slate-500 sm:px-6">
        © {new Date().getFullYear()} หาช่าง สงวนลิขสิทธิ์ทุกประการ
      </div>
    </footer>
  );
}
