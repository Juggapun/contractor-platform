'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import { getAccessTokenOrNull } from '../lib/auth/sessionToken';
import {
  fetchAdminArticles,
  createAdminArticle,
  updateAdminArticle,
  deleteAdminArticle,
  uploadAdminArticleCoverImage,
  type AdminArticle,
} from '../lib/data/adminArticles';
import { ImageFilePicker } from './ImageFilePicker';
import { normalizeImageForUpload } from '../lib/uploads/clientImageNormalize';

/**
 * Issue #42 (Articles, comment 5582752011) — admin CRUD for the
 * Home "บทความ & เคล็ดลับ" entries. `cover_image_status`/
 * `cover_image_error` are surfaced directly so a failed fetch is
 * visible to the admin rather than silently absent.
 *
 * Issue #45 (Owner Decision, comment 5599969267) — "ตอนนี้ Articles ใช้
 * วิธี Admin อัปโหลดรูปเอง" replaces BOTH automated image-fetch paths that
 * existed before this: Issue #42's HTML/og:image scraper (already
 * removed) and Issue #44's Facebook Graph API importer (`AdminFacebookImporter`,
 * still present in the repo but deliberately not rendered here anymore
 * — the Owner's own words are "พักไว้ก่อน...จนกว่า Owner จะสั่งให้กลับมาทำ",
 * paused, not deleted, so it's still available to re-wire in later
 * without redoing that work). The add form below now takes an optional
 * image file directly; existing rows get an inline "เปลี่ยนรูป" action
 * for the exact same upload, reusing `ImageFilePicker` (already built
 * for the contractor profile-image flow — src/components/ContractorManagePanel.tsx)
 * and the same `normalizeImageForUpload()` client-side pre-resize.
 */

type LoadState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'forbidden' }
  | { status: 'error'; message: string }
  | { status: 'ready'; articles: AdminArticle[] };

function formatThaiDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function statusBadge(article: AdminArticle): { text: string; className: string } {
  if (article.cover_image_status === 'success') {
    // Issue #45: cover_image_status/error were originally written for an
    // automated fetch (Issue #42's scraper, then #44's Graph API
    // importer); the image now always comes from the admin's own manual
    // upload (app/api/admin/articles/[id]/cover-image/route.ts), so the
    // wording is upload-neutral rather than claiming something was
    // "fetched".
    return { text: 'มีรูปภาพแล้ว', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  }
  if (article.cover_image_status === 'pending') {
    return { text: 'ยังไม่มีรูปภาพ', className: 'border-slate-200 bg-slate-50 text-slate-600' };
  }
  return {
    text: article.cover_image_error ? `อัปโหลดรูปไม่สำเร็จ: ${article.cover_image_error}` : 'อัปโหลดรูปไม่สำเร็จ',
    className: 'border-red-200 bg-red-50 text-red-700',
  };
}

export function AdminArticlesManager() {
  const pathname = usePathname();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [token, setToken] = useState<string | null>(null);

  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [addStatus, setAddStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [addError, setAddError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editStatus, setEditStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [editError, setEditError] = useState('');

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'deleting' | 'error'>('idle');
  const [deleteError, setDeleteError] = useState('');

  // Issue #45 — "เปลี่ยนรูป" (change image) is its own inline mode per
  // row, separate from the title/URL "แก้ไข" edit mode above — a single
  // shared File/status/error triplet is enough since only one row's
  // image picker is ever open at a time.
  const [changingImageId, setChangingImageId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUploadStatus, setImageUploadStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [imageUploadError, setImageUploadError] = useState('');

  async function load(currentToken: string) {
    const result = await fetchAdminArticles(currentToken);
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        setState({ status: 'forbidden' });
      } else {
        setState({ status: 'error', message: result.error });
      }
      return;
    }
    setState({ status: 'ready', articles: result.data });
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const t = await getAccessTokenOrNull();
      if (!t) {
        if (!cancelled) setState({ status: 'signed-out' });
        return;
      }
      if (cancelled) return;
      setToken(t);
      await load(t);
    }
    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || addStatus === 'submitting') return;
    setAddStatus('submitting');
    setAddError('');
    const result = await createAdminArticle(newUrl, newTitle, token);
    if (!result.ok) {
      setAddStatus('error');
      setAddError(result.error);
      return;
    }
    // The article row exists now regardless of what happens next — an
    // image upload failure here must not look like the whole "add"
    // failed (title/URL are already saved), so this is reported
    // separately rather than rolled into addError.
    if (newImageFile) {
      const normalized = await normalizeImageForUpload(newImageFile);
      const imageResult = await uploadAdminArticleCoverImage(result.data.id, normalized, token);
      if (!imageResult.ok) {
        setAddStatus('error');
        setAddError(`เพิ่มบทความสำเร็จ แต่อัปโหลดรูปไม่สำเร็จ: ${imageResult.error} (แก้ไขรูปได้ภายหลังจากรายการด้านล่าง)`);
        setNewUrl('');
        setNewTitle('');
        setNewImageFile(null);
        await load(token);
        return;
      }
    }
    setAddStatus('idle');
    setNewUrl('');
    setNewTitle('');
    setNewImageFile(null);
    await load(token);
  }

  async function handleChangeImage(id: string) {
    if (!token || !imageFile || imageUploadStatus === 'uploading') return;
    setImageUploadStatus('uploading');
    setImageUploadError('');
    const normalized = await normalizeImageForUpload(imageFile);
    const result = await uploadAdminArticleCoverImage(id, normalized, token);
    if (!result.ok) {
      setImageUploadStatus('error');
      setImageUploadError(result.error);
      return;
    }
    setChangingImageId(null);
    setImageFile(null);
    setImageUploadStatus('idle');
    await load(token);
  }

  function startEdit(article: AdminArticle) {
    setEditingId(article.id);
    setEditUrl(article.facebook_post_url);
    setEditTitle(article.title);
    setEditStatus('idle');
    setEditError('');
  }

  async function handleSaveEdit(id: string) {
    if (!token || editStatus === 'submitting') return;
    setEditStatus('submitting');
    setEditError('');
    const result = await updateAdminArticle(id, { facebookPostUrl: editUrl, title: editTitle }, token);
    if (!result.ok) {
      setEditStatus('error');
      setEditError(result.error);
      return;
    }
    setEditingId(null);
    setEditStatus('idle');
    await load(token);
  }

  async function handleDelete(id: string) {
    if (!token || deleteStatus === 'deleting') return;
    setDeleteStatus('deleting');
    setDeleteError('');
    const result = await deleteAdminArticle(id, token);
    if (!result.ok) {
      setDeleteStatus('error');
      setDeleteError(result.error);
      return;
    }
    setConfirmDeleteId(null);
    setDeleteStatus('idle');
    await load(token);
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

  return (
    <div>
      <form onSubmit={handleAdd} className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">เพิ่มบทความใหม่</h2>
        <div className="mt-3">
          <label htmlFor="new-article-url" className="block text-sm font-medium text-slate-700">
            URL โพสต์ Facebook
          </label>
          <input
            id="new-article-url"
            type="url"
            required
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://www.facebook.com/yourpage/posts/12345"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-3">
          <label htmlFor="new-article-title" className="block text-sm font-medium text-slate-700">
            หัวข้อบทความ
          </label>
          <input
            id="new-article-title"
            type="text"
            required
            maxLength={200}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="ชื่อบทความที่จะแสดงบนหน้าแรก"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-3">
          <ImageFilePicker
            id="new-article-image"
            label="รูปภาพบทความ (ไม่บังคับ)"
            value={newImageFile}
            onChange={setNewImageFile}
          />
          <p className="mt-1 text-xs text-slate-500">
            แนะนำภาพแนวนอนอัตราส่วน 1.91:1 (เช่น 1200×628) — ถ้าอัตราส่วนต่างจากนี้ ระบบจะครอปให้อัตโนมัติ
          </p>
        </div>
        {addStatus === 'error' && addError ? (
          <p role="alert" className="mt-3 text-sm font-medium text-red-600">
            {addError}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={addStatus === 'submitting'}
          className="mt-4 rounded-md bg-brand-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {addStatus === 'submitting' ? 'กำลังเพิ่ม...' : 'เพิ่มบทความ'}
        </button>
        {!newImageFile ? (
          <p className="mt-2 text-xs text-slate-500">
            ถ้าไม่เลือกรูป บทความจะแสดงกรอบว่างชั่วคราว — เพิ่ม/เปลี่ยนรูปได้ภายหลังจากรายการด้านล่าง
          </p>
        ) : null}
      </form>

      <div className="mt-8">
        {state.articles.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-[15px] leading-relaxed text-slate-500">
            ยังไม่มีบทความ — เพิ่มบทความแรกด้านบน
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {state.articles.map((article) => {
              const badge = statusBadge(article);
              const isEditing = editingId === article.id;
              const isConfirmingDelete = confirmDeleteId === article.id;
              const isChangingImage = changingImageId === article.id;

              return (
                <li key={article.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-1 gap-3">
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      {article.cover_image_url ? (
                        <img src={article.cover_image_url} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <input
                            type="url"
                            value={editUrl}
                            onChange={(e) => setEditUrl(e.target.value)}
                            className="block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                          />
                          <input
                            type="text"
                            maxLength={200}
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                          />
                          {editStatus === 'error' && editError ? (
                            <p role="alert" className="text-sm font-medium text-red-600">
                              {editError}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <>
                          <p className="truncate font-semibold text-slate-900">{article.title}</p>
                          <a
                            href={article.facebook_post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 block truncate text-sm text-slate-500 hover:text-brand-600 hover:underline"
                          >
                            {article.facebook_post_url}
                          </a>
                          <span
                            className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${badge.className}`}
                          >
                            {badge.text}
                          </span>
                          <p className="mt-1 text-xs text-slate-400">เพิ่มเมื่อ {formatThaiDate(article.created_at)}</p>
                        </>
                      )}
                      {isChangingImage ? (
                        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                          <ImageFilePicker id={`change-image-${article.id}`} label="เลือกรูปใหม่" value={imageFile} onChange={setImageFile} />
                          <p className="mt-1 text-xs text-slate-500">
                            แนะนำภาพแนวนอนอัตราส่วน 1.91:1 (เช่น 1200×628) — ถ้าอัตราส่วนต่างจากนี้ ระบบจะครอปให้อัตโนมัติ
                          </p>
                          {imageUploadStatus === 'error' && imageUploadError ? (
                            <p role="alert" className="mt-1 text-sm font-medium text-red-600">
                              {imageUploadError}
                            </p>
                          ) : null}
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleChangeImage(article.id)}
                              disabled={!imageFile || imageUploadStatus === 'uploading'}
                              className="rounded-md bg-brand-400 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {imageUploadStatus === 'uploading' ? 'กำลังอัปโหลด...' : 'บันทึกรูป'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setChangingImageId(null);
                                setImageFile(null);
                                setImageUploadStatus('idle');
                                setImageUploadError('');
                              }}
                              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2 sm:flex-col">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(article.id)}
                          disabled={editStatus === 'submitting'}
                          className="rounded-md bg-brand-400 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {editStatus === 'submitting' ? 'กำลังบันทึก...' : 'บันทึก'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          ยกเลิก
                        </button>
                      </>
                    ) : isConfirmingDelete ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDelete(article.id)}
                          disabled={deleteStatus === 'deleting'}
                          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deleteStatus === 'deleting' ? 'กำลังลบ...' : 'ยืนยันการลบ'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          ยกเลิก
                        </button>
                      </>
                    ) : isChangingImage ? null : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(article)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          แก้ไข
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setChangingImageId(article.id);
                            setImageFile(null);
                            setImageUploadStatus('idle');
                            setImageUploadError('');
                          }}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          เปลี่ยนรูป
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(article.id)}
                          className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                        >
                          ลบ
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {deleteStatus === 'error' && deleteError ? (
          <p role="alert" className="mt-3 text-sm font-medium text-red-600">
            {deleteError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
