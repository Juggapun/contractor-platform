'use client';

import { useState } from 'react';
import {
  fetchFacebookPagePosts,
  importFacebookPost,
  type FacebookPostPreview,
} from '../lib/data/adminArticles';

/**
 * Issue #44 — "ดึงโพสต์ล่าสุดจาก Facebook" admin importer, replacing the
 * old manual-URL-triggers-an-HTML-scrape flow (Issue #42) for getting a
 * real image. Rendered inside AdminArticlesManager, above the existing
 * manual add-by-URL form (which stays available per Issue #44 point 9 —
 * this is an addition, not a replacement of that form).
 *
 * Each preview row's title is a plain editable input, pre-filled with a
 * candidate derived server-side from the post's own text
 * (deriveTitleCandidate in src/lib/facebook/graphApi.ts) — "keep title
 * editable before/after import" (Issue #44 point 6). The permalink,
 * image, and post id are never editable here: those always come fresh
 * from the server on import (POST /api/admin/articles/facebook/import
 * re-fetches the post by id rather than trusting this preview's data),
 * so editing them here would be pointless — they're display-only.
 */

type ListState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; posts: FacebookPostPreview[] };

type ImportState = 'idle' | 'importing' | 'success' | 'error';

function formatThaiDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export function AdminFacebookImporter({ token, onImported }: { token: string; onImported: () => void }) {
  const [listState, setListState] = useState<ListState>({ status: 'idle' });
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [importStates, setImportStates] = useState<Record<string, ImportState>>({});
  const [importErrors, setImportErrors] = useState<Record<string, string>>({});

  async function handleFetchPosts() {
    setListState({ status: 'loading' });
    const result = await fetchFacebookPagePosts(token);
    if (!result.ok) {
      setListState({ status: 'error', message: result.error });
      return;
    }
    setListState({ status: 'ready', posts: result.data });
    setTitleDrafts(Object.fromEntries(result.data.map((post) => [post.id, post.titleCandidate])));
  }

  async function handleImport(post: FacebookPostPreview) {
    if (importStates[post.id] === 'importing') return;
    setImportStates((s) => ({ ...s, [post.id]: 'importing' }));
    setImportErrors((e) => ({ ...e, [post.id]: '' }));

    const title = (titleDrafts[post.id] ?? post.titleCandidate).trim();
    const result = await importFacebookPost(post.id, title || undefined, token);
    if (!result.ok) {
      setImportStates((s) => ({ ...s, [post.id]: 'error' }));
      setImportErrors((e) => ({ ...e, [post.id]: result.error }));
      return;
    }
    setImportStates((s) => ({ ...s, [post.id]: 'success' }));
    if (listState.status === 'ready') {
      setListState({
        status: 'ready',
        posts: listState.posts.map((p) => (p.id === post.id ? { ...p, alreadyImported: true } : p)),
      });
    }
    onImported();
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">นำเข้าจากเพจ Facebook</h2>
          <p className="mt-1 text-xs text-slate-500">
            ดึงโพสต์ล่าสุดจากเพจ Facebook ของเรา แล้วเลือกนำเข้าเป็นบทความ
          </p>
        </div>
        <button
          type="button"
          onClick={handleFetchPosts}
          disabled={listState.status === 'loading'}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {listState.status === 'loading' ? 'กำลังดึงโพสต์...' : 'ดึงโพสต์ล่าสุดจาก Facebook'}
        </button>
      </div>

      {listState.status === 'error' ? (
        <p role="alert" className="mt-3 text-sm font-medium text-red-600">
          {listState.message}
        </p>
      ) : null}

      {listState.status === 'ready' ? (
        listState.posts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">ไม่พบโพสต์ล่าสุดจากเพจนี้</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200">
            {listState.posts.map((post) => {
              const importState = importStates[post.id] ?? 'idle';
              return (
                <li key={post.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    {post.imageUrl ? (
                      <img src={post.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <input
                      type="text"
                      maxLength={200}
                      value={titleDrafts[post.id] ?? post.titleCandidate}
                      onChange={(e) => setTitleDrafts((d) => ({ ...d, [post.id]: e.target.value }))}
                      className="block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                    <a
                      href={post.permalinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block truncate text-xs text-slate-500 hover:text-brand-600 hover:underline"
                    >
                      {post.permalinkUrl}
                    </a>
                    <p className="mt-1 text-xs text-slate-400">{formatThaiDate(post.createdTime)}</p>
                    {importState === 'error' && importErrors[post.id] ? (
                      <p role="alert" className="mt-1 text-xs font-medium text-red-600">
                        {importErrors[post.id]}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex-shrink-0">
                    {post.alreadyImported && importState !== 'importing' ? (
                      <span className="inline-block rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-500">
                        นำเข้าแล้ว
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleImport(post)}
                        disabled={importState === 'importing'}
                        className="rounded-md bg-brand-400 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {importState === 'importing' ? 'กำลังนำเข้า...' : 'นำเข้า'}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </div>
  );
}
