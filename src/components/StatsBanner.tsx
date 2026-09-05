import type { HomeStats } from '../lib/data/homeStats';
import { AssetPlaceholder } from './AssetPlaceholder';

/**
 * Issue #42 — the Master Design Reference's dark stat banner, but with
 * REAL live counts (see src/lib/data/homeStats.ts's header comment) —
 * never the reference's specific numbers, which this issue's "do not
 * invent contractor counts/ratings" rule forbids reproducing verbatim.
 * In an early/small dataset these will look modest; that's the correct,
 * honest result, not a bug.
 *
 * Layer A: each metric's icon in the reference is an illustrated asset,
 * so it gets a reserved `AssetPlaceholder` slot rather than an emoji
 * substitute (a prior pass here used emoji — reverted).
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
      label: 'ผู้รับเหมาทั่วไทย',
      value: approvedContractorCount.toLocaleString('th-TH'),
      iconLabel: 'ไอคอนผู้รับเหมา',
    },
    {
      label: 'ผลงานจริง',
      value: stats.portfolioImageCount.toLocaleString('th-TH'),
      iconLabel: 'ไอคอนผลงาน',
    },
    {
      label:
        stats.reviewCount > 0
          ? `คะแนนเฉลี่ย (${stats.reviewCount.toLocaleString('th-TH')} รีวิว)`
          : 'ยังไม่มีรีวิว',
      value: stats.averageRating !== null ? `${stats.averageRating.toFixed(1)}/5` : '—',
      iconLabel: 'ไอคอนดาวคะแนน',
    },
    {
      label: 'ทุกโปรไฟล์ผ่านการอนุมัติก่อนเผยแพร่',
      value: 'ตรวจสอบแล้ว',
      iconLabel: 'ไอคอนตรวจสอบแล้ว',
    },
  ];

  return (
    <section className="bg-slate-900 text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <ul className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {items.map((item) => (
            <li key={item.label} className="flex flex-col items-center gap-1 text-center">
              <AssetPlaceholder label={item.iconLabel} shape="circle" tone="dark" className="h-8 w-8 text-[8px]" />
              <span className="text-xl font-extrabold text-brand-400 sm:text-2xl">{item.value}</span>
              <span className="text-xs text-slate-300 sm:text-sm">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
