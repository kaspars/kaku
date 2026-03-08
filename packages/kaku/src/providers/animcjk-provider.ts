import type {
  DataProvider,
  ProviderResult,
  CharacterData,
  Stroke,
} from '../types/index.js';
import { getCodePoints } from '../utils/unicode.js';

/**
 * AnimCJK language variant
 */
export type AnimCJKLanguage = 'ja' | 'zh-Hans' | 'zh-Hant' | 'ko';

/**
 * Options for AnimCJK provider
 */
export interface AnimCJKProviderOptions {
  /** Base URL path to AnimCJK SVG directories */
  basePath: string;
  /** Language variant (default: 'ja') */
  language?: AnimCJKLanguage;
  /** Custom fetch function (for testing or custom environments) */
  fetch?: typeof globalThis.fetch;
}

/** Map language to AnimCJK directory names */
const LANG_DIRS: Record<AnimCJKLanguage, string[]> = {
  'ja': ['svgsJa', 'svgsJaKana'],
  'zh-Hans': ['svgsZhHans'],
  'zh-Hant': ['svgsZhHant'],
  'ko': ['svgsKo'],
};

/**
 * Data provider for AnimCJK stroke data.
 *
 * AnimCJK SVGs are self-animating — they contain embedded CSS keyframes.
 * This provider extracts stroke data and preserves the raw SVG for
 * native rendering.
 */
export class AnimCJKProvider implements DataProvider {
  readonly id = 'animcjk';

  private readonly basePath: string;
  private readonly language: AnimCJKLanguage;
  private readonly dirs: string[];
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(options: AnimCJKProviderOptions) {
    this.basePath = options.basePath.replace(/\/$/, '');
    this.language = options.language ?? 'ja';
    this.dirs = LANG_DIRS[this.language];
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * Check if this provider can handle the given character.
   */
  canHandle(char: string): boolean {
    const cp = char.codePointAt(0);
    if (cp === undefined) return false;

    // CJK Unified Ideographs
    if (cp >= 0x4e00 && cp <= 0x9fff) return true;

    // CJK Extension A
    if (cp >= 0x3400 && cp <= 0x4dbf) return true;

    // Japanese kana (only for 'ja' language)
    if (this.language === 'ja') {
      // Hiragana
      if (cp >= 0x3040 && cp <= 0x309f) return true;
      // Katakana
      if (cp >= 0x30a0 && cp <= 0x30ff) return true;
    }

    return false;
  }

  /**
   * Fetch character data from AnimCJK
   */
  async getCharacter(char: string): Promise<ProviderResult<CharacterData>> {
    const cp = char.codePointAt(0);
    if (cp === undefined) {
      return { success: false, error: new Error('Invalid character') };
    }

    // AnimCJK uses decimal codepoint for file names
    const filename = `${cp}.svg`;

    // Try each directory for this language (e.g., svgsJa then svgsJaKana)
    for (const dir of this.dirs) {
      const url = `${this.basePath}/${dir}/${filename}`;
      try {
        const response = await this.fetchFn(url);
        if (response.ok) {
          const svgText = await response.text();
          const data = this.parseSvg(char, svgText);
          return { success: true, data };
        }
      } catch {
        // Try next directory
      }
    }

    return {
      success: false,
      error: new Error(
        `Character not found in AnimCJK (${this.language}): ${char}`
      ),
    };
  }

  /**
   * Parse AnimCJK SVG content into CharacterData.
   */
  private parseSvg(char: string, svgText: string): CharacterData {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error(`Invalid SVG: ${parseError.textContent}`);
    }

    const svg = doc.querySelector('svg');
    if (!svg) {
      throw new Error('No SVG element found');
    }

    const viewBox = this.parseViewBox(svg.getAttribute('viewBox'));
    const strokes = this.extractStrokes(doc);

    return {
      character: char,
      codePoints: getCodePoints(char),
      viewBox,
      strokes,
      source: this.id,
      rawSvg: svgText,
    };
  }

  /**
   * Parse viewBox attribute into tuple
   */
  private parseViewBox(
    viewBox: string | null,
  ): [number, number, number, number] {
    if (!viewBox) {
      return [0, 0, 1024, 1024]; // AnimCJK default
    }

    const parts = viewBox.split(/\s+/).map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) {
      return [0, 0, 1024, 1024];
    }

    return parts as [number, number, number, number];
  }

  /**
   * Extract strokes from AnimCJK SVG.
   *
   * AnimCJK has two types of paths:
   * 1. Shape paths (id="z{cp}d{n}") — filled outlines used as clip regions
   * 2. Stroke paths (clip-path="url(#...)") — direction polylines for animation
   *
   * Multi-part strokes have letter suffixes (d3a, d3b) and share the same
   * animation delay (--d value). We group them by stroke number.
   */
  private extractStrokes(doc: Document): Stroke[] {
    // Stroke paths are those with a clip-path attribute (the direction polylines)
    const strokePaths = Array.from(
      doc.querySelectorAll('path[clip-path]'),
    );

    // Group by stroke number extracted from the --d delay value.
    // Paths with the same delay are parts of the same stroke.
    const strokeGroups = new Map<number, SVGPathElement[]>();

    for (const path of strokePaths) {
      const delay = this.extractDelay(path);
      if (!strokeGroups.has(delay)) {
        strokeGroups.set(delay, []);
      }
      strokeGroups.get(delay)!.push(path as SVGPathElement);
    }

    // Sort by delay (stroke order)
    const sortedDelays = [...strokeGroups.keys()].sort((a, b) => a - b);

    return sortedDelays.map((delay, index) => {
      const paths = strokeGroups.get(delay)!;

      // Concatenate direction polylines for multi-part strokes
      const pathData = paths
        .map((p) => p.getAttribute('d') || '')
        .filter(Boolean)
        .join(' ');

      // Extract shape path IDs from clip-path references
      const clipIds = paths
        .map((p) => {
          const clipAttr = p.getAttribute('clip-path') || '';
          const match = clipAttr.match(/url\(#(.+?)\)/);
          return match?.[1];
        })
        .filter(Boolean) as string[];

      return {
        pathData,
        metadata: {
          index,
          sourceId: clipIds.join(','),
        },
      };
    });
  }

  /**
   * Extract the animation delay value from the --d CSS custom property.
   * e.g., style="--d:3s;" → 3
   */
  private extractDelay(path: Element): number {
    const style = path.getAttribute('style') || '';
    const match = style.match(/--d:\s*([\d.]+)s/);
    return match ? parseFloat(match[1]) : 0;
  }
}
