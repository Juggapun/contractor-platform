'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '../lib/auth/authService';
import { getAccessTokenOrNull } from '../lib/auth/sessionToken';
import { getMyContractorApplication } from '../lib/data/contractorSelfStatus';
import { normalizeImageForUpload } from '../lib/uploads/clientImageNormalize';

const PORTFOLIO_IMAGE_LIMIT = 20;
const PORTFOLIO_ACCEPT = 'image/jpeg,image/png,image/webp';

/**
 * Issue #37 — a "+" tile inside the PUBLIC profile's own portfolio grid,
 * visible only to the contractor viewing their OWN profile, so adding a
 * portfolio image later doesn't require navigating away to
 * /contractors/manage first. This is a second entry point into the
 * exact same upload route, validation, and client-side normalization
 * ContractorManagePanel.tsx's batch-upload flow already uses — no new
 * upload rule is invented here.
 *
 * Ownership is resolved client-side, the same way ContractorManagePanel
 * already does (this codebase has no cookie-based session to check
 * server-side): getMyContractorApplication() reads the caller's own
 * `contractors` row via the anon-key client, backed by
 * `contractors_select_approved_public`'s `user_id = auth.uid()` branch
 * (0013_rls_policies.sql) — a contractor can always read their own row
 * regardless of status. That result is compared against this profile's
 * `contractorId`; if they don't match (or there's no session at all),
 * this renders nothing. This check is UI convenience only, never the
 * real authorization boundary: the upload route
 * (requireContractorOwner(), app/api/contractors/_lib/) independently
 * re-verifies the bearer token and re-derives the caller's own
 * contractor id itself, and never accepts a contractor id from the
 * client at all — so even a modified/bypassed client can never upload
 * to someone else's portfolio through this tile.
 *
 * On a successful upload, calls `router.refresh()` rather than keeping
 * a second client-side copy of the portfolio array in sync with the
 * server-rendered one above it — the profile page is a Server
 * Component (`force-dynamic`), so a refresh re-fetches the real
 * `portfolioImages` list from the server and this tile's own
 * `currentCount` prop updates from that, automatically flipping to the
 * "full" state once 20 is reached without this component tracking the
 * cap itself.
 */
export function PortfolioAddTile({ contractorId, currentCount }: { contractorId: string; currentCount: number }) {
  const router = useRouter();
  const [isOwner, setIsOwner] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await getCurrentUser().catch(() => null);
      if (!user) return;
      const app = await getMyContractorApplication(user.id);
      if (!cancelled && app && app.id === contractorId) {
        setIsOwner(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contractorId]);

  if (!isOwner) return null;

  const isFull = currentCount >= PORTFOLIO_IMAGE_LIMIT;

  async function handleFilePicked(file: File) {
    setUploading(true);
    setError('');
    const token = await getAccessTokenOrNull();
    if (!token) {
      setError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง');
      setUploading(false);
      return;
    }
    const formData = new FormData();
    formData.set('image', await normalizeImageForUpload(file));
    try {
      const response = await fetch('/api/contractors/me/portfolio', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const result = (await response.json().catch(() => null)) as { ok: boolean; error?: string } | null;
      if (!response.ok || !result?.ok) {
        setError(result?.error || 'อัปโหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        setUploading(false);
        return;
      }
      setUploading(false);
      router.refresh();
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง');
      setUploading(false);
    }
  }

  return (
    <li className="overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">
      {isFull ? (
        <div className="flex h-32 flex-col items-center justify-center p-2 text-center text-xs text-slate-500">
          <span>ผลงานครบจำนวนสูงสุดแล้ว</span>
          <span>({PORTFOLIO_IMAGE_LIMIT} รูป)</span>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="เพิ่มผลงานใหม่"
            className="flex h-32 w-full flex-col items-center justify-center gap-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? (
              <span className="text-xs font-medium">กำลังอัปโหลด...</span>
            ) : (
              <>
                <span className="text-3xl leading-none" aria-hidden="true">
                  +
                </span>
                <span className="text-xs font-medium">เพิ่มผลงาน</span>
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={PORTFOLIO_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void handleFilePicked(file);
            }}
          />
        </>
      )}
      {error ? (
        <p role="alert" className="p-1 text-center text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </li>
  );
}
