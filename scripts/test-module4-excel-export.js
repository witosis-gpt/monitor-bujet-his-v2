const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const XLSX = require('xlsx');

const source = fs.readFileSync(require.resolve('../module4.js'), 'utf8');
const start = source.indexOf('  const excelFilePart');
const end = source.indexOf('  function activatePlanner');
assert.ok(start >= 0 && end > start, 'Module 4 Excel export helpers were not found.');

const available = { '524111': 10000000, '524119': 9000000, '524113': 8000000, '521211': 7000000, '522151': 6000000 };
const lineTotal = line => (line.components || []).filter(component => component.active !== false).reduce((sum, component) => sum + Number(component.quantity || 0) * Number(component.rateUsed || 0), 0);
const context = {
  window: { XLSX }, XLSX,
  rankGroups: ['Pejabat Negara/Wamen/Eselon I', 'Pejabat Negara lainnya/Eselon II', 'Eselon III/Gol IV', 'Eselon IV/Gol III/II/I'],
  catalogs: () => ({ 'ED.7904': 'Perikanan dan Kelautan' }),
  destinations: travel => travel.destinations || [],
  lineTotal,
  activityTotal: activity => (activity.budgetLines || []).reduce((sum, line) => sum + lineTotal(line), 0),
  lineSufficiency: line => ({ available: available[line.accountCode] || 0 }),
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}\nglobalThis.exportHooks = { buildPlannerExportWorkbook };`, context);

const active = (label, quantity, rate, options = {}) => ({ label, unit: options.unit || 'Orang/Kali', quantity, rateUsed: rate, referenceRate: options.referenceRate ?? rate, pricingSource: options.pricingSource || 'SBM 2026', active: options.active ?? true });
const travel = { origin: 'Jakarta', startDate: '2026-08-01', endDate: '2026-08-03', destinations: [{ city: 'Surabaya' }, { city: 'Kab. Pasuruan' }, { city: 'Surabaya' }], team: { 'Eselon IV/Gol III/II/I': 4 } };
const activities = [
  { activityName: 'Tes Perjadin', activityDate: '2026-08-01', directorates: ['ED.7904'], status: 'confirmed', budgetLines: [{ accountCode: '524111', templateName: 'Perjalanan Dinas Biasa', travel, components: [active('Tiket pesawat PP — JAKARTA ↔ SURABAYA', 4, 2674000, { unit: 'Orang/PP' }), active('Transport darat SBM — Surabaya → Kab. Pasuruan', 4, 228000), active('Komponen manual tambahan', 1, 999999, { active: false, referenceRate: 0, pricingSource: 'MANUAL' })] }] },
  { activityName: 'Tes Rapat LK', activityDate: '2026-08-04', directorates: ['ED.7904'], status: 'draft', budgetLines: [{ accountCode: '524119', templateName: 'Paket Meeting Luar Kota', travel, components: [active('MENYELENGGARAKAN — paket Fullboard', 4, 750000, { unit: 'Orang/Hari' }), active('MENGHADIRI — Uang Harian Fullboard', 1, 130000, { active: false, unit: 'Orang/OH' })] }] },
  { activityName: 'Tes Rapat DK', activityDate: '2026-08-05', directorates: ['ED.7904'], status: 'confirmed', budgetLines: [{ accountCode: '524113', templateName: 'Perjalanan Dinas Dalam Kota', components: [active('Transport kegiatan dalam kabupaten/kota PP', 4, 170000), active('Uang harian dalam kota > 8 jam', 4, 210000, { active: false, unit: 'Orang/OH' })] }] },
  { activityName: 'Test Konsumsi Rapat', activityDate: '2026-08-06', directorates: ['ED.7904'], status: 'draft', budgetLines: [{ accountCode: '521211', templateName: 'Belanja Bahan', components: [active('Konsumsi rapat — makan', 20, 57000, { unit: 'Orang/Kegiatan' })] }] },
  { activityName: 'Tes Honor Narsum', activityDate: '2026-08-07', directorates: ['ED.7904'], status: 'confirmed', budgetLines: [{ accountCode: '522151', templateName: 'Belanja Jasa Profesi', components: [active('Narasumber — Eselon II/setara', 2, 1000000, { unit: 'Orang/Jam' })] }] },
];

const output = context.exportHooks.buildPlannerExportWorkbook(activities, 'Agustus 2026');
assert.equal(output.activityCount, 5);
assert.equal(output.sheetCount, 6);
assert.equal(output.filename, 'Rencana_Kegiatan_Deputi_HIS_Agustus_2026.xlsx');
assert.equal(output.workbook.SheetNames[0], 'REKAP RENCANA');
const bytes = XLSX.write(output.workbook, { type: 'buffer', bookType: 'xlsx', compression: true });
const reopened = XLSX.read(bytes, { type: 'buffer', cellFormula: true });
assert.deepEqual(reopened.SheetNames, ['REKAP RENCANA', 'Tes Perjadin', 'Tes Rapat LK', 'Tes Rapat DK', 'Test Konsumsi Rapat', 'Tes Honor Narsum']);
const recap = XLSX.utils.sheet_to_json(reopened.Sheets['REKAP RENCANA'], { header: 1, raw: true });
assert.equal(recap.length, 9, 'recap must include its heading, header, and one row per account line');
assert.equal(recap[3][0], 'NO');
assert.equal(recap[4][5], '524111');
assert.equal(recap[8][5], '522151');
const travelSheet = XLSX.utils.sheet_to_json(reopened.Sheets['Tes Perjadin'], { header: 1, raw: true });
const travelValues = travelSheet.flat().filter(value => value !== undefined && value !== null).map(String).join(' | ');
assert.ok(travelValues.includes('RUTE PERJALANAN'));
assert.ok(travelValues.includes('Jakarta → Surabaya → Kab. Pasuruan → Surabaya → Jakarta'), 'travel itinerary must preserve repeated city rows');
assert.ok(!travelValues.includes('Komponen manual tambahan'), 'inactive components must not be exported');
const nonTravelSheet = XLSX.utils.sheet_to_json(reopened.Sheets['Tes Rapat DK'], { header: 1, raw: true });
assert.ok(!nonTravelSheet.flat().includes('RUTE PERJALANAN'), 'non-travel account sheets must not contain itinerary blocks');
const formulas = Object.values(reopened.Sheets['Tes Perjadin']).filter(cell => cell?.f);
assert.ok(formulas.some(cell => /^E\d+\*F\d+$/.test(cell.f)), 'component amount must remain numeric formula data');
assert.equal(output.total, activities.reduce((sum, activity) => sum + context.activityTotal(activity), 0));
console.log(`Module 4 main Excel export checks passed: ${output.activityCount} activities, ${output.sheetCount} sheets, total ${output.total}.`);
