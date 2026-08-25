(() => {
  function installCloudSaveApplyHandler() {
    const button = document.querySelector('#applySaktiData');
    if (!button || button.dataset.cloudSaveFixed === '1') return;

    // Replace the button node to remove the two competing click listeners from app.js.
    const replacement = button.cloneNode(true);
    replacement.dataset.cloudSaveFixed = '1';
    button.replaceWith(replacement);

    replacement.addEventListener('click', async () => {
      const pending = pendingSaktiImport;
      if (!pending?.dataset) return;

      replacement.disabled = true;
      const sourceLabel = pending.sourceType === 'accrual' ? 'Akrual' : 'SP2D';
      uploadStatus(`Menyimpan ${sourceLabel} ke cloud…`, 'loading');
      window.SaktiCloud?.status('Menyimpan data ke cloud…');

      let cloudSaved = false;
      try {
        if (!window.SaktiCloud?.configured) throw new Error('Konfigurasi Supabase belum tersedia.');
        if (!window.SaktiCloud.isAuthenticated()) {
          await window.SaktiCloud.restoreSession();
        }
        if (!window.SaktiCloud.isAuthenticated()) throw new Error('Sesi login Supabase tidak aktif. Silakan login ulang.');

        await window.SaktiCloud.saveSnapshot(pending.dataset, pending.filename, pending.sourceType);
        cloudSaved = true;
      } catch (error) {
        console.error('Supabase snapshot save failed', error);
      }

      // Always keep the parsed data locally so a temporary cloud failure does not lose the import.
      applySaktiDataset(pending.dataset, pending.filename, true, pending.sourceType);
      closeUploadModal();

      if (cloudSaved) {
        showToast(`${sourceLabel} berhasil diperbarui dan tersimpan ke cloud.`);
        window.SaktiCloud?.status('Data tersinkron ke cloud');
      } else {
        showToast(`${sourceLabel} masuk ke dashboard, tetapi gagal tersimpan ke cloud. Coba login ulang lalu upload kembali.`);
        window.SaktiCloud?.status('Cloud gagal menyimpan · data hanya tersimpan di perangkat');
      }

      replacement.disabled = false;
    });
  }

  // app.js installs its listeners during init/setTimeout(0), so install after that.
  setTimeout(installCloudSaveApplyHandler, 50);
  window.addEventListener('load', () => setTimeout(installCloudSaveApplyHandler, 50));
})();
