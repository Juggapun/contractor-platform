'use client';

import { useEffect, useRef, useState } from 'react';
import type { FeaturedReview } from '../lib/data/reviews';

/**
 * Issue #42, Layer B round 4 (Testimonials — comment 5572081474,
 * "REQUEST CHANGES Round 4"): three concrete fixes on top of round 3's
 * canonical-Master calibration.
 *
 * 1. Reviewer avatar: the Owner supplied a dedicated generic reviewer
 *    avatar illustration (issue comment) specifically for this slot —
 *    `public/images/reviewer-avatar.png`, copied byte-for-byte
 *    (checksum-verified), not redrawn/recolored/substituted. It is
 *    already a self-contained circular illustration on a transparent
 *    background (verified via alpha channel — fully transparent at
 *    all four corners), so it renders directly with no additional
 *    circular clipping needed. This replaces the previous
 *    `AssetPlaceholder` fallback now that a real, Owner-supplied,
 *    non-identifying system avatar exists for this exact purpose.
 *
 * 2. Star icons: round 3 used the browser's own `★` glyph, which
 *    varies in shape/weight across fonts and operating systems — not
 *    a reliable way to hit "star size must match the Master
 *    precisely." Per the Owner's own instruction ("if normal CSS/font
 *    rendering cannot reproduce the Master accurately, do not
 *    approximate — create/use a dedicated visual asset"), stars are
 *    now a fixed inline SVG path (identical geometry in every
 *    browser), sized via the same measured `cqw` value as before so
 *    it still scales exactly with the card image, filled solid for
 *    `rating` stars and outline-only for the remainder — never
 *    hard-coded to 5.
 *
 * 3. Always-4-slots: the card list now always renders at least 4
 *    `<li>` slots (`Math.max(4, reviews.length)`), filling the first
 *    `reviews.length` with real review data and leaving any remaining
 *    slots as the bare card frame with no overlay content at all — a
 *    genuinely neutral/empty slot, never fabricated review text/name/
 *    rating to fill the gap. The carousel still scrolls to reveal a
 *    5th+ slot once real review volume exceeds 4.
 *
 * Everything else (header/card asset crops, `cqw`-based fluid sizing,
 * opaque white backing to fully replace the Master's own fictional
 * example content, the real `#review-{id}` deep link, honest identity
 * label since no reviewer name is public data) is unchanged from round
 * 3 — see git history for that round's own measurement notes.
 *
 * Round 5 (comment 5580946939, "แก้ตำแหน่งดาว"): the star row's `left`
 * position was stale from an earlier card asset's proportions and had
 * never been re-measured against the round-3/4 164x119 card — it
 * overlapped ~21 percentage points into the name/location text box's
 * own width, exactly the collision the Owner reported from Production.
 * Re-measured directly from the card frame PNG (ink-mask column
 * analysis, not eyeballed): the name/location text column occupies
 * x[45,104] of 164 (27.4%–63.4%) and the star row occupies x[111,154]
 * of 164 (67.7%–93.9%) — a real ~4.3-point gap between them in the
 * Master itself. Both boxes now use exactly those percentages, so
 * there is no overlap at any width (the whole layout is `cqw`/%-based,
 * so this holds at every breakpoint, not just the one checked
 * on-screen). Star *size* is untouched — still the same `cqw(11)`
 * used since round 4 — this was purely a position fix, per the
 * Owner's explicit "do not shrink/enlarge stars to fix the overlap."
 *
 * Round 6 (direct chat feedback with an annotated Production screenshot,
 * no issue comment id yet — three concrete bugs on live data with 4 real
 * reviews, not round 5's single-review case):
 *
 * 1. Dark marks near the avatar: re-ran the ink-mask scan (this time
 *    across the *whole* name/star row-band, not just each box's own
 *    declared bounds) and found the Master's own baked-in fictional
 *    text ink actually starts at x=43 of 164 (26.2%), but round 5's
 *    name/location box started at 27.4% — a real ~1.2pt gap where nothing
 *    covered it, letting the Master's own ink bleed through. The old
 *    round-5 star box (67.7%–93.9%) exactly covered the Master's own
 *    baked star ink in that same row, so removing it for fix #2 below
 *    would have *reopened* that exposure. Fixed by merging the
 *    name/location box and the star-covering box into one continuous
 *    white cover (`left: 25%` — flush with the avatar box's own right
 *    edge, `right: 4%`) spanning the entire row, so there is no seam
 *    anywhere in it for Master ink to show through.
 *
 * 2. Star row shared a visual line with the name/location text (comment
 *    5580946939's fix only removed the *horizontal* overlap, not the
 *    shared row) — the Owner asked for it on a fully separate line.
 *    The card frame image is only 119px tall and the comment+avatar+name
 *    block already reaches its bottom edge, so there was no room for a
 *    third overlaid line inside the image itself. Restructured: the
 *    image + its absolutely-positioned overlays (comment/avatar/name)
 *    now live in their own `position: relative` inner wrapper (unchanged
 *    math — all existing % measurements are still relative to the image,
 *    not the taller card), and the star row is a new sibling *below*
 *    that wrapper, in normal flow — a real appended footer strip, not
 *    another overlay squeezed into the Master's own bounds.
 *
 * 3. Card 4 in a real 4-review row showed only 1 star while cards 1–3
 *    looked fine — not a data bug. The old star box was only 26.2%
 *    wide, but 5 star icons at `cqw(11)` plus their `gap: 4%` need
 *    ~37.7% of the card's width — a real overflow. Since the box had no
 *    `overflow-hidden`, the extra ~11.5 points of stars didn't clip,
 *    they rendered past the box's right edge and *visually bled into the
 *    next card's space* — invisible for cards 1–3 (nothing there to
 *    contrast against but white), but truncated by the carousel track's
 *    own edge for card 4, the last one, with no next card to bleed into.
 *    The new below-the-image star row uses the same left/right margins
 *    as the comment box (6%/4%, ~90% of card width) — over twice the
 *    ~37.7% actually needed, so this can't recur at any card width.
 */
