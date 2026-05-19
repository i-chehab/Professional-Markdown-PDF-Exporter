/**
 * End-to-end smoke test of the export pipeline WITHOUT the VS Code host.
 *
 * Exercises the real compiled services (markdown render -> asset resolve ->
 * HTML build) and the real puppeteer-core PDF render against a system browser,
 * proving the pipeline produces genuine PDFs. Run after `npm run compile`:
 *
 *   node scripts/verify-export.js
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const puppeteer = require('puppeteer-core');

const { MarkdownRenderer } = require('../out/services/markdownRenderer');
const { AssetResolver } = require('../out/services/assetResolver');
const { HtmlBuilder } = require('../out/services/htmlBuilder');
const { PRESETS } = require('../out/types/exportTypes');

const projectRoot = path.join(__dirname, '..');

async function findBrowser() {
  const candidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  throw new Error('No browser found for verification.');
}

async function exportOne(samplePath, preset) {
  const renderer = new MarkdownRenderer();
  const htmlBuilder = new HtmlBuilder(projectRoot);

  const markdown = fs.readFileSync(samplePath, 'utf8');
  const body = renderer.render(markdown);
  const resolvedBody = new AssetResolver(path.dirname(samplePath)).resolveImagePaths(body);
  const title =
    renderer.extractTitleFromHtml(resolvedBody) ??
    path.basename(samplePath, path.extname(samplePath));

  const html = await htmlBuilder.build({
    preset: PRESETS[preset],
    bodyHtml: resolvedBody,
    title,
  });

  const tmpHtml = path.join(os.tmpdir(), `verify-${preset}-${Date.now()}.html`);
  const outPdf = path.join(os.tmpdir(), `verify-${preset}.pdf`);
  fs.writeFileSync(tmpHtml, html, 'utf8');

  const browser = await puppeteer.launch({
    executablePath: await findBrowser(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(tmpHtml).href, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: outPdf,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await browser.close();
    fs.unlinkSync(tmpHtml);
  }

  const size = fs.statSync(outPdf).size;
  const header = fs.readFileSync(outPdf).subarray(0, 5).toString('latin1');
  if (header !== '%PDF-') {
    throw new Error(`${outPdf} is not a valid PDF (header: ${header})`);
  }
  console.log(`  ok   ${preset.padEnd(8)} -> ${outPdf} (${size} bytes, title: "${title}")`);
}

(async () => {
  const samples = path.join(projectRoot, 'test', 'sample-documents');
  await exportOne(path.join(samples, 'english-sample.md'), 'english');
  await exportOne(path.join(samples, 'arabic-sample.md'), 'arabic');
  console.log('\nPipeline verification passed.');
})().catch((err) => {
  console.error('Verification FAILED:', err);
  process.exitCode = 1;
});
