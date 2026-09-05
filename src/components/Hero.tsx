import type { Category } from '../lib/data/categories';
import type { Province } from '../lib/data/provinces';
import { AssetPlaceholder } from './AssetPlaceholder';
import { SearchEntry } from './SearchEntry';

/**
 * Issue #42, Layer A final calibration — the Master's "FINAL GEOMETRY +
 * COLOR CALIBRATION" comment locks Hero to an exact height ratio
 * (274/815 of the 815×1930 reference canvas) AND folds the search bar
 * INSIDE that same fixed height budget ("search must remain visually
 * inside Hero; it must NOT increase Hero height") — so SearchEntry is
 * now rendered here as a nested child, not a sibling `<section>` with
 * its own separate height budget (see SearchEntry.tsx's own comment).
 *
 * The 815-reference numbers are a proportion/coordinate system, not a
 * literal browser width (the comment is explicit about this) — rather
 * than hard-coding to 815px or trying to keep every dimension fluid
 * forever at every possible monitor width (which the comment doesn't
 * actually ask for either), these are scaled once by this codebase's
 * established desktop QA viewport (1280px, the same one every Layer-A
 * screenshot/E2E check in this issue has used) via a single factor
 * `k = 1280 / 815 ≈ 1.5706`, applied at the `lg:` breakpoint. Below
 * `lg:`, height is left to natural content flow (mobile/tablet are
 * explicitly not this pass's target, only required not to overflow).
 *
 * Reference-canvas Hero internal geometry (scaled by k, applied at
 * `lg:`): mascot slot ~175–190 reference px wide → ~287px; headline
 * block ~300 reference px wide → ~471px; speech-bubble slot ~180
 * reference px wide → ~283px; search slot ~380 reference px wide →
 * ~597px, centered, in the lower part of Hero.
 *
 * The mascot and background skyline are genuine illustrated assets in
 * the Master (hand-drawn character, textured background) — per the
 * issue's own "do not use emoji/generic icons as substitutes for
 * illustrated assets" rule, both stay reserved `AssetPlaceholder`
 * slots, not an invented CSS/SVG illustration or emoji, ready for the
 * Project Owner's real asset in a later pass (Layer B). The solid
 * `master-yellow` background itself is the explicitly-locked base
 * color while final Hero artwork is absent (see globals.css's
 * `--color-master-yellow` token, from the Master's own hex value) — a
 * second, full-bleed AssetPlaceholder box drawn on top of it would
 * only obscure the real content underneath for no benefit.
 *
 * Headline/subtext copy is locked verbatim by the issue.
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
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8 lg:w-full lg:justify-center lg:gap-6">
            {/* Reserved mascot-illustration slot (~287px wide at lg:) */}
            <AssetPlaceholder
              label="ภาพประกอบช่างมาสคอต"
              className="h-40 w-40 flex-shrink-0 sm:h-56 sm:w-44 lg:h-[220px] lg:w-[287px]"
            />

            <div className="flex-1 text-center sm:text-left lg:max-w-[471px] lg:flex-none">
              <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-master-text sm:text-5xl lg:text-4xl">
                <span className="block">ศูนย์รวม</span>
                <span className="block">ผู้รับเหมาไทย</span>
              </h1>
              <p className="mt-3 text-base font-medium text-master-text/80 sm:text-lg">
                ค้นหาช่าง • ดูผลงานได้ • ติดต่อโดยตรง
              </p>
            </div>

            {/* Speech bubble — a simple CSS shape, not an illustrated
                asset, so it's built directly rather than placeholder'd.
                (~283px wide at lg:) */}
            <div className="relative mx-auto max-w-[220px] flex-shrink-0 rounded-2xl bg-white px-5 py-4 text-center shadow-md sm:mx-0 lg:max-w-[283px]">
              <p className="text-sm font-semibold leading-snug text-master-text">
                ช่างดี มีทั่วไทย
                <br />
                เชื่อมต่อเจ้าของบ้านกับช่างคุณภาพ
              </p>
              <span
                aria-hidden="true"
                className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-white sm:-left-2 sm:bottom-6 sm:left-auto sm:right-full sm:translate-x-0"
              />
            </div>
          </div>

          <SearchEntry categories={categories} provinces={provinces} />
        </div>
      </div>
    </section>
  );
}
