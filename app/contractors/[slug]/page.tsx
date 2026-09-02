import type { Metadata } from 'next';
import { getContractorNameBySlug } from '../../../src/lib/data/contractors';

/**
 * PHASE 6 PLACEHOLDER — intentionally has zero profile-page business
 * logic (no portfolio, no reviews list, no contact actions). Exists
 * only so Phase 5's search result cards have a real, working link
 * target instead of a 404, per Issue #2 ("non-broken placeholder route
 * strategy"). The one thing it does — an RLS-respecting existence
 * check by slug — is deliberately minimal: it proves the link points
 * at a real approved contractor without previewing their profile.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const name = await getContractorNameBySlug(slug);
  return {
    title: name ?? 'ไม่พบผู้รับเหมา',
  };
}

export default async function ContractorPlaceholderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const name = await getContractorNameBySlug(slug);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      {name ? (
        <>
          <h1 className="text-2xl font-bold text-slate-900">{name}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
            หน้าโปรไฟล์ผู้รับเหมาแบบเต็มรูปแบบ (ผลงาน รีวิว ข้อมูลติดต่อ) กำลังจะมาเร็ว ๆ นี้
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-slate-900">ไม่พบผู้รับเหมารายนี้</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
            ผู้รับเหมารายนี้อาจไม่มีอยู่ หรือยังไม่ได้รับการอนุมัติให้แสดงผลสาธารณะ
          </p>
        </>
      )}
      <a
        href="/search"
        className="mt-8 inline-block rounded-md border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        กลับไปหน้าค้นหา
      </a>
    </div>
  );
}
