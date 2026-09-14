/** Next.js route-segment loading UI — shown automatically while the
 * search page's server-side data fetch is in flight (route navigation),
 * with no client JavaScript required. */
export default function SearchLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6" role="status" aria-label="กำลังค้นหา...">
      <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-5 w-96 max-w-full animate-pulse rounded bg-slate-100" />
      <div className="mt-6 h-40 animate-pulse rounded-xl bg-slate-100" />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
