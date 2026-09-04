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
 * `/auth/v1/signup` plus the writes the contractor-registration route
 * needs; extended again (Phase 8) with real sign-in (`/auth/v1/token`,
 * `/auth/v1/user`, `/auth/v1/logout` — see "Session tokens" below) and
 * the admin approval queue's reads/writes, because Phase 8 is the first
 * feature that requires an actual logged-in admin to reach it; extended
 * again (Phase 9) with a real, RLS-enforced (not service_role) review
 * insert; extended again (Phase 10) with a real, RLS-enforced GET on
 * contact_events for the admin analytics tally; extended again (Issue
 * #23) with a real Supabase Storage stand-in (see handleStorageRequest()
 * — files land on local disk under `.storage-data/`, not in Postgres)
 * and portfolio_images POST/DELETE + a HEAD/count-aware generic table
 * handler, because Issue #23 is the first feature whose own client code
 * (src/lib/storage/contractorMedia.ts) actually uploads/deletes/counts
 * anything through this shim rather than only reading pre-seeded rows.
 * Routes:
 *   GET  /rest/v1/provinces?select=...&order=...
 *   GET  /rest/v1/categories?select=...&order=...
 *   GET  /rest/v1/districts?province_id=eq.X&select=...&order=name_th.asc
 *   GET  /rest/v1/portfolio_images?contractor_id=eq.X&select=...&order=sort_order.asc
 *   HEAD /rest/v1/portfolio_images?contractor_id=eq.X&select=id  (Prefer:
 *        count=exact — the 20-image-cap pre-check; count comes back via
 *        the Content-Range response header, no body — see the HEAD
 *        branch inside the generic READABLE_TABLES handler below)
 *   POST /rest/v1/portfolio_images  (service_role only in practice — see
 *        app/api/contractors/{register,me/portfolio}/route.ts; P0001 from
 *        trg_portfolio_images_enforce_limit, 0019_portfolio_image_limit.sql,
 *        is translated to a real PostgREST-shaped error body)
 *   DELETE /rest/v1/portfolio_images?id=eq.X&contractor_id=eq.Y
 *        (service_role only — app/api/contractors/me/portfolio/[id]/route.ts;
 *        scoped by both filters, same as the real query)
 *   POST /storage/v1/object/{bucket}/{path}  (raw bytes, x-upsert header —
 *        contractorMedia.ts's uploadContractorImage())
 *   DELETE /storage/v1/object/{bucket}  (JSON {prefixes:[...]} body —
 *        deleteContractorImageBestEffort())
 *   GET  /storage/v1/object/public/{bucket}/{path}  (serves the file back
 *        from disk — this is what getPublicUrl()'s returned URL resolves
 *        to when actually fetched, e.g. by a real `<img src>`)
 *   GET  /rest/v1/reviews?contractor_id=eq.X&status=eq.active&select=...&order=created_at.desc&limit=N
 *   GET  /rest/v1/contact_events?contractor_id=eq.X&select=event_type  (RLS-enforced,
 *        owner/admin only — see contact_events_select_owner_or_admin, 0013)
 *   GET  /rest/v1/contractors?...  — see handleContractorsSearch() below;
 *        recognizes exactly the filter/embed/range shape
 *        src/lib/data/contractors.ts's searchContractors()/
 *        getContractorProfile() send (not a generic PostgREST
 *        embedded-query parser); also used by Phase 7's slug-uniqueness
 *        check and Phase 8's admin list/detail reads (both service_role,
 *        both add an `id=eq.X` and/or `status=eq.X` filter — status/
 *        created_at/user_id are always included in the response now).
 *   POST /rest/v1/contractors  (service_role only in practice — see
 *        app/api/contractors/register/route.ts; returns the inserted
 *        row so `.insert(...).select(...).single()` works)
 *   PATCH /rest/v1/contractors?id=eq.X&status=eq.Y  (service_role only —
 *        Phase 8 approve/reject; `status` is the only column this route
 *        will ever touch, and the `status=eq.Y` filter is the atomic
 *        concurrency guard — see app/api/admin/contractors/[id]/{approve,reject}/route.ts)
 *   POST /rest/v1/contractor_categories  (service_role only, bulk insert)
 *   POST /rest/v1/admin_actions  (service_role only, bulk insert — audit log)
 *   PATCH /rest/v1/profiles?id=eq.X  (service_role only — role promotion,
 *        see promoteNewAccountToContractor in src/lib/auth/authService.ts;
 *        `role` is the only column this route will ever touch)
 *   POST /rest/v1/contact_events  (anonymous insert — no on_conflict, no upsert)
 *   POST /rest/v1/reviews  (RLS-enforced under the caller's real
 *        anon/authenticated role — no service_role shortcut; errors are
 *        translated to a real PostgREST-shaped {code,message,details,hint}
 *        body, see the handler below and src/lib/data/reviewSubmission.ts)
 *   POST /rest/v1/districts?on_conflict=province_id,slug  (Prefer: resolution=merge-duplicates)
 *   POST /auth/v1/signup  (see handleAuthSignup() below)
 *   POST /auth/v1/token?grant_type=password|refresh_token  (see handleAuthToken() below)
 *   GET  /auth/v1/user  (see handleAuthGetUser() below)
 *   POST /auth/v1/logout  (always 204 — no server-side session store to revoke)
 *
 * Mirrors PostgREST's actual connection model: connect as `authenticator`
 * then SET LOCAL ROLE per request based on the bearer key, so the
 * database-level behavior (grants, RLS bypass for service_role) is real,
 * not mocked. As of Phase 8 this ALSO sets the `request.jwt.claims` GUC
 * every real PostgREST request carries (role, plus sub/email once a real
 * session exists) — a gap this phase found and fixed: `auth.role()`/
 * `auth.uid()` (supabase/local-dev/00_bootstrap.sql) read those GUCs, and
 * every trigger gated on `is_trusted_context()` (0012_denormalized_field_triggers.sql)
 * depends on `auth.role() = 'service_role'` resolving correctly. Before
 * this fix the GUC was never set over HTTP, so it happened to not matter
 * yet — every prior phase's service_role write over this shim was an
 * INSERT (unguarded by that trigger); Phase 8's approve/reject is the
 * first service_role UPDATE against a trigger-protected column
 * (contractors.status) to go through the HTTP layer at all.
 *
 * Session tokens: NOT real JWTs. `local-token.<base64url(JSON{sub,email,exp})>`
 * — unsigned, decodable by anyone, fine only because this is a throwaway
 * local harness where the "signature" from a real Supabase project would
 * add nothing this project's own tests rely on (the actual RLS/trigger
 * authorization logic is exercised for real either way, via the role/GUC
 * mechanism above). Never used for anything but local dev.
 */
