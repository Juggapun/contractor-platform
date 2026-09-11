'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AuthStatus } from './AuthStatus';
import { AssetPlaceholder } from './AssetPlaceholder';

/**
 * Issue #47, Final QA item 4 (Owner approval, comment 5634333481): the
 * Owner's new Home-top Master image (issue comment 5634320406) shows 5
 * nav items — หน้าแรก / ค้นหาช่าง / สำหรับช่าง / บทความ / เกี่ยวกับเรา —
 * with an explicit instruction not to omit บทความ or เกี่ยวกับเรา just
 * because a dedicated route doesn't exist for them. Labels here follow
 * the Master exactly; `href`s still only ever point at real, already-
 * working destinations (never a new invented route/page):
 * - ค้นหาช่าง / สำหรับช่าง reuse this same nav's own prior real routes
 *   (`/search`, `/contractors/register`) — this is the same
 *   established-terminology-vs-Master-wording split already documented
 *   in Footer.tsx (display label follows the Master; the destination is
 *   whatever real page that concept already routes to elsewhere in this
 *   app).
 * - บทความ → `/#articles`, the real in-page anchor already used by
 *   Footer's own equivalent link.
 * - เกี่ยวกับเรา has no About page anywhere in this app and building one
 *   is out of this issue's Home-QA scope — per the Owner's own "use the
 *   safest existing route/behavior rather than inventing backend
 *   functionality" instruction, this points at `/` (home) itself: a
 *   real, always-valid, harmless destination, not a fabricated one.
 *   Flagged in this round's own report in case the Owner wants a real
 *   About page later.
 *
 * "หน้าแรก" gets the Master's yellow underline treatment only while the
 * visitor is actually on that page (`usePathname()` — already a client
 * component for the mobile-menu toggle, so this adds no new boundary).
 *
 * The small search-glyph icon next to the auth buttons (visible in the
 * Master, left of "เข้าสู่ระบบ") links to the real `/search` page —
 * the same destination the "ค้นหาช่าง" nav item and Hero's own search
 * form already use, not a new interaction surface.
 */
const NAV_LINKS = [
  { href: '/', label: 'หน้าแรก' },
  { href: '/search', label: 'ค้นหาช่าง' },
  { href: '/contractors/register', label: 'สำหรับช่าง' },
  { href: '/#articles', label: 'บทความ' },
  { href: '/', label: 'เกี่ยวกับเรา' },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur lg:flex lg:h-[72px] lg:items-center">
      {/* Issue #42, Layer A final calibration — height locked to ~72px
          at `lg:` (46/815 of the Master's reference canvas, scaled by
          this codebase's 1280px desktop QA viewport — see Hero.tsx's
          comment). Container width unified to the shared ~1173px
          content-width token every Home section uses. */}
      <div className="mx-auto flex w-full max-w-[1173px] items-center justify-between gap-4 px-4 py-6 sm:px-[53px] lg:py-0">
        {/* Issue #42 — brand lockup restyled to match the provided Master
            Design Reference: a two-line "หาช่าง" / "รวมช่างทั่วไทย" name
            next to a logo badge, replacing the plain single-line
            wordmark. Deliberately scoped to just this visual lockup —
            nav labels below and every other page's own body copy still
            say "ผู้รับเหมา" throughout (search, profile, registration,
            admin), so this does not rename the product/data terminology
            sitewide, only the header/footer brand identity shown here
            and in Footer.tsx. Layer A: the logo is a real illustrated
            mark in the reference, so it's a reserved AssetPlaceholder
            slot, not an emoji substitute (a prior pass here used one —
            reverted). Issue #47: the new Master's header logo mascot is
            inseparable from its own adjoining wordmark artwork at the
            source-pixel level (no clean crop boundary between them), so
            this stays a placeholder rather than risk a visibly botched
            crop — unlike Footer/Hero/CategoryGrid, whose supplied
            artwork this round had a clean boundary to cut at. */}
        <a href="/" className="flex items-center gap-2 rounded-md text-master-text">
          <AssetPlaceholder label="โลโก้" shape="circle" className="h-9 w-9 flex-shrink-0 text-[8px]" />
          <span className="flex flex-col leading-tight">
            <span className="text-lg font-extrabold">หาช่าง</span>
            <span className="text-[11px] font-medium text-slate-500">รวมช่างทั่วไทย</span>
          </span>
        </a>

        <nav aria-label="เมนูหลัก" className="hidden md:block">
          <ul className="flex items-center gap-6">
            {NAV_LINKS.map((link, index) => {
              const isActive = pathname === link.href && link.label === 'หน้าแรก';
              return (
                <li key={`${link.href}-${index}`}>
                  <a
                    href={link.href}
                    className={
                      isActive
                        ? 'border-b-2 border-master-yellow-accent pb-1 text-sm font-semibold text-master-text'
                        : 'text-sm font-medium text-slate-700 hover:text-slate-900'
                    }
                  >
                    {link.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href="/search"
            aria-label="ค้นหาช่าง"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
            </svg>
          </a>
          <AuthStatus />
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-slate-700 hover:bg-slate-100 md:hidden"
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          onClick={() => setMobileOpen((open) => !open)}
        >
          <span className="sr-only">{mobileOpen ? 'ปิดเมนู' : 'เปิดเมนู'}</span>
          {mobileOpen ? (
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
            </svg>
          )}
        </button>
      </div>

      {mobileOpen ? (
        <nav id="mobile-nav" aria-label="เมนูมือถือ" className="border-t border-slate-200 bg-white md:hidden">
          <ul className="flex flex-col gap-1 px-4 py-3">
            {NAV_LINKS.map((link, index) => (
              <li key={`${link.href}-${index}`}>
                <a
                  href={link.href}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-200 px-4 py-3">
            <AuthStatus />
          </div>
        </nav>
      ) : null}
    </header>
  );
}
