/**
 * Issue #42 — restyled/renamed in place to "ทำไมต้องใช้ หาช่าง?" (4
 * items, up from 3) per the Master Design Reference. Still describes
 * REAL features this schema actually implements
 * (contractors.status = 'approved' gating public visibility, the
 * direct-contact model with no platform middleman, real reviews) as
 * feature explanations — deliberately not statistics/counts (those now
 * live in StatsBanner.tsx, computed from real data — see that file).
 * Component/export name kept as `TrustSection` since app/page.tsx's
 * import didn't need to change, only this file's own content.
 */
const TRUST_POINTS = [
  {
    icon: '✅',
    title: 'ตรวจสอบแล้ว',
    description: 'ทุกโปรไฟล์ที่แสดงบนเว็บไซต์ผ่านการตรวจสอบและอนุมัติก่อนเผยแพร่',
  },
  {
    icon: '⏱️',
    title: 'ประหยัดเวลา',
    description: 'ค้นหา เปรียบเทียบได้ในที่เดียว ไม่ต้องเสียเวลาถามหาช่างหลายที่',
  },
  {
    icon: '🤝',
    title: 'ติดต่อโดยตรง',
    description: 'ติดต่อผู้รับเหมาที่คุณสนใจได้โดยตรง ไม่มีค่าคอมมิชชั่นแอบแฝง',
  },
  {
    icon: '👍',
    title: 'รีวิวจากผู้ใช้จริง',
    description: 'อ่านรีวิวและคะแนนจากผู้ที่เคยใช้บริการจริง เพื่อประกอบการตัดสินใจ',
  },
];

export function TrustSection() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-slate-900">ทำไมต้องใช้ หาช่าง?</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-[15px] leading-relaxed text-slate-600">
          แพลตฟอร์มที่เชื่อมต่อเจ้าของบ้านกับช่างคุณภาพทั่วประเทศ
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
