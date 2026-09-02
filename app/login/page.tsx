import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '../../src/components/LoginForm';

export const metadata: Metadata = {
  title: 'เข้าสู่ระบบ',
  description: 'เข้าสู่ระบบเพื่อค้นหาและติดต่อผู้รับเหมา',
  // Auth page — Phase 11 (Issue #9): "Prevent indexing of private/admin/
  // auth/... pages."
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">เข้าสู่ระบบ</h1>
      <div className="mt-6">
        {/* Phase 12: LoginForm reads ?redirect= via useSearchParams(),
            which requires a Suspense boundary on a statically-rendered
            page (this route has no server data fetch of its own) — see
            LoginForm's own header comment for why. */}
        <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-brand-50" aria-hidden="true" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
