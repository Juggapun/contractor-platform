/**
 * Phase 7 — contractor registration. Server-only Route Handler: the one
 * legitimate place within app/ to import the service_role admin client
 * (see eslint.config.js's app/api/** override and src/lib/supabase/admin.ts's
 * header comment) — needed here for two operations that specifically
 * require it:
 *   - promoteNewAccountToContractor() (src/lib/auth/authService.ts),
 *     which trg_profiles_lock_role (0004_profiles.sql) refuses to any
 *     non-trusted caller by design.
 *   - inserting the new `contractors` row itself. `client.auth.signUp()`
 *     may or may not return an active session depending on whether the
 *     eventual hosted Supabase project has email confirmation enabled —
 *     that's a project setting this environment has no way to know or
 *     test (see docs/AUTHENTICATION.md's disclosed gap). Rather than
 *     branching on that, this always inserts the contractors row itself,
 *     immediately after signUp/promote succeed, using the userId the
 *     signUp call itself just returned — never a client-supplied id.
 *     This is the same trust boundary already used for promotion, not a
 *     new one, and status/verification_status/plan_tier/featured_until/
 *     rating_avg/review_count/profile_completeness are never set here —
 *     the column defaults ('pending'/'unverified'/etc., see
 *     0005_contractors.sql) are what actually apply, so this route can
 *     never make a contractor publicly visible on its own.
 *
 * No new auth architecture: this calls the exact same signUpContractor()/
 * promoteNewAccountToContractor() built in Phase 3, unmodified.
 */
import { NextResponse } from 'next/server';
import { signUpContractor, promoteNewAccountToContractor } from '@/lib/auth/authService';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getProvinces } from '@/lib/data/provinces';
import { getDistrictsByProvince } from '@/lib/data/districts';
import { getCategories } from '@/lib/data/categories';
import {
  validateContractorRegistration,
  hasFieldErrors,
  type ContractorRegistrationInput,
  type FieldErrors,
} from '@/lib/validation/contractorRegistration';
import { createOneOffAuthClient } from '../../_lib/authClients';

function coerceInput(body: unknown): ContractorRegistrationInput {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const numArray = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)) : [];

  return {
    email: str(b.email),
    password: str(b.password),
    fullName: str(b.fullName),
    businessName: str(b.businessName),
    description: str(b.description),
    provinceId: num(b.provinceId),
    districtId: num(b.districtId),
    categoryIds: numArray(b.categoryIds),
    phone: str(b.phone),
    lineId: str(b.lineId),
    facebookUrl: str(b.facebookUrl),
    websiteUrl: str(b.websiteUrl),
    address: str(b.address),
    yearsExperience: str(b.yearsExperience),
  };
}

/** Thai slug convention (founder decision, supabase/seed.sql): the
 * business name directly, whitespace collapsed to '-', no English
 * transliteration. Strips characters that would break a URL path
 * segment; anything else (including Thai script) passes through. */
