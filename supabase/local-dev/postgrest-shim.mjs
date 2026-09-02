/**
 * Minimal local stand-in for PostgREST. Originally built (Phase 2) so
 * scripts/seed-districts.mjs could run unmodified against local Postgres
 * (org egress policy blocks pulling the real PostgREST Docker image);
 * extended (Phase 4) with a generic read-only GET handler so
 * src/lib/data/{categories,provinces}.ts can be smoke-tested against
 * real seeded rows instead of only the "Supabase not configured" empty
 * state. Routes:
 *   GET  /rest/v1/provinces?select=...&order=...
 *   GET  /rest/v1/categories?select=...&order=...
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let body = '';
  for await (const chunk of req) body += chunk;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL ROLE ${roleForKey(req.headers['authorization'])}`);

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
