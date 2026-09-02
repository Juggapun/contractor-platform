/**
 * Rendered when getContractorProfile() returns null — covers both "no
 * contractor with this slug" and "exists but not status='approved'"
 * identically (the page must never distinguish those two cases in its
 * response, or it would leak which slugs correspond to a
 * pending/rejected/suspended contractor). Triggered via notFound()
 * (next/navigation) in app/contractors/[slug]/page.tsx, so this route
 * correctly returns a real HTTP 404, not a 200 with a "not found"
 * message.
 */
export default function ContractorNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">ไม่พบผู้รับเหมารายนี้</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
        ผู้รับเหมารายนี้อาจไม่มีอยู่ หรือยังไม่ได้รับการอนุมัติให้แสดงผลสาธารณะ
      </p>
      <a
        href="/search"
        className="mt-8 inline-block rounded-md border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        กลับไปหน้าค้นหา
      </a>
    </div>
  );
}
