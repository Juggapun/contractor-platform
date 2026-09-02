/**
 * Unit tests for src/lib/auth/authService.ts using a MOCKED
 * supabase-js client — no network call, no real Supabase project.
 *
 * WHAT THESE TESTS PROVE: authService's own logic is correct — it calls
 * the right supabase-js methods with the right arguments, handles
 * errors correctly, and (critically) never derives `profiles.role` from
 * anything other than the database's own trigger default / the
 * dedicated service_role promotion path.
 *
 * WHAT THESE TESTS DO NOT PROVE: that a real Supabase Auth
 * (GoTrue) server actually accepts these calls, issues real JWTs, or
 * that PostgREST/RLS behaves as expected end-to-end. That requires a
 * real hosted Supabase project — see docs/AUTHENTICATION.md and
 * docs/PHASE2-EXECUTION-REPORT.md for why that isn't available in this
 * environment, and supabase/local-dev/run-security-tests.mjs for the
 * separate suite that DOES run against real Postgres (real RLS/triggers,
 * mocked JWT claims instead of a mocked client).
 */
import { describe, expect, it, vi } from 'vitest';
import {
  getCurrentUser,
  getSession,
  promoteNewAccountToContractor,
  signIn,
  signOut,
  signUpContractor,
  signUpCustomer,
} from '../src/lib/auth/authService.js';

function makeMockClient(overrides: Record<string, unknown> = {}) {
  return {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(),
      ...((overrides.auth as object) ?? {}),
    },
    from: vi.fn(),
    ...overrides,
  } as any;
}

describe('signUpCustomer', () => {
  it('calls auth.signUp with email/password and full_name metadata, no role', async () => {
    const client = makeMockClient();
    client.auth.signUp.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@test.local' }, session: { access_token: 'tok' } },
      error: null,
    });

    const result = await signUpCustomer(
      { email: 'a@test.local', password: 'hunter22', fullName: 'A B' },
      client
    );

    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: 'a@test.local',
      password: 'hunter22',
      options: { data: { full_name: 'A B' } },
    });
    // must never pass a role in the signUp payload
    const callArg = client.auth.signUp.mock.calls[0][0];
    expect(JSON.stringify(callArg)).not.toContain('role');
    expect(result.user.id).toBe('u1');
  });

  it('throws the underlying error on failure', async () => {
    const client = makeMockClient();
    client.auth.signUp.mockResolvedValue({ data: {}, error: new Error('email taken') });
    await expect(
      signUpCustomer({ email: 'a@test.local', password: 'x' }, client)
    ).rejects.toThrow('email taken');
  });

  it('throws if signUp reports success but no user (defensive)', async () => {
    const client = makeMockClient();
    client.auth.signUp.mockResolvedValue({ data: { user: null, session: null }, error: null });
    await expect(
      signUpCustomer({ email: 'a@test.local', password: 'x' }, client)
    ).rejects.toThrow(/no user/);
  });
});

describe('signUpContractor', () => {
  it('signs up like a customer, then calls promote() with the new user id only', async () => {
    const client = makeMockClient();
    client.auth.signUp.mockResolvedValue({
      data: { user: { id: 'contractor-1', email: 'c@test.local' }, session: null },
      error: null,
    });
    const promote = vi.fn().mockResolvedValue(undefined);

    await signUpContractor({ email: 'c@test.local', password: 'x' }, promote, client);

    expect(promote).toHaveBeenCalledTimes(1);
    expect(promote).toHaveBeenCalledWith('contractor-1');
  });

  it('does not call promote() if the initial signUp fails', async () => {
    const client = makeMockClient();
    client.auth.signUp.mockResolvedValue({ data: {}, error: new Error('boom') });
    const promote = vi.fn();

    await expect(
      signUpContractor({ email: 'c@test.local', password: 'x' }, promote, client)
    ).rejects.toThrow('boom');
    expect(promote).not.toHaveBeenCalled();
  });
});

describe('promoteNewAccountToContractor', () => {
  it('updates profiles.role via the provided admin client, scoped to the given id', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    const adminClient = { from } as any;

    await promoteNewAccountToContractor('user-123', adminClient);

    expect(from).toHaveBeenCalledWith('profiles');
    expect(update).toHaveBeenCalledWith({ role: 'contractor' });
    expect(eq).toHaveBeenCalledWith('id', 'user-123');
  });

  it('throws on a database error instead of silently succeeding', async () => {
    const eq = vi.fn().mockResolvedValue({ error: new Error('locked by trigger') });
    const adminClient = { from: () => ({ update: () => ({ eq }) }) } as any;

    await expect(promoteNewAccountToContractor('user-123', adminClient)).rejects.toThrow(
      'locked by trigger'
    );
  });
});

describe('signIn / signOut', () => {
  it('signIn calls signInWithPassword and returns user+session', async () => {
    const client = makeMockClient();
    client.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'u1' }, session: { access_token: 'tok' } },
      error: null,
    });
    const result = await signIn({ email: 'a@test.local', password: 'x' }, client);
    expect(result.session?.access_token).toBe('tok');
  });

  it('signIn throws on invalid credentials', async () => {
    const client = makeMockClient();
    client.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: new Error('Invalid login credentials'),
    });
    await expect(signIn({ email: 'a@test.local', password: 'wrong' }, client)).rejects.toThrow(
      'Invalid login credentials'
    );
  });

  it('signOut calls auth.signOut and throws on error', async () => {
    const client = makeMockClient();
    client.auth.signOut.mockResolvedValue({ error: null });
    await expect(signOut(client)).resolves.toBeUndefined();

    client.auth.signOut.mockResolvedValue({ error: new Error('network') });
    await expect(signOut(client)).rejects.toThrow('network');
  });
});

describe('getSession', () => {
  it('returns the session from supabase-js (persistence layer)', async () => {
    const client = makeMockClient();
    client.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } }, error: null });
    const session = await getSession(client);
    expect(session?.access_token).toBe('tok');
  });

  it('returns null when there is no session', async () => {
    const client = makeMockClient();
    client.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await getSession(client)).toBeNull();
  });
});

describe('getCurrentUser', () => {
  it('returns null when there is no authenticated user (anonymous), not a throw', async () => {
    const client = makeMockClient();
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await getCurrentUser(client)).toBeNull();
  });

  it('fetches the profile row for the current user id and returns id+email+profile', async () => {
    const client = makeMockClient();
    client.auth.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@test.local' } },
      error: null,
    });
    const single = vi.fn().mockResolvedValue({
      data: { id: 'u1', role: 'customer', full_name: 'A', phone: null, avatar_url: null, created_at: 't', updated_at: 't' },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    client.from.mockReturnValue({ select });

    const result = await getCurrentUser(client);

    expect(client.from).toHaveBeenCalledWith('profiles');
    expect(select).toHaveBeenCalledWith('*');
    expect(eq).toHaveBeenCalledWith('id', 'u1');
    expect(result).toEqual({
      id: 'u1',
      email: 'a@test.local',
      profile: expect.objectContaining({ id: 'u1', role: 'customer' }),
    });
  });

  it('propagates a profile fetch error instead of silently returning null', async () => {
    const client = makeMockClient();
    client.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1', email: null } }, error: null });
    const single = vi.fn().mockResolvedValue({ data: null, error: new Error('db down') });
    client.from.mockReturnValue({ select: () => ({ eq: () => ({ single }) }) });

    await expect(getCurrentUser(client)).rejects.toThrow('db down');
  });
});
