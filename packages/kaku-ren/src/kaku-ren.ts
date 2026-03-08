import type { Kaku, CharacterData } from '@kaspars/kaku';
import { StrokeInput } from './stroke-input.js';
import { evaluateStroke, resamplePoints } from './stroke-evaluator.js';
import type { Point, EvaluationResult, EvaluatorOptions } from './types.js';

export interface KakuRenOptions {
  /** Kaku instance to overlay practice on */
  kaku: Kaku;
  /** Container element (must contain the Kaku SVG) */
  container: HTMLElement;
  /** Canvas size in CSS pixels (square) */
  size?: number;
  /**
   * @deprecated Use `size` instead.
   * Canvas width in CSS pixels
   */
  width?: number;
  /**
   * @deprecated Use `size` instead.
   * Canvas height in CSS pixels
   */
  height?: number;
  /** Drawing stroke color (default: '#333') */
  strokeColor?: string;
  /**
   * Drawing stroke width in CSS pixels.
   * If omitted, automatically computed to match the SVG stroke width.
   */
  strokeWidth?: number;
  /** Evaluation options */
  evaluation?: EvaluatorOptions;
  /** Duration of morph animation in ms (default: 80) */
  morphDuration?: number;
  /**
   * @deprecated Use Kaku's showOutline option instead.
   * Show faint guide strokes behind the drawing area (default: false)
   */
  showGuide?: boolean;
  /**
   * @deprecated Use Kaku's outlineColor option instead.
   * Color of guide strokes (default: '#ddd')
   */
  guideColor?: string;
  /** Color of hint strokes shown on rejection (default: '#c44') */
  hintColor?: string;
  /** Duration of hint draw animation in seconds (default: 0.6) */
  hintDuration?: number;
  /** Called when a stroke is accepted */
  onAccept?: (index: number, result: EvaluationResult) => void;
  /** Called when a stroke is rejected */
  onReject?: (index: number, result: EvaluationResult) => void;
  /** Called when all strokes are completed */
  onComplete?: (averageScore: number) => void;
}

/**
 * Sample N equidistant points along an SVG path data string.
 * Uses a temporary SVGPathElement for accurate Bézier curve sampling.
 */
function samplePathDataDOM(d: string, N: number): { points: Point[]; length: number } {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  svg.appendChild(path);
  // Temporarily add to DOM so geometry methods work
  document.body.appendChild(svg);

  try {
    const totalLength = path.getTotalLength();
    const points: Point[] = [];

    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const pos = path.getPointAtLength(totalLength * t);
      points.push({ x: pos.x, y: pos.y });
    }

    return { points, length: totalLength };
  } finally {
    document.body.removeChild(svg);
  }
}

/**
 * KakuRen — stroke practice orchestrator.
 * Overlays a drawing canvas on a Kaku instance and evaluates user input.
 */
export class KakuRen {
  private kaku: Kaku;
  private input: StrokeInput;
  private container: HTMLElement;
  private guideSvg: SVGSVGElement | null = null;
  private scores: number[] = [];
  private disposed = false;
  private options: KakuRenOptions;
  private sampledPointsCache: Map<string, { points: Point[]; length: number }> = new Map();

  private readonly width: number;
  private readonly height: number;
  private readonly morphDuration: number;
  private readonly evaluationOptions: EvaluatorOptions;
  private readonly guideColor: string;
  private readonly hintColor: string;
  private readonly hintDuration: number;
  private readonly onAccept?: (index: number, result: EvaluationResult) => void;
  private readonly onReject?: (index: number, result: EvaluationResult) => void;
  private readonly onComplete?: (averageScore: number) => void;

  constructor(options: KakuRenOptions) {
    this.options = options;
    this.kaku = options.kaku;
    this.container = options.container;
    this.width = options.size ?? options.width ?? 200;
    this.height = options.size ?? options.height ?? 200;
    this.morphDuration = options.morphDuration ?? 80;
    this.evaluationOptions = options.evaluation ?? {};
    this.guideColor = options.guideColor ?? '#ddd';
    this.hintColor = options.hintColor ?? '#c44';
    this.hintDuration = options.hintDuration ?? 0.6;
    this.onAccept = options.onAccept;
    this.onReject = options.onReject;
    this.onComplete = options.onComplete;

    // Auto-compute stroke width to match SVG if not explicitly provided
    const strokeWidth = options.strokeWidth ?? this.computeStrokeWidth();

    // Set up z-index layering on the Kaku SVG
    this.setupLayering();

    // Create guide overlay if requested (default: true)
    if (options.showGuide !== false) {
      this.createGuide();
    }

    this.input = new StrokeInput({
      container: options.container,
      width: this.width,
      height: this.height,
      strokeColor: options.strokeColor,
      strokeWidth,
      onStrokeEnd: (points) => this.handleStroke(points),
    });
  }

