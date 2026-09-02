/**
 * Introduces the trust concepts the Phase 2 schema actually implements
 * (contractors.status = 'approved' gating public visibility, reviews,
 * ratings, portfolio_images) as feature explanations — deliberately NOT
 * as statistics/counts, since no real numbers exist yet to report.
 */
const TRUST_POINTS = [
  {
    icon: '✅',
    title: 'ผู้รับเหมาผ่านการตรวจสอบ',
    description: 'ทุกโปรไฟล์ที่แสดงบนเว็บไซต์ผ่านการตรวจสอบและอนุมัติก่อนเผยแพร่',
  },
  {
    icon: '🖼️',
    title: 'ผลงานจริง',
    description: 'ดูภาพผลงานที่ผ่านมาของผู้รับเหมาแต่ละราย ก่อนตัดสินใจติดต่อ',
  },
  {
    icon: '⭐',
    title: 'รีวิวและคะแนนจากผู้ใช้จริง',
    description: 'อ่านรีวิวและคะแนนจากผู้ที่เคยใช้บริการ เพื่อประกอบการตัดสินใจ',
  },
];

export function TrustSection() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-slate-900">มั่นใจได้ในทุกการติดต่อ</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {TRUST_POINTS.map((point) => (
            <div key={point.title} className="text-center">
              <span aria-hidden="true" className="text-3xl">
                {point.icon}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-slate-900">{point.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{point.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
