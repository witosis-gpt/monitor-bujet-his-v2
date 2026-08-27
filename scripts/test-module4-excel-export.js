const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const XLSX = require('xlsx');

const source = fs.readFileSync(require.resolve('../module4.js'), 'utf8');
const start = source.indexOf('  const excelFilePart');
const end = source.indexOf('  function activatePlanner');
assert.ok(start >= 0 && end > start, 'Module 4 Excel export helpers were not found.');
const context = {
  window: { XLSX }, XLSX,
  rankGroups: ['Pejabat Negara/Wamen/Eselon I', 'Pejabat Negara lainnya/Eselon II', 'Eselon III/Gol IV', 'Eselon IV/Gol III/II/I'],
  catalogs: () => ({ 'ED.7904': 'Perikanan dan Kelautan' }),
  destinations: travel => travel.destinations,
  teamTotal: travel => Object.values(travel.team || {}).reduce((sum, value) => sum + Number(value || 0), 0),
  activityTotal: activity => activity.budgetLines.reduce((sum, line) => sum + line.components.filter(item => item.active !== false).reduce((lineSum, item) => lineSum + item.quantity * item.rateUsed, 0), 0),
  lineSufficiency: () => ({ available: 10000000 }),
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}\nglobalThis.exportHooks = { buildPlannerWorkbook };`, context);

const components = [
  ['Transport darat SBM — Surabaya → Kab. Pasuruan', 228000],
  ['Transport darat SBM — Kab. Pasuruan → Surabaya', 228000],
  ['Transport darat SBM — Surabaya → Kab. Sidoarjo', 240000],
  ['Transport darat SBM — Kab. Sidoarjo → Surabaya', 240000],
].map(([label, rate]) => ({ label, unit: 'Orang/Kali', quantity: 4, rateUsed: rate, referenceRate: rate, active: true }));
components.push({ label: 'Komponen manual tambahan', unit: 'Unit', quantity: 1, rateUsed: 999999, active: false, manualEntry: true });
const activity = { activityName: 'Kunjungan Jawa Timur', activityDate: '2026-08-27', directorates: ['ED.7904'], status: 'draft', budgetLines: [{ accountCode: '524111', templateName: 'Perjalanan Dinas Biasa', components, travel: { origin: 'Surabaya', destinations: [{ city: 'Kab. Pasuruan' }, { city: 'Surabaya' }, { city: 'Kab. Sidoarjo' }, { city: 'Surabaya' }], team: { 'Eselon IV/Gol III/II/I': 4 } } }] };
const output = context.exportHooks.buildPlannerWorkbook(activity);
assert.equal(output.total, 3744000);
assert.equal(output.componentTotal, 3744000);
assert.equal(output.detailRows.length, 4, 'inactive manual components must be excluded');
assert.deepEqual(Array.from(output.detailRows, row => row[2]), ['Surabaya → Kab. Pasuruan', 'Kab. Pasuruan → Surabaya', 'Surabaya → Kab. Sidoarjo', 'Kab. Sidoarjo → Surabaya']);
const bytes = XLSX.write(output.workbook, { type: 'buffer', bookType: 'xlsx' });
const reopened = XLSX.read(bytes, { type: 'buffer', cellFormula: true });
const sheet = reopened.Sheets['Permohonan Dinas'];
const totalCell = Object.values(sheet).find(cell => cell?.f?.startsWith('SUM('));
assert.equal(totalCell.f, 'SUM(G20:G23)');
assert.equal(totalCell.v, 3744000);
assert.equal(sheet.G20.t, 'n');
console.log(`Module 4 Excel export checks passed: ${output.filename} total ${output.total}.`);
