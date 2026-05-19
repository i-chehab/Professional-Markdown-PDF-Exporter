import * as path from 'path';
import { OutputMode } from '../types/exportTypes';

/**
 * Determines where a generated PDF should be written.
 *
 * v1 only implements `sameFolder` (PDF beside the Markdown file). The function
 * is intentionally written as a `switch` over `OutputMode` so future modes
 * (custom folder, workspace `/pdf`, ask-every-time) slot in without touching
 * callers.
 */
export class OutputPathResolver {
  /**
   * Resolve the absolute output PDF path for a given Markdown file.
   *
   * @param markdownPath Absolute path to the source Markdown file.
   * @param mode         Configured output mode.
   */
  public resolve(markdownPath: string, mode: OutputMode): string {
    switch (mode) {
      case 'sameFolder':
        return this.besideSource(markdownPath);
      default: {
        // Exhaustiveness guard: adding an OutputMode without a case here is a
        // compile-time error.
        const exhaustive: never = mode;
        throw new Error(`Unsupported output mode: ${String(exhaustive)}`);
      }
    }
  }

  /** `proposal.md` → `proposal.pdf` in the same directory. */
  private besideSource(markdownPath: string): string {
    const dir = path.dirname(markdownPath);
    const baseName = path.basename(markdownPath, path.extname(markdownPath));
    return path.join(dir, `${baseName}.pdf`);
  }
}
