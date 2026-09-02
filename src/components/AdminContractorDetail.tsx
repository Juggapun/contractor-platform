'use client';

import { useEffect, useState } from 'react';
import { getAccessTokenOrNull } from '../lib/auth/adminSession';
import {
  fetchAdminContractorDetail,
  approveContractor,
  rejectContractor,
  type AdminContractor,
  type AdminContactEventTally,
} from '../lib/data/adminContractors';

type LoadState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; contractor: AdminContractor; profileViewCount: number; contactEventsTally: AdminContactEventTally };

const CONTACT_EVENT_LABEL: Record<keyof AdminContactEventTally, string> = {
  phone: '📞 คลิกโทร',
  line: '💬 คลิก LINE',
  facebook: 'คลิก Facebook',
  website: '🌐 คลิกเว็บไซต์',
  profile_view: '👁️ เข้าชมโปรไฟล์',
};

const STATUS_LABEL: Record<AdminContractor['status'], string> = {
  pending: 'รอตรวจสอบ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ถูกปฏิเสธ',
  suspended: 'ถูกระงับ',
};

function formatThaiDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

export function AdminContractorDetail({ contractorId }: { contractorId: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [actionStatus, setActionStatus] = useState<'idle' | 'approving' | 'rejecting'>('idle');
  const [actionError, setActionError] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [reason, setReason] = useState('');

  async function load() {
    const token = await getAccessTokenOrNull();
    if (!token) {
      setState({ status: 'signed-out' });
      return null;
    }
    const result = await fetchAdminContractorDetail(contractorId, token);
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        setState({ status: 'forbidden' });
      } else if (result.status === 404) {
        setState({ status: 'not-found' });
      } else {
        setState({ status: 'error', message: result.error });
      }
      return null;
    }
    setState({
      status: 'ready',
      contractor: result.data.contractor,
      profileViewCount: result.data.profileViewCount,
      contactEventsTally: result.data.contactEventsTally,
    });
    return token;
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractorId]);

  async function handleApprove() {
    setActionError('');
    setActionStatus('approving');
    const token = await getAccessTokenOrNull();
    if (!token) {
      setActionError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
      setActionStatus('idle');
      return;
    }
    const result = await approveContractor(contractorId, token);
    if (!result.ok) {
      setActionError(result.error);
      setActionStatus('idle');
      return;
    }
    await load();
    setActionStatus('idle');
  }

  async function handleReject() {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setActionError('กรุณาระบุเหตุผลการปฏิเสธ (อย่างน้อย 3 ตัวอักษร)');
      return;
    }
    setActionError('');
    setActionStatus('rejecting');
    const token = await getAccessTokenOrNull();
    if (!token) {
      setActionError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
      setActionStatus('idle');
      return;
    }
    const result = await rejectContractor(contractorId, trimmed, token);
    if (!result.ok) {
      setActionError(result.error);
      setActionStatus('idle');
      return;
    }
    setShowRejectForm(false);
    await load();
    setActionStatus('idle');
  }

  if (state.status === 'loading') {
    return <div className="h-64 animate-pulse rounded-lg bg-brand-50" aria-hidden="true" />;
  }

  if (state.status === 'signed-out') {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-6 text-sm leading-relaxed text-slate-700">
        กรุณา
        <a href="/login" className="mx-1 font-medium text-slate-900 underline">
          เข้าสู่ระบบ
        </a>
        ด้วยบัญชีผู้ดูแลระบบก่อนเข้าใช้งานหน้านี้
      </div>
    );
  }

  if (state.status === 'forbidden') {
    return (
      <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-6 text-sm leading-relaxed text-red-800">
        คุณไม่มีสิทธิ์เข้าถึงหน้านี้ — ต้องเป็นบัญชีผู้ดูแลระบบเท่านั้น
      </div>
    );
  }

  if (state.status === 'not-found') {
    return (
      <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-6 text-sm leading-relaxed text-red-800">
        ไม่พบใบสมัครนี้
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-6 text-sm leading-relaxed text-red-800">
        {state.message}
      </div>
    );
  }

  const c = state.contractor;
  const isPending = c.status === 'pending';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{c.businessName}</h1>
          <p className="mt-1 text-sm text-slate-500">ส่งใบสมัครเมื่อ {formatThaiDate(c.createdAt)}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${
            c.status === 'approved'
              ? 'bg-emerald-100 text-emerald-800'
              : c.status === 'rejected'
                ? 'bg-red-100 text-red-800'
                : c.status === 'suspended'
                  ? 'bg-slate-200 text-slate-700'
                  : 'bg-brand-100 text-brand-800'
          }`}
        >
          {STATUS_LABEL[c.status]}
        </span>
      </div>

      <section>
        <h2 className="text-base font-semibold text-slate-900">ข้อมูลธุรกิจ</h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">จังหวัด / อำเภอ</dt>
            <dd className="text-slate-900">
              {c.province?.name_th ?? 'ไม่ระบุ'}
              {c.district ? ` / ${c.district.name_th}` : ''}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">หมวดหมู่งาน</dt>
            <dd className="text-slate-900">{c.categories.map((cat) => cat.name_th).join(', ') || 'ไม่ระบุ'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">ปีประสบการณ์</dt>
            <dd className="text-slate-900">{c.yearsExperience ?? 'ไม่ระบุ'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">ที่อยู่</dt>
            <dd className="text-slate-900">{c.address || 'ไม่ระบุ'}</dd>
          </div>
        </dl>
        {c.description ? <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">{c.description}</p> : null}
      </section>

      <section>
        <h2 className="text-base font-semibold text-slate-900">ช่องทางติดต่อ</h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">เบอร์โทรศัพท์</dt>
            <dd className="text-slate-900">{c.phone || 'ไม่ระบุ'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">LINE ID</dt>
            <dd className="text-slate-900">{c.lineId || 'ไม่ระบุ'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Facebook</dt>
            <dd className="text-slate-900">{c.facebookUrl || 'ไม่ระบุ'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">เว็บไซต์</dt>
            <dd className="text-slate-900">{c.websiteUrl || 'ไม่ระบุ'}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="text-base font-semibold text-slate-900">สถิติการเข้าชม</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">เข้าชมโปรไฟล์ทั้งหมด</dt>
            <dd className="text-lg font-semibold text-slate-900">{state.profileViewCount.toLocaleString('th-TH')}</dd>
          </div>
          {(Object.keys(CONTACT_EVENT_LABEL) as Array<keyof AdminContactEventTally>)
            .filter((key) => key !== 'profile_view')
            .map((key) => (
              <div key={key}>
                <dt className="text-slate-500">{CONTACT_EVENT_LABEL[key]}</dt>
                <dd className="text-lg font-semibold text-slate-900">
                  {state.contactEventsTally[key].toLocaleString('th-TH')}
                </dd>
              </div>
            ))}
        </dl>
      </section>

      {actionError ? (
        <p role="alert" className="text-sm font-medium text-red-600">
          {actionError}
        </p>
      ) : null}

      {isPending ? (
        <section className="space-y-3 border-t border-slate-200 pt-6">
          <h2 className="text-base font-semibold text-slate-900">การตัดสินใจ</h2>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleApprove}
              disabled={actionStatus !== 'idle'}
              className="rounded-md bg-brand-400 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionStatus === 'approving' ? 'กำลังอนุมัติ...' : 'อนุมัติ'}
            </button>
            <button
              type="button"
              onClick={() => setShowRejectForm((v) => !v)}
              disabled={actionStatus !== 'idle'}
              className="rounded-md border border-red-300 px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              ปฏิเสธ
            </button>
          </div>

          {showRejectForm ? (
            <div className="mt-2 space-y-2">
              <label htmlFor="reject-reason" className="block text-sm font-medium text-slate-700">
                เหตุผลการปฏิเสธ
              </label>
              <textarea
                id="reject-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="block w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm"
              />
              <button
                type="button"
                onClick={handleReject}
                disabled={actionStatus !== 'idle'}
                className="rounded-md bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionStatus === 'rejecting' ? 'กำลังปฏิเสธ...' : 'ยืนยันการปฏิเสธ'}
              </button>
            </div>
          ) : null}
        </section>
      ) : (
        <p className="border-t border-slate-200 pt-6 text-sm text-slate-500">
          ใบสมัครนี้ถูกตัดสินใจไปแล้ว ไม่สามารถเปลี่ยนแปลงได้จากหน้านี้
        </p>
      )}

      <a href="/admin/contractors" className="inline-block text-sm font-medium text-slate-700 hover:underline">
        ← กลับไปรายการรอตรวจสอบ
      </a>
    </div>
  );
}
