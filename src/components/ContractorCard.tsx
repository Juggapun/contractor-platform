import { COVER_WIDTH, COVER_HEIGHT } from '../lib/uploads/coverDimensions';
import type { ContractorSummary } from '../lib/data/contractors';

export function ContractorCard({ contractor, headingLevel = 'h2' }: {
  contractor: ContractorSummary; headingLevel?: 'h2' | 'h3';
}) {
  const Heading = headingLevel;
  const location = [contractor.district?.name_th, contractor.province?.name_th].filter(Boolean).join(', ');
  const href = `/contractors/${encodeURIComponent(contractor.slug)}`;
  return <article className="contractor-result-card">
    <a href={href} tabIndex={-1} aria-hidden="true" className="contractor-result-cover">
      {contractor.cover_image_url ? <img src={contractor.cover_image_url} alt="" width={COVER_WIDTH} height={COVER_HEIGHT} loading="lazy" decoding="async" /> : <span>ยังไม่ได้เพิ่มรูปปก</span>}
    </a>
    <div className="contractor-result-body">
      <div className="contractor-result-identity">
        {contractor.profile_image_url ? <img src={contractor.profile_image_url} alt="" width={56} height={56} loading="lazy" decoding="async" className="contractor-result-avatar" /> : <span className="contractor-result-avatar contractor-result-initial" aria-hidden="true">{Array.from(contractor.business_name)[0]}</span>}
        <div><Heading><a href={href}>{contractor.business_name}</a></Heading>{location ? <p className="contractor-result-location">พื้นที่: {location}</p> : null}</div>
      </div>
      {contractor.categories.length ? <ul className="contractor-result-tags">{contractor.categories.slice(0, 3).map(c => <li key={c.id}>{c.name_th}</li>)}</ul> : null}
      {contractor.description ? <p className="contractor-result-description">{contractor.description}</p> : null}
      <div className="contractor-result-rating">
        {contractor.review_count > 0 ? <span><span className="text-yellow-500" aria-hidden="true">★</span> <strong>{contractor.rating_avg.toFixed(1)}</strong> <span className="text-slate-500">({contractor.review_count} รีวิว)</span></span> : <span className="text-slate-500">ยังไม่มีรีวิว</span>}
        {contractor.verification_status === 'verified' ? <span className="text-xs text-emerald-700">✓ ยืนยันตัวตนแล้ว</span> : null}
      </div>
      <a href={href} className="contractor-result-action" aria-label={`ดูผลงานและรู้จัก ${contractor.business_name}`}>ดูผลงานและรู้จักช่าง <span aria-hidden="true">→</span></a>
    </div>
  </article>;
}
