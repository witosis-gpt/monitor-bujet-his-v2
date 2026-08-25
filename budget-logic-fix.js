(() => {
  const n = value => Number(value) || 0;
  const correctedRemaining = values => n(values.pagu) - n(values.potential ?? values.sp2d);
  const rowMetric = row => ({
    pagu: n(row.pagu),
    sp2d: n(row.cumulative),
    accrual: n(row.accrualOutstanding),
    potential: n(row.potential ?? row.cumulative),
    remaining: n(row.pagu) - n(row.potential ?? row.cumulative),
  });

  // Core rule: Sisa Anggaran = Pagu - Potensi Realisasi (SP2D + Akrual Berjalan).
  // Keep % SP2D as the official/definitive absorption metric.
  module2AddTotals = function module2AddTotalsCorrected(target, values) {
    target.pagu += n(values.pagu);
    target.sp2d += n(values.sp2d);
    target.accrual += n(values.accrual);
    target.potential += n(values.potential);
    target.remaining += correctedRemaining(values);
  };

  potentialComposition = function potentialCompositionCorrected() {
    const rows = activeSnapshot?.pairedRows || [];
    const scopes = { deputy: rows };
    Object.keys(directorateCatalog).forEach(id => {
      scopes[id] = rows.filter(row => row.directorateCode === id);
    });
    return Object.fromEntries(Object.entries(scopes).map(([scope, scopeRows]) => [scope, {
      categories: categoryDefinitions.map(definition => {
        const accounts = scopeRows.filter(row => accountCategory(row) === definition.category);
        return {
          category: definition.category,
          color: definition.color,
          pagu: accounts.reduce((sum, row) => sum + n(row.pagu), 0),
          realization: accounts.reduce((sum, row) => sum + n(row.cumulative), 0),
          potential: accounts.reduce((sum, row) => sum + n(row.potential ?? row.cumulative), 0),
          remaining: accounts.reduce((sum, row) => sum + n(row.pagu) - n(row.potential ?? row.cumulative), 0),
          accounts,
        };
      }),
    }]));
  };

  groupDrillAccounts = function groupDrillAccountsCorrected(accounts) {
    return Object.values(accounts.reduce((groups, row) => {
      const key = `${row.accountCode}::${row.accountName}`;
      const group = groups[key] || {
        accountCode: row.accountCode,
        accountName: row.accountName,
        pagu: 0,
        cumulative: 0,
        accrualOutstanding: 0,
        potential: 0,
        remaining: 0,
        roCount: 0,
      };
      const metric = rowMetric(row);
      group.pagu += metric.pagu;
      group.cumulative += metric.sp2d;
      group.accrualOutstanding += metric.accrual;
      group.potential += metric.potential;
      group.remaining += metric.remaining;
      group.roCount++;
      groups[key] = group;
      return groups;
    }, {}));
  };

  reportAddAccountRemainingSlides = function reportAddAccountRemainingSlidesCorrected(pptx, scope, sources) {
    const scopes = scope === 'all' ? ['all', 'ED.7059', 'ED.7060', 'ED.7904', 'ED.6784', 'ED.7905'] : [scope];
    const headers = ['NO', 'AKUN', 'URAIAN', 'PAGU', 'SP2D', 'AKRUAL', 'POTENSI', 'SISA', '% SISA'];
    const widths = [.32, .65, 2.55, 1.22, 1.22, 1.12, 1.22, 1.22, .72];
    scopes.forEach(accountScope => {
      const accounts = reportAccountGroups(accountScope);
      const totals = reportTotals(reportRows(accountScope));
      if (!accounts.length) return;
      const label = accountScope === 'all' ? 'Deputi HIS' : `${accountScope} — ${reportScopeName(accountScope)}`;
      const chunks = [];
      for (let index = 0; index < accounts.length; index += 13) chunks.push(accounts.slice(index, index + 13));
      chunks.forEach((chunk, pageIndex) => {
        const slide = pptx.addSlide();
        const suffix = pageIndex ? ` (Lanjutan ${pageIndex + 1})` : '';
        reportHeader(pptx, slide, `Sisa Anggaran per Akun — ${label}${suffix}`, `Periode s.d. ${reportPeriodLabel()}`);
        const rows = chunk.map((account, index) => [
          String(pageIndex * 13 + index + 1),
          account.code,
          account.name,
          reportCurrency(account.totals.pagu),
          reportCurrency(account.totals.sp2d),
          reportCurrency(account.totals.accrual),
          reportCurrency(account.totals.potential),
          reportCurrency(account.totals.remaining),
          reportPercent(account.totals.remaining, account.totals.pagu),
        ]);
        if (pageIndex === chunks.length - 1) {
          rows.push([
            '', `TOTAL ${accountScope === 'all' ? 'DEPUTI HIS' : accountScope}`, '',
            reportCurrency(totals.pagu), reportCurrency(totals.sp2d), reportCurrency(totals.accrual),
            reportCurrency(totals.potential), reportCurrency(totals.remaining), reportPercent(totals.remaining, totals.pagu),
          ]);
        }
        reportAddTable(slide, rows, headers, widths, 1.22, sources);
      });
    });
  };

  generatePowerPointReport = async function generatePowerPointReportCorrected() {
    const status = document.querySelector('#reportStatus');
    const scope = document.querySelector('#reportScopeSelect').value;
    const library = window.PptxGenJS || window.pptxgen;
    if (!library) { setReportStatus('Library PowerPoint belum termuat.', 'error'); return; }
    if (!activeSnapshot?.pairedRows?.length) { setReportStatus('Belum ada data SAKTI untuk laporan.', 'error'); return; }

    try {
      console.log('[PPT] start generation (corrected remaining logic)');
      setReportStatus('Menyiapkan PowerPoint...');
      const groups = reportGroups(scope);
      const totals = reportTotals(reportRows(scope));
      const sources = reportSource();

      status.textContent = 'Menyiapkan data…';
      await new Promise(resolve => setTimeout(resolve, 80));

      const pptx = new library();
      reportPptRuntime = pptx;
      pptx.layout = 'LAYOUT_WIDE';
      pptx.author = 'Dashboard Keuangan Deputi HIS';
      pptx.subject = 'Laporan realisasi anggaran';
      pptx.title = `Laporan Keuangan ${reportScopeName(scope)}`;
      pptx.company = 'Kementerian Investasi dan Hilirisasi / BKPM';
      pptx.lang = 'id-ID';

      const cover = pptx.addSlide();
      cover.background = { color: '0B3654' };
      cover.addText('LAPORAN PROGRESS PELAKSANAAN KEGIATAN\nDAN PENYERAPAN ANGGARAN', { x: .7, y: 1.3, w: 8.3, h: 1.42, fontFace: 'Aptos Display', fontSize: 27, bold: true, color: 'FFFFFF', margin: 0 });
      cover.addText(`s.d. ${reportPeriodLabel()}`, { x: .72, y: 3.02, w: 6, h: .32, fontFace: 'Aptos', fontSize: 15, color: 'B9E3D0', margin: 0 });
      cover.addText('PPK SATKER DEPUTI BIDANG\nHILIRISASI INVESTASI STRATEGIS', { x: .72, y: 4.02, w: 6.8, h: .75, fontFace: 'Aptos Display', fontSize: 18, bold: true, color: 'FFFFFF', margin: 0 });
      cover.addText(`Dibuat ${new Date().toLocaleDateString('id-ID')}`, { x: .72, y: 5.05, w: 5, h: .25, fontFace: 'Aptos', fontSize: 10, color: 'B9E3D0', margin: 0 });

      status.textContent = 'Membuat tabel realisasi…';
      const headers = scope === 'all'
        ? ['NO', 'ESELON II', 'PAGU', 'SP2D', '% SP2D', 'AKRUAL\nBERJALAN', 'POTENSI\nREALISASI', '% POTENSI', 'SISA\nANGGARAN', '% SISA']
        : ['NO', 'RO / KOMODITAS', 'PAGU', 'SP2D', '% SP2D', 'AKRUAL', 'POTENSI', '% POTENSI', 'SISA', '% SISA'];
      const widths = [.32, 2.35, 1.27, 1.27, .62, 1.15, 1.28, .66, 1.28, .62];
      const dataRows = reportTableRows(groups, scope);
      const subtotal = ['', 'SUB TOTAL', reportCurrency(totals.pagu), reportCurrency(totals.sp2d), reportPercent(totals.sp2d, totals.pagu), reportCurrency(totals.accrual), reportCurrency(totals.potential), reportPercent(totals.potential, totals.pagu), reportCurrency(totals.remaining), reportPercent(totals.remaining, totals.pagu)];
      const chunks = [];
      for (let i = 0; i < dataRows.length; i += 13) chunks.push(dataRows.slice(i, i + 13));
      chunks.forEach((chunk, index) => {
        const slide = pptx.addSlide();
        reportHeader(pptx, slide, index ? 'Realisasi Anggaran dan Potensi Realisasi — Lanjutan' : 'Realisasi Anggaran dan Potensi Realisasi', `Periode s.d. ${reportPeriodLabel()} · ${reportScopeName(scope)}`);
        reportAddTable(slide, [...chunk, ...(index === chunks.length - 1 ? [subtotal] : [])], headers, widths, 1.22, sources);
      });

      status.textContent = 'Membuat tabel sisa anggaran…';
      const remainingGroups = [...groups].sort((a, b) => b.totals.remaining - a.totals.remaining);
      const remainingRows = reportTableRows(remainingGroups, scope);
      const remainingHeaders = [headers[0], headers[1], 'PAGU', 'SP2D', '% SP2D', 'AKRUAL', 'POTENSI', '% POTENSI', 'SISA', '% SISA'];
      const rChunks = [];
      for (let i = 0; i < remainingRows.length; i += 13) rChunks.push(remainingRows.slice(i, i + 13));
      rChunks.forEach((chunk, index) => {
        const slide = pptx.addSlide();
        reportHeader(pptx, slide, index ? 'Rincian Sisa Anggaran — Lanjutan' : 'Rincian Sisa Anggaran', `${reportScopeName(scope)} · urut sisa anggaran terbesar`);
        reportAddTable(slide, [...chunk, ...(index === rChunks.length - 1 ? [subtotal] : [])], remainingHeaders, widths, 1.22, sources);
      });

      if (document.querySelector('#reportIncludeAccountRemaining').checked) {
        reportAddAccountRemainingSlides(pptx, scope, sources);
      }

      if (document.querySelector('#reportIncludeAccounts').checked) {
        status.textContent = 'Menyiapkan rincian akun…';
        const accounts = reportRows(scope).map(row => ({ row, total: rowMetric(row) })).sort((a, b) => b.total.remaining - a.total.remaining);
        for (let i = 0; i < accounts.length; i += 15) {
          const slide = pptx.addSlide();
          reportHeader(pptx, slide, i ? 'Rincian Akun — Lanjutan' : 'Rincian Akun dengan Sisa Anggaran Terbesar', reportScopeName(scope));
          const rows = accounts.slice(i, i + 15).map(item => [
            item.row.accountCode,
            item.row.accountName,
            item.row.directorateName || directorateCatalog[item.row.directorateCode],
            item.row.roName || item.row.commodity || '-',
            reportCurrency(item.total.pagu),
            reportCurrency(item.total.sp2d),
            reportCurrency(item.total.accrual),
            reportCurrency(item.total.potential),
            reportCurrency(item.total.remaining),
          ]);
          reportAddTable(slide, rows, ['AKUN', 'URAIAN', 'DIREKTORAT', 'RO / KOMODITAS', 'PAGU', 'SP2D', 'AKRUAL', 'POTENSI', 'SISA'], [.65, 2.1, 1.9, 1.85, 1.18, 1.18, 1.05, 1.18, 1.18], 1.22, sources);
        }
      }

      if (document.querySelector('#reportIncludeVisual').checked) {
        const slide = pptx.addSlide();
        reportHeader(pptx, slide, 'Ringkasan Visual', `${reportScopeName(scope)} · ${reportPeriodLabel()}`);
        const sp2dPct = totals.pagu ? totals.sp2d / totals.pagu * 100 : 0;
        const potentialPct = totals.pagu ? totals.potential / totals.pagu * 100 : 0;
        slide.addText(fmtPct(sp2dPct), { x: .65, y: 1.55, w: 2.5, h: .6, fontFace: 'Aptos Display', fontSize: 32, bold: true, color: '0B3654', margin: 0 });
        slide.addText('Serapan SP2D', { x: .67, y: 2.15, w: 2.5, h: .25, fontFace: 'Aptos', fontSize: 12, color: '617784', margin: 0 });
        slide.addText(fmtPct(potentialPct), { x: 3.45, y: 1.55, w: 2.5, h: .6, fontFace: 'Aptos Display', fontSize: 32, bold: true, color: '17795C', margin: 0 });
        slide.addText('Potensi Realisasi', { x: 3.47, y: 2.15, w: 2.5, h: .25, fontFace: 'Aptos', fontSize: 12, color: '617784', margin: 0 });
        slide.addShape(getPptShape(pptx, 'rect'), { x: .7, y: 2.7, w: 10.8, h: .34, fill: { color: 'E3ECEF' }, line: { color: 'E3ECEF' } });
        slide.addShape(getPptShape(pptx, 'rect'), { x: .7, y: 2.7, w: 10.8 * Math.min(potentialPct, 100) / 100, h: .34, fill: { color: '17795C' }, line: { color: '17795C' } });
        slide.addText(`${reportCurrency(totals.potential)} potensi dari ${reportCurrency(totals.pagu)} · sisa ${reportCurrency(totals.remaining)}`, { x: .7, y: 3.25, w: 9.5, h: .25, fontFace: 'Aptos', fontSize: 14, color: '1D3443', margin: 0 });
        reportFooter(slide, sources);
      }

      const closing = pptx.addSlide();
      closing.background = { color: '0B3654' };
      closing.addShape(getPptShape(pptx, 'rect'), { x: 0, y: 5.85, w: 13.333, h: 1.65, fill: { color: '17795C' }, line: { color: '17795C' } });
      closing.addText('Terima Kasih', { x: .7, y: 2.58, w: 6.6, h: .7, fontFace: 'Aptos Display', fontSize: 34, bold: true, color: 'FFFFFF', margin: 0 });
      closing.addText('Kementerian Investasi dan Hilirisasi/BKPM', { x: .72, y: 3.4, w: 7.5, h: .28, fontFace: 'Aptos', fontSize: 14, color: 'B9E3D0', margin: 0 });

      await createReportBlob(pptx, reportFilename(scope));
      setReportStatus('PowerPoint berhasil dibuat.', 'success');
    } catch (error) {
      console.error('[PPT] generation failed', error);
      setReportStatus(`Gagal membuat PowerPoint: ${error.message || error}`, 'error');
      document.querySelector('#reportResult').hidden = true;
    }
  };

  console.info('[Budget Logic] corrected: Sisa = Pagu - Potensi (SP2D + Akrual)');
})();
