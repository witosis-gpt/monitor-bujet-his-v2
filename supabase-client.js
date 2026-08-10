(() => {
  const config = window.SUPABASE_CONFIG;
  const status = message => { const node = document.querySelector('#cloudStatus'); if (node) node.textContent = message; };
  const configured = Boolean(config?.url && config?.anonKey && !config.url.includes('YOUR_PROJECT'));
  let session = null;
  try { session = JSON.parse(localStorage.getItem('hisSupabaseSession') || 'null'); } catch { session = null; }
  const headers = () => ({ apikey: config.anonKey, Authorization: `Bearer ${session?.access_token || config.anonKey}`, 'Content-Type': 'application/json' });
  const persistSession = next => { session = next; if (next) localStorage.setItem('hisSupabaseSession', JSON.stringify(next)); else localStorage.removeItem('hisSupabaseSession'); };
  const toBucket = records => records.reduce((snapshots, record) => {
    const key = `${record.year}-${String(record.month).padStart(2, '0')}`;
    snapshots[key] ||= { sp2d: null, accrual: null };
    snapshots[key][record.source_type] = { dataset: record.snapshot_data, filename: record.filename, savedAt: record.imported_at, sourceType: record.source_type };
    return snapshots;
  }, {});
  const recordFor = (dataset, filename, sourceType) => ({
    year: dataset.period.year, month: dataset.period.month, period_label: dataset.period.label, source_type: sourceType,
    satker_code: dataset.satker?.code || null, satker_name: dataset.satker?.name || null, filename,
    pagu: dataset.executiveSummary.pagu, previous_period: dataset.rows.reduce((sum, row) => sum + (row.previousPeriod || 0), 0),
    current_period: dataset.executiveSummary.monthly, cumulative: dataset.executiveSummary.realization,
    remaining: dataset.executiveSummary.pagu - dataset.executiveSummary.realization,
    absorption: dataset.executiveSummary.pagu ? dataset.executiveSummary.realization / dataset.executiveSummary.pagu * 100 : 0,
    snapshot_data: dataset,
  });
  window.SaktiCloud = {
    configured,
    isAuthenticated: () => Boolean(session?.access_token),
    currentUser: () => session?.user || null,
    async restoreSession() { if (!session?.access_token) return null; if (!session.expires_at || session.expires_at * 1000 > Date.now() + 60000) return session; const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { apikey: config.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: session.refresh_token }) }); if (!response.ok) { persistSession(null); return null; } persistSession(await response.json()); return session; },
    async signIn(email, password) { const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: config.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }); if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error_description || body.msg || 'Login gagal.'); } persistSession(await response.json()); return session; },
    async signOut() { if (session?.access_token) await fetch(`${config.url}/auth/v1/logout`, { method: 'POST', headers: headers() }); persistSession(null); },
    async loadSnapshots() {
      if (!configured) throw new Error('Konfigurasi Supabase belum tersedia.');
      const response = await fetch(`${config.url}/rest/v1/sakti_snapshots?select=*&order=year.asc,month.asc`, { headers: headers() });
      if (!response.ok) { const body = await response.text(); console.error('Supabase load failed', { url: response.url, status: response.status, body }); throw new Error(`Cloud tidak tersedia (${response.status}): ${body}`); }
      const records = await response.json();
      status('Data tersinkron ke cloud');
      return toBucket(records);
    },
    async saveSnapshot(dataset, filename, sourceType) {
      if (!configured) throw new Error('Konfigurasi Supabase belum tersedia.');
      const response = await fetch(`${config.url}/rest/v1/sakti_snapshots?on_conflict=year,month,source_type`, { method: 'POST', headers: { ...headers(), Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(recordFor(dataset, filename, sourceType)) });
      if (!response.ok) { const body = await response.text(); console.error('Supabase upsert failed', { url: response.url, status: response.status, body }); throw new Error(`Gagal menyimpan ke cloud (${response.status}): ${body}`); }
      status('Data tersinkron ke cloud');
      return (await response.json())[0];
    },
    status,
  };
})();
