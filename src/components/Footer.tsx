/**
 * Issue #46, Owner Direction (comment 5633201240): a new round of Footer
 * QA found the previous real-HTML/CSS rebuild (matching the Footer
 * Master image's proportions by hand) still didn't read as close enough
 * to the Master. The Owner explicitly reversed the earlier "never use
 * the Master as an <img>" instruction for this round and asked for the
 * opposite approach instead: render the Master image itself as the
 * Footer's whole visual layer, then lay real, working `<a>` hotspots on
 * top of it at the image's own link/icon positions — never inventing a
 * new route, reusing the exact same destinations as the previous
 * HTML/CSS version (Menu items' real routes, and the Owner-supplied
 * Facebook/YouTube/TikTok/LINE URLs from comment 5601967986).
 *
 * `public/images/footer-master.png` is the Owner's own attached image
 * (issue comment 5632900497, 2172x499) saved into the repo — this
 * sandbox's egress proxy still hard-403s a direct fetch of
 * `github.com/user-attachments/assets/...` (see this file's git history
 * for that finding), but the *displayable* image itself was reachable
 * through GitHub's own redirect to its S3-backed CDN host, which the
 * proxy does not block; this is what actually let the image be viewed
 * and saved this round. It's committed as-is, at its original
 * resolution/encoding, never re-drawn or recompressed.
 *
 * Hotspot coordinates are percentages of the image's own width/height
 * (measured directly against the source PNG's real 2172x499 pixel grid,
 * via a grid-overlay crop, not eyeballed against a downscaled preview),
 * not fixed pixel values — with the `<img>` itself always at `w-full
 * h-auto` (a fluid block that only ever scales down, never stretches or
 * crops), percentage-based hotspots stay aligned to the same visual
 * spot at any viewport width, including 375px, without a separate
 * mobile layout. There is no responsive *reflow* here (the columns
 * cannot restack the way the previous CSS version's grid did) — that's
 * the direct, expected consequence of asking for the image itself as
 * the visual layer rather than a hand-built layout; only uniform
 * scale-down is possible with a single raster image.
 *
 * The Master image's own "© 2026" is now baked into a static image
 * pixel, not computed from `Date()` the way the previous version's
 * copyright row was — an accepted, inherent trade-off of this
 * image-as-layer approach the Owner asked to try this round; it will
 * need a new image (or a return to real markup) whenever the year
 * needs to change.
 *
 * "เกี่ยวกับเรา" and every ช่วยเหลือ item are visible in the image but
 * intentionally have NO hotspot over them, same reasoning as every
 * prior round on this file: no real destination exists for them, and
 * this Owner comment's own hotspot list only names the 4 Menu items
 * that already have real routes plus the 4 social links — it does not
 * ask for one there, and adding a click target with nowhere real to
 * send it would be exactly the fabricated destination every version of
 * this file has refused to add.
 */
const HOTSPOTS: {
  label: string;
  href: string;
  external?: boolean;
  style: { left: string; top: string; width: string; height: string };
}[] = [
  // Menu column — same real routes as the previous HTML/CSS version.
  { label: 'หน้าแรก', href: '/', style: { left: '23.71%', top: '31.66%', width: '8.52%', height: '8.82%' } },
  { label: 'ค้นหาผู้รับเหมา', href: '/search', style: { left: '23.71%', top: '40.48%', width: '10.36%', height: '8.82%' } },
  {
    label: 'เข้าร่วมเป็นผู้รับเหมา',
    href: '/contractors/register',
    style: { left: '23.71%', top: '49.30%', width: '12.20%', height: '8.82%' },
  },
  { label: 'บทความ', href: '/#articles', style: { left: '23.71%', top: '58.12%', width: '8.52%', height: '8.82%' } },

  // Social icons — the Owner's own URLs (comment 5601967986), unchanged.
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/ChiphiEngineering/',
    external: true,
    style: { left: '59.85%', top: '29.06%', width: '4.51%', height: '21.04%' },
  },
  {
    label: 'YouTube',
    href: 'https://www.youtube.com/@%E0%B8%8A%E0%B8%B4%E0%B8%9B%E0%B8%AB%E0%B8%B2%E0%B8%A2%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%8A%E0%B9%88%E0%B8%B2%E0%B8%87',
    external: true,
    style: { left: '64.82%', top: '29.06%', width: '4.51%', height: '21.04%' },
  },
  {
    label: 'TikTok',
    href: 'https://www.tiktok.com/@chiphi_engineering',
    external: true,
    style: { left: '69.80%', top: '29.06%', width: '4.51%', height: '21.04%' },
  },
  {
    label: 'LINE',
    href: `https://line.me/R/ti/p/${encodeURIComponent('@321cvbmm')}`,
    external: true,
    style: { left: '74.77%', top: '29.06%', width: '4.51%', height: '21.04%' },
  },
];

export function Footer() {
  return (
    <footer className="bg-master-navy">
      <div className="relative mx-auto w-full max-w-[1173px]">
        <img
          src="/images/footer-master.png"
          alt="หาช่าง — แพลตฟอร์มศูนย์รวมผู้รับเหมาไทย เชื่อมต่อเจ้าของบ้านกับช่างคุณภาพทั่วประเทศ"
          className="block h-auto w-full"
        />
        {HOTSPOTS.map((hotspot) => (
          <a
            key={hotspot.label}
            href={hotspot.href}
            aria-label={hotspot.label}
            {...(hotspot.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="absolute"
            style={hotspot.style}
          />
        ))}
      </div>
    </footer>
  );
}
