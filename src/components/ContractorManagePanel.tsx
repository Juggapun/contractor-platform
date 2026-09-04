'use client';

/**
 * Issue #23 — post-approval self-service: manage the caller's own
 * contractor profile image and portfolio (add up to the 20-image cap,
 * delete, replace the profile image). Deliberately NOT gated on
 * contractor status here (pending/rejected/suspended can still manage
 * their own images before/after a decision) — this matches
 * requireContractorOwner()'s own boundary (app/api/contractors/_lib/requireContractorOwner.ts),
 * which is itself the same ownership boundary RLS already enforces
 * (portfolio_images_owner_write, 0013_rls_policies.sql), not a stricter
 * UI-only rule invented here. A pending/rejected/suspended contractor's
 * images are simply not PUBLICLY visible yet (or ever, if rejected) —
 * see contractors_select_approved_public / portfolio_images_select.
 */
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getCurrentUser } from '../lib/auth/authService';
import { getAccessTokenOrNull } from '../lib/auth/sessionToken';
import { getMyContractorApplication, type MyContractorApplication } from '../lib/data/contractorSelfStatus';
import { getPortfolioImages, type PortfolioImage } from '../lib/data/portfolio';
import { normalizeImageForUpload } from '../lib/uploads/clientImageNormalize';
import { ImageFilePicker } from './ImageFilePicker';

const PORTFOLIO_IMAGE_LIMIT = 20;
const PORTFOLIO_ACCEPT = 'image/jpeg,image/png,image/webp';

/** Shape of app/api/contractors/me/portfolio/route.ts's `image` field —
 * matches PortfolioImage exactly (Issue #28 trimmed the latter down to
 * the same four columns the route's own `.select(...)` already
 * returned). */
type InsertedPortfolioImage = PortfolioImage;

/**
 * Issue #26 — one file staged for the multi-image portfolio upload,
 * from selection through the batch upload run. The route this posts to
 * (app/api/contractors/me/portfolio/route.ts) only ever accepts ONE
 * file per request by design ("the client loops this call once per
 * selected file" — that route's own header comment); a batch here is
 * exactly that loop, sequential (never parallel, to avoid two of our
 * own requests racing the server's own count-check against the 20-cap),
 * with each file's own outcome tracked independently so one failure
 * never rolls back the files that already succeeded.
 */
type PortfolioBatchItem = {
  key: string;
  file: File;
  projectName: string;
  previewUrl: string;
  status: 'staged' | 'uploading' | 'success' | 'error';
  error?: string;
};

const STATUS_LABEL: Record<MyContractorApplication['status'], string> = {
  pending: 'รอตรวจสอบ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ถูกปฏิเสธ',
  suspended: 'ถูกระงับ',
};

type LoadState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'no-application' }
  | { status: 'ready'; app: MyContractorApplication; portfolio: PortfolioImage[] };

