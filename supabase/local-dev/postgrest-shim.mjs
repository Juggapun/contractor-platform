/**
 * Minimal local stand-in for PostgREST. Originally built (Phase 2) so
 * scripts/seed-districts.mjs could run unmodified against local Postgres
 * (org egress policy blocks pulling the real PostgREST Docker image);
 * extended (Phase 4) with a generic read-only GET handler so
 * src/lib/data/{categories,provinces}.ts can be smoke-tested against
 * real seeded rows instead of only the "Supabase not configured" empty
 * state; extended again (Phase 5) with a purpose-built handler for the
 * real contractor search query; extended again (Phase 6) with the
 * contractor profile's read-only portfolio/reviews lookups and the
 * contact_events insert; extended again (Phase 7) with a minimal
 * `/auth/v1/signup` (just enough of GoTrue's real wire contract for
 * supabase-js's `client.auth.signUp()` to work — see the handler below
 * for exactly what is and isn't emulated) plus the writes the real
 * contractor-registration route needs. Routes:
 *   GET  /rest/v1/provinces?select=...&order=...
 *   GET  /rest/v1/categories?select=...&order=...
 *   GET  /rest/v1/districts?province_id=eq.X&select=...&order=name_th.asc
 *   GET  /rest/v1/portfolio_images?contractor_id=eq.X&select=...&order=sort_order.asc
 *   GET  /rest/v1/reviews?contractor_id=eq.X&status=eq.active&select=...&order=created_at.desc&limit=N
 *   GET  /rest/v1/contractors?...  — see handleContractorsSearch() below;
 *        recognizes exactly the filter/embed/range shape
 *        src/lib/data/contractors.ts's searchContractors()/
 *        getContractorProfile() send (not a generic PostgREST
 *        embedded-query parser); also used by Phase 7's slug-uniqueness
 *        check (GET .../contractors?slug=eq.X&select=id, service_role).
 *   POST /rest/v1/contractors  (service_role only in practice — see
 *        app/api/contractors/register/route.ts; returns the inserted
 *        row so `.insert(...).select(...).single()` works)
 *   POST /rest/v1/contractor_categories  (service_role only, bulk insert)
 *   PATCH /rest/v1/profiles?id=eq.X  (service_role only — role promotion,
 *        see promoteNewAccountToContractor in src/lib/auth/authService.ts;
 *        `role` is the only column this route will ever touch)
 *   POST /rest/v1/contact_events  (anonymous insert — no on_conflict, no upsert)
 *   POST /rest/v1/districts?on_conflict=province_id,slug  (Prefer: resolution=merge-duplicates)
 *   POST /auth/v1/signup  (see handleAuthSignup() below)
 *
 * Mirrors PostgREST's actual connection model: connect as `authenticator`
 * then SET LOCAL ROLE per request based on the bearer key, so the
 * database-level behavior (grants, RLS bypass for service_role) is real,
 * not mocked.
 */
import http from 'node:http';
import pg from 'pg';

const PORT = 54321;
const SERVICE_ROLE_KEY = 'local-service-role-key';

const pool = new pg.Pool({
  host: '127.0.0.1',
  port: 5432,
  database: 'contractor_platform',
  user: 'authenticator',
  password: 'authenticator_pw',
});

function roleForKey(authHeader) {
  const key = (authHeader || '').replace(/^Bearer\s+/i, '');
  if (key === SERVICE_ROLE_KEY) return 'service_role';
  return 'anon';
}

// Only these two columns are ever used in `order=`, and only from our
// own client code (src/lib/data/contractors.ts) — whitelisted rather
// than interpolating an arbitrary column name into SQL.
const CONTRACTORS_ORDERABLE_COLUMNS = new Set(['business_name', 'id']);

function parseEqFilter(rawValue) {
  if (!rawValue) return undefined;
  const m = rawValue.match(/^eq\.(.*)$/);
  return m ? m[1] : undefined;
}

/**
 * Real SQL against real Postgres for exactly the query
 * searchContractors() issues: status/province-slug/category-slug/
 * keyword filters, deterministic order, offset/limit pagination with an
 * exact total count, and a response JSON-shaped to match what
 * supabase-js returns for the embedded `provinces(...)`, `districts(...)`,
 * `contractor_categories(categories(...))` select this route serves.
 */
