'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { Province } from '../lib/data/provinces';
import type { Category } from '../lib/data/categories';
import { getDistrictsByProvince, type District } from '../lib/data/districts';
import {
  validateContractorRegistration,
  hasFieldErrors,
  type ContractorRegistrationInput,
  type FieldErrors,
} from '../lib/validation/contractorRegistration';
import { getCurrentUser } from '../lib/auth/authService';
import { getAccessTokenOrNull } from '../lib/auth/sessionToken';
import { getMyContractorApplication, type MyContractorApplication } from '../lib/data/contractorSelfStatus';
import type { CurrentUser } from '../lib/auth/types';
import { normalizeImageForUpload } from '../lib/uploads/clientImageNormalize';
import { ImageFilePicker } from './ImageFilePicker';
import { PortfolioImagesPicker } from './PortfolioImagesPicker';

// Issue #23: 0-5 portfolio images allowed at registration (a hard
// server-side cap independent of the after-approval 20-image lifetime
// cap enforced by trg_portfolio_images_enforce_limit,
// 0019_portfolio_image_limit.sql).
const MAX_REGISTRATION_PORTFOLIO_IMAGES = 5;

// Issue #19: a logged-in existing user choosing "สมัครเป็นผู้รับเหมา" used
// to hit Supabase Auth's `user_already_exists` error, because this form
// always collected email/password and the server route always called
// `signUp()` with them — regardless of whether the visitor already had a
// session. Fixed by detecting the current session client-side (same
// getCurrentUser() pattern as AuthStatus.tsx) and, when logged in,
// omitting the account fields entirely and sending the session's access
// token instead — app/api/contractors/register/route.ts's
// resolveRequestingUser() verifies that token server-side and uses its
// user id directly, never calling signUp() for that request. An
// anonymous visitor sees the exact same form as before.
type AuthState = 'loading' | 'anonymous' | { status: 'authenticated'; user: CurrentUser };

const EMPTY_INPUT: ContractorRegistrationInput = {
  email: '',
  password: '',
  fullName: '',
  businessName: '',
  description: '',
  provinceId: null,
  districtId: null,
  categoryIds: [],
  phone: '',
  lineId: '',
  facebookUrl: '',
  websiteUrl: '',
  address: '',
  yearsExperience: '',
};

const inputClass =
  'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
const labelClass = 'block text-sm font-medium text-slate-700';
const errorTextClass = 'mt-1 text-sm text-red-600';

function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className={errorTextClass}>
      {message}
    </p>
  );
}

