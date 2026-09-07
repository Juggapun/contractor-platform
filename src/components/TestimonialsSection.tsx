import type { FeaturedReview } from '../lib/data/reviews';
import { TestimonialsCarousel } from './TestimonialsCarousel';

/**
 * Home Page "เสียงจากผู้ใช้งานจริง" (Issue #42, Layer B — comment
 * 5570885896). Restyled to match the Owner-supplied combined
 * Testimonials/Articles/Footer Master reference (a visual reference to
 * rebuild from real components, unlike the flattened How It
 * Works+Why Use image — this section's own testimonial content must
 * stay real/dynamic per the Owner's explicit instruction: "Do NOT
 * fabricate testimonial data merely to match the artwork").
 *
 * No reviewer name/avatar is shown — that data doesn't exist publicly
 * anywhere in this system by design (see getFeaturedReviews()'s own
 * header comment) — so each card still reads as a real rating + real
 * comment for a named REAL contractor, labeled with the generic
 * "ลูกค้าที่ใช้บริการจริง" instead of inventing a person's name/photo
 * to match the Master's mockup names. The Master's own left yellow
 * accent bar + heading treatment (also used by the now-image-baked
 * How It Works/Why Use headings) is reproduced here in real CSS/text
 * since this heading must stay live (not baked into an image).
 *
 * The real prev/next carousel arrows shown in the Master are built in
 * `TestimonialsCarousel.tsx` (a small client component) — see its own
 * header comment for why they're genuinely functional, not decorative.
 *
 * Renders an honest empty state when there aren't enough real positive
 * reviews yet to feature, the same pattern already established by
 * CategoryGrid/ArticlesSection/FeaturedContractors.
 */
export function TestimonialsSection({ reviews }: { reviews: FeaturedReview[] }) {
  return (
    <section className="bg-master-page-bg">
      <div className="mx-auto w-full max-w-[1173px] px-4 py-9 sm:px-[53px] lg:py-8">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="mt-1 h-6 w-1 flex-shrink-0 rounded bg-master-yellow-accent" />
          <div>
            <h2 className="text-2xl font-bold text-master-text lg:text-lg">เสียงจากผู้ใช้งานจริง</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-slate-600 lg:text-xs">
              ความประทับใจจากเจ้าของบ้าน และผู้ว่าจ้างทั่วประเทศ
            </p>
          </div>
        </div>

        {reviews.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-slate-300 p-6 text-center text-[15px] leading-relaxed text-slate-500">
            ยังไม่มีรีวิวเพียงพอที่จะแสดงในขณะนี้
          </p>
        ) : (
          <TestimonialsCarousel reviews={reviews} />
        )}
      </div>
    </section>
  );
}
