import type { Point } from './types.js';

export interface StrokeInputOptions {
  /** Container element to overlay the canvas on */
  container: HTMLElement;
  /** Canvas width in CSS pixels */
  width: number;
  /** Canvas height in CSS pixels */
  height: number;
  /** Stroke color for drawing feedback (default: '#333') */
  strokeColor?: string;
  /** Stroke width in CSS pixels (default: 4) */
  strokeWidth?: number;
  /** Called when user finishes a stroke */
  onStrokeEnd?: (points: Point[]) => void;
}

/**
 * Canvas overlay that captures user drawing input via pointer events.
 */
export class StrokeInput {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private points: Point[] = [];
  private drawing = false;
  private _enabled = true;

  private readonly strokeColor: string;
  private readonly strokeWidth: number;
  private readonly onStrokeEnd?: (points: Point[]) => void;

  // Bound handlers for cleanup
  private handlePointerDown: (e: PointerEvent) => void;
  private handlePointerMove: (e: PointerEvent) => void;
  private handlePointerUp: (e: PointerEvent) => void;

  constructor(options: StrokeInputOptions) {
    this.strokeColor = options.strokeColor ?? '#333';
    this.strokeWidth = options.strokeWidth ?? 4;
    this.onStrokeEnd = options.onStrokeEnd;

    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = options.width * devicePixelRatio;
    this.canvas.height = options.height * devicePixelRatio;
    this.canvas.style.width = `${options.width}px`;
    this.canvas.style.height = `${options.height}px`;
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.zIndex = '10';
    this.canvas.style.touchAction = 'none'; // Prevent scroll/zoom on touch
    this.canvas.style.cursor = 'crosshair';

    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(devicePixelRatio, devicePixelRatio);

    // Ensure container is positioned for overlay
    const position = getComputedStyle(options.container).position;
    if (position === 'static') {
      options.container.style.position = 'relative';
    }
    options.container.appendChild(this.canvas);

    // Bind pointer events
    this.handlePointerDown = this.onPointerDown.bind(this);
    this.handlePointerMove = this.onPointerMove.bind(this);
    this.handlePointerUp = this.onPointerUp.bind(this);

    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
  }

  /** Whether input capture is enabled */
  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(value: boolean) {
    this._enabled = value;
    this.canvas.style.pointerEvents = value ? 'auto' : 'none';
  }

  /** Get the canvas element */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /** Clear the canvas */
  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Draw an array of points on the canvas using smooth Bézier curves.
   */
  drawPoints(points: Point[], color?: string, width?: number): void {
    if (points.length < 2) return;

    const ctx = this.ctx;
    ctx.strokeStyle = color ?? this.strokeColor;
    ctx.lineWidth = width ?? this.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length - 1; i++) {
      const midX = (points[i].x + points[i + 1].x) / 2;
      const midY = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
    }

    // Draw to last point
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }

  /** Dispose and remove the canvas */
  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.remove();
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this._enabled) return;

    this.drawing = true;
    this.points = [];
    this.clear();

    this.canvas.setPointerCapture(e.pointerId);
    const pos = this.getPointerPos(e);
    this.points.push(pos);
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.drawing) return;

    const pos = this.getPointerPos(e);
    this.points.push(pos);
    this.redraw();
  }

  private onPointerUp(_e: PointerEvent): void {
    if (!this.drawing) return;

    this.drawing = false;

    if (this.points.length >= 2) {
      this.onStrokeEnd?.(this.points.slice());
    }
  }

  private getPointerPos(e: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  private redraw(): void {
    this.clear();
    this.drawPoints(this.points);
  }
}
