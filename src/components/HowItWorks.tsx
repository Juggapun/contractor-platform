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
 *
 * Issue #42, Layer B round 1: no step-icon asset had been supplied yet
 * at that point, so this pass was a documented no-op (kept the plain
 * yellow numbered badge rather than force an empty `AssetPlaceholder`
 * that looked worse — see git history for that reasoning).
 *
 * Issue #42, Layer B round 2 (superseded, see round 3): tried
 * hand-authored SVG recreations of the Owner's reference sheet instead
 * of cropping it directly. Owner rejected this — the requirement was
 * always to use the Owner's own supplied artwork verbatim, not a
 * from-scratch reinterpretation, however faithful.
 *
 * Issue #42, Layer B round 3 (current): the four
 * `public/icons/how-it-works/*.webp` files are now direct crops of the
 * Owner's own reference sheet (issue attachment), one bounding box per
 * icon, located programmatically (non-white-pixel detection) rather
 * than by eye, then saved lossless — no redraw, no recolor, no shadow/
 * line changes, nothing hand-authored. Each crop keeps that icon's own
 * shadow intact and excludes every neighboring icon. Order left-to-
 * right matches the Owner's locked 01→04 order. Displayed at a fixed
 * height (`h-12`, auto width) so each icon's own aspect ratio — they
 * aren't identical, e.g. the chat-bubble icon is visibly wider — never
 * determines the section's locked height; only CSS does.
 */
const STEPS = [
  {
    icon: '/icons/how-it-works/how-it-works-01-search.webp',
    iconAlt: 'ไอคอนค้นหาช่าง',
    width: 438,
    height: 444,
    title: 'ค้นหาช่าง',
    description: 'เลือกจังหวัดและประเภทงาน เพื่อค้นหาผู้รับเหมาที่ตรงกับความต้องการของคุณ',
  },
  {
    icon: '/icons/how-it-works/how-it-works-02-info.webp',
    iconAlt: 'ไอคอนดูข้อมูลและผลงาน',
    width: 430,
    height: 454,
    title: 'ดูข้อมูลและผลงาน',
    description: 'ดูผลงานที่ผ่านมา รีวิว และคะแนนของผู้รับเหมาแต่ละราย ก่อนตัดสินใจ',
  },
  {
    icon: '/icons/how-it-works/how-it-works-03-contact.webp',
    iconAlt: 'ไอคอนติดต่อโดยตรง',
    width: 485,
    height: 419,
    title: 'ติดต่อโดยตรง',
    description: 'ติดต่อผู้รับเหมาที่คุณสนใจได้โดยตรง ไม่มีคนกลาง ไม่ผ่านนายหน้า',
  },
  {
    icon: '/icons/how-it-works/how-it-works-04-start.webp',
    iconAlt: 'ไอคอนเริ่มงานได้เลย',
    width: 424,
    height: 439,
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
            <li key={step.title} className="rounded-xl border border-master-border bg-white p-3 text-center">
              <img
                src={step.icon}
                alt={step.iconAlt}
                className="mx-auto h-12 w-auto"
                width={step.width}
                height={step.height}
              />
              <h3 className="mt-1 text-base font-semibold text-master-text">{step.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
