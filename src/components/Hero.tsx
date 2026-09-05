import type { Category } from '../lib/data/categories';
import type { Province } from '../lib/data/provinces';
import { SearchEntry } from './SearchEntry';

/**
 * Issue #42, Layer B (Hero-only asset insertion), revised direction
 * (comment #5553946233 — supersedes the crop-only approach from
 * comment #5553867460): the prior crop made the artwork read as too
 * small/lost its main elements. The owner now wants the supplied Hero
 * Master image (815×325, comment #5553805402) used **in full, at full
 * size, uncropped** as Hero's background artwork — no redrawing, no
 * cropping, aspect ratio preserved exactly (never stretched/distorted)
 * — with the real, fully-functional `SearchEntry` layered on top as a
 * foreground overlay positioned over the image's own decorative
 * (non-functional) search-bar mockup, so there is no visible duplicate
 * search UI. `public/hero/hero-master-full.webp` is the untouched
 * source image (Pillow, `webp` re-encode only — no crop, no redraw).
 *
 * Sizing: `width`/`height` attributes + `h-auto w-full` (no
 * `object-fit`, no cropping) — only width is CSS-constrained, so
 * height always follows the image's own intrinsic 815:325 aspect
 * ratio, so it can never be stretched or squashed. The owner's
 * instruction is explicit that Hero's height may now grow to
 * whatever the full-size artwork needs — this deliberately replaces
 * the earlier fixed `lg:min-h-[430px]` budget (the owner's own
 * direction change, not a bug): at this codebase's 1280px desktop QA
 * viewport the image renders at its ~1173px container width → ~468px
 * tall, and every section below Hero shifts down by that amount,
 * which the owner's comment explicitly accepts ("ถ้าจำเป็นต้องจัด
 * พื้นที่ของ Hero ใหม่เพื่อรองรับ full artwork ให้ยึดภาพ Master เป็น
 * visual source of truth").
 *
 * Because the full image already includes its own baked-in
 * torn-transition + tagline strip, `HeroTransition.tsx` is no longer
 * rendered on the Home page (see app/page.tsx) — the owner was
 * explicit that showing both would duplicate that strip visibly.
 *
 * Search overlay position: measured directly from the source image's
 * own pixels (Pillow — sampling rows/columns for the decorative
 * search-bar container's edges, not eyeballed) — the decorative box
 * spans roughly x 220–765 of 815 (27%–94% width) and starts at y≈205
 * of 325 (63% down). The real `SearchEntry` is positioned via
 * percentage `left`/`top`/`width` of the same relatively-positioned
 * wrapper the image fills, so it scales together with the image at
 * any container width and stays aligned over the same drawn area,
 * fully covering the decorative mockup underneath (no visible
 * duplicate). Height is left automatic (not percentage-locked) so the
 * real form's own content is never clipped, even if it needs slightly
 * more room than the flat artwork's drawn box.
 *
 * The image's own baked-in text is real content, not decoration — an
 * `sr-only` `<h1>` carries the same headline/subtext as this page's
 * actual accessible/SEO heading (screen readers can't read pixels
 * baked into an image), which is an invisible accessibility label, not
 * a second VISIBLE layer duplicating what's drawn in the artwork.
 */
export function Hero({
  categories,
  provinces,
}: {
  categories: Category[];
  provinces: Province[];
}) {
  return (
    <section className="relative overflow-hidden bg-master-yellow">
      <div className="relative mx-auto w-full max-w-[1173px]">
        <h1 className="sr-only">ศูนย์รวมผู้รับเหมาไทย — ค้นหาช่าง ดูผลงานได้ ติดต่อโดยตรง</h1>

        <div className="relative w-full">
          <img
            src="/hero/hero-master-full.webp"
            alt="ศูนย์รวมผู้รับเหมาไทย ค้นหาช่าง ดูผลงานได้ ติดต่อโดยตรง — ช่างดี มีทั่วไทย เชื่อมต่อเจ้าของบ้านกับช่างคุณภาพ — หาช่างดี สร้างบ้านดี สร้างอนาคตที่ดีกว่า"
            width={815}
            height={325}
            className="h-auto w-full"
          />

          {/* Real functional search overlay, positioned over the
              image's own decorative search-bar mockup (measured from
              the source pixels — see header comment). Height is also
              percentage-locked to the decorative box's own measured
              height (16.3%), and `items-stretch` (not `items-center`)
              so SearchEntry's own white background fills that entire
              box edge-to-edge — the real white search box fully covers
              the fake one underneath rather than leaving a sliver of
              it visible at the top/bottom edges. Content can still grow
              taller than this floor (never clipped) if it ever needs
              more room than the flat artwork's drawn box provides. */}
          <div className="absolute left-[27%] top-[63%] flex h-[16.3%] w-[67%] items-stretch">
            <SearchEntry categories={categories} provinces={provinces} />
          </div>
        </div>
      </div>
    </section>
  );
}
