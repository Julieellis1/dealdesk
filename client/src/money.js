export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function totals(inv) {
  const items = inv?.items || [];
  const subtotal = round2(items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0));
  const discount = Math.min(round2(inv?.discount), subtotal);
  const tax = round2((subtotal - discount) * (Number(inv?.tax_rate) || 0) / 100);
  return { subtotal, discount, tax, total: round2(subtotal - discount + tax) };
}

export function money(amount, currency = 'USD') {
  const n = Number(amount) || 0;
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n); }
  catch { return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
}

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const fmtDate = (s) => {
  if (!s) return '';
  const d = new Date(`${String(s).slice(0, 10)}T00:00:00`);
  return isNaN(d) ? s : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'CAD', 'AUD', 'INR', 'KES', 'GHS', 'ZAR', 'AED', 'JPY', 'BRL', 'MXN'];
