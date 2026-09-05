/**
 * Issue #42 — Layer A (skeleton/geometry only). Every illustrated/photo
 * asset shown in the Master Design Reference (hero mascot, skyline
 * background, category icons, step icons, testimonial avatars, CTA
 * background, etc.) is a real illustrated or photographic asset, not an
 * emoji or an invented substitute — the issue explicitly forbids using
 * emoji/generic icons in place of those assets. This is the one shared,
 * clearly-temporary placeholder for every such reserved slot: a plain
 * neutral shape with no glyph at all, so nothing here is mistaken for a
 * finished visual decision. Layer B (a later pass) replaces each
 * placeholder with the real supplied asset in-place, without touching
 * this component or the surrounding layout.
 *
 * `tone` picks a legible variant for the section background it sits on
 * (`light` on a white/yellow section, `dark` on a navy one) — a fixed
 * choice rather than letting callers fight the base classes with their
 * own color-utility className overrides, which Tailwind's generated CSS
 * doesn't reliably let win by source order alone.
 */
export function AssetPlaceholder({
  label,
  shape = 'rect',
  tone = 'light',
  className = '',
}: {
  /** Short text naming the reserved slot (e.g. "ภาพประกอบช่าง") — shown
   * small and muted so it reads as a label, not content. */
  label: string;
  shape?: 'rect' | 'circle';
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const toneClasses =
    tone === 'dark'
      ? 'border-white/30 bg-white/10 text-white/70'
      : 'border-slate-300 bg-slate-100 text-slate-400';

  return (
    <div
      role="img"
      aria-label={`${label} (ยังไม่มีภาพ — พื้นที่สำรองสำหรับใส่ภาพจริงภายหลัง)`}
      className={`flex items-center justify-center border-2 border-dashed text-center ${toneClasses} ${
        shape === 'circle' ? 'rounded-full' : 'rounded-lg'
      } ${className}`}
    >
      <span className="px-2 text-xs font-medium">{label}</span>
    </div>
  );
}
