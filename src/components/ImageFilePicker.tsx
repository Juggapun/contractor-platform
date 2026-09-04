'use client';

import { useEffect, useRef, useState } from 'react';

const ACCEPT = 'image/jpeg,image/png,image/webp';

/**
 * Issue #23 — a single optional image picker with a live preview,
 * reused by both the registration form's "profile image" field and the
 * post-approval management page's "replace profile image" /
 * "add one portfolio image" controls. Client-side `accept` is a UX hint
 * only — every byte is re-validated server-side (src/lib/uploads/imageValidation.ts)
 * regardless of what this lets a user pick.
 */
export function ImageFilePicker({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: File | null;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  function handleRemove() {
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-3">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="ตัวอย่างรูปภาพที่เลือก"
            className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
          />
        ) : null}
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={ACCEPT}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-brand-100"
        />
        {value ? (
          <button
            type="button"
            onClick={handleRemove}
            className="flex-shrink-0 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            ลบ
          </button>
        ) : null}
      </div>
    </div>
  );
}
