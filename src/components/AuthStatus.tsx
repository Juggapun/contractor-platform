'use client';

/**
 * Header auth-state widget. Uses the Phase 3 authService directly
 * (anon-key client only — see src/lib/supabase/client.ts). Must never
 * crash the page: if Supabase isn't configured (no hosted project in
 * this environment yet — see docs/AUTHENTICATION.md) or any call fails,
 * this falls back to the logged-out state rather than throwing.
 */
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getCurrentUser, onAuthStateChange, signOut } from '../lib/auth/authService';
import { getMyContractorApplication, type MyContractorApplication } from '../lib/data/contractorSelfStatus';
import type { CurrentUser } from '../lib/auth/types';

type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: CurrentUser };

const CONTRACTOR_STATUS_BADGE: Record<MyContractorApplication['status'], string> = {
  pending: '⏳ ใบสมัครรอตรวจสอบ',
  approved: '✅ ผู้รับเหมา',
  rejected: '❌ ใบสมัครถูกปฏิเสธ',
  suspended: '⛔ บัญชีถูกระงับ',
};

export function AuthStatus() {
  const pathname = usePathname();
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [contractorApp, setContractorApp] = useState<MyContractorApplication | null>(null);

  // Phase 12 fix: contractor status visibility — see
  // src/lib/data/contractorSelfStatus.ts's header comment.
  useEffect(() => {
    if (state.status !== 'authenticated' || state.user.profile.role !== 'contractor') {
      setContractorApp(null);
      return;
    }
    let cancelled = false;
    getMyContractorApplication(state.user.id).then((app) => {
      if (!cancelled) setContractorApp(app);
    });
    return () => {
      cancelled = true;
    };
  }, [state]);

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
      <div className="flex flex-wrap items-center gap-3">
        {/* Phase 12 (Issue #10) fix: this used to be `hidden ... sm:inline`
            /`sm:inline-block` — a leftover from before Header.tsx rendered
            two separate AuthStatus instances (one already wrapped in
            `hidden md:block` for desktop, one inside the `md:hidden`
            mobile nav). The result was that on an actual phone (<640px),
            an admin's mobile nav showed ONLY the logout button — no name,
            no way to reach the admin queue at all. Confirmed broken via a
            real browser screenshot at 375px before this fix. Outer
            containers already control which instance renders where, so
            these inner elements can just always show. */}
        <span className="text-sm text-slate-700">
          สวัสดี, <span className="font-medium">{label}</span>
        </span>
        {contractorApp ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {CONTRACTOR_STATUS_BADGE[contractorApp.status]}
            {contractorApp.status === 'approved' ? (
              <a href={`/contractors/${contractorApp.slug}`} className="underline hover:text-slate-900">
                ดูโปรไฟล์ของคุณ
              </a>
            ) : null}
          </span>
        ) : null}
        {state.user.profile.role === 'admin' ? (
          <a
            href="/admin/contractors"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            จัดการผู้รับเหมา
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => {
            signOut()
              .then(() => setState({ status: 'anonymous' }))
              .catch(() => setState({ status: 'anonymous' }));
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ออกจากระบบ
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href={`/login?redirect=${encodeURIComponent(pathname)}`}
        className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        เข้าสู่ระบบ
      </a>
      <a
        href="/signup"
        className="rounded-md bg-brand-400 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-brand-500"
      >
        สมัครสมาชิก
      </a>
    </div>
  );
}
