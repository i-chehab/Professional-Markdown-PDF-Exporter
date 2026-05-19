/**
 * Shared type definitions for the PDF export pipeline.
 */

/** The CSS/layout preset applied to an exported document. */
export type PdfPreset = 'arabic' | 'english';

/** Text direction associated with a preset. */
export type TextDirection = 'rtl' | 'ltr';

/** Where the generated PDF is written. v1 only supports `sameFolder`. */
export type OutputMode = 'sameFolder';

/**
 * A fully-resolved request to export a single Markdown file.
 * Built by the command layer before the export pipeline runs.
 */
export interface ExportRequest {
  /** Absolute path to the source Markdown file. */
  readonly markdownPath: string;
  /** Preset selected by the user. */
  readonly preset: PdfPreset;
}

/** Result of a completed export. */
export interface ExportResult {
  /** Absolute path to the written PDF. */
  readonly pdfPath: string;
  /** Preset that was used. */
  readonly preset: PdfPreset;
}

/** A browser executable discovered on the host system. */
export interface DetectedBrowser {
  /** Absolute path to the browser executable. */
  readonly executablePath: string;
  /** Human-readable browser family, e.g. "Google Chrome". */
  readonly name: string;
  /** True when the path came from the user setting rather than auto-detection. */
  readonly fromUserSetting: boolean;
}

/** Effective extension settings, read once per export. */
export interface ExtensionSettings {
  readonly browserExecutablePath: string;
  readonly openAfterExport: boolean;
  readonly outputMode: OutputMode;
}

/** Metadata describing how a preset should be rendered. */
export interface PresetDescriptor {
  readonly preset: PdfPreset;
  readonly lang: string;
  readonly dir: TextDirection;
  /** CSS file name within `src/styles`. */
  readonly cssFileName: string;
}

/** Static lookup table for the two supported presets. */
export const PRESETS: Readonly<Record<PdfPreset, PresetDescriptor>> = {
  arabic: { preset: 'arabic', lang: 'ar', dir: 'rtl', cssFileName: 'arabic.css' },
  english: { preset: 'english', lang: 'en', dir: 'ltr', cssFileName: 'english.css' },
};
