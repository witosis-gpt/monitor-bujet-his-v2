(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const pendingKey = 'hisPendingSaktiImportV2';
  let saving = false;
  let loading = null;
  let lastCloudError = '';
  const validBucket = bucket => bucket && (bucket.sp2d?.dataset || bucket.accrual?.dataset);
  const availableKeys = buckets => Object.keys(buckets).filter(key => validBucket(buckets[key])).sort();
  const officialKeys = buckets => Object.keys(buckets).filter(key => buckets[key]?.sp2d?.dataset).sort();
  const safeStatus = (message, type = '') => { uploadStatus(message, type); window.SaktiCloud?.status(message); };
  function savePending(pending) {
    try { localStorage.setItem(pendingKey, JSON.stringify(pending)); }
    catch (error) { console.warn('[SAKTI] Pending import could not be cached; it remains in memory.', error); }
  }
  function clearPending() { localStorage.removeItem(pendingKey); }
  function restorePending() {
    if (pendingSaktiImport?.dataset) return;
    try {
      const saved = JSON.parse(localStorage.getItem(pendingKey) || 'null');
      if (saved?.dataset?.period && ['sp2d','accrual'].includes(saved.sourceType)) {
        pendingSaktiImport = saved;
        const button = $('#applySaktiData');
        if (button) { button.disabled = false; button.textContent = 'Simpan ulang ke cloud'; }
        uploadStatus(`Impor ${saved.filename || 'SAKTI'} belum dikonfirmasi tersimpan. Klik Simpan ulang ke cloud setelah koneksi pulih.`, 'error');
      }
    } catch (error) { console.warn('[SAKTI] Pending import cache unreadable.', error); }
  }
  // Keep the original form parser and validation. Persist its validated result before a cloud write.
  const baseHandleSaktiFile = handleSaktiFile;
  handleSaktiFile = async function(file) {
    const previous = pendingSaktiImport;
    if (previous?.dataset && !window.confirm('Ada impor yang belum dikonfirmasi tersimpan ke cloud. Ganti dengan file baru?')) return;
    await baseHandleSaktiFile(file);
    if (pendingSaktiImport?.dataset) savePending(pendingSaktiImport);
  };
  const baseSetActiveSnapshot = setActiveSnapshot;
  const baseRenderSourceInfo = renderSourceInfo;
  let sourceNote = '';
  function showSourceNote() {
    const node = $('#sourceInfo');
    if (!node || !sourceNote) return;
    node.hidden = false;
    let note = $('#saktiRecoveryNote');
    if (!note) { note = document.createElement('p'); note.id = 'saktiRecoveryNote'; note.className = 'section-note'; node.appendChild(note); }
    note.textContent = sourceNote;
  }
  renderSourceInfo = function(...args) { const result = baseRenderSourceInfo.apply(this,args); showSourceNote(); return result; };
  function reconcileReference(sp2d, accrual) {
    const map = new Map((accrual.rows || []).map(row => [stableRowKey(row),row]));
    const rows = (sp2d.rows || []).map(row => {
      const other = map.get(stableRowKey(row));
      if (other) map.delete(stableRowKey(row));
      const accrualOutstanding = Math.max(0,(Number(other?.cumulative)||0)-(Number(row.cumulative)||0));
      return {...row,accrualOutstanding,potential:(Number(row.cumulative)||0)+accrualOutstanding};
    });
    for (const row of map.values()) {
      const accrualOutstanding = Math.max(0,Number(row.cumulative)||0);
      rows.push({...row,cumulative:0,previousPeriod:0,currentPeriod:0,accrualOutstanding,potential:accrualOutstanding,sp2dOnly:false});
    }
    const outstanding = rows.reduce((sum,row)=>sum+(Number(row.accrualOutstanding)||0),0);
    return {rows,diagnostics:{outstandingAccrual:outstanding,potentialRealization:(Number(sp2d.executiveSummary.realization)||0)+outstanding,referencePeriod:sp2d.period.label,accrualPeriod:accrual.period.label}};
  }
  function selectAvailableSnapshot(key) {
    const buckets = loadSnapshots();
    const bucket = buckets[key];
    if (!validBucket(bucket)) return false;
    const referenceKey = bucket.sp2d?.dataset ? key : officialKeys(buckets).filter(candidate => candidate <= key).at(-1);
    if (!referenceKey) {
      sourceNote = `Akrual ${bucket.accrual?.dataset?.period?.label || key} tersimpan, tetapi belum ada SP2D referensi. Unggah SP2D untuk menampilkan perhitungan resmi.`;
      window.SaktiCloud?.status(sourceNote);
      return false;
    }
    baseSetActiveSnapshot(referenceKey);
    const reference = buckets[referenceKey].sp2d.dataset;
    const accrual = bucket.accrual?.dataset || null;
    if (accrual && referenceKey !== key) {
      const reconciliation = reconcileReference(reference,accrual);
      activeSnapshot = {...activeSnapshot,accrualSnapshot:accrual,pairedRows:reconciliation.rows,accrualDiagnostics:reconciliation.diagnostics,provenance:{sp2d:buckets[referenceKey].sp2d,accrual:bucket.accrual}};
      sourceNote = `Akrual ${accrual.period.label} menggunakan SP2D terakhir yang tersedia (${reference.period.label}) sebagai referensi sementara. Angka ini bukan realisasi SP2D periode ${accrual.period.label}.`;
      refreshDashboard();
      $('#monthSelect').value = key;
      $('#activePeriod').textContent = `• Akrual ${accrual.period.label} · SP2D ${reference.period.label}`;
    } else {
      sourceNote = '';
      if (accrual) refreshDashboard();
    }
    showSourceNote();
    return true;
  }
  setActiveSnapshot = function(key) { return selectAvailableSnapshot(key); };
  // Include accrual-only periods in the selector, but never mislabel them as official SP2D.
  populateSnapshotFilters = function(snapshots,activeKey) {
    const keys = availableKeys(snapshots);
    if (!keys.length) return;
    const yearSelect = $('#yearSelect'), monthSelect = $('#monthSelect');
    const year = Number(activeKey.slice(0,4));
    yearSelect.innerHTML = [...new Set(keys.map(key=>key.slice(0,4)))].map(value=>`<option value="${value}" ${Number(value)===year?'selected':''}>${value}</option>`).join('');
    monthSelect.innerHTML = keys.filter(key=>key.startsWith(`${year}-`)).map(key=>{const bucket=snapshots[key];const dataset=bucket.sp2d?.dataset||bucket.accrual?.dataset;return `<option value="${key}" ${key===activeKey?'selected':''}>${dataset.period.label.split(' ')[0]}${!bucket.sp2d?.dataset?' · Akrual':''}</option>`;}).join('')+`<option value="yearly" ${typeof periodMode!=='undefined'&&periodMode==='yearly'?'selected':''}>Tahunan</option>`;
  };
  async function refreshCloud(preferredKey) {
    if (loading) return loading;
    loading = (async()=>{
      if (!window.SaktiCloud?.configured) throw new Error('Konfigurasi Supabase belum tersedia.');
      await window.SaktiCloud.restoreSession();
      if (!window.SaktiCloud.isAuthenticated()) throw new Error('Sesi login tidak aktif. Silakan masuk kembali.');
      const cloud = await window.SaktiCloud.loadSnapshots();
      // Do not replace local state with an empty/partial result before selecting a valid snapshot.
      const keys = availableKeys(cloud);
      const cached = loadSnapshots();
      if (!keys.length && availableKeys(cached).length) throw new Error('Cloud mengembalikan data kosong sementara cache berisi snapshot. Data lokal dipertahankan.');
      const merged = {...cloud};
      // Preserve only unsynced local sources; never overwrite a cloud source with stale local data.
      for (const [key,bucket] of Object.entries(cached)) {
        if (!merged[key]) merged[key] = {...bucket};
        else for (const source of ['sp2d','accrual']) if (!merged[key][source] && bucket?.[source]) merged[key][source] = bucket[source];
      }
      saveSnapshots(merged);
      const choice = preferredKey && validBucket(merged[preferredKey]) ? preferredKey : availableKeys(merged).at(-1);
      if (choice) selectAvailableSnapshot(choice);
      window.SaktiCloud.status('Data SAKTI berhasil dimuat dari cloud');
      lastCloudError = '';
      return merged;
    })();
    try { return await loading; } finally { loading = null; }
  }
  window.HisRecovery = {refreshCloud,selectAvailableSnapshot,healthCheck:()=>window.SaktiCloud.healthCheck(),getLastError:()=>lastCloudError};
  startCloudSnapshots = async function() {
    if (!window.SaktiCloud?.configured || !window.SaktiCloud.isAuthenticated()) return;
    try { await refreshCloud(); }
    catch(error) { lastCloudError=error.message; console.warn('[SAKTI] Cloud refresh failed:',error); window.SaktiCloud.status(`Cloud belum tersedia: ${error.message}. Data tersimpan tidak dihapus.`); }
  };
  // Replace the original competing upload listeners with one authoritative handler.
  function installCloudSaveApplyHandler() {
    const button = $('#applySaktiData');
    if (!button || button.dataset.cloudSaveFixed === '2') return;
    const replacement=button.cloneNode(true);
    replacement.dataset.cloudSaveFixed='2';
    button.replaceWith(replacement);
    replacement.addEventListener('click',async()=>{
      const pending=pendingSaktiImport;
      if (!pending?.dataset || saving) return;
      saving=true;replacement.disabled=true;
      const label=pending.sourceType==='accrual'?'Akrual':'SP2D';
      safeStatus(`Menyimpan ${label} ke cloud…`,'loading');
      try {
        await window.SaktiCloud.restoreSession();
        if (!window.SaktiCloud.isAuthenticated()) throw new Error('Sesi login tidak aktif. Silakan masuk kembali.');
        await window.SaktiCloud.saveSnapshot(pending.dataset,pending.filename,pending.sourceType);
        // The write is confirmed. Keep the original parsed dataset intact and reload authoritative cloud state.
        const key=snapshotKey(pending.dataset.period);
        await refreshCloud(key);
        pendingSaktiImport=null;clearPending();closeUploadModal();
        showToast(`${label} berhasil tersimpan dan dashboard diperbarui.`);
      } catch(error) {
        lastCloudError=error.message;
        console.error('[SAKTI] Save/reload failed:',error);
        savePending(pending);
        replacement.textContent='Coba simpan ulang';
        safeStatus(`Belum dapat memastikan penyimpanan cloud: ${error.message}. Data impor tetap tersedia; jangan unggah ulang sebelum memeriksa status.`,'error');
        showToast('Impor belum dikonfirmasi. Data tidak dihapus.');
      } finally {saving=false;replacement.disabled=false;}
    });
  }
  // Authentication boot must not erase cached financial data during a temporary outage.
  bootAuthentication = async function() {
    let loadingNode=$('#authLoading');
    if (!loadingNode) {loadingNode=document.createElement('p');loadingNode.id='authLoading';$('#authScreen h1')?.insertAdjacentElement('afterend',loadingNode);}
    loadingNode.textContent='Memeriksa sesi...';
    try {
      const session=await window.SaktiCloud.restoreSession();
      if(session?.user){setAuthenticatedUi(session.user);$('#loginError').hidden=true;await startCloudSnapshots();}
      else setLoggedOutUi();
    }catch(error){lastCloudError=error.message;console.warn('[Auth] Session restoration unavailable:',error);$('#loginError').textContent=error.message;$('#loginError').hidden=false;}
    finally{loadingNode.remove();}
  };
  // The login form already has its own handler; make a successful login dismiss stale errors.
  function installRecoveryAction() {
    if ($('#hisRecoveryAction')) return;
    const button=document.createElement('button');button.id='hisRecoveryAction';button.type='button';button.className='button secondary';button.textContent='Periksa koneksi / Muat ulang cloud';
    button.addEventListener('click',async()=>{button.disabled=true;try{const health=await window.SaktiCloud.healthCheck();if(!health.ok)throw new Error(health.message||`Layanan Auth HTTP ${health.status}`);if(window.SaktiCloud.isAuthenticated())await refreshCloud();else await bootAuthentication();showToast('Koneksi berhasil diperiksa.');}catch(error){lastCloudError=error.message;showToast(error.message);}finally{button.disabled=false;}});
    $('#cloudStatus')?.insertAdjacentElement('afterend',button);
  }
  installCloudSaveApplyHandler();installRecoveryAction();restorePending();
  window.addEventListener('load',()=>{installCloudSaveApplyHandler();installRecoveryAction();restorePending();});
})();