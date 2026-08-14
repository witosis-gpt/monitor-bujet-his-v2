(() => {
  function getPreviousSp2dDataset() {
    try {
      if (!activeSnapshot?.period || typeof loadSnapshots !== 'function' || typeof snapshotKey !== 'function') return null;
      const snapshots = loadSnapshots();
      const currentKey = snapshotKey(activeSnapshot.period);
      const keys = Object.keys(snapshots)
        .filter(key => key < currentKey && snapshots[key]?.sp2d?.dataset)
        .sort();
      const previousKey = keys.at(-1);
      return previousKey ? snapshots[previousKey].sp2d.dataset : null;
    } catch (error) {
      console.warn('[Module1] previous-period insight unavailable', error);
      return null;
    }
  }

  function formatSignedCurrency(value) {
    const amount = Number(value) || 0;
    return `${amount >= 0 ? '+' : '-'}${rupiah.format(Math.abs(amount))}`;
  }

  function renderModule1MonthlyInsight() {
    const detailView = document.querySelector('#detailView');
    const reportView = document.querySelector('#reportView');
    if (!detailView?.hidden || !reportView?.hidden) return;

    const anchor = document.querySelector('.directorate-panel');
    if (!anchor || !activeSnapshot?.period) return;

    let panel = document.querySelector('#module1MonthlyInsight');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'module1MonthlyInsight';
      panel.className = 'panel module1-monthly-insight';
      anchor.insertAdjacentElement('beforebegin', panel);
    }

    const previous = getPreviousSp2dDataset();
    const currentSummary = activeSnapshot.executiveSummary || {};

    if (!previous) {
      panel.innerHTML = `<div class="section-heading"><div><p class="eyebrow">PERUBAHAN BULANAN</p><h2>Apa yang berubah?</h2></div></div><p class="section-note">Belum ada data bulan sebelumnya untuk dibandingkan.</p>`;
      return;
    }

    const previousSummary = previous.executiveSummary || {};
    const currentSp2d = Number(currentSummary.realization) || 0;
    const previousSp2d = Number(previousSummary.realization) || 0;
    const deltaSp2d = currentSp2d - previousSp2d;
    const currentPct = Number(currentSummary.pagu) ? currentSp2d / Number(currentSummary.pagu) * 100 : 0;
    const previousPct = Number(previousSummary.pagu) ? previousSp2d / Number(previousSummary.pagu) * 100 : 0;
    const deltaPct = currentPct - previousPct;

    const previousDirectorates = new Map((previous.directorates || []).map(item => [item.id || item.directorateCode, item]));
    const changes = (activeSnapshot.directorates || []).map(item => {
      const before = previousDirectorates.get(item.id || item.directorateCode);
      return {
        id: item.id || item.directorateCode,
        name: item.name || directorateCatalog[item.id || item.directorateCode] || item.id,
        delta: (Number(item.realization) || 0) - (Number(before?.realization) || 0),
        remaining: Number(item.remaining) || 0
      };
    });

    const biggestIncrease = [...changes].sort((a, b) => b.delta - a.delta)[0];
    const largestRemaining = [...changes].sort((a, b) => b.remaining - a.remaining)[0];
    const stagnant = changes.filter(item => item.delta === 0);

    panel.innerHTML = `
      <div class="section-heading">
        <div><p class="eyebrow">PERUBAHAN BULANAN</p><h2>Apa yang berubah sejak ${previous.period?.label || 'bulan sebelumnya'}?</h2></div>
        <strong class="accent-number">${formatSignedCurrency(deltaSp2d)}</strong>
      </div>
      <div class="module1-insight-grid">
        <div class="module1-insight-card"><span>Kenaikan SP2D</span><strong>${formatSignedCurrency(deltaSp2d)}</strong><small>${deltaPct >= 0 ? '+' : ''}${deltaPct.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} poin serapan</small></div>
        <div class="module1-insight-card"><span>Kenaikan terbesar</span><strong>${biggestIncrease?.name || '—'}</strong><small>${biggestIncrease ? formatSignedCurrency(biggestIncrease.delta) : '—'}</small></div>
        <div class="module1-insight-card"><span>Sisa terbesar</span><strong>${largestRemaining?.name || '—'}</strong><small>${largestRemaining ? rupiah.format(largestRemaining.remaining) : '—'}</small></div>
        <div class="module1-insight-card"><span>Belum bergerak</span><strong>${stagnant.length} direktorat</strong><small>${stagnant.length ? stagnant.map(item => item.name).join(', ') : 'Semua direktorat bergerak'}</small></div>
      </div>`;
  }

  function addStylesOnce() {
    if (document.querySelector('#module1EnhanceStyles')) return;
    const style = document.createElement('style');
    style.id = 'module1EnhanceStyles';
    style.textContent = `
      .module1-monthly-insight{margin-bottom:18px}
      .module1-insight-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
      .module1-insight-card{border:1px solid #dfe7eb;border-radius:12px;padding:14px;background:#fff;min-width:0}
      .module1-insight-card span{display:block;font-size:11px;color:#6a7b86;margin-bottom:7px;text-transform:uppercase;letter-spacing:.04em}
      .module1-insight-card strong{display:block;font-size:15px;color:#16364a;line-height:1.25;margin-bottom:5px}
      .module1-insight-card small{display:block;color:#6a7b86;line-height:1.35}
      @media (max-width:900px){.module1-insight-grid{grid-template-columns:1fr 1fr}}
      @media (max-width:560px){.module1-insight-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  addStylesOnce();

  if (typeof refreshDashboard === 'function') {
    const baseRefreshDashboard = refreshDashboard;
    refreshDashboard = function(...args) {
      const result = baseRefreshDashboard.apply(this, args);
      try { renderModule1MonthlyInsight(); } catch (error) { console.warn('[Module1] insight render failed', error); }
      return result;
    };
  }

  setTimeout(() => {
    try { renderModule1MonthlyInsight(); } catch (error) { console.warn('[Module1] initial insight render failed', error); }
  }, 300);
})();
