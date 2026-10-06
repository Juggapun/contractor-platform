import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContractorProfile } from '../../../../src/lib/data/contractors';
import { getPortfolioImages } from '../../../../src/lib/data/portfolio';
import { getReviews } from '../../../../src/lib/data/reviews';
import { recordContactEvent } from '../../../../src/lib/data/contactEvents';
import { getSiteUrl } from '../../../../src/lib/env';
import { resolveSlug } from '../../../../src/lib/contractors/resolveSlug';
import { isValidUrl } from '../../../../src/lib/validation/contractorRegistration';
import { ContactLink } from '../../../../src/components/ContactLink';
import { ReviewForm } from '../../../../src/components/ReviewForm';
import { JsonLd } from '../../../../src/components/JsonLd';
import { PortfolioGallery } from '../../../../src/components/PortfolioGallery';

// Issue #18 follow-up: generateMetadata() and the page component below
// were found to resolve the SAME dynamic `params.slug` differently for
// the SAME request (one decoded, one still percent-encoded) -- see
// src/lib/contractors/resolveSlug.ts for the full root-cause writeup and
// its regression test. Not a caching bug (fetch is uncached by default
// in this Next.js version's "Previous Model") and not fixed by
// `force-dynamic` alone -- kept below anyway as it's still correct for
// this route: a status change must always be visible immediately, no
// route-level caching wanted.
export const dynamic = 'force-dynamic';

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
      images: profile.cover_image_url ? [profile.cover_image_url] : profile.profile_image_url ? [profile.profile_image_url] : undefined,
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
  // QA #22: re-validated here, not trusted from the column as-is — see
  // isValidUrl()'s header comment (src/lib/validation/contractorRegistration.ts)
  // for why a value reaching this render is not guaranteed to have ever
  // passed registration-time validation.
  const safeFacebookUrl = profile.facebook_url && isValidUrl(profile.facebook_url) ? profile.facebook_url : null;
  const safeWebsiteUrl = profile.website_url && isValidUrl(profile.website_url) ? profile.website_url : null;
  const hasContactInfo = Boolean(profile.phone || profile.line_id || safeFacebookUrl || safeWebsiteUrl);

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

  const contactLinks = (
    <>
      {profile.phone ? <ContactLink contractorId={profile.id} eventType="phone" href={`tel:${profile.phone}`} className="profile-contact-phone">โทรหาช่าง</ContactLink> : null}
      {profile.line_id ? <ContactLink contractorId={profile.id} eventType="line" href={`https://line.me/ti/p/~${encodeURIComponent(profile.line_id)}`} className="profile-contact-line">LINE</ContactLink> : null}
      {safeFacebookUrl ? <ContactLink contractorId={profile.id} eventType="facebook" href={safeFacebookUrl} className="profile-contact-facebook">Facebook</ContactLink> : null}
      {safeWebsiteUrl ? <ContactLink contractorId={profile.id} eventType="website" href={safeWebsiteUrl} className="profile-contact-website">เว็บไซต์</ContactLink> : null}
    </>
  );

  return (
    <div className={`contractor-profile-page${hasContactInfo ? ' has-contact-dock' : ''}`}>
      <JsonLd data={jsonLd} />
      <div className="contractor-profile-shell">
        <nav aria-label="เส้นทางหน้า" className="profile-breadcrumb"><a href="/">หน้าแรก</a><span aria-hidden="true">/</span><a href="/search">ค้นหาช่าง</a><span aria-hidden="true">/</span><span>{profile.business_name}</span></nav>
        <section className={`profile-hero${profile.cover_image_url ? ' has-cover' : ''}`} aria-labelledby="profile-name">
          {profile.cover_image_url ? <div className="profile-cover"><img src={profile.cover_image_url} alt={`รูปปก ${profile.business_name}`} width={1080} height={720} decoding="async" /></div> : null}
          <div className="profile-identity">
            <div className="profile-avatar">
              {profile.profile_image_url ? <img src={profile.profile_image_url} alt={`รูปโปรไฟล์ ${profile.business_name}`} width={112} height={112} decoding="async" /> : <span aria-hidden="true">{Array.from(profile.business_name)[0]}</span>}
            </div>
            <div className="profile-identity-copy">
              <h1 id="profile-name">{profile.business_name}</h1>
              {location ? <p className="profile-location">{location}</p> : null}
              {profile.categories.length ? <ul className="profile-categories">{profile.categories.map(cat => <li key={cat.id}>{cat.name_th}</li>)}</ul> : null}
              <div className="profile-facts">
                <span>{profile.review_count > 0 ? <><span className="profile-star" aria-hidden="true">★</span> <strong>{profile.rating_avg.toFixed(1)}</strong> <a href="#reviews-heading">({profile.review_count} รีวิว)</a></> : 'ยังไม่มีรีวิว'}</span>
                {profile.years_experience !== null ? <span>ประสบการณ์ {profile.years_experience} ปี</span> : null}
              </div>
              {profile.verification_status === 'verified' ? <p className="profile-verified">✓ ยืนยันตัวตนแล้ว</p> : null}
            </div>
          </div>
        </section>

        <div className="profile-layout">
          <div className="profile-main">
            {profile.description ? <section className="profile-panel" aria-labelledby="about-heading">
              <h2 id="about-heading">เกี่ยวกับช่าง</h2>
              <p className="profile-description">{profile.description}</p>
            </section> : null}

            <section className="profile-panel profile-portfolio" aria-labelledby="portfolio-heading">
              <div className="profile-section-heading"><h2 id="portfolio-heading">ผลงาน</h2><span>{portfolioImages.length} รูป</span></div>
              <PortfolioGallery images={portfolioImages} businessName={profile.business_name} contractorId={profile.id} />
            </section>

            <section className="profile-panel" aria-labelledby="reviews-heading">
              <h2 id="reviews-heading">รีวิวจากลูกค้า</h2>
              <div className="mt-4"><ReviewForm contractorId={profile.id} /></div>
              {reviews.length === 0 ? <p className="profile-empty">ยังไม่มีรีวิวสำหรับผู้รับเหมารายนี้</p> : <ul className="profile-reviews">
                {reviews.map(review => <li key={review.id} id={`review-${review.id}`} className="scroll-mt-24 target:ring-2 target:ring-yellow-400">
                  <div className="profile-review-top"><span className="profile-review-stars" aria-label={`${review.rating} จาก 5 คะแนน`}>{'★'.repeat(review.rating)}<span aria-hidden="true">{'☆'.repeat(5-review.rating)}</span></span><time dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString('th-TH')}</time></div>
                  {review.comment ? <p>{review.comment}</p> : null}
                </li>)}
              </ul>}
            </section>
          </div>

          <aside className="profile-panel profile-contact-panel" aria-labelledby="contact-heading">
            <h2 id="contact-heading">ติดต่อช่าง</h2>
            {hasContactInfo ? <div className="profile-contact-links">{contactLinks}</div> : <p className="profile-empty">ยังไม่มีข้อมูลติดต่อสาธารณะสำหรับผู้รับเหมารายนี้</p>}
            {profile.address ? <p className="profile-contact-detail">ที่อยู่: {profile.address}</p> : null}
          </aside>
        </div>
        <a href="/search" className="profile-back">← กลับไปหน้าค้นหา</a>
      </div>
      {hasContactInfo ? <nav className="profile-contact-dock" aria-label="ติดต่อช่างด่วน">{contactLinks}</nav> : null}
    </div>
  );
}
