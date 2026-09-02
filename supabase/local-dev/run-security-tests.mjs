/**
 * SQL-level security test harness for docs/SECURITY_TEST_PLAN.md.
 *
 * Emulates exactly what PostgREST does per-request: connect as
 * `authenticator`, then `SET LOCAL ROLE <role>` and
 * `SET LOCAL request.jwt.claims = '<jwt-claims-json>'` based on the
 * caller's key/session, then run the query inside that transaction.
 * auth.uid()/auth.role() (see bootstrap SQL) read those same GUCs, so
 * RLS policy evaluation is identical to what real PostgREST would
 * produce for the same JWT claims — only the HTTP/JWT-signature layer
 * itself is not exercised (see final report for that caveat).
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
