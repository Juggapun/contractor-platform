'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '../lib/supabase/client';
import { submitReview, getMyReviewForContractor, type MyReview } from '../lib/data/reviewSubmission';
import {
  validateReviewSubmission,
  hasReviewFieldErrors,
  type ReviewFieldErrors,
} from '../lib/validation/reviewSubmission';

type LoadState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'already-reviewed'; review: MyReview }
  | { status: 'ready' };

const STAR_LABELS = ['แย่มาก', 'แย่', 'พอใช้', 'ดี', 'ดีมาก'];

/**
 * Review submission form for the contractor profile page (Phase 9).
 * Talks directly to Supabase via the browser's own authenticated
 * session — see src/lib/data/reviewSubmission.ts's header comment for
 * why no server Route Handler is needed here (RLS is the full
 * authorization boundary for a user reviewing on their own behalf).
 *
 * On success this calls `router.refresh()` rather than managing local
 * list state — the contractor profile page (a Server Component) then
 * re-fetches getContractorProfile()/getReviews() for real, so the new
 * review, the updated rating_avg, and the updated review_count (all
 * trigger-maintained, see 0012_denormalized_field_triggers.sql) reflect
 * the actual database state rather than an optimistic guess.
 */
export function ReviewForm({ contractorId }: { contractorId: string }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ReviewFieldErrors>({});
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error' | 'success'>('idle');
  const [generalError, setGeneralError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await getSupabaseClient().auth.getSession();
      if (!data.session) {
        if (!cancelled) setState({ status: 'signed-out' });
        return;
      }
      const existing = await getMyReviewForContractor(contractorId);
      if (cancelled) return;
      setState(existing ? { status: 'already-reviewed', review: existing } : { status: 'ready' });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [contractorId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitStatus === 'submitting') return;

    const errors = validateReviewSubmission({ rating, comment });
    setFieldErrors(errors);
    if (hasReviewFieldErrors(errors)) {
      setSubmitStatus('error');
      setGeneralError('กรุณาตรวจสอบข้อมูลที่กรอก');
      return;
    }

    setSubmitStatus('submitting');
    setGeneralError('');
    const result = await submitReview(contractorId, rating as number, comment);
    if (!result.ok) {
      setSubmitStatus('error');
      setGeneralError(result.message);
      return;
    }

    setSubmitStatus('success');
    router.refresh();
  }

  if (state.status === 'loading') {
    return <div className="h-20 animate-pulse rounded-lg bg-brand-50" aria-hidden="true" />;
  }

  if (state.status === 'signed-out') {
    return (
      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <a href="/login" className="font-medium text-slate-900 underline">
          เข้าสู่ระบบ
        </a>{' '}
        เพื่อเขียนรีวิวผู้รับเหมารายนี้
      </div>
    );
  }

  if (state.status === 'already-reviewed') {
    return (
      <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-slate-700">
        <p className="font-medium text-slate-900">คุณได้รีวิวผู้รับเหมารายนี้แล้ว — ขอบคุณครับ/ค่ะ 🙏</p>
        <p className="mt-1" aria-hidden="true">
          {'⭐'.repeat(state.review.rating)}
        </p>
      </div>
    );
  }

  if (submitStatus === 'success') {
    return (
      <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        ขอบคุณสำหรับรีวิว! 🙏 รีวิวของคุณแสดงผลแล้วด้านล่าง
      </div>
    );
  }

  const displayRating = hoverRating ?? rating ?? 0;

  return (
    <form onSubmit={handleSubmit} noValidate className="mb-4 rounded-lg border border-slate-200 p-4">
      <p className="text-sm font-medium text-slate-900">เขียนรีวิวผู้รับเหมารายนี้</p>

      <div className="mt-3">
        <span className="block text-sm font-medium text-slate-700">ให้คะแนน</span>
        <div className="mt-1 flex items-center gap-1" role="radiogroup" aria-label="ให้คะแนน 1 ถึง 5 ดาว">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={rating === star}
              aria-label={`${star} ดาว — ${STAR_LABELS[star - 1]}`}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(null)}
              onClick={() => setRating(star)}
              className={`text-3xl leading-none ${star <= displayRating ? 'text-brand-500' : 'text-slate-300'}`}
            >
              ★
            </button>
          ))}
        </div>
        {fieldErrors.rating ? (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {fieldErrors.rating}
          </p>
        ) : null}
      </div>

      <div className="mt-3">
        <label htmlFor="review-comment" className="block text-sm font-medium text-slate-700">
          ความคิดเห็น
        </label>
        <textarea
          id="review-comment"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="งานเป็นยังไงบ้าง ตรงเวลาไหม แนะนำต่อได้ไหม..."
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm"
        />
        {fieldErrors.comment ? (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {fieldErrors.comment}
          </p>
        ) : null}
      </div>

      {submitStatus === 'error' && generalError ? (
        <p role="alert" className="mt-3 text-sm font-medium text-red-600">
          {generalError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitStatus === 'submitting'}
        className="mt-3 rounded-md bg-brand-400 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitStatus === 'submitting' ? 'กำลังส่งรีวิว...' : 'ส่งรีวิว'}
      </button>
    </form>
  );
}
