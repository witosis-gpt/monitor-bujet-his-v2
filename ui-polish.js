(() => {
  const openModule = (module) => {
    if (typeof window.showModule === 'function') {
      window.showModule(module);
      return;
    }
    if (typeof showModule === 'function') showModule(module);
  };

  const getLatestSnapshots = () => {
    try { return typeof loadSnapshots === 'function' ? loadSnapshots() : {}; }
    catch { return {}; }
  };

  const getActiveScope = () => document.querySelector('#directorateSelect')?.value || 'all';

  document.addEventListener('click', (event) => {
    const target = event.target.closest?.('#dashboardNav, #detailNav, #reportNav, #pptButton');
    if (!target) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (target.id === 'dashboardNav') {
      location.hash = 'dashboard';
      openModule('dashboard');
    } else if (target.id === 'detailNav') {
      location.hash = 'detail';
      openModule('detail');
    } else {
      location.hash = 'report';
      openModule('report');
    }
  }, true);

  function ensureFreshnessBadge() {
    const source = document.querySelector('#sourceInfo');
    if (!source || !activeSnapshot?.period) return;
    let badge = document.querySelector('#dataFreshnessBadge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'dataFreshnessBadge';
      badge.className = 'data-freshness-badge';
      source.insertAdjacentElement('afterend', badge);
    }
    const provenance = activeSnapshot?.provenance?.sp2d;
    const updated = provenance?.savedAt ? new Date(provenance.savedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'waktu impor tidak tersedia';
    const rows = activeSnapshot?.pairedRows || [];
    const total = rows.reduce((sum, row) => ({ pagu: sum.pagu + (Number(row.pagu) || 0), sp2d: sum.sp2d + (Number(row.cumulative) || 0) }), { pagu: 0, sp2d: 0 });
    const official = activeSnapshot?.executiveSummary || {};
    const reconciled = Math.abs(total.pagu - (Number(official.pagu) || 0)) <= 1 && Math.abs(total.sp2d - (Number(official.realization) || 0)) <= 1;
    badge.innerHTML = `<span><strong>Data aktif:</strong> ${activeSnapshot.period.label}</span><span>•</span><span>Diperbarui ${updated}</span><span>•</span><span class="${reconciled ? 'is-ok' : 'is-warn'}">${reconciled ? '✓ Data cocok dengan SAKTI' : '⚠ Perlu cek rekonsiliasi'}</span>`;
  }

  function previousSnapshotForActive() {
    if (!activeSnapshot?.period) return null;
    const snapshots = getLatestSnapshots();
    const activeKey = typeof snapshotKey === 'function' ? snapshotKey(activeSnapshot.period) : null;
    const keys = Object.keys(snapshots).filter(key => key < activeKey && snapshots[key]?.sp2d?.dataset).sort();
    const key = keys.at(-1);
    return key ? snapshots[key].sp2d.dataset : null;
  }

  function ensureMonthlyInsight() {
    const dashboardPanel = document.querySelector('.directorate-panel');
    if (!dashboardPanel || !activeSnapshot?.pairedRows?.length) return;
    let panel = document.querySelector('#monthlyChangePanel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'monthlyChangePanel';
      panel.className = 'panel monthly-change-panel';
      dashboardPanel.insertAdjacentElement('beforebegin', panel);
    }

    const prev = previousSnapshotForActive();
    const current = activeSnapshot.executiveSummary || {};
    if (!prev) {
      panel.innerHTML = `<div class="section-heading"><div><p class="eyebrow">PERUBAHAN BULANAN</p><h2>Apa yang berubah?</h2></div></div><p class="section-note">Belum ada data bulan sebelumnya untuk dibandingkan.</p>`;
      return;
    }

    const delta = (Number(current.realization) || 0) - (Number(prev.executiveSummary?.realization) || 0);
    const prevMap = new Map((prev.directorates || []).map(item => [item.id || item.directorateCode, item]));
    const currentDirs = activeSnapshot.directorates || [];
    const changes = currentDirs.map(item => {
      const before = prevMap.get(item.id || item.directorateCode);
      return { id: item.id, name: item.name, delta: (Number(item.realization) || 0) - (Number(before?.realization) || 0), remaining: Number(item.remaining) || 0 };
    });
    const biggest = [...changes].sort((a,b) => b.delta - a.delta)[0];
    const stagnant = changes.filter(item => item.delta === 0).map(item => item.name);
    const largestRemaining = [...changes].sort((a,b) => b.remaining - a.remaining)[0];
    const pctNow = current.pagu ? current.realization / current.pagu * 100 : 0;
    const pctPrev = prev.executiveSummary?.pagu ? prev.executiveSummary.realization / prev.executiveSummary.pagu * 100 : 0;

    panel.innerHTML = `<div class="section-heading"><div><p class="eyebrow">PERUBAHAN BULANAN</p><h2>Apa yang berubah sejak ${prev.period?.label || 'bulan sebelumnya'}?</h2></div><strong class="accent-number">${delta >= 0 ? '+' : ''}${rupiah.format(delta)}</strong></div><div class="monthly-insight-grid"><div><span>Kenaikan SP2D</span><strong>${delta >= 0 ? '+' : ''}${rupiah.format(delta)}</strong><small>${(pctNow-pctPrev >= 0 ? '+' : '')}${(pctNow-pctPrev).toLocaleString('id-ID',{maximumFractionDigits:2})} poin serapan</small></div><div><span>Kenaikan terbesar</span><strong>${biggest?.name || '—'}</strong><small>${biggest ? `${biggest.delta >= 0 ? '+' : ''}${rupiah.format(biggest.delta)}` : '—'}</small></div><div><span>Sisa terbesar</span><strong>${largestRemaining?.name || '—'}</strong><small>${largestRemaining ? rupiah.format(largestRemaining.remaining) : '—'}</small></div><div><span>Belum bergerak</span><strong>${stagnant.length}</strong><small>${stagnant.length ? stagnant.join(', ') : 'Semua direktorat bergerak'}</small></div></div>`;
  }

  function ensureDetailQuickFilters() {
    const filters = document.querySelector('.detail-filter-bar');
    if (!filters || document.querySelector('#detailQuickFilters')) return;
    const wrap = document.createElement('div');
    wrap.id = 'detailQuickFilters';
    wrap.className = 'detail-quick-filters';
    wrap.innerHTML = `<span>Filter cepat</span><button type="button" data-detail-quick="zero">Belum Realisasi</button><button type="button" data-detail-quick="low">Serapan Rendah</button><button type="button" data-detail-quick="accrual">Ada Akrual</button><button type="button" data-detail-quick="clear">Semua</button>`;
    filters.insertAdjacentElement('afterend', wrap);
    wrap.addEventListener('click', event => {
      const button = event.target.closest('button[data-detail-quick]');
      if (!button) return;
      const search = document.querySelector('#detailSearch');
      const action = button.dataset.detailQuick;
      if (action === 'zero') search.value = 'Belum realisasi';
      else if (action === 'low') search.value = 'Serapan rendah';
      else if (action === 'accrual') search.value = 'Akrual';
      else search.value = '';
      wrap.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button && action !== 'clear'));
      if (typeof renderModule2 === 'function') renderModule2();
    });
  }

  function ensureReportPresets() {
    const settings = document.querySelector('.report-settings');
    if (!settings || document.querySelector('#reportPresets')) return;
    const presets = document.createElement('div');
    presets.id = 'reportPresets';
    presets.className = 'report-presets';
    presets.innerHTML = `<span>Preset cepat</span><button type="button" data-report-preset="exec">Ringkas Pimpinan</button><button type="button" data-report-preset="deputy">Detail Deputi</button><button type="button" data-report-preset="directorate">Per Direktorat</button>`;
    settings.querySelector('.report-options')?.insertAdjacentElement('beforebegin', presets);
    presets.addEventListener('click', event => {
      const button = event.target.closest('button[data-report-preset]');
      if (!button) return;
      const preset = button.dataset.reportPreset;
      const scope = document.querySelector('#reportScopeSelect');
      const accounts = document.querySelector('#reportIncludeAccounts');
      const remaining = document.querySelector('#reportIncludeAccountRemaining');
      const visual = document.querySelector('#reportIncludeVisual');
      if (preset === 'exec') {
        scope.value = 'all'; accounts.checked = false; remaining.checked = false; visual.checked = true;
      } else if (preset === 'deputy') {
        scope.value = 'all'; accounts.checked = false; remaining.checked = true; visual.checked = true;
      } else {
        const activeScope = getActiveScope();
        scope.value = activeScope !== 'all' && [...scope.options].some(opt => opt.value === activeScope) ? activeScope : (scope.options[1]?.value || 'all');
        accounts.checked = false; remaining.checked = true; visual.checked = false;
      }
      presets.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
      if (typeof renderReportPreview === 'function') renderReportPreview();
    });
  }

  const polishLabels = () => {
    const deleteButton = document.querySelector('#deleteSnapshotButton');
    if (deleteButton && deleteButton.textContent.trim() !== 'Hapus Data') {
      deleteButton.textContent = 'Hapus Data';
      deleteButton.title = 'Hapus data periode aktif';
    }
    const applyButton = document.querySelector('#applySaktiData');
    if (applyButton && /Ganti Snapshot/i.test(applyButton.textContent)) applyButton.textContent = 'Edit Data';
    const uploadStatus = document.querySelector('#uploadStatus');
    if (uploadStatus && /Snapshot periode ini sudah ada/i.test(uploadStatus.textContent)) {
      uploadStatus.textContent = uploadStatus.textContent.replace(/Snapshot periode ini sudah ada/gi, 'Data periode ini sudah tersedia').replace(/Ganti Snapshot/gi, 'Edit Data');
    }
    ensureFreshnessBadge();
    if (!document.querySelector('#detailView')?.hidden) ensureDetailQuickFilters();
    if (!document.querySelector('#reportView')?.hidden) ensureReportPresets();
    if (document.querySelector('#detailView')?.hidden && document.querySelector('#reportView')?.hidden) ensureMonthlyInsight();
  };

  polishLabels();
  new MutationObserver(polishLabels).observe(document.body, { childList: true, subtree: true, characterData: true });
})();
