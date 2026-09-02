'use client';

import { useState, type FormEvent } from 'react';
import type { Province } from '../lib/data/provinces';
import type { Category } from '../lib/data/categories';
import { getDistrictsByProvince, type District } from '../lib/data/districts';
import {
  validateContractorRegistration,
  hasFieldErrors,
  type ContractorRegistrationInput,
  type FieldErrors,
} from '../lib/validation/contractorRegistration';

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

    const errors = validateContractorRegistration(values);
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) {
      setStatus('error');
      setGeneralError('กรุณาตรวจสอบข้อมูลที่กรอกอีกครั้ง');
      return;
    }

    setStatus('submitting');
    setGeneralError('');
    try {
      const response = await fetch('/api/contractors/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = (await response.json()) as {
        ok: boolean;
        error?: string;
        fieldErrors?: FieldErrors;
        businessName?: string;
        slug?: string;
      };

      if (!response.ok || !result.ok) {
        setStatus('error');
        setGeneralError(result.error || 'สมัครไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        setFieldErrors(result.fieldErrors || {});
        return;
      }

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
        <p className="mt-2">
          เมื่อได้รับการอนุมัติแล้ว คุณสามารถเข้าสู่ระบบได้ที่{' '}
          <a href="/login" className="font-medium underline">
            หน้าเข้าสู่ระบบ
          </a>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-slate-900">บัญชีผู้ใช้</legend>

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

      <p className="text-center text-sm text-slate-600">
        มีบัญชีอยู่แล้ว?{' '}
        <a href="/login" className="font-medium text-slate-900 hover:underline">
          เข้าสู่ระบบ
        </a>
      </p>
    </form>
  );
}
