import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StrokeInput } from '../../src/stroke-input.js';
import type { Point } from '../../src/types.js';

// Mock devicePixelRatio
Object.defineProperty(globalThis, 'devicePixelRatio', { value: 1, writable: true });

function createContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function firePointerEvent(
  target: EventTarget,
  type: string,
  x: number,
  y: number,
  pointerId = 1,
): void {
  const event = new PointerEvent(type, {
    clientX: x,
    clientY: y,
    pointerId,
    bubbles: true,
  });
  target.dispatchEvent(event);
}

describe('StrokeInput', () => {
  let container: HTMLElement;
  let input: StrokeInput;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    input?.dispose();
    container.remove();
  });

  it('creates a canvas and appends to container', () => {
    input = new StrokeInput({ container, width: 200, height: 200 });

    const canvas = input.getCanvas();
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(container.contains(canvas)).toBe(true);
  });

  it('sets canvas dimensions correctly', () => {
    input = new StrokeInput({ container, width: 300, height: 300 });

    const canvas = input.getCanvas();
    expect(canvas.style.width).toBe('300px');
    expect(canvas.style.height).toBe('300px');
  });

  it('sets container to position:relative if static', () => {
    container.style.position = 'static';
    input = new StrokeInput({ container, width: 200, height: 200 });

    expect(container.style.position).toBe('relative');
  });

  it('does not override non-static container positioning', () => {
    container.style.position = 'absolute';
    input = new StrokeInput({ container, width: 200, height: 200 });

    expect(container.style.position).toBe('absolute');
  });

  it('calls onStrokeEnd with captured points', () => {
    const onStrokeEnd = vi.fn();
    input = new StrokeInput({ container, width: 200, height: 200, onStrokeEnd });

    const canvas = input.getCanvas();

    // Mock getBoundingClientRect
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 200, bottom: 200,
      width: 200, height: 200, x: 0, y: 0, toJSON: () => ({}),
    });

    firePointerEvent(canvas, 'pointerdown', 10, 20);
    firePointerEvent(canvas, 'pointermove', 30, 40);
    firePointerEvent(canvas, 'pointermove', 50, 60);
    firePointerEvent(window, 'pointerup', 50, 60);

    expect(onStrokeEnd).toHaveBeenCalledOnce();
    const points: Point[] = onStrokeEnd.mock.calls[0][0];
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({ x: 10, y: 20 });
    expect(points[1]).toEqual({ x: 30, y: 40 });
    expect(points[2]).toEqual({ x: 50, y: 60 });
  });

  it('does not fire onStrokeEnd for single point (tap)', () => {
    const onStrokeEnd = vi.fn();
    input = new StrokeInput({ container, width: 200, height: 200, onStrokeEnd });

    const canvas = input.getCanvas();
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 200, bottom: 200,
      width: 200, height: 200, x: 0, y: 0, toJSON: () => ({}),
    });
    firePointerEvent(canvas, 'pointerdown', 10, 20);
    firePointerEvent(window, 'pointerup', 10, 20);

    expect(onStrokeEnd).not.toHaveBeenCalled();
  });

  it('does not capture input when disabled', () => {
    const onStrokeEnd = vi.fn();
    input = new StrokeInput({ container, width: 200, height: 200, onStrokeEnd });
    input.enabled = false;

    const canvas = input.getCanvas();
    firePointerEvent(canvas, 'pointerdown', 10, 20);
    firePointerEvent(canvas, 'pointermove', 30, 40);
    firePointerEvent(window, 'pointerup', 30, 40);

    expect(onStrokeEnd).not.toHaveBeenCalled();
  });

  it('can be re-enabled after disabling', () => {
    const onStrokeEnd = vi.fn();
    input = new StrokeInput({ container, width: 200, height: 200, onStrokeEnd });

    const canvas = input.getCanvas();
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 200, bottom: 200,
      width: 200, height: 200, x: 0, y: 0, toJSON: () => ({}),
    });
    canvas.setPointerCapture = vi.fn();

    input.enabled = false;
    input.enabled = true;

    firePointerEvent(canvas, 'pointerdown', 10, 20);
    firePointerEvent(canvas, 'pointermove', 30, 40);
    firePointerEvent(window, 'pointerup', 30, 40);

    expect(onStrokeEnd).toHaveBeenCalledOnce();
  });

  it('removes canvas on dispose', () => {
    input = new StrokeInput({ container, width: 200, height: 200 });

    const canvas = input.getCanvas();
    expect(container.contains(canvas)).toBe(true);

    input.dispose();
    expect(container.contains(canvas)).toBe(false);
  });

  it('clears the canvas', () => {
    input = new StrokeInput({ container, width: 200, height: 200 });

    const ctx = input.getCanvas().getContext('2d')!;
    const clearSpy = vi.spyOn(ctx, 'clearRect');

    input.clear();
    expect(clearSpy).toHaveBeenCalled();
  });
});
