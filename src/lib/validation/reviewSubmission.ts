/**
 * Field-level validation for review submission
 * (src/components/ReviewForm.tsx). Pure, synchronous, no I/O — mirrors
 * src/lib/validation/contractorRegistration.ts's pattern: this is UX
 * feedback only. The real, unspoofable enforcement is the database
 * itself — `reviews.rating`'s CHECK constraint (1-5) and
 * `reviews_comment_length`'s CHECK constraint (<=2000, added by
 * supabase/migrations/0014_reviews_hardening.sql) apply regardless of
 * what this function does or whether it's bypassed entirely.
 */

export interface ReviewSubmissionInput {
  rating: number | null;
  comment: string;
}

export interface ReviewFieldErrors {
  rating?: string;
  comment?: string;
}

const MIN_COMMENT_LENGTH = 10;
const MAX_COMMENT_LENGTH = 2000;

export function validateReviewSubmission(input: ReviewSubmissionInput): ReviewFieldErrors {
  const errors: ReviewFieldErrors = {};

  if (input.rating === null) {
    errors.rating = 'กรุณาให้คะแนน';
  } else if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    errors.rating = 'คะแนนต้องอยู่ระหว่าง 1-5 ดาว';
  }

  const comment = input.comment.trim();
  if (!comment) {
    errors.comment = 'กรุณาเขียนความคิดเห็น';
  } else if (comment.length < MIN_COMMENT_LENGTH) {
    errors.comment = `ความคิดเห็นสั้นเกินไป (อย่างน้อย ${MIN_COMMENT_LENGTH} ตัวอักษร)`;
  } else if (comment.length > MAX_COMMENT_LENGTH) {
    errors.comment = `ความคิดเห็นยาวเกินไป (ไม่เกิน ${MAX_COMMENT_LENGTH} ตัวอักษร)`;
  }

  return errors;
}

export function hasReviewFieldErrors(errors: ReviewFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
