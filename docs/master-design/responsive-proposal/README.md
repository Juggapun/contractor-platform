# Responsive homepage master — proposal A

Status: **owner approved on 2026-10-02; implementation tracked in PR #57**. Issue #56. 2026-10-02.

The existing desktop master remains the baseline. These mobile/tablet masters use the approved brand artwork, seven category illustrations, navy/yellow palette and Kanit/Noto Sans Thai fonts. Snapshot content (contractors, reviews, statistics and articles) is a local visual fixture, not production or a promise of actual customer results.

Open `index.html` with the repository directory available (image paths reference `../../../public`). Resize the browser to see responsive behavior. This is a static design preview: search, menu, account and navigation actions are not implemented. `proposal.css` contains the isolated proposed changes; `snapshot.css` is the frozen application styling plus those changes. The approved rules are implemented separately in `app/home.css`; this snapshot remains the review reference.

| Rule | Phone master, 390 CSS px | Tablet master, 820 CSS px |
| --- | --- | --- |
| Page gutters | 20 px | 28 px |
| Section headings | Kanit 600, 24 px | Kanit 600, 26 px |
| Body | Noto Sans Thai, 14–16 px | Noto Sans Thai, 16 px |
| Search | Two selectors; keyword and search button each full width | Four controls on one row |
| Category illustrations | Three columns; last item centered | Seven columns |
| Statistics | Two columns | Four columns |
| Recommended contractors | One large card with next card partially visible, horizontal scroll | Three cards; access remaining results using existing link |
| How it works / benefits | Two columns | Two columns |
| Recruitment CTA | Photo above copy; lower photo edge fades into navy | Photo left, copy right; right and lower edges fade into navy |
| CTA benefits | Two columns (one below 360 px) | Two columns below text |
| Reviews | One card with next partially visible | Two cards |
| Articles | Compact image-left rows | Three image-top cards |
| Footer | Two link columns, social row, centered original slogan | Three columns |

## Responsive ranges
- Phone composition below 600 px, tablet composition 600–1023 px; preserve existing desktop above that when implementing.
- Snapshot retains the application's existing hero-art switch at 768 px. Intermediate widths are reviewed for overflow; landscape and additional real devices should be included in implementation QA.
- Minimum action height 44 px; primary search/signup buttons 48–50 px.
- Preserve aspect ratios, avoid stretching artwork. Keep the helmet and shirt message readable in the recruitment photo. Fade the edges only, not the central shirt lettering.
- Decorative words and mascot artwork remain images. Headings, copy, search inputs, category labels, signup button and links remain HTML.
- Existing route mappings, database, authentication and data fetching remain outside this design proposal.

## Review outputs
- `mobile-full.webp`, `tablet-full.webp`: complete proposed pages.
- `mobile-cta.webp`, `tablet-cta.webp`: detail of the recruitment banner.
- `checks.json`: viewport/image/heading checks at 320, 390, 600, 820 and 1024 px.

Implementation checklist: implement scoped responsive rules in the application, preserve desktop, verify real data and control behavior, compare screenshots to the approved masters, then publish. Owner approved both masters and authorized implementation in this conversation.
