import type { Metadata } from 'next';
import { LoginForm } from '../../../src/components/LoginForm';

export const metadata: Metadata = {
  title: 'เข้าสู่ระบบ',
  description: 'เข้าสู่ระบบเพื่อค้นหาและติดต่อผู้รับเหมา',
  // Auth page — Phase 11 (Issue #9): "Prevent indexing of private/admin/
  // auth/... pages."
  robots: { index: false, follow: false },
};

type LoginPageProps = {
  searchParams: Promise<{
    redirect?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectParam = Array.isArray(params.redirect) ? params.redirect[0] ?? null : params.redirect ?? null;

  return (
    <div className="mx-auto max-w-sm px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">เข้าสู่ระบบ</h1>
      <div className="mt-6">
        <LoginForm redirectParam={redirectParam} />
      </div>
    </div>
  );
}
