import type { CharacterData, Stroke } from './character.js';

/**
 * Options for rendering
 */
export interface RenderOptions {
  /** Stroke color */
  strokeColor?: string;
  /** Stroke width */
  strokeWidth?: number;
  /** Show grid lines */
  showGrid?: boolean;
  /** Grid line color */
  gridColor?: string;
  /** Show character outline (all strokes as faint background) */
  showOutline?: boolean;
  /** Outline color (default: '#ccc') */
  outlineColor?: string;
}

/**
 * A rendered stroke path that can be animated
 */
export interface RenderedStroke {
  /** The SVG path element */
  element: SVGPathElement;
  /** Total length of the path */
  length: number;
  /** Set the visible progress (0-1) for draw effect */
  setProgress(progress: number): void;
  /** Set CSS transition for stroke-dashoffset animation */
  setTransition(duration: number, easing?: string): void;
  /** Clear CSS transition for stroke-dashoffset */
  clearTransition(): void;
  /** Set opacity (0-1) for fade effect */
  setOpacity(opacity: number): void;
  /** Set CSS transition for opacity animation */
  setOpacityTransition(duration: number, easing?: string): void;
  /** Clear CSS transition for opacity */
  clearOpacityTransition(): void;
  /** The original stroke data */
  stroke: Stroke;
}

/**
 * Options handed to a renderer factory. Mirrors the shape of the bundled
 * renderer option interfaces, so `(options) => new AnimCJKRenderer(options)`
 * works without adapting anything.
 */
export interface RendererFactoryOptions {
  /** Container element to render into */
  container: HTMLElement;
  /** Size of the SVG in pixels (square) */
  size?: number;
  /** Width of the SVG (CSS value) */
  width?: number | string;
  /** Height of the SVG (CSS value) */
  height?: number | string;
}

/**
 * Builds a renderer from the container and sizing Kaku already holds, so those
 * values are declared once instead of being repeated on both the Kaku instance
 * and a pre-built renderer (where they can silently disagree).
 */
export type RendererFactory = (options: RendererFactoryOptions) => Renderer;

/**
 * Renderer interface for stroke visualization
 */
export interface Renderer {
  /**
   * Render character strokes to the container
   * @param data - Character data to render
   * @param options - Render options
   * @returns Array of rendered strokes
   */
  render(data: CharacterData, options?: RenderOptions): RenderedStroke[];

  /**
   * Get the SVG element
   */
  getSvg(): SVGSVGElement;

  /**
   * Clear rendered content
   */
  clear(): void;

  /**
   * Dispose renderer and clean up
   */
  dispose(): void;
}
