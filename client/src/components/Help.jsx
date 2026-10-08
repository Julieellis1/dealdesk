import { useState } from 'react';
import { GLOSSARY } from './glossary.js';
import { cx } from './ui.jsx';

/** A word with a dotted underline that explains itself on hover or tap. */
export function Term({ t, children }) {
  const [open, setOpen] = useState(false);
  const text = GLOSSARY[(t || String(children)).toLowerCase()];
  if (!text) return <>{children}</>;
  return (
    <span className="relative inline-block">
      <button type="button" onClick={() => setOpen((o) => !o)} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
        className="cursor-help border-b border-dotted border-indigo-400 text-inherit">{children}</button>
      {open && (
        <span className="absolute left-0 top-full z-40 mt-1 w-64 rounded-lg bg-slate-900 p-2.5 text-xs font-normal leading-snug text-white shadow-lg">{text}</span>
      )}
    </span>
  );
}

/** The short "Why this matters" explainer at the top of every wizard step. */
export function WhyBox({ children, className }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={cx('rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 text-sm text-indigo-950', className)}>
      <button className="flex w-full items-center justify-between font-semibold" onClick={() => setOpen((o) => !o)}>
        <span>💡 Why this matters</span><span className="text-indigo-400">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="mt-2 space-y-1.5 leading-relaxed">{children}</div>}
    </div>
  );
}

export const Disclaimer = ({ className }) => (
  <p className={cx('text-xs text-slate-500', className)}>AI guidance is general information, not legal or financial advice. For important or unclear legal points, check with a qualified professional.</p>
);
