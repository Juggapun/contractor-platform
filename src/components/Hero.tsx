import type { Category } from '../lib/data/categories';
import type { Province } from '../lib/data/provinces';
import { SearchEntry } from './SearchEntry';

/**
 * Issue #47, Final QA item 4 (Owner approval, comment 5634333481): the
 * Owner supplied a new, final combined Home-top Master image (issue
 * comment 5634320406) and asked for Hero specifically to match it "as
 * closely as technically possible," explicitly permitting the same
 * image-as-visual-layer + real functional overlay technique already
 * established here since Issue #42 (see git history for that original
 * reasoning) rather than hand-built CSS. `public/hero/hero-master-
 * final.webp` replaces the old `hero-master-full.webp`: cropped from
 * the new Master at its own pixel bounds (y 107–645 of 1024 at the
 * Master's native 1536×1024 — measured via a pixel-color scan of the
 * white-header/yellow-hero and yellow-hero/white-category boundaries,
 * not eyeballed) so it contains exactly the yellow Hero band — mascot,
 * headline, tagline speech-bubble, decorative search-bar mockup, and
 * the "หาช่างดี..." strip below it — with the white Header row and the
 * category-icon row both excluded (Header stays its own real,
 * independently-sticky component — see Header.tsx — and can't be part
 * of the same static image as Hero without losing that sticky
 * behavior; category cards are real content in CategoryGrid.tsx). The
 * crop is a plain re-encode of the Owner's own attachment at that
 * pixel range — no redraw, no regenerated artwork.
 *
 * Sizing: `h-auto w-full` (no `object-fit`, no cropping at render time)
 * — only width is CSS-constrained, so height always follows the
 * image's own intrinsic 1536:538 aspect ratio.
 *
 * Because the image already includes its own baked-in torn-transition
 * + tagline strip, `HeroTransition.tsx` is still not rendered here
 * (unchanged from the original Issue #42 reasoning).
 *
 * Search overlay position: re-measured directly from the NEW Master's
 * own pixels (a zoomed grid-overlay crop around the decorative
 * search-bar mockup, not eyeballed against the full image) — that box
 * spans x 225–1290 of 1536 (14.65%–83.98% width) and y 490–575 of the
 * Master's original coordinate space, i.e. y 383–468 relative to this
 * crop's own 107–645 range (71.19%–86.99% of the crop's height). The
 * real `SearchEntry` is positioned via percentage `left`/`top`/`width`/
 * `height` of the same relatively-positioned wrapper the image fills,
 * so it scales together with the image at any container width and
 * stays aligned over the same drawn area, fully covering the
 * decorative mockup underneath (no visible duplicate).
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
            src="/hero/hero-master-final.webp"
            alt="ศูนย์รวมผู้รับเหมาไทย ค้นหาช่าง ดูผลงานได้ ติดต่อโดยตรง — ช่างดี มีทั่วไทย เชื่อมต่อเจ้าของบ้านกับช่างคุณภาพ — หาช่างดี สร้างบ้านดี สร้างอนาคตที่ดีกว่า"
            width={1536}
            height={538}
            className="h-auto w-full"
          />

          {/* Real functional search overlay, positioned over the
              image's own decorative search-bar mockup (measured from
              the source pixels — see header comment). `items-stretch`
              (not `items-center`) so SearchEntry's own white background
              fills that entire box edge-to-edge — the real white
              search box fully covers the fake one underneath rather
              than leaving a sliver of it visible at the top/bottom
              edges. Content can still grow taller than this floor
              (never clipped) if it ever needs more room than the flat
              artwork's drawn box provides. */}
          <div className="absolute left-[14.65%] top-[71.19%] flex h-[15.80%] w-[69.34%] items-stretch">
            <SearchEntry categories={categories} provinces={provinces} />
          </div>
        </div>
      </div>
    </section>
  );
}
