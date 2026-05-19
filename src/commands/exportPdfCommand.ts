import * as path from 'path';
import * as vscode from 'vscode';
import { AssetResolver } from '../services/assetResolver';
import { BrowserDetector } from '../services/browserDetector';
import { HtmlBuilder } from '../services/htmlBuilder';
import { MarkdownRenderer } from '../services/markdownRenderer';
import { OutputPathResolver } from '../services/outputPathResolver';
import { PdfExporter } from '../services/pdfExporter';
import {
  ExportRequest,
  ExtensionSettings,
  OutputMode,
  PdfPreset,
  PRESETS,
} from '../types/exportTypes';
import {
  buildTempHtmlPath,
  deleteFileQuietly,
  isMarkdownFile,
  pathExists,
  readTextFile,
  writeTextFile,
} from '../utils/fileUtils';
import { logger } from '../utils/logger';
import { showError, showExportSuccess, showInfo, showWarning } from '../utils/notifications';

/** Minimum Chromium major version known to render paged-media margin boxes well. */
const RECOMMENDED_CHROME_MAJOR = 100;

/**
 * Orchestrates the end-to-end export workflow and is the single home for all
 * user-facing command behaviour. One instance is created at activation and
 * shared by the three registered commands.
 */
export class ExportPdfCommand {
  private readonly renderer = new MarkdownRenderer();
  private readonly htmlBuilder: HtmlBuilder;
  private readonly outputPathResolver = new OutputPathResolver();
  private readonly browserDetector = new BrowserDetector();
  private readonly pdfExporter = new PdfExporter();

  constructor(extensionPath: string) {
    this.htmlBuilder = new HtmlBuilder(extensionPath);
  }

  /**
   * `professionalMarkdownPdf.exportPdf` — resolve the target file, prompt for
   * a preset, then export.
   */
  public async runWithChooser(resourceUri?: vscode.Uri): Promise<void> {
    const markdownPath = await this.resolveMarkdownPath(resourceUri);
    if (!markdownPath) {
      return;
    }
    const preset = await this.promptForPreset();
    if (!preset) {
      return;
    }
    await this.export({ markdownPath, preset });
  }

  /**
   * `professionalMarkdownPdf.exportArabicPdf` /
   * `professionalMarkdownPdf.exportEnglishPdf` — export directly with a fixed
   * preset, skipping the chooser.
   */
  public async runWithPreset(preset: PdfPreset, resourceUri?: vscode.Uri): Promise<void> {
    const markdownPath = await this.resolveMarkdownPath(resourceUri);
    if (!markdownPath) {
      return;
    }
    await this.export({ markdownPath, preset });
  }

  // ---------------------------------------------------------------------------
  // Target-file resolution
  // ---------------------------------------------------------------------------

  /**
   * Determine which Markdown file to export.
   *
   * When invoked from the Explorer context menu a `resourceUri` is supplied;
   * otherwise the active editor is used. Validates the file type, rejects
   * untitled documents, and saves unsaved changes before returning.
   *
   * @returns The absolute Markdown path, or `undefined` if the user should be
   *          stopped (a message has already been shown in that case).
   */
  private async resolveMarkdownPath(resourceUri?: vscode.Uri): Promise<string | undefined> {
    if (resourceUri) {
      return this.resolveFromUri(resourceUri);
    }
    return this.resolveFromActiveEditor();
  }

  /** Resolve and validate a file supplied by the Explorer context menu. */
  private async resolveFromUri(uri: vscode.Uri): Promise<string | undefined> {
    if (uri.scheme !== 'file') {
      showWarning('Only Markdown files can be exported to PDF.');
      return undefined;
    }
    const fsPath = uri.fsPath;
    if (!isMarkdownFile(fsPath)) {
      showWarning('Only Markdown files can be exported to PDF.');
      return undefined;
    }
    // If the file is open with unsaved edits, persist them first so the export
    // reflects what the user sees.
    const openDoc = vscode.workspace.textDocuments.find(
      (doc) => doc.uri.scheme === 'file' && doc.uri.fsPath === fsPath,
    );
    if (openDoc && openDoc.isDirty && !(await this.saveDocument(openDoc))) {
      return undefined;
    }
    if (!(await pathExists(fsPath))) {
      showError(`File not found: ${fsPath}`);
      return undefined;
    }
    return fsPath;
  }

