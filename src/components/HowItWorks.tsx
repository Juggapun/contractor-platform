const STEPS = [
  {
    number: '1',
    title: 'ค้นหา',
    description: 'เลือกประเภทงานและจังหวัด เพื่อค้นหาผู้รับเหมาที่ตรงกับความต้องการของคุณ',
  },
  {
    number: '2',
    title: 'เปรียบเทียบ',
    description: 'ดูผลงานที่ผ่านมา รีวิว และคะแนนของผู้รับเหมาแต่ละราย ก่อนตัดสินใจ',
  },
  {
    number: '3',
    title: 'ติดต่อโดยตรง',
    description: 'ติดต่อผู้รับเหมาที่คุณสนใจได้โดยตรง ไม่มีคนกลาง',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-slate-900">ใช้งานง่ายใน 3 ขั้นตอน</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.number} className="rounded-xl border border-slate-200 bg-white p-6 text-center">
              <span
                aria-hidden="true"
                className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-400 text-lg font-bold text-slate-900"
              >
                {step.number}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
