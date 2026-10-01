import type { ContractorSummary } from '../lib/data/contractors';
import { HomeSectionHeading } from './HomeSectionHeading';
import { AssetPlaceholder } from './AssetPlaceholder';

/** Compact home cards use public search data; search-page cards stay independent. */
export function FeaturedContractors({ contractors }: { contractors: ContractorSummary[] }) {
  return <section className="home-section" aria-labelledby="featured-title">
    <HomeSectionHeading id="featured-title" title="ช่างแนะนำ" description="ผู้รับเหมาคุณภาพที่ผ่านการตรวจสอบแล้ว"
      action={<a href="/search">ดูทั้งหมด <span aria-hidden="true">→</span></a>} />
    {contractors.length === 0 ? <p className="home-empty">ยังไม่มีผู้รับเหมาที่ผ่านการอนุมัติในขณะนี้</p> :
      <ul className="home-contractors">{contractors.slice(0, 5).map(c => <li key={c.id}>
        <a className="home-contractor-card" href={`/contractors/${encodeURIComponent(c.slug)}`}>
          {c.profile_image_url ? <img className="home-contractor-photo" src={c.profile_image_url} alt="" width="400" height="240" loading="lazy" /> :
            <AssetPlaceholder label="ภาพช่าง" className="home-contractor-photo" />}
          <div className="home-contractor-copy">
            <h3>{c.business_name}</h3>
            {c.province && <p className="home-card-location"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M12 2a8 8 0 0 0-8 8c0 6 8 12 8 12s8-6 8-12a8 8 0 0 0-8-8m0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6" /></svg>{c.province.name_th}</p>}
            <p className="home-card-rating">{c.review_count > 0 ? <><span aria-hidden="true">★</span> {c.rating_avg.toFixed(1)} <small>({c.review_count} รีวิว)</small></> : <small>ยังไม่มีรีวิว</small>}</p>
            <ul className="home-card-tags">{c.categories.slice(0,2).map(cat => <li key={cat.id}>{cat.name_th}</li>)}</ul>
            {c.verification_status === 'verified' && <span className="sr-only">ยืนยันตัวตนแล้ว</span>}
          </div>
        </a>
      </li>)}</ul>}
  </section>;
}