import http from 'node:http';
import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const PORT = 54321;
const SERVICE_ROLE_KEY = 'local-service-role-key';

// Issue #23: local-disk stand-in for Supabase Storage. Real Storage is a
// separate service (its own bucket/objects tables + REST API) that this
// harness never emulated before this feature — every prior phase's image
// URL (portfolio seed data, contractors.profile_image_url) was a plain
// external placeholder string, never an actually-uploaded object. Only
// service_role ever calls `.storage.from(...)` in this codebase
// (src/lib/storage/contractorMedia.ts's header comment), so this stand-in
// doesn't emulate Storage's own object-level RLS — it just stores/serves
// bytes on disk, matching what this project's own client code actually
// does with it.
const STORAGE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '.storage-data');
const CONTENT_TYPE_BY_EXTENSION = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function storageFilePath(bucket, objectPath) {
  return path.join(STORAGE_ROOT, bucket, objectPath);
}

/**
 * Handles every `/storage/v1/object/**` request. Runs BEFORE a Postgres
 * connection is ever acquired — none of this needs one. Mirrors exactly
 * the three storage-js calls contractorMedia.ts makes (see that file):
 * `upload()` -> `POST .../object/{bucket}/{path}` (raw bytes, x-upsert
 * header), `remove()` -> `DELETE .../object/{bucket}` (JSON
 * `{prefixes:[...]}` body), and the public URL `getPublicUrl()` builds
 * client-side (never a network call) -> `GET .../object/public/{bucket}/{path}`,
 * served here so a real `<img src>` in a browser test actually renders.
 */
