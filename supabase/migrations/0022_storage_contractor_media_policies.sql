-- =====================================================================
-- 0022_storage_contractor_media_policies.sql
-- Depends on: nothing in this schema — targets Supabase's own `storage`
-- schema, which only exists on a real Supabase project (a plain local
-- Postgres install, this repo's local-dev harness included, has no
-- `storage` schema at all — see supabase/local-dev/README.md). The
-- whole body below is wrapped in an existence check so this migration
-- is a safe no-op locally and only takes effect against a real project.
--
-- Issue #35 security audit finding: `contractor-media` (the bucket
-- src/lib/storage/contractorMedia.ts writes to) has NEVER had its
-- access policy versioned anywhere in this repository. Every
-- application code path that writes to it already uses the
-- service_role admin client exclusively (that file's own header
-- comment) — which bypasses storage.objects RLS entirely regardless of
-- what policies exist. But that only describes what THIS APP's code
-- does; it says nothing about whether Supabase Storage's REST API would
-- also accept a direct upload/delete from the public anon key (shipped
-- to every browser by design) or an authenticated user's own key,
-- bypassing this app's server-side ownership checks
-- (requireContractorOwner()) entirely. Whatever the real project's
-- bucket currently allows for those roles has only ever lived in the
-- Supabase dashboard — unversioned, not visible in git history, and not
-- something this session can inspect or confirm (no access to the
-- hosted project). This migration makes the intended policy explicit
-- and enforced at the database level: public read (required — every
-- approved contractor's `<img src>` depends on it, see
-- contractorMedia.ts's own "public bucket, unguessable path" design
-- note), and no insert/update/delete policy for anon or authenticated
-- at all, so only service_role (which bypasses RLS) can write —
-- matching what the application code has always assumed, now actually
-- guaranteed by the database rather than by dashboard configuration
-- that could silently drift.
--
-- NOT behavior-tested by supabase/local-dev/run-security-tests.mjs:
-- that harness has no `storage` schema to test against (see above).
-- This can only be verified against a real hosted Supabase project.
-- =====================================================================

do $$
begin
  if to_regclass('storage.objects') is not null then
    execute $sql$
      drop policy if exists "contractor_media_public_read" on storage.objects;
      create policy "contractor_media_public_read" on storage.objects
        for select
        using (bucket_id = 'contractor-media');
    $sql$;
  end if;
end;
$$;
