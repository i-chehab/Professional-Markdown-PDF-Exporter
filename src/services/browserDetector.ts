import { execFile } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';
import { DetectedBrowser } from '../types/exportTypes';
import { isFile } from '../utils/fileUtils';
import { logger } from '../utils/logger';

const execFileAsync = promisify(execFile);

/** A candidate browser location, before existence is verified. */
interface BrowserCandidate {
  readonly name: string;
  /** Either an absolute path or a bare command resolved via PATH. */
  readonly value: string;
  /** When true, `value` is a command name to look up on PATH. */
  readonly isCommand: boolean;
}

/** Minimal view of the environment, injectable for testing. */
export interface DetectionEnv {
  readonly platform: NodeJS.Platform;
  readonly env: NodeJS.ProcessEnv;
}

/**
 * Locates a Chromium-family browser (Chrome, Chromium or Edge) installed on
 * the host system. Puppeteer drives this browser; the extension never bundles
 * or downloads one.
 *
 * Preference order: a valid user-configured path wins; otherwise Chrome, then
 * Chromium, then Edge — Chrome first because its print engine is the most
 * widely tested against the paged-media CSS this extension relies on.
 */
export class BrowserDetector {
  /**
   * Resolve a usable browser executable.
   *
   * @param userConfiguredPath Value of `professionalMarkdownPdf.browserExecutablePath`.
   * @returns The detected browser, or `undefined` when none is found.
   */
  public async detect(userConfiguredPath: string): Promise<DetectedBrowser | undefined> {
    const trimmed = userConfiguredPath.trim();
    if (trimmed.length > 0) {
      if (await isFile(trimmed)) {
        logger.info(`Using user-configured browser path: ${trimmed}`);
        return { executablePath: trimmed, name: 'Configured browser', fromUserSetting: true };
      }
      // Configured but invalid — warn, then fall back to auto-detection.
      logger.warn(`Configured browser path does not point to a file: ${trimmed}`);
    }

    const detectionEnv: DetectionEnv = { platform: process.platform, env: process.env };
    const candidates = BrowserDetector.getCandidates(detectionEnv);

    for (const candidate of candidates) {
      const resolvedPath = candidate.isCommand
        ? await this.resolveCommand(candidate.value)
        : ((await isFile(candidate.value)) ? candidate.value : undefined);

      if (resolvedPath) {
        logger.info(`Detected browser: ${candidate.name} at ${resolvedPath}`);
        return { executablePath: resolvedPath, name: candidate.name, fromUserSetting: false };
      }
    }

    logger.warn('No supported browser was found during auto-detection.');
    return undefined;
  }

  /**
   * Best-effort browser version probe. Returns the major version number, or
   * `undefined` if it cannot be determined. Never throws.
   */
  public async getMajorVersion(executablePath: string): Promise<number | undefined> {
    try {
      const { stdout } = await execFileAsync(executablePath, ['--version'], { timeout: 5000 });
      const match = stdout.match(/(\d+)\.\d+/);
      return match ? Number.parseInt(match[1], 10) : undefined;
    } catch (error) {
      logger.warn(`Could not determine browser version: ${String(error)}`);
      return undefined;
    }
  }

  /**
   * Build the ordered list of browser candidates for an environment.
   *
   * Pure and side-effect-free — exposed as `static` for unit testing across
   * simulated platforms.
   */
  public static getCandidates(detectionEnv: DetectionEnv): BrowserCandidate[] {
    switch (detectionEnv.platform) {
      case 'win32':
        return BrowserDetector.windowsCandidates(detectionEnv.env);
      case 'darwin':
        return BrowserDetector.macCandidates();
      default:
        return BrowserDetector.linuxCandidates();
    }
  }

  private static linuxCandidates(): BrowserCandidate[] {
    const commands: Array<[string, string]> = [
      ['Google Chrome', 'google-chrome'],
      ['Google Chrome', 'google-chrome-stable'],
      ['Chromium', 'chromium'],
      ['Chromium', 'chromium-browser'],
      ['Microsoft Edge', 'microsoft-edge'],
      ['Microsoft Edge', 'microsoft-edge-stable'],
    ];
    const absolute: Array<[string, string]> = [
      ['Google Chrome', '/usr/bin/google-chrome'],
      ['Google Chrome', '/opt/google/chrome/chrome'],
      ['Chromium', '/usr/bin/chromium'],
      ['Chromium', '/usr/bin/chromium-browser'],
      ['Chromium', '/snap/bin/chromium'],
      ['Microsoft Edge', '/usr/bin/microsoft-edge'],
      ['Microsoft Edge', '/opt/microsoft/msedge/msedge'],
    ];
    return [
      ...commands.map(([name, value]) => ({ name, value, isCommand: true })),
      ...absolute.map(([name, value]) => ({ name, value, isCommand: false })),
    ];
  }

  private static macCandidates(): BrowserCandidate[] {
    const paths: Array<[string, string]> = [
      ['Google Chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
      ['Chromium', '/Applications/Chromium.app/Contents/MacOS/Chromium'],
      ['Microsoft Edge', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
    ];
    return paths.map(([name, value]) => ({ name, value, isCommand: false }));
  }

  private static windowsCandidates(env: NodeJS.ProcessEnv): BrowserCandidate[] {
    const programFiles = env['PROGRAMFILES'] ?? 'C:\\Program Files';
    const programFilesX86 = env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)';
    const localAppData = env['LOCALAPPDATA'];

    const roots: Array<[string, string]> = [
      ['Google Chrome', path.join(programFiles, 'Google\\Chrome\\Application\\chrome.exe')],
      ['Google Chrome', path.join(programFilesX86, 'Google\\Chrome\\Application\\chrome.exe')],
      ['Microsoft Edge', path.join(programFiles, 'Microsoft\\Edge\\Application\\msedge.exe')],
      ['Microsoft Edge', path.join(programFilesX86, 'Microsoft\\Edge\\Application\\msedge.exe')],
    ];

    if (localAppData) {
      roots.splice(2, 0, [
        'Google Chrome',
        path.join(localAppData, 'Google\\Chrome\\Application\\chrome.exe'),
      ]);
      roots.push([
        'Microsoft Edge',
        path.join(localAppData, 'Microsoft\\Edge\\Application\\msedge.exe'),
      ]);
    }

    return roots.map(([name, value]) => ({ name, value, isCommand: false }));
  }

  /** Resolve a bare command name to an absolute path via the OS resolver. */
  private async resolveCommand(command: string): Promise<string | undefined> {
    try {
      // `which` on POSIX; this branch is never reached on Windows where all
      // candidates are absolute paths.
      const { stdout } = await execFileAsync('which', [command], { timeout: 5000 });
      const resolved = stdout.split(/\r?\n/)[0].trim();
      return resolved.length > 0 && (await isFile(resolved)) ? resolved : undefined;
    } catch {
      return undefined;
    }
  }
}
