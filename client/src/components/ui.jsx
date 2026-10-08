import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const cx = (...c) => c.filter(Boolean).join(' ');
export { cx };

export function Button({ variant = 'primary', size = 'md', loading, className, children, ...props }) {
  const v = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
    secondary: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50',
    ghost: 'text-slate-700 hover:bg-slate-100',
    danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
    ai: 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-95 shadow-sm',
  }[variant];
  const s = { sm: 'px-2.5 py-1.5 text-sm', md: 'px-4 py-2 text-sm', lg: 'px-5 py-3 text-base' }[size];
  return (
    <button className={cx('inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed', v, s, className)} disabled={loading || props.disabled} {...props}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export const Spinner = ({ className }) => (
  <svg className={cx('h-4 w-4 animate-spin', className)} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".25" strokeWidth="4" /><path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>
);

export const Card = ({ className, children, ...p }) => (
  <div className={cx('rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6', className)} {...p}>{children}</div>
);

export function Field({ label, hint, children, className }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200';
export const Input = ({ className, ...p }) => <input className={cx(inputCls, className)} {...p} />;
export const Textarea = ({ className, ...p }) => <textarea className={cx(inputCls, 'min-h-[90px]', className)} {...p} />;
export const Select = ({ className, children, ...p }) => <select className={cx(inputCls, className)} {...p}>{children}</select>;

const PILL = {
  draft: 'bg-slate-100 text-slate-700', negotiating: 'bg-amber-100 text-amber-800', agreed: 'bg-sky-100 text-sky-800',
  submitted: 'bg-emerald-100 text-emerald-800', sent: 'bg-sky-100 text-sky-800', paid: 'bg-emerald-100 text-emerald-800',
  overdue: 'bg-red-100 text-red-700', high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-800', low: 'bg-slate-100 text-slate-700',
};
export const Pill = ({ value, children, className }) => (
  <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', PILL[value] || 'bg-slate-100 text-slate-700', className)}>{children || value}</span>
);

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div className={cx('max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto pb-1">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={cx('whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium', value === t.id ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100')}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cx('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition', checked ? 'bg-emerald-500' : 'bg-slate-300')}>
      <span className={cx('inline-block h-5 w-5 transform rounded-full bg-white shadow transition', checked ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  );
}

export function CopyButton({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  return (
    <Button variant="secondary" size="sm" onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>
      {done ? 'Copied ✓' : label}
    </Button>
  );
}

export const Empty = ({ title, children }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
    <p className="font-medium text-slate-700">{title}</p>
    {children && <div className="mt-2 text-sm text-slate-500">{children}</div>}
  </div>
);

export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);

/* Toasts */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, kind = 'ok') => {
    const id = Math.random();
    setItems((x) => [...x, { id, msg, kind }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 2800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div key={t.id} className={cx('pointer-events-auto max-w-md rounded-xl px-4 py-2.5 text-sm shadow-lg', t.kind === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white')}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
