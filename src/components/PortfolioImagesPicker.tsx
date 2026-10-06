'use client';

import { useEffect, useState } from 'react';

import { ImageUploadButton } from './ImageUploadButton';

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
      <div className="mt-2">
      <ImageUploadButton
        id={id}
        label={value.length >= max ? 'เลือกรูปครบแล้ว' : value.length ? 'เพิ่มรูปผลงาน' : 'เลือกรูปผลงาน'}
        multiple
        disabled={value.length >= max}
        onChange={(e) => {
          handlePick(e.target.files);
          e.target.value = '';
        }}
      />
      </div>
      <p className="mt-2 text-sm text-slate-500" aria-live="polite">{value.length >= max ? `ครบ ${max} รูปแล้ว ลบรูปเดิมเพื่อเลือกรูปใหม่` : `เลือกได้พร้อมกันหลายรูป สูงสุด ${max} รูป`}</p>
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
