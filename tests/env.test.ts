import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getPublicSupabaseConfig, getServiceRoleSupabaseConfig, getSiteUrl } from '../src/lib/env';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('getPublicSupabaseConfig', () => {
  it('passes through a correctly-shaped project URL unchanged', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcxyz.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    expect(getPublicSupabaseConfig()).toEqual({
      url: 'https://abcxyz.supabase.co',
      anonKey: 'anon-key',
    });
  });

  // Issue #12 Beta report: Province/Job Type dropdowns were empty even
  // after seeding real data. Root cause candidate — Supabase's dashboard
  // shows a "REST" URL (project URL + `/rest/v1/`) right next to the
  // actual "Project URL"; pasting the former into
  // NEXT_PUBLIC_SUPABASE_URL makes supabase-js build a doubled,
  // nonexistent path for every request, which getProvinces() etc. all
  // catch and silently turn into an empty array. This strips it.
  it('strips an accidentally-pasted /rest/v1/ suffix', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcxyz.supabase.co/rest/v1/';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    expect(getPublicSupabaseConfig().url).toBe('https://abcxyz.supabase.co');
  });

  it('strips a /rest/v1 suffix with no trailing slash', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcxyz.supabase.co/rest/v1';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    expect(getPublicSupabaseConfig().url).toBe('https://abcxyz.supabase.co');
  });

  it('strips a plain trailing slash', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcxyz.supabase.co/';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    expect(getPublicSupabaseConfig().url).toBe('https://abcxyz.supabase.co');
  });

  it('throws when the URL is missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    expect(() => getPublicSupabaseConfig()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it('throws when the anon key is missing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcxyz.supabase.co';
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(() => getPublicSupabaseConfig()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });
});

// Issue #47 STEP 3: Production's og:url/canonical were pointing at
// localhost because NEXT_PUBLIC_SITE_URL was never set in Vercel, and
// this session has no Vercel access to set it directly. getSiteUrl()
// now falls back to Vercel's own auto-injected deployment env vars
// before giving up to localhost.
describe('getSiteUrl', () => {
  const clearAll = () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
  };

  it('prefers an explicit NEXT_PUBLIC_SITE_URL over anything Vercel-provided', () => {
    clearAll();
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com/';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'ignored.vercel.app';
    process.env.VERCEL_URL = 'also-ignored.vercel.app';
    expect(getSiteUrl()).toBe('https://example.com');
  });

  it('falls back to VERCEL_PROJECT_PRODUCTION_URL when explicit is unset', () => {
    clearAll();
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'contractor-platform.vercel.app';
    process.env.VERCEL_URL = 'contractor-platform-abc123.vercel.app';
    expect(getSiteUrl()).toBe('https://contractor-platform.vercel.app');
  });

  it('falls back to VERCEL_URL when neither explicit nor the production alias is set', () => {
    clearAll();
    process.env.VERCEL_URL = 'contractor-platform-f2enlz97y-juggapun.vercel.app';
    expect(getSiteUrl()).toBe('https://contractor-platform-f2enlz97y-juggapun.vercel.app');
  });

  it('falls back to localhost when nothing is set (plain local dev)', () => {
    clearAll();
    expect(getSiteUrl()).toBe('http://localhost:3000');
  });

  it('strips a trailing slash from every source', () => {
    clearAll();
    process.env.VERCEL_URL = 'contractor-platform.vercel.app/';
    expect(getSiteUrl()).toBe('https://contractor-platform.vercel.app');
  });
});

describe('getServiceRoleSupabaseConfig', () => {
  it('also strips an accidentally-pasted /rest/v1/ suffix', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcxyz.supabase.co/rest/v1/';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    expect(getServiceRoleSupabaseConfig()).toEqual({
      url: 'https://abcxyz.supabase.co',
      serviceRoleKey: 'service-role-key',
    });
  });
});
