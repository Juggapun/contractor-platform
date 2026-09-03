import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContractorProfile } from '../../../src/lib/data/contractors';
import { getPortfolioImages } from '../../../src/lib/data/portfolio';
import { getReviews } from '../../../src/lib/data/reviews';
import { recordContactEvent } from '../../../src/lib/data/contactEvents';
import { getSiteUrl } from '../../../src/lib/env';
import { ContactLink } from '../../../src/components/ContactLink';
import { ReviewForm } from '../../../src/components/ReviewForm';
import { JsonLd } from '../../../src/components/JsonLd';

// Reproduced directly (Issue #18 follow-up): a Thai business name (this
// project's own slug convention -- see app/api/contractors/register/route.ts's
// slugify()) produces a percent-encoded URL segment, e.g. `%E0%B8%94...`
// for `ดีบั๊กทดสอบ`. Instrumented getContractorProfile() directly and
// caught two DIFFERENT slug values reaching it for the exact same page
// request: `generateMetadata`'s params resolved already decoded, but the
// page component's own `params` resolved still percent-encoded --
// querying `slug = '%E0%B8%94...'` correctly finds zero rows (that's not
// a real slug), so `getContractorProfile` correctly returned null for
// that call and the page rendered its real notFound() UI, even though
// the contractor was genuinely approved and metadata rendered fine.
// Not a caching bug at all (fetch is uncached by default in this Next.js
// version's "Previous Model" -- verified in node_modules/next/dist/docs
// rather than assumed) and not fixed by `force-dynamic` alone (kept
// below anyway as it's still correct for this route: a status change
// must always be visible immediately, no route-level caching wanted).
// Fix: decode the slug explicitly and unconditionally before using it as
// a query filter -- safe to call on an already-decoded string too, since
// slugify() strips `%` from every slug at creation time, so a real slug
// can never contain a literal `%` for decodeURIComponent to misinterpret.
export const dynamic = 'force-dynamic';

