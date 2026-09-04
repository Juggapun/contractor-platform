/**
 * Field-level validation for the Phase 7 contractor registration form.
 * Pure, synchronous, no I/O — deliberately importable from BOTH the
 * client form (src/components/ContractorRegistrationForm.tsx, for
 * immediate UX feedback) and the server route handler
 * (app/api/contractors/register/route.ts, the actual security boundary).
 *
 * This module can only check shape/format. It has no database access, so
 * it cannot confirm a provinceId/districtId/categoryId actually exists —
 * the route handler does that separately against real data after this
 * passes. Never trust the client-side pass alone; the server always
 * re-runs this exact function before writing anything.
 */

export interface ContractorRegistrationInput {
  email: string;
  password: string;
  fullName: string;
  businessName: string;
  description: string;
  provinceId: number | null;
  districtId: number | null;
  categoryIds: number[];
  phone: string;
  lineId: string;
  facebookUrl: string;
  websiteUrl: string;
  address: string;
  yearsExperience: string;
}

export type FieldErrors = Partial<Record<keyof ContractorRegistrationInput, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const THAI_MOBILE_RE = /^0\d{8,9}$/;

/**
 * QA #22: also reused by app/contractors/[slug]/page.tsx to re-validate
 * facebook_url/website_url immediately before rendering them as an
 * `href` — this function being the registration form's validator does
 * NOT mean every value in that column passed it. RLS's
 * `contractors_update_own` policy (0013_rls_policies.sql) lets a
 * contractor write any string to those columns via a direct REST call
 * that never goes through this validator at all (confirmed directly:
 * `javascript:alert(1)` round-trips through a raw authenticated UPDATE
 * with no error), and there's no DB CHECK constraint on either column
 * either. A `javascript:` URI rendered as a raw `<a href>` executes in
 * the browser of anyone who clicks it — a real stored-XSS vector
 * against a contractor's own profile visitors, not a theoretical one.
 * The registration route re-running this same function on write is a
 * courtesy that only covers ONE write path; the render-time check here
 * is what actually closes the vulnerability regardless of how a bad
 * value got into the row.
 */
export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface ValidateContractorRegistrationOptions {
  /** Issue #19: an already-logged-in user submitting this form isn't
   * creating a new Auth account, so email/password aren't collected and
   * must not be required. Both the client form and the server route
   * pass `false` here for that flow — see
   * app/api/contractors/_lib/resolveRequestingUser.ts. Defaults to
   * `true` (the original new-account-signup behavior). */
  requireAccountFields?: boolean;
}

/** Validates the whole form. Returns an empty object when there are no errors. */
export function validateContractorRegistration(
  input: ContractorRegistrationInput,
  options: ValidateContractorRegistrationOptions = {}
): FieldErrors {
  const { requireAccountFields = true } = options;
  const errors: FieldErrors = {};

  if (requireAccountFields) {
    const email = input.email.trim();
    if (!email) {
      errors.email = 'กรุณากรอกอีเมล';
    } else if (!EMAIL_RE.test(email)) {
      errors.email = 'รูปแบบอีเมลไม่ถูกต้อง';
    }

    if (!input.password) {
      errors.password = 'กรุณากรอกรหัสผ่าน';
    } else if (input.password.length < 6) {
      errors.password = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
    }
  }

  const businessName = input.businessName.trim();
  if (!businessName) {
    errors.businessName = 'กรุณากรอกชื่อธุรกิจ/ร้าน';
  } else if (businessName.length < 2) {
    errors.businessName = 'ชื่อธุรกิจสั้นเกินไป';
  } else if (businessName.length > 200) {
    errors.businessName = 'ชื่อธุรกิจยาวเกินไป (ไม่เกิน 200 ตัวอักษร)';
  }

  if (input.description.trim().length > 2000) {
    errors.description = 'คำอธิบายยาวเกินไป (ไม่เกิน 2000 ตัวอักษร)';
  }

  if (input.provinceId === null) {
    errors.provinceId = 'กรุณาเลือกจังหวัด';
  }

  const categoryIds = Array.from(new Set(input.categoryIds));
  if (categoryIds.length === 0) {
    errors.categoryIds = 'กรุณาเลือกอย่างน้อย 1 หมวดหมู่งาน';
  } else if (categoryIds.length > 10) {
    errors.categoryIds = 'เลือกได้ไม่เกิน 10 หมวดหมู่';
  }

  const phone = input.phone.trim().replace(/[\s-]/g, '');
  if (phone && !THAI_MOBILE_RE.test(phone)) {
    errors.phone = 'รูปแบบเบอร์โทรไม่ถูกต้อง (เช่น 0812345678)';
  }

  if (input.lineId.trim().length > 100) {
    errors.lineId = 'LINE ID ยาวเกินไป';
  }

  const facebookUrl = input.facebookUrl.trim();
  if (facebookUrl && !isValidUrl(facebookUrl)) {
    errors.facebookUrl = 'ลิงก์ Facebook ต้องขึ้นต้นด้วย http:// หรือ https://';
  }

  const websiteUrl = input.websiteUrl.trim();
  if (websiteUrl && !isValidUrl(websiteUrl)) {
    errors.websiteUrl = 'ลิงก์เว็บไซต์ต้องขึ้นต้นด้วย http:// หรือ https://';
  }

  if (input.address.trim().length > 500) {
    errors.address = 'ที่อยู่ยาวเกินไป (ไม่เกิน 500 ตัวอักษร)';
  }

  const yearsExperienceRaw = input.yearsExperience.trim();
  if (yearsExperienceRaw) {
    const years = Number(yearsExperienceRaw);
    if (!Number.isInteger(years) || years < 0 || years > 80) {
      errors.yearsExperience = 'ปีประสบการณ์ต้องเป็นจำนวนเต็ม 0-80';
    }
  }

  return errors;
}

export function hasFieldErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
