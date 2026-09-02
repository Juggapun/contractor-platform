'use client';

import { useEffect } from 'react';

/**
 * Last-resort error boundary for a contractor profile route (Next.js
 * convention, must be a Client Component). getContractorProfile()/
 * getPortfolioImages()/getReviews() already handle their own expected
 * failures (return null/[] rather than throwing) — this only fires for
 * a truly unexpected exception.
 */
export default function ContractorProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unexpected error on a contractor profile page:', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">เกิดข้อผิดพลาดที่ไม่คาดคิด</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
        ขออภัย เกิดข้อผิดพลาดขณะโหลดหน้าโปรไฟล์ผู้รับเหมา กรุณาลองใหม่อีกครั้ง
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-md bg-brand-400 px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-brand-500"
      >
        ลองใหม่อีกครั้ง
      </button>
    </div>
  );
}
