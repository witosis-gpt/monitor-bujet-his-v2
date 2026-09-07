const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../module4-data.js'), 'utf8');
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const activity = (id = 'activity-1') => ({ id, activityName: 'Rapat koordinasi', activityDate: '2026-09-10', directorates: ['ED.7904'], status: 'confirmed', budgetLines: [], totalAmount: 1250000, notes: '' });

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
}

function harness({ local = {}, cloudRecords = [], fetchImpl, cloud = true } = {}) {
  const localStorage = storage(local);
  const context = {
    window: { SUPABASE_CONFIG: { url: 'https://example.supabase.co', anonKey: 'public-test-key' }, SaktiCloud: { configured: cloud, isAuthenticated: () => cloud } },
    localStorage, fetch: fetchImpl || (async () => response(200, cloudRecords)), crypto: { randomUUID: () => 'generated-id' }, console,
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return { data: context.window.PlannerData, localStorage };
}

async function run() {
  let server = [];
  const fetchImpl = async (url, options = {}) => {
    if (options.method === 'POST') { const payload = JSON.parse(options.body); const saved = { ...payload, id: 'activity-1' }; server = [saved]; return response(201, [saved]); }
    if (options.method === 'PATCH') { const payload = JSON.parse(options.body); server = [{ ...server[0], ...payload, id: 'activity-1' }]; return response(200, server); }
    return response(200, server);
  };
  const first = harness({ fetchImpl });
  const saved = await first.data.save(activity(''));
  assert.equal(saved.source, 'cloud');
  assert.equal(server[0].activity_name, 'Rapat koordinasi');
  assert.equal(JSON.parse(first.localStorage.getItem('hisPlannerActivitiesV1'))[0].id, 'activity-1');
  const second = harness({ local: {}, fetchImpl });
  const reloaded = await second.data.list();
  assert.equal(reloaded.source, 'cloud', 'a later session must reload planner records from Supabase');
  assert.equal(reloaded.records[0].activityName, 'Rapat koordinasi');

  let outage = true;
  const failing = harness({ fetchImpl: async (url, options = {}) => outage ? response(503, {}) : fetchImpl(url, options) });
  const localOnly = await failing.data.save(activity('offline-id'));
  assert.equal(localOnly.source, 'local');
  assert.match(localOnly.warning, /belum tersimpan ke cloud/i);
  assert.ok(failing.localStorage.getItem('hisPlannerPendingCloudV1'));
  outage = false;
  const recovered = await failing.data.list();
  assert.equal(recovered.source, 'mixed');
  assert.equal(recovered.records.some(item => item.id === 'offline-id'), true, 'local activity must survive cloud recovery');

  let deleteOutage = true;
  const deletions = harness({ local: { hisPlannerActivitiesV1: JSON.stringify([activity('keep-me')]) }, fetchImpl: async (url, options = {}) => deleteOutage ? response(503, {}) : response(204, null) });
  await assert.rejects(deletions.data.remove('keep-me'), /Penyimpanan rencana tidak tersedia/);
  assert.ok(deletions.localStorage.getItem('hisPlannerActivitiesV1'), 'failed cloud delete must preserve the local record');
  deleteOutage = false;
  await deletions.data.remove('keep-me');
  assert.equal(deletions.localStorage.getItem('hisPlannerActivitiesV1'), '[]');
  console.log('Module 4 cloud checks passed: confirmed save/reload, explicit offline fallback, recovery preservation, and safe delete failure.');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
