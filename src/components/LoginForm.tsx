'use client';

import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from '../lib/auth/authService';
import { getSignInErrorMessage } from '../lib/auth/authErrors';
import { resolveRedirectPath } from '../lib/navigation/safeRedirect';
import { PasswordInput } from './PasswordInput';
import { FacebookLoginButton } from './FacebookLoginButton';

/**
 * Phase 12 (Issue #10) fix: this used to always send a successful login
 * to `/`, no matter where the user came from — confirmed via a real
 * browser test that a customer signing in from the review form on a
 * contractor's profile got bounced to the homepage instead of back to
 * that profile. Every "please sign in" link across the app (ReviewForm,
 * the header's own AuthStatus, the admin pages' signed-out prompts) now
 * carries `?redirect=<the page they were on>`, and this reads it back —
 * validated through resolveRedirectPath() (open-redirect protection),
 * never trusted as a raw string.
 */
export function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');
    setErrorMessage('');
    try {
      await signIn({ email, password });
      window.location.href = resolveRedirectPath(searchParams.get('redirect'));
    } catch (err) {
      setStatus('error');
      setErrorMessage(getSignInErrorMessage(err, 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'));
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-slate-700">
            อีเมล
          </label>
          <input
            id="login-email"
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
          <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">
            รหัสผ่าน
          </label>
          <PasswordInput
            id="login-password"
            name="password"
            required
            autoComplete="current-password"
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
          {status === 'submitting' ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
      </form>

      <div className="mt-6 flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium text-slate-400">หรือ</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
      <div className="mt-4">
        <FacebookLoginButton redirectParam={searchParams.get('redirect')} />
      </div>

      <p className="mt-4 text-center text-sm text-slate-600">
        ยังไม่มีบัญชี?{' '}
        <a href="/signup" className="font-medium text-slate-900 hover:underline">
          สมัครสมาชิก
        </a>
      </p>
    </>
  );
}
