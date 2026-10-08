export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function invoiceTotals(inv) {
  const items = Array.isArray(inv.items) ? inv.items : [];
  const subtotal = round2(items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0));
  const discount = Math.min(round2(inv.discount), subtotal);
  const taxable = round2(subtotal - discount);
  const tax = round2(taxable * (Number(inv.tax_rate) || 0) / 100);
  return { subtotal, discount, tax, total: round2(taxable + tax) };
}

export function fmtMoney(amount, currency = 'USD') {
  const n = (Number(amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency} ${n}`;
}

// Today's date on the server's local clock (not UTC), as YYYY-MM-DD.
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

export function addInterval(dateStr, interval) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (interval === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  else if (interval === 'quarterly') d.setUTCMonth(d.getUTCMonth() + 3);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export const daysBetween = (a, b) =>
  Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
