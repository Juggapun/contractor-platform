'use client';

/**
 * Header auth-state widget. Uses the Phase 3 authService directly
 * (anon-key client only — see src/lib/supabase/client.ts). Must never
 * crash the page: if Supabase isn't configured (no hosted project in
 * this environment yet — see docs/AUTHENTICATION.md) or any call fails,
 * this falls back to the logged-out state rather than throwing.
 */
import { useEffect, useState } from 'react';
import { getCurrentUser, onAuthStateChange, signOut } from '../lib/auth/authService';
import type { CurrentUser } from '../lib/auth/types';

type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: CurrentUser };

export function AuthStatus() {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    getCurrentUser()
      .then((user) => {
        if (cancelled) return;
        setState(user ? { status: 'authenticated', user } : { status: 'anonymous' });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'anonymous' });
      });

    let unsubscribe = () => {};
    try {
      const subscription = onAuthStateChange(() => {
        getCurrentUser()
          .then((user) => {
            if (cancelled) return;
            setState(user ? { status: 'authenticated', user } : { status: 'anonymous' });
          })
          .catch(() => {
            if (!cancelled) setState({ status: 'anonymous' });
          });
      });
      unsubscribe = subscription.unsubscribe;
    } catch {
      // Supabase not configured in this environment — stay anonymous.
    }

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  if (state.status === 'loading') {
    return <div className="h-9 w-24 animate-pulse rounded-md bg-brand-100" aria-hidden="true" />;
  }

  if (state.status === 'authenticated') {
    const label = state.user.profile.full_name || state.user.email || 'บัญชีของฉัน';
    return (
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-slate-700 sm:inline">
          สวัสดี, <span className="font-medium">{label}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            signOut()
              .then(() => setState({ status: 'anonymous' }))
              .catch(() => setState({ status: 'anonymous' }));
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-brand-500"
        >
          ออกจากระบบ
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href="/login"
        className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        เข้าสู่ระบบ
      </a>
      <a
        href="/signup"
        className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        สมัครสมาชิก
      </a>
    </div>
  );
}
