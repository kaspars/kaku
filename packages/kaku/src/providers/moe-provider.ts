import type {
  DataProvider,
  ProviderResult,
  CharacterData,
  Stroke,
} from '../types/index.js';
import { getCodePoints } from '../utils/unicode.js';

/**
 * Options for the Taiwan Ministry of Education provider
 */
export interface MoeProviderOptions {
  /**
   * Base URL of a copy of the `json` directory of g0v/zh-stroke-data, which
   * holds one `<lowercase hex code point>.json` per character. Required:
   * the data is © Ministry of Education (Taiwan), licensed for
   * non-commercial educational use, so serve your own copy.
   */
  basePath: string;
  /** Custom fetch function (for testing or custom environments) */
  fetch?: typeof globalThis.fetch;
  /**
   * Drop strokes that repeat an earlier stroke (default: true). The scraped
   * data repeats a stroke in a few characters (年, 回, 寓…; 懂 is there
   * twice over).
   */
  dropDuplicates?: boolean;
}

interface MoePoint {
  x: number;
  y: number;
}

type MoeCommand =
  | ({ type: 'M' | 'L' } & MoePoint)
  | { type: 'Q'; begin: MoePoint; end: MoePoint }
  | { type: 'C'; begin: MoePoint; mid: MoePoint; end: MoePoint };

interface MoeStroke {
  outline: MoeCommand[];
  track: MoePoint[];
}

/** The data's grid, and the viewBox it is scaled to (AnimCJK's). */
const GRID = 2150;
const SIZE = 1024;

/**
 * Two strokes are the same if their tracks start and end within this
 * distance (grid units, about 6% of the box) and their outlines' bounding
 * boxes mostly overlap.
 */
const SAME_ENDS = 130;
const SAME_BOX = 0.6;

/**
 * Data provider for the stroke data of the Taiwan Ministry of Education's
 * 常用國字標準字體筆順學習網 (standard forms and stroke order), as converted
 * to JSON by g0v/zh-stroke-data.
 *
 * Each stroke has an outline and a track (its centre line). The provider
 * scales them to a 1024 box and builds an SVG in AnimCJK's layout, so
 * {@link AnimCJKRenderer} draws and animates it, and KakuRen scores against
 * the tracks.
 */
export class MoeProvider implements DataProvider {
  readonly id = 'moe';

  private readonly basePath: string;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly dropDuplicates: boolean;
  private readonly cache = new Map<string, CharacterData>();

  constructor(options: MoeProviderOptions) {
    if (!options.basePath) {
      throw new Error('MoeProvider requires a basePath: the data is not open, serve your own copy');
    }
    this.basePath = options.basePath.replace(/\/$/, '');
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.dropDuplicates = options.dropDuplicates ?? true;
  }

  /**
   * CJK Unified Ideographs and Extension A; the data has no kana.
   */
  canHandle(char: string): boolean {
    const cp = char.codePointAt(0);
    if (cp === undefined) return false;
    return (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf);
  }

