/**
 * Phase 7 — contractor registration. Server-only Route Handler: the one
 * legitimate place within app/ to import the service_role admin client
 * (see eslint.config.js's app/api/** override and src/lib/supabase/admin.ts's
 * header comment) — needed here for operations that specifically
 * require it:
 *   - promoteAccountToContractor() (src/lib/auth/authService.ts),
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
 *   - resolveRequestingUser()'s fresh `profiles.role` read.
 *   - uploadContractorImage()'s Storage writes (Issue #23) — same
 *     reasoning as the contractors row insert: the caller is trusted
 *     server-side (a valid image file, size- and type-checked) before
 *     this route uses its own elevated access to write it, never the
 *     caller's own credentials.
 *
 * Issue #19: this route used to unconditionally call `signUp()`, even
 * for a request from an already-logged-in user — whose email is already
 * registered, so Supabase Auth correctly rejected it with
 * `user_already_exists`, surfaced to the visitor as a confusing generic
 * failure. resolveRequestingUser() (app/api/contractors/_lib/) is the
 * fix: it checks for a bearer token the SAME way requireAdmin.ts does
 * (verified against the real auth provider, never trusted from a claim)
 * and, when one is present and valid, this route uses that verified
 * user id directly — never calling `signUp()` for that request at all —
 * instead of the brand-new-account path below.
 *
 * Issue #23: the request body switched from JSON to `multipart/form-data`
 * so this same submission can optionally carry a profile image and up
 * to 5 portfolio images alongside the existing text fields — the issue
 * asks for both to be available "immediately" at registration, not as a
 * separate follow-up step. Every file is re-validated here
 * (validateImageUpload — real magic-byte sniffing, not the claimed
 * Content-Type/filename) regardless of what the `<input accept>` hint
 * on the client allowed through; a filename or extension the client
 * sent is never trusted or persisted anywhere.
 */
import { NextResponse } from 'next/server';
import { signUpContractor, promoteAccountToContractor } from '@/lib/auth/authService';
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
import { validateImageUpload, type ValidatedImage } from '@/lib/uploads/imageValidation';
import { generateProfileVariant, generatePortfolioVariants } from '@/lib/uploads/imageOptimization';
import { generateContractorMediaPath, uploadContractorImage } from '@/lib/storage/contractorMedia';
import { createOneOffAuthClient } from '../../_lib/authClients';
import { resolveRequestingUser, type ResolveRequestingUserResult } from '../_lib/resolveRequestingUser';

const MAX_REGISTRATION_PORTFOLIO_IMAGES = 5;

function coerceInput(formData: FormData): ContractorRegistrationInput {
  const str = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v : '');
  const num = (v: FormDataEntryValue | null) => {
    if (typeof v !== 'string' || v.trim() === '') return null;
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const numArray = (values: FormDataEntryValue[]) =>
    values
      .map((v) => (typeof v === 'string' ? Number(v) : NaN))
      .filter((n): n is number => Number.isFinite(n));

  return {
    email: str(formData.get('email')),
    password: str(formData.get('password')),
    fullName: str(formData.get('fullName')),
    businessName: str(formData.get('businessName')),
    description: str(formData.get('description')),
    provinceId: num(formData.get('provinceId')),
    districtId: num(formData.get('districtId')),
    categoryIds: numArray(formData.getAll('categoryIds')),
    phone: str(formData.get('phone')),
    lineId: str(formData.get('lineId')),
    facebookUrl: str(formData.get('facebookUrl')),
    websiteUrl: str(formData.get('websiteUrl')),
    address: str(formData.get('address')),
    yearsExperience: str(formData.get('yearsExperience')),
  };
}

type CoercedImages = { ok: true; profileImage: ValidatedImage | null; portfolioImages: ValidatedImage[] };
type CoercedImagesError = { ok: false; error: string };

/** Both fields are entirely optional — see this file's header comment.
 * A field present but not a real File (e.g. an empty string, from a
 * form that submitted the input with nothing chosen) is treated as
 * absent, not as an error. */
