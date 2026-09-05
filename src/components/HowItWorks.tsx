/**
 * Issue #42 — expanded from 3 to 4 steps to match the Master Design
 * Reference ("เพียงไม่กี่ขั้นตอน ก็หาช่างได้เลย"), adding an explicit
 * final "เริ่มงานได้เลย" step. This describes the same real flow as
 * before (search -> compare -> contact directly, no middleman) plus one
 * more honest, non-fabricated statement: nothing here claims the
 * platform manages the actual job/payment, only that the homeowner can
 * now go ahead and start work with the contractor they picked.
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
    <section id="how-it-works" className="scroll-mt-20 bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-slate-900">วิธีใช้งาน</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-[15px] leading-relaxed text-slate-600">
          เพียงไม่กี่ขั้นตอน ก็หาช่างได้เลย
        </p>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step.number} className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <span
                aria-hidden="true"
                className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-400 text-lg font-bold text-slate-900"
              >
                {step.number}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
