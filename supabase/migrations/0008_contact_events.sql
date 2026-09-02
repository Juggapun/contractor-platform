-- =====================================================================
-- 0008_contact_events.sql
-- Depends on: 0005_contractors.sql
-- Tables: contact_events
-- Founder decision (PHASE 1 approval): kept fully anonymous in MVP —
-- no IP address, no user identity is stored on this table, by design.
-- =====================================================================

create table public.contact_events (
  id bigserial primary key,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  event_type text not null check (event_type in ('phone', 'line', 'facebook', 'profile_view')),
  created_at timestamptz not null default now()
);

comment on table public.contact_events is
  'Anonymous interest signal (button clicks / profile views). No IP or user identity is stored — founder decision, PHASE 1.';

create index idx_contact_events_contractor_created on public.contact_events(contractor_id, created_at);