async function handleStorageRequest(req, res, url, bodyBuffer) {
  const afterPrefix = url.pathname.slice('/storage/v1/object/'.length);
  try {
    if (req.method === 'GET' && afterPrefix.startsWith('public/')) {
      const rest = decodeURIComponent(afterPrefix.slice('public/'.length));
      const slashIndex = rest.indexOf('/');
      const bucket = slashIndex === -1 ? rest : rest.slice(0, slashIndex);
      const objectPath = slashIndex === -1 ? '' : rest.slice(slashIndex + 1);
      if (!bucket || !objectPath || objectPath.includes('..')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid storage path' }));
        return;
      }
      try {
        const data = await fs.readFile(storageFilePath(bucket, objectPath));
        const extension = objectPath.split('.').pop()?.toLowerCase();
        const contentType = CONTENT_TYPE_BY_EXTENSION[extension] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600' });
        res.end(data);
      } catch {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Object not found' }));
      }
      return;
    }

    if (req.method === 'POST') {
      const rest = decodeURIComponent(afterPrefix);
      const slashIndex = rest.indexOf('/');
      const bucket = slashIndex === -1 ? rest : rest.slice(0, slashIndex);
      const objectPath = slashIndex === -1 ? '' : rest.slice(slashIndex + 1);
      if (!bucket || !objectPath || objectPath.includes('..')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid storage path' }));
        return;
      }
      const filePath = storageFilePath(bucket, objectPath);
      const upsert = req.headers['x-upsert'] === 'true';
      if (!upsert) {
        const exists = await fs.access(filePath).then(() => true).catch(() => false);
        if (exists) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ statusCode: '409', error: 'Duplicate', message: 'The resource already exists' }));
          return;
        }
      }
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, bodyBuffer);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ Id: randomUUID(), Key: `${bucket}/${objectPath}` }));
      return;
    }

    if (req.method === 'DELETE') {
      const bucket = decodeURIComponent(afterPrefix.replace(/\/$/, ''));
      let parsed;
      try {
        parsed = JSON.parse(bodyBuffer.toString('utf8'));
      } catch {
        parsed = {};
      }
      const prefixes = Array.isArray(parsed.prefixes) ? parsed.prefixes : [];
      for (const objectPath of prefixes) {
        if (typeof objectPath !== 'string' || objectPath.includes('..')) continue;
        await fs.unlink(storageFilePath(bucket, objectPath)).catch(() => {});
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(prefixes.map((name) => ({ name }))));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `no shim storage route for ${req.method} ${url.pathname}` }));
  } catch (err) {
    console.error('shim storage error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: String(err) }));
  }
}

const pool = new pg.Pool({
  host: '127.0.0.1',
  port: 5432,
  database: 'contractor_platform',
  user: 'authenticator',
  password: 'authenticator_pw',
});

const SESSION_TOKEN_PREFIX = 'local-token.';
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24;

