import { pathToFileURL } from 'url';
import puppeteer, { Browser } from 'puppeteer-core';
import { logger } from '../utils/logger';

/** Inputs for a single PDF render. */
export interface PdfRenderOptions {
  /** Absolute path to the system browser executable. */
  readonly executablePath: string;
  /** Absolute path to the temporary HTML file to render. */
  readonly htmlPath: string;
  /** Absolute path the PDF should be written to. */
  readonly outputPdfPath: string;
}

/**
 * Drives a system-installed Chromium-family browser via `puppeteer-core` to
 * render an HTML file to a print-quality PDF.
 *
 * Design choices (per product spec):
 *  - `preferCSSPageSize: true` so the CSS `@page` rule controls A4 + margins.
 *  - `printBackground: true` so table stripes / note boxes / highlights show.
 *  - No Puppeteer `margin` option — margins come entirely from `@page`.
 *  - No `headerTemplate`/`footerTemplate`; page numbers come from the CSS
 *    `@bottom-center` margin box rendered by Chromium's own print engine.
 */
export class PdfExporter {
  /**
   * Render `htmlPath` to `outputPdfPath`. Always closes the browser, even on
   * failure.
   *
   * @throws when the browser fails to launch or the PDF cannot be produced.
   */
  public async export(options: PdfRenderOptions): Promise<void> {
    let browser: Browser | undefined;
    try {
      logger.info(`Launching browser: ${options.executablePath}`);
      browser = await puppeteer.launch({
        executablePath: options.executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();

      // Security: never execute Markdown-derived JavaScript. Raw HTML inside
      // Markdown is rendered for layout only; any <script> in the document is
      // inert because the page is loaded with scripting disabled.
      await page.setJavaScriptEnabled(false);

      const fileUrl = pathToFileURL(options.htmlPath).href;
      logger.info(`Loading temporary HTML: ${fileUrl}`);
      await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 60000 });

      logger.info(`Writing PDF: ${options.outputPdfPath}`);
      await page.pdf({
        path: options.outputPdfPath,
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        // Margins intentionally omitted: the CSS @page rule owns them.
      });
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          // A failed close should never mask the real outcome.
          logger.warn(`Browser failed to close cleanly: ${String(closeError)}`);
        }
      }
    }
  }
}