function slugify(businessName: string): string {
  const base = businessName
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[/?#%]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'ผู้รับเหมา';
}

async function generateUniqueSlug(
  businessName: string,
  adminClient: ReturnType<typeof getSupabaseAdminClient>
): Promise<string> {
  const base = slugify(businessName);
  for (let attempt = 0; attempt < 30; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const { data } = await adminClient.from('contractors').select('id').eq('slug', candidate).maybeSingle();
    if (!data) return candidate;
  }
  throw new Error('generateUniqueSlug: exhausted attempts');
}

/** Cross-checks provinceId/districtId/categoryIds against real rows —
 * validateContractorRegistration() (pure, no I/O) can only check shape. */
async function validateReferencedIds(input: ContractorRegistrationInput): Promise<FieldErrors> {
  const errors: FieldErrors = {};
  const [provinces, categories] = await Promise.all([getProvinces(), getCategories()]);

  if (input.provinceId !== null && !provinces.some((p) => p.id === input.provinceId)) {
    errors.provinceId = 'จังหวัดที่เลือกไม่ถูกต้อง';
  }

  if (input.districtId !== null && input.provinceId !== null && !errors.provinceId) {
    const districts = await getDistrictsByProvince(input.provinceId);
    if (!districts.some((d) => d.id === input.districtId)) {
      errors.districtId = 'อำเภอ/เขตที่เลือกไม่ตรงกับจังหวัดที่เลือก';
    }
  }

  const validCategoryIds = new Set(categories.map((c) => c.id));
  if (input.categoryIds.some((id) => !validCategoryIds.has(id))) {
    errors.categoryIds = 'หมวดหมู่ที่เลือกไม่ถูกต้อง';
  }

  return errors;
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }

  // Everything below this point must never throw past this function
  // without going through NextResponse.json() first — the client
  // (ContractorRegistrationForm.tsx) always calls `response.json()`
  // unconditionally on every status code. An exception that escapes
  // uncaught here (e.g. getSupabaseAdminClient() throwing because
  // SUPABASE_SERVICE_ROLE_KEY isn't set in this deployment) makes
  // Next.js/Vercel's own error handling return a non-JSON or empty body,
  // which surfaces to the user as "Unexpected end of JSON input" instead
  // of a real error message (Issue #14). This outer try/catch is the
  // backstop for exactly that class of bug, on top of the
  // already-specific try/catches below for the sign-up and
  // business-profile-insert steps (which give more precise messages).
  try {
    const input = coerceInput(body);

    const shapeErrors = validateContractorRegistration(input);
    if (hasFieldErrors(shapeErrors)) {
      return NextResponse.json(
        { ok: false, error: 'กรุณาตรวจสอบข้อมูลที่กรอก', fieldErrors: shapeErrors },
        { status: 400 }
      );
    }

    const referenceErrors = await validateReferencedIds(input);
    if (hasFieldErrors(referenceErrors)) {
      return NextResponse.json(
        { ok: false, error: 'กรุณาตรวจสอบข้อมูลที่กรอก', fieldErrors: referenceErrors },
        { status: 400 }
      );
    }

    return await submitContractorApplication(input);
  } catch (err) {
    console.error('contractor registration: unexpected failure', err);
    return NextResponse.json(
      { ok: false, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}

async function submitContractorApplication(input: ContractorRegistrationInput): Promise<NextResponse> {
  const adminClient = getSupabaseAdminClient();
  const email = input.email.trim();
  const businessName = input.businessName.trim();

  let userId: string;
  try {
    const authResult = await signUpContractor(
      { email, password: input.password, ...(input.fullName.trim() ? { fullName: input.fullName.trim() } : {}) },
      (id) => promoteNewAccountToContractor(id, adminClient),
      createOneOffAuthClient()
    );
    userId = authResult.user.id;
  } catch (err) {
    // Deliberately generic — never repeats the auth provider's raw error
    // text (which can reveal whether an email is already registered) to
    // the client. See Issue #4's "avoid leaking whether another
    // account/email already exists" requirement.
    console.error('contractor registration: sign-up failed', err);
    return NextResponse.json(
      { ok: false, error: 'ไม่สามารถสมัครสมาชิกได้ กรุณาตรวจสอบข้อมูลหรือลองใหม่อีกครั้ง' },
      { status: 400 }
    );
  }

  try {
    const slug = await generateUniqueSlug(businessName, adminClient);

    const { data: contractorRow, error: contractorError } = await adminClient
      .from('contractors')
      .insert({
        user_id: userId,
        business_name: businessName,
        slug,
        description: input.description.trim() || null,
        phone: input.phone.trim() || null,
        line_id: input.lineId.trim() || null,
        facebook_url: input.facebookUrl.trim() || null,
        website_url: input.websiteUrl.trim() || null,
        province_id: input.provinceId,
        district_id: input.districtId,
        address: input.address.trim() || null,
        years_experience: input.yearsExperience.trim() ? Number(input.yearsExperience.trim()) : null,
      })
      .select('id, slug, status')
      .single();

    if (contractorError || !contractorRow) {
      throw contractorError ?? new Error('contractors insert returned no row');
    }

    if (input.categoryIds.length > 0) {
      const { error: categoriesError } = await adminClient
        .from('contractor_categories')
        .insert(input.categoryIds.map((categoryId) => ({ contractor_id: contractorRow.id, category_id: categoryId })));
      if (categoriesError) throw categoriesError;
    }

    return NextResponse.json(
      { ok: true, businessName, slug: contractorRow.slug, status: contractorRow.status },
      { status: 201 }
    );
  } catch (err) {
    // The auth account (and its contractor-role promotion) already
    // succeeded at this point — there is no admin.deleteUser() rollback
    // in this local-dev shim (see supabase/local-dev/postgrest-shim.mjs's
    // header comment), so a failure here can leave a contractor-role
    // account with no (or an incomplete) contractors row. Disclosed as a
    // known limitation in docs/PHASE7-CONTRACTOR-REGISTRATION-REPORT.md
    // rather than silently pretended away.
    console.error('contractor registration: business-profile insert failed', err, { userId });
    return NextResponse.json(
      {
        ok: false,
        error:
          'สร้างบัญชีสำเร็จ แต่บันทึกข้อมูลธุรกิจไม่สำเร็จ กรุณาลองสมัครใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบหากยังพบปัญหา',
      },
      { status: 500 }
    );
  }
}
