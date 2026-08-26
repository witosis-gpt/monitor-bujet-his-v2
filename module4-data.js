(() => {
  const LOCAL_KEY = 'hisPlannerActivitiesV1';
  const getLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; } };
  const setLocal = records => localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
  const config = () => window.SUPABASE_CONFIG;
  const authHeaders = () => {
    const session = JSON.parse(localStorage.getItem('hisSupabaseSession') || 'null');
    return { apikey: config()?.anonKey, Authorization: `Bearer ${session?.access_token || ''}`, 'Content-Type': 'application/json' };
  };
  const cloudReady = () => Boolean(window.SaktiCloud?.configured && window.SaktiCloud?.isAuthenticated() && config()?.url);
  const toRecord = item => ({ id: item.id, activity_name: item.activityName, activity_date: item.activityDate, directorates: item.directorates, status: item.status, budget_lines: item.budgetLines, total_amount: item.totalAmount, notes: item.notes, created_at: item.createdAt, updated_at: item.updatedAt });
  const fromRecord = record => ({ id: record.id, activityName: record.activity_name, activityDate: record.activity_date, directorates: record.directorates || [], status: record.status, budgetLines: record.budget_lines || [], totalAmount: Number(record.total_amount) || 0, notes: record.notes || '', createdAt: record.created_at, updatedAt: record.updated_at });
  async function request(path, options = {}) { const response = await fetch(`${config().url}/rest/v1/${path}`, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } }); if (!response.ok) throw new Error(`Penyimpanan rencana tidak tersedia (${response.status}).`); return response.status === 204 ? null : response.json(); }
  window.PlannerData = {
    async list() { if (!cloudReady()) return { records: getLocal(), source: 'local' }; try { const records = await request('planner_activities?select=*&order=activity_date.asc,created_at.asc'); return { records: records.map(fromRecord), source: 'cloud' }; } catch (error) { console.warn('[Planner] cloud read failed; memakai penyimpanan lokal', error); return { records: getLocal(), source: 'local' }; } },
    async save(item) { const now = new Date().toISOString(); const localRecords = getLocal(); const next = { ...item, id: item.id || crypto.randomUUID(), createdAt: item.createdAt || now, updatedAt: now }; if (cloudReady()) { try { const payload = toRecord(next); const records = await request(`planner_activities${item.id ? `?id=eq.${encodeURIComponent(item.id)}` : ''}`, { method: item.id ? 'PATCH' : 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) }); const saved = fromRecord(records[0]); const index = localRecords.findIndex(record => record.id === saved.id); if (index >= 0) localRecords[index] = saved; else localRecords.push(saved); setLocal(localRecords); return { record: saved, source: 'cloud' }; } catch (error) { console.warn('[Planner] cloud save failed; menyimpan lokal', error); } }
      const index = localRecords.findIndex(record => record.id === next.id); if (index >= 0) localRecords[index] = next; else localRecords.push(next); setLocal(localRecords); return { record: next, source: 'local' };
    },
    async remove(id) { const records = getLocal(); if (cloudReady()) { try { await request(`planner_activities?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }); } catch (error) { console.warn('[Planner] cloud delete failed; menghapus lokal', error); } } setLocal(records.filter(record => record.id !== id)); },
  };
})();