  /** Resolve and validate the active editor's document. */
  private async resolveFromActiveEditor(): Promise<string | undefined> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      showWarning('No Markdown file is open. Open a Markdown file and try again.');
      return undefined;
    }
    const doc = editor.document;
    if (doc.isUntitled) {
      showWarning('Please save the Markdown file before exporting to PDF.');
      return undefined;
    }
    if (doc.uri.scheme !== 'file' || !isMarkdownFile(doc.uri.fsPath)) {
      showWarning('Only Markdown files can be exported to PDF.');
      return undefined;
    }
    if (doc.isDirty && !(await this.saveDocument(doc))) {
      return undefined;
    }
    return doc.uri.fsPath;
  }

  /** Save a document, reporting failure. Returns `true` on success. */
  private async saveDocument(doc: vscode.TextDocument): Promise<boolean> {
    const saved = await doc.save();
    if (!saved) {
      showError('Could not save the Markdown file before exporting. Export cancelled.');
      return false;
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Preset selection
  // ---------------------------------------------------------------------------

  /** Show the Arabic / English Quick Pick. */
  private async promptForPreset(): Promise<PdfPreset | undefined> {
    interface PresetItem extends vscode.QuickPickItem {
      preset: PdfPreset;
    }
    const items: PresetItem[] = [
      {
        label: '$(globe) English Professional PDF',
        description: 'LTR',
        detail: 'Left-to-right layout with English-friendly typography.',
        preset: 'english',
      },
      {
        label: '$(globe) Arabic Professional PDF',
        description: 'RTL',
        detail: 'Right-to-left layout with Arabic-friendly typography.',
        preset: 'arabic',
      },
    ];
    const choice = await vscode.window.showQuickPick(items, {
      placeHolder: 'Choose a PDF preset',
      ignoreFocusOut: true,
    });
    return choice?.preset;
  }

  // ---------------------------------------------------------------------------
  // Export pipeline
  // ---------------------------------------------------------------------------

  /** Run the full export pipeline behind a progress notification. */
  private async export(request: ExportRequest): Promise<void> {
    const settings = this.readSettings();
    const outputPdfPath = this.outputPathResolver.resolve(request.markdownPath, settings.outputMode);

    // Confirm overwrite before doing any work.
    if (await pathExists(outputPdfPath)) {
      if (!(await this.confirmOverwrite(outputPdfPath))) {
        logger.info('Export cancelled by user (PDF already exists).');
        return;
      }
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Exporting Markdown to PDF...',
        cancellable: false,
      },
      async (progress) => {
        try {
          await this.runPipeline(request, outputPdfPath, settings, progress);
        } catch (error) {
          showError(`Failed to export PDF: ${describeError(error)}`, error);
        }
      },
    );
  }

  /** The actual work, separated so the progress wrapper stays readable. */
  private async runPipeline(
    request: ExportRequest,
    outputPdfPath: string,
    settings: ExtensionSettings,
    progress: vscode.Progress<{ message?: string; increment?: number }>,
  ): Promise<void> {
    const descriptor = PRESETS[request.preset];
    logger.info('--- Export started ---');
    logger.info(`Source file: ${request.markdownPath}`);
    logger.info(`Preset: ${request.preset}`);
    logger.info(`Output PDF: ${outputPdfPath}`);

    // 1. Detect a usable browser before doing render work.
    progress.report({ message: 'Detecting browser...' });
    const browser = await this.browserDetector.detect(settings.browserExecutablePath);
    if (!browser) {
      showError(
        'No supported browser was found. Install Chrome, Chromium, or Edge, ' +
          'or configure a browser executable path in Settings.',
      );
      return;
    }
    logger.info(`Resolved browser: ${browser.name} (${browser.executablePath})`);
    await this.warnIfBrowserOutdated(browser.executablePath);

    // 2. Read + render Markdown.
    progress.report({ message: 'Rendering Markdown...' });
    const markdown = await readTextFile(request.markdownPath);
    const renderedBody = this.renderer.render(markdown);

    // 3. Resolve local image paths relative to the Markdown file.
    const markdownDir = path.dirname(request.markdownPath);
    const resolvedBody = new AssetResolver(markdownDir).resolveImagePaths(renderedBody);

    // 4. Build the complete HTML document.
    progress.report({ message: 'Building document...' });
    const title =
      this.renderer.extractTitleFromHtml(resolvedBody) ??
      path.basename(request.markdownPath, path.extname(request.markdownPath));
    const html = await this.htmlBuilder.build({
      preset: descriptor,
      bodyHtml: resolvedBody,
      title,
    });

    // 5. Write HTML to a temp file, render to PDF, always clean up.
    const tempHtmlPath = buildTempHtmlPath(title);
    logger.info(`Temporary HTML: ${tempHtmlPath}`);
    try {
      await writeTextFile(tempHtmlPath, html);

      progress.report({ message: 'Generating PDF...' });
      await this.pdfExporter.export({
        executablePath: browser.executablePath,
        htmlPath: tempHtmlPath,
        outputPdfPath,
      });
    } finally {
      await deleteFileQuietly(tempHtmlPath);
    }

    logger.info('--- Export finished successfully ---');
    await this.reportSuccess(outputPdfPath, settings.openAfterExport);
  }

  /** Probe the browser version and warn (non-blocking) if it looks outdated. */
  private async warnIfBrowserOutdated(executablePath: string): Promise<void> {
    const major = await this.browserDetector.getMajorVersion(executablePath);
    if (major !== undefined && major < RECOMMENDED_CHROME_MAJOR) {
      const message =
        `The detected browser (major version ${major}) is older than recommended. ` +
        'Page numbers and print layout may not render perfectly. ' +
        'Updating Chrome, Chromium, or Edge is advised.';
      logger.warn(message);
      showWarning(message);
    }
  }

  /** Modal Overwrite / Cancel prompt. Returns `true` when overwrite is chosen. */
  private async confirmOverwrite(outputPdfPath: string): Promise<boolean> {
    const fileName = path.basename(outputPdfPath);
    const choice = await vscode.window.showWarningMessage(
      `"${fileName}" already exists. Overwrite it?`,
      { modal: true },
      'Overwrite',
    );
    return choice === 'Overwrite';
  }

  /** Show the success message and open the PDF when appropriate. */
  private async reportSuccess(outputPdfPath: string, openAfterExport: boolean): Promise<void> {
    const fileName = path.basename(outputPdfPath);
    if (openAfterExport) {
      showInfo(`PDF exported successfully: ${fileName}`);
      await this.openPdf(outputPdfPath);
    } else {
      const wantsOpen = await showExportSuccess(fileName);
      if (wantsOpen) {
        await this.openPdf(outputPdfPath);
      }
    }
  }

  /** Open the generated PDF in the OS default handler. */
  private async openPdf(outputPdfPath: string): Promise<void> {
    try {
      await vscode.env.openExternal(vscode.Uri.file(outputPdfPath));
    } catch (error) {
      logger.warn(`Could not open the PDF automatically: ${String(error)}`);
    }
  }

  /** Read effective extension settings. */
  private readSettings(): ExtensionSettings {
    const config = vscode.workspace.getConfiguration('professionalMarkdownPdf');
    return {
      browserExecutablePath: config.get<string>('browserExecutablePath', ''),
      openAfterExport: config.get<boolean>('openAfterExport', true),
      outputMode: config.get<OutputMode>('outputMode', 'sameFolder'),
    };
  }
}

/** Produce a short, human-readable description of an unknown error. */
function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
