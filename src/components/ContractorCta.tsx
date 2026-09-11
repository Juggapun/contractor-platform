/**
 * Issue #42, Layer B: Owner attached the final Contractor CTA banner
 * (issue comment 5570012209) with an explicit asset lock (comment
 * 5570039672) — `public/images/contractor-cta-banner.png` is that
 * attachment copied byte-for-byte (verified via checksum), not
 * re-encoded, cropped, or redrawn. The heading, supporting copy, and
 * the 4 locked benefit items (comment-mandated wording from this
 * issue's own body) are now baked into the artwork itself, so the
 * previous separate `<h2>`/`<p>`/`<ul>` markup is replaced by this one
 * image; the same strings are kept as `sr-only` text (screen readers
 * can't read pixels) rather than duplicated visibly, per the owner's
 * "do not duplicate the button text outside the image unless
 * technically necessary for accessibility" instruction.
 *
 * Geometry: the owner's rule is contradictory on its face — "do not
 * crop the artwork" vs. "the image must not expand or redefine
 * section height" — for a 2158x729 (~2.96:1) asset inside a locked
 * ~275px-tall section. Resolved via this issue's own Section 6 asset
 * contract, which explicitly allows "controlled crop/contain/cover
 * behavior" at the CSS/display layer while the source file itself
 * stays untouched (same principle as every other asset in this
 * issue's byte-for-byte-preservation discipline — "crop" there means
 * "don't edit the file," not "don't ever clip the rendered box").
 * Implemented as a `w-full h-auto` image inside a wrapper that is
 * vertically centered and clipped by the section's fixed `lg:h-[275px]`
 * (`overflow-hidden`) — equivalent to `object-cover` but done via plain
 * layout so the CTA hit-area below can share the exact same coordinate
 * space. Verified by cropping the source at the resulting visible
 * window (~18%-82% of image height): the full heading, subtext,
 * button, and all 4 checklist rows remain inside it — only sky/
 * scaffolding (top) and ground (bottom) get clipped. Below `lg:` the
 * wrapper is static (no fixed height), so the full uncropped image
 * shows at its natural aspect ratio, matching every other section's
 * "fixed height only at `lg:`" convention in this codebase.
 *
 * CTA hit-area: the visible "เข้าร่วมกับเรา" button's pixel bounding
 * box was measured directly from the source PNG (numpy color-mask on
 * its distinct yellow, not eyeballed): x 688–1196 of 2158, y 443–554 of
 * 729, i.e. left 31.9%/top 60.8%/width 23.5%/height 15.2% of the
 * image's own box. Positioned as absolute percentages of the same
 * wrapper the image fills — identical technique to Hero.tsx's
 * SearchEntry overlay — so it tracks the button correctly whether the
 * wrapper is clipped (`lg:`) or shown in full (below `lg:`). Clicking
 * it is a real `<a href="/contractors/register">` (existing
 * registration route, normal browser navigation, no JS interaction
 * layer) rendered as an invisible overlay so the supplied artwork's
 * own drawn button is never visually duplicated.
 *
 * Issue #47 (Owner Final QA — comment 5633868806/5634333481): this
 * section's `lg:` wrapper was the one place in this codebase missing
 * the shared `mx-auto w-full max-w-[1173px]` content-width token every
 * other Home section uses (Header/Hero/CategoryGrid/StatsBanner/
 * FeaturedContractors/HowItWorksWhyUse/TestimonialsSection/
 * ArticlesSection/Footer all already had it) — it previously used
 * `lg:inset-x-0` (stretch to the full, unconstrained `<section>` width)
 * with no `max-w` at all, which is exactly the "banner narrower/wider
 * than the main page column at extreme zoom" bug the Owner reported:
 * at most zoom levels the section itself renders full-bleed (its own
 * `<section>` has no max-width, matching every other section's
 * full-bleed *background*), so the CTA content silently tracked that
 * full-bleed width instead of the shared content column every other
 * section's *content* aligns to. Fixed by adding the same `max-w-
 * [1173px]` token and switching the `lg:` centering from `inset-x-0` to
 * `left-1/2 -translate-x-1/2` (inset-x-0 would have forced the div back
 * to full-bleed width regardless of max-w, since explicit left+right
 * values compute the box width directly). The `<section>` itself keeps
 * its full-bleed `bg-master-navy` — only the image/hotspot content
 * column is now width-locked to the shared container, per the Owner's
 * own explicit "full-bleed background is fine; content must align" rule.
 */
export function ContractorCta() {
  return (
    <section className="relative overflow-hidden bg-master-navy lg:h-[275px]">
      <div className="relative mx-auto w-full max-w-[1173px] lg:absolute lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2">
        <img
          src="/images/contractor-cta-banner.png"
          alt="เป็นช่างหรือผู้รับเหมาใช่ไหม? สมัครฟรี เพิ่มโปรไฟล์ โชว์ผลงาน ให้ลูกค้าทั่วไทยเห็นคุณ"
          width={2158}
          height={729}
          className="h-auto w-full"
        />

        <h2 className="sr-only">เป็นช่างหรือผู้รับเหมาใช่ไหม?</h2>
        <p className="sr-only">สมัครฟรี เพิ่มโปรไฟล์ โชว์ผลงาน ให้ลูกค้าทั่วไทยเห็นคุณ</p>
        <ul className="sr-only">
          <li>เพิ่มโปรไฟล์ฟรี</li>
          <li>ลงผลงานฟรี</li>
          <li>เข้าถึงลูกค้าทั่วไทย</li>
          <li>สร้างความน่าเชื่อถือ</li>
        </ul>

        <a
          href="/contractors/register"
          aria-label="สมัครเป็นผู้รับเหมา เข้าร่วมกับเรา"
          className="absolute"
          style={{ left: '31.9%', top: '60.8%', width: '23.5%', height: '15.2%' }}
        />
      </div>
    </section>
  );
}
