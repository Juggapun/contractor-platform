/**
 * Issue #33 — friendly Thai messages for the two specific auth failures
 * users found confusing: a duplicate email at sign-up, and a wrong
 * password at sign-in. Everything else keeps showing whatever message it
 * already did (Error#message, or the caller's own generic fallback) —
 * this only narrows the two named cases, not general auth-error
 * handling.
 *
 * Keyed off `AuthApiError#code` (GoTrue's stable `error_code`, e.g.
 * `user_already_exists` / `invalid_credentials` — see
 * node_modules/@supabase/auth-js/lib/errors.js), never off `message`
 * text, since GoTrue's message strings aren't a stable contract and are
 * always in English regardless of the caller's locale.
 *
 * Note on `invalid_credentials`: real GoTrue (and this repo's local-dev
 * shim, supabase/local-dev/postgrest-shim.mjs's handleAuthToken) returns
 * this exact same code for "wrong password" AND "no account with that
 * email" — a deliberate anti-enumeration measure. Mapping it to
 * "รหัสผ่านไม่ถูกต้อง" here doesn't weaken that: the message is shown
 * identically in both cases, so it still reveals nothing about whether
 * the email is registered.
 */
import { isAuthApiError } from '@supabase/supabase-js';

export function getSignUpErrorMessage(err: unknown, fallback: string): string {
  if (isAuthApiError(err) && err.code === 'user_already_exists') {
    return 'อีเมลนี้ถูกใช้งานแล้ว';
  }
  return err instanceof Error ? err.message : fallback;
}

export function getSignInErrorMessage(err: unknown, fallback: string): string {
  if (isAuthApiError(err) && err.code === 'invalid_credentials') {
    return 'รหัสผ่านไม่ถูกต้อง';
  }
  return err instanceof Error ? err.message : fallback;
}
