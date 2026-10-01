'use client';

import { useState } from 'react';
import { AuthStatus } from './AuthStatus';
import { BrandLogo } from './BrandLogo';

// Existing destinations retained; a dedicated About page remains future work.
const links = [
  { href: '/', label: 'หน้าแรก' },
  { href: '/search', label: 'ค้นหาช่าง' },
  { href: '/contractors/register', label: 'สำหรับช่าง' },
  { href: '/#articles', label: 'บทความ' },
  { href: '#about-footer', label: 'เกี่ยวกับเรา' },
];

export function HomeHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="home-header">
      <div className="home-header-row">
        <a className="home-logo" href="/" aria-label="หาช่าง — หน้าแรก"><BrandLogo /></a>
        <nav className="home-desktop-nav" aria-label="เมนูหลัก">
          {links.map((link, i) => <a key={link.label} href={link.href} aria-current={i === 0 ? 'page' : undefined}>{link.label}</a>)}
        </nav>
        <div className="home-desktop-auth"><AuthStatus /></div>
        <button className="home-menu-toggle" type="button" aria-expanded={open} aria-controls="home-mobile-menu" onClick={() => setOpen(!open)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d={open ? 'M6 6l12 12M6 18L18 6' : 'M4 6h16M4 12h16M4 18h16'} />
          </svg><span>{open ? 'ปิดเมนู' : 'เมนู'}</span>
        </button>
      </div>
      {open && <div id="home-mobile-menu" className="home-mobile-menu">
        <nav aria-label="เมนูมือถือ">{links.map((link, i) => <a key={link.label} href={link.href} aria-current={i === 0 ? 'page' : undefined} onClick={() => setOpen(false)}>{link.label}</a>)}</nav>
        <AuthStatus />
      </div>}
    </header>
  );
}
