import type { Kaku, CharacterData } from 'kaku';
import { StrokeInput } from './stroke-input.js';
import { evaluateStroke, resamplePoints } from './stroke-evaluator.js';
import { samplePathData } from './path-utils.js';
import type { Point, EvaluationResult, EvaluatorOptions } from './types.js';

export interface KakuRenOptions {
  /** Kaku instance to overlay practice on */
  kaku: Kaku;
  /** Container element (must contain the Kaku SVG) */
  container: HTMLElement;
  /** Canvas width in CSS pixels */
  width: number;
  /** Canvas height in CSS pixels */
  height: number;
  /** Drawing stroke color (default: '#333') */
  strokeColor?: string;
  /** Drawing stroke width (default: 4) */
  strokeWidth?: number;
  /** Evaluation options */
  evaluation?: EvaluatorOptions;
  /** Max consecutive failures before showing hint (default: 3) */
  maxFailures?: number;
  /** Duration of morph animation in ms (default: 150) */
  morphDuration?: number;
  /** Called when a stroke is accepted */
  onAccept?: (index: number, result: EvaluationResult) => void;
  /** Called when a stroke is rejected */
  onReject?: (index: number, result: EvaluationResult) => void;
  /** Called when a hint is shown */
  onHint?: (index: number) => void;
  /** Called when all strokes are completed */
  onComplete?: (averageScore: number) => void;
}

/**
 * KakuRen — stroke practice orchestrator.
 * Overlays a drawing canvas on a Kaku instance and evaluates user input.
 */
export class KakuRen {
  private kaku: Kaku;
  private input: StrokeInput;
  private container: HTMLElement;
  private scores: number[] = [];
  private failedAttempts = 0;
  private disposed = false;

  private readonly width: number;
  private readonly height: number;
  private readonly maxFailures: number;
  private readonly morphDuration: number;
  private readonly evaluationOptions: EvaluatorOptions;
  private readonly onAccept?: (index: number, result: EvaluationResult) => void;
  private readonly onReject?: (index: number, result: EvaluationResult) => void;
  private readonly onHint?: (index: number) => void;
  private readonly onComplete?: (averageScore: number) => void;

  constructor(options: KakuRenOptions) {
    this.kaku = options.kaku;
    this.container = options.container;
    this.width = options.width;
    this.height = options.height;
    this.maxFailures = options.maxFailures ?? 3;
    this.morphDuration = options.morphDuration ?? 150;
    this.evaluationOptions = options.evaluation ?? {};
    this.onAccept = options.onAccept;
    this.onReject = options.onReject;
    this.onHint = options.onHint;
    this.onComplete = options.onComplete;

    this.input = new StrokeInput({
      container: options.container,
      width: options.width,
      height: options.height,
      strokeColor: options.strokeColor,
      strokeWidth: options.strokeWidth,
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

  /** Reset practice state (scores, failures) without reloading */
  reset(): void {
    this.scores = [];
    this.failedAttempts = 0;
    this.input.clear();
    this.kaku.reset();
  }

  /** Dispose and clean up */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.input.dispose();
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

    // Sample expected stroke points from path data
    const { points: expectedPoints, length: expectedLength } = samplePathData(stroke.pathData, N);

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
      this.failedAttempts = 0;

      await this.kaku.nextStroke();
      this.onAccept?.(strokeIndex, result);

      // Check completion
      if (this.kaku.currentStroke >= this.kaku.totalStrokes) {
        this.onComplete?.(this.averageScore);
      }
    } else {
      // Rejection feedback
      this.flashReject();
      this.failedAttempts++;
      this.onReject?.(strokeIndex, result);

      if (this.failedAttempts >= this.maxFailures) {
        await this.showHint(strokeIndex, charData, scaleFactor);
      }
    }

    // Re-enable input (unless completed)
    if (this.kaku.currentStroke < this.kaku.totalStrokes) {
      this.input.enabled = true;
    }
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
   * Flash the container to indicate rejection.
   */
  private flashReject(): void {
    this.container.classList.add('kaku-ren-reject');
    setTimeout(() => {
      this.container.classList.remove('kaku-ren-reject');
      this.input.clear();
    }, 300);
  }

  /**
   * Show a hint by briefly animating the next expected stroke.
   */
  private async showHint(
    strokeIndex: number,
    charData: CharacterData,
    scaleFactor: number,
  ): Promise<void> {
    this.onHint?.(strokeIndex);

    const stroke = charData.strokes[strokeIndex];
    const { points: sampledPoints } = samplePathData(stroke.pathData, 50);

    // Convert to canvas space
    const points = sampledPoints.map(p => ({
      x: p.x * scaleFactor,
      y: p.y * scaleFactor,
    }));

    // Animate drawing the hint stroke progressively
    const duration = 500;
    const startTime = performance.now();

    return new Promise((resolve) => {
      const animate = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        const count = Math.max(2, Math.round(t * points.length));
        const visible = points.slice(0, count);

        this.input.clear();
        this.input.drawPoints(visible, 'rgba(100, 100, 100, 0.3)', 6);

        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          // Hold briefly then clear
          setTimeout(() => {
            this.input.clear();
            resolve();
          }, 300);
        }
      };

      requestAnimationFrame(animate);
    });
  }

}
