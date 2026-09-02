import type { Metadata } from 'next';
import { LoginForm } from '../../src/components/LoginForm';

export const metadata: Metadata = {
  title: 'เข้าสู่ระบบ',
  description: 'เข้าสู่ระบบเพื่อค้นหาและติดต่อผู้รับเหมา',
};

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">เข้าสู่ระบบ</h1>
      <div className="mt-6">
        <LoginForm />
      </div>
    </div>
  );
}