  /** Current stroke index */
  get currentStroke(): number {
    return this.kaku.currentStroke;
  }

  /** Total number of strokes */
  get totalStrokes(): number {
    return this.kaku.totalStrokes;
  }

  /** Average score across all accepted/rejected strokes */
  get averageScore(): number {
    if (this.scores.length === 0) return 0;
    return this.scores.reduce((sum, s) => sum + s, 0) / this.scores.length;
  }

  /** All scores so far */
  get allScores(): readonly number[] {
    return this.scores;
  }

  /** Enable or disable drawing input */
  set enabled(value: boolean) {
    this.input.enabled = value;
  }

  get enabled(): boolean {
    return this.input.enabled;
  }

  /** Show or hide the guide stroke overlay */
  set guide(visible: boolean) {
    if (this.guideSvg) {
      this.guideSvg.style.display = visible ? '' : 'none';
    }
  }

  get guide(): boolean {
    return this.guideSvg ? this.guideSvg.style.display !== 'none' : false;
  }

  /** Reset practice state (scores, failures) without reloading */
  reset(): void {
    this.scores = [];
    this.input.clear();
    this.input.enabled = true;
    this.kaku.reset();
  }

  /**
   * Refresh the practice overlay (e.g. after loading a new character in Kaku).
   * Re-creates the guide and clears scores.
   */
  refresh(): void {
    if (this.guideSvg) {
      this.guideSvg.remove();
      this.guideSvg = null;
    }
    this.sampledPointsCache.clear();
    this.scores = [];
    this.input.clear();
    this.input.enabled = true;

    if (this.options.showGuide !== false) {
      this.createGuide();
    }

    // Update stroke width in case it changed
    if (!this.options.strokeWidth) {
      this.input.setStrokeWidth(this.computeStrokeWidth());
    }
  }

