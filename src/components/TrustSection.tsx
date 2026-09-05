import { AssetPlaceholder } from './AssetPlaceholder';

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
 *
 * Layer A: benefit icons and the reference's right-hand mascot
 * illustration are reserved `AssetPlaceholder` slots (a prior pass used
 * emoji for the icons — reverted), matching the reference's own
 * text/cards-plus-illustration balance rather than becoming a plain
 * generic feature grid.
 *
 * Issue #42, Layer A final calibration — height locked to ~302px at
 * `lg:` (192/815 of the Master's reference canvas, scaled by this
 * codebase's 1280px desktop QA viewport — see Hero.tsx's comment).
 * Container width unified to the shared ~1173px content-width token.
 */
const TRUST_POINTS = [
  {
    iconLabel: 'ไอคอนตรวจสอบแล้ว',
    title: 'ตรวจสอบแล้ว',
    description: 'ทุกโปรไฟล์ที่แสดงบนเว็บไซต์ผ่านการตรวจสอบและอนุมัติก่อนเผยแพร่',
  },
  {
    iconLabel: 'ไอคอนประหยัดเวลา',
    title: 'ประหยัดเวลา',
    description: 'ค้นหา เปรียบเทียบได้ในที่เดียว ไม่ต้องเสียเวลาถามหาช่างหลายที่',
  },
  {
    iconLabel: 'ไอคอนติดต่อโดยตรง',
    title: 'ติดต่อโดยตรง',
    description: 'ติดต่อผู้รับเหมาที่คุณสนใจได้โดยตรง ไม่มีค่าคอมมิชชั่นแอบแฝง',
  },
  {
    iconLabel: 'ไอคอนรีวิวจากผู้ใช้จริง',
    title: 'รีวิวจากผู้ใช้จริง',
    description: 'อ่านรีวิวและคะแนนจากผู้ที่เคยใช้บริการจริง เพื่อประกอบการตัดสินใจ',
  },
];

export function TrustSection() {
  return (
    <section className="bg-white lg:flex lg:min-h-[302px] lg:items-center">
      <div className="mx-auto w-full max-w-[1173px] px-4 py-4 sm:px-[53px] lg:py-3">
        <h2 className="text-center text-2xl font-bold text-master-text lg:text-lg">ทำไมต้องใช้ หาช่าง?</h2>
        <p className="mx-auto mt-1 max-w-xl text-center text-[15px] leading-relaxed text-slate-600 lg:text-xs">
          แพลตฟอร์มที่เชื่อมต่อเจ้าของบ้านกับช่างคุณภาพทั่วประเทศ
        </p>

        <div className="mt-3 flex flex-col items-center gap-6 lg:flex-row lg:items-stretch lg:gap-4">
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            {TRUST_POINTS.map((point) => (
              <div key={point.title} className="text-center sm:text-left">
                <AssetPlaceholder label={point.iconLabel} shape="circle" className="mx-auto h-9 w-9 text-[8px] sm:mx-0" />
                <h3 className="mt-1 text-base font-semibold text-master-text">{point.title}</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{point.description}</p>
              </div>
            ))}
          </div>

          {/* Reserved slot for the reference's right-hand mascot
              illustration (thumbs-up pose with speech bubbles). */}
          <AssetPlaceholder
            label="ภาพประกอบช่างมาสคอต"
            className="h-32 w-full flex-shrink-0 lg:h-auto lg:w-56"
          />
        </div>
      </div>
    </section>
  );
}
