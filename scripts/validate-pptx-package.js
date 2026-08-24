const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

function loadBrowserBundle(file) {
  const sandbox = { console, setTimeout, clearTimeout, Blob, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, navigator: { userAgent: 'node' } };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  return sandbox;
}

function normalizePartPath(partPath) {
  const normalized = [];
  String(partPath || '').replace(/\\/g, '/').split('/').forEach(segment => {
    if (!segment || segment === '.') return;
    if (segment === '..') normalized.pop(); else normalized.push(segment);
  });
  return normalized.join('/');
}

function relationshipSourcePart(relationshipPart) {
  if (relationshipPart === '_rels/.rels') return '';
  const marker = '/_rels/';
  const index = relationshipPart.lastIndexOf(marker);
  if (index < 0) return '';
  return normalizePartPath(`${relationshipPart.slice(0, index)}/${relationshipPart.slice(index + marker.length).replace(/\.rels$/i, '')}`);
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'));
  return match ? match[1] : '';
}

async function validatePptxPackage(buffer, JSZip) {
  const zip = await JSZip.loadAsync(buffer);
  const parts = new Set(Object.keys(zip.files).filter(name => !zip.files[name].dir).map(normalizePartPath));
  const errors = [];
  const contentTypes = await zip.file('[Content_Types].xml').async('text');
  for (const tag of contentTypes.match(/<Override\b[^>]*>/gi) || []) {
    const partName = attr(tag, 'PartName');
    if (partName && !parts.has(normalizePartPath(partName))) errors.push(`Missing Override part: ${partName}`);
  }
  for (const relationshipPart of [...parts].filter(part => part.endsWith('.rels'))) {
    const relationships = await zip.file(relationshipPart).async('text');
    const sourcePart = relationshipSourcePart(relationshipPart);
    const sourceDirectory = sourcePart.includes('/') ? sourcePart.slice(0, sourcePart.lastIndexOf('/')) : '';
    for (const tag of relationships.match(/<Relationship\b[^>]*>/gi) || []) {
      const target = attr(tag, 'Target');
      if (!target || /^external$/i.test(attr(tag, 'TargetMode'))) continue;
      const targetPart = target.startsWith('/') ? normalizePartPath(target) : normalizePartPath(`${sourceDirectory}/${target}`);
      if (!parts.has(targetPart)) errors.push(`Dangling relationship ${relationshipPart} -> ${target}`);
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return { partCount: parts.size };
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const sandbox = loadBrowserBundle(path.join(root, 'vendor', 'pptxgen.bundle.js'));
  const zipSandbox = loadBrowserBundle(path.join(root, 'vendor', 'jszip.min.js'));
  const pptx = new sandbox.PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  const sampleRows = [
    ['Direktorat', 'Pagu', 'SP2D', 'Sisa'],
    ['Mineral dan Batubara', 'Rp629.710.000', 'Rp416.490.000', 'Rp213.220.000'],
    ['Perikanan dan Kelautan', 'Rp379.440.000', 'Rp127.130.000', 'Rp252.310.000']
  ];
  for (let index = 0; index < 4; index += 1) {
    const slide = pptx.addSlide();
    slide.background = { color: index === 0 ? '0B3654' : 'F7FAFB' };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: .25, fill: { color: '0B3654' }, line: { color: '0B3654' } });
    slide.addText(index === 0 ? 'Laporan Keuangan Deputi HIS' : `Realisasi Anggaran ${index}`, { x: .5, y: .5, w: 8, h: .35, fontSize: 20, bold: true, color: index === 0 ? 'FFFFFF' : '0B3654' });
    if (index > 0) slide.addTable(sampleRows, { x: .5, y: 1.2, w: 8.7, border: { type: 'solid', color: 'B9C8D0', pt: .45 }, fontSize: 9, margin: .05 });
  }
  const data = await pptx.write({ outputType: 'arraybuffer' });
  const buffer = Buffer.from(data);
  const result = await validatePptxPackage(buffer, zipSandbox.JSZip);
  const output = process.argv[2] || path.join(os.tmpdir(), 'pptx-package-validation-sample.pptx');
  fs.writeFileSync(output, buffer);
  console.log(`PPTX package valid: ${result.partCount} parts`);
  console.log(`Sample: ${output}`);
}

main().catch(error => { console.error(`PPTX package validation failed:\n${error.message}`); process.exitCode = 1; });