function decodeLocalToken(token) {
  if (typeof token !== 'string' || !token.startsWith(SESSION_TOKEN_PREFIX)) return null;
  try {
    const json = Buffer.from(token.slice(SESSION_TOKEN_PREFIX.length), 'base64url').toString('utf8');
    const payload = JSON.parse(json);
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null;
    if (Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function encodeLocalToken(userRow) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS;
  const payload = { sub: userRow.id, email: userRow.email, exp };
  return SESSION_TOKEN_PREFIX + Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function buildSessionResponse(userRow) {
  const token = encodeLocalToken(userRow);
  return {
    access_token: token,
    token_type: 'bearer',
    expires_in: SESSION_LIFETIME_SECONDS,
    refresh_token: token,
    user: {
      id: userRow.id,
      email: userRow.email,
      aud: 'authenticated',
      role: 'authenticated',
      user_metadata: userRow.raw_user_meta_data ?? {},
      app_metadata: {},
      created_at: userRow.created_at ?? null,
    },
  };
}

/**
 * Sets the Postgres role AND the `request.jwt.claims` GUC for this
 * request's transaction — see the file header comment ("Session tokens")
 * for why both matter, not just the role. Three cases, matching real
 * PostgREST's actual per-key/per-JWT behavior:
 *   - the service_role key -> role service_role, claims {role: service_role}
 *   - a valid session token -> role authenticated, claims {role, sub, email}
 *   - anything else (the anon key, garbage, nothing) -> role anon, claims {role: anon}
 */
async function applyRequestRole(client, authHeader) {
  const bearer = (authHeader || '').replace(/^Bearer\s+/i, '');

  if (bearer === SERVICE_ROLE_KEY) {
    await client.query('SET LOCAL ROLE service_role');
    await client.query('SELECT set_config($1, $2, true)', [
      'request.jwt.claims',
      JSON.stringify({ role: 'service_role' }),
    ]);
    return;
  }

  const payload = decodeLocalToken(bearer);
  if (payload) {
    await client.query('SET LOCAL ROLE authenticated');
    await client.query('SELECT set_config($1, $2, true)', [
      'request.jwt.claims',
      JSON.stringify({ role: 'authenticated', sub: payload.sub, email: payload.email }),
    ]);
    return;
  }

  await client.query('SET LOCAL ROLE anon');
  await client.query('SELECT set_config($1, $2, true)', [
    'request.jwt.claims',
    JSON.stringify({ role: 'anon' }),
  ]);
}

// Only these columns are ever used in `order=`, and only from our own
// client code (src/lib/data/contractors.ts, and Phase 8's admin queue
// listing which orders by created_at) — whitelisted rather than
// interpolating an arbitrary column name into SQL.
const CONTRACTORS_ORDERABLE_COLUMNS = new Set(['business_name', 'id', 'created_at']);

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

  // Phase 8: admin list/detail reads filter by id (detail-by-id) and/or
  // status (queue-by-status) — both service_role, see
  // app/api/admin/contractors/{route.ts,[id]/route.ts}.
  const contractorId = parseEqFilter(url.searchParams.get('id'));
  if (contractorId) {
    params.push(contractorId);
    whereClauses.push(`c.id = $${params.length}`);
  }

  // Phase 12: getMyContractorApplication() (src/lib/data/contractorSelfStatus.ts)
  // reads a logged-in contractor's own row by user_id — RLS-enforced (not
  // service_role), same as every other public-client call through this
  // handler; the connection's role was already SET LOCAL by
  // applyRequestRole() before this function runs.
  const ownerUserId = parseEqFilter(url.searchParams.get('user_id'));
  if (ownerUserId) {
    params.push(ownerUserId);
    whereClauses.push(`c.user_id = $${params.length}`);
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
       c.rating_avg, c.review_count, c.profile_view_count, c.verification_status, c.status, c.created_at, c.updated_at, c.user_id,
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
 * work against real Postgres. Still does NOT emulate email confirmation
 * — this always responds the way real GoTrue does when a project has
 * email confirmation enabled and no session is issued yet: a flat user
 * object with no access_token/refresh_token. auth-js's `_sessionResponse`
 * xform (node_modules/@supabase/auth-js) reads that exact shape as
 * `{ session: null, user: <the object we return> }`, which is exactly
 * what `signUpContractor()` needs — it only ever reads `result.user.id`
 * to promote and to attach the contractors row to, and that id is real
 * (generated by the real `auth.users` insert below, not fabricated),
 * never a client-supplied value. Phase 8 added: the submitted password
 * is now stored (see `password_local_dev_only` on `00_bootstrap.sql`) so
 * `handleAuthToken`'s password grant below has something to check —
 * Phase 7 never needed this since nothing signed the new account back in.
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
  const password = typeof parsed.password === 'string' ? parsed.password : null;
  const metadata = parsed.data && typeof parsed.data === 'object' ? parsed.data : {};

  await client.query('SET LOCAL ROLE service_role');
  try {
    const { rows } = await client.query(
      `INSERT INTO auth.users (email, raw_user_meta_data, password_local_dev_only)
       VALUES ($1, $2::jsonb, $3)
       RETURNING id, email, raw_user_meta_data, created_at`,
      [email, JSON.stringify(metadata), password]
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

/**
 * `POST /auth/v1/token?grant_type=password|refresh_token` — backs
 * `client.auth.signInWithPassword()` (src/lib/auth/authService.ts's
 * `signIn()`, built in Phase 3, never exercised end-to-end until now)
 * and supabase-js's automatic refresh-token renewal. See the file header
 * comment for the token format and its (deliberate, local-dev-only)
 * lack of real signing.
 */
async function handleAuthToken(client, url, body) {
  const grantType = url.searchParams.get('grant_type');
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { status: 400, json: { error_code: 'validation_failed', msg: 'invalid JSON body' } };
  }

  await client.query('SET LOCAL ROLE service_role');

  if (grantType === 'password') {
    const email = typeof parsed.email === 'string' ? parsed.email.trim() : '';
    const password = typeof parsed.password === 'string' ? parsed.password : '';
    const { rows } = await client.query(
      'SELECT id, email, raw_user_meta_data, created_at, password_local_dev_only FROM auth.users WHERE email = $1',
      [email]
    );
    const row = rows[0];
    // Constant-shape failure regardless of *why* (no such user vs. wrong
    // password vs. a fixture account with no password ever set) — matches
    // real GoTrue's generic "Invalid login credentials", so this shim
    // doesn't become its own account-enumeration oracle.
    if (!row || row.password_local_dev_only === null || row.password_local_dev_only !== password) {
      return { status: 400, json: { error_code: 'invalid_credentials', msg: 'Invalid login credentials' } };
    }
    return { status: 200, json: buildSessionResponse(row) };
  }

  if (grantType === 'refresh_token') {
    const payload = decodeLocalToken(typeof parsed.refresh_token === 'string' ? parsed.refresh_token : '');
    if (!payload) {
      return { status: 400, json: { error_code: 'invalid_grant', msg: 'Invalid Refresh Token' } };
    }
    const { rows } = await client.query(
      'SELECT id, email, raw_user_meta_data, created_at FROM auth.users WHERE id = $1',
      [payload.sub]
    );
    if (rows.length === 0) {
      return { status: 400, json: { error_code: 'invalid_grant', msg: 'Invalid Refresh Token' } };
    }
    return { status: 200, json: buildSessionResponse(rows[0]) };
  }

  return { status: 400, json: { error_code: 'unsupported_grant_type', msg: `unsupported grant_type: ${grantType}` } };
}

/**
 * `GET /auth/v1/user` — backs `client.auth.getUser()` (used by
 * getCurrentUser(), src/lib/auth/authService.ts) both for the caller's
 * OWN session (no `jwt` argument — supabase-js sends its stored access
 * token as the Authorization header) and, as of Phase 8, for verifying a
 * client-supplied token passed explicitly to `getUser(jwt)` — see
 * app/api/admin/_lib/requireAdmin.ts, which is the only thing that
 * actually depends on that second form. Either way this shim can't tell
 * the two apart and doesn't need to — both are "whose token is this
 * request's Authorization header", answered the same way.
 */
async function handleAuthGetUser(client, authHeader) {
  const token = (authHeader || '').replace(/^Bearer\s+/i, '');
  const payload = decodeLocalToken(token);
  if (!payload) {
    return { status: 401, json: { error_code: 'bad_jwt', msg: 'invalid or expired token' } };
  }
  await client.query('SET LOCAL ROLE service_role');
  const { rows } = await client.query(
    'SELECT id, email, raw_user_meta_data, created_at FROM auth.users WHERE id = $1',
    [payload.sub]
  );
  if (rows.length === 0) {
    return { status: 401, json: { error_code: 'user_not_found', msg: 'user not found' } };
  }
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
    },
  };
}

const server = http.createServer(async (req, res) => {
  // A real hosted Supabase project's PostgREST sends CORS headers by
  // default (it's designed to be called directly from a browser); this
  // bare Node http server doesn't unless told to. Needed from Phase 6
  // onward, once a client component (ContactLink) started making a
  // real cross-origin (localhost:3000 -> 127.0.0.1:54321) fetch instead
  // of every Supabase call happening server-side.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    // x-supabase-api-version (Phase 8): auth-js's _request() adds this
    // to every call automatically (node_modules/@supabase/auth-js/src/lib/fetch.ts) —
    // never seen by this shim before because Phase 7's client.auth.signUp()
    // ran server-side (no CORS involved there); a real sign-in submitted
    // from the browser (src/components/LoginForm.tsx, exercised for the
    // first time once Phase 8 needed a real logged-in admin) is this
    // project's first cross-origin *auth* call, and it preflights.
    'authorization, apikey, content-type, prefer, range, range-unit, accept-profile, content-profile, x-client-info, x-supabase-api-version'
  );
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  // Binary-safe: collect raw Buffer chunks and concat them, rather than
  // the old `body += chunk` (implicit UTF-8 string coercion of each
  // Buffer chunk) — that would corrupt any binary upload whose bytes
  // don't happen to be valid UTF-8, silently mangling image data before
  // Issue #23's Storage routes ever got to see it. `body` (decoded text)
  // is still what every existing JSON-body handler below reads; the new
  // Storage upload handler reads `bodyBuffer` directly instead.
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const bodyBuffer = Buffer.concat(chunks);
  const body = bodyBuffer.toString('utf8');

  if (url.pathname.startsWith('/storage/v1/object/')) {
    await handleStorageRequest(req, res, url, bodyBuffer);
    return;
  }

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

    if (req.method === 'POST' && url.pathname === '/auth/v1/token') {
      const { status, json } = await handleAuthToken(client, url, body);
      if (status >= 400) {
        await client.query('ROLLBACK');
      } else {
        await client.query('COMMIT');
      }
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(json));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/auth/v1/user') {
      const { status, json } = await handleAuthGetUser(client, req.headers['authorization']);
      await client.query('ROLLBACK'); // read-only, nothing to commit
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(json));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/auth/v1/logout') {
      // No server-side session store in this shim (see file header) — a
      // real GoTrue revokes the refresh token; here the client dropping
      // its locally-stored session is the whole story, so this is
      // unconditionally a no-op success.
      await client.query('ROLLBACK');
      res.writeHead(204);
      res.end();
      return;
    }

    await applyRequestRole(client, req.headers['authorization']);

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
      // Phase 9: `reviewer_id` added for getMyReviewForContractor()
      // (src/lib/data/reviewSubmission.ts) — before Phase 9 this table
      // was only ever read publicly by contractor_id+status (Phase 6),
      // so a caller filtering by reviewer_id too silently got back every
      // review for that contractor instead of just their own (the
      // filter was simply ignored, not rejected) — caught by a real
      // browser test showing the review FORM again for a user who'd
      // already reviewed, not by any static check.
      reviews: { filterable: ['contractor_id', 'reviewer_id', 'status'], orderable: ['created_at'] },
      // Phase 8: getCurrentUser() (src/lib/auth/authService.ts, Phase 3)
      // and requireAdmin() (app/api/admin/_lib/requireAdmin.ts) both read
      // a caller's own profile row now that real login/session retrieval
      // is possible for the first time — this table was never reachable
      // through this shim before Phase 8 because nothing had a real
      // session to read a profile *with*.
      profiles: { filterable: ['id'], orderable: [] },
      // Phase 10: admin contractor detail (app/api/admin/contractors/[id]/
      // route.ts) reads a contractor's own contact_events to tally
      // phone/line/facebook/website clicks. contact_events_select_owner_or_admin
      // (0013_rls_policies.sql) already scopes this correctly (contractor
      // owner or admin only) — this table had a POST-only handler before
      // Phase 10 because nothing needed to read it back until now.
      contact_events: { filterable: ['contractor_id', 'event_type'], orderable: ['created_at'] },
    };
    const tableName = url.pathname.startsWith('/rest/v1/') ? url.pathname.slice('/rest/v1/'.length) : '';
    const tableMatch = READABLE_TABLES[tableName];
    if ((req.method === 'GET' || req.method === 'HEAD') && tableMatch) {
      const selectParam = url.searchParams.get('select') || '*';
      // `select=*` (this project's own convention avoids it everywhere
      // except getCurrentUser()'s `.select('*')` on profiles — the one
      // caller of this generic handler that actually sends it, now that
      // Phase 8 makes real login/session retrieval possible for the
      // first time) must NOT be quoted like a column name — `"*"` asks
      // Postgres for a column literally named `*`, which doesn't exist.
      const cols =
        selectParam === '*'
          ? '*'
          : selectParam
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

      // Issue #23: `.select('id', { count: 'exact', head: true })`
      // (app/api/contractors/me/portfolio/route.ts's pre-check against
      // the 20-image cap) sends a HEAD request with `Prefer: count=exact`
      // and reads the total back from the `Content-Range` response
      // header alone — no body (postgrest-js's processResponse skips
      // `res.text()` entirely for `method === 'HEAD'`). See
      // node_modules/@supabase/postgrest-js's PostgrestQueryBuilder.select().
      if (req.method === 'HEAD') {
        const { rows: countRows } = await client.query(
          `SELECT count(*)::int AS total FROM public.${tableName}${whereSql}`,
          filterParams
        );
        await client.query('COMMIT');
        res.writeHead(200, { 'Content-Range': `*/${countRows[0]?.total ?? 0}` });
        res.end();
        return;
      }

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
      // Phase 8: getCurrentUser() (src/lib/auth/authService.ts) reads
      // its own profiles row with `.single()`, which sets this exact
      // Accept header and needs ONE unwrapped object back — same fix as
      // the bespoke POST /rest/v1/contractors handler already has (see
      // its comment for the postgrest-js background). Never exercised
      // for `profiles` before Phase 8 because nothing had a real session
      // to call getCurrentUser() with. Harmless for every other
      // READABLE_TABLES caller — none of them use `.single()`.
      const wantsSingleObject = (req.headers['accept'] || '').includes('vnd.pgrst.object');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(wantsSingleObject ? (rows[0] ?? null) : rows));
      return;
    }

    // Issue #23: app/api/contractors/me/portfolio/route.ts (service_role,
    // `.insert({...}).select('id, project_name, image_url, thumbnail_url').single()`)
    // and app/api/contractors/register/route.ts (service_role, plain
    // `.insert({...})`, no select). Errors are translated into the same
    // real-PostgREST {code,message,details,hint} shape the `reviews`
    // handler above already uses, so trg_portfolio_images_enforce_limit's
    // P0001 (0019_portfolio_image_limit.sql) surfaces as
    // `insertError.code === 'P0001'` on the client exactly like a real
    // deployment — both call sites branch on that.
    if (req.method === 'POST' && url.pathname === '/rest/v1/portfolio_images') {
      const parsed = JSON.parse(body);
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      if (rows.length !== 1) {
        await client.query('ROLLBACK');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'this shim only supports inserting one portfolio image at a time' }));
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
      try {
        const { rows: inserted } = await client.query(
          `INSERT INTO public.portfolio_images (${cols.map((c) => `"${c}"`).join(', ')})
           VALUES (${placeholders})
           RETURNING ${returningSql}`,
          params
        );
        await client.query('COMMIT');
        const wantsSingleObject = (req.headers['accept'] || '').includes('vnd.pgrst.object');
        const responseBody = !selectParam ? [] : wantsSingleObject ? inserted[0] : inserted;
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responseBody));
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        const status = err.code === 'P0001' ? 409 : err.code === '42501' ? 403 : 500;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            code: err.code || null,
            message: err.message || String(err),
            details: err.detail || null,
            hint: err.hint || null,
          })
        );
      }
      return;
    }

    // Issue #23: app/api/contractors/me/portfolio/[id]/route.ts
    // (service_role) — `.delete().eq('id', id).eq('contractor_id', ownId).select('image_url').maybeSingle()`.
    // Deliberately scoped by BOTH id and contractor_id filters here, same
    // as the real query, so the row only comes back (and only gets
    // deleted) when both match — the app-layer half of the
    // cross-contractor-delete boundary; portfolio_images_owner_write
    // (0013_rls_policies.sql) is the real enforcement for a direct REST
    // attempt, unaffected by this shim since it's just SQL underneath.
    if (req.method === 'DELETE' && url.pathname === '/rest/v1/portfolio_images') {
      const id = parseEqFilter(url.searchParams.get('id'));
      const contractorId = parseEqFilter(url.searchParams.get('contractor_id'));
      if (!id) {
        await client.query('ROLLBACK');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'DELETE /rest/v1/portfolio_images requires id=' }));
        return;
      }
      const whereClauses = ['id = $1'];
      const params = [id];
      if (contractorId) {
        params.push(contractorId);
        whereClauses.push(`contractor_id = $${params.length}`);
      }
      const selectParam = url.searchParams.get('select');
      const returningSql = selectParam
        ? selectParam
            .split(',')
            .map((c) => `"${c.trim()}"`)
            .join(', ')
        : 'id';
      const { rows: deleted } = await client.query(
        `DELETE FROM public.portfolio_images WHERE ${whereClauses.join(' AND ')} RETURNING ${returningSql}`,
        params
      );
      await client.query('COMMIT');
      const wantsSingleObject = (req.headers['accept'] || '').includes('vnd.pgrst.object');
      const responseBody = !selectParam ? [] : wantsSingleObject ? (deleted[0] ?? null) : deleted;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responseBody));
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

    // Phase 9: review submission (src/lib/data/reviewSubmission.ts).
    // Deliberately NOT service_role — this is a plain authenticated
    // insert, run under whatever role/claims applyRequestRole() already
    // set up for this request (anon, or authenticated with the caller's
    // real sub/email). Real Postgres RLS — reviews_insert_authenticated
    // (0013, tightened by 0014_reviews_hardening.sql) — is what actually
    // decides whether this succeeds; this handler does no authorization
    // of its own. What it DOES do is translate a Postgres error into the
    // {code, message, details, hint} shape real PostgREST returns, so
    // supabase-js's PostgrestError.code comes through correctly on the
    // client (submitReview() switches on exactly that code) — the
    // generic catch-all at the bottom of this handler only ever returns
    // a bare `{error: String(err)}`, which has no `.code` for the client
    // to read.
    if (req.method === 'POST' && url.pathname === '/rest/v1/reviews') {
      const parsed = JSON.parse(body);
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      if (rows.length !== 1) {
        await client.query('ROLLBACK');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'this shim only supports inserting one review at a time' }));
        return;
      }
      const cols = Object.keys(rows[0]);
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const params = cols.map((c) => rows[0][c]);
      try {
        await client.query(
          `INSERT INTO public.reviews (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders})`,
          params
        );
        await client.query('COMMIT');
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end('[]');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        // 23505 unique_violation (duplicate review), 42501
        // insufficient_privilege (RLS WITH CHECK failed — anon caller,
        // spoofed reviewer_id, or a non-approved contractor), 23514
        // check_violation (rating out of range, comment too long) — the
        // three cases submitReview() actually branches on.
        const status = err.code === '23505' ? 409 : err.code === '42501' ? 403 : err.code === '23514' ? 400 : 500;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            code: err.code || null,
            message: err.message || String(err),
            details: err.detail || null,
            hint: err.hint || null,
          })
        );
      }
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

    // Phase 8: approve/reject (app/api/admin/contractors/[id]/{approve,reject}/route.ts),
    // service_role only in practice. `status` is the only column that
    // call ever sends, and the `status=eq.Y` query filter (in addition
    // to `id=eq.X`) is the atomic concurrency guard: a conditional
    // UPDATE that only touches a row still in the expected prior state,
    // so two simultaneous decisions on the same application can't both
    // "win" — whichever commits first changes the row, the second
    // matches zero rows and the route handler reports a conflict
    // instead of silently double-applying. Issue #23 added
    // `profile_image_url` to the whitelist below — app/api/contractors/register/route.ts
    // (after uploading the optional profile image) and
    // app/api/contractors/me/profile-image/route.ts both do
    // `.update({ profile_image_url }).eq('id', contractorId)` with no
    // status filter, so `statusFilter` stays undefined for those calls
    // and the WHERE clause is just `id = $N` — still column-whitelisted
    // rather than accepting an arbitrary column list from the request.
    if (req.method === 'PATCH' && url.pathname === '/rest/v1/contractors') {
      const id = parseEqFilter(url.searchParams.get('id'));
      const statusFilter = parseEqFilter(url.searchParams.get('status'));
      const parsed = JSON.parse(body);
      const ALLOWED_PATCH_COLUMNS = ['status', 'profile_image_url'];
      const setCols = Object.keys(parsed).filter((c) => ALLOWED_PATCH_COLUMNS.includes(c));
      if (!id || setCols.length === 0) {
        await client.query('ROLLBACK');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'PATCH /rest/v1/contractors requires id= and a status body field' }));
        return;
      }
      const setSql = setCols.map((c, i) => `"${c}" = $${i + 1}`).join(', ');
      const params = setCols.map((c) => parsed[c]);
      params.push(id);
      let whereSql = `WHERE id = $${params.length}`;
      if (statusFilter) {
        params.push(statusFilter);
        whereSql += ` AND status = $${params.length}`;
      }
      const selectParam = url.searchParams.get('select');
      const returningSql = selectParam
        ? selectParam
            .split(',')
            .map((c) => `"${c.trim()}"`)
            .join(', ')
        : 'id';
      const { rows: updated } = await client.query(
        `UPDATE public.contractors SET ${setSql} ${whereSql} RETURNING ${returningSql}`,
        params
      );
      await client.query('COMMIT');
      const wantsSingleObject = (req.headers['accept'] || '').includes('vnd.pgrst.object');
      // Zero matching rows + `.single()` -> `null`, not `[]` — the route
      // handler's own `if (!contractorRow)` check is what turns this
      // into "already decided / not found", so it doesn't matter that
      // this isn't byte-for-byte real PostgREST's 406-on-zero-rows
      // behavior; both arrive at the same "no data" outcome the caller
      // already handles.
      const responseBody = !selectParam ? [] : wantsSingleObject ? (updated[0] ?? null) : updated;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responseBody));
      return;
    }

    // Phase 8: audit log row written alongside every approve/reject
    // (service_role only). decideContractor() inserts one plain object,
    // not an array, so this normalizes the same way the
    // contact_events/contractor_categories handlers already do — the
    // Array.isArray-only check this route originally had silently
    // skipped every insert (returned 201 with nothing written) until a
    // real end-to-end smoke test caught it.
    if (req.method === 'POST' && url.pathname === '/rest/v1/admin_actions') {
      const parsed = JSON.parse(body);
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      if (rows.length > 0) {
        const cols = Object.keys(rows[0]);
        const valuesSql = rows
          .map((_, i) => `(${cols.map((_, j) => `$${i * cols.length + j + 1}`).join(', ')})`)
          .join(', ');
        const insertParams = rows.flatMap((r) => cols.map((c) => r[c]));
        await client.query(
          `INSERT INTO public.admin_actions (${cols.map((c) => `"${c}"`).join(', ')}) VALUES ${valuesSql}`,
          insertParams
        );
      }
      await client.query('COMMIT');
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end('[]');
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