  /**
   * Fetch character data. Results are cached in memory.
   */
  async getCharacter(char: string): Promise<ProviderResult<CharacterData>> {
    const cached = this.cache.get(char);
    if (cached) return { success: true, data: cached };

    const cp = char.codePointAt(0);
    if (cp === undefined) {
      return { success: false, error: new Error('Invalid character') };
    }

    try {
      const response = await this.fetchFn(`${this.basePath}/${cp.toString(16)}.json`);
      if (!response.ok) {
        return { success: false, error: new Error(`Character not found in MOE data: ${char}`) };
      }
      let strokes = JSON.parse(await response.text()) as MoeStroke[];
      if (!Array.isArray(strokes) || strokes.length === 0) {
        return { success: false, error: new Error(`No strokes in MOE data: ${char}`) };
      }
      if (this.dropDuplicates) strokes = withoutRepeats(strokes);
      const data = toCharacterData(char, cp, strokes);
      this.cache.set(char, data);
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}

/** A grid value in viewBox units, to one decimal place. */
function n(v: number): string {
  return String(Math.round((v * SIZE * 10) / GRID) / 10);
}

function pt(p: MoePoint): string {
  return `${n(p.x)} ${n(p.y)}`;
}

function outlinePath(cmds: MoeCommand[]): string {
  const parts = cmds.map((c) => {
    switch (c.type) {
      case 'M':
      case 'L':
        return `${c.type}${pt(c)}`;
      case 'Q':
        return `Q${pt(c.begin)} ${pt(c.end)}`;
      case 'C':
        return `C${pt(c.begin)} ${pt(c.mid)} ${pt(c.end)}`;
    }
  });
  return parts.join('') + 'Z';
}

function trackPath(track: MoePoint[]): string {
  return track.map((p, i) => `${i ? 'L' : 'M'}${pt(p)}`).join('');
}

function toCharacterData(char: string, cp: number, moe: MoeStroke[]): CharacterData {
  const id = `moe${cp}`;
  const strokes: Stroke[] = moe.map((s, index) => ({
    pathData: trackPath(s.track),
    metadata: { index, sourceId: `${id}d${index + 1}` },
  }));
  const outlines = moe.map((s, i) => `<path id="${id}d${i + 1}" d="${outlinePath(s.outline)}"/>`);
  const clips = moe.map((_, i) => `\t<clipPath id="${id}c${i + 1}"><use href="#${id}d${i + 1}"/></clipPath>`);
  const tracks = strokes.map(
    (s, i) => `<path style="--d:${i + 1}s;" pathLength="3333" clip-path="url(#${id}c${i + 1})" d="${s.pathData}"/>`,
  );
  const rawSvg = [
    '<!-- Stroke data: Ministry of Education (Taiwan), 常用國字標準字體筆順學習網, via g0v/zh-stroke-data -->',
    `<svg id="${id}" class="acjk" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">`,
    '<style>',
    '@keyframes zk { to { stroke-dashoffset: 0; } }',
    'svg.acjk path[clip-path] { --t: 0.8s; animation: zk var(--t) linear forwards var(--d); stroke-dasharray: 3337; stroke-dashoffset: 3339; stroke-width: 128; stroke-linecap: round; fill: none; stroke: #000; }',
    'svg.acjk path[id] { fill: #ccc; }',
    '</style>',
    ...outlines,
    '<defs>',
    ...clips,
    '</defs>',
    ...tracks,
    '</svg>',
  ].join('\n');
  return {
    character: char,
    codePoints: getCodePoints(char),
    viewBox: [0, 0, SIZE, SIZE],
    strokes,
    source: 'moe',
    rawSvg,
  };
}

function bounds(s: MoeStroke): [number, number, number, number] {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const c of s.outline) {
    const pts = c.type === 'Q' ? [c.begin, c.end] : c.type === 'C' ? [c.begin, c.mid, c.end] : [c];
    for (const p of pts) {
      xs.push(p.x);
      ys.push(p.y);
    }
  }
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

function overlap(a: [number, number, number, number], b: [number, number, number, number]): number {
  const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]);
  const h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
  if (w <= 0 || h <= 0) return 0;
  const area = (r: typeof a) => (r[2] - r[0]) * (r[3] - r[1]);
  return (w * h) / (area(a) + area(b) - w * h);
}

function near(a: MoePoint, b: MoePoint): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < SAME_ENDS;
}

function repeats(a: MoeStroke, b: MoeStroke): boolean {
  return (
    near(a.track[0], b.track[0]) &&
    near(a.track[a.track.length - 1], b.track[b.track.length - 1]) &&
    overlap(bounds(a), bounds(b)) > SAME_BOX
  );
}

function withoutRepeats(strokes: MoeStroke[]): MoeStroke[] {
  const kept: MoeStroke[] = [];
  for (const s of strokes) {
    if (!kept.some((k) => repeats(k, s))) kept.push(s);
  }
  return kept;
}
