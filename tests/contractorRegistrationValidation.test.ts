import { describe, expect, it } from 'vitest';
import {
  hasFieldErrors,
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
