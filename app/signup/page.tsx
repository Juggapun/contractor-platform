import type { Metadata } from 'next';
import { SignupForm } from '../../src/components/SignupForm';

export const metadata: Metadata = {
  title: 'สมัครสมาชิก',
  description: 'สมัครสมาชิกเพื่อค้นหาและติดต่อผู้รับเหมา',
  // Auth page — Phase 11 (Issue #9): "Prevent indexing of private/admin/
  // auth/... pages."
  robots: { index: false, follow: false },
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-sm px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">สมัครสมาชิก</h1>
      <div className="mt-6">
        <SignupForm isContractorIntent={params.role === 'contractor'} />
      </div>
    </div>
  );
}
