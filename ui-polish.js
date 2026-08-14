(() => {
  const openModule = (module) => {
    if (typeof window.showModule === 'function') {
      window.showModule(module);
      return;
    }
    if (typeof showModule === 'function') showModule(module);
  };

  // Intercept module navigation at document level so stale element listeners
  // from initial boot cannot fire first after login/cloud hydration.
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
      // Both sidebar Laporan and the dashboard Generate PowerPoint button
      // always open the already-available report module directly.
      location.hash = 'report';
      openModule('report');
    }
  }, true);

  const polishLabels = () => {
    const deleteButton = document.querySelector('#deleteSnapshotButton');
    if (deleteButton && deleteButton.textContent.trim() !== 'Hapus Data') {
      deleteButton.textContent = 'Hapus Data';
      deleteButton.title = 'Hapus data periode aktif';
    }

    const applyButton = document.querySelector('#applySaktiData');
    if (applyButton && /Ganti Snapshot/i.test(applyButton.textContent)) {
      applyButton.textContent = 'Edit Data';
    }

    const uploadStatus = document.querySelector('#uploadStatus');
    if (uploadStatus && /Snapshot periode ini sudah ada/i.test(uploadStatus.textContent)) {
      uploadStatus.textContent = uploadStatus.textContent
        .replace(/Snapshot periode ini sudah ada/gi, 'Data periode ini sudah tersedia')
        .replace(/Ganti Snapshot/gi, 'Edit Data');
    }
  };

  polishLabels();
  new MutationObserver(polishLabels).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
})();