export function ContractorRegistrationForm({
  provinces,
  categories,
}: {
  provinces: Province[];
  categories: Category[];
}) {
  const [values, setValues] = useState<ContractorRegistrationInput>(EMPTY_INPUT);
  const [districts, setDistricts] = useState<District[]>([]);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error' | 'success'>('idle');
  const [generalError, setGeneralError] = useState('');
  const [successInfo, setSuccessInfo] = useState<{ businessName: string; slug: string } | null>(null);
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [existingApplication, setExistingApplication] = useState<MyContractorApplication | null>(null);
  const [existingApplicationChecked, setExistingApplicationChecked] = useState(false);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [portfolioImages, setPortfolioImages] = useState<File[]>([]);
  const [imageWarning, setImageWarning] = useState('');

  const isAuthenticated = authState !== 'loading' && authState !== 'anonymous';

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((user) => {
        if (cancelled) return;
        setAuthState(user ? { status: 'authenticated', user } : 'anonymous');
      })
      .catch(() => {
        if (!cancelled) setAuthState('anonymous');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authState === 'loading') return;
    if (authState === 'anonymous') {
      setExistingApplication(null);
      setExistingApplicationChecked(true);
      return;
    }
    let cancelled = false;
    setExistingApplicationChecked(false);
    getMyContractorApplication(authState.user.id).then((app) => {
      if (cancelled) return;
      setExistingApplication(app);
      setExistingApplicationChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [authState]);

  function update<K extends keyof ContractorRegistrationInput>(key: K, value: ContractorRegistrationInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleProvinceChange(rawValue: string) {
    const provinceId = rawValue ? Number(rawValue) : null;
    setValues((prev) => ({ ...prev, provinceId, districtId: null }));
    setDistricts([]);
    if (provinceId === null) return;
    setDistrictsLoading(true);
    try {
      const rows = await getDistrictsByProvince(provinceId);
      setDistricts(rows);
    } finally {
      setDistrictsLoading(false);
    }
  }

  function toggleCategory(categoryId: number) {
    setValues((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(categoryId)
        ? prev.categoryIds.filter((id) => id !== categoryId)
        : [...prev.categoryIds, categoryId],
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'submitting') return;

    const errors = validateContractorRegistration(values, { requireAccountFields: !isAuthenticated });
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) {
      setStatus('error');
      setGeneralError('กรุณาตรวจสอบข้อมูลที่กรอกอีกครั้ง');
      return;
    }

    setStatus('submitting');
    setGeneralError('');
    try {
      const headers: Record<string, string> = {};
      if (isAuthenticated) {
        const token = await getAccessTokenOrNull();
        if (!token) {
          setStatus('error');
          setGeneralError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง');
          return;
        }
        headers.Authorization = `Bearer ${token}`;
      }

      // multipart/form-data, not JSON (Issue #23) — carries the optional
      // profile/portfolio image files alongside the existing text
      // fields in one submission. No explicit Content-Type header: the
      // browser sets it (including the multipart boundary) itself.
      const formData = new FormData();
      for (const [key, value] of Object.entries(values)) {
        if (key === 'categoryIds') continue;
        formData.set(key, String(value ?? ''));
      }
      for (const categoryId of values.categoryIds) {
        formData.append('categoryIds', String(categoryId));
      }
      // Issue #29: normalize oversized files (e.g. a multi-MB Canva PNG
      // export) client-side before they ever leave the browser — this
      // whole submission is ONE multipart request carrying up to 6
      // images (1 profile + 5 portfolio) at once, so an oversized
      // original here is even more likely to exceed the hosting
      // platform's request-body limit than a single portfolio upload.
      if (profileImage) formData.set('profileImage', await normalizeImageForUpload(profileImage));
      for (const file of portfolioImages) {
        formData.append('portfolioImages', await normalizeImageForUpload(file));
      }

      const response = await fetch('/api/contractors/register', {
        method: 'POST',
        headers,
        body: formData,
      });
      const result = (await response.json()) as {
        ok: boolean;
        error?: string;
        fieldErrors?: FieldErrors;
        businessName?: string;
        slug?: string;
        imageWarning?: string | null;
      };

      if (!response.ok || !result.ok) {
        setStatus('error');
        setGeneralError(result.error || 'สมัครไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        setFieldErrors(result.fieldErrors || {});
        return;
      }

      setImageWarning(result.imageWarning || '');
      setSuccessInfo({ businessName: result.businessName ?? values.businessName, slug: result.slug ?? '' });
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setGeneralError(err instanceof Error ? err.message : 'สมัครไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
  }

  if (status === 'success' && successInfo) {
    return (
      <div role="status" className="rounded-md border border-brand-300 bg-brand-50 p-5 text-sm leading-relaxed text-slate-800">
        <p className="font-semibold text-slate-900">ส่งใบสมัครสำเร็จ!</p>
        <p className="mt-2">
          &ldquo;{successInfo.businessName}&rdquo; อยู่ระหว่างรอการตรวจสอบจากผู้ดูแลระบบ
          โปรไฟล์ของคุณจะยังไม่แสดงต่อสาธารณะหรือปรากฏในผลการค้นหาจนกว่าจะได้รับการอนุมัติ
        </p>
        {imageWarning ? (
          <p className="mt-2 text-amber-700" role="alert">
            {imageWarning}
          </p>
        ) : null}
        {isAuthenticated ? null : (
          <p className="mt-2">
            เมื่อได้รับการอนุมัติแล้ว คุณสามารถเข้าสู่ระบบได้ที่{' '}
            <a href="/login" className="font-medium underline">
              หน้าเข้าสู่ระบบ
            </a>
          </p>
        )}
      </div>
    );
  }

  if (authState === 'loading' || !existingApplicationChecked) {
    return <div className="h-64 animate-pulse rounded-md bg-slate-100" aria-hidden="true" />;
  }

  if (isAuthenticated && existingApplication) {
    return (
      <div role="status" className="rounded-md border border-slate-200 bg-slate-50 p-5 text-sm leading-relaxed text-slate-800">
        <p className="font-semibold text-slate-900">คุณมีใบสมัครผู้รับเหมาอยู่แล้ว</p>
        <p className="mt-2">
          &ldquo;{existingApplication.businessName}&rdquo; —{' '}
          {existingApplication.status === 'pending' ? 'อยู่ระหว่างรอการตรวจสอบจากผู้ดูแลระบบ' : null}
          {existingApplication.status === 'approved' ? 'ได้รับการอนุมัติแล้ว' : null}
          {existingApplication.status === 'rejected' ? 'ใบสมัครถูกปฏิเสธ' : null}
          {existingApplication.status === 'suspended' ? 'บัญชีถูกระงับ' : null}
        </p>
        {existingApplication.status === 'approved' ? (
          <p className="mt-2">
            <a href={`/contractors/${existingApplication.slug}`} className="font-medium underline">
              ดูโปรไฟล์ของคุณ
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-slate-900">บัญชีผู้ใช้</legend>

        {isAuthenticated ? (
          <p className="text-sm text-slate-600">
            คุณเข้าสู่ระบบอยู่แล้วในชื่อ{' '}
            <span className="font-medium text-slate-900">
              {isAuthenticated ? authState.user.profile.full_name || authState.user.email : ''}
            </span>{' '}
            — ระบบจะใช้บัญชีนี้ในการสมัคร ไม่ต้องสร้างบัญชีใหม่
          </p>
        ) : (
          <>
            <div>
              <label htmlFor="reg-fullName" className={labelClass}>
                ชื่อ-นามสกุลผู้ติดต่อ
              </label>
              <input
                id="reg-fullName"
                type="text"
                autoComplete="name"
                value={values.fullName}
                onChange={(e) => update('fullName', e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="reg-email" className={labelClass}>
                อีเมล <span aria-hidden="true">*</span>
              </label>
              <input
                id="reg-email"
                type="email"
                required
                autoComplete="email"
                value={values.email}
                onChange={(e) => update('email', e.target.value)}
                className={inputClass}
                aria-invalid={Boolean(fieldErrors.email)}
              />
              <FieldError message={fieldErrors.email} />
            </div>

            <div>
              <label htmlFor="reg-password" className={labelClass}>
                รหัสผ่าน <span aria-hidden="true">*</span>
              </label>
              <input
                id="reg-password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={values.password}
                onChange={(e) => update('password', e.target.value)}
                className={inputClass}
                aria-invalid={Boolean(fieldErrors.password)}
              />
              <FieldError message={fieldErrors.password} />
            </div>
          </>
        )}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-slate-900">ข้อมูลธุรกิจ</legend>

        <div>
          <label htmlFor="reg-businessName" className={labelClass}>
            ชื่อธุรกิจ/ร้าน <span aria-hidden="true">*</span>
          </label>
          <input
            id="reg-businessName"
            type="text"
            required
            value={values.businessName}
            onChange={(e) => update('businessName', e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.businessName)}
          />
          <FieldError message={fieldErrors.businessName} />
        </div>

        <div>
          <label htmlFor="reg-description" className={labelClass}>
            คำอธิบายธุรกิจ
          </label>
          <textarea
            id="reg-description"
            rows={4}
            value={values.description}
            onChange={(e) => update('description', e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.description)}
          />
          <FieldError message={fieldErrors.description} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="reg-province" className={labelClass}>
              จังหวัด <span aria-hidden="true">*</span>
            </label>
            <select
              id="reg-province"
              required
              value={values.provinceId ?? ''}
              onChange={(e) => void handleProvinceChange(e.target.value)}
              className={inputClass}
              aria-invalid={Boolean(fieldErrors.provinceId)}
            >
              <option value="">เลือกจังหวัด</option>
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name_th}
                </option>
              ))}
            </select>
            <FieldError message={fieldErrors.provinceId} />
          </div>

          <div>
            <label htmlFor="reg-district" className={labelClass}>
              อำเภอ/เขต
            </label>
            <select
              id="reg-district"
              value={values.districtId ?? ''}
              onChange={(e) => update('districtId', e.target.value ? Number(e.target.value) : null)}
              disabled={values.provinceId === null || districtsLoading}
              className={inputClass}
              aria-invalid={Boolean(fieldErrors.districtId)}
            >
              <option value="">
                {values.provinceId === null ? 'เลือกจังหวัดก่อน' : districtsLoading ? 'กำลังโหลด...' : 'เลือกอำเภอ/เขต'}
              </option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name_th}
                </option>
              ))}
            </select>
            <FieldError message={fieldErrors.districtId} />
          </div>
        </div>

        <div>
          <span className={labelClass}>
            หมวดหมู่งาน <span aria-hidden="true">*</span>
          </span>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {categories.map((category) => (
              <label
                key={category.id}
                className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-brand-400 hover:bg-brand-50"
              >
                <input
                  type="checkbox"
                  checked={values.categoryIds.includes(category.id)}
                  onChange={() => toggleCategory(category.id)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                {category.name_th}
              </label>
            ))}
          </div>
          <FieldError message={fieldErrors.categoryIds} />
        </div>

        <div>
          <label htmlFor="reg-address" className={labelClass}>
            ที่อยู่
          </label>
          <textarea
            id="reg-address"
            rows={2}
            value={values.address}
            onChange={(e) => update('address', e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.address)}
          />
          <FieldError message={fieldErrors.address} />
        </div>

        <div>
          <label htmlFor="reg-yearsExperience" className={labelClass}>
            ปีประสบการณ์
          </label>
          <input
            id="reg-yearsExperience"
            type="number"
            min={0}
            max={80}
            inputMode="numeric"
            value={values.yearsExperience}
            onChange={(e) => update('yearsExperience', e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.yearsExperience)}
          />
          <FieldError message={fieldErrors.yearsExperience} />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-slate-900">รูปภาพ (ไม่บังคับ)</legend>
        <p className="text-sm text-slate-500">
          แนะนำให้เพิ่มรูปภาพ แต่ไม่จำเป็นต้องมีเพื่อส่งใบสมัคร — สามารถเพิ่มหรือแก้ไขได้ภายหลัง
        </p>

        <ImageFilePicker
          id="reg-profileImage"
          label="รูปโปรไฟล์"
          value={profileImage}
          onChange={setProfileImage}
        />

        <PortfolioImagesPicker
          id="reg-portfolioImages"
          label={`ผลงาน (ตอนสมัคร)`}
          value={portfolioImages}
          onChange={setPortfolioImages}
          max={MAX_REGISTRATION_PORTFOLIO_IMAGES}
        />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-slate-900">ช่องทางติดต่อ (ไม่บังคับ)</legend>

        <div>
          <label htmlFor="reg-phone" className={labelClass}>
            เบอร์โทรศัพท์
          </label>
          <input
            id="reg-phone"
            type="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={(e) => update('phone', e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.phone)}
          />
          <FieldError message={fieldErrors.phone} />
        </div>

        <div>
          <label htmlFor="reg-lineId" className={labelClass}>
            LINE ID
          </label>
          <input
            id="reg-lineId"
            type="text"
            value={values.lineId}
            onChange={(e) => update('lineId', e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.lineId)}
          />
          <FieldError message={fieldErrors.lineId} />
        </div>

        <div>
          <label htmlFor="reg-facebookUrl" className={labelClass}>
            ลิงก์ Facebook
          </label>
          <input
            id="reg-facebookUrl"
            type="url"
            placeholder="https://facebook.com/..."
            value={values.facebookUrl}
            onChange={(e) => update('facebookUrl', e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.facebookUrl)}
          />
          <FieldError message={fieldErrors.facebookUrl} />
        </div>

        <div>
          <label htmlFor="reg-websiteUrl" className={labelClass}>
            เว็บไซต์
          </label>
          <input
            id="reg-websiteUrl"
            type="url"
            placeholder="https://..."
            value={values.websiteUrl}
            onChange={(e) => update('websiteUrl', e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.websiteUrl)}
          />
          <FieldError message={fieldErrors.websiteUrl} />
        </div>
      </fieldset>

      {status === 'error' && generalError ? (
        <p role="alert" className="text-sm font-medium text-red-600">
          {generalError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="w-full rounded-md bg-brand-400 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'submitting' ? 'กำลังส่งใบสมัคร...' : 'ส่งใบสมัคร'}
      </button>

      {isAuthenticated ? null : (
        <p className="text-center text-sm text-slate-600">
          มีบัญชีอยู่แล้ว?{' '}
          <a href="/login" className="font-medium text-slate-900 hover:underline">
            เข้าสู่ระบบ
          </a>
        </p>
      )}
    </form>
  );
}
