'use client';

import { useState } from 'react';
import { signInWithFacebook } from '../lib/auth/authService';
import { getSiteUrl } from '../lib/env';
import { resolveRedirectPath } from '../lib/navigation/safeRedirect';

/**
 * Issue #41 — "ดำเนินการต่อด้วย Facebook", shown on both /login and
 * /signup. Deliberately member/customer-only: it calls the exact same
 * `signInWithFacebook()` account path regardless of which page it's on,
 * and that path can never produce a `contractor` role (see
 * authService.ts's own header comment on this function) — there is no
 * separate "Facebook contractor" variant to accidentally wire up wrong.
 *
 * `redirectParam` is the raw `?redirect=` value from whichever page
 * embeds this button (LoginForm reads it via its own `useSearchParams`;
 * SignupForm has no such param today, so it passes `null`) — resolved
 * through the same `resolveRedirectPath()` open-redirect guard the
 * existing email/password LoginForm already uses, then round-tripped
 * through `/auth/callback?redirect=...` so the post-OAuth landing page
 * knows where to send the user back to.
 */
export function FacebookLoginButton({ redirectParam }: { redirectParam: string | null }) {
  const [status, setStatus] = useState<'idle' | 'redirecting' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleClick() {
    setStatus('redirecting');
    setErrorMessage('');
    const redirectTarget = resolveRedirectPath(redirectParam);
    const callbackUrl = `${getSiteUrl()}/auth/callback?redirect=${encodeURIComponent(redirectTarget)}`;
    try {
      await signInWithFacebook(callbackUrl);
      // On success supabase-js has already navigated the browser away to
      // Facebook by the time this line would run — reaching it at all
      // means that redirect never happened.
      setStatus('error');
      setErrorMessage('ไม่สามารถเริ่มการเข้าสู่ระบบด้วย Facebook ได้ กรุณาลองใหม่อีกครั้ง');
    } catch {
      setStatus('error');
      setErrorMessage('ไม่สามารถเชื่อมต่อกับ Facebook ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง');
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={status === 'redirecting'}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 flex-shrink-0 fill-[#1877F2]">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
        {status === 'redirecting' ? 'กำลังเชื่อมต่อ Facebook...' : 'ดำเนินการต่อด้วย Facebook'}
      </button>
      {status === 'error' && errorMessage ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
