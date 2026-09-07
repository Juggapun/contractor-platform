'use client';

import { useEffect, useRef, useState } from 'react';
import type { FeaturedReview } from '../lib/data/reviews';
import { AssetPlaceholder } from './AssetPlaceholder';

/**
 * Issue #42, Layer B (Testimonials — comment 5570885896): the Master
 * reference shows real prev/next carousel arrows next to the heading.
 * No such arrows existed before, and the owner's instruction is
 * explicit that if arrows are added they must have real behavior, not
 * be decorative — so this is a genuine horizontal-scroll carousel
 * (native `scrollBy`, not a fake/no-op click handler), split into its
 * own small client component so the section itself (and its real
 * server-fetched `reviews` data) stays a server component.
 *
 * Buttons disable at each scroll boundary via a real scroll-position
 * check (not a static enabled/disabled guess) — with few reviews (this
 * environment's seed data has exactly one `rating >= 4` review right
 * now) both arrows correctly end up disabled rather than pretending
 * there's more to scroll to; that's honest behavior, not a bug to hide.
 */
export function TestimonialsCarousel({ reviews }: { reviews: FeaturedReview[] }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateScrollState();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
    // reviews.length affects whether the track is scrollable at all
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviews.length]);

  const scrollByCard = (direction: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector('li');
    const distance = (card?.clientWidth ?? el.clientWidth) + 12;
    el.scrollBy({ left: direction * distance, behavior: 'smooth' });
  };

  return (
    <div className="relative mt-4">
      <div className="absolute -top-14 right-0 hidden gap-2 sm:flex">
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          disabled={!canScrollLeft}
          aria-label="รีวิวก่อนหน้า"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-master-border bg-white text-master-text disabled:cursor-not-allowed disabled:opacity-30 hover:enabled:bg-slate-50"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => scrollByCard(1)}
          disabled={!canScrollRight}
          aria-label="รีวิวถัดไป"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-master-border bg-white text-master-text disabled:cursor-not-allowed disabled:opacity-30 hover:enabled:bg-slate-50"
        >
          ›
        </button>
      </div>

      <ul
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {reviews.map((review) => (
          <li
            key={review.id}
            className="flex h-full w-[85%] flex-shrink-0 snap-start flex-col rounded-xl border border-master-border bg-white p-4 sm:w-[45%] lg:w-[calc(25%-9px)]"
          >
            <span aria-hidden="true" className="text-2xl font-bold leading-none text-master-navy/70">
              &ldquo;
            </span>
            {review.comment ? (
              <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-700">{review.comment}</p>
            ) : (
              <span className="flex-1" />
            )}
            <div className="mt-3 border-t border-slate-100 pt-3">
              <div className="flex items-center gap-2">
                <AssetPlaceholder label="รูปลูกค้า" shape="circle" className="h-9 w-9 flex-shrink-0 text-[7px]" />
                <p className="text-sm font-semibold text-master-text">ลูกค้าที่ใช้บริการจริง</p>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <a
                  href={`/contractors/${encodeURIComponent(review.contractorSlug)}`}
                  className="truncate text-xs text-slate-500 hover:text-brand-600 hover:underline"
                >
                  รีวิวถึง {review.contractorBusinessName}
                </a>
                <div aria-hidden="true" className="flex-shrink-0 text-xs text-brand-500">
                  {'★'.repeat(review.rating)}
                  <span className="text-slate-300">{'★'.repeat(5 - review.rating)}</span>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
