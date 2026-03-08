import type {
  DataProvider,
  CharacterData,
  RenderOptions,
} from '../types/index.js';
import { createSvg, createGroup, createLine, createPath } from '../utils/svg.js';
import { getCodePoints } from '../utils/unicode.js';

/**
 * Options for KakuDiagram instance
 */
export interface KakuDiagramOptions {
  /** Data provider for character stroke data */
  provider: DataProvider;
  /** Container element to render diagrams into */
  container: HTMLElement;
  /** Size of each SVG in pixels (square) */
  size?: number;
  /**
   * @deprecated Use `size` instead.
   * Width of each SVG (CSS value)
   */
  width?: number | string;
  /**
   * @deprecated Use `size` instead.
   * Height of each SVG (CSS value)
   */
  height?: number | string;
  /** Stroke color */
  strokeColor?: string;
  /** Stroke width */
  strokeWidth?: number;
  /** Show grid lines */
  showGrid?: boolean;
  /** Grid line color */
  gridColor?: string;
}

/**
 * KakuDiagram - Renders stroke order diagrams as a series of SVGs
 *
 * Each SVG shows cumulative stroke progress:
 * - SVG 1: stroke 1
 * - SVG 2: strokes 1-2
 * - SVG N: strokes 1-N (complete character)
 */
export class KakuDiagram {
  private provider: DataProvider;
  private container: HTMLElement;
  private readonly width: number | string;
  private readonly height: number | string;
  private renderOptions: RenderOptions;
  private characterData: CharacterData | null = null;
  private svgElements: SVGSVGElement[] = [];
  private disposed = false;

  constructor(options: KakuDiagramOptions) {
    this.provider = options.provider;
    this.container = options.container;
    this.width = options.size ?? options.width ?? 109;
    this.height = options.size ?? options.height ?? 109;
    this.renderOptions = {
      strokeColor: options.strokeColor ?? '#000',
      strokeWidth: options.strokeWidth ?? 3,
      showGrid: options.showGrid ?? false,
      gridColor: options.gridColor ?? '#ddd',
    };
  }

  /**
   * Currently loaded character
   */
  get character(): string | null {
    return this.characterData?.character ?? null;
  }

  /**
   * Total number of strokes
   */
  get totalStrokes(): number {
    return this.characterData?.strokes.length ?? 0;
  }

  /**
   * Load and render stroke order diagram for a character
   * @param char - The character to load
   * @throws Error if character cannot be loaded
   */
  async load(char: string): Promise<void> {
    if (this.disposed) {
      throw new Error('KakuDiagram instance has been disposed');
    }

    const codePoints = getCodePoints(char);
    if (codePoints.length !== 1) {
      throw new Error(`KakuDiagram.load expects a single code point, got ${codePoints.length}`);
    }

    // Check if provider can handle this character
    if (!this.provider.canHandle(char)) {
      throw new Error(`Provider ${this.provider.id} cannot handle character: ${char}`);
    }

    // Clear previous diagrams
    this.clear();

    // Fetch character data
    const result = await this.provider.getCharacter(char);
    if (!result.success) {
      throw result.error;
    }

    this.characterData = result.data;

    // Render diagram SVGs
    this.renderDiagrams();
  }

  /**
   * Get all rendered SVG elements
   */
  getSvgElements(): SVGSVGElement[] {
    return [...this.svgElements];
  }

  /**
   * Get the loaded character data
   */
  getCharacterData(): CharacterData | null {
    return this.characterData;
  }

  /**
   * Clear rendered diagrams
   */
  clear(): void {
    for (const svg of this.svgElements) {
      svg.remove();
    }
    this.svgElements = [];
  }

