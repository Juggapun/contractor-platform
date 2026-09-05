import { AssetPlaceholder } from './AssetPlaceholder';

/**
 * Issue #42, Layer A (skeleton/geometry only) — rebuilt against the
 * actual Hero crop the Project Owner supplied (a close-up screenshot,
 * not the full page): a YELLOW background with a dark-navy skyline
 * silhouette and a large illustrated mascot on the left (waving
 * contractor in a yellow hard hat), navy headline text, a speech
 * bubble on the right, and the search bar anchored near the bottom of
 * this same yellow block — not the dark-navy Hero this codebase had
 * before this pass.
 *
 * The mascot and the background skyline are genuine illustrated assets
 * in the reference (hand-drawn character, textured background) — this
 * pass explicitly must not substitute emoji or an invented CSS/SVG
 * illustration for them (the issue's own "do not use emoji/generic
 * icons as substitutes for illustrated assets" rule). Both get a
 * reserved, correctly-proportioned `AssetPlaceholder` slot instead,
 * ready for the Project Owner's real asset in a later pass (Layer B).
 *
 * Headline/subtext copy is locked verbatim by the issue.
 */
export function Hero() {
  return (
    // The solid yellow background itself stands in as the placeholder
    // for the reference's yellow-plus-skyline-texture treatment — a
    // second, full-bleed AssetPlaceholder box drawn on top of it would
    // just obscure the real content underneath for no benefit; the
    // bounded mascot slot below is the one that actually needs its own
    // reserved geometry.
    <section className="relative overflow-hidden bg-brand-400">
      <div className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
          {/* Reserved mascot-illustration slot */}
          <AssetPlaceholder
            label="ภาพประกอบช่างมาสคอต"
            className="h-40 w-40 flex-shrink-0 sm:h-56 sm:w-44"
          />

          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              <span className="block">ศูนย์รวม</span>
              <span className="block">ผู้รับเหมาไทย</span>
            </h1>
            <p className="mt-3 text-base font-medium text-slate-800 sm:text-lg">
              ค้นหาช่าง • ดูผลงานได้ • ติดต่อโดยตรง
            </p>
          </div>

          {/* Speech bubble — a simple CSS shape, not an illustrated
              asset, so it's built directly rather than placeholder'd. */}
          <div className="relative mx-auto max-w-[220px] flex-shrink-0 rounded-2xl bg-white px-5 py-4 text-center shadow-md sm:mx-0">
            <p className="text-sm font-semibold leading-snug text-slate-900">
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
      </div>
    </section>
  );
}
