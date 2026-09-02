import type { Metadata } from 'next';
import { getProvinces } from '../../../src/lib/data/provinces';
import { getCategories } from '../../../src/lib/data/categories';
import { ContractorRegistrationForm } from '../../../src/components/ContractorRegistrationForm';

export const metadata: Metadata = {
  title: 'ลงทะเบียนผู้รับเหมา',
  description:
    'ลงทะเบียนธุรกิจของคุณเพื่อให้ลูกค้าค้นหาและติดต่อได้ — ข้อมูลจะถูกตรวจสอบโดยผู้ดูแลระบบก่อนเผยแพร่สู่สาธารณะ',
};

// Without this, `next build` would statically prerender this page once
// and bake in whatever getProvinces()/getCategories() returned AT BUILD
// TIME — permanently, until the next deploy, regardless of what
// provinces/categories actually exist afterward. A registration form
// with a stale/empty province or category list is a broken form, not an
// acceptable staleness tradeoff, so this page always fetches fresh.
export const dynamic = 'force-dynamic';

export default async function ContractorRegisterPage() {
  const [provinces, categories] = await Promise.all([getProvinces(), getCategories()]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">ลงทะเบียนผู้รับเหมา</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
        กรอกข้อมูลธุรกิจของคุณด้านล่าง หลังจากส่งใบสมัคร ผู้ดูแลระบบจะตรวจสอบข้อมูลก่อนเผยแพร่โปรไฟล์ของคุณสู่สาธารณะ
        — ระหว่างรอการอนุมัติ โปรไฟล์ของคุณจะยังไม่แสดงในผลการค้นหา
      </p>
      <div className="mt-8">
        <ContractorRegistrationForm provinces={provinces} categories={categories} />
      </div>
    </div>
  );
}
