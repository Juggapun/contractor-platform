import type { FeaturedReview } from '../lib/data/reviews';

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
 */
export function TestimonialsSection({ reviews }: { reviews: FeaturedReview[] }) {
  return (
    <section className="bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-slate-900">เสียงจากผู้ใช้งานจริง</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-[15px] leading-relaxed text-slate-600">
          ความประทับใจจากเจ้าของบ้านที่เคยใช้บริการผ่านแพลตฟอร์มของเรา
        </p>

        {reviews.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-slate-300 p-6 text-center text-[15px] leading-relaxed text-slate-500">
            ยังไม่มีรีวิวเพียงพอที่จะแสดงในขณะนี้
          </p>
        ) : (
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {reviews.map((review) => (
              <li key={review.id} className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5">
                <div aria-hidden="true" className="text-brand-500">
                  {'★'.repeat(review.rating)}
                  <span className="text-slate-300">{'★'.repeat(5 - review.rating)}</span>
                </div>
                {review.comment ? (
                  <p className="mt-3 line-clamp-4 flex-1 text-sm leading-relaxed text-slate-700">
                    “{review.comment}”
                  </p>
                ) : null}
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="text-sm font-semibold text-slate-900">ลูกค้าที่ใช้บริการจริง</p>
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
