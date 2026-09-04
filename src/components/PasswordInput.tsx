'use client';

import { useId, useState, type InputHTMLAttributes } from 'react';

/**
 * Issue #30 — show/hide toggle for a password field. Wraps just the
 * `<input>` itself, not the label/error message around it (those differ
 * enough between SignupForm.tsx and ContractorRegistrationForm.tsx that
 * this only takes over the one piece of markup that's actually
 * identical between them: the input plus its own toggle button).
 *
 * Purely a client-side render toggle (`type="password"` <-> `type="text"`
 * on the SAME controlled input) — the value itself is never touched,
 * copied, or read by this component beyond passing through whatever
 * `value`/`onChange` the caller already wired up, so it cannot affect
 * what's actually submitted and never introduces a second place a
 * password value could leak from.
 */
export function PasswordInput({ className, id, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const toggleLabel = visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน';

  return (
    <div className="relative">
      <input {...props} id={inputId} type={visible ? 'text' : 'password'} className={`${className ?? ''} pr-16`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={toggleLabel}
        title={toggleLabel}
        aria-controls={inputId}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-medium text-slate-500 hover:text-slate-700"
      >
        {visible ? 'ซ่อน' : 'แสดง'}
      </button>
    </div>
  );
}
