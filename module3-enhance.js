(() => {
  function fireChange(el) {
    if (!el) return;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function currentDirectorateScope() {
    const dashboardScope = document.querySelector('#directorateSelect')?.value;
    const reportScope = document.querySelector('#reportScopeSelect');
    if (dashboardScope && dashboardScope !== 'all' && [...(reportScope?.options || [])].some(opt => opt.value === dashboardScope)) return dashboardScope;
    const firstDirectorate = [...(reportScope?.options || [])].find(opt => opt.value && opt.value !== 'all');
    return firstDirectorate?.value || 'all';
  }

  function applyPreset(name) {
    try {
      const scope = document.querySelector('#reportScopeSelect');
      const includeAccounts = document.querySelector('#reportIncludeAccounts');
      const includeRemaining = document.querySelector('#reportIncludeAccountRemaining');
      const includeVisual = document.querySelector('#reportIncludeVisual');
      if (!scope || !includeAccounts || !includeRemaining || !includeVisual) return;

      if (name === 'executive') {
        scope.value = 'all';
        includeAccounts.checked = false;
        includeRemaining.checked = false;
        includeVisual.checked = true;
      } else if (name === 'deputy') {
        scope.value = 'all';
        includeAccounts.checked = false;
        includeRemaining.checked = true;
        includeVisual.checked = true;
      } else if (name === 'directorate') {
        scope.value = currentDirectorateScope();
        includeAccounts.checked = false;
        includeRemaining.checked = true;
        includeVisual.checked = false;
      }

      fireChange(scope);
      fireChange(includeAccounts);
      fireChange(includeRemaining);
      fireChange(includeVisual);

      document.querySelectorAll('#module3PresetBar button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.reportPreset === name);
      });
    } catch (error) {
      console.warn('[Module3] preset apply skipped', error);
    }
  }

  function renderPresetBar() {
    try {
      if (document.querySelector('#reportView')?.hidden) return;
      const settings = document.querySelector('.report-settings');
      const controls = settings?.querySelector('.report-controls');
      if (!settings || !controls) return;

      let bar = document.querySelector('#module3PresetBar');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'module3PresetBar';
        bar.className = 'module3-preset-bar';
        bar.innerHTML = `
          <div class="module3-preset-copy"><span>Preset cepat</span><small>Pilih format, lalu tetap bisa ubah checkbox manual.</small></div>
          <div class="module3-preset-actions">
            <button type="button" data-report-preset="executive"><strong>Ringkas Pimpinan</strong><small>Visual + tabel utama</small></button>
            <button type="button" data-report-preset="deputy"><strong>Detail Deputi</strong><small>Tambah sisa per akun</small></button>
            <button type="button" data-report-preset="directorate"><strong>Per Direktorat</strong><small>Fokus satu direktorat</small></button>
          </div>`;
        controls.insertAdjacentElement('beforebegin', bar);
        bar.addEventListener('click', event => {
          const button = event.target.closest('button[data-report-preset]');
          if (button) applyPreset(button.dataset.reportPreset);
        });
      }
    } catch (error) {
      console.warn('[Module3] preset render skipped', error);
    }
  }

  if (!document.querySelector('#module3EnhanceStyles')) {
    const style = document.createElement('style');
    style.id = 'module3EnhanceStyles';
    style.textContent = `
      .module3-preset-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0 16px;border-bottom:1px solid #e3eaee;margin-bottom:16px}
      .module3-preset-copy span{display:block;font-size:12px;font-weight:700;color:#16364a;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px}
      .module3-preset-copy small{color:#6a7b86}
      .module3-preset-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;flex:1;max-width:650px}
      .module3-preset-actions button{border:1px solid #dbe5ea;background:#f9fbfc;border-radius:10px;padding:10px 12px;text-align:left;cursor:pointer;color:#16364a}
      .module3-preset-actions button.active{border-color:#2f718f;background:#eef7fb;box-shadow:inset 0 0 0 1px #2f718f}
      .module3-preset-actions strong{display:block;font-size:13px;margin-bottom:3px}
      .module3-preset-actions small{display:block;color:#6a7b86;font-size:11px}
      @media(max-width:850px){.module3-preset-bar{align-items:flex-start;flex-direction:column}.module3-preset-actions{width:100%;max-width:none}}
      @media(max-width:560px){.module3-preset-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  window.addEventListener('hashchange', () => {
    if (location.hash === '#report') setTimeout(renderPresetBar, 120);
  });

  if (location.hash === '#report' || !document.querySelector('#reportView')?.hidden) setTimeout(renderPresetBar, 250);
})();
