import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deriveTitleCandidate, mapGraphApiError } from '../src/lib/facebook/graphApi';
import { isGraphApiErrorResponse, isGraphApiPost, type GraphApiPost } from '../src/lib/facebook/types';
import { getFacebookPageConfig } from '../src/lib/facebook/config';

function post(overrides: Partial<GraphApiPost> = {}): GraphApiPost {
  return {
    id: '111_222',
    created_time: '2026-01-01T00:00:00+0000',
    permalink_url: 'https://www.facebook.com/111/posts/222',
    ...overrides,
  };
}

describe('deriveTitleCandidate', () => {
  it('uses the post message as-is when it is a single short line', () => {
    expect(deriveTitleCandidate(post({ message: 'สวัสดีครับ วันนี้มีโปรโมชั่นพิเศษ' }))).toBe(
      'สวัสดีครับ วันนี้มีโปรโมชั่นพิเศษ'
    );
  });

  it('takes only the first line of a multi-line message', () => {
    expect(deriveTitleCandidate(post({ message: 'หัวข้อข่าว\n\nรายละเอียดยาว ๆ ต่อจากนี้...' }))).toBe('หัวข้อข่าว');
  });

  it('falls back to the full message when the first line is blank', () => {
    expect(deriveTitleCandidate(post({ message: '\nข้อความจริงอยู่บรรทัดสอง' }))).toBe('ข้อความจริงอยู่บรรทัดสอง');
  });

  it('returns a placeholder for a post with no message at all (photo-only post)', () => {
    expect(deriveTitleCandidate(post())).toBe('โพสต์จาก Facebook (ไม่มีข้อความ)');
  });

  it('returns a placeholder for a message that is only whitespace', () => {
    expect(deriveTitleCandidate(post({ message: '   \n  ' }))).toBe('โพสต์จาก Facebook (ไม่มีข้อความ)');
  });

  it('truncates a candidate longer than 200 characters with an ellipsis', () => {
    const long = 'ก'.repeat(250);
    const result = deriveTitleCandidate(post({ message: long }));
    expect(result.length).toBe(200);
    expect(result.endsWith('…')).toBe(true);
  });

  it('does not truncate a candidate at exactly 200 characters', () => {
    const exact = 'ก'.repeat(200);
    expect(deriveTitleCandidate(post({ message: exact }))).toBe(exact);
  });
});

describe('mapGraphApiError', () => {
  it('maps OAuthException / code 190 to an expired-token message', () => {
    expect(mapGraphApiError(190, 'OAuthException')).toContain('โทเค็น');
  });

  it('maps a permission-shaped code to a permissions message', () => {
    expect(mapGraphApiError(200, 'GraphMethodException')).toContain('สิทธิ์');
    expect(mapGraphApiError(10, 'OAuthException')).toContain('สิทธิ์');
  });

  it('maps rate-limit codes to a rate-limit message', () => {
    for (const code of [4, 17, 32, 613]) {
      expect(mapGraphApiError(code, 'OAuthException')).toContain('จำกัดจำนวนคำขอ');
    }
  });

  it('maps code 100 to a bad-request message', () => {
    expect(mapGraphApiError(100, 'GraphMethodException')).toContain('ไม่ถูกต้อง');
  });

  it('falls back to a generic message for an unrecognized code', () => {
    expect(mapGraphApiError(99999, 'SomeOtherException')).toBe('เกิดข้อผิดพลาดจาก Facebook กรุณาลองใหม่อีกครั้ง');
  });
});

describe('isGraphApiPost', () => {
  it('accepts a post with only the required fields', () => {
    expect(isGraphApiPost(post())).toBe(true);
  });

  it('accepts a post with every field present', () => {
    expect(isGraphApiPost(post({ message: 'hi', full_picture: 'https://scontent.xx.fbcdn.net/a.jpg' }))).toBe(true);
  });

  it('rejects a value missing a required field', () => {
    const withoutId: Record<string, unknown> = { ...post() };
    delete withoutId.id;
    expect(isGraphApiPost(withoutId)).toBe(false);
  });

  it('rejects a value where a required field has the wrong type', () => {
    expect(isGraphApiPost({ ...post(), id: 123 })).toBe(false);
  });

  it('rejects a value where an optional field has the wrong type', () => {
    expect(isGraphApiPost({ ...post(), message: 42 })).toBe(false);
  });

  it('rejects null and non-object values', () => {
    expect(isGraphApiPost(null)).toBe(false);
    expect(isGraphApiPost('a post')).toBe(false);
    expect(isGraphApiPost(undefined)).toBe(false);
  });
});

describe('isGraphApiErrorResponse', () => {
  it('accepts a well-formed Graph API error envelope', () => {
    expect(isGraphApiErrorResponse({ error: { message: 'bad', type: 'OAuthException', code: 190 } })).toBe(true);
  });

  it('rejects a value with no error key', () => {
    expect(isGraphApiErrorResponse({ data: [] })).toBe(false);
  });

  it('rejects an error object missing a required field', () => {
    expect(isGraphApiErrorResponse({ error: { message: 'bad', type: 'OAuthException' } })).toBe(false);
  });

  it('rejects null and non-object values', () => {
    expect(isGraphApiErrorResponse(null)).toBe(false);
    expect(isGraphApiErrorResponse('nope')).toBe(false);
  });
});

describe('getFacebookPageConfig', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    delete process.env.FACEBOOK_PAGE_ID;
    delete process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    delete process.env.FACEBOOK_GRAPH_API_VERSION;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('fails safely with a clear Thai message when unset', () => {
    const result = getFacebookPageConfig();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('FACEBOOK_PAGE_ID');
  });

  it('fails safely when only one of the two required vars is set', () => {
    process.env.FACEBOOK_PAGE_ID = '12345';
    expect(getFacebookPageConfig().ok).toBe(false);
  });

  it('succeeds and defaults the Graph API version when both required vars are set', () => {
    process.env.FACEBOOK_PAGE_ID = '12345';
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN = 'a-token';
    const result = getFacebookPageConfig();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.pageId).toBe('12345');
      expect(result.config.pageAccessToken).toBe('a-token');
      expect(result.config.graphApiVersion).toMatch(/^v\d+\.\d+$/);
    }
  });

  it('honors an explicit FACEBOOK_GRAPH_API_VERSION override', () => {
    process.env.FACEBOOK_PAGE_ID = '12345';
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN = 'a-token';
    process.env.FACEBOOK_GRAPH_API_VERSION = 'v99.0';
    const result = getFacebookPageConfig();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.config.graphApiVersion).toBe('v99.0');
  });
});
