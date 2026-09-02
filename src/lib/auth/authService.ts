/**
 * Authentication foundation (Phase 3). Wraps supabase-js's Auth API and
 * public.profiles for the flows this phase covers: customer sign-up,
 * contractor sign-up (account foundation only — the full business
 * profile form is Phase 7), sign-in, sign-out, session persistence, and
 * current-user retrieval.
 *
 * Every function here accepts an optional `client` so tests can inject a
 * mock SupabaseClient instead of hitting a real (or absent) Supabase
 * project — see tests/authService.test.ts and its header comment for
 * exactly what that does and doesn't prove.
 *
 * ROLE HANDLING: `profiles.role` is never taken from caller input. A new
 * account is always created as `customer` by the database's own
 * `handle_new_user` trigger (supabase/migrations/0004_profiles.sql),
 * regardless of which sign-up function was called. `signUpContractor`
 * additionally calls `promoteNewAccountToContractor`, a narrow
 * service_role-only helper that flips the role Supabase already assigned
 * to this brand-new account — it never accepts a role or target id from
 * request input. Nothing in this module can move an *existing* account
 * to `admin`; only a database administrator acting directly (or a future
 * trusted internal tool built the same way as promoteNewAccountToContractor)
 * can do that. This mirrors `trg_profiles_lock_role`
 * (supabase/migrations/0004_profiles.sql), which would reject a
 * self-service role change at the database layer even if this code had a
 * bug — RLS/triggers are the authoritative enforcement, this module is a
 * convenience wrapper on top of them.
 */
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabase/client.js';
import type { CurrentUser, Profile, SignInInput, SignUpInput } from './types.js';

export interface AuthResult {
  user: User;
  session: Session | null;
}

/** Customer sign-up. Creates an `auth.users` row via Supabase Auth; the
 * database trigger creates the matching `profiles` row with the default
 * role `customer` — no role is passed from here. */
export async function signUpCustomer(
  input: SignUpInput,
  client: SupabaseClient = getSupabaseClient()
): Promise<AuthResult> {
  const { data, error } = await client.auth.signUp({
    email: input.email,
    password: input.password,
    ...(input.fullName ? { options: { data: { full_name: input.fullName } } } : {}),
  });
  if (error) throw error;
  if (!data.user) throw new Error('signUp succeeded but returned no user');
  return { user: data.user, session: data.session };
}

/**
 * Contractor sign-up FOUNDATION. Creates the auth account exactly like
 * signUpCustomer, then promotes the resulting brand-new account to the
 * `contractor` role via a trusted server-side call. Does NOT create a
 * `contractors` business-profile row — that requires business_name/slug
 * and the rest of the fields collected by the Phase 7 registration form;
 * this phase only provisions the account so Phase 7 has a `contractor`-
 * role user to attach that row to.
 *
 * `promote` must be a server-only caller (see promoteNewAccountToContractor
 * in this file) — never call this from a browser bundle with a
 * service_role-backed `promote` implementation reachable client-side.
 */
export async function signUpContractor(
  input: SignUpInput,
  promote: (userId: string) => Promise<void>,
  client: SupabaseClient = getSupabaseClient()
): Promise<AuthResult> {
  const result = await signUpCustomer(input, client);
  await promote(result.user.id);
  return result;
}

/**
 * Server-only. Flips a brand-new account's role to `contractor`. Takes
 * only a userId that the caller must have obtained from a just-completed
 * signUpCustomer() call in the same request — never from arbitrary
 * client-supplied input — so this cannot be used to re-promote or target
 * an unrelated existing account. Requires the service_role admin client
 * because `trg_profiles_lock_role` (0004_profiles.sql) otherwise forces
 * `role` back to its previous value for any non-trusted caller — by
 * design, so a compromised or buggy client can never grant itself this
 * role directly.
 */
export async function promoteNewAccountToContractor(
  userId: string,
  adminClient: SupabaseClient
): Promise<void> {
  const { error } = await adminClient
    .from('profiles')
    .update({ role: 'contractor' })
    .eq('id', userId);
  if (error) throw error;
}

export async function signIn(
  input: SignInInput,
  client: SupabaseClient = getSupabaseClient()
): Promise<AuthResult> {
  const { data, error } = await client.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (error) throw error;
  if (!data.user) throw new Error('signIn succeeded but returned no user');
  return { user: data.user, session: data.session };
}

export async function signOut(client: SupabaseClient = getSupabaseClient()): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

/** Session persistence/retrieval — backed by supabase-js's own storage
 * (see src/lib/supabase/client.ts's `persistSession`/`autoRefreshToken`). */
export async function getSession(
  client: SupabaseClient = getSupabaseClient()
): Promise<Session | null> {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

/**
 * Current-user retrieval: resolves the active session's user AND their
 * `profiles` row (role, name, etc.) in one call. Returns null when there
 * is no active session — callers must treat that as "anonymous", not
 * throw. The profile fetch relies on RLS's `profiles_select_own` policy
 * (0013_rls_policies.sql), so this only ever returns the caller's own
 * profile, never anyone else's, regardless of what this code does.
 */
export async function getCurrentUser(
  client: SupabaseClient = getSupabaseClient()
): Promise<CurrentUser | null> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) return null;

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .single();
  if (profileError) throw profileError;

  return {
    id: userData.user.id,
    email: userData.user.email ?? null,
    profile: profile as Profile,
  };
}

/** Authentication state handling: thin wrapper so callers don't reach
 * into supabase-js's client directly (keeps the auth surface in one
 * module, and gives tests a single seam to mock). */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void,
  client: SupabaseClient = getSupabaseClient()
): { unsubscribe: () => void } {
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange(callback);
  return { unsubscribe: () => subscription.unsubscribe() };
}
