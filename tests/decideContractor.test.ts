/**
 * Unit tests for app/api/admin/_lib/decideContractor.ts using a MOCKED
 * SupabaseClient — no network call, no real Postgres. Real concurrency
 * behavior (two simultaneous requests racing the conditional UPDATE) is
 * verified separately against real Postgres — see
 * docs/PHASE8-ADMIN-APPROVAL-REPORT.md's security tests section.
 */
import { describe, expect, it, vi } from 'vitest';
import { decideContractor } from '../app/api/admin/_lib/decideContractor';

function makeClient({
  existing,
  existingError = null,
  updateResult,
  updateError = null,
  auditError = null,
  recheckStatus,
}: {
  existing: { id: string; status: string } | null;
  existingError?: unknown;
  updateResult?: { id: string; business_name: string; slug: string; status: string } | null;
  updateError?: unknown;
  auditError?: unknown;
  recheckStatus?: string;
}) {
  const insertSpy = vi.fn().mockResolvedValue({ error: auditError });

  // Persists ACROSS separate `.from('contractors')` calls —
  // decideContractor() calls `.from('contractors')` fresh for the
  // initial check and, only on a lost race, again for the re-check, so
  // this can't be reset inside the `from` factory below.
  let selectCallCount = 0;

  const from = vi.fn((table: string) => {
    if (table === 'admin_actions') {
      return { insert: insertSpy };
    }
    // public.contractors — three distinct call shapes used by
    // decideContractor(): the initial existence/status check, the
    // conditional update+select+single, and (only on a lost race) a
    // re-check select.
    return {
      select: vi.fn(() => {
        selectCallCount += 1;
        const isReCheck = selectCallCount > 1;
        return {
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue(
              isReCheck
                ? { data: recheckStatus ? { status: recheckStatus } : null, error: null }
                : { data: existing, error: existingError }
            ),
          })),
        };
      }),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: updateResult ?? null, error: updateError }),
            })),
          })),
        })),
      })),
    };
  });

  return { from, insertSpy } as any;
}

describe('decideContractor', () => {
  it('returns not_found when the contractor id does not exist', async () => {
    const client = makeClient({ existing: null });
    const result = await decideContractor(client, 'missing-id', 'approved', 'admin-1', 'approve_contractor', null);
    expect(result).toEqual({ outcome: 'not_found' });
  });

  it('returns conflict when the contractor is not currently pending', async () => {
    const client = makeClient({ existing: { id: 'c1', status: 'approved' } });
    const result = await decideContractor(client, 'c1', 'approved', 'admin-1', 'approve_contractor', null);
    expect(result).toEqual({ outcome: 'conflict', currentStatus: 'approved' });
  });

  it('approves a pending contractor and writes an audit row with the acting admin id', async () => {
    const client = makeClient({
      existing: { id: 'c1', status: 'pending' },
      updateResult: { id: 'c1', business_name: 'ช่างทดสอบ', slug: 'chang-test', status: 'approved' },
    });
    const result = await decideContractor(client, 'c1', 'approved', 'admin-1', 'approve_contractor', null);
    expect(result).toEqual({ outcome: 'ok', businessName: 'ช่างทดสอบ', slug: 'chang-test', status: 'approved' });
    expect(client.insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ admin_id: 'admin-1', action: 'approve_contractor', target_id: 'c1' })
    );
  });

  it('rejects a pending contractor and stores the reason in the audit row notes', async () => {
    const client = makeClient({
      existing: { id: 'c2', status: 'pending' },
      updateResult: { id: 'c2', business_name: 'ช่างสอง', slug: 'chang-song', status: 'rejected' },
    });
    const result = await decideContractor(
      client,
      'c2',
      'rejected',
      'admin-1',
      'reject_contractor',
      'ข้อมูลไม่ครบถ้วน'
    );
    expect(result.outcome).toBe('ok');
    expect(client.insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'reject_contractor', notes: 'ข้อมูลไม่ครบถ้วน' })
    );
  });

  it('reports a lost race (concurrent decision) as conflict with the current status, not a generic error', async () => {
    const client = makeClient({
      existing: { id: 'c3', status: 'pending' },
      updateResult: null,
      updateError: null,
      recheckStatus: 'rejected',
    });
    const result = await decideContractor(client, 'c3', 'approved', 'admin-1', 'approve_contractor', null);
    expect(result).toEqual({ outcome: 'conflict', currentStatus: 'rejected' });
  });

  it('still reports success when the audit-log insert itself fails (status change already happened correctly)', async () => {
    const client = makeClient({
      existing: { id: 'c4', status: 'pending' },
      updateResult: { id: 'c4', business_name: 'ช่างสี่', slug: 'chang-si', status: 'approved' },
      auditError: { message: 'insert failed' },
    });
    const result = await decideContractor(client, 'c4', 'approved', 'admin-1', 'approve_contractor', null);
    expect(result.outcome).toBe('ok');
  });
});
