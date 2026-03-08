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
  /** Width of the SVG (CSS value) */
  width?: number | string;
  /** Height of the SVG (CSS value) */
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
    this.width = options.width ?? 200;
    this.height = options.height ?? 200;
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
      // Stroke paths: hidden by default
      `path[clip-path] { stroke: transparent; stroke-width: 128; stroke-linecap: round; fill: none; }`,
      // Visible stroke paths
      `path[clip-path].visible { stroke: ${strokeColor}; }`,
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
   * Create a RenderedStroke that controls visibility via CSS class toggling.
   *
   * setProgress(0) = hidden, setProgress(>0) = visible.
   * Transitions are no-ops since visibility is instant (CSS class toggle).
   */
  private createRenderedStroke(
    pathElements: SVGPathElement[],
    stroke: CharacterData['strokes'][0],
  ): RenderedStroke {
    // Use the first path element as the canonical element
    const element = pathElements[0];

    return {
      element,
      length: 0, // Not meaningful for class-toggled strokes
      stroke,

      setProgress(progress: number) {
        const visible = progress > 0;
        for (const p of pathElements) {
          p.classList.toggle('visible', visible);
        }
      },

      setTransition() {
        // No-op: visibility toggle is instant
      },

      clearTransition() {
        // No-op
      },

      setOpacity(opacity: number) {
        for (const p of pathElements) {
          p.style.opacity = String(Math.max(0, Math.min(1, opacity)));
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
