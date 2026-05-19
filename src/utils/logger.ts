import * as vscode from 'vscode';

/**
 * Thin wrapper around a dedicated VS Code Output Channel.
 *
 * The channel is the single place for verbose diagnostics (paths, browser
 * resolution, stack traces). User-facing popups stay concise; details land
 * here so a user can copy them when reporting an issue.
 */
class Logger {
  private channel: vscode.OutputChannel | undefined;

  /** Create the channel. Safe to call once during activation. */
  public init(): vscode.OutputChannel {
    if (!this.channel) {
      this.channel = vscode.window.createOutputChannel('Professional Markdown PDF Exporter');
    }
    return this.channel;
  }

  private write(level: string, message: string): void {
    const channel = this.init();
    const timestamp = new Date().toISOString();
    channel.appendLine(`[${timestamp}] [${level}] ${message}`);
  }

  public info(message: string): void {
    this.write('INFO', message);
  }

  public warn(message: string): void {
    this.write('WARN', message);
  }

  /**
   * Log an error, including a stack trace when an `Error` is supplied.
   */
  public error(message: string, error?: unknown): void {
    this.write('ERROR', message);
    if (error instanceof Error) {
      if (error.stack) {
        this.write('ERROR', error.stack);
      } else {
        this.write('ERROR', error.message);
      }
    } else if (error !== undefined) {
      this.write('ERROR', String(error));
    }
  }

  /** Reveal the Output Channel in the VS Code UI. */
  public show(): void {
    this.init().show(true);
  }

  public dispose(): void {
    this.channel?.dispose();
    this.channel = undefined;
  }
}

/** Process-wide logger singleton. */
export const logger = new Logger();
