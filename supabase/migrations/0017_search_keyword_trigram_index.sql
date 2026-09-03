-- =====================================================================
-- 0017_search_keyword_trigram_index.sql
-- Depends on: 0005_contractors.sql
-- PHASE 13 — Performance & Production Hardening (Issue #11).
--
-- searchContractors() (src/lib/data/contractors.ts, Phase 5) matches a
-- free-text keyword with `business_name.ilike.%kw%,description.ilike.%kw%`
-- — a leading-wildcard ILIKE, which a plain btree index (or the implicit
-- ones this schema already has) structurally cannot accelerate at all,
-- regardless of table size. This was a real, disclosed limitation since
-- Phase 5's own report ("an unindexed ILIKE scan on existing columns...
-- an acceptable, documented limitation at MVP scale"); this is the phase
-- explicitly scoped to revisit exactly that kind of thing ahead of real
-- beta/production traffic.
--
-- Verified via EXPLAIN ANALYZE against the live seeded data (15 rows)
-- before this migration: `Seq Scan on contractors ... Filter: ...
-- business_name ~~* ... OR description ~~* ...`. At 15 rows this costs
-- ~0.1ms and is not remotely a real bottleneck yet — recorded honestly
-- in docs/PHASE13-PERFORMANCE-REPORT.md rather than overclaimed. The
-- point of this index is the query PLAN, not today's wall-clock time: a
-- sequential scan degrades linearly with table size and has no ceiling;
-- a trigram GIN index gives Postgres a real option to use instead once
-- the contractor count actually grows.
--
-- Partial (`where status = 'approved'`), matching searchContractors()'s
-- own query exactly — this is the ONLY status a keyword search ever
-- filters to (see the RLS-enforced `contractors_select_approved_public`
-- policy, 0013), so indexing pending/rejected/suspended rows here would
-- be pure waste.
-- =====================================================================

create extension if not exists pg_trgm;

create index idx_contractors_business_name_trgm
  on public.contractors using gin (business_name gin_trgm_ops)
  where status = 'approved';

create index idx_contractors_description_trgm
  on public.contractors using gin (description gin_trgm_ops)
  where status = 'approved';
