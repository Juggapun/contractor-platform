import { describe, expect, it } from 'vitest';
import { ForbiddenError, isAdmin, ownsOrIsAdmin, requireAdmin, requireRole } from '../src/lib/auth/guards.js';
import type { CurrentUser } from '../src/lib/auth/types.js';

function user(role: CurrentUser['profile']['role'], id = 'u1'): CurrentUser {
  return {
    id,
    email: 'x@test.local',
    profile: { id, role, full_name: null, phone: null, avatar_url: null, created_at: 't', updated_at: 't' },
  };
}

describe('requireRole', () => {
  it('throws ForbiddenError for null user', () => {
    expect(() => requireRole(null, ['admin'])).toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when role not allowed', () => {
    expect(() => requireRole(user('customer'), ['admin'])).toThrow(ForbiddenError);
  });

  it('returns the user when role is allowed', () => {
    const u = user('admin');
    expect(requireRole(u, ['admin'])).toBe(u);
  });
});

describe('requireAdmin / isAdmin', () => {
  it('rejects a contractor', () => {
    expect(isAdmin(user('contractor'))).toBe(false);
    expect(() => requireAdmin(user('contractor'))).toThrow(ForbiddenError);
  });

  it('accepts an admin', () => {
    expect(isAdmin(user('admin'))).toBe(true);
  });
});

describe('ownsOrIsAdmin', () => {
  it('true for the owner', () => {
    expect(ownsOrIsAdmin(user('contractor', 'owner-1'), 'owner-1')).toBe(true);
  });

  it('true for an admin regardless of id', () => {
    expect(ownsOrIsAdmin(user('admin', 'someone-else'), 'owner-1')).toBe(true);
  });

  it('false for a non-owner non-admin', () => {
    expect(ownsOrIsAdmin(user('customer', 'someone-else'), 'owner-1')).toBe(false);
  });

  it('false for null user', () => {
    expect(ownsOrIsAdmin(null, 'owner-1')).toBe(false);
  });
});
