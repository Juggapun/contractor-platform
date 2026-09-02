-- =====================================================================
-- 0009_reports.sql
-- Depends on: 0004_profiles.sql, 0005_contractors.sql, 0007_reviews.sql
-- Tables: reports
--
-- SECURITY REVIEW FIX (post-PHASE-2, ChatGPT review item 4):
-- The original design used target_type + target_id (a single polymorphic
-- column) validated only by a trigger, which does not give real
-- PostgreSQL referential integrity — e.g. a contractor could be hard
-- deleted elsewhere without ever touching reports.target_id, silently
-- orphaning the report. Migrated to two explicit nullable foreign keys
-- (contractor_id, review_id) with a CHECK constraint enforcing exactly
-- one is set. This is a standard, safer pattern than a polymorphic
-- reference for a two-target case like this.
-- =====================================================================

create table public.reports (
  id uuid primary key default gen_random_uuid(),

  contractor_id uuid references public.contractors(id) on delete cascade,
  review_id uuid references public.reviews(id) on delete cascade,

  reporter_id uuid references public.profiles(id) on delete set null,  -- nullable: anonymous reports allowed
  reason text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),

  -- exactly one of contractor_id / review_id must be set — never both,
  -- never neither. This is what makes "report against a contractor" and
  -- "report against a review" mutually exclusive at the database level.
  constraint reports_exactly_one_target check (
    (contractor_id is not null) <> (review_id is not null)
  )
);

comment on table public.reports is 'Report queue against exactly one of: a contractor OR a review (never both, never neither — see reports_exactly_one_target). reporter_id may be null for anonymous reports.';

create index idx_reports_status on public.reports(status);
create index idx_reports_contractor on public.reports(contractor_id) where contractor_id is not null;
create index idx_reports_review on public.reports(review_id) where review_id is not null;

-- Deletion behavior (documented per ChatGPT review item 7E):
-- ON DELETE CASCADE on both FKs means if the reported contractor or
-- review is deleted, the report row is deleted with it — a report has no
-- meaning once its target no longer exists, and there is no "removed"
-- placeholder state for reports the way there is for reviews.status.
-- If audit history of reports against later-deleted content becomes
-- important, revisit this to ON DELETE SET NULL + a target snapshot
-- column instead — not needed for MVP.
