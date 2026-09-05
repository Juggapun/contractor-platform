'use client';

import { useEffect, useRef, useState } from 'react';
import type { PortfolioImage } from '../lib/data/portfolio';
import { PortfolioAddTile } from './PortfolioAddTile';

/**
 * Issue #38 — click a portfolio thumbnail on the public profile page to
 * open its full/detail image in a lightbox, with prev/next navigation.
 *
 * No new data fetching: `getPortfolioImages()` (src/lib/data/portfolio.ts)
 * already selects `image_url` (the full/detail variant) alongside
 * `thumbnail_url` — it was fetched but never rendered before this. The
 * grid below still renders only `thumbnail_url`, exactly as before; an
 * `<img src={image_url}>` for the currently-open image is the only place
 * a full/detail image is ever requested, and only once the lightbox for
 * that specific image is actually open — never for images that were
 * never clicked, and never for the whole gallery up front.
 *
 * The one deliberate preload: while image N is open, a single hidden
 * `<img>` for image N+1 (never further ahead) primes the browser cache
 * so "next" feels instant — this is the "preload only the next image
 * when appropriate" the issue itself suggests, not a blanket preload of
 * every image.
 *
 * Deliberately does NOT implement touch swipe gestures — the prev/next/
 * close buttons are large tap targets that already work correctly via
 * touch, and a real drag-gesture implementation (thresholds, velocity,
 * cancel-on-scroll) is more complexity than this issue's stated scope
 * ("UX improvement, not a Profile redesign") calls for. Recorded as a
 * considered-and-declined choice, not a silent gap.
 */
export function PortfolioGallery({
  images,
  businessName,
  contractorId,
}: {
  images: PortfolioImage[];
  businessName: string;
  contractorId: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const triggerRefs = useRef<Array<HTMLButtonElement | null>>([]);

  return (
    <>
      {images.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
          ยังไม่มีผลงานให้แสดงในขณะนี้
        </p>
      ) : null}
      {/*
        Issue #37: this <ul> always renders, even when `images` is empty
        (alongside, not instead of, the empty-state message above) — the
        owner-only "+" tile needs a grid to sit in even before their
        first upload. For any non-owner viewer with zero portfolio
        images, PortfolioAddTile resolves to null, so the grid is simply
        empty (zero rendered pixels) — no visual regression.
      */}
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((img, index) => (
          <li key={img.id} className="overflow-hidden rounded-lg border border-slate-200">
            <button
              type="button"
              ref={(el) => {
                triggerRefs.current[index] = el;
              }}
              onClick={() => setOpenIndex(index)}
              className="block w-full text-left"
            >
              <img
                src={img.thumbnail_url}
                alt={img.project_name || `ผลงานของ ${businessName}`}
                className="h-32 w-full object-cover"
                // Phase 13 (Issue #11): same "already CSS-sized, this is
                // a defensive ratio hint" reasoning as the hero image —
                // `h-32 w-full` already fixes this box. width/height
                // (300x200) match this project's actual thumbnail
                // aspect ratio (3:2). loading="lazy" is the real,
                // measurable change: a portfolio grid is exactly the
                // below-the-fold, possibly-many-images case it exists
                // for.
                width={300}
                height={200}
                loading="lazy"
                decoding="async"
              />
            </button>
            {img.project_name ? (
              <p className="p-2 text-xs font-medium text-slate-700">{img.project_name}</p>
            ) : null}
          </li>
        ))}
        <PortfolioAddTile contractorId={contractorId} currentCount={images.length} />
      </ul>

      {openIndex !== null ? (
        <Lightbox
          images={images}
          index={openIndex}
          businessName={businessName}
          onClose={() => {
            const trigger = triggerRefs.current[openIndex];
            setOpenIndex(null);
            trigger?.focus();
          }}
          onNavigate={setOpenIndex}
        />
      ) : null}
    </>
  );
}

function Lightbox({
  images,
  index,
  businessName,
  onClose,
  onNavigate,
}: {
  images: PortfolioImage[];
  index: number;
  businessName: string;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const current = images[index];
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;

  useEffect(() => {
    closeButtonRef.current?.focus();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && index < images.length - 1) onNavigate(index + 1);
      else if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [index, images.length, onClose, onNavigate]);

  const nextImage = hasNext ? images[index + 1] : null;

  // Defensive only — `index` always comes from a valid array position
  // (PortfolioGallery only ever sets it from a map() index or a
  // prev/next step already bounds-checked above); this just satisfies
  // TypeScript's noUncheckedIndexedAccess without a non-null assertion.
  // Placed after every hook call above so this never violates the
  // rules of hooks.
  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={current.project_name || `ผลงานของ ${businessName}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        ref={closeButtonRef}
        onClick={onClose}
        aria-label="ปิด"
        className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-white hover:bg-white/20 sm:right-4 sm:top-4"
      >
        ×
      </button>

      {hasPrev ? (
        <button
          type="button"
          onClick={() => onNavigate(index - 1)}
          aria-label="ภาพก่อนหน้า"
          className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-white hover:bg-white/20 sm:left-4"
        >
          ‹
        </button>
      ) : null}
      {hasNext ? (
        <button
          type="button"
          onClick={() => onNavigate(index + 1)}
          aria-label="ภาพถัดไป"
          className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-white hover:bg-white/20 sm:right-4"
        >
          ›
        </button>
      ) : null}

      <figure className="flex max-h-full max-w-full flex-col items-center">
        {/* The full/detail image — requested only now, for only this
            one image, exactly on open. */}
        <img
          key={current.id}
          src={current.image_url}
          alt={current.project_name || `ผลงานของ ${businessName}`}
          className="max-h-[80vh] max-w-full rounded-lg object-contain"
        />
        {current.project_name ? (
          <figcaption className="mt-2 max-w-full text-center text-sm text-white">{current.project_name}</figcaption>
        ) : null}
        <p className="mt-1 text-xs text-white/60">
          {index + 1} / {images.length}
        </p>
      </figure>

      {/* Preload only the immediate next image — never further ahead,
          never the whole gallery. Invisible; exists purely so the
          browser has it cached before "next" is clicked. */}
      {nextImage ? <img src={nextImage.image_url} alt="" aria-hidden="true" className="hidden" /> : null}
    </div>
  );
}
