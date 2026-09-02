import { describe, expect, it } from 'vitest';
import {
  hasReviewFieldErrors,
  validateReviewSubmission,
  type ReviewSubmissionInput,
} from '../src/lib/validation/reviewSubmission';

const VALID: ReviewSubmissionInput = {
  rating: 5,
  comment: 'งานเรียบร้อยดีมาก ทำตามนัดหมาย แนะนำเลยครับ',
};

describe('validateReviewSubmission', () => {
  it('accepts a valid rating + comment', () => {
    expect(hasReviewFieldErrors(validateReviewSubmission(VALID))).toBe(false);
  });

  it('requires a rating', () => {
    expect(validateReviewSubmission({ ...VALID, rating: null })).toHaveProperty('rating');
  });

  it('rejects a rating outside 1-5', () => {
    expect(validateReviewSubmission({ ...VALID, rating: 0 })).toHaveProperty('rating');
    expect(validateReviewSubmission({ ...VALID, rating: 6 })).toHaveProperty('rating');
    expect(validateReviewSubmission({ ...VALID, rating: -1 })).toHaveProperty('rating');
  });

  it('rejects a non-integer rating', () => {
    expect(validateReviewSubmission({ ...VALID, rating: 3.5 })).toHaveProperty('rating');
  });

  it('accepts every integer rating from 1 to 5', () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      expect(validateReviewSubmission({ ...VALID, rating })).not.toHaveProperty('rating');
    }
  });

  it('requires a comment', () => {
    expect(validateReviewSubmission({ ...VALID, comment: '' })).toHaveProperty('comment');
    expect(validateReviewSubmission({ ...VALID, comment: '   ' })).toHaveProperty('comment');
  });

  it('rejects a comment shorter than the minimum', () => {
    expect(validateReviewSubmission({ ...VALID, comment: 'สั้นไป' })).toHaveProperty('comment');
  });

  it('rejects a comment longer than 2000 characters', () => {
    expect(validateReviewSubmission({ ...VALID, comment: 'a'.repeat(2001) })).toHaveProperty('comment');
  });

  it('accepts a comment at exactly the boundaries', () => {
    expect(validateReviewSubmission({ ...VALID, comment: 'a'.repeat(2000) })).not.toHaveProperty('comment');
  });
});
