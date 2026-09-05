/**
 * Issue #42 — restyled to the dark-navy footer treatment in the Master
 * Design Reference, with the same "หาช่าง" brand lockup as Header.tsx
 * (see that file's header comment for why only this identity element
 * changes, not sitewide "ผู้รับเหมา" terminology). The reference's
 * "ติดตามเรา" column shows Facebook/YouTube/TikTok/Line icons — this
 * repository has no real URL for any of those accounts, and linking a
 * fake/placeholder URL would be exactly the kind of fabricated business
 * claim Issue #42 says not to make. That column keeps the same honest
 * "เร็ว ๆ นี้" (coming soon) treatment already used for the about/
 * contact/privacy links below, rather than inventing clickable icons.
 * Layer A: the logo is a reserved AssetPlaceholder slot, same reasoning
 * as Header.tsx (a prior pass used an emoji here — reverted).
 *
 * Issue #42, Layer A final calibration — total height (columns + the
 * bottom legal/copyright bar together) locked to ~346px at `lg:`
 * (220/815 of the Master's reference canvas, scaled by this codebase's
 * 1280px desktop QA viewport — see Hero.tsx's comment). Container
 * width unified to the shared ~1173px content-width token, background
 * to the Master's own locked `master-navy` token.
 */
import { AssetPlaceholder } from './AssetPlaceholder';

export function Footer() {
  return (
    <footer className="flex flex-col bg-master-navy text-slate-300 lg:min-h-[346px] lg:justify-center">
      <div className="mx-auto grid w-full max-w-[1173px] gap-8 px-4 py-8 sm:px-[53px] lg:py-4 md:grid-cols-4">
        <div>
          <p className="flex items-center gap-2 text-lg font-bold text-white">
            <AssetPlaceholder label="โลโก้" shape="circle" tone="dark" className="h-7 w-7 text-[7px]" />
            <span>หาช่าง</span>
          </p>
          <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-slate-400 lg:text-xs">
            แพลตฟอร์มค้นหาผู้รับเหมาก่อสร้างที่เชื่อถือได้ — ชื่อแบรนด์อย่างเป็นทางการจะประกาศในภายหลัง
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
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-semibold text-white">ช่วยเหลือ</h2>
          <ul className="mt-3 space-y-2 text-sm lg:text-xs">
            <li>เกี่ยวกับเรา (เร็ว ๆ นี้)</li>
            <li>ติดต่อเรา (เร็ว ๆ นี้)</li>
            <li>นโยบายความเป็นส่วนตัว (เร็ว ๆ นี้)</li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-white">ติดตามเรา</h2>
          <p className="mt-3 text-sm lg:text-xs">ช่องทางโซเชียลมีเดีย (เร็ว ๆ นี้)</p>
        </div>
      </div>

      <div className="border-t border-slate-700 px-4 py-4 text-center text-xs text-slate-500 sm:px-6">
        © {new Date().getFullYear()} หาช่าง สงวนลิขสิทธิ์ทุกประการ
      </div>
    </footer>
  );
}
