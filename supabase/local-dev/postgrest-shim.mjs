/**
 * Minimal local stand-in for PostgREST. Originally built (Phase 2) so
 * scripts/seed-districts.mjs could run unmodified against local Postgres
 * (org egress policy blocks pulling the real PostgREST Docker image);
 * extended (Phase 4) with a generic read-only GET handler so
 * src/lib/data/{categories,provinces}.ts can be smoke-tested against
 * real seeded rows instead of only the "Supabase not configured" empty
 * state; extended again (Phase 5) with a purpose-built handler for the
 * real contractor search query. Routes:
 *   GET  /rest/v1/provinces?select=...&order=...
 *   GET  /rest/v1/categories?select=...&order=...
 *   GET  /rest/v1/contractors?...  — see handleContractorsSearch() below;
 *        recognizes exactly the filter/embed/range shape
 *        src/lib/data/contractors.ts's searchContractors() sends (not a
 *        generic PostgREST embedded-query parser).
 *   POST /rest/v1/districts?on_conflict=province_id,slug  (Prefer: resolution=merge-duplicates)
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let body = '';
  for await (const chunk of req) body += chunk;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
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

    const READABLE_TABLES = ['provinces', 'categories'];
    const tableMatch = READABLE_TABLES.find((t) => url.pathname === `/rest/v1/${t}`);
    if (req.method === 'GET' && tableMatch) {
      const selectParam = url.searchParams.get('select') || '*';
      const cols = selectParam
        .split(',')
        .map((c) => `"${c.trim()}"`)
        .join(', ');

      // supabase-js's .order('col', { ascending }) becomes ?order=col.asc / col.desc
      const orderParam = url.searchParams.get('order');
      let orderSql = '';
      if (orderParam) {
        const [col, dir] = orderParam.split('.');
        const direction = dir === 'desc' ? 'DESC' : 'ASC';
        orderSql = ` ORDER BY "${col}" ${direction}`;
      }

      const { rows } = await client.query(`SELECT ${cols} FROM public.${tableMatch}${orderSql}`);
      await client.query('COMMIT');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows));
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
