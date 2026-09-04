import { describe, expect, it } from 'vitest';
import {
  hasFieldErrors,
  isValidUrl,
  validateContractorRegistration,
  type ContractorRegistrationInput,
} from '../src/lib/validation/contractorRegistration';

const VALID: ContractorRegistrationInput = {
  email: 'somchai@example.com',
  password: 'secret123',
  fullName: 'สมชาย ใจดี',
  businessName: 'ช่างไฟสมชาย',
  description: 'รับเดินสายไฟ ติดตั้งเบรกเกอร์ ซ่อมไฟฟ้าบ้าน',
  provinceId: 1,
  districtId: 10,
  categoryIds: [2, 5],
  phone: '0812345678',
  lineId: 'somchai_elec',
  facebookUrl: 'https://facebook.com/somchai',
  websiteUrl: 'https://somchai-elec.example.com',
  address: '123 หมู่ 4 ต.บางรัก',
  yearsExperience: '8',
};

describe('validateContractorRegistration', () => {
  it('accepts a fully valid submission', () => {
    expect(hasFieldErrors(validateContractorRegistration(VALID))).toBe(false);
  });

  it('accepts the minimal required fields with everything optional left blank', () => {
    const minimal: ContractorRegistrationInput = {
      ...VALID,
      description: '',
      districtId: null,
      phone: '',
      lineId: '',
      facebookUrl: '',
      websiteUrl: '',
      address: '',
      yearsExperience: '',
    };
    expect(hasFieldErrors(validateContractorRegistration(minimal))).toBe(false);
  });

  it('rejects a missing/malformed email', () => {
    expect(validateContractorRegistration({ ...VALID, email: '' })).toHaveProperty('email');
    expect(validateContractorRegistration({ ...VALID, email: 'not-an-email' })).toHaveProperty('email');
  });

  it('rejects a short password', () => {
    expect(validateContractorRegistration({ ...VALID, password: '123' })).toHaveProperty('password');
  });

  it('rejects a missing/too-long business name', () => {
    expect(validateContractorRegistration({ ...VALID, businessName: '' })).toHaveProperty('businessName');
    expect(validateContractorRegistration({ ...VALID, businessName: 'ก'.repeat(201) })).toHaveProperty(
      'businessName'
    );
  });

  it('requires a province', () => {
    expect(validateContractorRegistration({ ...VALID, provinceId: null })).toHaveProperty('provinceId');
  });

  it('requires at least one category, caps at 10', () => {
    expect(validateContractorRegistration({ ...VALID, categoryIds: [] })).toHaveProperty('categoryIds');
    expect(
      validateContractorRegistration({ ...VALID, categoryIds: Array.from({ length: 11 }, (_, i) => i + 1) })
    ).toHaveProperty('categoryIds');
  });

  it('rejects a malformed Thai phone number but accepts a well-formed one', () => {
    expect(validateContractorRegistration({ ...VALID, phone: '123' })).toHaveProperty('phone');
    expect(validateContractorRegistration({ ...VALID, phone: '02-123-4567' })).not.toHaveProperty('phone');
  });

  it('rejects facebook/website URLs without http(s)', () => {
    expect(validateContractorRegistration({ ...VALID, facebookUrl: 'facebook.com/x' })).toHaveProperty(
      'facebookUrl'
    );
    expect(validateContractorRegistration({ ...VALID, websiteUrl: 'javascript:alert(1)' })).toHaveProperty(
      'websiteUrl'
    );
  });

  it('rejects an out-of-range or non-integer years of experience', () => {
    expect(validateContractorRegistration({ ...VALID, yearsExperience: '-1' })).toHaveProperty('yearsExperience');
    expect(validateContractorRegistration({ ...VALID, yearsExperience: '81' })).toHaveProperty('yearsExperience');
    expect(validateContractorRegistration({ ...VALID, yearsExperience: '3.5' })).toHaveProperty('yearsExperience');
  });
});

// Issue #19: an already-logged-in user becoming a contractor doesn't
// collect email/password (see ContractorRegistrationForm.tsx and
// app/api/contractors/register/route.ts) — the server passes
// `requireAccountFields: false` for that flow so this same shared
// validator doesn't reject the request for fields it was never asked
// for.
describe('validateContractorRegistration with requireAccountFields: false', () => {
  const LOGGED_IN = { ...VALID, email: '', password: '' };

  it('does not require email/password', () => {
    const errors = validateContractorRegistration(LOGGED_IN, { requireAccountFields: false });
    expect(errors).not.toHaveProperty('email');
    expect(errors).not.toHaveProperty('password');
    expect(hasFieldErrors(errors)).toBe(false);
  });

  it('still validates every other field the same way', () => {
    expect(
      validateContractorRegistration({ ...LOGGED_IN, businessName: '' }, { requireAccountFields: false })
    ).toHaveProperty('businessName');
    expect(
      validateContractorRegistration({ ...LOGGED_IN, provinceId: null }, { requireAccountFields: false })
    ).toHaveProperty('provinceId');
  });

  it('defaults to requiring account fields when the option is omitted (unchanged pre-Issue-#19 behavior)', () => {
    expect(validateContractorRegistration(LOGGED_IN)).toHaveProperty('email');
    expect(validateContractorRegistration(LOGGED_IN)).toHaveProperty('password');
  });
});

// QA #22: isValidUrl() is now also the render-time guard
// app/contractors/[slug]/page.tsx runs on facebook_url/website_url
// immediately before using them as an `<a href>` — a value reaching
// that render is not guaranteed to have ever passed through this
// module's registration-time check (RLS lets a contractor write any
// string to those columns via a direct API call). These cases are the
// exact XSS-relevant inputs that render-time guard exists to reject.
describe('isValidUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isValidUrl('https://facebook.com/somchai')).toBe(true);
    expect(isValidUrl('http://example.com')).toBe(true);
  });

  it('rejects javascript: URIs (the stored-XSS vector this guards against)', () => {
    expect(isValidUrl('javascript:alert(document.cookie)')).toBe(false);
    expect(isValidUrl('  javascript:alert(1)')).toBe(false);
    expect(isValidUrl('JaVaScRiPt:alert(1)')).toBe(false);
  });

  it('rejects other non-http(s) schemes', () => {
    expect(isValidUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isValidUrl('vbscript:msgbox(1)')).toBe(false);
    expect(isValidUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects malformed/non-URL strings without throwing', () => {
    expect(isValidUrl('not a url')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });
});
