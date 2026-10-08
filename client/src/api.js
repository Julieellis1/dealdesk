export class ApiError extends Error {
  constructor(message, status, attempts) {
    super(message);
    this.status = status;
    this.attempts = attempts;
  }
}

async function request(method, url, body, isForm = false) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    if (isForm) opts.body = body;
    else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  }
  let res;
  try { res = await fetch(`/api${url}`, opts); }
  catch { throw new ApiError('Cannot reach the DealDesk server. Is it running?', 0); }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data?.attempts);
  return data;
}

export const api = {
  get: (u) => request('GET', u),
  post: (u, b = {}) => request('POST', u, b),
  put: (u, b = {}) => request('PUT', u, b),
  del: (u) => request('DELETE', u),
  upload: (u, file) => { const f = new FormData(); f.append('file', file); return request('POST', u, f, true); },
};
