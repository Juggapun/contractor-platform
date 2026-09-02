import type { Metadata } from 'next';
import { AdminContractorQueue } from '../../../src/components/AdminContractorQueue';

export const metadata: Metadata = {
  title: 'คิวอนุมัติผู้รับเหมา',
  description: 'สำหรับผู้ดูแลระบบ: ตรวจสอบและอนุมัติ/ปฏิเสธใบสมัครผู้รับเหมา',
};

// No cookie-based session in this codebase (see app/api/contractors/register/route.ts's
// header comment) — this page has no server-fetchable data at all, so it
// always needs to render fresh and let the client component below do its
// own session-gated fetch.
export const dynamic = 'force-dynamic';

export default function AdminContractorsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">คิวอนุมัติผู้รับเหมา</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
        รายการใบสมัครผู้รับเหมาที่รอการตรวจสอบ
      </p>
      <div className="mt-8">
        <AdminContractorQueue />
      </div>
    </div>
  );
}
