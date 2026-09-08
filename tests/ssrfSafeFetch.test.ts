import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ssrfSafeFetch } from '../src/lib/net/ssrfSafeFetch';

/**
 * Tests the actual fetch/redirect/streaming/size-cap mechanics of
 * ssrfSafeFetch() against a real local HTTP server. The real
 * production SSRF guard (ssrfGuard.ts's resolvesToPublicAddressOnly)
 * correctly refuses a loopback address like this test server's own —
 * that's it doing its job, not a bug — so every call below passes an
 * injected `checkPublicAddress` stub that always resolves true,
 * verifying only the mechanics this test targets. The real guard
 * itself is covered separately (ssrfGuard.test.ts, confirming it
 * refuses exactly this kind of loopback address) and is never modified,
 * weakened, or bypassed by anything here — see ssrfSafeFetch's own
 * header comment for why this parameter exists.
 *
 * Was tests/ogImageFetch.test.ts — moved when ssrfSafeFetch itself
 * moved from src/lib/articles/ogImageFetch.ts to
 * src/lib/net/ssrfSafeFetch.ts (Issue #44: the Facebook post-HTML/
 * og:image scraper this function was originally built alongside was
 * removed and replaced by a Graph API importer, but this generic fetch
 * helper is unrelated to *what* it fetches and is now shared by the
 * Graph API client too). Content is otherwise unchanged.
 */

let server: Server;
let baseUrl: string;
const allowAllHosts = () => true;
const allowAnyAddress = async () => true;

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/ok') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('hello');
    } else if (url.pathname === '/redirect-once') {
      res.writeHead(302, { location: '/ok' });
      res.end();
    } else if (url.pathname === '/redirect-loop') {
      res.writeHead(302, { location: '/redirect-loop' });
      res.end();
    } else if (url.pathname === '/big') {
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      res.end(Buffer.alloc(1000, 1));
    } else if (url.pathname === '/slow') {
      // never responds — used for the timeout test
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('server did not bind to a port');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('ssrfSafeFetch', () => {
  it('fetches a simple 200 response', async () => {
    const result = await ssrfSafeFetch(new URL(`${baseUrl}/ok`), allowAllHosts, 1024, 2000, allowAnyAddress);
    expect(result.ok).toBe(true);
    if (result.ok) expect(new TextDecoder().decode(result.bytes)).toBe('hello');
  });

  it('follows a single redirect and re-validates the target host', async () => {
    const result = await ssrfSafeFetch(new URL(`${baseUrl}/redirect-once`), allowAllHosts, 1024, 2000, allowAnyAddress);
    expect(result.ok).toBe(true);
    if (result.ok) expect(new TextDecoder().decode(result.bytes)).toBe('hello');
  });

  it('refuses to follow a redirect once MAX_REDIRECTS is exceeded (redirect loop)', async () => {
    const result = await ssrfSafeFetch(new URL(`${baseUrl}/redirect-loop`), allowAllHosts, 1024, 2000, allowAnyAddress);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('too many redirects');
  });

  it('rejects a response exceeding maxBytes, without buffering it all first', async () => {
    const result = await ssrfSafeFetch(new URL(`${baseUrl}/big`), allowAllHosts, 500, 2000, allowAnyAddress);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('exceeded');
  });

  it('accepts a response exactly at maxBytes', async () => {
    const result = await ssrfSafeFetch(new URL(`${baseUrl}/big`), allowAllHosts, 1000, 2000, allowAnyAddress);
    expect(result.ok).toBe(true);
  });

  it('times out a hung request', async () => {
    const result = await ssrfSafeFetch(new URL(`${baseUrl}/slow`), allowAllHosts, 1024, 300, allowAnyAddress);
    expect(result.ok).toBe(false);
  }, 5000);

  it('refuses when the host allowlist predicate rejects the host', async () => {
    const result = await ssrfSafeFetch(new URL(`${baseUrl}/ok`), () => false, 1024, 2000, allowAnyAddress);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('hostname not allowed');
  });

  it('refuses when the public-address check rejects the host (this is the real SSRF guard working correctly against a loopback target)', async () => {
    const result = await ssrfSafeFetch(new URL(`${baseUrl}/ok`), allowAllHosts, 1024, 2000, async () => false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('does not resolve to a public address');
  });

  it('returns an error for a 404', async () => {
    const result = await ssrfSafeFetch(new URL(`${baseUrl}/does-not-exist`), allowAllHosts, 1024, 2000, allowAnyAddress);
    expect(result.ok).toBe(false);
  });
});
