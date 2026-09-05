import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCallbackClient } from '../../../src/components/AuthCallbackClient';

export const metadata: Metadata = {
  title: 'กำลังเข้าสู่ระบบ...',
  // Auth page — Phase 11 (Issue #9): "Prevent indexing of private/admin/
  // auth/... pages."
  robots: { index: false, follow: false },
};

export default function AuthCallbackPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16 text-center sm:px-6">
      {/* AuthCallbackClient reads `?redirect=`/`?error=` via
          useSearchParams(), which requires a Suspense boundary on a
          statically-rendered page — same reasoning as /login's own
          LoginForm boundary. */}
      <Suspense
        fallback={
          <div className="h-24 animate-pulse rounded-lg bg-brand-50" aria-hidden="true" />
        }
      >
        <AuthCallbackClient />
      </Suspense>
    </div>
  );
}
