import type { Metadata } from 'next';
import { ContractorManagePanel } from '../../../src/components/ContractorManagePanel';

export const metadata: Metadata = {
  title: 'จัดการรูปภาพผู้รับเหมา',
  description: 'จัดการรูปโปรไฟล์และผลงานของบัญชีผู้รับเหมาของคุณ',
  // Private, self-service page — never indexed, same posture as
  // /admin/contractors (app/admin/contractors/page.tsx).
  robots: { index: false, follow: false },
};

// No cookie-based session in this codebase — this page has no
// server-fetchable data at all, so it always renders fresh and lets the
// client component do its own session-gated fetch (same as the admin
// queue page).
export const dynamic = 'force-dynamic';

export default function ContractorManagePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">จัดการรูปภาพผู้รับเหมา</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
        จัดการรูปโปรไฟล์และผลงานของคุณ — เพิ่มรูปผลงานได้สูงสุด 20 รูป
      </p>
      <div className="mt-8">
        <ContractorManagePanel />
      </div>
    </div>
  );
}
