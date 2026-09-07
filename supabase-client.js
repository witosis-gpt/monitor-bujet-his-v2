(() => {
  const config = window.SUPABASE_CONFIG;
  const configured = Boolean(config?.url && config?.anonKey && !config.url.includes('YOUR_PROJECT'));
  const status = message => { const node = document.querySelector('#cloudStatus'); if (node) node.textContent = message; };
  let session = null;
  try { session = JSON.parse(localStorage.getItem('hisSupabaseSession') || 'null'); } catch { /* Invalid cached session. */ }
  let refreshPromise = null;
  const persistSession = next => { session = next; if (next) localStorage.setItem('hisSupabaseSession', JSON.stringify(next)); else localStorage.removeItem('hisSupabaseSession'); };
  const headers = authenticated => ({ apikey: config.anonKey, Authorization: `Bearer ${authenticated ? session?.access_token || '' : config.anonKey}`, 'Content-Type': 'application/json' });
  const errorMessage = (body, fallback) => body?.error_description || body?.msg || body?.message || body?.error || fallback;
  const validSession = () => Boolean(session?.access_token && (!session.expires_at || session.expires_at * 1000 > Date.now() + 60000));
  async function request(path, options = {}, authenticated = true, retryAuth = true) {
    if (!configured) throw new Error('Konfigurasi Supabase belum tersedia.');
    if (authenticated && !validSession()) await restoreSession();
    if (authenticated && !session?.access_token) throw new Error('Sesi login tidak aktif. Silakan masuk kembali.');
    let response;
    try {
      response = await fetch(`${config.url}${path}`, { ...options, headers: { ...headers(authenticated), ...(options.headers || {}) }, signal: options.signal || AbortSignal.timeout(30000) });
    } catch (error) {
      throw new Error(error?.name === 'TimeoutError' ? 'Koneksi ke Supabase melewati batas waktu. Data belum dikonfirmasi tersimpan.' : 'Tidak dapat terhubung ke Supabase. Periksa koneksi atau status project.');
    }
    if (response.status === 401 && authenticated && retryAuth && session?.refresh_token) {
      await restoreSession(true);
      if (session?.access_token) return request(path, options, authenticated, false);
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const message = errorMessage(body, `Supabase mengembalikan HTTP ${response.status}.`);
      const error = new Error(message);
      error.status = response.status;
      error.code = body?.code || body?.error_code || null;
      throw error;
    }
    if (response.status === 204) return null;
    return response.json();
  }
  async function restoreSession(force = false) {
    if (!session?.access_token && !session?.refresh_token) return null;
    if (!force && validSession()) return session;
    if (!session?.refresh_token) { persistSession(null); return null; }
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      let response;
      try {
        response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: headers(false), body: JSON.stringify({ refresh_token: session.refresh_token }), signal: AbortSignal.timeout(30000) });
      } catch (error) {
        // An outage is not proof that the refresh token is invalid. Preserve it.
        throw new Error('Koneksi autentikasi belum tersedia. Sesi tersimpan tetap dipertahankan.');
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (response.status === 400 || response.status === 401) { persistSession(null); return null; }
        throw new Error(errorMessage(body, `Pemulihan sesi gagal (HTTP ${response.status}).`));
      }
      const next = await response.json();
      persistSession(next);
      return session;
    })();
    try { return await refreshPromise; } finally { refreshPromise = null; }
  }
  const toBucket = records => records.reduce((snapshots, record) => {
    const key = `${record.year}-${String(record.month).padStart(2, '0')}`;
    snapshots[key] ||= { sp2d: null, accrual: null };
    snapshots[key][record.source_type] = { dataset: record.snapshot_data, filename: record.filename, savedAt: record.imported_at, sourceType: record.source_type };
    return snapshots;
  }, {});
  const recordFor = (dataset, filename, sourceType) => ({
    year: dataset.period.year, month: dataset.period.month, period_label: dataset.period.label, source_type: sourceType,
    satker_code: dataset.satker?.code || null, satker_name: dataset.satker?.name || null, filename,
    imported_at: new Date().toISOString(), pagu: dataset.executiveSummary.pagu,
    previous_period: dataset.rows.reduce((sum, row) => sum + (row.previousPeriod || 0), 0),
    current_period: dataset.executiveSummary.monthly, cumulative: dataset.executiveSummary.realization,
    remaining: dataset.executiveSummary.pagu - dataset.executiveSummary.realization,
    absorption: dataset.executiveSummary.pagu ? dataset.executiveSummary.realization / dataset.executiveSummary.pagu * 100 : 0,
    snapshot_data: dataset,
  });
  window.SaktiCloud = {
    configured,
    isAuthenticated: () => Boolean(session?.access_token),
    currentUser: () => session?.user || null,
    restoreSession,
    async signIn(email, password) {
      const next = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) }, false);
      persistSession(next);
      return session;
    },
    async signOut() {
      try { if (session?.access_token) await request('/auth/v1/logout', { method: 'POST' }); }
      catch (error) { console.warn('[Auth] Remote logout unavailable:', error.message); }
      finally { persistSession(null); }
    },
    async loadSnapshots() {
      const records = await request('/rest/v1/sakti_snapshots?select=*&order=year.asc,month.asc');
      status('Data tersinkron ke cloud');
      return toBucket(records);
    },
    async saveSnapshot(dataset, filename, sourceType) {
      if (!['sp2d', 'accrual'].includes(sourceType)) throw new Error('Jenis sumber SAKTI tidak valid.');
      const records = await request('/rest/v1/sakti_snapshots?on_conflict=year,month,source_type', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(recordFor(dataset, filename, sourceType)) });
      if (records?.length !== 1) throw new Error('Cloud belum mengonfirmasi penyimpanan snapshot.');
      status('Data tersinkron ke cloud');
      return records[0];
    },
    async deleteSnapshot(year, month, sourceType) {
      const query = new URLSearchParams({ year: `eq.${year}`, month: `eq.${month}`, source_type: `eq.${sourceType}` });
      const deleted = await request(`/rest/v1/sakti_snapshots?${query}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
      if (deleted.length !== 1) throw new Error('Snapshot yang dipilih tidak ditemukan atau tidak dapat dihapus.');
      status('Snapshot dihapus dari cloud');
      return deleted[0];
    },
    async healthCheck() {
      if (!configured) return { ok: false, message: 'Konfigurasi Supabase belum tersedia.' };
      try { const response = await fetch(`${config.url}/auth/v1/health`, { signal: AbortSignal.timeout(10000) }); return { ok: response.ok, status: response.status }; }
      catch { return { ok: false, message: 'Layanan Auth tidak dapat dijangkau.' }; }
    },
    status,
  };
})();