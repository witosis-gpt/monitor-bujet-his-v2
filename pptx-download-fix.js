/* Mobile/tablet PPTX download compatibility patch. */
createReportBlob = async function (pptx, filename) {
  console.log('[PPT] slides created');

  const rawBlob = await pptx.write({ outputType: 'blob' });
  if (!(rawBlob instanceof Blob) || !rawBlob.size) {
    throw new Error('Blob PowerPoint tidak valid.');
  }

  const pptxBlob = new Blob([rawBlob], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  });

  if (reportPptUrl) URL.revokeObjectURL(reportPptUrl);

  reportPptBlob = pptxBlob;
  const requestedName = String(filename || 'Laporan_Keuangan_Deputi_HIS.pptx');
  reportPptFilename = requestedName.toLowerCase().endsWith('.pptx')
    ? requestedName
    : `${requestedName}.pptx`;
  reportPptUrl = URL.createObjectURL(pptxBlob);

  console.log('[PPT] blob created', {
    filename: reportPptFilename,
    type: pptxBlob.type,
    size: pptxBlob.size
  });

  showReportResult(reportPptFilename);
};

downloadReportPowerPoint = function () {
  if (!reportPptBlob) {
    setReportStatus('File PowerPoint belum siap diunduh.', 'error');
    return;
  }

  if (!reportPptUrl) reportPptUrl = URL.createObjectURL(reportPptBlob);
  const downloadUrl = reportPptUrl;
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = reportPptFilename;

  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  // Mobile/tablet browsers may still be consuming the object URL immediately
  // after click, so do not revoke it in the same event loop tick.
  setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
    if (reportPptUrl === downloadUrl) reportPptUrl = null;
  }, 5000);

  console.log('[PPT] download ready', {
    filename: reportPptFilename,
    type: reportPptBlob.type,
    size: reportPptBlob.size
  });
  setReportStatus('Unduhan PowerPoint dimulai.', 'success');
};
