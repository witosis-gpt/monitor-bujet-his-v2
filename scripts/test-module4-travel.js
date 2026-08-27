const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const master = require('../data/sbm-2026.json');
const source = fs.readFileSync(require.resolve('../module4.js'), 'utf8');
const start = source.indexOf('  const capComponent');
const end = source.indexOf('  function travelMarkup');
assert.ok(start >= 0 && end > start, 'Module 4 travel helpers were not found.');

const context = {
  state: { master, masterStatus: 'loaded' },
  crypto: { randomUUID: (() => { let value = 0; return () => `test-${++value}`; })() },
  component: (label, unit, rate = 0, options = {}) => ({ id: `component-${Math.random()}`, label, unit, quantity: options.quantity ?? 1, rateUsed: rate, referenceRate: rate, pricingSource: rate ? 'SBM' : 'MANUAL', active: options.active ?? true, rule: options.rule || 'manual', hint: options.hint || '' }),
  rankGroups: ['Pejabat Negara/Wamen/Eselon I', 'Pejabat Negara lainnya/Eselon II', 'Eselon III/Gol IV', 'Eselon IV/Gol III/II/I'],
};
context.id = () => context.crypto.randomUUID();
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}\nglobalThis.travelHooks = { destinations, normalizePlaceName, findGroundTransportRate, placesForProvince, canonicalPlace, refreshLegs, calculateStayCosts, calculateMovementCosts, recalculateTravelLine };`, context);

const { destinations, findGroundTransportRate, placesForProvince, canonicalPlace, refreshLegs, calculateStayCosts, calculateMovementCosts, recalculateTravelLine } = context.travelHooks;
const team = () => ({ team: { 'Eselon IV/Gol III/II/I': 4 } });
const rate = (from, to, expected) => { const result = findGroundTransportRate(from, to, master.rates); assert.ok(result, `${from} → ${to} should resolve from SBM`); assert.equal(result.rate, expected); assert.equal(result.unit, 'Orang/Kali'); return result; };
const movement = (from, to) => calculateMovementCosts([{ from, to, fromProvince: 'JAWA TIMUR', toProvince: 'JAWA TIMUR', transportType: 'Ground SBM', flightClass: 'economy', rateUsed: 0 }], team(), [], master.rates)[0];
const resolvedLeg = { from: 'Surabaya', to: 'Kab. Pasuruan', fromProvince: 'JAWA TIMUR', toProvince: 'JAWA TIMUR', transportType: 'Ground SBM', flightClass: 'economy', rateUsed: 0 };
calculateMovementCosts([resolvedLeg], team(), [], master.rates);
assert.deepEqual({ rateUsed: resolvedLeg.rateUsed, referenceRate: resolvedLeg.referenceRate, unit: resolvedLeg.unit, pricingSource: resolvedLeg.pricingSource, sbmMatched: resolvedLeg.sbmMatched }, { rateUsed: 228000, referenceRate: 228000, unit: 'Orang/Kali', pricingSource: 'SBM 2026', sbmMatched: true });

const bitung = rate('Manado', 'Bitung', 175000);
assert.equal(bitung.destination, 'Kota Bitung');
assert.equal(movement('Manado', 'Bitung').rateUsed * movement('Manado', 'Bitung').quantity, 700000);
assert.equal(movement('Surabaya', 'Pasuruan').rateUsed * movement('Surabaya', 'Pasuruan').quantity, 912000);
assert.equal(rate('Pasuruan', 'Surabaya', 228000).reverseMatched, true);
assert.equal(movement('Pasuruan', 'Surabaya').rateUsed * movement('Pasuruan', 'Surabaya').quantity, 912000);
assert.equal(movement('Surabaya', 'Sidoarjo').rateUsed * movement('Surabaya', 'Sidoarjo').quantity, 960000);
assert.equal(rate('Sidoarjo', 'Surabaya', 240000).reverseMatched, true);
assert.equal(movement('Sidoarjo', 'Surabaya').rateUsed * movement('Sidoarjo', 'Surabaya').quantity, 960000);
const eastJavaPlaces = placesForProvince('JAWA TIMUR', master.rates);
assert.ok(eastJavaPlaces.includes('Surabaya') && eastJavaPlaces.includes('Kab. Pasuruan') && eastJavaPlaces.includes('Kab. Sidoarjo'), 'Jawa Timur must expose SBM hub and route destinations');
const northSulawesiPlaces = placesForProvince('SULAWESI UTARA', master.rates);
assert.ok(northSulawesiPlaces.includes('Manado') && northSulawesiPlaces.includes('Kota Bitung'), 'Sulawesi Utara must expose SBM hub and route destinations');
assert.equal(canonicalPlace('Pasuruan', eastJavaPlaces), 'Kab. Pasuruan');
assert.equal(canonicalPlace('Bitung', northSulawesiPlaces), 'Kota Bitung');

const itinerary = { origin: 'Surabaya', destinations: [
  { id: 'a', province: 'JAWA TIMUR', city: 'Pasuruan', days: 0, nights: 0 },
  { id: 'b', province: 'JAWA TIMUR', city: 'Surabaya', days: 0, nights: 0 },
  { id: 'c', province: 'JAWA TIMUR', city: 'Sidoarjo', days: 0, nights: 0 },
  { id: 'd', province: 'JAWA TIMUR', city: 'Surabaya', days: 0, nights: 0 },
], team: team().team, routeLegs: [] };
assert.strictEqual(destinations(itinerary), itinerary.stops, 'stops must alias destinations');
refreshLegs(itinerary);
assert.deepEqual([...itinerary.routeLegs].map(leg => `${leg.from}→${leg.to}`), ['Surabaya→Pasuruan', 'Pasuruan→Surabaya', 'Surabaya→Sidoarjo', 'Sidoarjo→Surabaya', 'Surabaya→Surabaya']);
const groundLegs = itinerary.routeLegs.slice(0, 4).map(leg => ({ ...leg, transportType: 'Ground SBM' }));
assert.equal(calculateMovementCosts(groundLegs, itinerary, itinerary.destinations, master.rates).reduce((total, item) => total + item.rateUsed * item.quantity, 0), 3744000);
assert.equal(calculateStayCosts(itinerary.destinations, itinerary, master.rates).length, 0, 'zero-day/zero-night stops must not create stay costs');

const provinceStay = { id: 'stay', province: 'JAWA TIMUR', city: 'Malang', days: 2, nights: 2 };
const stayCosts = calculateStayCosts([provinceStay], team(), master.rates);
assert.ok(stayCosts.some(item => item.label === 'Uang harian luar kota — JAWA TIMUR'), 'daily allowance must use province');
assert.ok(stayCosts.some(item => item.label.includes('Penginapan — Malang') && item.referenceRate === master.rates.accommodation['JAWA TIMUR']['Eselon IV/Gol III/II/I']), 'accommodation must use province rate and city label');
const optionalManualLine = { travel: { origin: 'Jakarta', destinations: [{ id: 'single', province: 'JAWA TIMUR', city: 'Surabaya', days: 0, nights: 0 }], team: team().team, routeLegs: [] }, components: [] };
recalculateTravelLine(optionalManualLine);
const defaultManual = optionalManualLine.components.find(item => item.manualEntry === true);
assert.ok(defaultManual, 'travel plans must include an optional manual component');
assert.equal(defaultManual.active, false, 'the default manual component must be inactive');
const meetingTravel = structuredClone(itinerary); meetingTravel.routeLegs.slice(0, 4).forEach(item => { item.transportType = 'Ground SBM'; });
const meetingLine = { accountCode: '524119', travel: meetingTravel, components: [{ id: 'meeting', label: 'MENYELENGGARAKAN — paket Fullboard', unit: 'Orang/Hari', quantity: 1, rateUsed: 0, active: false, meetingPackage: true }] };
recalculateTravelLine(meetingLine);
assert.ok(meetingLine.components.some(item => item.meetingPackage === true), '524119 must retain its optional meeting package components');
assert.equal(meetingLine.components.filter(item => item.label.startsWith('Transport darat SBM')).reduce((sum, item) => sum + item.quantity * item.rateUsed, 0), 3744000, '524119 must reuse the 524111 ground transport calculation');
assert.ok(!meetingLine.components.some(item => /MENGHADIRI|Akomodasi reguler|Uang harian reguler|Transport terminal\/bandara/.test(item.label)), '524119 must not retain duplicate travel placeholders');
console.log('Module 4 travel checks passed: SBM forward/reverse lookup, repeated legs, zero-stay movement, and province-based stay costs.');
