/**
 * Records an anonymous interest signal into public.contact_events
 * (0008_contact_events.sql) — a founder-decided, deliberately
 * identity-free table (no user id, no IP, just contractor_id +
 * event_type + timestamp). RLS's `contact_events_insert_anyone` policy
 * (0013_rls_policies.sql) allows this insert from anon with `check
 * (true)` by design, so this uses the anon-key client — the same one
 * every other public read in this app uses, never service_role.
 *
 * `event_type` is constrained by the table's own CHECK constraint to
 * ('phone', 'line', 'facebook', 'profile_view'). There is no 'website'
 * value — website_url is shown as a contact CTA on the profile page,
 * but clicking it is NOT tracked, because adding a 5th event_type would
 * mean altering that CHECK constraint, which is a migration Phase 6 was
 * told to avoid absent a genuine blocker. This is a real, disclosed
 * limitation (see docs/PHASE6-CONTRACTOR-PROFILE-REPORT.md), not an
 * oversight.
 *
 * Best-effort and non-blocking by design: a failed insert (Supabase not
 * configured, network hiccup, etc.) must never break page rendering or
 * prevent the user from actually calling/messaging the contractor —
 * this function swallows its own errors after logging them.
 */
import { getSupabaseClient } from '../supabase/client';

export type ContactEventType = 'phone' | 'line' | 'facebook' | 'profile_view';

export async function recordContactEvent(
  contractorId: string,
  eventType: ContactEventType
): Promise<void> {
  try {
    const client = getSupabaseClient();
    const { error } = await client
      .from('contact_events')
      .insert({ contractor_id: contractorId, event_type: eventType });

    if (error) {
      console.error('recordContactEvent: insert failed', error.message);
    }
  } catch (err) {
    console.error('recordContactEvent: Supabase not reachable/configured', err);
  }
}
