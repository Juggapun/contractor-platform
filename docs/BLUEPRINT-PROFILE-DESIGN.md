# Approved search E and clean contractor profile

2026-10-06: owner approved the blueprint search hero and 3:2 contractor covers.
Profile uses the previously approved clean design (option 1, third image), not
the portfolio-first alternative.

Search hero uses a standalone background asset; all text, filters, cards and
navigation remain real HTML. The original brand logo is preserved.
Cover upload/crop/export and search/profile frames now use 3:2 (1080 x 720).
Existing files are preserved; older landscape covers are center-cropped visually
in the new frame and can be replaced by their owner using the new crop editor.
No database migration is needed. Homepage's previously approved compact featured
card layout is unchanged; its preview still uses its existing frame.

Profile adds a round overlapping avatar, pale blue background, white information,
portfolio and review panels, and mobile contact dock with desktop contact sidebar.
Only available contact channels render. Contact tracking, URL checks, review form,
real ratings, ownership-gated portfolio additions and gallery lightbox are retained.
No fictional names, reviews, photos, badges or statistics are added to live data.

Validation: TypeScript and ESLint pass; webpack production build passes; 7 affected
crop/upload tests pass. Local browser fixtures verify search at 320/390/600/820/
1024/1440 and profile at 320/390/820/1440 without horizontal overflow. Measured
cover aspect is 1.5; client crop exports 1080x720. Gallery next/Escape, mobile dock,
desktop sidebar and missing cover/contact/portfolio states pass. Evidence is in
`docs/qa/blueprint-profile/results.json` and adjacent WebP screenshots.

Background `public/search/blueprint-house.webp` was generated with the built-in
image tool, then encoded for web delivery. Prompt brief: wide navy architectural
blueprint of a modern Thai two-storey house on the right, fine cyan drafting lines,
quiet left side for HTML heading, no text, logos, people or UI. Source generated
image is retained separately; this WebP is the repository-backed production asset.
