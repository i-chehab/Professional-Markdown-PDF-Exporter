import * as vscode from 'vscode';
import { ExportPdfCommand } from './commands/exportPdfCommand';
import { logger } from './utils/logger';

/**
 * Extension entry point. Wires the three commands to a single shared
 * `ExportPdfCommand` instance and registers everything for disposal.
 */
export function activate(context: vscode.ExtensionContext): void {
  logger.init();
  logger.info('Professional Markdown PDF Exporter activated.');

  const exporter = new ExportPdfCommand(context.extensionPath);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'professionalMarkdownPdf.exportPdf',
      (resourceUri?: vscode.Uri) => exporter.runWithChooser(resourceUri),
    ),
    vscode.commands.registerCommand(
      'professionalMarkdownPdf.exportArabicPdf',
      (resourceUri?: vscode.Uri) => exporter.runWithPreset('arabic', resourceUri),
    ),
    vscode.commands.registerCommand(
      'professionalMarkdownPdf.exportEnglishPdf',
      (resourceUri?: vscode.Uri) => exporter.runWithPreset('english', resourceUri),
    ),
    { dispose: () => logger.dispose() },
  );
}

/** Extension teardown. Disposables registered above handle the rest. */
export function deactivate(): void {
  logger.info('Professional Markdown PDF Exporter deactivated.');
}
