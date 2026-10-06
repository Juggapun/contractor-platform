# Search page and contractor images — 2026-10-06

Implements the approved original mobile-v2 design without the sitting mascot.
Search uses real category/province/keyword GET filters, real counts, pagination,
reviews and verification status. Covers use a 1.8:1 frame; avatars are circular.
Missing covers show an honest empty state rather than repurposing an old avatar.
Existing images and portfolio rows are preserved. Homepage featured cards prefer
new covers and retain their old photo fallback until an owner adds a cover.

Registration and image management now separate profile, cover and portfolio.
Profile and cover editors support dragging, keyboard-accessible position/zoom
sliders, preview, confirm and cancel. The exported crop uses the same geometry
as the preview. Pending edits block form submission. Cancel preserves the last
confirmed selection. Registration caps each of seven possible files at 500 KiB
before sending the multipart request; files that cannot fit are rejected locally
with a message instead of hitting the hosting request-body limit.

The new cover route uses the existing verified-owner boundary, byte validation,
server WebP encoding and random storage names. Failed database updates remove
the new object while preserving the previous one. Registration also cleans up
unreferenced uploaded objects after a failed image write.

## Required deployment order

1. Run `supabase/migrations/0027_contractor_cover_image.sql` in the existing
   Supabase project's SQL Editor (or the project's normal migration workflow).
   This adds a nullable cover_image_url column, preserves rows, and reloads the
   API schema cache. No RLS or privilege expansion.
2. Confirm the column exists, then merge/deploy PR 58.
3. Verify production search and one owner profile/cover upload and replacement.

**Do not merge before step 1.** Public queries now explicitly request the new
column. This workspace has no connected Supabase administration tool or database
credentials; the production migration has not been executed. PR remains draft.

## Validation

- TypeScript and ESLint pass.
- Vitest: 23 files / 282 tests pass, including new crop bounds/ratio/metadata
  and cover-route unauthorized, invalid-image, ownership and rollback tests.
- Production build passes with webpack. Initial Turbopack build aborted in this
  execution environment; no application compile failure under webpack.
- Local Chromium fixture checks at 320, 390, 600, 820, 1024 and 1440 pixels:
  no horizontal overflow, separate covers/avatars, missing-cover fallback.
- Browser checks: zoom, pointer drag, confirm square/profile and 1.8:1 cover
  dimensions, and cancel preserving the previously confirmed preview.
- Screenshots under docs/qa/search-implementation use labelled local fixtures,
  not real customer results. No production uploads or database writes were tested.

Previous full account/admin flows were already owner-tested. This change's
remaining production gate is specifically the new cover migration/upload path.
