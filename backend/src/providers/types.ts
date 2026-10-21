import type { AnalyzeResult, MediaFormat, ProviderInfo } from '../types/index.js'

export interface ProviderContext {
  /** Already validated & normalized URL */
  url: string
  hostname: string
}

export interface Provider {
  info: ProviderInfo
  /**
   * Return true if this provider can handle the given hostname / URL.
   * Should be fast and pure (no network).
   */
  matches(hostname: string, url: string): boolean
  /**
   * Analyze the URL and return permitted metadata + available authorized formats.
   * Must never return fabricated data.
   */
  analyze(ctx: ProviderContext): Promise<AnalyzeResult>
  /**
   * Optional: prepare a download when a format is selected.
   * Only implement when the provider can deliver an authorized file.
   */
  prepareDownload?(
    ctx: ProviderContext,
    formatId: string
  ): Promise<
    | { ok: true; filePath: string; contentType: string; filename: string }
    | { ok: false; error: string; code: string }
  >
}
