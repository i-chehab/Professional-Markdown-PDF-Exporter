import * as vscode from 'vscode';
import { logger } from './logger';

/**
 * Centralised, user-facing messaging.
 *
 * Keeps popup copy consistent and ensures every error popup also records
 * detail in the Output Channel.
 */

/** Show a concise informational message. */
export function showInfo(message: string): void {
  void vscode.window.showInformationMessage(message);
}

/** Show a warning popup. */
export function showWarning(message: string): void {
  logger.warn(message);
  void vscode.window.showWarningMessage(message);
}

/**
 * Show an error popup and log full detail (including stack trace) to the
 * Output Channel. The popup offers a "Show Details" action.
 */
export function showError(message: string, error?: unknown): void {
  logger.error(message, error);
  void vscode.window.showErrorMessage(message, 'Show Details').then((choice) => {
    if (choice === 'Show Details') {
      logger.show();
    }
  });
}

/**
 * Show an export-success message with an optional "Open PDF" action.
 * Resolves to `true` when the user clicks "Open PDF".
 */
export async function showExportSuccess(pdfFileName: string): Promise<boolean> {
  const choice = await vscode.window.showInformationMessage(
    `PDF exported successfully: ${pdfFileName}`,
    'Open PDF',
  );
  return choice === 'Open PDF';
}
