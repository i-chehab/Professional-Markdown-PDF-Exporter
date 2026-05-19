/**
 * Installs a minimal `vscode` module stub for the plain-Node unit-test runner.
 *
 * Some modules (e.g. `browserDetector`, via `logger`) import `vscode`, which
 * only exists inside the Extension Host. Importing this file FIRST registers
 * a loader hook so those imports resolve to a harmless stub, letting their
 * pure logic be unit-tested outside VS Code.
 */
// `import = require` yields the real CommonJS `module` export (which exposes
// the internal `_load` hook) rather than a frozen ES-namespace object.
import NodeModule = require('module');

/** The subset of `vscode` the non-UI code paths touch under test. */
const vscodeStub = {
  window: {
    createOutputChannel: () => ({
      appendLine: (): void => undefined,
      show: (): void => undefined,
      dispose: (): void => undefined,
    }),
  },
};

interface ModuleLoader {
  _load(request: string, parent: unknown, isMain: boolean): unknown;
}

const loader = NodeModule as unknown as ModuleLoader;
const originalLoad = loader._load.bind(loader);

loader._load = (request: string, parent: unknown, isMain: boolean): unknown => {
  if (request === 'vscode') {
    return vscodeStub;
  }
  return originalLoad(request, parent, isMain);
};
