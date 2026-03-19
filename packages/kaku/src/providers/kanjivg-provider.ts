import type {
  DataProvider,
  ProviderResult,
  CharacterData,
  Stroke,
} from '../types/index.js';
import { toHex, getCodePoints } from '../utils/unicode.js';

/**
 * Options for KanjiVG provider
 */
export interface KanjiVGProviderOptions {
  /** Base URL path to KanjiVG SVG files */
  basePath: string;
  /** Custom fetch function (for testing or custom environments) */
  fetch?: typeof globalThis.fetch;
}

/**
 * Data provider for KanjiVG stroke data
 */
export class KanjiVGProvider implements DataProvider {
  readonly id = 'kanjivg';

  private readonly basePath: string;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly cache = new Map<string, CharacterData>();

  constructor(options: KanjiVGProviderOptions) {
    this.basePath = options.basePath.replace(/\/$/, ''); // Remove trailing slash
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * Check if this provider can handle the given character.
   * KanjiVG covers CJK Unified Ideographs (U+4E00-U+9FFF) and some extensions.
   */
  canHandle(char: string): boolean {
    const cp = char.codePointAt(0);
    if (cp === undefined) return false;

    // CJK Unified Ideographs (common kanji/hanzi)
    if (cp >= 0x4e00 && cp <= 0x9fff) return true;

    // CJK Extension A
    if (cp >= 0x3400 && cp <= 0x4dbf) return true;

    // Hiragana
    if (cp >= 0x3040 && cp <= 0x309f) return true;

    // Katakana
    if (cp >= 0x30a0 && cp <= 0x30ff) return true;

    return false;
  }

  /**
   * Fetch character data from KanjiVG.
   * Results are cached in memory; repeated calls for the same character
   * return immediately without a network request.
   */
  async getCharacter(char: string): Promise<ProviderResult<CharacterData>> {
    const cached = this.cache.get(char);
    if (cached) return { success: true, data: cached };

    try {
      const url = this.buildUrl(char);
      const response = await this.fetchFn(url);

      if (!response.ok) {
        return {
          success: false,
          error: new Error(
            `Failed to fetch character data: ${response.status} ${response.statusText}`
          ),
        };
      }

      const svgText = await response.text();
      const data = this.parseSvg(char, svgText);
      this.cache.set(char, data);

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error : new Error('Unknown error occurred'),
      };
    }
  }

  /**
   * Build URL for fetching character SVG
   */
  private buildUrl(char: string): string {
    const hex = toHex(char, 5);
    return `${this.basePath}/${hex}.svg`;
  }

  /**
   * Parse KanjiVG SVG content into CharacterData
   */
  private parseSvg(char: string, svgText: string): CharacterData {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');

    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error(`Invalid SVG: ${parseError.textContent}`);
    }

    const svg = doc.querySelector('svg');
    if (!svg) {
      throw new Error('No SVG element found');
    }

    // Extract viewBox
    const viewBox = this.parseViewBox(svg.getAttribute('viewBox'));

    // Extract strokes
    const strokes = this.extractStrokes(doc);

    return {
      character: char,
      codePoints: getCodePoints(char),
      viewBox,
      strokes,
      source: this.id,
    };
  }

  /**
   * Parse viewBox attribute into tuple
   */
  private parseViewBox(
    viewBox: string | null
  ): [number, number, number, number] {
    if (!viewBox) {
      return [0, 0, 109, 109]; // KanjiVG default
    }

    const parts = viewBox.split(/\s+/).map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) {
      return [0, 0, 109, 109];
    }

    return parts as [number, number, number, number];
  }

  /**
   * Extract stroke paths from KanjiVG SVG document
   */
  private extractStrokes(doc: Document): Stroke[] {
    const paths = Array.from(doc.querySelectorAll('path'));

    // Filter to stroke paths (those in StrokePaths group with kvg:*-s{N} IDs)
    const strokePaths = paths.filter((path) => {
      const id = path.getAttribute('id') || '';
      return /^kvg:[0-9a-f]+-s\d+$/.test(id);
    });

    // Sort by stroke number
    strokePaths.sort((a, b) => {
      const aNum = this.extractStrokeNumber(a.getAttribute('id') || '');
      const bNum = this.extractStrokeNumber(b.getAttribute('id') || '');
      return aNum - bNum;
    });

    // Convert to Stroke objects
    return strokePaths.map((path, index) => {
      const d = path.getAttribute('d');
      if (!d) {
        throw new Error(`Path missing d attribute: ${path.getAttribute('id')}`);
      }

      const type = path.getAttribute('kvg:type') || undefined;
      const sourceId = path.getAttribute('id') || undefined;

      return {
        pathData: d,
        metadata: {
          index,
          type,
          sourceId,
        },
      };
    });
  }

  /**
   * Extract stroke number from KanjiVG ID (e.g., "kvg:05978-s3" -> 3)
   */
  private extractStrokeNumber(id: string): number {
    const match = id.match(/-s(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  }
}
