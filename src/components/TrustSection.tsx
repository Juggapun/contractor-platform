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
 * Issue #42, Layer A final calibration — height locked to ~302px at
 * `lg:` (192/815 of the Master's reference canvas, scaled by this
 * codebase's 1280px desktop QA viewport — see Hero.tsx's comment).
 * Container width unified to the shared ~1173px content-width token.
 *
 * Issue #42, Layer B round 1: Owner supplied a 5-icon reference sheet
 * (issue comment) — shield-check, coins, handshake, thumbs-up,
 * hard-hat-"44". Only 4 trust points exist in the locked 2x2 grid, and
 * adding a 5th would require redesigning the grid, so this was
 * reported as a blocker rather than guessed at; Owner's decision: drop
 * the hard-hat icon, use the first 4 in order. Each
 * `public/icons/why-use/*.webp` file is a direct crop of the Owner's
 * sheet (alpha-channel bounding-box detection, not by eye), lossless,
 * no redraw/recolor — same technique as the How It Works icons.
 *
 * Issue #42, Layer B round 2: the right-hand mascot illustration —
 * `public/images/why-use-mascot.png` is the Owner's supplied artwork
 * copied byte-for-byte (verified via checksum), not re-encoded,
 * cropped, or redrawn — the same contractor character/hard-hat-"44"
 * used in Hero.tsx. Displayed with `object-contain` so none of the
 * artwork is cropped; the slot's width was widened from the Layer-A
 * placeholder's `lg:w-56` to `lg:w-72` to better match this image's
 * own ~1.78:1 aspect ratio (the artwork's own proportions, not
 * something invented) without touching the section's locked height —
 * only this one column's width changed, required solely to place the
 * asset without it rendering tiny/empty-padded.
 */
const TRUST_POINTS = [
  {
    icon: '/icons/why-use/why-use-01-verified.webp',
    iconAlt: 'ไอคอนตรวจสอบแล้ว',
    title: 'ตรวจสอบแล้ว',
    description: 'ทุกโปรไฟล์ที่แสดงบนเว็บไซต์ผ่านการตรวจสอบและอนุมัติก่อนเผยแพร่',
  },
  {
    icon: '/icons/why-use/why-use-02-value.webp',
    iconAlt: 'ไอคอนประหยัดเวลา',
    title: 'ประหยัดเวลา',
    description: 'ค้นหา เปรียบเทียบได้ในที่เดียว ไม่ต้องเสียเวลาถามหาช่างหลายที่',
  },
  {
    icon: '/icons/why-use/why-use-03-direct.webp',
    iconAlt: 'ไอคอนติดต่อโดยตรง',
    title: 'ติดต่อโดยตรง',
    description: 'ติดต่อผู้รับเหมาที่คุณสนใจได้โดยตรง ไม่มีค่าคอมมิชชั่นแอบแฝง',
  },
  {
    icon: '/icons/why-use/why-use-04-reviews.webp',
    iconAlt: 'ไอคอนรีวิวจากผู้ใช้จริง',
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
                <img src={point.icon} alt={point.iconAlt} className="mx-auto h-10 w-auto sm:mx-0" />
                <h3 className="mt-1 text-base font-semibold text-master-text">{point.title}</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{point.description}</p>
              </div>
            ))}
          </div>

          {/* Owner-supplied mascot illustration (thumbs-up pose),
              full artwork, not cropped. See header comment. */}
          <img
            src="/images/why-use-mascot.png"
            alt="ช่างยิ้มให้กำลังใจ สวมหมวกนิรภัยสีเหลืองเลข 44 ชูนิ้วโป้ง"
            className="h-32 w-full flex-shrink-0 object-contain lg:h-auto lg:w-72"
          />
        </div>
      </div>
    </section>
  );
}
