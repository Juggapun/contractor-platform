/**
 * Unit tests for app/api/contractors/_lib/resolveRequestingUser.ts using
 * MOCKED clients — no network call, no real Supabase project. Same
 * class of test as tests/requireAdmin.test.ts (see its header comment
 * for what this class of test does and doesn't prove); mirrors its
 * structure since resolveRequestingUser() shares its trust model
 * (bearer token verified against the real auth provider, role read
 * fresh from `profiles`), with the one deliberate difference this suite
 * exists to pin down: a MISSING token is not an error here — it's "new
 * user signing up", the pre-Issue-#19 flow.
 */
import { describe, expect, it, vi } from 'vitest';
import { resolveRequestingUser } from '../app/api/contractors/_lib/resolveRequestingUser';

function makeRequest(authHeader?: string): Request {
  return new Request('http://localhost/api/contractors/register', {
    method: 'POST',
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

function makeAdminClient(profile: { role: string } | null, profileError: unknown = null) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: profileError }),
        })),
      })),
    })),
  } as any;
}

function makeAuthClient(user: { id: string; email?: string } | null, error: unknown = null) {
  return { getUser: vi.fn().mockResolvedValue({ data: { user }, error }) } as any;
}

describe('resolveRequestingUser', () => {
  it('returns mode "new" for a request with no Authorization header, without calling any client (the pre-Issue-#19 signup flow stays untouched)', async () => {
    const adminClient = makeAdminClient(null);
    const authClient = makeAuthClient(null);
    const result = await resolveRequestingUser(makeRequest(), adminClient, authClient);
    expect(result).toEqual({ mode: 'new' });
    expect(authClient.getUser).not.toHaveBeenCalled();
    expect(adminClient.from).not.toHaveBeenCalled();
  });

  it('returns an error (not a silent fallback to "new") when the token fails verification', async () => {
    const adminClient = makeAdminClient(null);
    const authClient = makeAuthClient(null, { message: 'bad token' });
    const result = await resolveRequestingUser(makeRequest('Bearer bad-token'), adminClient, authClient);
    expect(result).toEqual({ mode: 'error', status: 401, error: expect.any(String) });
    expect(adminClient.from).not.toHaveBeenCalled();
  });

  it('returns an error when the verified user has no profile row', async () => {
    const adminClient = makeAdminClient(null);
    const authClient = makeAuthClient({ id: 'ghost' });
    const result = await resolveRequestingUser(makeRequest('Bearer tok'), adminClient, authClient);
    expect(result).toEqual({ mode: 'error', status: 401, error: expect.any(String) });
  });

  it('returns mode "existing" with the verified user id and role for a customer', async () => {
    const adminClient = makeAdminClient({ role: 'customer' });
    const authClient = makeAuthClient({ id: 'u1', email: 'c@test.local' });
    const result = await resolveRequestingUser(makeRequest('Bearer tok'), adminClient, authClient);
    expect(result).toEqual({ mode: 'existing', userId: 'u1', role: 'customer' });
  });

  it('returns mode "existing" for an already-contractor user too (idempotent re-submission is the route handler\'s job, not this)', async () => {
    const adminClient = makeAdminClient({ role: 'contractor' });
    const authClient = makeAuthClient({ id: 'u2', email: 'k@test.local' });
    const result = await resolveRequestingUser(makeRequest('Bearer tok'), adminClient, authClient);
    expect(result).toEqual({ mode: 'existing', userId: 'u2', role: 'contractor' });
  });

  it('returns mode "existing" for an admin too (rejecting an admin from becoming a contractor is the route handler\'s job, not this)', async () => {
    const adminClient = makeAdminClient({ role: 'admin' });
    const authClient = makeAuthClient({ id: 'admin-1', email: 'a@test.local' });
    const result = await resolveRequestingUser(makeRequest('Bearer tok'), adminClient, authClient);
    expect(result).toEqual({ mode: 'existing', userId: 'admin-1', role: 'admin' });
  });

  it('looks up the profile row by the token-derived user id, never a client-supplied one', async () => {
    const eqSpy = vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'customer' }, error: null }) }));
    const adminClient = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: eqSpy })) })),
    } as any;
    const authClient = makeAuthClient({ id: 'the-real-verified-id' });
    await resolveRequestingUser(makeRequest('Bearer tok'), adminClient, authClient);
    expect(eqSpy).toHaveBeenCalledWith('id', 'the-real-verified-id');
  });
});
