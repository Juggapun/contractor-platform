/**
 * Issue #42, Layer A — the Master Design Reference's dedicated "white
 * torn-paper transition + centered tagline" strip between Hero (yellow,
 * ends at SearchEntry's search bar) and CategoryGrid (plain white). Kept
 * as its own component/slot specifically so the irregular edge can be
 * swapped later (Layer B) without touching Hero or CategoryGrid — see
 * the issue's own "reserve a dedicated transition layer/slot" spec.
 *
 * The jagged edge is a plain CSS `clip-path` zigzag, not an invented
 * illustration — a layout/geometry technique, not a substitute for a
 * supplied graphic asset.
 */
const ZIGZAG_CLIP_PATH =
  'polygon(0% 100%, 0% 30%, 4% 60%, 8% 20%, 12% 55%, 16% 15%, 20% 50%, 24% 10%, 28% 45%, 32% 5%, 36% 40%, 40% 10%, 44% 50%, 48% 15%, 52% 55%, 56% 20%, 60% 60%, 64% 25%, 68% 55%, 72% 10%, 76% 45%, 80% 5%, 84% 40%, 88% 15%, 92% 50%, 96% 20%, 100% 55%, 100% 100%)';

export function HeroTransition() {
  return (
    <div className="relative bg-white pb-4 pt-6 sm:pb-6 sm:pt-8">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-6 bg-brand-400 sm:h-8"
        style={{ clipPath: ZIGZAG_CLIP_PATH }}
      />
      <p className="relative mx-auto max-w-xl -rotate-1 rounded-md bg-brand-400 px-4 py-2 text-center text-sm font-semibold text-slate-900 shadow-sm sm:text-base">
        หาช่างดี สร้างบ้านดี สร้างอนาคตที่ดีกว่า
      </p>
    </div>
  );
}
