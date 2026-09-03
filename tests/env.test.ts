import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getPublicSupabaseConfig, getServiceRoleSupabaseConfig } from '../src/lib/env';

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
