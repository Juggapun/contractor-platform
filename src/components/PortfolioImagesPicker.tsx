'use client';

import { useEffect, useState } from 'react';

const ACCEPT = 'image/jpeg,image/png,image/webp';

/**
 * Issue #23 — up to `max` portfolio images picked at once (the
 * registration form's 0-5 initial-portfolio step). Adding files beyond
 * `max` is silently capped client-side (UX only — the server route
 * re-validates the real count independently); each preview can be
 * removed individually before submitting.
 */
export function PortfolioImagesPicker({
  id,
  label,
  value,
  onChange,
  max,
}: {
  id: string;
  label: string;
  value: File[];
  onChange: (files: File[]) => void;
  max: number;
}) {
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    const urls = value.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [value]);

  function handlePick(fileList: FileList | null) {
    if (!fileList) return;
    const picked = Array.from(fileList);
    onChange([...value, ...picked].slice(0, max));
  }

  function handleRemove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label} <span className="font-normal text-slate-400">({value.length}/{max})</span>
      </label>
      <input
        id={id}
        type="file"
        accept={ACCEPT}
        multiple
        disabled={value.length >= max}
        onChange={(e) => {
          handlePick(e.target.files);
          e.target.value = '';
        }}
        className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
      />
      {previewUrls.length > 0 ? (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {previewUrls.map((url, index) => (
            <li key={url} className="relative">
              <img src={url} alt={`ตัวอย่างผลงานที่ ${index + 1}`} className="h-20 w-full rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => handleRemove(index)}
                aria-label={`ลบรูปที่ ${index + 1}`}
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-600 shadow ring-1 ring-slate-300 hover:bg-slate-50"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
