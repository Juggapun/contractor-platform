'use client';

import { useState } from 'react';
import { AuthStatus } from './AuthStatus';

const NAV_LINKS = [
  { href: '/', label: 'หน้าแรก' },
  { href: '/search', label: 'ค้นหาผู้รับเหมา' },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a href="/" className="flex items-center gap-2 rounded-md text-lg font-bold text-slate-900">
          <span aria-hidden="true">🛠️</span>
          <span>ศูนย์รวมผู้รับเหมาไทย</span>
        </a>

        <nav aria-label="เมนูหลัก" className="hidden md:block">
          <ul className="flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-sm font-medium text-slate-700 hover:text-slate-900"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden md:block">
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
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
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