function resolveSlug(rawSlug: string): string {
  try {
    return decodeURIComponent(rawSlug);
  } catch {
    return rawSlug;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = resolveSlug(rawSlug);
  const profile = await getContractorProfile(slug);
  if (!profile) {
    // A slug that doesn't exist, or exists but isn't `status='approved'`
    // (pending/rejected/suspended) — getContractorProfile() deliberately
    // never distinguishes those cases (see its own header comment), and
    // neither does this metadata: both render the same real HTTP 404
    // (notFound(), below) with the same noindex signal, so neither case
    // can be inferred to exist from the outside. Phase 11 (Issue #9):
    // "Prevent indexing of ... pending/rejected/suspended or otherwise
    // non-public pages."
    return { title: 'ไม่พบผู้รับเหมา', robots: { index: false, follow: false } };
  }

  const location = [profile.district?.name_th, profile.province?.name_th].filter(Boolean).join(', ');
  const categoryNames = profile.categories.map((c) => c.name_th).join(', ');
  const description =
    profile.description?.slice(0, 155) ||
    [`ผู้รับเหมา${profile.business_name}`, categoryNames, location].filter(Boolean).join(' — ');
  const canonicalPath = `/contractors/${profile.slug}`;

  return {
    title: profile.business_name,
    description,
    alternates: { canonical: canonicalPath },
    robots: { index: true, follow: true },
    openGraph: {
      title: profile.business_name,
      description,
      url: canonicalPath,
      // Not 'profile' — that OG type represents a *person* (first/last
      // name, gender) per the spec; this page is a business listing.
      type: 'website',
      images: profile.profile_image_url ? [profile.profile_image_url] : undefined,
    },
    twitter: {
      card: 'summary',
      title: profile.business_name,
      description,
    },
  };
}

export default async function ContractorProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = resolveSlug(rawSlug);
  const profile = await getContractorProfile(slug);

  if (!profile) {
    notFound();
  }

  const [portfolioImages, reviews] = await Promise.all([
    getPortfolioImages(profile.id),
    getReviews(profile.id),
  ]);

  // Anonymous interest signal (0008_contact_events.sql) — best-effort,
  // never blocks or fails the page render if it errors.
  void recordContactEvent(profile.id, 'profile_view');

  const location = [profile.district?.name_th, profile.province?.name_th].filter(Boolean).join(', ');
  const hasContactInfo = Boolean(
    profile.phone || profile.line_id || profile.facebook_url || profile.website_url
  );

  const siteUrl = getSiteUrl();
  // Conservative LocalBusiness structured data — every field here comes
  // straight from `profile`, the same real data already rendered on the
  // page below; nothing is fabricated or inferred (Phase 11, Issue #9:
  // "Keep structured data conservative and accurate; only add schema
  // markup where the existing page content genuinely supports it").
  // aggregateRating is included only when review_count > 0 — schema.org
  // (and Google's own guidance) treats a rating with zero backing
  // reviews as invalid/spammy structured data.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: profile.business_name,
    url: `${siteUrl}/contractors/${profile.slug}`,
    ...(profile.description ? { description: profile.description } : {}),
    ...(profile.phone ? { telephone: profile.phone } : {}),
    ...(profile.address || location ? { address: profile.address || location } : {}),
    ...(profile.profile_image_url ? { image: profile.profile_image_url } : {}),
    ...(profile.review_count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: profile.rating_avg,
            reviewCount: profile.review_count,
          },
        }
      : {}),
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <JsonLd data={jsonLd} />
      {/* Identity */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
          {profile.profile_image_url ? (
            <img
              src={profile.profile_image_url}
              alt={profile.business_name}
              className="h-full w-full object-cover"
              // Phase 13 (Issue #11): CLS is already not a risk here —
              // the parent's `h-24 w-24` (above) fully reserves this
              // box's size in CSS regardless of the image, verified by
              // reading the surrounding markup rather than assumed.
              // width/height are still supplied as a correct, defensive
              // HTML practice (a real ratio hint if that CSS ever
              // changes), matching the real 1:1 box. Near the top of the
              // page and likely the first meaningful image a visitor
              // sees, so this stays eager (the default) rather than lazy.
              width={96}
              height={96}
              decoding="async"
            />
          ) : (
            <span aria-hidden="true" className="text-4xl text-slate-300">
              🛠️
            </span>
          )}
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{profile.business_name}</h1>
            {profile.verification_status === 'verified' ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                ✓ ยืนยันตัวตนแล้ว
              </span>
            ) : null}
          </div>

          {location ? <p className="mt-1 text-[15px] text-slate-600">📍 {location}</p> : null}

          {profile.categories.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {profile.categories.map((cat) => (
                <li
                  key={cat.id}
                  className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {cat.name_th}
                </li>
              ))}
            </ul>
          ) : null}

          <p className="mt-2 text-sm text-slate-600">
            {profile.review_count > 0 ? (
              <>
                ⭐ {profile.rating_avg.toFixed(1)}{' '}
                <span className="text-slate-400">({profile.review_count} รีวิว)</span>
              </>
            ) : (
              <span className="text-slate-400">ยังไม่มีรีวิว</span>
            )}
            {profile.years_experience !== null ? (
              <span className="ml-3 text-slate-400">ประสบการณ์ {profile.years_experience} ปี</span>
            ) : null}
          </p>
        </div>
      </div>

      {/* Description */}
      {profile.description ? (
        <section className="mt-8" aria-labelledby="about-heading">
          <h2 id="about-heading" className="text-lg font-semibold text-slate-900">
            เกี่ยวกับผู้รับเหมา
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-700">{profile.description}</p>
        </section>
      ) : null}

      {/* Contact CTAs */}
      <section className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-6" aria-labelledby="contact-heading">
        <h2 id="contact-heading" className="text-lg font-semibold text-slate-900">
          ติดต่อผู้รับเหมา
        </h2>

        {hasContactInfo ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.phone ? (
              <ContactLink
                contractorId={profile.id}
                eventType="phone"
                href={`tel:${profile.phone}`}
                className="rounded-md bg-brand-400 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-brand-500"
              >
                📞 โทร {profile.phone}
              </ContactLink>
            ) : null}
            {profile.line_id ? (
              <ContactLink
                contractorId={profile.id}
                eventType="line"
                href={`https://line.me/ti/p/~${encodeURIComponent(profile.line_id)}`}
                className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                💬 LINE
              </ContactLink>
            ) : null}
            {profile.facebook_url ? (
              <ContactLink
                contractorId={profile.id}
                eventType="facebook"
                href={profile.facebook_url}
                className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Facebook
              </ContactLink>
            ) : null}
            {profile.website_url ? (
              <ContactLink
                contractorId={profile.id}
                eventType="website"
                href={profile.website_url}
                className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                🌐 เว็บไซต์
              </ContactLink>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">ยังไม่มีข้อมูลติดต่อสาธารณะสำหรับผู้รับเหมารายนี้</p>
        )}

        {profile.address ? <p className="mt-3 text-sm text-slate-600">📍 {profile.address}</p> : null}
      </section>

      {/* Portfolio */}
      <section className="mt-8" aria-labelledby="portfolio-heading">
        <h2 id="portfolio-heading" className="text-lg font-semibold text-slate-900">
          ผลงาน
        </h2>
        {portfolioImages.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
            ยังไม่มีผลงานให้แสดงในขณะนี้
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {portfolioImages.map((img) => (
              <li key={img.id} className="overflow-hidden rounded-lg border border-slate-200">
                <img
                  src={img.thumbnail_url}
                  alt={img.project_name || `ผลงานของ ${profile.business_name}`}
                  className="h-32 w-full object-cover"
                  // Phase 13 (Issue #11): same "already CSS-sized, this
                  // is a defensive ratio hint" reasoning as the hero
                  // image above — `h-32 w-full` already fixes this box.
                  // width/height (300x200) match this project's actual
                  // thumbnail aspect ratio (3:2, per the seeded/generated
                  // thumbnail_url assets). The real, measurable change
                  // here is `loading="lazy"`: a portfolio grid is exactly
                  // the below-the-fold, possibly-many-images case lazy
                  // loading exists for — verified in the rendered HTML
                  // below (see docs/PHASE13-PERFORMANCE-REPORT.md).
                  width={300}
                  height={200}
                  loading="lazy"
                  decoding="async"
                />
                {img.project_name ? (
                  <p className="p-2 text-xs font-medium text-slate-700">{img.project_name}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Reviews */}
      <section className="mt-8" aria-labelledby="reviews-heading">
        <h2 id="reviews-heading" className="text-lg font-semibold text-slate-900">
          รีวิวจากลูกค้า
        </h2>

        <div className="mt-3">
          <ReviewForm contractorId={profile.id} />
        </div>

        {reviews.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
            ยังไม่มีรีวิวสำหรับผู้รับเหมารายนี้
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-lg border border-slate-200 p-4">
                <p className="text-sm font-medium text-slate-900">
                  {'⭐'.repeat(review.rating)}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {new Date(review.created_at).toLocaleDateString('th-TH')}
                  </span>
                </p>
                {review.comment ? (
                  <p className="mt-1 text-[15px] leading-relaxed text-slate-700">{review.comment}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-10 text-center">
        <a href="/search" className="text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline">
          ← กลับไปหน้าค้นหา
        </a>
      </div>
    </div>
  );
}
