import type {
  DataProvider,
  CharacterData,
  Renderer,
  AnimatorOptions,
  AnimationState,
  AnimationEventType,
  AnimationEventHandler,
  RenderOptions,
  RenderedStroke,
} from '../types/index.js';
import { SvgRenderer } from '../renderer/svg-renderer.js';
import { StrokeAnimator } from '../animator/stroke-animator.js';
import { getCodePoints } from '../utils/unicode.js';

/**
 * Options for Kaku instance
 */
export interface KakuOptions {
  /** Data provider for character stroke data */
  provider: DataProvider;
  /** Container element to render into */
  container: HTMLElement;
  /** Custom renderer (defaults to SvgRenderer) */
  renderer?: Renderer;
  /** Width of the SVG (CSS value) */
  width?: number | string;
  /** Height of the SVG (CSS value) */
  height?: number | string;
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
  /** Animation options */
  animation?: AnimatorOptions;
}

/**
 * Main Kaku class - orchestrates provider, renderer, and animator
 */
export class Kaku {
  private provider: DataProvider;
  private renderer: Renderer;
  private animator: StrokeAnimator;
  private renderOptions: RenderOptions;
  private characterData: CharacterData | null = null;
  private disposed = false;

  constructor(options: KakuOptions) {
    this.provider = options.provider;

    this.renderer = options.renderer ?? new SvgRenderer({
      container: options.container,
      width: options.width,
      height: options.height,
    });

    this.animator = new StrokeAnimator(options.animation);

    this.renderOptions = {
      strokeColor: options.strokeColor,
      strokeWidth: options.strokeWidth,
      showGrid: options.showGrid,
      gridColor: options.gridColor,
      showOutline: options.showOutline,
      outlineColor: options.outlineColor,
    };
  }

  /**
   * Current animation state
   */
  get state(): AnimationState {
    return this.animator.state;
  }

  /**
   * Current stroke index
   */
  get currentStroke(): number {
    return this.animator.currentStroke;
  }

  /**
   * Total number of strokes
   */
  get totalStrokes(): number {
    return this.animator.totalStrokes;
  }

  /**
   * Currently loaded character
   */
  get character(): string | null {
    return this.characterData?.character ?? null;
  }

  /**
   * Load and render a character
   * @param char - The character to load
   * @throws Error if character cannot be loaded
   */
  async load(char: string): Promise<void> {
    if (this.disposed) {
      throw new Error('Kaku instance has been disposed');
    }

    const codePoints = getCodePoints(char);
    if (codePoints.length !== 1) {
      throw new Error(`Kaku.load expects a single code point, got ${codePoints.length}`);
    }

    // Check if provider can handle this character
    if (!this.provider.canHandle(char)) {
      throw new Error(`Provider ${this.provider.id} cannot handle character: ${char}`);
    }

    // Fetch character data
    const result = await this.provider.getCharacter(char);
    if (!result.success) {
      throw result.error;
    }

    this.characterData = result.data;

    // Render strokes
    const renderedStrokes = this.renderer.render(
      this.characterData,
      this.renderOptions
    );

    // Initialize animator with rendered strokes
    this.animator.setStrokes(renderedStrokes);
  }

  /**
   * Start or resume animation
   */
  play(): void {
    this.animator.play();
  }

  /**
   * Pause animation
   */
  pause(): void {
    this.animator.pause();
  }

  /**
   * Reset animation to beginning
   */
  reset(): void {
    this.animator.reset();
  }

  /**
   * Advance to next stroke (manual mode)
   * @returns Promise that resolves when stroke animation completes
   */
  nextStroke(): Promise<void> {
    return this.animator.nextStroke();
  }

  /**
   * Go back to previous stroke (manual mode)
   */
  previousStroke(): void {
    this.animator.previousStroke();
  }

  /**
   * Subscribe to animation events
   * @param event - Event type to listen for
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  on(event: AnimationEventType, handler: AnimationEventHandler): () => void {
    return this.animator.on(event, handler);
  }

  /**
   * Get the SVG element
   */
  getSvg(): SVGSVGElement {
    return this.renderer.getSvg();
  }

  /**
   * Get the loaded character data
   */
  getCharacterData(): CharacterData | null {
    return this.characterData;
  }

  /**
   * Dispose instance and clean up
   */
  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.animator.dispose();
    this.renderer.dispose();
    this.characterData = null;
  }
}
