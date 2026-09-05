/**
 * Issue #42 — expanded from 3 to 4 steps to match the Master Design
 * Reference ("เพียงไม่กี่ขั้นตอน ก็หาช่างได้เลย"), adding an explicit
 * final "เริ่มงานได้เลย" step. This describes the same real flow as
 * before (search -> compare -> contact directly, no middleman) plus one
 * more honest, non-fabricated statement: nothing here claims the
 * platform manages the actual job/payment, only that the homeowner can
 * now go ahead and start work with the contractor they picked.
 *
 * Issue #42, Layer A final calibration — height locked to ~284px at
 * `lg:` (181/815 of the Master's reference canvas, scaled by this
 * codebase's 1280px desktop QA viewport — see Hero.tsx's comment).
 * Container width unified to the shared ~1173px content-width token
 * (was `max-w-5xl`/1024px before this pass — every Home section now
 * shares one container width, per the Master's own "one main content
 * width reference" rule).
 */
const STEPS = [
  {
    number: '1',
    title: 'ค้นหาช่าง',
    description: 'เลือกจังหวัดและประเภทงาน เพื่อค้นหาผู้รับเหมาที่ตรงกับความต้องการของคุณ',
  },
  {
    number: '2',
    title: 'ดูข้อมูลและผลงาน',
    description: 'ดูผลงานที่ผ่านมา รีวิว และคะแนนของผู้รับเหมาแต่ละราย ก่อนตัดสินใจ',
  },
  {
    number: '3',
    title: 'ติดต่อโดยตรง',
    description: 'ติดต่อผู้รับเหมาที่คุณสนใจได้โดยตรง ไม่มีคนกลาง ไม่ผ่านนายหน้า',
  },
  {
    number: '4',
    title: 'เริ่มงานได้เลย',
    description: 'นัดหมายและเริ่มงานกับผู้รับเหมาที่คุณมั่นใจได้ทันที',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-master-page-bg lg:flex lg:min-h-[284px] lg:items-center">
      <div className="mx-auto w-full max-w-[1173px] px-4 py-6 sm:px-[53px] lg:py-3">
        <h2 className="text-center text-2xl font-bold text-master-text lg:text-lg">วิธีใช้งาน</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-[15px] leading-relaxed text-slate-600 lg:text-xs">
          เพียงไม่กี่ขั้นตอน ก็หาช่างได้เลย
        </p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-[10px]">
          {STEPS.map((step) => (
            <li key={step.number} className="rounded-xl border border-master-border bg-white p-3 text-center">
              <span
                aria-hidden="true"
                className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-master-yellow-accent text-lg font-bold text-master-text"
              >
                {step.number}
              </span>
              <h3 className="mt-2 text-base font-semibold text-master-text">{step.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
