/**
 * SQL-level security test harness for docs/SECURITY_TEST_PLAN.md
 * (sections A-F, Phase 2) and the Phase 3 authentication-flow scenarios
 * (section G) documented in docs/AUTHENTICATION.md.
 *
 * Emulates exactly what PostgREST does per-request: connect as
 * `authenticator`, then `SET LOCAL ROLE <role>` and
 * `SET LOCAL request.jwt.claims = '<jwt-claims-json>'` based on the
 * caller's key/session, then run the query inside that transaction.
 * auth.uid()/auth.role() (see bootstrap SQL) read those same GUCs, so
 * RLS policy evaluation is identical to what real PostgREST would
 * produce for the same JWT claims — only the HTTP/JWT-signature layer
 * itself is not exercised (see docs/PHASE2-EXECUTION-REPORT.md and
 * docs/AUTHENTICATION.md for that caveat).
 */
import pg from 'pg';

const pool = new pg.Pool({
  host: '127.0.0.1',
  port: 5432,
  database: 'contractor_platform',
  user: 'authenticator',
  password: 'authenticator_pw',
});

const IDS = {
  admin: '55555555-5555-5555-5555-555555555555',
  contractor1: '33333333-3333-3333-3333-333333333333', // owns aaaa...01 (approved)
  contractor2: '44444444-4444-4444-4444-444444444444', // owns aaaa...02 (pending)
  customer1: '11111111-1111-1111-1111-111111111111', // has reviewed aaaa...01
  customer2: '22222222-2222-2222-2222-222222222222', // no review yet
  contractorApproved: 'aaaaaaaa-0000-0000-0000-000000000001',
  contractorPending: 'aaaaaaaa-0000-0000-0000-000000000002',
  review1: 'bbbbbbbb-0000-0000-0000-000000000001',
};

const results = [];

