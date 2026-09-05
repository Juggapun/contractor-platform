'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSession, onAuthStateChange } from '../lib/auth/authService';
import { resolveRedirectPath } from '../lib/navigation/safeRedirect';

/**
 * Issue #41 — lands here after `signInWithFacebook()` sends the browser
 * to Facebook and back. `getSupabaseClient()`'s `detectSessionInUrl: true`
 * (src/lib/supabase/client.ts) does the actual work of reading the
 * tokens/error out of this page's own URL and establishing (or not) a
 * session — that happens automatically as soon as the Supabase client
 * singleton is constructed on this page load, before this component's
 * own effect even runs in the common case. This component's job is just
 * to wait for that to resolve, then redirect somewhere sensible.
 *
 * Supabase/GoTrue reports an OAuth failure (the user cancelled on
 * Facebook's consent screen, Facebook isn't enabled as a provider on the
 * Supabase project yet, etc.) by redirecting back here with
 * `error`/`error_description` in either the query string or the URL
 * hash, depending on flow type — checked directly here rather than
 * relying on any particular internal supabase-js state, since a failed
 * exchange never produces a session for getSession()/onAuthStateChange
 * to report success on either.
 */
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'คุณยกเลิกการเข้าสู่ระบบด้วย Facebook',
};
const DEFAULT_OAUTH_ERROR_MESSAGE = 'เข้าสู่ระบบด้วย Facebook ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';

// How long to wait for a session to appear before assuming the OAuth
// round trip failed silently (no error param, but also no session —
// e.g. a stale/bookmarked callback URL visited directly).
const SESSION_WAIT_TIMEOUT_MS = 8000;

function readUrlHashError(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  if (!hash) return null;
  return new URLSearchParams(hash).get('error');
}

export function AuthCallbackClient() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<'pending' | 'error'>('pending');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const redirectTarget = resolveRedirectPath(searchParams.get('redirect'));
    const oauthError = searchParams.get('error') ?? readUrlHashError();

    if (oauthError) {
      setErrorMessage(OAUTH_ERROR_MESSAGES[oauthError] ?? DEFAULT_OAUTH_ERROR_MESSAGE);
      setState('error');
      return;
    }

    let settled = false;
    let unsubscribe = () => {};

    function goToTarget() {
      if (settled) return;
      settled = true;
      window.location.href = redirectTarget;
    }

    function fail() {
      if (settled) return;
      settled = true;
      setErrorMessage(DEFAULT_OAUTH_ERROR_MESSAGE);
      setState('error');
    }

    getSession()
      .then((session) => {
        if (session) {
          goToTarget();
          return;
        }
        // Not established yet (detectSessionInUrl's own async work may
        // still be in flight) — listen for the SIGNED_IN event it fires
        // once that completes.
        const subscription = onAuthStateChange((event) => {
          if (event === 'SIGNED_IN') goToTarget();
        });
        unsubscribe = subscription.unsubscribe;
      })
      .catch(fail);

    const timeout = window.setTimeout(fail, SESSION_WAIT_TIMEOUT_MS);

    return () => {
      settled = true;
      window.clearTimeout(timeout);
      unsubscribe();
    };
  }, [searchParams]);

  if (state === 'error') {
    return (
      <div role="alert" className="space-y-4">
        <p className="text-sm text-red-600">{errorMessage}</p>
        <a
          href="/login"
          className="inline-block rounded-md bg-brand-400 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-brand-500"
        >
          กลับไปหน้าเข้าสู่ระบบ
        </a>
      </div>
    );
  }

  return (
    <div role="status" className="space-y-3">
      <div
        className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500"
        aria-hidden="true"
      />
      <p className="text-sm text-slate-600">กำลังเข้าสู่ระบบ...</p>
    </div>
  );
}
