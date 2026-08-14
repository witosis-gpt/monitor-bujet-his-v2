(() => {
  const getRows = () => Array.isArray(activeSnapshot?.pairedRows) ? activeSnapshot.pairedRows : [];
  const getSelectedDirectorate = () => document.querySelector('#detailDirectorateSelect')?.value || 'all';

  function filteredRows() {
    const scope = getSelectedDirectorate();
    return getRows().filter(row => scope === 'all' || row.directorateCode === scope);
  }

  function metrics(row) {
    try {
      if (typeof module2Metrics === 'function') return module2Metrics(row);
    } catch (error) {
      console.warn('[Module2] metrics fallback', error);
    }
    const pagu = Number(row.pagu) || 0;
    const sp2d = Number(row.cumulative) || 0;
    const accrual = Number(row.accrualOutstanding) || 0;
    return { pagu, sp2d, accrual, potential: sp2d + accrual, remaining: pagu - sp2d, absorption: pagu ? sp2d / pagu * 100 : 0 };
  }

  function accountLabel(row) {
    return `${row.accountCode || '—'} · ${row.accountName || 'Tanpa uraian'}`;
  }

  function focusAccount(row) {
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

    const rows = filteredRows().filter(row => row.accountCode);
    const rankedRemaining = rows.map(row => ({ row, m: metrics(row) })).filter(item => item.m.remaining > 0).sort((a,b) => b.m.remaining - a.m.remaining);
    const zeroRealization = rows.map(row => ({ row, m: metrics(row) })).filter(item => item.m.pagu > 0 && item.m.sp2d === 0).sort((a,b) => b.m.remaining - a.m.remaining);
    const withAccrual = rows.map(row => ({ row, m: metrics(row) })).filter(item => item.m.accrual > 0).sort((a,b) => b.m.accrual - a.m.accrual);
    const lowAbsorption = rows.map(row => ({ row, m: metrics(row) })).filter(item => item.m.pagu > 0 && item.m.sp2d > 0 && item.m.absorption < 25).sort((a,b) => a.m.absorption - b.m.absorption);

    const topRemaining = rankedRemaining[0];
    const topZero = zeroRealization[0];
    const topAccrual = withAccrual[0];
    const topLow = lowAbsorption[0];

    panel.innerHTML = `
      <div class="module2-focus-heading">
        <div><p class="eyebrow">FOKUS CEPAT</p><h2>Akun yang perlu dilihat dulu</h2></div>
        <span>${rows.length.toLocaleString('id-ID')} akun pada cakupan aktif</span>
      </div>
      <div class="module2-focus-grid">
        <button type="button" class="module2-focus-card" data-focus="remaining" ${topRemaining ? '' : 'disabled'}>
          <span>Sisa terbesar</span><strong>${topRemaining ? accountLabel(topRemaining.row) : 'Tidak ada'}</strong><small>${topRemaining ? rupiah.format(topRemaining.m.remaining) : '—'}</small>
        </button>
        <button type="button" class="module2-focus-card" data-focus="zero" ${topZero ? '' : 'disabled'}>
          <span>Belum realisasi</span><strong>${zeroRealization.length.toLocaleString('id-ID')} akun</strong><small>${topZero ? accountLabel(topZero.row) : 'Tidak ada akun'}</small>
        </button>
        <button type="button" class="module2-focus-card" data-focus="low" ${topLow ? '' : 'disabled'}>
          <span>Serapan &lt; 25%</span><strong>${lowAbsorption.length.toLocaleString('id-ID')} akun</strong><small>${topLow ? `${accountLabel(topLow.row)} · ${topLow.m.absorption.toLocaleString('id-ID',{maximumFractionDigits:2})}%` : 'Tidak ada akun'}</small>
        </button>
        <button type="button" class="module2-focus-card" data-focus="accrual" ${topAccrual ? '' : 'disabled'}>
          <span>Ada akrual</span><strong>${withAccrual.length.toLocaleString('id-ID')} akun</strong><small>${topAccrual ? `${accountLabel(topAccrual.row)} · ${rupiah.format(topAccrual.m.accrual)}` : 'Belum ada akrual'}</small>
        </button>
      </div>`;

    panel.querySelector('[data-focus="remaining"]')?.addEventListener('click', () => focusAccount(topRemaining?.row));
    panel.querySelector('[data-focus="zero"]')?.addEventListener('click', () => focusAccount(topZero?.row));
    panel.querySelector('[data-focus="low"]')?.addEventListener('click', () => focusAccount(topLow?.row));
    panel.querySelector('[data-focus="accrual"]')?.addEventListener('click', () => focusAccount(topAccrual?.row));
  }

  function addStylesOnce() {
    if (document.querySelector('#module2EnhanceStyles')) return;
    const style = document.createElement('style');
    style.id = 'module2EnhanceStyles';
    style.textContent = `
      .module2-focus-panel{margin:0 0 18px;padding:16px;border:1px solid #dfe7eb;border-radius:14px;background:#fff}
      .module2-focus-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:12px}
      .module2-focus-heading h2{margin:0}.module2-focus-heading span{font-size:12px;color:#6a7b86}
      .module2-focus-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
      .module2-focus-card{text-align:left;border:1px solid #dfe7eb;background:#f9fbfc;border-radius:12px;padding:13px;cursor:pointer;min-width:0}
      .module2-focus-card:hover{border-color:#91afbf;background:#fff}.module2-focus-card:disabled{cursor:default;opacity:.6}
      .module2-focus-card span{display:block;font-size:11px;color:#6a7b86;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}
      .module2-focus-card strong{display:block;font-size:14px;line-height:1.3;color:#16364a;margin-bottom:5px;white-space:normal}
      .module2-focus-card small{display:block;color:#6a7b86;line-height:1.35}
      @media(max-width:980px){.module2-focus-grid{grid-template-columns:1fr 1fr}}
      @media(max-width:600px){.module2-focus-grid{grid-template-columns:1fr}.module2-focus-heading{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  addStylesOnce();

  document.querySelector('#detailNav')?.addEventListener('click', () => setTimeout(renderModule2Focus, 250));
  document.querySelector('#detailBudgetButton')?.addEventListener('click', () => setTimeout(renderModule2Focus, 250));
  document.querySelector('#detailDirectorateSelect')?.addEventListener('change', () => setTimeout(renderModule2Focus, 80));
  document.querySelector('#detailYearSelect')?.addEventListener('change', () => setTimeout(renderModule2Focus, 80));
  document.querySelector('#detailPeriodSelect')?.addEventListener('change', () => setTimeout(renderModule2Focus, 80));

  if (typeof showModule === 'function') {
    const baseShowModule = showModule;
    showModule = function(module, ...args) {
      const result = baseShowModule.call(this, module, ...args);
      if (module === 'detail') setTimeout(renderModule2Focus, 80);
      return result;
    };
  }
})();
