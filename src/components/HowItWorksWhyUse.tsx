/**
 * Issue #42, Layer B (supersedes the separate `HowItWorks`/`TrustSection`
 * approach — comment 5570363271): Owner supplied ONE flattened infographic
 * covering both "วิธีใช้งาน" (How It Works) and "ทำไมต้องใช้ หาช่าง?"
 * (Why Use) as a single 1834x858 image, and required it be treated as
 * one asset slot rather than rebuilt from separate icons/text/cards.
 * `public/images/how-it-works-why-use.png` is that attachment copied
 * byte-for-byte (checksum-verified), not re-encoded, cropped, or
 * redrawn — all Thai text, numbering, icons, and the mascot are baked
 * into the artwork and are authoritative as supplied.
 *
 * This component fully replaces `HowItWorks.tsx` and `TrustSection.tsx`
 * (no longer rendered anywhere — see app/page.tsx) so there is no
 * duplicate composition underneath/above the image, per the owner's
 * explicit instruction. Those two files' own locked heights (284px/
 * 302px at `lg:`) no longer apply to this combined slot: the owner's
 * instruction here is to preserve the image's native ~2.137:1 aspect
 * ratio via proportional width-only scaling — no `object-fit` crop, no
 * forced section height — the same "owner-specified full-artwork
 * override" already used for Hero.tsx's background image.
 *
 * No white border/padding/artificial background is added around the
 * image (own instruction) — sampled the artwork's own corner pixels
 * (245,249,252)/(246,249,252), which is this codebase's own
 * `--color-master-page-bg` (#f6f9fc) almost exactly, so the wrapper
 * uses that same token rather than white, avoiding a visible seam
 * against the image itself without editing the asset.
 *
 * Issue #47 round 7 (Owner QA, 2026-09-14, comment 5662243421): this
 * background was on the outer `<section>` (full viewport width),
 * bleeding past the Home Master image's own edges at wide viewports —
 * exactly the "color outside the Master's bounding box" the Owner
 * marked up and asked to be removed everywhere on Home. Moved onto the
 * inner `max-w-[1173px]` div instead, so the color is width-locked to
 * the same content column as the image it exists to blend with; the
 * `<section>` itself is now plain (page-white) outside that column.
 *
 * Neither original section had any interactive elements (unlike
 * Contractor CTA's registration link), so no functional overlay is
 * needed here — this is purely the image plus accessible text
 * alternatives: an `alt` describing the full content, and `sr-only`
 * headings preserving the original document outline / heading
 * hierarchy for screen readers (the baked-in text itself is
 * unreadable to them), not a second visible layer duplicating what's
 * drawn.
 */
export function HowItWorksWhyUse() {
  return (
    <section id="how-it-works" className="scroll-mt-20">
      <div className="mx-auto w-full max-w-[1173px] bg-master-page-bg">
        <h2 className="sr-only">วิธีใช้งาน</h2>
        <p className="sr-only">เพียงไม่กี่ขั้นตอน ก็หาช่างได้เลย</p>
        <ol className="sr-only">
          <li>ค้นหาช่าง: เลือกจังหวัดและประเภทงานที่คุณต้องการ</li>
          <li>ดูข้อมูลและผลงาน: เปรียบเทียบ โปรไฟล์ รีวิว และผลงานจริง</li>
          <li>ติดต่อโดยตรง: โทรหรือแชทเพื่อขอเสนอราคา ไม่ผ่านนายหน้า</li>
          <li>เริ่มงานได้เลย: มั่นใจได้งานคุณภาพจากช่างมืออาชีพ</li>
        </ol>

        <h2 className="sr-only">ทำไมต้องใช้ หาช่าง?</h2>
        <p className="sr-only">แพลตฟอร์มที่เชื่อมต่อเจ้าของบ้านกับช่างคุณภาพทั่วประเทศ</p>
        <ul className="sr-only">
          <li>ตรวจสอบแล้ว: คัดกรองช่างคุณภาพ ลดความเสี่ยง</li>
          <li>ประหยัดเวลา: ค้นหา เปรียบเทียบได้ ภายในที่เดียว</li>
          <li>ติดต่อโดยตรง: ไม่มีค่าคอมมิชชั่น คุยกับช่างได้เลย</li>
          <li>รีวิวจากผู้ใช้งานจริง: ดูผลงานและคะแนนประกอบการตัดสินใจ</li>
        </ul>

        <img
          src="/images/how-it-works-why-use.png"
          alt="วิธีใช้งาน: เพียงไม่กี่ขั้นตอน ก็หาช่างได้เลย — 1. ค้นหาช่าง เลือกจังหวัดและประเภทงานที่คุณต้องการ 2. ดูข้อมูลและผลงาน เปรียบเทียบ โปรไฟล์ รีวิว และผลงานจริง 3. ติดต่อโดยตรง โทรหรือแชทเพื่อขอเสนอราคา ไม่ผ่านนายหน้า 4. เริ่มงานได้เลย มั่นใจได้งานคุณภาพจากช่างมืออาชีพ — ทำไมต้องใช้ หาช่าง? แพลตฟอร์มที่เชื่อมต่อเจ้าของบ้านกับช่างคุณภาพทั่วประเทศ: ตรวจสอบแล้ว คัดกรองช่างคุณภาพลดความเสี่ยง, ประหยัดเวลา ค้นหาเปรียบเทียบได้ภายในที่เดียว, ติดต่อโดยตรง ไม่มีค่าคอมมิชชั่นคุยกับช่างได้เลย, รีวิวจากผู้ใช้งานจริง ดูผลงานและคะแนนประกอบการตัดสินใจ"
          width={1834}
          height={858}
          className="h-auto w-full"
        />
      </div>
    </section>
  );
}
