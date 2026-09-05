/**
 * Unit tests for src/lib/auth/authErrors.ts (Issue #33). Uses real
 * AuthApiError instances (not mocks) so these tests exercise the exact
 * `isAuthApiError`/`.code` shape supabase-js actually produces.
 */
import { AuthApiError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { getSignInErrorMessage, getSignUpErrorMessage } from '../src/lib/auth/authErrors';

const FALLBACK = 'fallback message';

describe('getSignUpErrorMessage', () => {
  it('returns the friendly duplicate-email message for user_already_exists', () => {
    const err = new AuthApiError('User already registered', 422, 'user_already_exists');
    expect(getSignUpErrorMessage(err, FALLBACK)).toBe('อีเมลนี้ถูกใช้งานแล้ว');
  });

  it('falls back to the raw Error message for any other AuthApiError code', () => {
    const err = new AuthApiError('Some other failure', 500, 'unexpected_failure');
    expect(getSignUpErrorMessage(err, FALLBACK)).toBe('Some other failure');
  });

  it('falls back to the raw Error message for a plain Error', () => {
    const err = new Error('network down');
    expect(getSignUpErrorMessage(err, FALLBACK)).toBe('network down');
  });

  it('falls back to the caller-provided fallback for a non-Error value', () => {
    expect(getSignUpErrorMessage('not an error', FALLBACK)).toBe(FALLBACK);
  });
});

describe('getSignInErrorMessage', () => {
  it('returns the friendly wrong-password message for invalid_credentials', () => {
    const err = new AuthApiError('Invalid login credentials', 400, 'invalid_credentials');
    expect(getSignInErrorMessage(err, FALLBACK)).toBe('รหัสผ่านไม่ถูกต้อง');
  });

  it('maps invalid_credentials identically regardless of the underlying cause (anti-enumeration)', () => {
    // GoTrue returns this exact same code whether the password is wrong
    // OR the email has no account at all — the mapped message must not
    // introduce a distinction GoTrue itself doesn't make.
    const wrongPassword = new AuthApiError('Invalid login credentials', 400, 'invalid_credentials');
    const noSuchAccount = new AuthApiError('Invalid login credentials', 400, 'invalid_credentials');
    expect(getSignInErrorMessage(wrongPassword, FALLBACK)).toBe(
      getSignInErrorMessage(noSuchAccount, FALLBACK)
    );
  });

  it('falls back to the raw Error message for any other AuthApiError code', () => {
    const err = new AuthApiError('Email not confirmed', 400, 'email_not_confirmed');
    expect(getSignInErrorMessage(err, FALLBACK)).toBe('Email not confirmed');
  });

  it('falls back to the raw Error message for a plain Error', () => {
    const err = new Error('network down');
    expect(getSignInErrorMessage(err, FALLBACK)).toBe('network down');
  });

  it('falls back to the caller-provided fallback for a non-Error value', () => {
    expect(getSignInErrorMessage(null, FALLBACK)).toBe(FALLBACK);
  });
});
