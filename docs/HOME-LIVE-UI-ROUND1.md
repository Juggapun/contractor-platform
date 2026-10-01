# Home live UI — round 1 (#48)

> Historical checkpoint. Superseded by [the final whole-page report](HOME-LIVE-UI-FINAL.md). Screenshots below are the earlier prototype, not the final UI.

Owner direction: 1 October 2026. Draft for review; no production release.

## Implemented

- Centrally configurable, self-hosted Thai fonts in `app/typography.css`: Kanit 500–800 for headings/navigation/buttons; Noto Sans Thai Variable for body/form text; Sriracha for the stat-banner accent. Fontsource packages include their license files and are pinned by the lockfile.
- Real homepage navigation, mobile menu and existing AuthStatus. Other routes retain their existing Header. One header and main landmark per page.
- Existing decorative hero typography is PRESERVED per the owner's follow-up. The master image is not modified. SVG viewports display only the decorative region/logo; navigation and category controls are separate DOM elements. Accessible text equivalents remain available.
- Search retains native GET parameters `province`, `category`, `q`. Desktop controls cover the original search illustration; mobile excludes that illustration and places 46px-or-larger controls in a two-column form below the artwork.
- Seven independent category cards reuse current `public/icons/categories/*.webp` files and existing mappings. No new icon artwork or taxonomy.
- Stats use existing public/RLS-scoped data readers instead of the illustration's example numbers.

## Owner follow-up and Thai copy check

Keep decorative lettering, including the three circled areas. The proposed generated text-free background was discarded and is NOT referenced or included in this change.

The full-resolution repository artwork reads:
- หาช่างดี สร้างชีวิต!!
- ศูนย์รวมผู้รับเหมาไทย
- ค้นหาช่าง • ดูผลงานได้ • ติดต่อโดยตรง
- ช่างดีมีทั่วไทย เชื่อมต่อเจ้าของบ้านกับช่างคุณภาพ
- หาช่างดี สร้างบ้านดี สร้างอนาคตที่ดีกว่า

No definite spelling error was identified in those strings in the current full-resolution file. The older attached Master uses ค้นหาง่าย instead of ค้นหาช่าง; that is a wording difference, not a spelling error. No artwork spelling change was made speculatively.

## Validation actually run

- TypeScript: pass.
- ESLint: pass.
- Existing unit suite: 275/275 pass across 21 files.
- Production build: pass, including a build using a local read-only HTTP fixture for public category/province data.
- Chromium/Playwright against the production build: 1440, 834, 768, 767, 375 and 320px. All six: no horizontal document overflow, exactly one header/main, seven category cards, correct province/category/Thai-keyword GET navigation. Mobile menu open/close checked below the desktop breakpoint.
- `/login`, `/signup`, `/contractors/register`, `/search`: render at 320px without overflow or duplicate header/main.
- No JavaScript page errors in that browser pass.

Screenshots use two LOCAL fixture provinces and seven categories, with no contractor/review/article records. Zero counts and empty lower sections are test data, not a statement about production. No real accounts or database were accessed. Full authentication, admin approval and DB security regression suites were NOT rerun against a real Supabase instance.

## Visual evidence

[Desktop](qa/home-live-ui-round1/desktop.png) · [Tablet](qa/home-live-ui-round1/tablet.png) · [Mobile](qa/home-live-ui-round1/mobile.png)

## Remaining review / next round

- Owner visual acceptance of fonts, spacing and current separate category illustrations (they are preserved byte-for-byte; some differ from the illustrations baked into the current composite master).
- Lower sections, contractor CTA and Footer are unchanged and still use some composite imagery/hotspots; this is NOT a completed whole-page conversion.
- Decorative hero text remains an image and scales down on mobile by owner choice.
- The pre-existing About link points to Home; inspection category still maps to งานระบบ. No semantic route changes were bundled into visual work.
- Existing stats-reader failure fallback is zero; production data/permissions must be checked before release. This round does not assert production counts or live auth behavior.
- No migration, RLS, privileged API or auth-service changes; no merge or production deployment.
