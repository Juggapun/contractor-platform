import type { HomeStats } from '../lib/data/homeStats';

/** Public/RLS-scoped data only; master illustration numbers are not real counts. */
export function StatsBanner({ stats, approvedContractorCount }: { stats: HomeStats; approvedContractorCount: number }) {
  const items = [
    { label: 'ผู้รับเหมาทั่วไทย', value: approvedContractorCount.toLocaleString('th-TH'), icon: '/icons/stats/stats-1-contractor.webp' },
    { label: 'ผลงานจริง', value: stats.portfolioImageCount.toLocaleString('th-TH'), icon: '/icons/stats/stats-2-portfolio.webp' },
    { label: stats.reviewCount > 0 ? `คะแนนเฉลี่ย (${stats.reviewCount.toLocaleString('th-TH')} รีวิว)` : 'ยังไม่มีรีวิว', value: stats.averageRating !== null ? `${stats.averageRating.toFixed(1)}/5` : '—', icon: '/icons/stats/stats-3-rating.webp' },
    { label: 'อนุมัติก่อนเผยแพร่', value: 'ตรวจสอบแล้ว', icon: '/icons/stats/stats-4-verified.webp' },
  ];
  return (
    <section className="home-stats" aria-label="สถิติผู้รับเหมาและผลงาน">
      <ul>{items.map((item) => <li key={item.label}>
        <img src={item.icon} width="52" height="52" alt="" />
        <div><strong>{item.value}</strong><span>{item.label}</span></div>
      </li>)}</ul>
      <p>ช่างดี<br />สร้างอนาคต<br /><span>ให้บ้านคุณ</span></p>
    </section>
  );
}
