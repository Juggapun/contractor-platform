'use client';

import { useState, type FormEvent } from 'react';
import { signUpCustomer } from '../lib/auth/authService';

/**
 * Creates a CUSTOMER account only, via the already-built (Phase 3)
 * signUpCustomer(). Full contractor registration (business profile,
 * categories, portfolio) is Phase 7 and is intentionally NOT built
 * here — see the `isContractorIntent` note below.
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
      setErrorMessage(
        err instanceof Error ? err.message : 'สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
      );
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
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          การสมัครสำหรับผู้รับเหมาแบบเต็มรูปแบบ (พร้อมข้อมูลธุรกิจและผลงาน) จะเปิดให้บริการเร็ว ๆ นี้
          ในระหว่างนี้คุณสามารถสร้างบัญชีผู้ใช้ทั่วไปไว้ก่อนได้
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
          <input
            id="signup-password"
            name="password"
            type="password"
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
      <p className="mt-4 text-center text-sm text-slate-600">
        มีบัญชีอยู่แล้ว?{' '}
        <a href="/login" className="font-medium text-slate-900 hover:underline">
          เข้าสู่ระบบ
        </a>
      </p>
    </>
  );
}
