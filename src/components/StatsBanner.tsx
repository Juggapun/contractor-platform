import type { HomeStats } from '../lib/data/homeStats';

/**
 * Issue #42 — the Master Design Reference's dark stat banner, but with
 * REAL live counts (see src/lib/data/homeStats.ts's header comment) —
 * never the reference's specific numbers, which this issue's "do not
 * invent contractor counts/ratings" rule forbids reproducing verbatim.
 * In an early/small dataset these will look modest; that's the correct,
 * honest result, not a bug.
 */
export function StatsBanner({
  stats,
  approvedContractorCount,
}: {
  stats: HomeStats;
  /** Reused from searchContractors()'s own `totalCount` — see
   * homeStats.ts's header comment for why this isn't queried again here. */
  approvedContractorCount: number;
}) {
  const items = [
    {
      icon: '👷',
      value: approvedContractorCount.toLocaleString('th-TH'),
      label: 'ผู้รับเหมาทั่วไทย',
    },
    {
      icon: '🖼️',
      value: stats.portfolioImageCount.toLocaleString('th-TH'),
      label: 'ผลงานจริง',
    },
    {
      icon: '⭐',
      value: stats.averageRating !== null ? `${stats.averageRating.toFixed(1)}/5` : '—',
      label:
        stats.reviewCount > 0
          ? `คะแนนเฉลี่ย (${stats.reviewCount.toLocaleString('th-TH')} รีวิว)`
          : 'ยังไม่มีรีวิว',
    },
    {
      icon: '🛡️',
      value: 'ตรวจสอบแล้ว',
      label: 'ทุกโปรไฟล์ผ่านการอนุมัติก่อนเผยแพร่',
    },
  ];

  return (
    <section className="bg-slate-900 text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <ul className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {items.map((item) => (
            <li key={item.label} className="flex flex-col items-center gap-1 text-center">
              <span aria-hidden="true" className="text-2xl">
                {item.icon}
              </span>
              <span className="text-xl font-extrabold text-brand-400 sm:text-2xl">{item.value}</span>
              <span className="text-xs text-slate-300 sm:text-sm">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
