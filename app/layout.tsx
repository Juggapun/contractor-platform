import type { Metadata } from 'next';
import { Header } from '../src/components/Header';
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
        <Header />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
