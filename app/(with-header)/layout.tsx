import { Header } from '../../src/components/Header';

/**
 * Issue #47 round 6 (Owner QA, 2026-09-14, comment 5661969921): the Home
 * page's own `Hero.tsx` already bakes its own header strip into the
 * Master image (see that file's header comment), so the real, separate
 * `Header` component must never render there at all. A round-2 fix did
 * this with a client-side `if (usePathname() === '/') return null;`
 * inside `Header.tsx` — every test this session could run (raw SSR HTML
 * via curl, a full Playwright screenshot, a client-side navigation back
 * to `/`) confirmed that check alone already keeps Home header-free, but
 * the Owner still saw a plain, unstyled Header bar stacked above the
 * Master image on a real device. Per the Owner's own explicit
 * instruction ("ห้ามใช้วิธีซ่อนด้วย CSS แบบชั่วคราวถ้าสามารถแก้ที่
 * render structure ได้ — ต้องแก้ที่ต้นเหตุ"), this round moves the
 * decision out of a runtime/client hook entirely: `Header` now renders
 * from THIS route-group layout only, which every real page except Home
 * lives under (search, login, signup, contractors/*, admin/*,
 * auth/callback). Home's own `app/page.tsx` sits outside this group, so
 * it is structurally impossible for `Header` to render there — resolved
 * once at the routing/build level, not by any per-request check that
 * could be affected by hydration timing, caching, or any other runtime
 * variable. The root `app/layout.tsx` no longer renders `Header` at all;
 * `<main>` moved here too so Home (outside this group) still needs its
 * own `<main id="main-content">` wrapper directly in `app/page.tsx`.
 */
export default function WithHeaderLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="main-content" className="flex-1">
        {children}
      </main>
    </>
  );
}
