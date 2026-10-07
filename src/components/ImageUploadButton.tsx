'use client';

import type { ChangeEventHandler, Ref } from 'react';

/** Keep the native file input operable by touch, keyboard and screen readers. */
export function ImageUploadButton({ id, label, inputRef, multiple = false, disabled = false, onChange }: {
  id: string;
  label: string;
  inputRef?: Ref<HTMLInputElement>;
  multiple?: boolean;
  disabled?: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
}) {
  return <label className="relative inline-flex h-12 w-52 max-w-full items-center justify-start gap-2 rounded-lg bg-master-yellow px-5 py-3 text-sm font-semibold text-master-navy transition-colors hover:bg-master-yellow-accent focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-slate-800 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 5-5 4 4 4-6 5 7" /></svg>
    <span>{label}</span>
    <input ref={inputRef} id={id} aria-label={label} type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} disabled={disabled} onChange={onChange} className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed" />
  </label>;
}
