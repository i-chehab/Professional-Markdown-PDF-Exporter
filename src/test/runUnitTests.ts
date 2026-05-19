/**
 * Lightweight unit-test runner with no VS Code dependency.
 *
 * Runs via `npm test` (after `npm run compile`). It deliberately exercises
 * only the modules that are free of the `vscode` import — `OutputPathResolver`
 * and `AssetResolver` — so the suite can run in a plain Node process.
 *
 * `BrowserDetector` imports the logger (and therefore `vscode`), so the
 * `./vscodeStub` import below installs a loader hook — kept FIRST so the stub
 * is registered before `browserDetector` is pulled in — letting its pure
 * `getCandidates(...)` logic be exercised here too.
 */
import './vscodeStub';
import * as assert from 'assert';
import { pathToFileURL } from 'url';
import { AssetResolver } from '../services/assetResolver';
import { BrowserDetector } from '../services/browserDetector';
import { OutputPathResolver } from '../services/outputPathResolver';

interface TestCase {
  readonly name: string;
  readonly run: () => void;
}

const tests: TestCase[] = [];
function test(name: string, run: () => void): void {
  tests.push({ name, run });
}

// --- OutputPathResolver ------------------------------------------------------

test('OutputPathResolver: PDF is placed beside the Markdown file', () => {
  const resolver = new OutputPathResolver();
  const out = resolver.resolve('/home/user/docs/proposal.md', 'sameFolder');
  assert.strictEqual(out, '/home/user/docs/proposal.pdf');
});

test('OutputPathResolver: .markdown extension is replaced too', () => {
  const resolver = new OutputPathResolver();
  const out = resolver.resolve('/tmp/report.markdown', 'sameFolder');
  assert.strictEqual(out, '/tmp/report.pdf');
});

// --- AssetResolver -----------------------------------------------------------

test('AssetResolver: relative image becomes an absolute file:// URI', () => {
  const resolver = new AssetResolver('/home/user/docs');
  const resolved = resolver.resolveSingleSource('./assets/logo.png');
  assert.strictEqual(resolved, pathToFileURL('/home/user/docs/assets/logo.png').href);
});

test('AssetResolver: parent-relative image resolves correctly', () => {
  const resolver = new AssetResolver('/home/user/docs');
  const resolved = resolver.resolveSingleSource('../images/chart.jpg');
  assert.strictEqual(resolved, pathToFileURL('/home/user/images/chart.jpg').href);
});

test('AssetResolver: remote URLs are left unchanged', () => {
  const resolver = new AssetResolver('/home/user/docs');
  assert.strictEqual(resolver.resolveSingleSource('https://example.com/a.png'), undefined);
});

test('AssetResolver: data URIs are left unchanged', () => {
  const resolver = new AssetResolver('/home/user/docs');
  assert.strictEqual(resolver.resolveSingleSource('data:image/png;base64,AAAA'), undefined);
});

test('AssetResolver: spaces in file names are encoded', () => {
  const resolver = new AssetResolver('/home/user/docs');
  const resolved = resolver.resolveSingleSource('./my logo.png');
  assert.ok(resolved && resolved.includes('my%20logo.png'), `unexpected: ${resolved}`);
});

test('AssetResolver: rewrites src in a full <img> tag', () => {
  const resolver = new AssetResolver('/home/user/docs');
  const html = '<p><img src="./a.png" alt="x"></p>';
  const out = resolver.resolveImagePaths(html);
  assert.ok(out.includes(pathToFileURL('/home/user/docs/a.png').href), `unexpected: ${out}`);
});

// --- BrowserDetector: candidate / preference logic ---------------------------

test('BrowserDetector: Linux prefers Chrome over Edge', () => {
  const candidates = BrowserDetector.getCandidates({ platform: 'linux', env: {} });
  assert.strictEqual(candidates[0].name, 'Google Chrome');
  const firstChrome = candidates.findIndex((c) => c.name === 'Google Chrome');
  const firstEdge = candidates.findIndex((c) => c.name === 'Microsoft Edge');
  assert.ok(firstChrome >= 0 && firstEdge >= 0, 'expected both Chrome and Edge candidates');
  assert.ok(firstChrome < firstEdge, 'Chrome must be preferred over Edge');
});

test('BrowserDetector: Linux includes the documented chromium commands', () => {
  const candidates = BrowserDetector.getCandidates({ platform: 'linux', env: {} });
  const values = candidates.map((c) => c.value);
  for (const cmd of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    assert.ok(values.includes(cmd), `missing Linux candidate: ${cmd}`);
  }
});

test('BrowserDetector: macOS returns the standard .app bundle paths', () => {
  const candidates = BrowserDetector.getCandidates({ platform: 'darwin', env: {} });
  assert.strictEqual(
    candidates[0].value,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  );
  assert.ok(candidates.every((c) => !c.isCommand), 'macOS candidates must be absolute paths');
});

test('BrowserDetector: Windows honours PROGRAMFILES and prefers Chrome', () => {
  const candidates = BrowserDetector.getCandidates({
    platform: 'win32',
    env: { PROGRAMFILES: 'D:\\Apps', 'PROGRAMFILES(X86)': 'D:\\Apps86' },
  });
  assert.ok(
    candidates.some((c) => c.value.includes('D:\\Apps') && c.value.endsWith('chrome.exe')),
    'expected a Chrome path rooted at the provided PROGRAMFILES',
  );
  assert.strictEqual(candidates[0].name, 'Google Chrome');
});

test('BrowserDetector: Windows adds a LOCALAPPDATA Chrome path when set', () => {
  const withLocal = BrowserDetector.getCandidates({
    platform: 'win32',
    env: { LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local' },
  });
  assert.ok(
    withLocal.some((c) => c.value.includes('AppData\\Local') && c.value.endsWith('chrome.exe')),
    'expected a LOCALAPPDATA Chrome path',
  );
});

// --- runner ------------------------------------------------------------------

let passed = 0;
let failed = 0;
for (const tc of tests) {
  try {
    tc.run();
    passed++;
    console.log(`  ok   ${tc.name}`);
  } catch (error) {
    failed++;
    console.error(`  FAIL ${tc.name}`);
    console.error(`       ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