  /** Dispose and clean up */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.input.dispose();
    if (this.guideSvg) {
      this.guideSvg.remove();
      this.guideSvg = null;
    }
    this.sampledPointsCache.clear();
  }

  /**
   * Debug mode: play all stroke hints one by one on the canvas.
   * Useful for verifying that sampled paths match the actual strokes.
   */
  async playHints(): Promise<void> {
    const charData = this.kaku.getCharacterData();
    if (!charData) return;

    this.input.enabled = false;
    const viewBoxWidth = charData.viewBox[2];
    const scaleFactor = this.width / viewBoxWidth;

    for (let i = 0; i < charData.strokes.length; i++) {
      await this.showHint(i, charData, scaleFactor);
      // Brief pause between strokes
      await new Promise(r => setTimeout(r, 200));
    }

    this.input.enabled = true;
  }

  /**
   * Compute canvas stroke width to match the Kaku SVG stroke width.
   * SVG strokes are in viewBox units; scale to CSS pixels.
   */
  private computeStrokeWidth(): number {
    const charData = this.kaku.getCharacterData();
    if (!charData) return 4;

    const viewBoxWidth = charData.viewBox[2];
    const scaleFactor = this.width / viewBoxWidth;

    // Read stroke-width from the Kaku SVG
    const svg = this.kaku.getSvg();
    const svgPath = svg?.querySelector('path');
    
    // getComputedStyle for SVG strokeWidth usually returns the value in user units
    // (the units defined in the viewBox), not resolved screen pixels.
    // Thus we need to scale it by our canvas-to-viewbox ratio.
    const svgStrokeWidth = svgPath
      ? parseFloat(getComputedStyle(svgPath).strokeWidth) || 3
      : 3;

    return Math.round(svgStrokeWidth * scaleFactor);
  }

  /**
   * Set up z-index layering so Kaku SVG sits above the guide
   * but below the drawing canvas.
   */
  private setupLayering(): void {
    const svg = this.kaku.getSvg();
    if (svg) {
      svg.style.position = 'relative';
      svg.style.zIndex = '2';
    }
  }

  /**
   * Create a faint guide SVG showing all stroke paths.
   */
  private createGuide(): void {
    const charData = this.kaku.getCharacterData();
    if (!charData) return;

    const [vx, vy, vw, vh] = charData.viewBox;
    const guideSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    guideSvg.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);
    guideSvg.setAttribute('width', String(this.width));
    guideSvg.setAttribute('height', String(this.height));
    guideSvg.style.position = 'absolute';
    guideSvg.style.top = '0';
    guideSvg.style.left = '0';
    guideSvg.style.zIndex = '1';
    guideSvg.style.pointerEvents = 'none';

    // Read stroke width from Kaku SVG to match
    const kakuSvg = this.kaku.getSvg();
    const kakuPath = kakuSvg?.querySelector('path');
    const strokeWidth = kakuPath
      ? getComputedStyle(kakuPath).strokeWidth || '3'
      : '3';

    for (const stroke of charData.strokes) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', stroke.pathData);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', this.guideColor);
      path.setAttribute('stroke-width', strokeWidth);
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      guideSvg.appendChild(path);
    }

    this.container.appendChild(guideSvg);
    this.guideSvg = guideSvg;
  }

  private async handleStroke(userPoints: Point[]): Promise<void> {
    const charData = this.kaku.getCharacterData();
    if (!charData) return;

    const strokeIndex = this.kaku.currentStroke;
    if (strokeIndex >= charData.strokes.length) return;

    // Disable input during evaluation
    this.input.enabled = false;

    const stroke = charData.strokes[strokeIndex];
    const viewBoxWidth = charData.viewBox[2];
    const scaleFactor = this.width / viewBoxWidth;
    const N = this.evaluationOptions.sampleCount ?? 50;

    // Sample expected stroke points (using cache)
    const { points: expectedPoints, length: expectedLength } = this.getSampledPoints(stroke.pathData, N);

    // Evaluate
    const result = evaluateStroke(
      userPoints,
      expectedPoints,
      expectedLength,
      scaleFactor,
      this.evaluationOptions,
    );

    this.scores.push(result.score);

    if (result.accepted) {
      // Morph user drawing into correct stroke, then advance
      const correctCanvasPoints = expectedPoints.map(p => ({
        x: p.x * scaleFactor,
        y: p.y * scaleFactor,
      }));
      await this.morphStroke(userPoints, correctCanvasPoints);
      this.input.clear();

      await this.kaku.nextStroke();
      this.onAccept?.(strokeIndex, result);

      // Check completion
      if (this.kaku.currentStroke >= this.kaku.totalStrokes) {
        this.onComplete?.(this.averageScore);
      }
    } else {
      // Rejection: clear user stroke and show hint
      this.input.clear();
      this.onReject?.(strokeIndex, result);
      await this.showHint(strokeIndex, charData, scaleFactor);
    }

    // Re-enable input (unless completed)
    if (this.kaku.currentStroke < this.kaku.totalStrokes) {
      this.input.enabled = true;
    }
  }

  /**
   * Get sampled points for a stroke, using cache if available.
   */
  private getSampledPoints(pathData: string, N: number): { points: Point[]; length: number } {
    const cacheKey = `${pathData}:${N}`;
    const cached = this.sampledPointsCache.get(cacheKey);
    if (cached) return cached;

    const sampled = samplePathDataDOM(pathData, N);
    this.sampledPointsCache.set(cacheKey, sampled);
    return sampled;
  }

  /**
   * Animate user-drawn points morphing into the correct stroke points.
   */
  private morphStroke(
    userPoints: Point[],
    targetPoints: Point[],
  ): Promise<void> {
    const N = targetPoints.length;
    const resampled = resamplePoints(userPoints, N);

    return new Promise((resolve) => {
      const startTime = performance.now();
      const duration = this.morphDuration;

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);

        // Interpolate between user and correct points
        const interpolated = resampled.map((p, i) => ({
          x: p.x + (targetPoints[i].x - p.x) * t,
          y: p.y + (targetPoints[i].y - p.y) * t,
        }));

        this.input.clear();
        this.input.drawPoints(interpolated);

        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  /**
   * Show a hint by animating the rendered stroke in the correct direction.
   */
  private async showHint(
    strokeIndex: number,
    _charData: CharacterData,
    _scaleFactor: number,
  ): Promise<void> {
    const renderedStrokes = this.kaku.getRenderedStrokes();
    const rendered = renderedStrokes[strokeIndex];
    if (!rendered) return;

    const el = rendered.element;
    const origStroke = el.style.stroke;

    // Set hint color and prepare for draw animation
    el.style.stroke = this.hintColor;
    rendered.clearTransition();
    rendered.setProgress(0);
    rendered.setOpacity(1);

    // Force reflow so the progress=0 state is committed before transition
    el.getBoundingClientRect();

    // Animate: draw the stroke from start to end
    rendered.setTransition(this.hintDuration, 'ease-in-out');
    rendered.setProgress(1);

    const durationMs = this.hintDuration * 1000;

    // Wait for draw animation + brief hold
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        // Hide and restore
        rendered.clearTransition();
        rendered.setProgress(0);
        rendered.setOpacity(1);
        el.style.stroke = origStroke;
        resolve();
      }, durationMs + 300);
    });
  }

}
