/**
 * DEFENSE-IN-DEPTH ROLE GUARDS — NOT THE SOURCE OF TRUTH.
 *
 * These helpers exist so server-side route/handler code (later phases)
 * can fail fast with a clean error before even attempting a query, and
 * so UI code (later phases) can decide what to render. The REAL
 * authorization boundary is Postgres RLS
 * (supabase/migrations/0013_rls_policies.sql) plus the field-locking
 * triggers in 0004/0012 — those still apply even if every guard below
 * were deleted or bypassed. Never add a code path that trusts a
 * client-supplied role instead of the `profile.role` value that came
 * back from getCurrentUser() (which itself comes from the database, not
 * from request input).
 */
import type { CurrentUser, UserRole } from './types.js';

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export function isAdmin(user: CurrentUser | null): boolean {
  return user?.profile.role === 'admin';
}

export function isContractor(user: CurrentUser | null): boolean {
  return user?.profile.role === 'contractor';
}

export function isCustomer(user: CurrentUser | null): boolean {
  return user?.profile.role === 'customer';
}

/** Throws ForbiddenError if `user` is null or its role isn't in `allowed`. */
export function requireRole(user: CurrentUser | null, allowed: readonly UserRole[]): CurrentUser {
  if (!user) {
    throw new ForbiddenError('Authentication required.');
  }
  if (!allowed.includes(user.profile.role)) {
    throw new ForbiddenError(
      `Requires role in [${allowed.join(', ')}], got '${user.profile.role}'.`
    );
  }
  return user;
}

export function requireAdmin(user: CurrentUser | null): CurrentUser {
  return requireRole(user, ['admin']);
}

/** True if `user` owns the row identified by `ownerId` (e.g.
 * contractors.user_id) or is an admin. Mirrors the `user_id = auth.uid()
 * or is_admin()` shape used throughout 0013_rls_policies.sql — again,
 * as a fast client-side check only; RLS enforces the real thing. */
export function ownsOrIsAdmin(user: CurrentUser | null, ownerId: string): boolean {
  if (!user) return false;
  return user.id === ownerId || isAdmin(user);
}
