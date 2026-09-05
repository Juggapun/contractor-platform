'use client';

import { useState, type FormEvent } from 'react';
import { signUpCustomer } from '../lib/auth/authService';
import { getSignUpErrorMessage } from '../lib/auth/authErrors';
import { PasswordInput } from './PasswordInput';
import { FacebookLoginButton } from './FacebookLoginButton';

/**
 * Creates a CUSTOMER account only, via the already-built (Phase 3)
 * signUpCustomer(). Full contractor registration (business profile,
 * categories, portfolio) is the real, separate flow at
 * /contractors/register (Phase 7) — see the `isContractorIntent` note
 * below, which just redirects a visitor who landed here with
 * ?role=contractor (e.g. an old bookmark/link) to that page instead of
 * building a second, weaker signup path here.
 */
export function SignupForm({ isContractorIntent }: { isContractorIntent: boolean }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error' | 'success'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');
    setErrorMessage('');
    try {
      await signUpCustomer({ email, password, fullName });
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMessage(getSignUpErrorMessage(err, 'สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'));
    }
  }

  if (status === 'success') {
    return (
      <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-800">
        สมัครสมาชิกสำเร็จ! กรุณายืนยันอีเมลของคุณ (หากระบบยืนยันอีเมลเปิดใช้งาน) แล้วเข้าสู่ระบบได้ที่{' '}
        <a href="/login" className="font-medium underline">
          หน้าเข้าสู่ระบบ
        </a>
      </div>
    );
  }

  return (
    <>
      {isContractorIntent ? (
        <div className="mb-6 rounded-md border border-brand-300 bg-brand-50 p-4 text-sm leading-relaxed text-slate-800">
          หากคุณเป็นผู้รับเหมา กรุณาลงทะเบียนที่{' '}
          <a href="/contractors/register" className="font-medium underline">
            หน้าลงทะเบียนผู้รับเหมา
          </a>{' '}
          แทน เพื่อกรอกข้อมูลธุรกิจและส่งให้ผู้ดูแลระบบตรวจสอบในขั้นตอนเดียว
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="signup-name" className="block text-sm font-medium text-slate-700">
            ชื่อ-นามสกุล
          </label>
          <input
            id="signup-name"
            name="fullName"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="signup-email" className="block text-sm font-medium text-slate-700">
            อีเมล
          </label>
          <input
            id="signup-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="signup-password" className="block text-sm font-medium text-slate-700">
            รหัสผ่าน
          </label>
          <PasswordInput
            id="signup-password"
            name="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm"
          />
        </div>

        {status === 'error' ? (
          <p role="alert" className="text-sm text-red-600">
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={status === 'submitting'}
          className="w-full rounded-md bg-brand-400 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'submitting' ? 'กำลังสมัครสมาชิก...' : 'สมัครสมาชิก'}
        </button>
      </form>

      <div className="mt-6 flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium text-slate-400">หรือ</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
      <div className="mt-4">
        {/* No `?redirect=` concept on /signup today (unlike /login) — a
            brand-new member has nowhere in particular to return to. */}
        <FacebookLoginButton redirectParam={null} />
      </div>

      <p className="mt-4 text-center text-sm text-slate-600">
        มีบัญชีอยู่แล้ว?{' '}
        <a href="/login" className="font-medium text-slate-900 hover:underline">
          เข้าสู่ระบบ
        </a>
      </p>
    </>
  );
}
