import type { ContractorSummary } from '../lib/data/contractors';

/**
 * Shows only fields that are genuinely on the schema and genuinely
 * public under RLS for an approved contractor — nothing fabricated.
 * rating/review text is only shown when review_count > 0; a contractor
 * with zero reviews says so honestly rather than showing "0.0 ★".
 */
export function ContractorCard({
  contractor,
  headingLevel = 'h2',
}: {
  contractor: ContractorSummary;
  /**
   * Issue #42: FeaturedContractors renders this card under its OWN `h2`
   * section heading ("ช่างแนะนำ"), unlike /search (this component's
   * original and still-default caller), whose page has no other h2
   * above the results — there, `h2` is the correct next level under the
   * page's `h1`. Defaults to `h2` so /search's existing markup is
   * unchanged; FeaturedContractors passes `h3` to keep the heading
   * hierarchy correct there instead.
   */
  headingLevel?: 'h2' | 'h3';
}) {
  const location = [contractor.district?.name_th, contractor.province?.name_th]
    .filter(Boolean)
    .join(', ');
  const HeadingTag = headingLevel;

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 p-4 transition hover:border-brand-400 hover:shadow-sm">
      <div className="mb-3 flex h-32 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
        {contractor.profile_image_url ? (
          <img
            src={contractor.profile_image_url}
            alt={contractor.business_name}
            className="h-full w-full object-cover"
            // Phase 13 (Issue #11): the parent's fixed `h-32` (above)
            // already reserves this box in CSS — width/height are a
            // defensive ratio hint, not fixing an observed CLS bug. The
            // real, measurable change is `loading="lazy"`: a
            // search-results grid can show many cards, most below the
            // fold, so this shouldn't compete with whatever IS the real
            // above-the-fold LCP content for bandwidth on page load.
            width={400}
            height={300}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span aria-hidden="true" className="text-4xl text-slate-300">
            🛠️
          </span>
        )}
      </div>

      <HeadingTag className="text-base font-semibold text-slate-900">
        <a href={`/contractors/${encodeURIComponent(contractor.slug)}`} className="hover:underline">
          {contractor.business_name}
        </a>
      </HeadingTag>

      {location ? <p className="mt-1 text-sm text-slate-600">📍 {location}</p> : null}

      {contractor.categories.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {contractor.categories.slice(0, 3).map((cat) => (
            <li
              key={cat.id}
              className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              {cat.name_th}
            </li>
          ))}
        </ul>
      ) : null}

      {contractor.description ? (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">
          {contractor.description}
        </p>
      ) : null}

      <div className="mt-auto flex items-center justify-between pt-3 text-sm">
        <span className="text-slate-600">
          {contractor.review_count > 0 ? (
            <>
              ⭐ {contractor.rating_avg.toFixed(1)}{' '}
              <span className="text-slate-400">({contractor.review_count} รีวิว)</span>
            </>
          ) : (
            <span className="text-slate-400">ยังไม่มีรีวิว</span>
          )}
        </span>
        {contractor.verification_status === 'verified' ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            ✓ ยืนยันตัวตนแล้ว
          </span>
        ) : null}
      </div>
    </div>
  );
}
