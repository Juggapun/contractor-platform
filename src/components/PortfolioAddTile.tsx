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
 *
 * Issue #39 — the file input accepts multiple files. Uploads run
 * SEQUENTIALLY (one `fetch` at a time, never `Promise.all`), the exact
 * same reasoning as ContractorManagePanel.tsx's own batch upload: the
 * upload route only ever accepts one file per request (never a new
 * "batch" endpoint — no second upload pipeline is introduced), each
 * request independently re-checks the 20-cap server-side, and running
 * them one at a time avoids this component's own selection racing that
 * check. Sequential processing also means only one file is ever being
 * normalized/held as a Blob in memory at a time, not all of them at
 * once. A file failing (validation, cap reached mid-batch, network)
 * never stops the remaining files in the same selection from being
 * attempted — each request's own outcome is independent, matching
 * ContractorManagePanel's "partial failure is expected and handled, not
 * a fatal error" posture. This tile stays deliberately simpler than the
 * Manage page's own batch UI, though: no per-file preview grid or
 * per-file project-name inputs — just the same "+" tile plus a
 * lightweight aggregate progress readout, which is all Issue #39 itself
 * asks for.
 */
export function PortfolioAddTile({ contractorId, currentCount }: { contractorId: string; currentCount: number }) {
  const router = useRouter();
  const [isOwner, setIsOwner] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
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

  async function handleFilesPicked(fileList: FileList) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    // Courtesy check only, same as ContractorManagePanel's handleBatchPick —
    // the real, unbypassable 20-cap enforcement is server-side (a count
    // query plus trg_portfolio_images_enforce_limit) regardless of what
    // this check does.
    const remaining = PORTFOLIO_IMAGE_LIMIT - currentCount;
    if (files.length > remaining) {
      setError(
        `คุณเลือกไฟล์ ${files.length} รูป แต่เหลือที่ว่างอีกเพียง ${remaining} รูป (สูงสุด ${PORTFOLIO_IMAGE_LIMIT} รูป) กรุณาเลือกไม่เกิน ${remaining} รูป`
      );
      return;
    }

    setUploading(true);
    setError('');
    setProgress({ done: 0, total: files.length });
    const token = await getAccessTokenOrNull();
    if (!token) {
      setError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง');
      setUploading(false);
      setProgress(null);
      return;
    }

    let successCount = 0;
    let failedCount = 0;
    for (const file of files) {
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
          failedCount += 1;
        } else {
          successCount += 1;
        }
      } catch {
        failedCount += 1;
      }
      setProgress((p) => (p ? { done: p.done + 1, total: p.total } : p));
    }

    setUploading(false);
    setProgress(null);
    if (failedCount > 0) {
      setError(
        successCount > 0
          ? `อัปโหลดสำเร็จ ${successCount} จาก ${successCount + failedCount} รูป — รูปที่เหลือไม่สำเร็จ กรุณาลองใหม่ (สามารถจัดการรูปผลงานเพิ่มเติมได้ที่หน้าจัดการโปรไฟล์)`
          : `อัปโหลดไม่สำเร็จทั้งหมด (${failedCount} รูป) กรุณาลองใหม่อีกครั้ง`
      );
    }
    if (successCount > 0) {
      router.refresh();
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
            aria-label="เพิ่มผลงานใหม่ (เลือกได้หลายรูป)"
            className="flex h-32 w-full flex-col items-center justify-center gap-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? (
              <span className="text-xs font-medium">
                {progress ? `กำลังอัปโหลด ${progress.done}/${progress.total} รูป...` : 'กำลังอัปโหลด...'}
              </span>
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
            multiple
            className="hidden"
            onChange={(e) => {
              // Read/copy `files` out (handleFilesPicked's own first line is
              // `Array.from(fileList)`, executed synchronously before this
              // function call returns) BEFORE resetting the input's value —
              // the reverse order can leave the FileList already emptied by
              // the time it's read, since it reflects the input's live
              // selection. Same ordering ContractorManagePanel's own
              // onChange already gets right.
              const { files } = e.target;
              if (files && files.length > 0) void handleFilesPicked(files);
              e.target.value = '';
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