  /**
   * Dispose instance and clean up
   */
  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.clear();
    this.characterData = null;
  }

  /**
   * Render all diagram SVGs into the container
   */
  private renderDiagrams(): void {
    if (!this.characterData) return;

    if (this.characterData.rawSvg) {
      this.renderAnimCJKDiagrams();
    } else {
      this.renderPathDiagrams();
    }
  }

  /**
   * Render diagrams for KanjiVG-style data (stroke paths as Bezier curves)
   */
  private renderPathDiagrams(): void {
    if (!this.characterData) return;

    const { strokes, viewBox } = this.characterData;
    const [, , vbW, vbH] = viewBox;

    for (let step = 1; step <= strokes.length; step++) {
      const svg = createSvg(viewBox, this.width, this.height);

      if (this.renderOptions.showGrid) {
        this.addGrid(svg, vbW, vbH);
      }

      const strokesGroup = createGroup({ class: 'strokes' });

      for (let i = 0; i < step; i++) {
        const stroke = strokes[i];
        const path = createPath(stroke.pathData, {
          fill: 'none',
          stroke: this.renderOptions.strokeColor ?? '#000',
          'stroke-width': this.renderOptions.strokeWidth ?? 3,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        });
        strokesGroup.appendChild(path);
      }

      svg.appendChild(strokesGroup);
      this.container.appendChild(svg);
      this.svgElements.push(svg);
    }
  }

  /**
   * Render diagrams for AnimCJK-style data (shape outlines from rawSvg)
   */
  private renderAnimCJKDiagrams(): void {
    if (!this.characterData?.rawSvg) return;

    const { strokes, viewBox } = this.characterData;
    const [, , vbW, vbH] = viewBox;

    // Parse rawSvg and extract shape paths (those with id attributes)
    const shapePaths = this.extractShapePaths(this.characterData.rawSvg);

    for (let step = 1; step <= strokes.length; step++) {
      const svg = createSvg(viewBox, this.width, this.height);

      if (this.renderOptions.showGrid) {
        this.addGrid(svg, vbW, vbH);
      }

      const strokesGroup = createGroup({ class: 'strokes' });

      for (let i = 0; i < step; i++) {
        const paths = shapePaths[i] ?? [];
        for (const pathData of paths) {
          const path = createPath(pathData, {
            fill: this.renderOptions.strokeColor ?? '#000',
          });
          strokesGroup.appendChild(path);
        }
      }

      svg.appendChild(strokesGroup);
      this.container.appendChild(svg);
      this.svgElements.push(svg);
    }
  }

  /**
   * Extract shape path data from AnimCJK rawSvg, grouped by stroke.
   * Shape paths have IDs like z23383d1, z23383d2, or z12354d3a, z12354d3b
   * for multi-part strokes. Groups by stroke number extracted from the
   * clip-path delay values (same grouping as the provider).
   */
  private extractShapePaths(rawSvg: string): string[][] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawSvg, 'image/svg+xml');

    // Group stroke paths by delay to determine stroke ordering
    const strokePaths = Array.from(doc.querySelectorAll('path[clip-path]'));
    const delayToShapeIds = new Map<number, string[]>();

    for (const path of strokePaths) {
      const style = path.getAttribute('style') || '';
      const match = style.match(/--d:\s*([\d.]+)s/);
      const delay = match ? parseFloat(match[1]) : 0;

      const clipAttr = path.getAttribute('clip-path') || '';
      const idMatch = clipAttr.match(/url\(#(.+?)\)/);
      if (!idMatch) continue;

      // clipPath ID is like z23383c1, the shape path ID is z23383d1
      const clipId = idMatch[1];
      const shapeId = clipId.replace(/c(\d+)/, 'd$1');

      if (!delayToShapeIds.has(delay)) {
        delayToShapeIds.set(delay, []);
      }
      delayToShapeIds.get(delay)!.push(shapeId);
    }

    const sortedDelays = [...delayToShapeIds.keys()].sort((a, b) => a - b);

    return sortedDelays.map((delay) => {
      const shapeIds = delayToShapeIds.get(delay)!;
      return shapeIds
        .map((id) => {
          const el = doc.getElementById(id);
          return el?.getAttribute('d') ?? '';
        })
        .filter(Boolean);
    });
  }

  /**
   * Add grid lines to SVG
   */
  private addGrid(svg: SVGSVGElement, width: number, height: number): void {
    const gridGroup = createGroup({ class: 'grid' });
    const gridColor = this.renderOptions.gridColor ?? '#ddd';

    // Vertical center line
    gridGroup.appendChild(
      createLine(width / 2, 0, width / 2, height, {
        stroke: gridColor,
        'stroke-width': 1,
        'stroke-dasharray': '4,4',
      })
    );

    // Horizontal center line
    gridGroup.appendChild(
      createLine(0, height / 2, width, height / 2, {
        stroke: gridColor,
        'stroke-width': 1,
        'stroke-dasharray': '4,4',
      })
    );

    svg.appendChild(gridGroup);
  }
}
