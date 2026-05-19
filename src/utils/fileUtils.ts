import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

/** Markdown file extensions the extension is willing to export. */
export const MARKDOWN_EXTENSIONS: readonly string[] = ['.md', '.markdown'];

/** Return true when `filePath` has a recognised Markdown extension. */
export function isMarkdownFile(filePath: string): boolean {
  return MARKDOWN_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
}

/** Check whether a path exists on disk (file or directory). */
export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/** Check whether a path exists and is a regular file. */
export async function isFile(targetPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/** Read a UTF-8 text file. */
export async function readTextFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf8');
}

/** Read a file as raw bytes (used for embedding fonts as base64). */
export async function readBinaryFile(filePath: string): Promise<Buffer> {
  return fs.readFile(filePath);
}

/** Write a UTF-8 text file, creating parent directories as needed. */
export async function writeTextFile(filePath: string, contents: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, 'utf8');
}

/** Delete a file, swallowing "not found" errors. */
export async function deleteFileQuietly(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    /* already gone — nothing to clean up */
  }
}

/**
 * Build a unique temporary HTML file path inside the OS temp directory.
 * The `baseName` is sanitised to avoid surprising characters.
 */
export function buildTempHtmlPath(baseName: string): string {
  const safeBase = baseName.replace(/[^a-zA-Z0-9-_]/g, '_') || 'document';
  const unique = `${safeBase}-${process.pid}-${Date.now()}`;
  return path.join(os.tmpdir(), `pmpe-${unique}.html`);
}
