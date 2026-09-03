'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getAccessTokenOrNull } from '../lib/auth/sessionToken';
import { fetchAdminContractors, type AdminContractor } from '../lib/data/adminContractors';

type LoadState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'forbidden' }
  | { status: 'error'; message: string }
  | { status: 'ready'; contractors: AdminContractor[] };

function formatThaiDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export function AdminContractorQueue() {
  const pathname = usePathname();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const token = await getAccessTokenOrNull();
      if (!token) {
        if (!cancelled) setState({ status: 'signed-out' });
        return;
      }
      const result = await fetchAdminContractors('pending', token);
      if (cancelled) return;
      if (!result.ok) {
        if (result.status === 401 || result.status === 403) {
          setState({ status: 'forbidden' });
        } else {
          setState({ status: 'error', message: result.error });
        }
        return;
      }
      setState({ status: 'ready', contractors: result.data });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return <div className="h-40 animate-pulse rounded-lg bg-brand-50" aria-hidden="true" />;
  }

  if (state.status === 'signed-out') {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-6 text-sm leading-relaxed text-slate-700">
        กรุณา
        <a href={`/login?redirect=${encodeURIComponent(pathname)}`} className="mx-1 font-medium text-slate-900 underline">
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

  if (state.status === 'error') {
    return (
      <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-6 text-sm leading-relaxed text-red-800">
        {state.message}
      </div>
    );
  }

  if (state.contractors.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-[15px] leading-relaxed text-slate-500">
        ไม่มีใบสมัครที่รอตรวจสอบในขณะนี้
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {state.contractors.map((c) => (
        <li key={c.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-slate-900">{c.businessName}</p>
            <p className="mt-1 text-sm text-slate-600">
              {c.province?.name_th ?? 'ไม่ระบุจังหวัด'}
              {c.district ? ` — ${c.district.name_th}` : ''}
              {' · '}
              {c.categories.map((cat) => cat.name_th).join(', ') || 'ไม่ระบุหมวดหมู่'}
            </p>
            <p className="mt-1 text-xs text-slate-400">ส่งใบสมัครเมื่อ {formatThaiDate(c.createdAt)}</p>
          </div>
          <a
            href={`/admin/contractors/${c.id}`}
            className="inline-block shrink-0 rounded-md bg-brand-400 px-4 py-2 text-center text-sm font-semibold text-slate-900 hover:bg-brand-500"
          >
            ตรวจสอบ
          </a>
        </li>
      ))}
    </ul>
  );
}
