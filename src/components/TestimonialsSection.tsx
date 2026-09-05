import type { FeaturedReview } from '../lib/data/reviews';
import { AssetPlaceholder } from './AssetPlaceholder';

/**
 * Home Page "เสียงจากผู้ใช้งานจริง" (Issue #42) — real reviews only
 * (see getFeaturedReviews()'s own header comment for the full
 * reasoning). No reviewer name/avatar is shown — that data doesn't
 * exist publicly anywhere in this system by design — so each card
 * reads as a real rating + real comment for a named REAL contractor,
 * labeled with a generic "ลูกค้าที่ใช้บริการจริง" instead of a
 * fabricated person. Renders an honest empty state when there aren't
 * enough real positive reviews yet to feature, the same pattern already
 * established by CategoryGrid/ArticlesSection/FeaturedContractors.
 *
 * Layer A: the reference shows a person's avatar photo per card — since
 * no reviewer identity/photo exists anywhere in this system (see
 * above), this is a reserved `AssetPlaceholder` slot, never a fabricated
 * avatar image or initials standing in for a specific (nonexistent)
 * person.
 *
 * Issue #42, Layer A final calibration — height locked to ~305px at
 * `lg:` (194/815 of the Master's reference canvas, scaled by this
 * codebase's 1280px desktop QA viewport — see Hero.tsx's comment).
 * Container width unified to the shared ~1173px content-width token.
 */
export function TestimonialsSection({ reviews }: { reviews: FeaturedReview[] }) {
  return (
    <section className="bg-master-page-bg lg:flex lg:min-h-[305px] lg:items-center">
      <div className="mx-auto w-full max-w-[1173px] px-4 py-9 sm:px-[53px] lg:py-4">
        <h2 className="text-center text-2xl font-bold text-master-text lg:text-lg">เสียงจากผู้ใช้งานจริง</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-[15px] leading-relaxed text-slate-600 lg:text-xs">
          ความประทับใจจากเจ้าของบ้านที่เคยใช้บริการผ่านแพลตฟอร์มของเรา
        </p>

        {reviews.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-slate-300 p-6 text-center text-[15px] leading-relaxed text-slate-500">
            ยังไม่มีรีวิวเพียงพอที่จะแสดงในขณะนี้
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {reviews.map((review) => (
              <li key={review.id} className="flex h-full flex-col rounded-xl border border-master-border bg-white p-3">
                <AssetPlaceholder label="รูปลูกค้า" shape="circle" className="h-9 w-9 text-[8px]" />
                <div aria-hidden="true" className="mt-2 text-brand-500">
                  {'★'.repeat(review.rating)}
                  <span className="text-slate-300">{'★'.repeat(5 - review.rating)}</span>
                </div>
                {review.comment ? (
                  <p className="mt-2 line-clamp-3 flex-1 text-xs leading-relaxed text-slate-700">
                    “{review.comment}”
                  </p>
                ) : null}
                <div className="mt-2 border-t border-slate-100 pt-2">
                  <p className="text-xs font-semibold text-master-text">ลูกค้าที่ใช้บริการจริง</p>
                  <a
                    href={`/contractors/${encodeURIComponent(review.contractorSlug)}`}
                    className="text-xs text-slate-500 hover:text-brand-600 hover:underline"
                  >
                    รีวิวถึง {review.contractorBusinessName}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
