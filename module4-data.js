(() => {
  const LOCAL_KEY = 'hisPlannerActivitiesV1';
  const PENDING_KEY = 'hisPlannerPendingCloudV1';
  const getLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; } };
  const setLocal = records => localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
  const getPending = () => { try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { return []; } };
  const setPending = records => { if (records.length) localStorage.setItem(PENDING_KEY, JSON.stringify(records)); else localStorage.removeItem(PENDING_KEY); };
  const config = () => window.SUPABASE_CONFIG;
  const authHeaders = () => {
    const session = JSON.parse(localStorage.getItem('hisSupabaseSession') || 'null');
    return { apikey: config()?.anonKey, Authorization: `Bearer ${session?.access_token || ''}`, 'Content-Type': 'application/json' };
  };
  const cloudReady = () => Boolean(window.SaktiCloud?.configured && window.SaktiCloud?.isAuthenticated() && config()?.url);
  const toRecord = item => ({ id: item.id, activity_name: item.activityName, activity_date: item.activityDate, directorates: item.directorates, status: item.status, budget_lines: item.budgetLines, total_amount: item.totalAmount, notes: item.notes, created_at: item.createdAt, updated_at: item.updatedAt });
  const fromRecord = record => ({ id: record.id, activityName: record.activity_name, activityDate: record.activity_date, directorates: record.directorates || [], status: record.status, budgetLines: record.budget_lines || [], totalAmount: Number(record.total_amount) || 0, notes: record.notes || '', createdAt: record.created_at, updatedAt: record.updated_at });
  async function request(path, options = {}) { const response = await fetch(`${config().url}/rest/v1/${path}`, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } }); if (!response.ok) throw new Error(`Penyimpanan rencana tidak tersedia (${response.status}).`); return response.status === 204 ? null : response.json(); }
  const persistLocal = record => { const records = getLocal(); const index = records.findIndex(item => item.id === record.id); if (index >= 0) records[index] = record; else records.push(record); setLocal(records); };
  const persistPending = record => { const records = getPending().filter(item => item.id !== record.id); records.push(record); setPending(records); };
  const clearPending = id => setPending(getPending().filter(item => item.id !== id));
  const localRecordsWithPending = () => { const records = getLocal(); const known = new Set(records.map(record => record.id)); return [...records, ...getPending().filter(record => !known.has(record.id))]; };
  window.PlannerData = {
    async list() {
      if (!cloudReady()) return { records: localRecordsWithPending(), source: 'local', warning: 'Cloud belum terhubung; rencana ditampilkan dari perangkat ini.' };
      try {
        const response = await request('planner_activities?select=*&order=activity_date.asc,created_at.asc');
        if (!Array.isArray(response)) throw new Error('Cloud tidak mengembalikan daftar rencana yang valid.');
        const records = response.map(fromRecord), known = new Set(records.map(record => record.id));
        const localOnly = localRecordsWithPending().filter(record => !known.has(record.id));
        if (localOnly.length) return { records: [...records, ...localOnly], source: 'mixed', warning: 'Ada rencana lokal yang belum terkonfirmasi tersimpan di cloud.' };
        setLocal(records); setPending([]); return { records, source: 'cloud', warning: '' };
      } catch (error) { console.warn('[Planner] cloud read failed; memakai penyimpanan lokal', error); return { records: localRecordsWithPending(), source: 'local', warning: `Cloud belum tersedia: ${error.message}` }; }
    },
    async save(item) {
      const now = new Date().toISOString();
      const next = { ...item, id: item.id || crypto.randomUUID(), createdAt: item.createdAt || now, updatedAt: now };
      if (cloudReady()) {
        try {
          const payload = toRecord(next);
          const response = await request(`planner_activities${item.id ? `?id=eq.${encodeURIComponent(item.id)}` : ''}`, { method: item.id ? 'PATCH' : 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) });
          if (!Array.isArray(response) || response.length !== 1 || !response[0]?.id) throw new Error('Cloud belum mengonfirmasi penyimpanan rencana.');
          const saved = fromRecord(response[0]); persistLocal(saved); clearPending(saved.id); return { record: saved, source: 'cloud', warning: '' };
        } catch (error) { console.warn('[Planner] cloud save failed; menyimpan lokal', error); persistLocal(next); persistPending(next); return { record: next, source: 'local', warning: `Belum tersimpan ke cloud: ${error.message}` }; }
      }
      persistLocal(next); return { record: next, source: 'local', warning: 'Cloud belum terhubung; rencana hanya tersimpan di perangkat ini.' };
    },
    async remove(id) { if (cloudReady()) await request(`planner_activities?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }); setLocal(getLocal().filter(record => record.id !== id)); clearPending(id); },
  };
})();
