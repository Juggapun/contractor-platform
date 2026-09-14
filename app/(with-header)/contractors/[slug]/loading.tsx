/**
 * Phase 12 (Issue #10) fix: this route segment had no loading.tsx —
 * confirmed via static review that its server-side fetch
 * (getContractorProfile() + getPortfolioImages() + getReviews(), 3
 * parallel queries) had no interim feedback at all; a slow connection
 * would just see a blank tab until everything resolved at once. Same
 * skeleton pattern as app/search/loading.tsx (Phase 5), shaped to this
 * page's own sections instead.
 */
export default function ContractorProfileLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6" role="status" aria-label="กำลังโหลดโปรไฟล์ผู้รับเหมา...">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="h-24 w-24 flex-shrink-0 animate-pulse rounded-xl bg-slate-100" />
        <div className="flex-1 space-y-2">
          <div className="h-8 w-64 max-w-full animate-pulse rounded bg-slate-200" />
          <div className="h-5 w-40 animate-pulse rounded bg-slate-100" />
          <div className="h-5 w-32 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
      <div className="mt-8 h-24 animate-pulse rounded-xl bg-slate-100" />
      <div className="mt-8 h-32 animate-pulse rounded-xl bg-slate-100" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
