import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Button, Pill, cx, useToast } from '../components/ui.jsx';
import { AskAI } from '../components/AI.jsx';
import { WhyBox } from '../components/Help.jsx';
import Step1Contract from './Step1Contract.jsx';
import Step2Client from './Step2Client.jsx';
import Step3Job from './Step3Job.jsx';
import Step4Negotiate from './Step4Negotiate.jsx';
import Step5Invoices from './Step5Invoices.jsx';
import Step6Finalize from './Step6Finalize.jsx';

export const STEPS = [
  { n: 1, label: 'Contract', C: Step1Contract },
  { n: 2, label: 'Client', C: Step2Client },
  { n: 3, label: 'Job', C: Step3Job },
  { n: 4, label: 'Price & negotiate', C: Step4Negotiate },
  { n: 5, label: 'Invoices', C: Step5Invoices },
  { n: 6, label: 'Finalize', C: Step6Finalize },
];

const SAVED_FIELDS = ['title', 'contract_text', 'terms', 'job', 'pricing', 'client_id', 'signed', 'final_summary'];
const WizardCtx = createContext(null);
export const useWizard = () => useContext(WizardCtx);

export default function Wizard() {
  const { id, step } = useParams();
  const n = Math.min(6, Math.max(1, Number(step) || 1));
  const nav = useNavigate();
  const toast = useToast();
  const [c, setC] = useState(null);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState('saved'); // saved | dirty | saving | error
  const dirtyRef = useRef(false);
  const cRef = useRef(null);
  const beforeLeave = useRef(null);
  cRef.current = c;

  useEffect(() => {
    api.get(`/contracts/${id}`).then(setC).catch((e) => setError(e.message));
  }, [id]);

  const flush = useCallback(async (extra = {}) => {
    const cur = cRef.current;
    if (!cur) return null;
    if (!dirtyRef.current && !Object.keys(extra).length) return cur;
    setSaveState('saving');
    try {
      const body = Object.fromEntries(SAVED_FIELDS.map((k) => [k, cur[k]]));
      const out = await api.put(`/contracts/${cur.id}`, { ...body, ...extra });
      dirtyRef.current = false;
      setC((prev) => ({ ...out, ...(dirtyRef.current ? Object.fromEntries(SAVED_FIELDS.map((k) => [k, prev[k]])) : {}) }));
      setSaveState('saved');
      return out;
    } catch (e) {
      setSaveState('error'); toast(e.message, 'error');
      return null;
    }
  }, [toast]);

  // Autosave 1.2 s after the last change, so you can leave and resume any time.
  useEffect(() => {
    if (saveState !== 'dirty') return;
    const t = setTimeout(() => flush(), 1200);
    return () => clearTimeout(t);
  }, [c, saveState, flush]);

  // Remember which step you are on.
  useEffect(() => { if (c && c.wizard_step !== n) flush({ wizard_step: n }); }, [n, c?.id]); // eslint-disable-line

  if (error) return <p className="text-red-600">{error} <Link className="underline" to="/contracts">Back to contracts</Link></p>;
  if (!c) return <p className="text-slate-500">Loading…</p>;

  const set = (patch) => { setC((prev) => ({ ...prev, ...patch })); dirtyRef.current = true; setSaveState('dirty'); };
  const setIn = (group, key, value) => setC((prev) => { dirtyRef.current = true; setSaveState('dirty'); return { ...prev, [group]: { ...(prev[group] || {}), [key]: value } }; });
  const reload = async () => { const fresh = await api.get(`/contracts/${id}`); setC(fresh); return fresh; };
  // Replace with server copy (e.g. after rounds or AI), keeping any unsaved local edits.
  const merge = (server) => setC((prev) => ({ ...server, ...(dirtyRef.current ? Object.fromEntries(SAVED_FIELDS.map((k) => [k, prev[k]])) : {}) }));

  const go = async (to) => {
    if (beforeLeave.current) { const ok = await beforeLeave.current(); if (ok === false) return; }
    await flush({ wizard_step: to });
    nav(`/contracts/${c.id}/step/${to}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const exit = async () => { if (beforeLeave.current) await beforeLeave.current(); await flush(); nav('/contracts'); };

  const ctx = { c, set, setIn, flush, reload, merge, go, beforeLeave, step: n };
  const { C } = STEPS[n - 1];

  return (
    <WizardCtx.Provider value={ctx}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link to="/contracts" className="text-sm text-indigo-600">← Contracts</Link>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="truncate text-xl font-bold sm:text-2xl">{c.title}</h1>
            <Pill value={c.status} />
          </div>
        </div>
        <span className={cx('text-xs', saveState === 'error' ? 'text-red-600' : 'text-slate-400')}>
          {saveState === 'saving' ? 'Saving…' : saveState === 'dirty' ? 'Unsaved changes…' : saveState === 'error' ? 'Not saved' : 'All changes saved ✓'}
        </span>
      </div>

      {/* Progress indicator */}
      <ol className="mb-6 grid grid-cols-6 gap-1.5">
        {STEPS.map((s) => (
          <li key={s.n}>
            <button onClick={() => go(s.n)} className="group w-full text-left" aria-current={s.n === n ? 'step' : undefined}>
              <div className={cx('h-1.5 rounded-full', s.n < n ? 'bg-indigo-500' : s.n === n ? 'bg-indigo-600' : 'bg-slate-200')} />
              <div className={cx('mt-1.5 flex items-center gap-1 text-xs', s.n === n ? 'font-semibold text-indigo-700' : 'text-slate-500 group-hover:text-slate-800')}>
                <span className={cx('grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px]', s.n < n ? 'bg-indigo-500 text-white' : s.n === n ? 'bg-indigo-600 text-white' : 'bg-slate-200')}>{s.n < n ? '✓' : s.n}</span>
                <span className="hidden truncate sm:inline">{s.label}</span>
              </div>
            </button>
          </li>
        ))}
      </ol>
      <p className="mb-4 text-xs text-slate-500 sm:hidden">Step {n} of 6 · {STEPS[n - 1].label}</p>

      <C key={n} />

      <div className="sticky bottom-16 z-20 mt-8 flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        <Button variant="secondary" onClick={() => go(n - 1)} disabled={n === 1}>← Back</Button>
        <Button variant="ghost" onClick={exit}>Save & exit</Button>
        {n < 6 ? <Button onClick={() => go(n + 1)}>Next: {STEPS[n].label} →</Button> : <Link to="/"><Button>Done</Button></Link>}
      </div>
    </WizardCtx.Provider>
  );
}

/** Shared frame for every step: title, Why-this-matters, Ask AI. */
export function StepShell({ title, intro, why, askSuggestions, children }) {
  const { c, step } = useWizard();
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{step}. {title}</h2>
          {intro && <p className="mt-1 text-sm text-slate-600">{intro}</p>}
        </div>
        <AskAI step={title} contractId={c.id} suggestions={askSuggestions} />
      </div>
      {why && <WhyBox>{why}</WhyBox>}
      {children}
    </div>
  );
}