async function withCtx(role, claims, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL ROLE ${role}`);
    if (claims) {
      await client.query('SELECT set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify(claims),
      ]);
    }
    const out = await fn(client);
    return { out, client };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    throw err;
  }
}

async function rollback(client) {
  await client.query('ROLLBACK');
  client.release();
}
async function commit(client) {
  await client.query('COMMIT');
  client.release();
}

// contexts matching PostgREST's actual JWT claim shape
const asAnon = (fn) => withCtx('anon', { role: 'anon' }, fn);
const asUser = (uid, fn) => withCtx('authenticated', { role: 'authenticated', sub: uid }, fn);
const asServiceRole = (fn) => withCtx('service_role', { role: 'service_role' }, fn);

let sectionLabel = '';
function section(label) {
  sectionLabel = label;
}

async function test(id, desc, fn) {
  try {
    await fn();
    results.push({ section: sectionLabel, id, desc, status: 'PASS' });
  } catch (err) {
    results.push({
      section: sectionLabel,
      id,
      desc,
      status: 'FAIL',
      error: err.message || String(err),
    });
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

async function main() {
  // =====================================================================
  section('A. Anonymous user (anon key)');
  // =====================================================================

  await test('A1', 'Cannot INSERT on contractors', async () => {
    const { out, client } = await withCtx('anon', { role: 'anon' }, async (c) => {
      try {
        await c.query(
          `insert into public.contractors (user_id, business_name, slug) values ($1,'x','x-anon-test')`,
          [IDS.customer2]
        );
        return 'inserted';
      } catch (e) {
        return e;
      }
    });
    await rollback(client);
    assert(out instanceof Error, 'expected RLS denial, insert succeeded');
  });

  await test('A2', 'Cannot UPDATE contractors', async () => {
    const { out, client } = await asAnon(async (c) => {
      const r = await c.query(
        `update public.contractors set business_name='hacked' where id=$1`,
        [IDS.contractorApproved]
      );
      return r.rowCount;
    });
    await rollback(client);
    assert(out === 0, `expected 0 rows affected, got ${out}`);
  });

  await test('A3', 'Cannot DELETE contractors', async () => {
    const { out, client } = await asAnon(async (c) => {
      const r = await c.query(`delete from public.contractors where id=$1`, [IDS.contractorApproved]);
      return r.rowCount;
    });
    await rollback(client);
    assert(out === 0, `expected 0 rows affected, got ${out}`);
  });

  await test('A4', 'Cannot INSERT/UPDATE/DELETE on profiles', async () => {
    const { out, client } = await asAnon(async (c) => {
      const results = {};
      await c.query('SAVEPOINT sp1');
      try {
        await c.query(`insert into public.profiles (id, full_name) values (gen_random_uuid(),'x')`);
        results.insert = 'succeeded';
      } catch (e) {
        results.insert = 'denied';
        await c.query('ROLLBACK TO SAVEPOINT sp1');
      }
      const upd = await c.query(`update public.profiles set full_name='hacked' where id=$1`, [IDS.customer1]);
      results.updateRows = upd.rowCount;
      const del = await c.query(`delete from public.profiles where id=$1`, [IDS.customer1]);
      results.deleteRows = del.rowCount;
      return results;
    });
    await rollback(client);
    assert(out.insert === 'denied', 'anon insert into profiles should be denied');
    assert(out.updateRows === 0, `expected 0 profile rows updated, got ${out.updateRows}`);
    assert(out.deleteRows === 0, `expected 0 profile rows deleted, got ${out.deleteRows}`);
  });

  await test('A5', 'Cannot SELECT any profiles row', async () => {
    const { out, client } = await asAnon(async (c) => {
      const r = await c.query(`select * from public.profiles`);
      return r.rowCount;
    });
    await rollback(client);
    assert(out === 0, `expected 0 profiles rows visible, got ${out}`);
  });

  await test('A6', "Cannot SELECT contractors where status != 'approved'", async () => {
    const { out, client } = await asAnon(async (c) => {
      const r = await c.query(`select * from public.contractors where id=$1`, [IDS.contractorPending]);
      return r.rowCount;
    });
    await rollback(client);
    assert(out === 0, `expected pending contractor hidden, got ${out} rows`);
  });

  await test('A7', "Can SELECT contractors where status = 'approved'", async () => {
    const { out, client } = await asAnon(async (c) => {
      const r = await c.query(`select * from public.contractors where id=$1`, [IDS.contractorApproved]);
      return r.rowCount;
    });
    await rollback(client);
    assert(out === 1, `expected approved contractor visible, got ${out} rows`);
  });

  await test('A8', 'Can INSERT into contact_events (any event_type)', async () => {
    // No RETURNING: matches PostgREST's default `Prefer: return=minimal`
    // for a plain .insert() call (no chained .select()). Postgres RLS
    // additionally requires a SELECT policy to satisfy RETURNING on
    // INSERT specifically — anon has none on contact_events by design
    // (anonymous inserts, no read-back), so RETURNING would (correctly)
    // error even though the row is inserted; that's a client-side
    // "don't chain .select() here" note, not a schema bug.
    const { out, client } = await asAnon(async (c) => {
      const r = await c.query(
        `insert into public.contact_events (contractor_id, event_type) values ($1,'phone')`,
        [IDS.contractorApproved]
      );
      return r.rowCount;
    });
    await rollback(client);
    assert(out === 1, 'expected anon contact_events insert to succeed');
  });

  await test('A9', 'Can INSERT into reports (one target set)', async () => {
    // No RETURNING — same reasoning as A8: anon has no SELECT policy on
    // reports (admin-only reads), so RETURNING would error under RLS
    // even though the plain insert succeeds.
    const { out, client } = await asAnon(async (c) => {
      const r = await c.query(
        `insert into public.reports (contractor_id, reason) values ($1,'spam')`,
        [IDS.contractorApproved]
      );
      return r.rowCount;
    });
    await rollback(client);
    assert(out === 1, 'expected anon reports insert to succeed');
  });

  await test('A10', 'Cannot SELECT from reports (admin-only)', async () => {
    const { out, client } = await asAnon(async (c) => {
      const r = await c.query(`select * from public.reports`);
      return r.rowCount;
    });
    await rollback(client);
    assert(out === 0, `expected 0 reports visible to anon, got ${out}`);
  });

  await test(
    'A11',
    'Cannot SELECT system_settings directly, but CAN call get_setting() for an is_public key',
    async () => {
      const { out, client } = await asAnon(async (c) => {
        const results = {};
        const direct = await c.query(`select * from public.system_settings`);
        results.directRows = direct.rowCount;
        const fn = await c.query(`select public.get_setting('free_contractor_portfolio_limit') as v`);
        results.fnValue = fn.rows[0].v;
        return results;
      });
      await rollback(client);
      assert(out.directRows === 0, `expected 0 system_settings rows visible directly, got ${out.directRows}`);
      assert(out.fnValue !== null, 'expected get_setting() to return a value for an is_public key');
    }
  );

  await test('A12', 'get_setting() with a made-up/non-public key returns null, not an error', async () => {
    const { out, client } = await asAnon(async (c) => {
      const r = await c.query(`select public.get_setting('this_key_does_not_exist') as v`);
      return r.rows[0].v;
    });
    await rollback(client);
    assert(out === null, `expected null, got ${JSON.stringify(out)}`);
  });

  // =====================================================================
  section('B. Normal contractor (authenticated, owns one contractors row)');
  // =====================================================================

  await test('B1', 'Can UPDATE own contractors editable fields', async () => {
    const { out, client } = await asUser(IDS.contractor1, async (c) => {
      const r = await c.query(
        `update public.contractors set business_name='Updated Co', phone='0812345678' where id=$1 returning business_name, phone`,
        [IDS.contractorApproved]
      );
      return r.rows[0];
    });
    await rollback(client);
    assert(out && out.business_name === 'Updated Co' && out.phone === '0812345678', 'own editable fields did not update');
  });

  await test('B2', "Cannot approve own contractor via direct UPDATE (set status='approved', status stays 'pending')", async () => {
    const { out, client } = await asUser(IDS.contractor2, async (c) => {
      await c.query(`update public.contractors set status='approved' where id=$1`, [IDS.contractorPending]);
      const r = await c.query(`select status from public.contractors where id=$1`, [IDS.contractorPending]);
      return r.rows[0].status;
    });
    await rollback(client);
    assert(out === 'pending', `expected status still 'pending' (locked by trigger), got ${out}`);
  });

  await test('B3', 'Cannot change own verification_status', async () => {
    const { out, client } = await asUser(IDS.contractor1, async (c) => {
      await c.query(`update public.contractors set verification_status='verified' where id=$1`, [IDS.contractorApproved]);
      const r = await c.query(`select verification_status from public.contractors where id=$1`, [IDS.contractorApproved]);
      return r.rows[0].verification_status;
    });
    await rollback(client);
    assert(out === 'unverified', `expected 'unverified' (locked), got ${out}`);
  });

  await test('B4', 'Cannot change own plan_tier', async () => {
    const { out, client } = await asUser(IDS.contractor1, async (c) => {
      await c.query(`update public.contractors set plan_tier='premium' where id=$1`, [IDS.contractorApproved]);
      const r = await c.query(`select plan_tier from public.contractors where id=$1`, [IDS.contractorApproved]);
      return r.rows[0].plan_tier;
    });
    await rollback(client);
    assert(out === 'free', `expected 'free' (locked), got ${out}`);
  });

  await test('B5', 'Cannot change own featured_until', async () => {
    const { out, client } = await asUser(IDS.contractor1, async (c) => {
      await c.query(`update public.contractors set featured_until=now() + interval '30 days' where id=$1`, [IDS.contractorApproved]);
      const r = await c.query(`select featured_until from public.contractors where id=$1`, [IDS.contractorApproved]);
      return r.rows[0].featured_until;
    });
    await rollback(client);
    assert(out === null, `expected featured_until to stay null (locked), got ${out}`);
  });

  await test('B6', "Cannot UPDATE a different contractor's row", async () => {
    const { out, client } = await asUser(IDS.contractor1, async (c) => {
      const r = await c.query(`update public.contractors set business_name='pwned' where id=$1`, [IDS.contractorPending]);
      return r.rowCount;
    });
    await rollback(client);
    assert(out === 0, `expected 0 rows affected on other contractor's row, got ${out}`);
  });

  await test('B7', "Cannot change own profiles.role to 'admin'", async () => {
    const { out, client } = await asUser(IDS.contractor1, async (c) => {
      await c.query(`update public.profiles set role='admin' where id=$1`, [IDS.contractor1]);
      const r = await c.query(`select role from public.profiles where id=$1`, [IDS.contractor1]);
      return r.rows[0].role;
    });
    await rollback(client);
    assert(out === 'contractor', `expected role still 'contractor' (locked), got ${out}`);
  });

  await test('B8', 'Can INSERT/UPDATE/DELETE own portfolio_images', async () => {
    const { out, client } = await asUser(IDS.contractor1, async (c) => {
      const ins = await c.query(
        `insert into public.portfolio_images (contractor_id, image_url, thumbnail_url) values ($1,'https://x/img.jpg','https://x/thumb.jpg') returning id`,
        [IDS.contractorApproved]
      );
      const id = ins.rows[0].id;
      const upd = await c.query(`update public.portfolio_images set project_name='Test Project' where id=$1`, [id]);
      const del = await c.query(`delete from public.portfolio_images where id=$1`, [id]);
      return { insertRows: ins.rowCount, updateRows: upd.rowCount, deleteRows: del.rowCount };
    });
    await rollback(client);
    assert(out.insertRows === 1 && out.updateRows === 1 && out.deleteRows === 1, `expected all ops to succeed, got ${JSON.stringify(out)}`);
  });

  await test('B9', "Cannot touch another contractor's portfolio_images", async () => {
    // seed one image on contractorPending as service_role first, then try to touch as contractor1
    const seeded = await asServiceRole(async (c) => {
      const r = await c.query(
        `insert into public.portfolio_images (contractor_id, image_url, thumbnail_url) values ($1,'https://x/other.jpg','https://x/other-thumb.jpg') returning id`,
        [IDS.contractorPending]
      );
      return r.rows[0].id;
    });
    await commit(seeded.client);
    const imageId = seeded.out;

    const { out, client } = await asUser(IDS.contractor1, async (c) => {
      const upd = await c.query(`update public.portfolio_images set project_name='pwned' where id=$1`, [imageId]);
      const del = await c.query(`delete from public.portfolio_images where id=$1`, [imageId]);
      return { updateRows: upd.rowCount, deleteRows: del.rowCount };
    });
    await rollback(client);

    // cleanup the seeded row
    const cleanup = await asServiceRole(async (c) => {
      await c.query(`delete from public.portfolio_images where id=$1`, [imageId]);
    });
    await commit(cleanup.client);

    assert(out.updateRows === 0 && out.deleteRows === 0, `expected 0 rows touched, got ${JSON.stringify(out)}`);
  });

  await test('B10', 'Can INSERT a reviews row for a different contractor (as reviewer)', async () => {
    const { out, client } = await asUser(IDS.contractor2, async (c) => {
      const r = await c.query(
        `insert into public.reviews (contractor_id, reviewer_id, rating) values ($1,$2,4) returning id`,
        [IDS.contractorApproved, IDS.contractor2]
      );
      return r.rowCount;
    });
    await rollback(client);
    assert(out === 1, 'expected review insert to succeed');
  });

  await test('B11', 'Cannot INSERT a second review for the same (contractor, reviewer)', async () => {
    const { out, client } = await asUser(IDS.customer1, async (c) => {
      try {
        await c.query(
          `insert into public.reviews (contractor_id, reviewer_id, rating) values ($1,$2,1)`,
          [IDS.contractorApproved, IDS.customer1]
        );
        return 'inserted';
      } catch (e) {
        return e;
      }
    });
    await rollback(client);
    assert(out instanceof Error && /unique/i.test(out.message), `expected unique violation, got ${out}`);
  });

  await test('B12', 'Cannot UPDATE/DELETE own posted review', async () => {
    const { out, client } = await asUser(IDS.customer1, async (c) => {
      const upd = await c.query(`update public.reviews set comment='edited' where id=$1`, [IDS.review1]);
      const del = await c.query(`delete from public.reviews where id=$1`, [IDS.review1]);
      return { updateRows: upd.rowCount, deleteRows: del.rowCount };
    });
    await rollback(client);
    assert(out.updateRows === 0 && out.deleteRows === 0, `expected 0 rows touched, got ${JSON.stringify(out)}`);
  });

  // =====================================================================
  section("C. Admin (authenticated, profiles.role = 'admin')");
  // =====================================================================

  await test('C1', "Can set any contractor's status", async () => {
    const { out, client } = await asUser(IDS.admin, async (c) => {
      const r = await c.query(`update public.contractors set status='suspended' where id=$1 returning status`, [IDS.contractorApproved]);
      return r.rows[0]?.status;
    });
    await rollback(client);
    assert(out === 'suspended', `expected admin to set status, got ${out}`);
  });

  await test('C2', "Can set any contractor's verification_status", async () => {
    const { out, client } = await asUser(IDS.admin, async (c) => {
      const r = await c.query(`update public.contractors set verification_status='verified' where id=$1 returning verification_status`, [IDS.contractorApproved]);
      return r.rows[0]?.verification_status;
    });
    await rollback(client);
    assert(out === 'verified', `expected admin to set verification_status, got ${out}`);
  });

  await test('C3', "Can set any contractor's plan_tier", async () => {
    const { out, client } = await asUser(IDS.admin, async (c) => {
      const r = await c.query(`update public.contractors set plan_tier='premium' where id=$1 returning plan_tier`, [IDS.contractorApproved]);
      return r.rows[0]?.plan_tier;
    });
    await rollback(client);
    assert(out === 'premium', `expected admin to set plan_tier, got ${out}`);
  });

  await test('C4', "Can set any contractor's featured_until", async () => {
    const { out, client } = await asUser(IDS.admin, async (c) => {
      const r = await c.query(`update public.contractors set featured_until=now() + interval '10 days' where id=$1 returning featured_until`, [IDS.contractorApproved]);
      return r.rows[0]?.featured_until;
    });
    await rollback(client);
    assert(out !== null, `expected admin to set featured_until, got ${out}`);
  });

  await test('C5', 'Can UPDATE/DELETE any reviews row (moderation)', async () => {
    const seeded = await asServiceRole(async (c) => {
      const r = await c.query(
        `insert into public.reviews (contractor_id, reviewer_id, rating, status) values ($1,$2,2,'active') returning id`,
        [IDS.contractorApproved, IDS.customer2]
      );
      return r.rows[0].id;
    });
    await commit(seeded.client);
    const disposableReviewId = seeded.out;

    const { out, client } = await asUser(IDS.admin, async (c) => {
      const upd = await c.query(`update public.reviews set status='flagged' where id=$1`, [IDS.review1]);
      const del = await c.query(`delete from public.reviews where id=$1`, [disposableReviewId]);
      return { updateRows: upd.rowCount, deleteRows: del.rowCount };
    });
    await rollback(client);

    const cleanup = await asServiceRole(async (c) => {
      await c.query(`delete from public.reviews where id=$1`, [disposableReviewId]);
    });
    await commit(cleanup.client);

    assert(
      out.updateRows === 1 && out.deleteRows === 1,
      `expected admin moderation update+delete to succeed, got ${JSON.stringify(out)}`
    );
  });

  await test('C6', 'Can SELECT/UPDATE any reports row', async () => {
    // seed a report as service_role first
    const seeded = await asServiceRole(async (c) => {
      const r = await c.query(`insert into public.reports (contractor_id, reason) values ($1,'test') returning id`, [IDS.contractorApproved]);
      return r.rows[0].id;
    });
    await commit(seeded.client);
    const reportId = seeded.out;

    const { out, client } = await asUser(IDS.admin, async (c) => {
      const sel = await c.query(`select * from public.reports where id=$1`, [reportId]);
      const upd = await c.query(`update public.reports set status='reviewed' where id=$1 returning status`, [reportId]);
      return { selectRows: sel.rowCount, newStatus: upd.rows[0]?.status };
    });
    await rollback(client);

    const cleanup = await asServiceRole(async (c) => {
      await c.query(`delete from public.reports where id=$1`, [reportId]);
    });
    await commit(cleanup.client);

    assert(out.selectRows === 1 && out.newStatus === 'reviewed', `expected admin report access to work, got ${JSON.stringify(out)}`);
  });

  await test('C7', 'Can SELECT/INSERT/UPDATE system_settings directly, incl. non-is_public rows', async () => {
    const { out, client } = await asUser(IDS.admin, async (c) => {
      const sel = await c.query(`select * from public.system_settings`);
      const ins = await c.query(
        `insert into public.system_settings (key, value, is_public) values ('admin_only_test_key','1',false) returning key`
      );
      const upd = await c.query(`update public.system_settings set value='2' where key='admin_only_test_key' returning value`);
      return { selectRows: sel.rowCount, insertedKey: ins.rows[0]?.key, updatedValue: upd.rows[0]?.value };
    });
    await rollback(client);
    assert(out.selectRows === 4 && out.insertedKey === 'admin_only_test_key' && out.updatedValue == 2, `unexpected: ${JSON.stringify(out)}`);
  });

  await test('C8', 'Can SELECT from admin_actions', async () => {
    const seeded = await asServiceRole(async (c) => {
      const r = await c.query(
        `insert into public.admin_actions (admin_id, action, target_type, target_id) values ($1,'test_action','contractor',$2) returning id`,
        [IDS.admin, IDS.contractorApproved]
      );
      return r.rows[0].id;
    });
    await commit(seeded.client);
    const actionId = seeded.out;

    const { out, client } = await asUser(IDS.admin, async (c) => {
      const r = await c.query(`select * from public.admin_actions where id=$1`, [actionId]);
      return r.rowCount;
    });
    await rollback(client);

    const cleanup = await asServiceRole(async (c) => {
      await c.query(`delete from public.admin_actions where id=$1`, [actionId]);
    });
    await commit(cleanup.client);

    assert(out === 1, `expected admin to see admin_actions row, got ${out}`);
  });

  await test('C9', 'is_admin() is true for admin session, false for a different non-admin user', async () => {
    const adminCtx = await asUser(IDS.admin, async (c) => {
      const r = await c.query(`select public.is_admin() as v`);
      return r.rows[0].v;
    });
    await rollback(adminCtx.client);

    const custCtx = await asUser(IDS.customer1, async (c) => {
      const r = await c.query(`select public.is_admin() as v`);
      return r.rows[0].v;
    });
    await rollback(custCtx.client);

    assert(adminCtx.out === true, `expected is_admin()=true for admin, got ${adminCtx.out}`);
    assert(custCtx.out === false, `expected is_admin()=false for non-admin, got ${custCtx.out}`);
  });

  // =====================================================================
  section('D. Service role (bypasses RLS entirely)');
  // =====================================================================

  await test('D1', 'service_role can perform trusted admin operations without RLS denial', async () => {
    const { out, client } = await asServiceRole(async (c) => {
      const r = await c.query(`update public.contractors set status='approved' where status='pending' returning id`);
      return r.rowCount;
    });
    await rollback(client);
    assert(out >= 1, `expected service_role bulk update to affect rows, got ${out}`);
  });

  await test('D2', 'service_role update of locked contractor fields is NOT blocked by trg_contractors_lock_admin_fields', async () => {
    const { out, client } = await asServiceRole(async (c) => {
      const r = await c.query(
        `update public.contractors set status='approved', verification_status='verified', plan_tier='premium', featured_until=now() where id=$1 returning status, verification_status, plan_tier, featured_until`,
        [IDS.contractorPending]
      );
      return r.rows[0];
    });
    await rollback(client);
    assert(
      out.status === 'approved' && out.verification_status === 'verified' && out.plan_tier === 'premium' && out.featured_until !== null,
      `expected service_role to bypass the lock trigger, got ${JSON.stringify(out)}`
    );
  });

  await test('D3', 'service_role update of profiles.role is NOT blocked by trg_profiles_lock_role', async () => {
    const { out, client } = await asServiceRole(async (c) => {
      const r = await c.query(`update public.profiles set role='admin' where id=$1 returning role`, [IDS.customer2]);
      return r.rows[0]?.role;
    });
    await rollback(client);
    assert(out === 'admin', `expected service_role to bypass the role lock trigger, got ${out}`);
  });

  // =====================================================================
  section('E. Reports');
  // =====================================================================

  await test('E1', 'Cannot INSERT reports referencing a nonexistent contractor_id (FK violation)', async () => {
    const { out, client } = await asAnon(async (c) => {
      try {
        await c.query(`insert into public.reports (contractor_id, reason) values (gen_random_uuid(),'x')`);
        return 'inserted';
      } catch (e) {
        return e;
      }
    });
    await rollback(client);
    assert(out instanceof Error && /foreign key/i.test(out.message), `expected FK violation, got ${out}`);
  });

  await test('E2', 'Cannot INSERT reports referencing a nonexistent review_id (FK violation)', async () => {
    const { out, client } = await asAnon(async (c) => {
      try {
        await c.query(`insert into public.reports (review_id, reason) values (gen_random_uuid(),'x')`);
        return 'inserted';
      } catch (e) {
        return e;
      }
    });
    await rollback(client);
    assert(out instanceof Error && /foreign key/i.test(out.message), `expected FK violation, got ${out}`);
  });

  await test('E3', 'Cannot INSERT reports with BOTH contractor_id and review_id set (CHECK violation)', async () => {
    const { out, client } = await asAnon(async (c) => {
      try {
        await c.query(
          `insert into public.reports (contractor_id, review_id, reason) values ($1,$2,'x')`,
          [IDS.contractorApproved, IDS.review1]
        );
        return 'inserted';
      } catch (e) {
        return e;
      }
    });
    await rollback(client);
    assert(
      out instanceof Error && /reports_exactly_one_target/i.test(out.message),
      `expected reports_exactly_one_target CHECK violation, got ${out}`
    );
  });

  await test('E4', 'Cannot INSERT reports with NEITHER contractor_id nor review_id set (CHECK violation)', async () => {
    const { out, client } = await asAnon(async (c) => {
      try {
        await c.query(`insert into public.reports (reason) values ('x')`);
        return 'inserted';
      } catch (e) {
        return e;
      }
    });
    await rollback(client);
    assert(
      out instanceof Error && /reports_exactly_one_target/i.test(out.message),
      `expected reports_exactly_one_target CHECK violation, got ${out}`
    );
  });

  await test('E5', 'Deleting a contractors row cascades to delete reports pointing at it', async () => {
    const { out, client } = await asServiceRole(async (c) => {
      const contractorId = (
        await c.query(
          `insert into public.contractors (user_id, business_name, slug, status) values ($1,'Temp Co','temp-co-e5','approved') returning id`,
          [IDS.customer2]
        )
      ).rows[0].id;
      const reportId = (
        await c.query(`insert into public.reports (contractor_id, reason) values ($1,'x') returning id`, [contractorId])
      ).rows[0].id;
      await c.query(`delete from public.contractors where id=$1`, [contractorId]);
      const stillThere = await c.query(`select 1 from public.reports where id=$1`, [reportId]);
      return stillThere.rowCount;
    });
    await rollback(client);
    assert(out === 0, `expected report to be cascade-deleted, got ${out} remaining`);
  });

  await test('E6', 'Deleting a reviews row cascades to delete reports pointing at it', async () => {
    const { out, client } = await asServiceRole(async (c) => {
      const reviewId = (
        await c.query(
          `insert into public.reviews (contractor_id, reviewer_id, rating) values ($1,$2,3) returning id`,
          [IDS.contractorApproved, IDS.customer2]
        )
      ).rows[0].id;
      const reportId = (
        await c.query(`insert into public.reports (review_id, reason) values ($1,'x') returning id`, [reviewId])
      ).rows[0].id;
      await c.query(`delete from public.reviews where id=$1`, [reviewId]);
      const stillThere = await c.query(`select 1 from public.reports where id=$1`, [reportId]);
      return stillThere.rowCount;
    });
    await rollback(client);
    assert(out === 0, `expected report to be cascade-deleted, got ${out} remaining`);
  });

  // =====================================================================
  section('F. Denormalized field integrity');
  // =====================================================================

  await test('F1', "Inserting an active review updates parent contractor's rating_avg/review_count", async () => {
    const { out, client } = await asServiceRole(async (c) => {
      const contractorId = (
        await c.query(
          `insert into public.contractors (user_id, business_name, slug, status) values ($1,'F1 Co','f1-co','approved') returning id`,
          [IDS.customer2]
        )
      ).rows[0].id;
      await c.query(
        `insert into public.reviews (contractor_id, reviewer_id, rating, status) values ($1,$2,4,'active')`,
        [contractorId, IDS.customer1]
      );
      const r = await c.query(`select rating_avg, review_count from public.contractors where id=$1`, [contractorId]);
      return r.rows[0];
    });
    await rollback(client);
    assert(
      Number(out.rating_avg) === 4 && Number(out.review_count) === 1,
      `expected rating_avg=4, review_count=1, got ${JSON.stringify(out)}`
    );
  });

  await test('F2', "Setting a review's status to flagged/removed recomputes contractor stats to exclude it", async () => {
    const { out, client } = await asServiceRole(async (c) => {
      const contractorId = (
        await c.query(
          `insert into public.contractors (user_id, business_name, slug, status) values ($1,'F2 Co','f2-co','approved') returning id`,
          [IDS.customer2]
        )
      ).rows[0].id;
      const reviewId = (
        await c.query(
          `insert into public.reviews (contractor_id, reviewer_id, rating, status) values ($1,$2,5,'active') returning id`,
          [contractorId, IDS.customer1]
        )
      ).rows[0].id;
      await c.query(`update public.reviews set status='flagged' where id=$1`, [reviewId]);
      const r = await c.query(`select rating_avg, review_count from public.contractors where id=$1`, [contractorId]);
      return r.rows[0];
    });
    await rollback(client);
    assert(
      Number(out.rating_avg) === 0 && Number(out.review_count) === 0,
      `expected rating_avg=0, review_count=0 after flagging, got ${JSON.stringify(out)}`
    );
  });

  await test('F3', 'Manually corrupting rating_avg is overwritten back by the trigger on the next review change', async () => {
    const { out, client } = await asServiceRole(async (c) => {
      const contractorId = (
        await c.query(
          `insert into public.contractors (user_id, business_name, slug, status) values ($1,'F3 Co','f3-co','approved') returning id`,
          [IDS.customer2]
        )
      ).rows[0].id;
      await c.query(
        `insert into public.reviews (contractor_id, reviewer_id, rating, status) values ($1,$2,3,'active') returning id`,
        [contractorId, IDS.customer1]
      );
      await c.query(`update public.contractors set rating_avg=4.9 where id=$1`, [contractorId]);
      const corrupted = await c.query(`select rating_avg from public.contractors where id=$1`, [contractorId]);
      // trigger any review change to force recompute
      await c.query(
        `insert into public.reviews (contractor_id, reviewer_id, rating, status) values ($1,$2,3,'active')`,
        [contractorId, IDS.customer2]
      );
      const recomputed = await c.query(`select rating_avg from public.contractors where id=$1`, [contractorId]);
      return { corrupted: Number(corrupted.rows[0].rating_avg), recomputed: Number(recomputed.rows[0].rating_avg) };
    });
    await rollback(client);
    assert(
      out.corrupted === 4.9 && out.recomputed === 3,
      `expected manual value to be overwritten back to computed avg, got ${JSON.stringify(out)}`
    );
  });

  await test('F4', 'Adding a portfolio_images row to a contractor with no prior images increases profile_completeness', async () => {
    const { out, client } = await asServiceRole(async (c) => {
      const contractorId = (
        await c.query(
          `insert into public.contractors (user_id, business_name, slug, status) values ($1,'F4 Co','f4-co','approved') returning id, profile_completeness`,
          [IDS.customer2]
        )
      ).rows[0];
      const before = contractorId.profile_completeness;
      await c.query(
        `insert into public.portfolio_images (contractor_id, image_url, thumbnail_url) values ($1,'https://x/a.jpg','https://x/a-thumb.jpg')`,
        [contractorId.id]
      );
      await c.query(`update public.contractors set updated_at=now() where id=$1`, [contractorId.id]);
      const after = await c.query(`select profile_completeness from public.contractors where id=$1`, [contractorId.id]);
      return { before, after: after.rows[0].profile_completeness };
    });
    await rollback(client);
    assert(out.after > out.before, `expected profile_completeness to increase, got ${JSON.stringify(out)}`);
  });

  // =====================================================================
  section('G. Phase 3 — authentication-flow scenarios (current-user retrieval, session-scoped access)');
  // =====================================================================
  // These specifically exercise the shape of queries authService.ts's
  // getCurrentUser()/signUpContractor() issue — same SET ROLE +
  // request.jwt.claims mechanism as sections A-F, just scoped to what
  // Phase 3 added on top of the already-verified Phase 2 RLS matrix.

  await test('G1', "authenticated customer's current-user retrieval returns exactly their own profile row", async () => {
    const { out, client } = await asUser(IDS.customer1, async (c) => {
      const r = await c.query(`select * from public.profiles where id=$1`, [IDS.customer1]);
      return r.rows;
    });
    await rollback(client);
    assert(
      out.length === 1 && out[0].id === IDS.customer1 && out[0].role === 'customer',
      `expected exactly the caller's own profile row, got ${JSON.stringify(out)}`
    );
  });

  await test('G2', "authenticated customer cannot retrieve a DIFFERENT user's profile row", async () => {
    const { out, client } = await asUser(IDS.customer1, async (c) => {
      const r = await c.query(`select * from public.profiles where id=$1`, [IDS.customer2]);
      return r.rowCount;
    });
    await rollback(client);
    assert(out === 0, `expected 0 rows (RLS-hidden), got ${out}`);
  });

  await test('G3', 'authenticated customer cannot SELECT admin_actions (admin-only data)', async () => {
    const { out, client } = await asUser(IDS.customer1, async (c) => {
      const r = await c.query(`select * from public.admin_actions`);
      return r.rowCount;
    });
    await rollback(client);
    assert(out === 0, `expected 0 admin_actions rows visible to customer, got ${out}`);
  });

  await test('G4', 'authenticated customer cannot SELECT reports (admin-only data)', async () => {
    const { out, client } = await asUser(IDS.customer1, async (c) => {
      const r = await c.query(`select * from public.reports`);
      return r.rowCount;
    });
    await rollback(client);
    assert(out === 0, `expected 0 reports rows visible to customer, got ${out}`);
  });

  await test('G5', 'authenticated customer cannot SELECT system_settings directly (admin-only table access)', async () => {
    const { out, client } = await asUser(IDS.customer1, async (c) => {
      const r = await c.query(`select * from public.system_settings`);
      return r.rowCount;
    });
    await rollback(client);
    assert(out === 0, `expected 0 system_settings rows visible to customer directly, got ${out}`);
  });

  await test(
    'G6',
    "authenticated contractor cannot retrieve another contractor's row that is neither approved nor theirs",
    async () => {
      // contractor1 (owns the APPROVED contractor) probing contractor2's
      // PENDING contractor row, which contractor1 does not own.
      const { out, client } = await asUser(IDS.contractor1, async (c) => {
        const r = await c.query(`select * from public.contractors where id=$1`, [IDS.contractorPending]);
        return r.rowCount;
      });
      await rollback(client);
      assert(out === 0, `expected pending, non-owned contractor row hidden, got ${out} rows`);
    }
  );

  await test(
    'G7',
    'promoteNewAccountToContractor-equivalent role change is rejected for a non-trusted authenticated caller',
    async () => {
      // Mirrors authService.promoteNewAccountToContractor, but attempted
      // as the authenticated user themself rather than via service_role —
      // must be rejected by trg_profiles_lock_role, proving the
      // application code has no alternative path around it.
      const { out, client } = await asUser(IDS.customer2, async (c) => {
        await c.query(`update public.profiles set role='contractor' where id=$1`, [IDS.customer2]);
        const r = await c.query(`select role from public.profiles where id=$1`, [IDS.customer2]);
        return r.rows[0].role;
      });
      await rollback(client);
      assert(out === 'customer', `expected role to stay 'customer' (self-promotion blocked), got ${out}`);
    }
  );

  await test(
    'G8',
    'promoteNewAccountToContractor via service_role (the real code path) succeeds, scoped to one user',
    async () => {
      // Exercises the exact statement authService.promoteNewAccountToContractor
      // issues, against a disposable account, then reverts it.
      const seeded = await asServiceRole(async (c) => {
        const id = (
          await c.query(
            `insert into auth.users (email, raw_user_meta_data) values ('g8@test.local','{}') returning id`
          )
        ).rows[0].id;
        return id;
      });
      await commit(seeded.client);
      const newUserId = seeded.out;

      const { out, client } = await asServiceRole(async (c) => {
        await c.query(`update public.profiles set role='contractor' where id=$1`, [newUserId]);
        const r = await c.query(`select role from public.profiles where id=$1`, [newUserId]);
        return r.rows[0].role;
      });
      await commit(client);

      const cleanup = await asServiceRole(async (c) => {
        await c.query(`delete from auth.users where id=$1`, [newUserId]);
      });
      await commit(cleanup.client);

      assert(out === 'contractor', `expected service_role promotion to succeed, got ${out}`);
    }
  );

  // =====================================================================
  section('H. Phase 9 — review submission/visibility (0014_reviews_hardening.sql)');
  // =====================================================================

  await test('H1', 'anon cannot INSERT a review (no auth.uid() to satisfy WITH CHECK)', async () => {
    const { out, client } = await asAnon(async (c) => {
      try {
        await c.query(
          `insert into public.reviews (contractor_id, reviewer_id, rating, comment) values ($1,$2,5,'anon spoof attempt')`,
          [IDS.contractorApproved, IDS.customer2]
        );
        return 'inserted';
      } catch (e) {
        return e;
      }
    });
    await rollback(client);
    assert(out instanceof Error && /row-level security/i.test(out.message), `expected RLS rejection, got ${out}`);
  });

  await test('H2', 'authenticated user cannot spoof reviewer_id as someone else', async () => {
    // Logged in as customer2, but the row claims customer1 wrote it.
    const { out, client } = await asUser(IDS.customer2, async (c) => {
      try {
        await c.query(
          `insert into public.reviews (contractor_id, reviewer_id, rating, comment) values ($1,$2,5,'identity spoof attempt here')`,
          [IDS.contractorApproved, IDS.customer1]
        );
        return 'inserted';
      } catch (e) {
        return e;
      }
    });
    await rollback(client);
    assert(out instanceof Error && /row-level security/i.test(out.message), `expected RLS rejection, got ${out}`);
  });

  await test('H3', 'authenticated user cannot review a PENDING contractor (0014 policy)', async () => {
    const { out, client } = await asUser(IDS.customer2, async (c) => {
      try {
        await c.query(
          `insert into public.reviews (contractor_id, reviewer_id, rating, comment) values ($1,$2,4,'reviewing a pending contractor')`,
          [IDS.contractorPending, IDS.customer2]
        );
        return 'inserted';
      } catch (e) {
        return e;
      }
    });
    await rollback(client);
    assert(out instanceof Error && /row-level security/i.test(out.message), `expected RLS rejection, got ${out}`);
  });

  await test('H4', 'CHECK constraint rejects an out-of-range rating (0 and 6)', async () => {
    // Each bad value gets its own transaction — Postgres aborts the
    // whole transaction after the first constraint violation, so a
    // second query in the same one would just fail with "current
    // transaction is aborted" rather than actually re-testing anything.
    const attempts = [];
    for (const badRating of [0, 6]) {
      const { out, client } = await asUser(IDS.customer2, async (c) => {
        try {
          await c.query(
            `insert into public.reviews (contractor_id, reviewer_id, rating) values ($1,$2,$3)`,
            [IDS.contractorApproved, IDS.customer2, badRating]
          );
          return `accepted:${badRating}`;
        } catch (e) {
          return /check constraint/i.test(e.message) ? 'rejected' : `other-error:${e.message}`;
        }
      });
      await rollback(client);
      attempts.push(out);
    }
    assert(
      attempts.every((a) => a === 'rejected'),
      `expected both out-of-range ratings rejected by CHECK, got ${JSON.stringify(attempts)}`
    );
  });

  await test('H5', 'CHECK constraint rejects a comment over 2000 characters (0014 policy)', async () => {
    const { out, client } = await asUser(IDS.customer2, async (c) => {
      try {
        await c.query(
          `insert into public.reviews (contractor_id, reviewer_id, rating, comment) values ($1,$2,4,$3)`,
          [IDS.contractorApproved, IDS.customer2, 'x'.repeat(2001)]
        );
        return 'inserted';
      } catch (e) {
        return e;
      }
    });
    await rollback(client);
    assert(
      out instanceof Error && /reviews_comment_length/i.test(out.message),
      `expected reviews_comment_length CHECK rejection, got ${out}`
    );
  });

  await test(
    'H6',
    'a review on a contractor later suspended is hidden from anon/public but stays visible to its own reviewer (0014 policy)',
    async () => {
      const seeded = await asServiceRole(async (c) => {
        const contractorId = (
          await c.query(
            `insert into public.contractors (user_id, business_name, slug, status) values ($1,'H6 Co','h6-co','approved') returning id`,
            [IDS.customer2]
          )
        ).rows[0].id;
        await c.query(
          `insert into public.reviews (contractor_id, reviewer_id, rating, comment, status) values ($1,$2,5,'great before suspension','active')`,
          [contractorId, IDS.customer1]
        );
        return contractorId;
      });
      await commit(seeded.client);
      const contractorId = seeded.out;

      try {
        const beforeSuspend = await asAnon(async (c) => {
          const r = await c.query(`select id from public.reviews where contractor_id=$1`, [contractorId]);
          return r.rowCount;
        });
        await rollback(beforeSuspend.client);

        const suspend = await asServiceRole(async (c) => {
          await c.query(`update public.contractors set status='suspended' where id=$1`, [contractorId]);
        });
        await commit(suspend.client);

        const afterSuspendAnon = await asAnon(async (c) => {
          const r = await c.query(`select id from public.reviews where contractor_id=$1`, [contractorId]);
          return r.rowCount;
        });
        await rollback(afterSuspendAnon.client);

        const afterSuspendOwnReviewer = await asUser(IDS.customer1, async (c) => {
          const r = await c.query(`select id from public.reviews where contractor_id=$1`, [contractorId]);
          return r.rowCount;
        });
        await rollback(afterSuspendOwnReviewer.client);

        assert(beforeSuspend.out === 1, `expected review visible to anon while approved, got ${beforeSuspend.out}`);
        assert(afterSuspendAnon.out === 0, `expected review hidden from anon after suspension, got ${afterSuspendAnon.out}`);
        assert(
          afterSuspendOwnReviewer.out === 1,
          `expected the reviewer to still see their own review after suspension, got ${afterSuspendOwnReviewer.out}`
        );
      } finally {
        const cleanup = await asServiceRole(async (c) => {
          await c.query(`delete from public.reviews where contractor_id=$1`, [contractorId]);
          await c.query(`delete from public.contractors where id=$1`, [contractorId]);
        });
        await commit(cleanup.client);
      }
    }
  );

  await test(
    'H7',
    'admin can SELECT a review belonging to a non-approved contractor; anon cannot',
    async () => {
      const seeded = await asServiceRole(async (c) => {
        await c.query(
          `insert into public.reviews (contractor_id, reviewer_id, rating, comment, status) values ($1,$2,3,'admin visibility check','active')`,
          [IDS.contractorPending, IDS.customer2]
        );
      });
      await commit(seeded.client);

      try {
        const asAdminResult = await asUser(IDS.admin, async (c) => {
          const r = await c.query(`select id from public.reviews where contractor_id=$1`, [IDS.contractorPending]);
          return r.rowCount;
        });
        await rollback(asAdminResult.client);

        const asAnonResult = await asAnon(async (c) => {
          const r = await c.query(`select id from public.reviews where contractor_id=$1`, [IDS.contractorPending]);
          return r.rowCount;
        });
        await rollback(asAnonResult.client);

        assert(asAdminResult.out === 1, `expected admin to see the review, got ${asAdminResult.out} rows`);
        assert(asAnonResult.out === 0, `expected anon to NOT see the review, got ${asAnonResult.out} rows`);
      } finally {
        const cleanup = await asServiceRole(async (c) => {
          await c.query(`delete from public.reviews where contractor_id=$1 and reviewer_id=$2`, [
            IDS.contractorPending,
            IDS.customer2,
          ]);
        });
        await commit(cleanup.client);
      }
    }
  );

  await test(
    'H8',
    'a reviewer cannot UPDATE their own review (documented policy — see reviews_admin_moderate, 0013_rls_policies.sql: "Reviewers cannot edit/delete their own review once posted")',
    async () => {
      const { out, client } = await asUser(IDS.customer1, async (c) => {
        const r = await c.query(`update public.reviews set rating=1 where id=$1`, [IDS.review1]);
        return r.rowCount;
      });
      await commit(client);
      assert(out === 0, `expected the review's own author to be unable to update it, matched ${out} rows`);
      const stillOriginal = await asServiceRole(async (c) => (await c.query(`select rating from public.reviews where id=$1`, [IDS.review1])).rows[0].rating);
      await rollback(stillOriginal.client);
      assert(stillOriginal.out !== 1, 'expected the review rating to be unchanged (update should have matched 0 rows)');
    }
  );

  await test(
    'H9',
    "a different non-admin user cannot UPDATE someone else's review (IDOR/BOLA)",
    async () => {
      const { out, client } = await asUser(IDS.customer2, async (c) => {
        const r = await c.query(`update public.reviews set comment='hacked' where id=$1`, [IDS.review1]);
        return r.rowCount;
      });
      await commit(client);
      assert(out === 0, `expected a non-owner, non-admin UPDATE to match 0 rows, got ${out}`);
    }
  );

  await test(
    'H10',
    'no non-admin user (owner or otherwise) can DELETE a review directly (only admin moderation can remove one)',
    async () => {
      const ownerAttempt = await asUser(IDS.customer1, async (c) => {
        const r = await c.query(`delete from public.reviews where id=$1`, [IDS.review1]);
        return r.rowCount;
      });
      await commit(ownerAttempt.client);
      const strangerAttempt = await asUser(IDS.customer2, async (c) => {
        const r = await c.query(`delete from public.reviews where id=$1`, [IDS.review1]);
        return r.rowCount;
      });
      await commit(strangerAttempt.client);
      assert(ownerAttempt.out === 0, `expected the review's own author to be unable to delete it, matched ${ownerAttempt.out} rows`);
      assert(strangerAttempt.out === 0, `expected a non-owner to be unable to delete it, matched ${strangerAttempt.out} rows`);
      const stillThere = await asServiceRole(async (c) => (await c.query(`select id from public.reviews where id=$1`, [IDS.review1])).rowCount);
      await rollback(stillThere.client);
      assert(stillThere.out === 1, 'expected the review to still exist after both rejected delete attempts');
    }
  );

  await test('H11', "admin CAN moderate (UPDATE the status of) another user's review", async () => {
    const seeded = await asServiceRole(async (c) => {
      return (
        await c.query(
          `insert into public.reviews (contractor_id, reviewer_id, rating, comment, status) values ($1,$2,4,'to be moderated','active') returning id`,
          [IDS.contractorApproved, IDS.customer2]
        )
      ).rows[0].id;
    });
    await commit(seeded.client);
    const reviewId = seeded.out;
    try {
      const { out, client } = await asUser(IDS.admin, async (c) => {
        const r = await c.query(`update public.reviews set status='flagged' where id=$1`, [reviewId]);
        return r.rowCount;
      });
      await commit(client);
      assert(out === 1, `expected admin moderation UPDATE to affect 1 row, got ${out}`);
    } finally {
      const cleanup = await asServiceRole(async (c) => {
        await c.query(`delete from public.reviews where id=$1`, [reviewId]);
      });
      await commit(cleanup.client);
    }
  });

  await test('H12', "admin CAN DELETE another user's review", async () => {
    const seeded = await asServiceRole(async (c) => {
      return (
        await c.query(
          `insert into public.reviews (contractor_id, reviewer_id, rating, comment, status) values ($1,$2,2,'to be deleted by admin','active') returning id`,
          [IDS.contractorApproved, IDS.customer2]
        )
      ).rows[0].id;
    });
    await commit(seeded.client);
    const reviewId = seeded.out;
    const { out, client } = await asUser(IDS.admin, async (c) => {
      const r = await c.query(`delete from public.reviews where id=$1`, [reviewId]);
      return r.rowCount;
    });
    await commit(client);
    assert(out === 1, `expected admin DELETE to affect 1 row, got ${out}`);
  });

  await test(
    'H13',
    "contractor_id manipulation: submitting a review against a contractor_id that doesn't exist is rejected",
    async () => {
      // reviews_insert_authenticated's WITH CHECK (0014) requires
      // `exists (select 1 from contractors where id = contractor_id and
      // status = 'approved')` — for a nonexistent id that's simply
      // false, so RLS itself rejects the row before the foreign key
      // constraint is ever reached (empirically: the actual error is
      // "row-level security policy", not "foreign key" — a stricter,
      // not weaker, outcome, so this asserts on either rejection class
      // rather than assuming a specific one).
      const { out, client } = await asUser(IDS.customer2, async (c) => {
        try {
          await c.query(
            `insert into public.reviews (contractor_id, reviewer_id, rating, comment) values ($1,$2,5,'fake contractor')`,
            ['99999999-9999-9999-9999-999999999999', IDS.customer2]
          );
          return 'inserted';
        } catch (e) {
          return e;
        }
      });
      await rollback(client);
      assert(
        out instanceof Error && /(foreign key|row-level security)/i.test(out.message),
        `expected a foreign-key or RLS rejection, got ${out}`
      );
    }
  );

  // =====================================================================
  section('I. Phase 10 — contact_events analytics (0016_contact_events_analytics.sql)');
  // =====================================================================
  //
  // Note on scope: the "prevent a caller from submitting analytics under
  // an identity that isn't theirs" class of check (relevant for reviews,
  // Section H) is vacuously satisfied here — contact_events has never
  // recorded any identity at all (no user id, no IP; founder decision,
  // PHASE 1, restated in the migration's own header comment), so there is
  // no identity field for a caller to spoof in the first place.

  await test('I1', 'anon cannot SELECT contact_events (contact_events_select_owner_or_admin, 0013)', async () => {
    const seeded = await asServiceRole(async (c) => {
      return (
        await c.query(
          `insert into public.contact_events (contractor_id, event_type) values ($1,'profile_view') returning id`,
          [IDS.contractorApproved]
        )
      ).rows[0].id;
    });
    await commit(seeded.client);
    const eventId = seeded.out;
    try {
      const { out, client } = await asAnon(async (c) => {
        const r = await c.query(`select id from public.contact_events where id=$1`, [eventId]);
        return r.rowCount;
      });
      await rollback(client);
      assert(out === 0, `expected anon to see 0 rows, got ${out}`);
    } finally {
      const cleanup = await asServiceRole(async (c) => {
        await c.query(`delete from public.contact_events where id=$1`, [eventId]);
      });
      await commit(cleanup.client);
    }
  });

  await test(
    'I2',
    'a logged-in non-owner cannot SELECT another contractor\'s contact_events',
    async () => {
      const seeded = await asServiceRole(async (c) => {
        return (
          await c.query(
            `insert into public.contact_events (contractor_id, event_type) values ($1,'profile_view') returning id`,
            [IDS.contractorApproved]
          )
        ).rows[0].id;
      });
      await commit(seeded.client);
      const eventId = seeded.out;
      try {
        // customer1 owns no contractor at all — definitely not this one.
        const { out, client } = await asUser(IDS.customer1, async (c) => {
          const r = await c.query(`select id from public.contact_events where id=$1`, [eventId]);
          return r.rowCount;
        });
        await rollback(client);
        assert(out === 0, `expected non-owner to see 0 rows, got ${out}`);
      } finally {
        const cleanup = await asServiceRole(async (c) => {
          await c.query(`delete from public.contact_events where id=$1`, [eventId]);
        });
        await commit(cleanup.client);
      }
    }
  );

  await test('I3', 'the contractor who owns the profile CAN SELECT its own contact_events', async () => {
    const seeded = await asServiceRole(async (c) => {
      return (
        await c.query(
          `insert into public.contact_events (contractor_id, event_type) values ($1,'profile_view') returning id`,
          [IDS.contractorApproved]
        )
      ).rows[0].id;
    });
    await commit(seeded.client);
    const eventId = seeded.out;
    try {
      // contractor1 owns contractorApproved (aaaa...01) — see IDS comment.
      const { out, client } = await asUser(IDS.contractor1, async (c) => {
        const r = await c.query(`select id from public.contact_events where id=$1`, [eventId]);
        return r.rowCount;
      });
      await rollback(client);
      assert(out === 1, `expected owner to see the row, got ${out}`);
    } finally {
      const cleanup = await asServiceRole(async (c) => {
        await c.query(`delete from public.contact_events where id=$1`, [eventId]);
      });
      await commit(cleanup.client);
    }
  });

  await test('I4', 'admin CAN SELECT contact_events for a contractor it does not own', async () => {
    const seeded = await asServiceRole(async (c) => {
      return (
        await c.query(
          `insert into public.contact_events (contractor_id, event_type) values ($1,'profile_view') returning id`,
          [IDS.contractorPending]
        )
      ).rows[0].id;
    });
    await commit(seeded.client);
    const eventId = seeded.out;
    try {
      const { out, client } = await asUser(IDS.admin, async (c) => {
        const r = await c.query(`select id from public.contact_events where id=$1`, [eventId]);
        return r.rowCount;
      });
      await rollback(client);
      assert(out === 1, `expected admin to see the row, got ${out}`);
    } finally {
      const cleanup = await asServiceRole(async (c) => {
        await c.query(`delete from public.contact_events where id=$1`, [eventId]);
      });
      await commit(cleanup.client);
    }
  });

  await test('I5', 'an invalid contractor_id is rejected by the foreign key', async () => {
    const { out, client } = await asAnon(async (c) => {
      try {
        await c.query(
          `insert into public.contact_events (contractor_id, event_type) values ($1,'profile_view')`,
          ['99999999-9999-9999-9999-999999999999']
        );
        return 'inserted';
      } catch (e) {
        return e;
      }
    });
    await rollback(client);
    assert(
      out instanceof Error && /foreign key/i.test(out.message),
      `expected foreign key violation, got ${out}`
    );
  });

  await test('I6', 'an invalid event_type is rejected by the CHECK constraint', async () => {
    const { out, client } = await asAnon(async (c) => {
      try {
        await c.query(
          `insert into public.contact_events (contractor_id, event_type) values ($1,'bogus')`,
          [IDS.contractorApproved]
        );
        return 'inserted';
      } catch (e) {
        return e;
      }
    });
    await rollback(client);
    assert(
      out instanceof Error && /contact_events_event_type_check/i.test(out.message),
      `expected contact_events_event_type_check rejection, got ${out}`
    );
  });

  await test('I7', "'website' is now a valid event_type (0016 widened the CHECK)", async () => {
    const { out, client } = await asAnon(async (c) => {
      const r = await c.query(
        `insert into public.contact_events (contractor_id, event_type) values ($1,'website')`,
        [IDS.contractorApproved]
      );
      return r.rowCount;
    });
    await rollback(client);
    assert(out === 1, 'expected the website event_type insert to succeed');
  });

  await test(
    'I8',
    'a real anon profile_view INSERT correctly increments contractors.profile_view_count via the SECURITY DEFINER trigger — proactive version of the review-stats bug Phase 9 found reactively (0015)',
    async () => {
      const { out, client } = await asAnon(async (c) => {
        const before = (
          await c.query(`select profile_view_count from public.contractors where id=$1`, [IDS.contractorApproved])
        ).rows[0].profile_view_count;
        await c.query(
          `insert into public.contact_events (contractor_id, event_type) values ($1,'profile_view')`,
          [IDS.contractorApproved]
        );
        const after = (
          await c.query(`select profile_view_count from public.contractors where id=$1`, [IDS.contractorApproved])
        ).rows[0].profile_view_count;
        return { before, after };
      });
      await rollback(client);
      assert(
        out.after === out.before + 1,
        `expected profile_view_count to increment by 1, got before=${out.before} after=${out.after}`
      );
    }
  );

  await test(
    'I9',
    'deleting a profile_view row correctly decrements contractors.profile_view_count back down',
    async () => {
      const { out, client } = await asServiceRole(async (c) => {
        const before = (
          await c.query(`select profile_view_count from public.contractors where id=$1`, [IDS.contractorApproved])
        ).rows[0].profile_view_count;
        const inserted = await c.query(
          `insert into public.contact_events (contractor_id, event_type) values ($1,'profile_view') returning id`,
          [IDS.contractorApproved]
        );
        const afterInsert = (
          await c.query(`select profile_view_count from public.contractors where id=$1`, [IDS.contractorApproved])
        ).rows[0].profile_view_count;
        await c.query(`delete from public.contact_events where id=$1`, [inserted.rows[0].id]);
        const afterDelete = (
          await c.query(`select profile_view_count from public.contractors where id=$1`, [IDS.contractorApproved])
        ).rows[0].profile_view_count;
        return { before, afterInsert, afterDelete };
      });
      await rollback(client);
      assert(
        out.afterInsert === out.before + 1 && out.afterDelete === out.before,
        `expected increment then decrement back to baseline, got ${JSON.stringify(out)}`
      );
    }
  );

  // =====================================================================
  section('J. Issue #23 — portfolio_images writes + the 20-image aggregate cap (0019_portfolio_image_limit.sql)');
  // =====================================================================
  //
  // Section H already covers reviews' "can't act under someone else's
  // identity" class of check; this section is portfolio_images' analog
  // for its OWN identity field (contractor_id), plus the aggregate
  // invariant (max 20 rows per contractor) that RLS structurally cannot
  // express — see 0019_portfolio_image_limit.sql's own header comment on
  // why that needed a trigger, not a policy. contractor1 owns
  // contractorApproved (aaaa...01); contractor2 owns contractorPending
  // (aaaa...02) — see the IDS comment at the top of this file.

  await test('J1', "a contractor cannot INSERT a portfolio image under ANOTHER contractor's contractor_id", async () => {
    const { out, client } = await asUser(IDS.contractor2, async (c) => {
      try {
        await c.query(
          `insert into public.portfolio_images (contractor_id, image_url, thumbnail_url) values ($1,'http://x/hack.jpg','http://x/hack.jpg')`,
          [IDS.contractorApproved]
        );
        return 'inserted';
      } catch (e) {
        return e;
      }
    });
    await rollback(client);
    assert(
      out instanceof Error && /row-level security/i.test(out.message),
      `expected an RLS rejection, got ${out}`
    );
  });

  await test('J2', "a contractor cannot DELETE another contractor's portfolio image", async () => {
    const seeded = await asServiceRole(async (c) => {
      return (
        await c.query(
          `insert into public.portfolio_images (contractor_id, image_url, thumbnail_url) values ($1,'http://x/j2.jpg','http://x/j2.jpg') returning id`,
          [IDS.contractorApproved]
        )
      ).rows[0].id;
    });
    await commit(seeded.client);
    const imageId = seeded.out;
    try {
      const { out, client } = await asUser(IDS.contractor2, async (c) => {
        const r = await c.query(`delete from public.portfolio_images where id=$1`, [imageId]);
        return r.rowCount;
      });
      await commit(client);
      assert(out === 0, `expected the cross-contractor DELETE to match 0 rows, got ${out}`);
      const stillThere = await asServiceRole(async (c) => (await c.query(`select id from public.portfolio_images where id=$1`, [imageId])).rowCount);
      await rollback(stillThere.client);
      assert(stillThere.out === 1, 'expected the row to still exist after the rejected cross-owner delete');
    } finally {
      const cleanup = await asServiceRole(async (c) => {
        await c.query(`delete from public.portfolio_images where id=$1`, [imageId]);
      });
      await commit(cleanup.client);
    }
  });

  await test('J3', "a contractor cannot UPDATE another contractor's portfolio image", async () => {
    const seeded = await asServiceRole(async (c) => {
      return (
        await c.query(
          `insert into public.portfolio_images (contractor_id, image_url, thumbnail_url) values ($1,'http://x/j3.jpg','http://x/j3.jpg') returning id`,
          [IDS.contractorApproved]
        )
      ).rows[0].id;
    });
    await commit(seeded.client);
    const imageId = seeded.out;
    try {
      const { out, client } = await asUser(IDS.contractor2, async (c) => {
        const r = await c.query(`update public.portfolio_images set project_name='hacked' where id=$1`, [imageId]);
        return r.rowCount;
      });
      await commit(client);
      assert(out === 0, `expected the cross-contractor UPDATE to match 0 rows, got ${out}`);
    } finally {
      const cleanup = await asServiceRole(async (c) => {
        await c.query(`delete from public.portfolio_images where id=$1`, [imageId]);
      });
      await commit(cleanup.client);
    }
  });

  await test('J4', 'a contractor CAN INSERT a portfolio image under their OWN contractor_id', async () => {
    const { out, client } = await asUser(IDS.contractor1, async (c) => {
      const r = await c.query(
        `insert into public.portfolio_images (contractor_id, image_url, thumbnail_url) values ($1,'http://x/j4.jpg','http://x/j4.jpg') returning id`,
        [IDS.contractorApproved]
      );
      return r.rows[0].id;
    });
    await commit(client);
    assert(typeof out === 'string', 'expected the owner insert to succeed and return an id');
    const cleanup = await asServiceRole(async (c) => {
      await c.query(`delete from public.portfolio_images where id=$1`, [out]);
    });
    await commit(cleanup.client);
  });

  await test('J5', 'a contractor CAN DELETE their OWN portfolio image', async () => {
    const seeded = await asServiceRole(async (c) => {
      return (
        await c.query(
          `insert into public.portfolio_images (contractor_id, image_url, thumbnail_url) values ($1,'http://x/j5.jpg','http://x/j5.jpg') returning id`,
          [IDS.contractorApproved]
        )
      ).rows[0].id;
    });
    await commit(seeded.client);
    const imageId = seeded.out;
    const { out, client } = await asUser(IDS.contractor1, async (c) => {
      const r = await c.query(`delete from public.portfolio_images where id=$1`, [imageId]);
      return r.rowCount;
    });
    await commit(client);
    assert(out === 1, `expected the owner delete to affect 1 row, got ${out}`);
  });

  await test('J6', 'anon cannot INSERT into portfolio_images at all', async () => {
    const { out, client } = await asAnon(async (c) => {
      try {
        await c.query(
          `insert into public.portfolio_images (contractor_id, image_url, thumbnail_url) values ($1,'http://x/anon.jpg','http://x/anon.jpg')`,
          [IDS.contractorApproved]
        );
        return 'inserted';
      } catch (e) {
        return e;
      }
    });
    await rollback(client);
    assert(out instanceof Error && /row-level security/i.test(out.message), `expected an RLS rejection, got ${out}`);
  });

  await test(
    'J7',
    'a pending contractor\'s portfolio images are NOT visible to anon (portfolio_images_select — approved-only branch)',
    async () => {
      const seeded = await asServiceRole(async (c) => {
        return (
          await c.query(
            `insert into public.portfolio_images (contractor_id, image_url, thumbnail_url) values ($1,'http://x/pending.jpg','http://x/pending.jpg') returning id`,
            [IDS.contractorPending]
          )
        ).rows[0].id;
      });
      await commit(seeded.client);
      const imageId = seeded.out;
      try {
        const { out, client } = await asAnon(async (c) => {
          const r = await c.query(`select id from public.portfolio_images where id=$1`, [imageId]);
          return r.rowCount;
        });
        await rollback(client);
        assert(out === 0, `expected anon to see 0 rows for a pending contractor's portfolio image, got ${out}`);
      } finally {
        const cleanup = await asServiceRole(async (c) => {
          await c.query(`delete from public.portfolio_images where id=$1`, [imageId]);
        });
        await commit(cleanup.client);
      }
    }
  );

  await test(
    'J8',
    'the pending contractor CAN still see (manage) their own portfolio images (owner branch of portfolio_images_select)',
    async () => {
      const seeded = await asServiceRole(async (c) => {
        return (
          await c.query(
            `insert into public.portfolio_images (contractor_id, image_url, thumbnail_url) values ($1,'http://x/own-pending.jpg','http://x/own-pending.jpg') returning id`,
            [IDS.contractorPending]
          )
        ).rows[0].id;
      });
      await commit(seeded.client);
      const imageId = seeded.out;
      try {
        const { out, client } = await asUser(IDS.contractor2, async (c) => {
          const r = await c.query(`select id from public.portfolio_images where id=$1`, [imageId]);
          return r.rowCount;
        });
        await rollback(client);
        assert(out === 1, `expected the pending contractor to see their own row, got ${out}`);
      } finally {
        const cleanup = await asServiceRole(async (c) => {
          await c.query(`delete from public.portfolio_images where id=$1`, [imageId]);
        });
        await commit(cleanup.client);
      }
    }
  );

  await test(
    'J9',
    'admin CAN insert/delete a portfolio image for a contractor it does not own (is_admin() override, portfolio_images_owner_write)',
    async () => {
      const inserted = await asUser(IDS.admin, async (c) => {
        const r = await c.query(
          `insert into public.portfolio_images (contractor_id, image_url, thumbnail_url) values ($1,'http://x/admin.jpg','http://x/admin.jpg') returning id`,
          [IDS.contractorApproved]
        );
        return r.rows[0].id;
      });
      await commit(inserted.client);
      const imageId = inserted.out;
      const deleted = await asUser(IDS.admin, async (c) => {
        const r = await c.query(`delete from public.portfolio_images where id=$1`, [imageId]);
        return r.rowCount;
      });
      await commit(deleted.client);
      assert(deleted.out === 1, `expected admin delete to affect 1 row, got ${deleted.out}`);
    }
  );

  await test(
    'J10',
    'trg_portfolio_images_enforce_limit rejects the 21st portfolio image for a contractor already at 20 — including for service_role',
    async () => {
      const before = await asServiceRole(async (c) => (await c.query(`select count(*)::int as n from public.portfolio_images where contractor_id=$1`, [IDS.contractorApproved])).rows[0].n);
      await rollback(before.client);
      const startCount = before.out;
      const toFill = 20 - startCount;
      assert(toFill >= 0, `test fixture assumption broken: contractor already has ${startCount} > 20 images`);

      const fillIds = [];
      const filled = await asServiceRole(async (c) => {
        for (let i = 0; i < toFill; i++) {
          const r = await c.query(
            `insert into public.portfolio_images (contractor_id, image_url, thumbnail_url) values ($1,$2,$2) returning id`,
            [IDS.contractorApproved, `http://x/fill-${i}.jpg`]
          );
          fillIds.push(r.rows[0].id);
        }
      });
      await commit(filled.client);

      try {
        const { out, client } = await asServiceRole(async (c) => {
          try {
            await c.query(
              `insert into public.portfolio_images (contractor_id, image_url, thumbnail_url) values ($1,'http://x/over-limit.jpg','http://x/over-limit.jpg')`,
              [IDS.contractorApproved]
            );
            return 'inserted';
          } catch (e) {
            return e;
          }
        });
        await rollback(client);
        assert(
          out instanceof Error && /already has 20 portfolio images/i.test(out.message),
          `expected the cap trigger to reject the 21st insert, got ${out}`
        );
      } finally {
        const cleanup = await asServiceRole(async (c) => {
          if (fillIds.length > 0) {
            await c.query(`delete from public.portfolio_images where id = any($1::uuid[])`, [fillIds]);
          }
        });
        await commit(cleanup.client);
      }
    }
  );

  await test(
    'J11',
    'trg_portfolio_images_enforce_limit allows exactly the 20th image (boundary, not off-by-one)',
    async () => {
      const before = await asServiceRole(async (c) => (await c.query(`select count(*)::int as n from public.portfolio_images where contractor_id=$1`, [IDS.contractorApproved])).rows[0].n);
      await rollback(before.client);
      const startCount = before.out;
      const toFill = 19 - startCount;
      assert(toFill >= 0, `test fixture assumption broken: contractor already has ${startCount} > 19 images`);

      const fillIds = [];
      const filled = await asServiceRole(async (c) => {
        for (let i = 0; i < toFill; i++) {
          const r = await c.query(
            `insert into public.portfolio_images (contractor_id, image_url, thumbnail_url) values ($1,$2,$2) returning id`,
            [IDS.contractorApproved, `http://x/boundary-fill-${i}.jpg`]
          );
          fillIds.push(r.rows[0].id);
        }
      });
      await commit(filled.client);

      try {
        const twentieth = await asServiceRole(async (c) => {
          const r = await c.query(
            `insert into public.portfolio_images (contractor_id, image_url, thumbnail_url) values ($1,'http://x/twentieth.jpg','http://x/twentieth.jpg') returning id`,
            [IDS.contractorApproved]
          );
          return r.rows[0].id;
        });
        await commit(twentieth.client);
        fillIds.push(twentieth.out);
        assert(typeof twentieth.out === 'string', 'expected the 20th insert to succeed');
      } finally {
        const cleanup = await asServiceRole(async (c) => {
          if (fillIds.length > 0) {
            await c.query(`delete from public.portfolio_images where id = any($1::uuid[])`, [fillIds]);
          }
        });
        await commit(cleanup.client);
      }
    }
  );

  await test(
    'J12',
    'the cap trigger also rejects an over-the-cap insert attempted directly as the owning contractor (not just service_role)',
    async () => {
      const before = await asServiceRole(async (c) => (await c.query(`select count(*)::int as n from public.portfolio_images where contractor_id=$1`, [IDS.contractorApproved])).rows[0].n);
      await rollback(before.client);
      const startCount = before.out;
      const toFill = 20 - startCount;
      assert(toFill >= 0, `test fixture assumption broken: contractor already has ${startCount} > 20 images`);

      const fillIds = [];
      const filled = await asServiceRole(async (c) => {
        for (let i = 0; i < toFill; i++) {
          const r = await c.query(
            `insert into public.portfolio_images (contractor_id, image_url, thumbnail_url) values ($1,$2,$2) returning id`,
            [IDS.contractorApproved, `http://x/owner-fill-${i}.jpg`]
          );
          fillIds.push(r.rows[0].id);
        }
      });
      await commit(filled.client);

      try {
        const { out, client } = await asUser(IDS.contractor1, async (c) => {
          try {
            await c.query(
              `insert into public.portfolio_images (contractor_id, image_url, thumbnail_url) values ($1,'http://x/owner-over-limit.jpg','http://x/owner-over-limit.jpg')`,
              [IDS.contractorApproved]
            );
            return 'inserted';
          } catch (e) {
            return e;
          }
        });
        await rollback(client);
        assert(
          out instanceof Error && /already has 20 portfolio images/i.test(out.message),
          `expected the cap trigger to reject the owner's own over-the-cap insert, got ${out}`
        );
      } finally {
        const cleanup = await asServiceRole(async (c) => {
          if (fillIds.length > 0) {
            await c.query(`delete from public.portfolio_images where id = any($1::uuid[])`, [fillIds]);
          }
        });
        await commit(cleanup.client);
      }
    }
  );

  // =====================================================================
  section('K. Issue #35 — reports hardening (0021_reports_hardening.sql)');
  // =====================================================================
  //
  // Section E already covers reports' referential-integrity checks
  // (FK/CHECK violations); this section covers the two gaps the Issue
  // #35 security audit found and 0021 fixed: an unbounded `reason`
  // column, and reporter_id spoofing (claiming to be someone else when
  // filing a report).

  await test('K1', 'Cannot INSERT a reports row with reason over 2000 chars (length CHECK)', async () => {
    const { out, client } = await asAnon(async (c) => {
      try {
        await c.query(`insert into public.reports (contractor_id, reason) values ($1,$2)`, [
          IDS.contractorApproved,
          'x'.repeat(2001),
        ]);
        return 'inserted';
      } catch (e) {
        return e;
      }
    });
    await rollback(client);
    assert(
      out instanceof Error && /reports_reason_length/i.test(out.message),
      `expected reports_reason_length CHECK violation, got ${out}`
    );
  });

  await test('K2', 'CAN INSERT a reports row with reason at exactly 2000 chars (boundary, not off-by-one)', async () => {
    // No RETURNING — same reasoning as A9: anon has no SELECT policy on
    // reports (admin-only reads), so RETURNING would error under RLS
    // even though the plain insert succeeds.
    const { out, client } = await asAnon(async (c) => {
      const r = await c.query(`insert into public.reports (contractor_id, reason) values ($1,$2)`, [
        IDS.contractorApproved,
        'x'.repeat(2000),
      ]);
      return r.rowCount;
    });
    await rollback(client);
    assert(out === 1, `expected the insert to succeed, got rowCount ${out}`);
  });

  await test('K3', 'An anonymous caller cannot spoof reporter_id to an arbitrary real user', async () => {
    const { out, client } = await asAnon(async (c) => {
      try {
        await c.query(`insert into public.reports (contractor_id, reason, reporter_id) values ($1,'x',$2)`, [
          IDS.contractorApproved,
          IDS.customer2,
        ]);
        return 'inserted';
      } catch (e) {
        return e;
      }
    });
    await rollback(client);
    assert(
      out instanceof Error && /row-level security/i.test(out.message),
      `expected an RLS rejection, got ${out}`
    );
  });

  await test('K4', "An authenticated user cannot spoof reporter_id to ANOTHER user's id", async () => {
    const { out, client } = await asUser(IDS.customer1, async (c) => {
      try {
        await c.query(`insert into public.reports (contractor_id, reason, reporter_id) values ($1,'x',$2)`, [
          IDS.contractorApproved,
          IDS.customer2,
        ]);
        return 'inserted';
      } catch (e) {
        return e;
      }
    });
    await rollback(client);
    assert(
      out instanceof Error && /row-level security/i.test(out.message),
      `expected an RLS rejection, got ${out}`
    );
  });

  await test('K5', 'An authenticated user CAN file a report as themselves (reporter_id = own uid)', async () => {
    // No RETURNING — same reasoning as A9/K2.
    const { out, client } = await asUser(IDS.customer1, async (c) => {
      const r = await c.query(
        `insert into public.reports (contractor_id, reason, reporter_id) values ($1,'x',$2)`,
        [IDS.contractorApproved, IDS.customer1]
      );
      return r.rowCount;
    });
    await rollback(client);
    assert(out === 1, `expected the insert to succeed, got rowCount ${out}`);
  });

  await test('K6', 'Anonymous reports (reporter_id left null) still work — anti-enumeration/no-account-required is preserved', async () => {
    // Verified via service_role afterward, not RETURNING — same
    // reasoning as A9/K2 (anon has no SELECT policy on reports).
    const seeded = await asAnon(async (c) => {
      const r = await c.query(`insert into public.reports (contractor_id, reason) values ($1,'K6-marker')`, [
        IDS.contractorApproved,
      ]);
      return r.rowCount;
    });
    await commit(seeded.client);
    assert(seeded.out === 1, `expected the anonymous insert to succeed, got rowCount ${seeded.out}`);

    const { out, client } = await asServiceRole(async (c) => {
      const r = await c.query(
        `select id, reporter_id from public.reports where reason = 'K6-marker' order by created_at desc limit 1`
      );
      return r.rows[0];
    });
    try {
      assert(out && out.reporter_id === null, `expected reporter_id null, got ${JSON.stringify(out)}`);
    } finally {
      const cleanup = await asServiceRole(async (c) => {
        await c.query(`delete from public.reports where id = $1`, [out.id]);
      });
      await commit(cleanup.client);
      await commit(client);
    }
  });

  // =====================================================================
  section('L. Issue #41 — Facebook OAuth member boundary');
  // =====================================================================
  // Facebook sign-in goes through the exact same account-creation path as
  // email/password (supabase.auth.signInWithOAuth() -> a new auth.users
  // row -> handle_new_user trigger -> profiles row). No Facebook-specific
  // schema/trigger exists at all — these tests confirm that path still
  // defaults every new account to role='customer' regardless of what
  // metadata an OAuth provider attaches, and that the pre-existing
  // role-lock trigger (already proven generally in G7) still applies to
  // such an account. This directly backs Issue #41's core product rule:
  // "Facebook member ห้ามกลายเป็น approved contractor โดยอัตโนมัติ".

  await test(
    'L1',
    'a new auth.users row carrying Facebook-shaped profile metadata still gets profiles.role=customer by default',
    async () => {
      // raw_user_meta_data shaped like what GoTrue attaches for a Facebook
      // identity (full_name/avatar_url sourced from the provider) — the
      // trigger (handle_new_user, 0004_profiles.sql) only ever reads
      // ->> 'full_name' out of it and hardcodes no role, so this proves
      // the OAuth-flavored metadata itself carries no way to influence
      // role, not just that "some new signup" doesn't.
      const seeded = await asServiceRole(async (c) => {
        const id = (
          await c.query(
            `insert into auth.users (email, raw_user_meta_data) values
             ('l1-facebook-member@test.local',
              '{"full_name":"Facebook Test User","avatar_url":"https://platform-lookaside.example/avatar.jpg","provider":"facebook"}')
             returning id`
          )
        ).rows[0].id;
        return id;
      });
      await commit(seeded.client);
      const newUserId = seeded.out;

      const { out, client } = await asServiceRole(async (c) => {
        const r = await c.query(`select role, full_name from public.profiles where id=$1`, [newUserId]);
        return r.rows[0];
      });
      await rollback(client);

      const cleanup = await asServiceRole(async (c) => {
        await c.query(`delete from auth.users where id=$1`, [newUserId]);
      });
      await commit(cleanup.client);

      assert(
        out && out.role === 'customer',
        `expected the new profiles row to default to role='customer', got ${JSON.stringify(out)}`
      );
      assert(
        out && out.full_name === 'Facebook Test User',
        `expected full_name to be picked up from raw_user_meta_data same as any other signup, got ${JSON.stringify(out)}`
      );
    }
  );

  await test(
    'L2',
    'that same Facebook-originated customer cannot self-promote to contractor (trg_profiles_lock_role applies regardless of signup method)',
    async () => {
      const seeded = await asServiceRole(async (c) => {
        const id = (
          await c.query(
            `insert into auth.users (email, raw_user_meta_data) values
             ('l2-facebook-member@test.local', '{"full_name":"Facebook Test User 2","provider":"facebook"}')
             returning id`
          )
        ).rows[0].id;
        return id;
      });
      await commit(seeded.client);
      const newUserId = seeded.out;

      const { out, client } = await asUser(newUserId, async (c) => {
        await c.query(`update public.profiles set role='contractor' where id=$1`, [newUserId]);
        const r = await c.query(`select role from public.profiles where id=$1`, [newUserId]);
        return r.rows[0].role;
      });
      await rollback(client);

      const cleanup = await asServiceRole(async (c) => {
        await c.query(`delete from auth.users where id=$1`, [newUserId]);
      });
      await commit(cleanup.client);

      assert(out === 'customer', `expected self-promotion to be silently reverted by the trigger, got role='${out}'`);
    }
  );

  // =====================================================================
  // Report
  // =====================================================================
  const bySection = {};
  for (const r of results) {
    bySection[r.section] = bySection[r.section] || [];
    bySection[r.section].push(r);
  }

  let totalPass = 0;
  let totalFail = 0;
  for (const [sec, tests] of Object.entries(bySection)) {
    console.log(`\n## ${sec}`);
    for (const t of tests) {
      const mark = t.status === 'PASS' ? 'PASS' : 'FAIL';
      if (t.status === 'PASS') totalPass++;
      else totalFail++;
      console.log(`[${mark}] ${t.id} — ${t.desc}${t.error ? `\n       error: ${t.error}` : ''}`);
    }
  }
  console.log(`\n=== TOTAL: ${totalPass} passed, ${totalFail} failed, ${results.length} total ===`);

  console.log('\n---JSON---');
  console.log(JSON.stringify(results, null, 2));

  await pool.end();
  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('harness crashed:', err);
  process.exit(2);
});
