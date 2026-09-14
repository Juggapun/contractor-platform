import type { Metadata } from 'next';
import { Footer } from '../src/components/Footer';
import { getSiteUrl } from '../src/lib/env';
import './globals.css';

const SITE_NAME = 'ศูนย์รวมผู้รับเหมาไทย';
const SITE_DESCRIPTION =
  'ค้นหา เปรียบเทียบ และติดต่อผู้รับเหมาก่อสร้างที่ผ่านการตรวจสอบทั่วประเทศไทย ดูผลงานและรีวิวจริงก่อนตัดสินใจ';

// metadataBase lets every URL-based metadata field below it (canonical,
// Open Graph/Twitter images and urls, the sitemap's own entries) use a
// relative path instead of repeating an absolute URL everywhere — see
// getSiteUrl()'s own header comment (src/lib/env.ts) for why it falls
// back to localhost rather than throwing when unconfigured.
export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${SITE_NAME} | ค้นหาผู้รับเหมาที่เหมาะกับงานของคุณ`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    siteName: SITE_NAME,
    locale: 'th_TH',
    type: 'website',
  },
  twitter: {
    card: 'summary',
  },
};

// Issue #47 round 6 (see app/(with-header)/layout.tsx's own header
// comment for the full reasoning): Header used to render here
// unconditionally, hidden on Home only by a client-side pathname check.
// Header is now rendered from the (with-header) route group instead —
// every real page except Home lives under it — so this root layout
// (shared by literally every route, Home included) no longer renders it
// at all. `<main id="main-content">` moved into that group layout too;
// Home's own `app/page.tsx` provides its own `<main>` wrapper directly
// since it sits outside the group.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="flex min-h-screen flex-col bg-white text-slate-900 antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand-400 focus:px-4 focus:py-2 focus:font-semibold focus:text-slate-900"
        >
          ข้ามไปยังเนื้อหาหลัก
        </a>
        {children}
        <Footer />
      </body>
    </html>
  );
}
