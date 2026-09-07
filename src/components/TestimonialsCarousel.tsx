'use client';

import { useEffect, useRef, useState } from 'react';
import type { FeaturedReview } from '../lib/data/reviews';
import { AssetPlaceholder } from './AssetPlaceholder';

/**
 * Issue #42, Layer B round 3 (Testimonials — comment 5571511154,
 * "REQUEST CHANGES" on the prior round): Owner re-uploaded the
 * canonical 815x1930 full-page Master (comment 5571463226) and
 * designated it "the single visual source of truth" for Testimonials,
 * superseding the abstract gray-skeleton wireframe used in the prior
 * round. `testimonials-header-v3.png`/`testimonial-card-frame-v3.png`
 * are direct crops of THIS file (never redrawn — same "crop the
 * Owner's own original" precedent used throughout this issue): header
 * strip at (0,1358)-(815,1422) (starts exactly where the light
 * testimonials background begins, measured pixel-by-pixel to exclude
 * the Contractor CTA section's navy tail directly above it), one card
 * at (40,1422)-(204,1541) of the 815x1930 canvas — the same
 * reference-canvas system this whole
 * issue's Layer A geometry was built on (see Hero.tsx's comment on
 * `k = 1280/815`).
 *
 * Unlike the prior wireframe, THIS Master shows fully-rendered example
 * content (a fictional name/avatar photo/location/comment per card) —
 * it is NOT literal content to copy, only the visual proportions to
 * measure. Every visible field is still replaced by real overlaid
 * data (rating, comment, honest identity fallback), on an opaque white
 * backing so none of the Master's fictional example content shows
 * through.
 *
 * Fluid typography fix: the prior round's text overlays used fixed px
 * Tailwind sizes, which do NOT scale together with the background
 * image at different viewport widths — the Owner's "font size must
 * match the Master precisely" requirement can't hold at more than one
 * specific width that way. Every font-size here is instead expressed
 * in `cqw` (CSS container query width units, `container-type:
 * inline-size` on each `<li>`) computed as `(measured native px /
 * card native width 164px) * 100`, so text scales exactly together
 * with the card image at every breakpoint, the same guarantee the
 * existing % position/size overlays already had.
 *
 * Measured (card-native, 164x119px, connected-component/ink-mask
 * analysis on the source PNG): quote icon x[15,26] y[10,22]; comment
 * block y[26,73] (3 lines); avatar (photo pixels) x[13,39] y[85,110]
 * (~26px circle); name/location text x[45,104] y[81,109] (two lines);
 * star row x[111,154] y[90,101] (~11px tall glyphs). At this source's
 * native resolution these text regions are only a few px tall, so
 * exact single-pixel font metrics carry residual uncertainty inherent
 * to the source's own resolution — reported transparently rather than
 * presented as more precise than the source can support; the
 * positions/proportions themselves are directly measured, not
 * eyeballed.
 *
 * Exactly-4-slot calibration: each card is a fixed `lg:w-[calc(25%-9px)]`
 * quarter of the row at desktop, matching the Master's 4-card layout,
 * whether 1 or 4+ real reviews exist — never fabricated reviews to
 * fill empty slots (see TestimonialsSection's empty-state instead).
 *
 * Reviewer avatar (Owner's point 4): investigated the real data path
 * before falling back to AssetPlaceholder — see reviews.ts's own
 * updated header comment for the schema finding and why it's not
 * wired up here.
 */
const CARD_NATIVE_W = 164;

function cqw(px: number) {
  return `${((px / CARD_NATIVE_W) * 100).toFixed(2)}cqw`;
}

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
    <div className="mt-4">
      <div className="relative w-full">
        <img
          src="/images/testimonials-header-v3.png"
          alt=""
          aria-hidden="true"
          width={815}
          height={64}
          className="h-auto w-full"
        />
        <h2 className="sr-only">เสียงจากผู้ใช้งานจริง</h2>
        <p className="sr-only">ความประทับใจจากเจ้าของบ้าน และผู้ว่าจ้างทั่วประเทศ</p>

        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          disabled={!canScrollLeft}
          aria-label="รีวิวก่อนหน้า"
          className="absolute rounded-full disabled:cursor-not-allowed disabled:opacity-30"
          style={{ left: '88.6%', top: '45.3%', width: '2.9%', height: '37.5%' }}
        />
        <button
          type="button"
          onClick={() => scrollByCard(1)}
          disabled={!canScrollRight}
          aria-label="รีวิวถัดไป"
          className="absolute rounded-full disabled:cursor-not-allowed disabled:opacity-30"
          style={{ left: '93.1%', top: '45.3%', width: '2.8%', height: '35.9%' }}
        />
      </div>

      <ul
        ref={trackRef}
        className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {reviews.map((review) => (
          <li
            key={review.id}
            className="relative w-[85%] flex-shrink-0 snap-start sm:w-[45%] lg:w-[calc(25%-9px)]"
            style={{ containerType: 'inline-size' }}
          >
            <img
              src="/images/testimonial-card-frame-v3.png"
              alt=""
              aria-hidden="true"
              width={164}
              height={119}
              className="h-auto w-full"
            />

            {review.comment ? (
              <p
                className="absolute overflow-hidden bg-white leading-tight text-slate-700"
                style={{ left: '7%', right: '4%', top: '19%', height: '45%', fontSize: cqw(10) }}
              >
                <span className="line-clamp-3">{review.comment}</span>
              </p>
            ) : null}

            <div className="absolute bg-white" style={{ left: '6%', top: '68%', width: '19%', height: '28%' }}>
              <AssetPlaceholder label="รูปลูกค้า" shape="circle" className="h-full w-full text-[5px]" />
            </div>

            <div className="absolute bg-white" style={{ left: '25%', top: '63%', width: '48%', height: '34%' }}>
              <p
                className="truncate font-semibold leading-tight text-master-text"
                style={{ fontSize: cqw(9) }}
              >
                ลูกค้าที่ใช้บริการจริง
              </p>
              <a
                href={`/contractors/${encodeURIComponent(review.contractorSlug)}#review-${review.id}`}
                className="mt-1 block truncate leading-tight text-slate-500 hover:text-brand-600 hover:underline"
                style={{ fontSize: cqw(8) }}
              >
                รีวิวถึง {review.contractorBusinessName}
              </a>
            </div>

            <div
              aria-hidden="true"
              className="absolute flex items-center justify-end bg-white leading-none text-brand-500"
              style={{ left: '52%', right: '2%', top: '72%', height: '15%', fontSize: cqw(11) }}
            >
              {'★'.repeat(review.rating)}
              <span className="text-slate-300">{'★'.repeat(5 - review.rating)}</span>
            </div>
            <span className="sr-only">{review.rating} จาก 5 ดาว</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
