import type { HomeStats } from '../lib/data/homeStats';

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
 *
 * Layer A final calibration — background locked to the Master's own
 * `--color-master-navy-stats` token (distinct from Footer's navy — see
 * globals.css); height locked to ~127px at `lg:` (81/815 of the
 * Master's reference canvas, scaled by this codebase's 1280px desktop
 * QA viewport — see Hero.tsx's comment). Container width unified to
 * the shared ~1173px content-width token.
 *
 * Layer B, round 1: no Stats-specific icon asset had been supplied yet,
 * so every icon stayed a real `AssetPlaceholder` with a shortened,
 * legible label (matching every other `AssetPlaceholder` call site's
 * short-label convention) rather than the original long compound phrases
 * that overflowed the small circle.
 *
 * Layer B, round 2 (this pass) — Issue #42 comment #5558081996: the
 * Owner supplied a real 4-icon sheet (comment #5558077926) with an
 * explicit, locked left-to-right order that must NOT be inferred or
 * reordered: 1 ผู้รับเหมา (hard-hat contractor bust), 2 ผลงาน (stacked
 * photos), 3 คะแนน (star), 4 ตรวจสอบแล้ว (shield + checkmark). Each was
 * cropped from that sheet with Pillow via its alpha channel (icon +
 * its own circular navy badge + drop shadow; caption/filename label
 * below excluded) — no icon was redrawn, recolored, or regenerated.
 * `items` below is declared in that exact locked order; each `icon`
 * path is its own independently-replaceable asset slot.
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
      icon: '/icons/stats/stats-1-contractor.webp',
      iconAlt: 'ไอคอนผู้รับเหมา',
    },
    {
      label: 'ผลงานจริง',
      value: stats.portfolioImageCount.toLocaleString('th-TH'),
      icon: '/icons/stats/stats-2-portfolio.webp',
      iconAlt: 'ไอคอนผลงาน',
    },
    {
      label:
        stats.reviewCount > 0
          ? `คะแนนเฉลี่ย (${stats.reviewCount.toLocaleString('th-TH')} รีวิว)`
          : 'ยังไม่มีรีวิว',
      value: stats.averageRating !== null ? `${stats.averageRating.toFixed(1)}/5` : '—',
      icon: '/icons/stats/stats-3-rating.webp',
      iconAlt: 'ไอคอนคะแนน',
    },
    {
      label: 'ทุกโปรไฟล์ผ่านการอนุมัติก่อนเผยแพร่',
      value: 'ตรวจสอบแล้ว',
      icon: '/icons/stats/stats-4-verified.webp',
      iconAlt: 'ไอคอนตรวจสอบแล้ว',
    },
  ];

  return (
    <section className="bg-master-navy-stats text-white lg:flex lg:min-h-[127px] lg:items-center">
      <div className="mx-auto w-full max-w-[1173px] px-4 py-8 sm:px-[53px] lg:py-3">
        <ul className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {items.map((item) => (
            <li key={item.label} className="flex flex-col items-center gap-1 text-center">
              <img src={item.icon} alt={item.iconAlt} className="h-8 w-8" />
              <span className="text-xl font-extrabold text-brand-400 sm:text-2xl">{item.value}</span>
              <span className="text-xs text-slate-300 sm:text-sm">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
