import type { FeaturedReview } from '../lib/data/reviews';
import { TestimonialsCarousel } from './TestimonialsCarousel';

/**
 * Home Page "เสียงจากผู้ใช้งานจริง" (Issue #42, Layer B round 2 —
 * comment 5571198930). The Owner-supplied Master image is now the
 * visual source of truth for this section (see TestimonialsCarousel's
 * own header comment for the full image-as-background + real-overlay
 * technique and exact measured coordinates) — this wrapper only owns
 * the shared ~1173px content-width container and the empty-state
 * fallback, matching every other Home section's container convention.
 *
 * No reviewer name/avatar is shown — that data doesn't exist publicly
 * anywhere in this system by design (see getFeaturedReviews()'s own
 * header comment) — so each card still reads as a real rating + real
 * comment for a named REAL contractor, never a fabricated person's
 * name/photo to match the Master's placeholder circle.
 *
 * Renders an honest empty state when there aren't enough real positive
 * reviews yet to feature, the same pattern already established by
 * CategoryGrid/ArticlesSection/FeaturedContractors.
 */
export function TestimonialsSection({ reviews }: { reviews: FeaturedReview[] }) {
  return (
    <section className="bg-master-page-bg">
      <div className="mx-auto w-full max-w-[1173px] px-4 py-9 sm:px-[53px] lg:py-8">
        {reviews.length === 0 ? (
          <>
            <h2 className="text-center text-2xl font-bold text-master-text lg:text-lg">เสียงจากผู้ใช้งานจริง</h2>
            <p className="mx-auto mt-1 max-w-xl text-center text-[15px] leading-relaxed text-slate-600 lg:text-xs">
              ความประทับใจจากเจ้าของบ้าน และผู้ว่าจ้างทั่วประเทศ
            </p>
            <p className="mt-6 rounded-lg border border-dashed border-slate-300 p-6 text-center text-[15px] leading-relaxed text-slate-500">
              ยังไม่มีรีวิวเพียงพอที่จะแสดงในขณะนี้
            </p>
          </>
        ) : (
          <TestimonialsCarousel reviews={reviews} />
        )}
      </div>
    </section>
  );
}