async function coerceAndValidateImages(formData: FormData): Promise<CoercedImages | CoercedImagesError> {
  const profileImageEntry = formData.get('profileImage');
  let profileImage: ValidatedImage | null = null;
  if (profileImageEntry instanceof File && profileImageEntry.size > 0) {
    const result = await validateImageUpload(profileImageEntry);
    if (!result.ok) return { ok: false, error: `รูปโปรไฟล์: ${result.error}` };
    profileImage = result;
  }

  const portfolioEntries = formData.getAll('portfolioImages').filter((v): v is File => v instanceof File && v.size > 0);
  if (portfolioEntries.length > MAX_REGISTRATION_PORTFOLIO_IMAGES) {
    return { ok: false, error: `เพิ่มรูปผลงานได้สูงสุด ${MAX_REGISTRATION_PORTFOLIO_IMAGES} รูปตอนสมัคร` };
  }

  const portfolioImages: ValidatedImage[] = [];
  for (const entry of portfolioEntries) {
    const result = await validateImageUpload(entry);
    if (!result.ok) return { ok: false, error: `รูปผลงาน: ${result.error}` };
    portfolioImages.push(result);
  }

  return { ok: true, profileImage, portfolioImages };
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
  let formData: FormData;
  try {
    formData = await request.formData();
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
    const input = coerceInput(formData);

    const requestingUser = await resolveRequestingUser(request);
    if (requestingUser.mode === 'error') {
      return NextResponse.json({ ok: false, error: requestingUser.error }, { status: requestingUser.status });
    }

    const shapeErrors = validateContractorRegistration(input, {
      requireAccountFields: requestingUser.mode === 'new',
    });
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

    const images = await coerceAndValidateImages(formData);
    if (!images.ok) {
      return NextResponse.json({ ok: false, error: images.error }, { status: 400 });
    }

    return await submitContractorApplication(input, requestingUser, images);
  } catch (err) {
    console.error('contractor registration: unexpected failure', err);
    return NextResponse.json(
      { ok: false, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}

async function submitContractorApplication(
  input: ContractorRegistrationInput,
  requestingUser: Exclude<ResolveRequestingUserResult, { mode: 'error' }>,
  images: { profileImage: ValidatedImage | null; portfolioImages: ValidatedImage[] }
): Promise<NextResponse> {
  const adminClient = getSupabaseAdminClient();
  const businessName = input.businessName.trim();

  let userId: string;
  if (requestingUser.mode === 'existing') {
    // Issue #19: an already-logged-in user becoming a contractor. Never
    // calls signUp() — the id is already server-verified
    // (resolveRequestingUser.ts), so there is nothing left to "sign up".
    if (requestingUser.role === 'admin') {
      return NextResponse.json({ ok: false, error: 'บัญชีผู้ดูแลระบบไม่สามารถสมัครเป็นผู้รับเหมาได้' }, { status: 403 });
    }

    const { data: existingContractor, error: existingContractorError } = await adminClient
      .from('contractors')
      .select('id')
      .eq('user_id', requestingUser.userId)
      .maybeSingle();
    if (existingContractorError) {
      console.error('contractor registration: existing-contractor lookup failed', existingContractorError);
      return NextResponse.json(
        { ok: false, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง' },
        { status: 500 }
      );
    }
    if (existingContractor) {
      return NextResponse.json({ ok: false, error: 'บัญชีนี้มีโปรไฟล์ผู้รับเหมาอยู่แล้ว' }, { status: 409 });
    }

    if (requestingUser.role !== 'contractor') {
      try {
        await promoteAccountToContractor(requestingUser.userId, adminClient);
      } catch (err) {
        console.error('contractor registration: role promotion failed', err, { userId: requestingUser.userId });
        return NextResponse.json(
          { ok: false, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง' },
          { status: 500 }
        );
      }
    }

    userId = requestingUser.userId;
  } else {
    const email = input.email.trim();
    try {
      const authResult = await signUpContractor(
        { email, password: input.password, ...(input.fullName.trim() ? { fullName: input.fullName.trim() } : {}) },
        (id) => promoteAccountToContractor(id, adminClient),
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

    // Issue #23: profile/portfolio images are optional and, unlike the
    // text fields above, a failure here must not fail the whole
    // application — the account and business profile already exist and
    // are correct. Best-effort with a surfaced warning instead: the
    // contractor can add/replace images later from
    // /contractors/me/manage (app/api/contractors/me/**), which is the
    // exact same upload path this reuses.
    //
    // Image Optimization follow-up: every upload is re-encoded by
    // generateProfileVariant()/generatePortfolioVariants()
    // (src/lib/uploads/imageOptimization.ts) before it reaches Storage
    // — a failed optimization (e.g. a corrupt file that still passed
    // the magic-byte sniff) throws here and is caught the same as any
    // other image-pipeline failure, degrading to imageWarning rather
    // than failing registration.
    let imageWarning: string | null = null;
    try {
      if (images.profileImage) {
        const variant = await generateProfileVariant(images.profileImage.bytes);
        if (!variant.ok) throw new Error(variant.error);
        const path = generateContractorMediaPath(contractorRow.id, 'profile', variant.extension);
        const profileImageUrl = await uploadContractorImage(adminClient, path, variant.bytes, variant.contentType);
        const { error: profileImageError } = await adminClient
          .from('contractors')
          .update({ profile_image_url: profileImageUrl })
          .eq('id', contractorRow.id);
        if (profileImageError) throw profileImageError;
      }

      for (const portfolioImage of images.portfolioImages) {
        const variants = await generatePortfolioVariants(portfolioImage.bytes);
        if (!variants.ok) throw new Error(variants.error);
        const thumbnailPath = generateContractorMediaPath(contractorRow.id, 'portfolio-thumbnail', variants.thumbnail.extension);
        const thumbnailUrl = await uploadContractorImage(
          adminClient,
          thumbnailPath,
          variants.thumbnail.bytes,
          variants.thumbnail.contentType
        );
        const detailPath = generateContractorMediaPath(contractorRow.id, 'portfolio-detail', variants.detail.extension);
        const imageUrl = await uploadContractorImage(adminClient, detailPath, variants.detail.bytes, variants.detail.contentType);
        const { error: portfolioInsertError } = await adminClient.from('portfolio_images').insert({
          contractor_id: contractorRow.id,
          image_url: imageUrl,
          thumbnail_url: thumbnailUrl,
        });
        if (portfolioInsertError) throw portfolioInsertError;
      }
    } catch (imageErr) {
      console.error('contractor registration: image upload failed', imageErr, { contractorId: contractorRow.id });
      imageWarning = 'บันทึกข้อมูลธุรกิจสำเร็จ แต่อัปโหลดรูปภาพไม่สำเร็จ คุณสามารถเพิ่มรูปภาพได้ภายหลังหลังเข้าสู่ระบบ';
    }

    return NextResponse.json(
      { ok: true, businessName, slug: contractorRow.slug, status: contractorRow.status, imageWarning },
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
          requestingUser.mode === 'existing'
            ? 'อัปเกรดบัญชีเป็นผู้รับเหมาสำเร็จ แต่บันทึกข้อมูลธุรกิจไม่สำเร็จ กรุณาลองสมัครใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบหากยังพบปัญหา'
            : 'สร้างบัญชีสำเร็จ แต่บันทึกข้อมูลธุรกิจไม่สำเร็จ กรุณาลองสมัครใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบหากยังพบปัญหา',
      },
      { status: 500 }
    );
  }
}
