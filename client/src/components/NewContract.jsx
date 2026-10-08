import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Button, useToast } from './ui.jsx';

/** Creates a draft contract and opens the wizard at step 1. */
export function NewContractButton({ size = 'md', className }) {
  const nav = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    try { const c = await api.post('/contracts', {}); nav(`/contracts/${c.id}/step/1`); }
    catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };
  return <Button size={size} className={className} loading={busy} onClick={start}>＋ I have a new contract</Button>;
}