export function ContractorManagePanel() {
  const pathname = usePathname();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');

  const [batch, setBatch] = useState<PortfolioBatchItem[]>([]);
  const [portfolioError, setPortfolioError] = useState('');
  const [batchUploading, setBatchUploading] = useState(false);
  const [batchSummary, setBatchSummary] = useState<{ success: number; failed: number } | null>(null);
  const batchRef = useRef<PortfolioBatchItem[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    batchRef.current = batch;
  }, [batch]);

  // Revoke every still-staged preview object URL on unmount (successful/removed
  // items already revoke their own as they leave `batch` — see removeBatchItem
  // and handleUploadBatch below).
  useEffect(() => {
    return () => {
      batchRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const user = await getCurrentUser().catch(() => null);
      if (!user) {
        if (!cancelled) setState({ status: 'signed-out' });
        return;
      }
      const app = await getMyContractorApplication(user.id);
      if (cancelled) return;
      if (!app) {
        setState({ status: 'no-application' });
        return;
      }
      const portfolio = await getPortfolioImages(app.id);
      if (cancelled) return;
      setState({ status: 'ready', app, portfolio });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSaveProfileImage() {
    if (!profileImageFile) return;
    setProfileSaving(true);
    setProfileError('');
    const token = await getAccessTokenOrNull();
    if (!token) {
      setProfileError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง');
      setProfileSaving(false);
      return;
    }
    const formData = new FormData();
    formData.set('image', await normalizeImageForUpload(profileImageFile));
    try {
      const response = await fetch('/api/contractors/me/profile-image', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const result = (await response.json().catch(() => null)) as { ok: boolean; profileImageUrl?: string; error?: string } | null;
      if (!response.ok || !result?.ok) {
        setProfileError(result?.error || 'อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        setProfileSaving(false);
        return;
      }
      setState((prev) =>
        prev.status === 'ready' ? { ...prev, app: { ...prev.app, profileImageUrl: result.profileImageUrl ?? null } } : prev
      );
      setProfileImageFile(null);
    } catch {
      setProfileError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setProfileSaving(false);
    }
  }

  // Issue #26: the picker's own "current count" comes from `portfolio.length`
  // at the moment of selection — a courtesy check for UX only. The real,
  // unbypassable 20-cap enforcement happens per-file server-side in
  // app/api/contractors/me/portfolio/route.ts (a count query plus
  // trg_portfolio_images_enforce_limit, 0019_portfolio_image_limit.sql),
  // which every file in this batch still goes through exactly as before.
  function handleBatchPick(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const picked = Array.from(fileList);
    const remaining = state.status === 'ready' ? PORTFOLIO_IMAGE_LIMIT - state.portfolio.length : 0;
    if (picked.length > remaining) {
      setPortfolioError(
        `คุณเลือกไฟล์ ${picked.length} รูป แต่เหลือที่ว่างอีกเพียง ${remaining} รูป (สูงสุด ${PORTFOLIO_IMAGE_LIMIT} รูป) กรุณาเลือกไม่เกิน ${remaining} รูป`
      );
      return;
    }
    setPortfolioError('');
    setBatchSummary(null);
    batch.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setBatch(
      picked.map((file, index) => ({
        key: `${Date.now()}-${index}-${file.name}`,
        file,
        projectName: '',
        previewUrl: URL.createObjectURL(file),
        status: 'staged',
      }))
    );
  }

  function removeBatchItem(key: string) {
    setBatch((prev) => {
      const item = prev.find((i) => i.key === key);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.key !== key);
    });
  }

  function updateBatchProjectName(key: string, projectName: string) {
    setBatch((prev) => prev.map((i) => (i.key === key ? { ...i, projectName } : i)));
  }

  async function handleUploadBatch() {
    if (batch.length === 0 || batchUploading) return;
    const itemsToUpload = batch;
    setBatchUploading(true);
    setPortfolioError('');
    setBatchSummary(null);
    const token = await getAccessTokenOrNull();
    if (!token) {
      setPortfolioError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง');
      setBatchUploading(false);
      return;
    }

    let successCount = 0;
    let failedCount = 0;

    // Sequential, not parallel: each request independently re-checks the
    // 20-cap server-side, so running them one at a time avoids our own
    // batch racing itself against that check — see this function's own
    // header comment. Partial failure is the expected, handled case: a
    // failed file stays in `batch` (status 'error', with its reason) so
    // the user can see exactly which ones didn't make it and retry or
    // remove them, while every file that already succeeded is appended
    // to `portfolio` immediately and never rolled back.
    for (const item of itemsToUpload) {
      setBatch((prev) => prev.map((i) => (i.key === item.key ? { ...i, status: 'uploading' } : i)));
      const formData = new FormData();
      formData.set('image', await normalizeImageForUpload(item.file));
      if (item.projectName.trim()) formData.set('projectName', item.projectName.trim());
      try {
        const response = await fetch('/api/contractors/me/portfolio', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const result = (await response.json().catch(() => null)) as { ok: boolean; image?: InsertedPortfolioImage; error?: string } | null;
        if (!response.ok || !result?.ok || !result.image) {
          failedCount += 1;
          const message = result?.error || 'อัปโหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
          setBatch((prev) => prev.map((i) => (i.key === item.key ? { ...i, status: 'error', error: message } : i)));
          continue;
        }
        successCount += 1;
        const addedImage = result.image;
        setState((prev) => (prev.status === 'ready' ? { ...prev, portfolio: [...prev.portfolio, addedImage] } : prev));
        URL.revokeObjectURL(item.previewUrl);
        setBatch((prev) => prev.filter((i) => i.key !== item.key));
      } catch {
        failedCount += 1;
        setBatch((prev) =>
          prev.map((i) =>
            i.key === item.key ? { ...i, status: 'error', error: 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง' } : i
          )
        );
      }
    }

    setBatchUploading(false);
    setBatchSummary({ success: successCount, failed: failedCount });
  }

  async function handleDeletePortfolioImage(id: string) {
    setDeletingId(id);
    setPortfolioError('');
    const token = await getAccessTokenOrNull();
    if (!token) {
      setPortfolioError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง');
      setDeletingId(null);
      return;
    }
    try {
      const response = await fetch(`/api/contractors/me/portfolio/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = (await response.json().catch(() => null)) as { ok: boolean; error?: string } | null;
      if (!response.ok || !result?.ok) {
        setPortfolioError(result?.error || 'ลบรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        setDeletingId(null);
        return;
      }
      setState((prev) => (prev.status === 'ready' ? { ...prev, portfolio: prev.portfolio.filter((p) => p.id !== id) } : prev));
    } catch {
      setPortfolioError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setDeletingId(null);
    }
  }

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
        ก่อนจัดการรูปภาพผู้รับเหมาของคุณ
      </div>
    );
  }

  if (state.status === 'no-application') {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-6 text-sm leading-relaxed text-slate-700">
        บัญชีนี้ยังไม่มีใบสมัครผู้รับเหมา
        <a href="/contractors/register" className="ml-1 font-medium text-slate-900 underline">
          สมัครเป็นผู้รับเหมา
        </a>
      </div>
    );
  }

  const { app, portfolio } = state;
  const portfolioFull = portfolio.length >= PORTFOLIO_IMAGE_LIMIT;

  return (
    <div className="space-y-10">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">
          {app.businessName} · สถานะ: <span className="font-medium">{STATUS_LABEL[app.status]}</span>
        </p>
      </div>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">รูปโปรไฟล์</h2>
        {app.profileImageUrl ? (
          <img src={app.profileImageUrl} alt="รูปโปรไฟล์ปัจจุบัน" className="h-24 w-24 rounded-lg object-cover" />
        ) : (
          <p className="text-sm text-slate-500">ยังไม่มีรูปโปรไฟล์</p>
        )}
        <ImageFilePicker id="manage-profileImage" label="เลือกรูปใหม่" value={profileImageFile} onChange={setProfileImageFile} />
        {profileError ? (
          <p role="alert" className="text-sm text-red-700">
            {profileError}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleSaveProfileImage}
          disabled={!profileImageFile || profileSaving}
          className="rounded-md bg-brand-400 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {profileSaving ? 'กำลังบันทึก...' : 'บันทึกรูปโปรไฟล์'}
        </button>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          ผลงาน <span className="font-normal text-slate-500">({portfolio.length}/{PORTFOLIO_IMAGE_LIMIT})</span>
        </h2>

        {portfolio.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มีรูปผลงาน</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {portfolio.map((image) => (
              <li key={image.id} className="relative">
                <img src={image.thumbnail_url} alt={image.project_name || 'ผลงาน'} className="h-24 w-full rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => handleDeletePortfolioImage(image.id)}
                  disabled={deletingId === image.id}
                  aria-label="ลบรูปผลงานนี้"
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-600 shadow ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-60"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        {portfolioError ? (
          <p role="alert" className="text-sm text-red-700">
            {portfolioError}
          </p>
        ) : null}

        {portfolioFull ? (
          <p className="text-sm text-amber-700">ผลงานครบจำนวนสูงสุดแล้ว ({PORTFOLIO_IMAGE_LIMIT} รูป) กรุณาลบรูปเก่าก่อนเพิ่มรูปใหม่</p>
        ) : (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div>
              <label htmlFor="manage-newPortfolioImages" className="block text-sm font-medium text-slate-700">
                เพิ่มรูปผลงานใหม่{' '}
                <span className="font-normal text-slate-500">
                  (เลือกได้ครั้งละหลายรูป — เหลืออีก {PORTFOLIO_IMAGE_LIMIT - portfolio.length} รูป)
                </span>
              </label>
              <input
                id="manage-newPortfolioImages"
                type="file"
                accept={PORTFOLIO_ACCEPT}
                multiple
                disabled={batchUploading}
                onChange={(e) => {
                  handleBatchPick(e.target.files);
                  e.target.value = '';
                }}
                className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            {batch.length > 0 ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {batch.map((item) => (
                  <li key={item.key} className="space-y-1">
                    <div className="relative">
                      <img src={item.previewUrl} alt="ตัวอย่างรูปที่เลือกไว้รอการอัปโหลด" className="h-24 w-full rounded-lg object-cover" />
                      {item.status === 'uploading' ? (
                        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 text-xs font-medium text-white">
                          กำลังอัปโหลด...
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => removeBatchItem(item.key)}
                          aria-label="เอาออกจากรายการที่จะอัปโหลด"
                          className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-600 shadow ring-1 ring-slate-300 hover:bg-slate-50"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={item.projectName}
                      onChange={(e) => updateBatchProjectName(item.key, e.target.value)}
                      disabled={item.status === 'uploading'}
                      placeholder="ชื่อผลงาน (ไม่บังคับ)"
                      maxLength={200}
                      aria-label="ชื่อผลงาน (ไม่บังคับ)"
                      className="block w-full rounded-md border border-slate-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    {item.status === 'error' && item.error ? (
                      <p role="alert" className="text-xs text-red-700">
                        {item.error}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            {batchSummary ? (
              <p className={`text-sm ${batchSummary.failed > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {batchSummary.failed > 0
                  ? `อัปโหลดสำเร็จ ${batchSummary.success} จาก ${batchSummary.success + batchSummary.failed} รูป — กรุณาตรวจสอบรูปที่ผิดพลาดด้านล่างแล้วลองใหม่ หรือเอาออกจากรายการ`
                  : `อัปโหลดสำเร็จทั้งหมด ${batchSummary.success} รูป`}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleUploadBatch}
              disabled={batch.length === 0 || batchUploading}
              className="rounded-md bg-brand-400 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {batchUploading ? 'กำลังอัปโหลด...' : batch.length > 0 ? `อัปโหลด ${batch.length} รูป` : 'อัปโหลดรูปผลงาน'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
