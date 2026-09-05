import type { Category } from '../lib/data/categories';
import type { Province } from '../lib/data/provinces';
import { SearchEntry } from './SearchEntry';

/**
 * Issue #42, Layer B (Hero-only asset insertion) — the Project Owner
 * supplied a real Hero Master crop (815×325 PNG, comment #5553805402)
 * with the mascot/headline/subtext/speech-bubble artwork ALREADY baked
 * into one flat image, plus a decorative (non-functional) search-bar
 * mockup and the white torn-transition + tagline strip baked into the
 * same image. Per the owner's explicit decision (comment #5553867460):
 * - keep the REAL functional `SearchEntry` (not the image's decorative
 *   mockup) in its Layer-A slot below this image;
 * - keep `HeroTransition.tsx` as the sole owner of the torn-edge +
 *   tagline (not the image's own baked copy of it);
 * - so `public/hero/hero-master-crop.webp` is a CROP ONLY of the
 *   supplied artwork (top 0–210px of the original 815×325, done with
 *   Pillow — no redrawing/regeneration) that keeps the yellow
 *   background + navy skyline/crane silhouette, the waving mascot,
 *   "หาช่างดี สร้างชัวร์ !!", the "ศูนย์รวม/ผู้รับเหมาไทย" headline, the
 *   "ค้นหาช่าง • ดูผลงานได้ • ติดต่อโดยตรง" subtext, and the speech
 *   bubble, while excluding the decorative search-bar mockup and the
 *   bottom transition/tagline strip entirely.
 *
 * The image's own baked-in text is real content, not decoration — an
 * `sr-only` `<h1>` carries the same headline/subtext as this page's
 * actual accessible/SEO heading (screen readers can't read pixels
 * baked into an image), which is an invisible accessibility label, not
 * a second VISIBLE layer duplicating what's drawn in the artwork.
 *
 * Sized via `width`/`height` attributes + `h-auto w-full` (no
 * `object-fit` needed — only width is CSS-constrained, so height
 * follows the image's own intrinsic aspect ratio automatically,
 * meaning it's never stretched/distorted and never cropped again after
 * the one-time Pillow crop above). At this codebase's 1280px desktop
 * QA viewport, the image renders at its container's ~1173px content
 * width → ~302px tall, comfortably inside Hero's Layer-A-locked 430px
 * total height budget alongside the search bar below — Hero's own
 * `lg:min-h-[430px]` is unchanged from Layer A, so this asset cannot
 * resize Hero or shift any downstream section's position, matching the
 * owner's explicit "asset must never resize the section" requirement.
 */
export function Hero({
  categories,
  provinces,
}: {
  categories: Category[];
  provinces: Province[];
}) {
  return (
    <section className="relative overflow-hidden bg-master-yellow lg:flex lg:min-h-[430px] lg:items-center">
      <div className="relative mx-auto w-full max-w-[1173px] px-4 py-8 sm:px-[53px] lg:py-6">
        <div className="flex flex-col items-center gap-6 lg:gap-4">
          <h1 className="sr-only">ศูนย์รวมผู้รับเหมาไทย — ค้นหาช่าง ดูผลงานได้ ติดต่อโดยตรง</h1>
          <img
            src="/hero/hero-master-crop.webp"
            alt="ศูนย์รวมผู้รับเหมาไทย ค้นหาช่าง ดูผลงานได้ ติดต่อโดยตรง — ช่างดี มีทั่วไทย เชื่อมต่อเจ้าของบ้านกับช่างคุณภาพ"
            width={815}
            height={210}
            className="h-auto w-full"
          />

          <SearchEntry categories={categories} provinces={provinces} />
        </div>
      </div>
    </section>
  );
}
