import type {
  Renderer,
  RenderedStroke,
  RenderOptions,
  CharacterData,
} from '../types/index.js';
import { createSvg, createPath, createLine, createGroup } from '../utils/svg.js';
import { createStrokePath } from './stroke-path.js';

/**
 * Options for SVG renderer
 */
export interface SvgRendererOptions {
  /** Container element to render into */
  container: HTMLElement;
  /** Size of the SVG in pixels (square) */
  size?: number;
  /**
   * @deprecated Use `size` instead.
   * Width of the SVG (CSS value)
   */
  width?: number | string;
  /**
   * @deprecated Use `size` instead.
   * Height of the SVG (CSS value)
   */
  height?: number | string;
}

/**
 * SVG DOM renderer for character strokes
 */
export class SvgRenderer implements Renderer {
  private container: HTMLElement;
  private svg: SVGSVGElement | null = null;
  private strokeGroup: SVGGElement | null = null;
  private renderedStrokes: RenderedStroke[] = [];
  private width: number | string;
  private height: number | string;

  constructor(options: SvgRendererOptions) {
    this.container = options.container;
    this.width = options.size ?? options.width ?? 200;
    this.height = options.size ?? options.height ?? 200;
  }

  /**
   * Render character strokes to the container
   */
  render(data: CharacterData, options: RenderOptions = {}): RenderedStroke[] {
    // Clear any existing content
    this.clear();

    const {
      strokeColor = '#000',
      strokeWidth = 3,
      showGrid = false,
      gridColor = '#ccc',
      showOutline = false,
      outlineColor = '#ccc',
    } = options;

    // Create SVG element
    this.svg = createSvg(data.viewBox, this.width, this.height);

    // Add grid if requested
    if (showGrid) {
      this.addGrid(data.viewBox, gridColor);
    }

    // Add outline (all strokes fully visible in faint color) behind animated strokes
    if (showOutline) {
      const outlineGroup = createGroup();
      for (const stroke of data.strokes) {
        const path = createPath(stroke.pathData, {
          fill: 'none',
          stroke: outlineColor,
          'stroke-width': strokeWidth,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        });
        outlineGroup.appendChild(path);
      }
      this.svg.appendChild(outlineGroup);
    }

    // Create stroke group
    this.strokeGroup = createGroup();
    this.svg.appendChild(this.strokeGroup);

    // Render strokes
    this.renderedStrokes = data.strokes.map((stroke) => {
      const rendered = createStrokePath(stroke, { strokeColor, strokeWidth });
      this.strokeGroup!.appendChild(rendered.element);
      return rendered;
    });

    // Append to container
    this.container.appendChild(this.svg);

    return this.renderedStrokes;
  }

  /**
   * Get the SVG element
   */
  getSvg(): SVGSVGElement {
    if (!this.svg) {
      throw new Error('No SVG element - call render() first');
    }
    return this.svg;
  }

  /**
   * Clear rendered content
   */
  clear(): void {
    if (this.svg && this.svg.parentNode) {
      this.svg.parentNode.removeChild(this.svg);
    }
    this.svg = null;
    this.strokeGroup = null;
    this.renderedStrokes = [];
  }

  /**
   * Dispose renderer and clean up
   */
  dispose(): void {
    this.clear();
  }

  /**
   * Add grid lines to the SVG
   */
  private addGrid(
    viewBox: [number, number, number, number],
    gridColor: string
  ): void {
    if (!this.svg) return;

    const [minX, minY, width, height] = viewBox;
    const midX = minX + width / 2;
    const midY = minY + height / 2;

    const gridGroup = createGroup();

    // Vertical center line
    const verticalLine = createLine(midX, minY, midX, minY + height, {
      stroke: gridColor,
      'stroke-width': 0.5,
    });
    gridGroup.appendChild(verticalLine);

    // Horizontal center line
    const horizontalLine = createLine(minX, midY, minX + width, midY, {
      stroke: gridColor,
      'stroke-width': 0.5,
    });
    gridGroup.appendChild(horizontalLine);

    this.svg.appendChild(gridGroup);
  }
}
