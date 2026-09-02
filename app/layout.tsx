import type { Metadata } from 'next';
import { Header } from '../src/components/Header';
import { Footer } from '../src/components/Footer';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'ศูนย์รวมผู้รับเหมาไทย | ค้นหาผู้รับเหมาที่เหมาะกับงานของคุณ',
    template: '%s | ศูนย์รวมผู้รับเหมาไทย',
  },
  description:
    'ค้นหา เปรียบเทียบ และติดต่อผู้รับเหมาก่อสร้างที่ผ่านการตรวจสอบทั่วประเทศไทย ดูผลงานและรีวิวจริงก่อนตัดสินใจ',
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
