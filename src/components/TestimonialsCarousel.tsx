'use client';

import { useEffect, useRef, useState } from 'react';
import type { FeaturedReview } from '../lib/data/reviews';
import { AssetPlaceholder } from './AssetPlaceholder';

/**
 * Issue #42, Layer B round 2 (Testimonials — comment 5571198930,
 * supersedes the CSS-recreated heading/cards from the prior pass):
 * Owner supplied a fresh Testimonials-only Master image and required
 * it be used AS-IS ("DO NOT redraw, recreate, reinterpret... The image
 * itself is the visual source of truth") while EVERY piece of content
 * shown in it (reviewer identity, comment text, star rating) must
 * stay 100% real/dynamic — the image itself only ever shows generic
 * gray skeleton bars and a fixed 5-star placeholder, never real text.
 *
 * Resolved with the same technique already established (and
 * explicitly approved by the Owner) for Contractor CTA: the supplied
 * artwork's own pixels are used untouched as a background, with real
 * content layered on top at positions measured directly from the
 * source PNG (numpy connected-component/color-mask analysis, not
 * eyeballed) rather than redrawn. Two crops of the ONE supplied file
 * (`public/images/testimonials-master-reference.png`, kept byte-for-
 * byte as the checksum-verifiable original) are used — never a
 * redraw, the same "crop the Owner's own original" precedent as the
 * How It Works / Why Use icon sheets:
 *
 * - `testimonials-header.png` (2157x208): the heading/subtitle/arrow-
 *   circle strip, which does NOT scroll — the real Thai heading/
 *   subtitle text is baked into it identically to what would be
 *   rendered live, so it's kept as real `sr-only` text for screen
 *   readers rather than visually duplicated, and the drawn arrow
 *   circles get real `<button>` hit-areas positioned exactly over
 *   them (measured bbox, connected-component labeling): left circle
 *   x[1909,1991] y[89,171], right x[2019,2100] y[89,171] of 2157x208.
 *
 * - `testimonial-card-frame.png` (486x383): ONE card's real frame
 *   pixels (quote glyph, gray skeleton bars, avatar-circle
 *   placeholder, 5-star placeholder) cropped from card 1 of the
 *   Master (all 4 cards in the Master are pixel-identical). Reused
 *   for every real review card, including any beyond the 4 the Master
 *   itself draws — the Owner's own instruction: "allow users to move
 *   through additional real reviews when the number of available real
 *   reviews exceeds the number visible in the current Master view."
 *   Real content is layered on top at each region's measured bbox
 *   (as % of the 486x383 frame): comment top 26.6%/left 8.6%, avatar
 *   left 6.2%/top 70.0%/width 18.3%/height 23.0%, name top 73.9%,
 *   location top 83.3%, stars left 66.5%/top 80.7%/width 28.6%. Each
 *   overlay sits on a small opaque white backing (matching the card's
 *   own white bg exactly) so the Master's fixed placeholder bars/
 *   5-star graphic underneath are fully replaced by real content, not
 *   left showing through — never a fabricated name/avatar (no
 *   reviewer identity exists in this system — see reviews.ts's own
 *   header comment) and never a hard-coded 5 stars; the exact stored
 *   `rating` is what renders.
 *
 * "View original review": no dedicated single-review URL existed
 * before this pass. Rather than invent one, the real (already-
 * rendered) review list item on the contractor profile page
 * (app/contractors/[slug]/page.tsx) was given a real `id`
 * (`review-{id}`) so this card can link to
 * `/contractors/{slug}#review-{id}` — a genuine anchor into an
 * already-real, already-displayed review, not a fabricated route.
 *
 * Arrows: unchanged from the prior pass's real `scrollBy`-based
 * behavior — see below.
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
      {/* Header strip: real Master pixels (heading/subtitle/arrow
          circles), with sr-only real text + real functional arrow
          buttons layered on top at their measured positions. */}
      <div className="relative w-full">
        <img
          src="/images/testimonials-header.png"
          alt=""
          aria-hidden="true"
          width={2157}
          height={208}
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
          style={{ left: '88.5%', top: '42.8%', width: '3.8%', height: '39.4%' }}
        />
        <button
          type="button"
          onClick={() => scrollByCard(1)}
          disabled={!canScrollRight}
          aria-label="รีวิวถัดไป"
          className="absolute rounded-full disabled:cursor-not-allowed disabled:opacity-30"
          style={{ left: '93.6%', top: '42.8%', width: '3.76%', height: '39.4%' }}
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
          >
            <img
              src="/images/testimonial-card-frame.png"
              alt=""
              aria-hidden="true"
              width={486}
              height={383}
              className="h-auto w-full"
            />

            {review.comment ? (
              <p
                className="absolute overflow-hidden bg-white text-xs leading-relaxed text-slate-700"
                style={{ left: '8.6%', right: '8%', top: '26.6%', height: '31.6%' }}
              >
                <span className="line-clamp-3">{review.comment}</span>
              </p>
            ) : null}

            <div className="absolute bg-white" style={{ left: '6.2%', top: '70.0%', width: '18.3%', height: '23.0%' }}>
              <AssetPlaceholder label="รูปลูกค้า" shape="circle" className="h-full w-full text-[6px]" />
            </div>

            <p
              className="absolute truncate bg-white text-xs font-semibold leading-tight text-master-text"
              style={{ left: '28.8%', top: '73.9%', width: '40%' }}
            >
              ลูกค้าที่ใช้บริการจริง
            </p>
            <a
              href={`/contractors/${encodeURIComponent(review.contractorSlug)}#review-${review.id}`}
              className="absolute truncate bg-white text-[11px] leading-tight text-slate-500 hover:text-brand-600 hover:underline"
              style={{ left: '28.8%', top: '83.3%', width: '35%' }}
            >
              รีวิวถึง {review.contractorBusinessName}
            </a>

            <div
              aria-hidden="true"
              className="absolute flex items-center justify-end bg-white text-[13px] leading-none text-brand-500"
              style={{ left: '58%', right: '4%', top: '80.7%', height: '6.5%' }}
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
