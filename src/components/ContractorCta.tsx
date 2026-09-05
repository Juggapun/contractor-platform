/**
 * Issue #42 — the four contractor-facing benefit messages are LOCKED
 * (verbatim, product-decided copy — not to be replaced with
 * customer-oriented benefits or paraphrased). The Master Design
 * Reference's own equivalent banner uses slightly different wording
 * for one item ("ลงผลงานได้ไม่จำกัด" vs. this issue's locked
 * "ลงผลงานฟรี") — per the issue's own rule ("if any screenshot text
 * conflicts with this Issue, this Issue's wording wins"), the locked
 * text below is authoritative. Restyled to the reference's dark
 * checklist-banner treatment (was a light yellow-gradient grid before).
 *
 * Layer A: the reference's background is a real contractor photograph
 * under a dark overlay — the plain `bg-master-navy` here IS the
 * reserved placeholder state for that (the Master's own locked navy
 * base token, see globals.css — a solid color is already about as
 * "simple" and "temporary" as a placeholder gets); a separate dashed
 * box drawn on top would only obscure the real heading/CTA/checklist
 * content for no benefit, same reasoning as Hero.tsx's background.
 *
 * Issue #42, Layer A final calibration — height locked to ~275px at
 * `lg:` (175/815 of the Master's reference canvas, scaled by this
 * codebase's 1280px desktop QA viewport — see Hero.tsx's comment),
 * reserving the section-height budget the Master's artwork/background
 * asset will occupy once supplied (Layer B), without drawing a new box
 * now. Container width unified to the shared ~1173px content-width
 * token (was `max-w-4xl`/896px before this pass).
 */
const CONTRACTOR_BENEFITS = ['เพิ่มโปรไฟล์ฟรี', 'ลงผลงานฟรี', 'เข้าถึงลูกค้าทั่วไทย', 'สร้างความน่าเชื่อถือ'];

export function ContractorCta() {
  return (
    <section className="bg-master-navy lg:flex lg:min-h-[275px] lg:items-center">
      <div className="mx-auto w-full max-w-[1173px] px-4 py-12 sm:px-[53px] lg:py-6">
        <div className="flex flex-col items-center gap-8 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <div>
            <h2 className="text-2xl font-bold text-white">เป็นช่างหรือผู้รับเหมาใช่ไหม?</h2>
            <p className="mx-auto mt-3 max-w-xl leading-relaxed text-slate-300 sm:mx-0">
              สมัครฟรี เพิ่มโปรไฟล์ โชว์ผลงาน ให้ลูกค้าทั่วไทยเห็นคุณ
            </p>
            <a
              href="/contractors/register"
              className="mt-6 inline-block rounded-md bg-master-yellow-accent px-6 py-3 text-base font-semibold text-master-text shadow-sm hover:brightness-95"
            >
              สมัครเป็นผู้รับเหมา →
            </a>
          </div>

          <ul className="grid flex-shrink-0 grid-cols-1 gap-3 text-left sm:grid-cols-1">
            {CONTRACTOR_BENEFITS.map((label) => (
              <li key={label} className="flex items-center gap-2 text-sm font-medium text-white">
                <span aria-hidden="true" className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-master-yellow-accent text-xs text-master-text">
                  ✓
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
