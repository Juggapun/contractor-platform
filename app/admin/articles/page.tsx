import type { Metadata } from 'next';
import { AdminArticlesManager } from '../../../src/components/AdminArticlesManager';

export const metadata: Metadata = {
  title: 'จัดการบทความ',
  description: 'สำหรับผู้ดูแลระบบ: เพิ่ม/แก้ไข/ลบบทความที่แสดงในหน้าแรก',
  // Same admin-page posture as every other page under app/admin/** —
  // see app/admin/contractors/page.tsx's own comment for why both this
  // and robots.txt's Disallow: /admin exist together.
  robots: { index: false, follow: false },
};

// No cookie-based session in this codebase — see
// app/admin/contractors/page.tsx's own comment for why this page has no
// server-fetchable data at all and always renders fresh.
export const dynamic = 'force-dynamic';

export default function AdminArticlesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">จัดการบทความ</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
        เพิ่ม แก้ไข หรือลบบทความที่แสดงในส่วน &quot;บทความ &amp; เคล็ดลับ&quot; บนหน้าแรก
      </p>
      <div className="mt-8">
        <AdminArticlesManager />
      </div>
    </div>
  );
}
