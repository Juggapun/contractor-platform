/**
 * Unit tests for app/api/admin/_lib/requireAdmin.ts using MOCKED
 * clients — no network call, no real Supabase project. See
 * tests/authService.test.ts's header comment for what this class of
 * test does and doesn't prove; the real end-to-end authorization
 * behavior (including "a non-admin's forged/claimed role is ignored")
 * is verified separately against real Postgres — see
 * docs/PHASE8-ADMIN-APPROVAL-REPORT.md's security tests section.
 */
import { describe, expect, it, vi } from 'vitest';
import { requireAdmin } from '../app/api/admin/_lib/requireAdmin';

function makeRequest(authHeader?: string): Request {
  return new Request('http://localhost/api/admin/contractors', {
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

describe('requireAdmin', () => {
  it('rejects a request with no Authorization header, without calling any client', async () => {
    const adminClient = makeAdminClient(null);
    const authClient = makeAuthClient(null);
    const result = await requireAdmin(makeRequest(), adminClient, authClient);
    expect(result).toEqual({ ok: false, status: 401, error: expect.any(String) });
    expect(authClient.getUser).not.toHaveBeenCalled();
    expect(adminClient.from).not.toHaveBeenCalled();
  });

  it('rejects when the token fails verification (invalid/expired)', async () => {
    const adminClient = makeAdminClient(null);
    const authClient = makeAuthClient(null, { message: 'bad token' });
    const result = await requireAdmin(makeRequest('Bearer bad-token'), adminClient, authClient);
    expect(result).toEqual({ ok: false, status: 401, error: expect.any(String) });
    expect(adminClient.from).not.toHaveBeenCalled();
  });

  it('rejects a verified non-admin user (role read fresh from profiles, not trusted from the token)', async () => {
    const adminClient = makeAdminClient({ role: 'customer' });
    const authClient = makeAuthClient({ id: 'u1', email: 'c@test.local' });
    const result = await requireAdmin(makeRequest('Bearer tok'), adminClient, authClient);
    expect(result).toEqual({ ok: false, status: 403, error: expect.any(String) });
  });

  it('rejects a verified contractor-role user the same way as a customer', async () => {
    const adminClient = makeAdminClient({ role: 'contractor' });
    const authClient = makeAuthClient({ id: 'u2', email: 'k@test.local' });
    const result = await requireAdmin(makeRequest('Bearer tok'), adminClient, authClient);
    expect(result).toEqual({ ok: false, status: 403, error: expect.any(String) });
  });

  it('rejects when the profile row is missing entirely', async () => {
    const adminClient = makeAdminClient(null);
    const authClient = makeAuthClient({ id: 'ghost' });
    const result = await requireAdmin(makeRequest('Bearer tok'), adminClient, authClient);
    expect(result).toEqual({ ok: false, status: 403, error: expect.any(String) });
  });

  it('accepts a verified admin user and returns their id — never a client-supplied id', async () => {
    const adminClient = makeAdminClient({ role: 'admin' });
    const authClient = makeAuthClient({ id: 'admin-1', email: 'a@test.local' });
    const result = await requireAdmin(makeRequest('Bearer tok'), adminClient, authClient);
    expect(result).toEqual({ ok: true, adminId: 'admin-1' });
  });

  it('looks up the profile row by the token-derived user id, not anything else', async () => {
    const eqSpy = vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }) }));
    const adminClient = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: eqSpy })) })),
    } as any;
    const authClient = makeAuthClient({ id: 'the-real-verified-id' });
    await requireAdmin(makeRequest('Bearer tok'), adminClient, authClient);
    expect(eqSpy).toHaveBeenCalledWith('id', 'the-real-verified-id');
  });
});
