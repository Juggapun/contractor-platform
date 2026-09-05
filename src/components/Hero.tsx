/**
 * Issue #42 — restyled to match the Master Design Reference's dark
 * hero treatment (previously a light `brand-50`-to-white gradient).
 * The big two-line headline below is literally this app's own existing
 * brand name ("ศูนย์รวมผู้รับเหมาไทย") split across two lines to match
 * the reference's layout — not a new name, the same one already used
 * throughout `docs/`, `app/layout.tsx`'s metadata, and this page's own
 * JSON-LD, so no separate identity/SEO decision is being made here (see
 * Header.tsx's header comment for what DID change: just that
 * component's own logo lockup).
 *
 * No illustrated mascot artwork/photography exists in this repository
 * to reproduce the reference's hand-drawn character or construction
 * skyline — both are approximated with emoji, the same honest
 * placeholder approach already used throughout this codebase's other
 * icons, rather than fabricating a stand-in image asset.
 */
export function Hero() {
  return (
    <section className="bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20">
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <span
            aria-hidden="true"
            className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-brand-400 text-3xl"
          >
            👷
          </span>
          <p className="max-w-xs rounded-2xl bg-white/10 px-4 py-2 text-sm leading-relaxed text-white sm:text-left">
            ช่างดี มีทั่วไทย
            <br />
            เชื่อมต่อเจ้าของบ้านกับช่างคุณภาพ
          </p>
        </div>

        <h1 className="mt-6 text-3xl font-extrabold tracking-tight sm:text-5xl">
          <span className="block text-white">ศูนย์รวม</span>
          <span className="block text-brand-400">ผู้รับเหมาไทย</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">
          ค้นหาช่าง • ดูผลงานได้ • ติดต่อโดยตรง
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#search"
            className="w-full rounded-md bg-brand-400 px-6 py-3 text-base font-semibold text-slate-900 shadow-sm hover:bg-brand-500 sm:w-auto"
          >
            ค้นหาผู้รับเหมาเลย
          </a>
          <a
            href="#how-it-works"
            className="w-full rounded-md border border-slate-500 px-6 py-3 text-base font-semibold text-white hover:bg-white/10 sm:w-auto"
          >
            ดูวิธีใช้งาน
          </a>
        </div>

        <p className="mx-auto mt-8 inline-block max-w-md -rotate-1 rounded-md bg-brand-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm">
          หาช่างดี สร้างบ้านดี สร้างอนาคตที่ดีกว่า
        </p>
      </div>
    </section>
  );
}
