'use client';
import { useEffect, useRef, useState } from 'react';
import type { FeaturedReview } from '../lib/data/reviews';
import { HomeSectionHeading } from './HomeSectionHeading';

export function TestimonialsCarousel({ reviews }: { reviews: FeaturedReview[] }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = () => {
      setCanLeft(el.scrollLeft > 4);
      setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener('scroll', update, { passive: true });
    return () => { observer.disconnect(); el.removeEventListener('scroll', update); };
  }, [reviews]);
  const scroll = (direction: number) => {
    const el = trackRef.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({left: direction * ((el.querySelector('li')?.clientWidth ?? el.clientWidth) + 16), behavior: reduced ? 'instant' : 'smooth'});
  };
  return <>
    <HomeSectionHeading id="reviews-title" title="เสียงจากผู้ใช้งานจริง" description="ความประทับใจจากเจ้าของบ้าน และผู้ว่าจ้างทั่วประเทศ"
      action={reviews.length > 0 && <div className="home-carousel-actions">
        <button type="button" aria-label="รีวิวก่อนหน้า" aria-controls="home-reviews" disabled={!canLeft} onClick={() => scroll(-1)}>‹</button>
        <button type="button" aria-label="รีวิวถัดไป" aria-controls="home-reviews" disabled={!canRight} onClick={() => scroll(1)}>›</button>
      </div>} />
    {reviews.length === 0 ? <p className="home-empty">ยังไม่มีรีวิวเพียงพอที่จะแสดงในขณะนี้</p> :
      <ul id="home-reviews" className="home-reviews" ref={trackRef} aria-label="รีวิวผู้ใช้บริการ" tabIndex={0}>{reviews.map(review =>
        <li className="home-review-card" key={review.id}>
          <span className="home-review-quote" aria-hidden="true">“</span>
          <p className="home-review-comment">{review.comment || 'ผู้ใช้บริการให้คะแนนโดยไม่ได้เขียนความคิดเห็น'}</p>
          <div className="home-review-person"><img src="/images/reviewer-avatar.png" width="40" height="40" alt="" loading="lazy" />
            <div><p>ลูกค้าที่ใช้บริการจริง</p><a href={`/contractors/${encodeURIComponent(review.contractorSlug)}#review-${review.id}`}>รีวิวถึง {review.contractorBusinessName}</a></div>
          </div>
          <div className="home-review-stars" aria-label={`${review.rating} จาก 5 ดาว`}>
            {[1,2,3,4,5].map(n => <span key={n} aria-hidden="true" className={n <= review.rating ? 'is-filled' : ''}>★</span>)}
          </div>
        </li>)}</ul>}
  </>;
}
