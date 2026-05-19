import MarkdownIt from 'markdown-it';
import highlightjs from 'markdown-it-highlightjs';

/**
 * Renders Markdown source to an HTML fragment.
 *
 * `markdown-it` is configured per the product spec:
 *  - `html: true`        → raw HTML blocks (cover pages, note boxes, …) pass through
 *  - `linkify: true`     → bare URLs become links
 *  - `typographer: false`→ no smart-quote / dash substitution (predictable output)
 *
 * Fenced code blocks are syntax-highlighted by `markdown-it-highlightjs`. The
 * highlighting runs entirely at render time in Node — it emits static `hljs`
 * CSS classes and never executes in the browser, so it stays compatible with
 * the scripts-disabled PDF export.
 *
 * Tables, lists, blockquotes, etc. are part of the markdown-it defaults, so no
 * extra plugins are required.
 */
export class MarkdownRenderer {
  private readonly md: MarkdownIt;

  constructor() {
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: false,
      breaks: false,
    });
    // `auto` detects the language when a fence has no info string; `code`
    // keeps highlighting enabled for fenced blocks.
    this.md.use(highlightjs, { auto: true, code: true });
  }

  /**
   * Render Markdown to an HTML body fragment (no `<html>`/`<body>` wrapper).
   */
  public render(markdown: string): string {
    return this.md.render(markdown);
  }

  /**
   * Derive a document title from rendered HTML: the text of the first `<h1>`,
   * with any inline markup stripped. Works whether the heading came from
   * Markdown (`# Title`) or from raw HTML (`<h1>` inside a `.cover-page`).
   *
   * Returns `undefined` when the document has no H1, so the caller can fall
   * back to the file name.
   */
  public extractTitleFromHtml(html: string): string | undefined {
    const match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
    if (!match) {
      return undefined;
    }
    const text = decodeBasicEntities(stripTags(match[1])).replace(/\s+/g, ' ').trim();
    return text.length > 0 ? text : undefined;
  }
}

/** Remove all HTML tags from a fragment, leaving text content. */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

/** Decode the handful of named/numeric entities common in heading text. */
function decodeBasicEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)));
}