async function handleContractorsSearch(client, url, headers) {
  const params = [];
  const whereClauses = [];

  const statusValue = parseEqFilter(url.searchParams.get('status'));
  if (statusValue) {
    params.push(statusValue);
    whereClauses.push(`c.status = $${params.length}`);
  }

  // getContractorNameBySlug() sends a plain `slug=eq.X` filter (no embed
  // dot-path) — distinct from the province/category embedded filters.
  const contractorSlug = parseEqFilter(url.searchParams.get('slug'));
  if (contractorSlug) {
    params.push(contractorSlug);
    whereClauses.push(`c.slug = $${params.length}`);
  }

  const provinceSlug = parseEqFilter(url.searchParams.get('provinces.slug'));
  if (provinceSlug) {
    params.push(provinceSlug);
    whereClauses.push(`p.slug = $${params.length}`);
  }

  const categorySlug = parseEqFilter(url.searchParams.get('contractor_categories.categories.slug'));
  if (categorySlug) {
    params.push(categorySlug);
    whereClauses.push(
      `EXISTS (SELECT 1 FROM public.contractor_categories cc2 JOIN public.categories cat2 ON cat2.id = cc2.category_id WHERE cc2.contractor_id = c.id AND cat2.slug = $${params.length})`
    );
  }

  const orParam = url.searchParams.get('or');
  if (orParam) {
    const m = orParam.match(/^\(business_name\.ilike\.(.+),description\.ilike\.(.+)\)$/);
    if (m) {
      params.push(m[1]);
      const p1 = params.length;
      params.push(m[2]);
      const p2 = params.length;
      whereClauses.push(`(c.business_name ILIKE $${p1} OR c.description ILIKE $${p2})`);
    }
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const orderParam = url.searchParams.get('order') || '';
  const orderCols = orderParam
    .split(',')
    .map((part) => {
      const [col, dir] = part.split('.');
      if (!CONTRACTORS_ORDERABLE_COLUMNS.has(col)) return null;
      return `c."${col}" ${dir === 'desc' ? 'DESC' : 'ASC'}`;
    })
    .filter(Boolean);
  const orderSql = orderCols.length ? `ORDER BY ${orderCols.join(', ')}` : 'ORDER BY c.business_name ASC, c.id ASC';

  // This supabase-js version encodes .range(from, to) as `offset`/`limit`
  // query params (verified against the actual request — NOT a Range/
  // Range-Unit header, despite what postgrest-js's own naming suggests).
  // Falls back to the Range header if a future version changes this, so
  // either mechanism keeps working.
  let limit = 12;
  let offset = 0;
  const offsetParam = url.searchParams.get('offset');
  const limitParam = url.searchParams.get('limit');
  if (offsetParam !== null && limitParam !== null) {
    const parsedOffset = Number.parseInt(offsetParam, 10);
    const parsedLimit = Number.parseInt(limitParam, 10);
    if (Number.isFinite(parsedOffset) && Number.isFinite(parsedLimit) && parsedLimit > 0) {
      offset = parsedOffset;
      limit = parsedLimit;
    }
  } else {
    const rangeHeader = headers['range'];
    if (rangeHeader) {
      const [fromStr, toStr] = String(rangeHeader).split('-');
      const from = Number.parseInt(fromStr, 10);
      const to = Number.parseInt(toStr, 10);
      if (Number.isFinite(from) && Number.isFinite(to) && to >= from) {
        offset = from;
        limit = to - from + 1;
      }
    }
  }

  const countResult = await client.query(
    `SELECT count(*)::int AS total
     FROM public.contractors c
     LEFT JOIN public.provinces p ON p.id = c.province_id
     ${whereSql}`,
    params
  );
  const total = countResult.rows[0]?.total ?? 0;

  const dataResult = await client.query(
    `SELECT
       c.id, c.business_name, c.slug, c.description, c.profile_image_url,
       c.phone, c.line_id, c.facebook_url, c.website_url, c.address, c.years_experience,
       c.rating_avg, c.review_count, c.verification_status,
       CASE WHEN p.id IS NULL THEN NULL ELSE json_build_object('id', p.id, 'name_th', p.name_th, 'slug', p.slug) END AS provinces,
       CASE WHEN d.id IS NULL THEN NULL ELSE json_build_object('id', d.id, 'name_th', d.name_th, 'slug', d.slug) END AS districts,
       COALESCE(catagg.cats, '[]'::json) AS contractor_categories
     FROM public.contractors c
     LEFT JOIN public.provinces p ON p.id = c.province_id
     LEFT JOIN public.districts d ON d.id = c.district_id
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
         'categories', json_build_object('id', cat.id, 'name_th', cat.name_th, 'slug', cat.slug)
       )) AS cats
       FROM public.contractor_categories cc
       JOIN public.categories cat ON cat.id = cc.category_id
       WHERE cc.contractor_id = c.id
     ) catagg ON true
     ${whereSql}
     ${orderSql}
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  return {
    rows: dataResult.rows,
    contentRange: `${offset}-${Math.max(offset, offset + dataResult.rows.length - 1)}/${total}`,
  };
}

/**
 * Just enough of GoTrue's `POST /auth/v1/signup` wire contract for
 * supabase-js's `client.auth.signUp()` (used unchanged by
 * signUpCustomer()/signUpContractor() in src/lib/auth/authService.ts) to
 * work against real Postgres. What this deliberately does NOT emulate,
 * because Phase 7's registration flow never needs it: password
 * storage/verification (no password is persisted — this shim has no
 * `/auth/v1/token` sign-in route either, unchanged Phase 3 gap, see
 * docs/AUTHENTICATION.md), email confirmation, and session/JWT issuance.
 * Instead this always responds the way real GoTrue does when a project
 * has email confirmation enabled and no session is issued yet: a flat
 * user object with no access_token/refresh_token. auth-js's
 * `_sessionResponse` xform (node_modules/@supabase/auth-js) reads that
 * exact shape as `{ session: null, user: <the object we return> }`,
 * which is exactly what `signUpContractor()` needs — it only ever reads
 * `result.user.id` to promote and to attach the contractors row to, and
 * that id is real (generated by the real `auth.users` insert below, not
 * fabricated), never a client-supplied value.
 *
 * Always runs as service_role regardless of the caller's apikey/
 * Authorization header — matches reality: GoTrue is a separate trusted
 * service with its own elevated DB access, not a per-request-role
 * PostgREST call.
 */
async function handleAuthSignup(client, body) {
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { status: 400, json: { error_code: 'validation_failed', msg: 'invalid JSON body' } };
  }
  const email = typeof parsed.email === 'string' ? parsed.email.trim() : '';
  if (!email) {
    return { status: 400, json: { error_code: 'validation_failed', msg: 'email is required' } };
  }
  const metadata = parsed.data && typeof parsed.data === 'object' ? parsed.data : {};

  await client.query('SET LOCAL ROLE service_role');
  try {
    const { rows } = await client.query(
      `INSERT INTO auth.users (email, raw_user_meta_data)
       VALUES ($1, $2::jsonb)
       RETURNING id, email, raw_user_meta_data, created_at`,
      [email, JSON.stringify(metadata)]
    );
    const row = rows[0];
    return {
      status: 200,
      json: {
        id: row.id,
        email: row.email,
        aud: 'authenticated',
        role: 'authenticated',
        user_metadata: row.raw_user_meta_data,
        app_metadata: {},
        created_at: row.created_at,
        confirmed_at: null,
        email_confirmed_at: null,
      },
    };
  } catch (err) {
    // Postgres unique_violation on auth.users.email — mirrors real
    // GoTrue's "already registered" case. The route handler that calls
    // this (app/api/contractors/register/route.ts) turns this into a
    // generic user-facing message rather than repeating this text
    // verbatim, per Issue #4's anti-enumeration requirement.
    if (err && err.code === '23505') {
      return {
        status: 422,
        json: { error_code: 'user_already_exists', msg: 'User already registered' },
      };
    }
    throw err;
  }
}

const server = http.createServer(async (req, res) => {
  // A real hosted Supabase project's PostgREST sends CORS headers by
  // default (it's designed to be called directly from a browser); this
  // bare Node http server doesn't unless told to. Needed from Phase 6
  // onward, once a client component (ContactLink) started making a
  // real cross-origin (localhost:3000 -> 127.0.0.1:54321) fetch instead
  // of every Supabase call happening server-side.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'authorization, apikey, content-type, prefer, range, range-unit, accept-profile, content-profile, x-client-info'
  );
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  let body = '';
  for await (const chunk of req) body += chunk;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (req.method === 'POST' && url.pathname === '/auth/v1/signup') {
      const { status, json } = await handleAuthSignup(client, body);
      if (status >= 400) {
        await client.query('ROLLBACK');
      } else {
        await client.query('COMMIT');
      }
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(json));
      return;
    }

    await client.query(`SET LOCAL ROLE ${roleForKey(req.headers['authorization'])}`);

    if (req.method === 'GET' && url.pathname === '/rest/v1/contractors') {
      const { rows, contentRange } = await handleContractorsSearch(client, url, req.headers);
      await client.query('COMMIT');
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Range': contentRange,
      });
      res.end(JSON.stringify(rows));
      return;
    }

    // Read-only tables, generic select/eq-filter/order/limit support.
    // Filter/order column names are whitelisted per table below rather
    // than interpolating an arbitrary query-param-derived identifier
    // into SQL — this shim only ever serves this project's own client
    // code, but stays disciplined about it anyway.
    const READABLE_TABLES = {
      provinces: { filterable: [], orderable: ['id', 'name_th'] },
      categories: { filterable: [], orderable: ['sort_order', 'name_th'] },
      districts: { filterable: ['province_id'], orderable: ['name_th', 'id'] },
      portfolio_images: { filterable: ['contractor_id'], orderable: ['sort_order'] },
      reviews: { filterable: ['contractor_id', 'status'], orderable: ['created_at'] },
    };
    const tableName = url.pathname.startsWith('/rest/v1/') ? url.pathname.slice('/rest/v1/'.length) : '';
    const tableMatch = READABLE_TABLES[tableName];
    if (req.method === 'GET' && tableMatch) {
      const selectParam = url.searchParams.get('select') || '*';
      const cols = selectParam
        .split(',')
        .map((c) => `"${c.trim()}"`)
        .join(', ');

      const whereClauses = [];
      const filterParams = [];
      for (const col of tableMatch.filterable) {
        const val = parseEqFilter(url.searchParams.get(col));
        if (val !== undefined) {
          filterParams.push(val);
          whereClauses.push(`"${col}" = $${filterParams.length}`);
        }
      }
      const whereSql = whereClauses.length ? ` WHERE ${whereClauses.join(' AND ')}` : '';

      // supabase-js's .order('col', { ascending }) becomes ?order=col.asc / col.desc
      const orderParam = url.searchParams.get('order');
      let orderSql = '';
      if (orderParam) {
        const [col, dir] = orderParam.split('.');
        if (tableMatch.orderable.includes(col)) {
          orderSql = ` ORDER BY "${col}" ${dir === 'desc' ? 'DESC' : 'ASC'}`;
        }
      }

      const limitParam = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
      const limitSql = Number.isFinite(limitParam) && limitParam > 0 ? ` LIMIT ${limitParam}` : '';

      const { rows } = await client.query(
        `SELECT ${cols} FROM public.${tableName}${whereSql}${orderSql}${limitSql}`,
        filterParams
      );
      await client.query('COMMIT');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/rest/v1/contact_events') {
      const parsed = JSON.parse(body);
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      if (rows.length > 0) {
        const cols = Object.keys(rows[0]);
        const valuesSql = rows
          .map((_, i) => `(${cols.map((_, j) => `$${i * cols.length + j + 1}`).join(', ')})`)
          .join(', ');
        const insertParams = rows.flatMap((r) => cols.map((c) => r[c]));
        await client.query(
          `INSERT INTO public.contact_events (${cols.map((c) => `"${c}"`).join(', ')}) VALUES ${valuesSql}`,
          insertParams
        );
      }
      await client.query('COMMIT');
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end('[]');
      return;
    }

    // Phase 7: promoteNewAccountToContractor() (src/lib/auth/authService.ts)
    // does `adminClient.from('profiles').update({ role }).eq('id', userId)`
    // — service_role only in practice (this shim doesn't re-check that;
    // the real RLS-bypass/lock-role-trigger behavior does the actual
    // enforcing, same as every other route here). `role` is the only
    // column that call ever sends — whitelisted rather than accepting an
    // arbitrary column list.
    if (req.method === 'PATCH' && url.pathname === '/rest/v1/profiles') {
      const id = parseEqFilter(url.searchParams.get('id'));
      const parsed = JSON.parse(body);
      if (id && typeof parsed.role === 'string') {
        await client.query('UPDATE public.profiles SET role = $1 WHERE id = $2', [parsed.role, id]);
      }
      await client.query('COMMIT');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
      return;
    }

    // Phase 7: the registration route inserts one contractors row
    // (service_role — see app/api/contractors/register/route.ts, which
    // never sends status/verification_status/plan_tier/featured_until/
    // rating_avg/review_count/profile_completeness, so every one of
    // those keeps its column default — 'pending' for status). Returns
    // the inserted row shaped by `select=`, matching what
    // `.insert(...).select('...').single()` expects back.
    if (req.method === 'POST' && url.pathname === '/rest/v1/contractors') {
      const parsed = JSON.parse(body);
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      if (rows.length !== 1) {
        await client.query('ROLLBACK');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'this shim only supports inserting one contractor at a time' }));
        return;
      }
      const cols = Object.keys(rows[0]);
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const params = cols.map((c) => rows[0][c]);
      const selectParam = url.searchParams.get('select');
      const returningSql = selectParam
        ? selectParam
            .split(',')
            .map((c) => `"${c.trim()}"`)
            .join(', ')
        : 'id';
      const { rows: inserted } = await client.query(
        `INSERT INTO public.contractors (${cols.map((c) => `"${c}"`).join(', ')})
         VALUES (${placeholders})
         RETURNING ${returningSql}`,
        params
      );
      await client.query('COMMIT');
      // `.select(...).single()` (app/api/contractors/register/route.ts)
      // sets this exact Accept header and expects ONE unwrapped JSON
      // object back, not an array — real PostgREST's content
      // negotiation for that header, which this shim otherwise doesn't
      // implement anywhere else (every other route here is consumed via
      // `.maybeSingle()` or a plain array `.select()`, neither of which
      // depend on it — see postgrest-js's PostgrestTransformBuilder).
      const wantsSingleObject = (req.headers['accept'] || '').includes('vnd.pgrst.object');
      const responseBody = !selectParam ? [] : wantsSingleObject ? inserted[0] : inserted;
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responseBody));
      return;
    }

    // Phase 7: category links for the row just inserted above
    // (service_role, same route). Bulk insert, no RETURNING needed — the
    // route handler doesn't read this response.
    if (req.method === 'POST' && url.pathname === '/rest/v1/contractor_categories') {
      const rows = JSON.parse(body);
      if (Array.isArray(rows) && rows.length > 0) {
        const cols = Object.keys(rows[0]);
        const valuesSql = rows
          .map((_, i) => `(${cols.map((_, j) => `$${i * cols.length + j + 1}`).join(', ')})`)
          .join(', ');
        const insertParams = rows.flatMap((r) => cols.map((c) => r[c]));
        await client.query(
          `INSERT INTO public.contractor_categories (${cols.map((c) => `"${c}"`).join(', ')}) VALUES ${valuesSql}`,
          insertParams
        );
      }
      await client.query('COMMIT');
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end('[]');
      return;
    }

    if (req.method === 'POST' && url.pathname === '/rest/v1/districts') {
      const onConflict = (url.searchParams.get('on_conflict') || '')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      const rows = JSON.parse(body);
      if (!Array.isArray(rows) || rows.length === 0) {
        await client.query('COMMIT');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('[]');
        return;
      }
      const cols = Object.keys(rows[0]);
      const conflictClause = onConflict.length
        ? `ON CONFLICT (${onConflict.map((c) => `"${c}"`).join(', ')}) DO UPDATE SET ${cols
            .filter((c) => !onConflict.includes(c))
            .map((c) => `"${c}" = EXCLUDED."${c}"`)
            .join(', ')}`
        : '';
      const valuesSql = rows
        .map(
          (_, i) =>
            `(${cols.map((_, j) => `$${i * cols.length + j + 1}`).join(', ')})`
        )
        .join(', ');
      const params = rows.flatMap((r) => cols.map((c) => r[c]));
      const sql = `INSERT INTO public.districts (${cols
        .map((c) => `"${c}"`)
        .join(', ')}) VALUES ${valuesSql} ${conflictClause}`;
      await client.query(sql, params);
      await client.query('COMMIT');
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end('[]');
      return;
    }

    await client.query('ROLLBACK');
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `no shim route for ${req.method} ${url.pathname}` }));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('shim error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: String(err) }));
  } finally {
    client.release();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Local PostgREST shim listening on http://127.0.0.1:${PORT}`);
});
