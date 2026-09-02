import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContractorProfile } from '../../../src/lib/data/contractors';
import { getPortfolioImages } from '../../../src/lib/data/portfolio';
import { getReviews } from '../../../src/lib/data/reviews';
import { recordContactEvent } from '../../../src/lib/data/contactEvents';
import { ContactLink } from '../../../src/components/ContactLink';
import { ReviewForm } from '../../../src/components/ReviewForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getContractorProfile(slug);
  if (!profile) {
    return { title: 'ไม่พบผู้รับเหมา' };
  }

  const location = [profile.district?.name_th, profile.province?.name_th].filter(Boolean).join(', ');
  const categoryNames = profile.categories.map((c) => c.name_th).join(', ');
  const description =
    profile.description?.slice(0, 155) ||
    [`ผู้รับเหมา${profile.business_name}`, categoryNames, location].filter(Boolean).join(' — ');

  return {
    title: profile.business_name,
    description,
  };
}

export default async function ContractorProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {/* Identity */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
          {profile.profile_image_url ? (
            <img
              src={profile.profile_image_url}
              alt={profile.business_name}
              className="h-full w-full object-cover"
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
