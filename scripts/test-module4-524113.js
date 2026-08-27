const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const master = require('../data/sbm-2026.json');
const source = fs.readFileSync(require.resolve('../module4.js'), 'utf8');
const start = source.indexOf('  function templateFor');
const end = source.indexOf('  const rankGroups');
assert.ok(start >= 0 && end > start, 'Module 4 account templates were not found.');
const context = {
  state: { master },
  component: (label, unit, rate = 0, options = {}) => ({ label, unit, rateUsed: rate, referenceRate: rate, quantity: options.quantity ?? 1, active: options.active ?? true, rule: options.rule }),
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}\nglobalThis.templateFor = templateFor;`, context);

const template = context.templateFor('524113');
assert.equal(template.components.length, 2);
const transport = template.components[0];
const daily = template.components[1];
assert.deepEqual({ label: transport.label, unit: transport.unit, rate: transport.rateUsed, quantity: transport.quantity, active: transport.active }, { label: 'Transport kegiatan dalam kabupaten/kota PP', unit: 'Orang/Kali', rate: 170000, quantity: 1, active: true });
assert.deepEqual({ label: daily.label, unit: daily.unit, rate: daily.rateUsed, active: daily.active }, { label: 'Uang harian dalam kota > 8 jam', unit: 'Orang/OH', rate: 210000, active: false });
console.log('Module 4 524113 checks passed: Jakarta in-city transport and >8-hour daily allowance use SBM master rates.');