const CARD_NATIVE_W = 164;

function cqw(px: number) {
  return `${((px / CARD_NATIVE_W) * 100).toFixed(2)}cqw`;
}

const STAR_PATH = 'M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.58L12 17.6l-5.9 3.1 1.13-6.58L2.45 9.44l6.6-.96L12 2.5z';

function StarRow({ rating, size }: { rating: number; size: string }) {
  return (
    <div aria-hidden="true" className="flex items-center" style={{ gap: '4%' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          viewBox="0 0 24 24"
          style={{ width: size, height: size, flexShrink: 0 }}
          className={n <= rating ? 'fill-brand-500' : 'fill-slate-200'}
        >
          <path d={STAR_PATH} />
        </svg>
      ))}
    </div>
  );
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

  const slotCount = Math.max(4, reviews.length);
  const slots: Array<FeaturedReview | null> = Array.from({ length: slotCount }, (_, i) => reviews[i] ?? null);

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
        {slots.map((review, i) => (
          <li
            key={review?.id ?? `empty-${i}`}
            className="relative w-[85%] flex-shrink-0 snap-start sm:w-[45%] lg:w-[calc(25%-9px)]"
            style={{ containerType: 'inline-size' }}
          >
            {/*
              `relative` here is load-bearing even though nothing inside
              this <li> is positioned relative to it directly anymore
              (the image + its overlays moved into their own inner
              `relative` wrapper below). Removing it while the `<ul>`
              track is `overflow-x-auto` let this row's real overflow
              (each `<li>` is 85%/45%/25% width, several sit side by
              side) leak past `document.documentElement.scrollWidth`
              instead of staying clipped inside the track's own
              scrollbar — a real 375px page-level horizontal-scroll bug,
              caught by live measurement while building round 6, not a
              theoretical one. Keeping `relative` on the flex item itself
              restores correct scroll containment at every width.
            */}
            <div className="relative">
              <img
                src="/images/testimonial-card-frame-v3.png"
                alt=""
                aria-hidden="true"
                width={164}
                height={119}
                className="h-auto w-full"
              />

              {/*
                These white-backing regions render for EVERY slot,
                including "empty" ones (review === null) — they exist to
                fully replace the Master card frame's own baked-in
                fictional example content (name/avatar/location/comment),
                not just to host real data when present. An empty slot
                must look neutral/blank, never expose that fictional
                content underneath (a real bug in an earlier pass of this
                round, caught via live screenshot before this was
                reported ready).
              */}
              <div className="absolute overflow-hidden bg-white" style={{ left: '7%', right: '4%', top: '19%', height: '45%' }}>
                {review?.comment ? (
                  <p className="leading-tight text-slate-700" style={{ fontSize: cqw(10) }}>
                    <span className="line-clamp-3">{review.comment}</span>
                  </p>
                ) : null}
              </div>

              <div className="absolute bg-white" style={{ left: '6%', top: '68%', width: '19%', height: '28%' }}>
                {review ? (
                  <img
                    src="/images/reviewer-avatar.png"
                    alt=""
                    aria-hidden="true"
                    width={1254}
                    height={1254}
                    className="h-full w-full object-contain"
                  />
                ) : null}
              </div>

              {/*
                Round 6: widened to `left: 25%` (flush with the avatar
                box's own right edge, no gap) and `right: 4%` (covers all
                the way to the same margin the comment box uses). This
                single box now covers BOTH ink regions the Master bakes
                into this row-band — the fictional name/location text
                (x 26.2%-62.8% of 164) AND the fictional star row
                (x 67.7%-93.9%) that round 5's separate, narrower star box
                used to cover on its own. Since round 6 moves the real
                star row out of this row entirely (see below), that
                coverage has to live here now, or the Master's own baked
                stars would show through on every card.
              */}
              <div className="absolute bg-white" style={{ left: '25%', right: '4%', top: '63%', height: '34%' }}>
                {review ? (
                  <>
                    <p className="truncate font-semibold leading-tight text-master-text" style={{ fontSize: cqw(9) }}>
                      ลูกค้าที่ใช้บริการจริง
                    </p>
                    <a
                      href={`/contractors/${encodeURIComponent(review.contractorSlug)}#review-${review.id}`}
                      className="mt-1 block truncate leading-tight text-slate-500 hover:text-brand-600 hover:underline"
                      style={{ fontSize: cqw(8) }}
                    >
                      รีวิวถึง {review.contractorBusinessName}
                    </a>
                  </>
                ) : null}
              </div>
            </div>

            {/*
              Round 6: the star row is now a real appended footer strip
              below the card frame image, not another overlay squeezed
              inside the Master's own 119px-tall bounds — see this file's
              header comment for why. Height is always reserved (not
              conditional on `review`) so every slot in the row — real or
              empty — stays the same total card height. Horizontal margins
              match the comment box (6%/4%) precisely so 5 stars at
              `cqw(11)` plus their gaps (~37.7% of card width) have almost
              2.5x the room they need — the fix for the overflow that
              made card 4 in a real 4-review row appear to show only 1 star.
            */}
            <div className="mt-1.5 flex items-center" style={{ paddingLeft: '6%', paddingRight: '4%', height: cqw(11) }}>
              {review ? <StarRow rating={review.rating} size={cqw(11)} /> : null}
            </div>
            {review ? <span className="sr-only">{review.rating} จาก 5 ดาว</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
