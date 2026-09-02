import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ค้นหาผู้รับเหมา',
  description: 'ค้นหาและเปรียบเทียบผู้รับเหมาก่อสร้างตามประเภทงานและจังหวัด',
};

/**
 * PHASE 5 PLACEHOLDER — intentionally has zero search/filter business
 * logic. Exists only so the Home Page's search entry form (Phase 4) has
 * a real, working navigation target instead of a 404, and so the
 * selected filters are visibly preserved for whoever builds Phase 5.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; province?: string; q?: string }>;
}) {
  const params = await searchParams;
  const hasFilters = Boolean(params.category || params.province || params.q);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">ระบบค้นหาผู้รับเหมากำลังจะมาเร็ว ๆ นี้</h1>
      <p className="mt-3 text-slate-600">
        เรากำลังพัฒนาระบบค้นหาและเปรียบเทียบผู้รับเหมาแบบเต็มรูปแบบ ขอบคุณที่รอคอย
      </p>

      {hasFilters ? (
        <dl className="mx-auto mt-8 max-w-sm space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left text-sm">
          <p className="font-medium text-slate-700">ตัวกรองที่คุณเลือกไว้ (จะถูกใช้เมื่อระบบเปิดใช้งาน):</p>
          {params.category ? (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">ประเภทงาน</dt>
              <dd className="text-slate-900">{params.category}</dd>
            </div>
          ) : null}
          {params.province ? (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">จังหวัด</dt>
              <dd className="text-slate-900">{params.province}</dd>
            </div>
          ) : null}
          {params.q ? (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">คำค้นหา</dt>
              <dd className="text-slate-900">{params.q}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <a
        href="/"
        className="mt-8 inline-block rounded-md border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        กลับไปหน้าแรก
      </a>
    </div>
  );
}
