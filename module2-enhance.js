(() => {
  const safeRender = () => {
    try { renderModule2Focus(); }
    catch (error) { console.warn('[Module2] focus render skipped', error); }
  };

  const getRows = () => Array.isArray(activeSnapshot?.pairedRows) ? activeSnapshot.pairedRows : [];
  const scope = () => document.querySelector('#detailDirectorateSelect')?.value || 'all';
  const rowsForScope = () => getRows().filter(row => (scope() === 'all' || row.directorateCode === scope()) && row.accountCode);

  function metric(row) {
    try { if (typeof module2Metrics === 'function') return module2Metrics(row); } catch {}
    const pagu = Number(row.pagu) || 0;
    const sp2d = Number(row.cumulative) || 0;
    const accrual = Number(row.accrualOutstanding) || 0;
    return { pagu, sp2d, accrual, remaining: pagu - sp2d, absorption: pagu ? sp2d / pagu * 100 : 0 };
  }

  const label = row => `${row.accountCode || '—'} · ${row.accountName || 'Tanpa uraian'}`;

  function focus(row) {
    const search = document.querySelector('#detailSearch');
    if (!search || !row?.accountCode) return;
    search.value = row.accountCode;
    search.dispatchEvent(new Event('input', { bubbles: true }));
    search.focus();
  }

  function renderModule2Focus() {
    if (document.querySelector('#detailView')?.hidden) return;
    const summary = document.querySelector('#detailSummary');
    if (!summary) return;

    let panel = document.querySelector('#module2FocusPanel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'module2FocusPanel';
      panel.className = 'module2-focus-panel';
      summary.insertAdjacentElement('afterend', panel);
    }

    const items = rowsForScope().map(row => ({ row, m: metric(row) }));
    const remaining = items.filter(x => x.m.remaining > 0).sort((a,b) => b.m.remaining - a.m.remaining);
    const zero = items.filter(x => x.m.pagu > 0 && x.m.sp2d === 0).sort((a,b) => b.m.remaining - a.m.remaining);
    const low = items.filter(x => x.m.pagu > 0 && x.m.sp2d > 0 && x.m.absorption < 25).sort((a,b) => a.m.absorption - b.m.absorption);
    const accrual = items.filter(x => x.m.accrual > 0).sort((a,b) => b.m.accrual - a.m.accrual);
    const topRemaining = remaining[0], topZero = zero[0], topLow = low[0], topAccrual = accrual[0];

    panel.innerHTML = `
      <div class="module2-focus-heading"><div><p class="eyebrow">FOKUS CEPAT</p><h2>Akun yang perlu dilihat dulu</h2></div><span>${items.length.toLocaleString('id-ID')} akun pada cakupan aktif</span></div>
      <div class="module2-focus-grid">
        <button class="module2-focus-card" data-focus="remaining" ${topRemaining ? '' : 'disabled'}><span>Sisa terbesar</span><strong>${topRemaining ? label(topRemaining.row) : 'Tidak ada'}</strong><small>${topRemaining ? rupiah.format(topRemaining.m.remaining) : '—'}</small></button>
        <button class="module2-focus-card" data-focus="zero" ${topZero ? '' : 'disabled'}><span>Belum realisasi</span><strong>${zero.length.toLocaleString('id-ID')} akun</strong><small>${topZero ? label(topZero.row) : 'Tidak ada akun'}</small></button>
        <button class="module2-focus-card" data-focus="low" ${topLow ? '' : 'disabled'}><span>Serapan &lt; 25%</span><strong>${low.length.toLocaleString('id-ID')} akun</strong><small>${topLow ? `${label(topLow.row)} · ${topLow.m.absorption.toLocaleString('id-ID',{maximumFractionDigits:2})}%` : 'Tidak ada akun'}</small></button>
        <button class="module2-focus-card" data-focus="accrual" ${topAccrual ? '' : 'disabled'}><span>Ada akrual</span><strong>${accrual.length.toLocaleString('id-ID')} akun</strong><small>${topAccrual ? `${label(topAccrual.row)} · ${rupiah.format(topAccrual.m.accrual)}` : 'Belum ada akrual'}</small></button>
      </div>`;

    panel.querySelector('[data-focus="remaining"]')?.addEventListener('click', () => focus(topRemaining?.row));
    panel.querySelector('[data-focus="zero"]')?.addEventListener('click', () => focus(topZero?.row));
    panel.querySelector('[data-focus="low"]')?.addEventListener('click', () => focus(topLow?.row));
    panel.querySelector('[data-focus="accrual"]')?.addEventListener('click', () => focus(topAccrual?.row));
  }

  if (!document.querySelector('#module2EnhanceStyles')) {
    const style = document.createElement('style');
    style.id = 'module2EnhanceStyles';
    style.textContent = `.module2-focus-panel{margin:0 0 18px;padding:16px;border:1px solid #dfe7eb;border-radius:14px;background:#fff}.module2-focus-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:12px}.module2-focus-heading h2{margin:0}.module2-focus-heading span{font-size:12px;color:#6a7b86}.module2-focus-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.module2-focus-card{text-align:left;border:1px solid #dfe7eb;background:#f9fbfc;border-radius:12px;padding:13px;cursor:pointer;min-width:0}.module2-focus-card:disabled{cursor:default;opacity:.6}.module2-focus-card span{display:block;font-size:11px;color:#6a7b86;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}.module2-focus-card strong{display:block;font-size:14px;line-height:1.3;color:#16364a;margin-bottom:5px}.module2-focus-card small{display:block;color:#6a7b86;line-height:1.35}@media(max-width:980px){.module2-focus-grid{grid-template-columns:1fr 1fr}}@media(max-width:600px){.module2-focus-grid{grid-template-columns:1fr}.module2-focus-heading{align-items:flex-start;flex-direction:column}}`;
    document.head.appendChild(style);
  }

  // ui-polish intercepts sidebar clicks in capture phase, so hashchange is the reliable trigger.
  window.addEventListener('hashchange', () => {
    if (location.hash === '#detail') setTimeout(safeRender, 120);
  });

  ['detailDirectorateSelect','detailYearSelect','detailPeriodSelect'].forEach(id => {
    document.querySelector(`#${id}`)?.addEventListener('change', () => setTimeout(safeRender, 80));
  });

  if (location.hash === '#detail' || !document.querySelector('#detailView')?.hidden) setTimeout(safeRender, 250);
})();
