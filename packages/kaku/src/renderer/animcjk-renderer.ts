import type {
  Renderer,
  RenderedStroke,
  RenderOptions,
  CharacterData,
} from '../types/index.js';
import { createSvg, createLine, createGroup } from '../utils/svg.js';

/**
 * Options for AnimCJK renderer
 */
export interface AnimCJKRendererOptions {
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
 * SVG renderer for AnimCJK character data.
 *
 * Embeds the native AnimCJK SVG with its shape outlines and clip-path
 * definitions, but strips the embedded animation CSS. Strokes are
 * controlled via CSS class toggling — adding "visible" to a stroke
 * path reveals it through its clip region.
 */
export class AnimCJKRenderer implements Renderer {
  private container: HTMLElement;
  private svg: SVGSVGElement | null = null;
  private renderedStrokes: RenderedStroke[] = [];
  private width: number | string;
  private height: number | string;

  constructor(options: AnimCJKRendererOptions) {
    this.container = options.container;
    this.width = options.size ?? options.width ?? 200;
    this.height = options.size ?? options.height ?? 200;
  }

  /**
   * Render character by embedding native AnimCJK SVG
   */
  render(data: CharacterData, options: RenderOptions = {}): RenderedStroke[] {
    this.clear();

    if (!data.rawSvg) {
      throw new Error('AnimCJKRenderer requires rawSvg in CharacterData');
    }

    const {
      strokeColor = '#000',
      showGrid = false,
      gridColor = '#ccc',
      showOutline = false,
      outlineColor = '#ccc',
    } = options;

    // Parse the raw SVG
    const parser = new DOMParser();
    const doc = parser.parseFromString(data.rawSvg, 'image/svg+xml');
    const sourceSvg = doc.querySelector('svg');
    if (!sourceSvg) {
      throw new Error('No SVG element in rawSvg');
    }

    // Create our own SVG with proper sizing
    this.svg = createSvg(data.viewBox, this.width, this.height);

    // Add grid if requested
    if (showGrid) {
      this.addGrid(data.viewBox, gridColor);
    }

    // Remove embedded <style> — we control visibility ourselves
    const styles = sourceSvg.querySelectorAll('style');
    for (const style of styles) {
      style.remove();
    }

    // Add our control CSS
    const styleEl = doc.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = [
      // Shape outlines: shown or hidden based on option
      showOutline
        ? `path[id] { fill: ${outlineColor}; }`
        : `path[id] { fill: none; }`,
      // Stroke paths: colored but hidden via dashoffset (set per-element in JS)
      `path[clip-path] { stroke: ${strokeColor}; stroke-width: 128; stroke-linecap: round; fill: none; }`,
    ].join('\n');
    this.svg.appendChild(styleEl);

    // Copy all children from source SVG into our SVG
    for (const child of Array.from(sourceSvg.childNodes)) {
      this.svg.appendChild(document.importNode(child, true));
    }

    // Find stroke paths (those with clip-path attribute) and group by delay
    const strokePaths = Array.from(
      this.svg.querySelectorAll('path[clip-path]'),
    ) as SVGPathElement[];

    // Group by --d delay (same logic as provider)
    const strokeGroups = new Map<number, SVGPathElement[]>();
    for (const path of strokePaths) {
      const delay = this.extractDelay(path);
      if (!strokeGroups.has(delay)) {
        strokeGroups.set(delay, []);
      }
      strokeGroups.get(delay)!.push(path);
    }

    const sortedDelays = [...strokeGroups.keys()].sort((a, b) => a - b);

    // Create RenderedStroke wrappers
    this.renderedStrokes = sortedDelays.map((delay, index) => {
      const paths = strokeGroups.get(delay)!;
      const stroke = data.strokes[index];

      return this.createRenderedStroke(paths, stroke);
    });

    this.container.appendChild(this.svg);
    return this.renderedStrokes;
  }

  getSvg(): SVGSVGElement {
    if (!this.svg) {
      throw new Error('No SVG element - call render() first');
    }
    return this.svg;
  }

  clear(): void {
    if (this.svg && this.svg.parentNode) {
      this.svg.parentNode.removeChild(this.svg);
    }
    this.svg = null;
    this.renderedStrokes = [];
  }

  dispose(): void {
    this.clear();
  }

  /**
   * Create a RenderedStroke with dashoffset-based draw animation.
   *
   * Each path element gets stroke-dasharray/dashoffset initialized so
   * setProgress(0) = fully hidden, setProgress(1) = fully revealed.
   * For multi-part strokes, all parts animate together.
   */
  private createRenderedStroke(
    pathElements: SVGPathElement[],
    stroke: CharacterData['strokes'][0],
  ): RenderedStroke {
    const element = pathElements[0];

    // Compute path lengths and initialize dashoffset for each part.
    // AnimCJK uses pathLength="3333" with dasharray 3337 — we use the
    // same normalized value so the sweep speed is consistent.
    const pathLength = 3337;
    for (const p of pathElements) {
      p.style.strokeDasharray = String(pathLength);
      p.style.strokeDashoffset = String(pathLength);
      p.style.opacity = '1';
    }

    return {
      element,
      length: pathLength,
      stroke,

      setProgress(progress: number) {
        const clamped = Math.max(0, Math.min(1, progress));
        const offset = pathLength * (1 - clamped);
        for (const p of pathElements) {
          p.style.strokeDashoffset = String(offset);
        }
      },

      setTransition(duration: number, easing = 'ease') {
        for (const p of pathElements) {
          p.style.transition = `stroke-dashoffset ${duration}s ${easing}`;
        }
      },

      clearTransition() {
        for (const p of pathElements) {
          p.style.transition = 'none';
        }
      },

      setOpacity(opacity: number) {
        const clamped = Math.max(0, Math.min(1, opacity));
        for (const p of pathElements) {
          p.style.opacity = String(clamped);
        }
      },

      setOpacityTransition(duration: number, easing = 'ease') {
        for (const p of pathElements) {
          p.style.transition = `opacity ${duration}s ${easing}`;
        }
      },

      clearOpacityTransition() {
        for (const p of pathElements) {
          p.style.transition = 'none';
        }
      },
    };
  }

  private extractDelay(path: Element): number {
    const style = path.getAttribute('style') || '';
    const match = style.match(/--d:\s*([\d.]+)s/);
    return match ? parseFloat(match[1]) : 0;
  }

  private addGrid(
    viewBox: [number, number, number, number],
    gridColor: string,
  ): void {
    if (!this.svg) return;

    const [minX, minY, width, height] = viewBox;
    const midX = minX + width / 2;
    const midY = minY + height / 2;

    const gridGroup = createGroup();

    gridGroup.appendChild(
      createLine(midX, minY, midX, minY + height, {
        stroke: gridColor,
        'stroke-width': 0.5,
      }),
    );

    gridGroup.appendChild(
      createLine(minX, midY, minX + width, midY, {
        stroke: gridColor,
        'stroke-width': 0.5,
      }),
    );

    this.svg.appendChild(gridGroup);
  }
}
