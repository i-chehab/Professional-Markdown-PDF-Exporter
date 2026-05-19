import * as path from 'path';
import { pathToFileURL } from 'url';

/**
 * Rewrites local image references inside rendered HTML so they resolve
 * correctly when the document is loaded from a temporary file.
 *
 * Relative `src` attributes are resolved against the original Markdown file's
 * directory and converted to absolute `file://` URIs. Remote URLs and data
 * URIs are left untouched.
 */
export class AssetResolver {
  /**
   * @param markdownDir Absolute directory of the source Markdown file.
   */
  constructor(private readonly markdownDir: string) {}

  /**
   * Rewrite every `<img src="...">` in `html`. Handles both Markdown-generated
   * `<img>` tags and raw HTML `<img>` tags written inside the Markdown.
   */
  public resolveImagePaths(html: string): string {
    // Match the src attribute of any <img> tag (single or double quoted).
    const imgSrcPattern = /(<img\b[^>]*?\bsrc\s*=\s*)(["'])(.*?)\2/gi;
    return html.replace(imgSrcPattern, (full, prefix: string, quote: string, src: string) => {
      const resolved = this.resolveSingleSource(src);
      return resolved === undefined ? full : `${prefix}${quote}${resolved}${quote}`;
    });
  }

  /**
   * Resolve a single `src` value. Returns the rewritten value, or `undefined`
   * when the value should be left exactly as-is.
   *
   * Exposed for unit testing.
   */
  public resolveSingleSource(src: string): string | undefined {
    const trimmed = src.trim();
    if (trimmed.length === 0) {
      return undefined;
    }

    // Leave remote URLs, protocol-relative URLs, data URIs and existing
    // file:// URIs untouched.
    if (/^(https?:)?\/\//i.test(trimmed) || /^data:/i.test(trimmed) || /^file:/i.test(trimmed)) {
      return undefined;
    }

    // Absolute filesystem paths (POSIX "/..." or Windows "C:\...").
    const isAbsolute = path.isAbsolute(trimmed);
    const absolutePath = isAbsolute
      ? trimmed
      : path.resolve(this.markdownDir, this.decodePathSegment(trimmed));

    // pathToFileURL handles spaces, Windows separators and URI encoding.
    return pathToFileURL(absolutePath).href;
  }

  /**
   * Markdown image paths may arrive percent-encoded (e.g. spaces as `%20`).
   * Decode them before resolving against the filesystem; fall back to the
   * raw value if decoding fails.
   */
  private decodePathSegment(value: string): string {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
}
