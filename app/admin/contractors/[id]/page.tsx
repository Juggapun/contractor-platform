import type { Metadata } from 'next';
import { AdminContractorDetail } from '../../../../src/components/AdminContractorDetail';

export const metadata: Metadata = {
  title: 'ตรวจสอบใบสมัครผู้รับเหมา',
  description: 'สำหรับผู้ดูแลระบบ: ตรวจสอบรายละเอียดและอนุมัติ/ปฏิเสธใบสมัครผู้รับเหมา',
};

// See app/admin/contractors/page.tsx — same reasoning, no server session
// to fetch with, so this always renders fresh and lets the client
// component fetch (and authorize) on its own.
export const dynamic = 'force-dynamic';

export default async function AdminContractorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <AdminContractorDetail contractorId={id} />
    </div>
  );
}
