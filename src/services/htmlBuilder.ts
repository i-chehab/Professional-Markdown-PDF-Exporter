import * as path from 'path';
import { PdfPreset, PresetDescriptor } from '../types/exportTypes';
import { readBinaryFile, readTextFile } from '../utils/fileUtils';

/** Inputs required to assemble a complete print-ready HTML document. */
export interface HtmlBuildOptions {
  /** Preset descriptor (lang, dir, css file name). */
  readonly preset: PresetDescriptor;
  /** Rendered Markdown body fragment (already image-resolved). */
  readonly bodyHtml: string;
  /** Document `<title>`. */
  readonly title: string;
}

/** A bundled font face to embed as a base64 `@font-face` rule. */
interface BundledFont {
  readonly family: string;
  readonly weight: 400 | 700;
  readonly fileName: string;
}

/**
 * Arabic fonts bundled with the extension (SIL Open Font License — see
 * `src/styles/fonts/OFL.txt`). They are embedded directly into the document
 * so Arabic output is identical regardless of which fonts the user's machine
 * happens to have installed.
 */
const ARABIC_FONTS: readonly BundledFont[] = [
  { family: 'Noto Naskh Arabic', weight: 400, fileName: 'noto-naskh-arabic-arabic-400-normal.woff2' },
  { family: 'Noto Naskh Arabic', weight: 700, fileName: 'noto-naskh-arabic-arabic-700-normal.woff2' },
  { family: 'Noto Kufi Arabic', weight: 400, fileName: 'noto-kufi-arabic-arabic-400-normal.woff2' },
  { family: 'Noto Kufi Arabic', weight: 700, fileName: 'noto-kufi-arabic-arabic-700-normal.woff2' },
];

/**
 * Assembles a self-contained HTML document: correct `lang`/`dir`, embedded
 * fonts, the inlined CSS preset, a shared syntax-highlighting theme, and the
 * rendered Markdown body.
 *
 * All assets (CSS presets under `src/styles`, the highlight theme, and the
 * bundled Arabic `.woff2` fonts) are shipped verbatim in the packaged
 * extension and read from disk at export time, then inlined so the temporary
 * HTML file is fully portable.
 */
export class HtmlBuilder {
  private readonly stylesDir: string;
  private readonly fontsDir: string;
  private readonly textCache = new Map<string, string>();
  private fontFaceCache: string | undefined;

  /**
   * @param extensionPath Absolute root path of the installed extension.
   */
  constructor(extensionPath: string) {
    this.stylesDir = path.join(extensionPath, 'src', 'styles');
    this.fontsDir = path.join(this.stylesDir, 'fonts');
  }

  /** Build the full HTML document string. */
  public async build(options: HtmlBuildOptions): Promise<string> {
    const { lang, dir, preset } = options.preset;
    const safeTitle = escapeHtml(options.title);

    // Order matters: @font-face first, then the preset, then the shared
    // highlight theme so token colours layer on top of the preset's code box.
    const cssParts = [
      await this.buildFontFaceCss(preset),
      await this.loadText(options.preset.cssFileName),
      await this.loadText('highlight.css'),
    ].filter((part) => part.length > 0);

    return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <!-- Defense-in-depth: forbid scripts in the generated document. The PDF
       export also loads the page with JavaScript disabled entirely. -->
  <meta http-equiv="Content-Security-Policy" content="script-src 'none'" />
  <title>${safeTitle}</title>
  <style>
${cssParts.join('\n\n')}
  </style>
</head>
<body>
${options.bodyHtml}
</body>
</html>
`;
  }

  /** Read (and memoise) a text asset from the styles directory. */
  private async loadText(fileName: string): Promise<string> {
    const cached = this.textCache.get(fileName);
    if (cached !== undefined) {
      return cached;
    }
    const text = await readTextFile(path.join(this.stylesDir, fileName));
    this.textCache.set(fileName, text);
    return text;
  }

  /**
   * Build the `@font-face` declarations for a preset. The Arabic preset embeds
   * the bundled Noto fonts as base64; the English preset relies on the common
   * system fonts in its CSS stack and needs no embedded faces.
   */
  private async buildFontFaceCss(preset: PdfPreset): Promise<string> {
    if (preset !== 'arabic') {
      return '';
    }
    if (this.fontFaceCache !== undefined) {
      return this.fontFaceCache;
    }
    const faces = await Promise.all(
      ARABIC_FONTS.map(async (font) => {
        const bytes = await readBinaryFile(path.join(this.fontsDir, font.fileName));
        const base64 = bytes.toString('base64');
        return `@font-face {
  font-family: '${font.family}';
  font-style: normal;
  font-weight: ${font.weight};
  font-display: swap;
  src: url(data:font/woff2;base64,${base64}) format('woff2');
}`;
      }),
    );
    this.fontFaceCache = `/* Embedded Arabic fonts (SIL OFL) for deterministic output */\n${faces.join(
      '\n',
    )}`;
    return this.fontFaceCache;
  }
}

/** Escape the small set of characters that matter inside a `<title>`. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
