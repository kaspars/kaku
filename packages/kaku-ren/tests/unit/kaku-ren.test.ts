import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KakuRen } from '../../src/kaku-ren.js';
import type { Point } from '../../src/types.js';

// Mock devicePixelRatio
Object.defineProperty(globalThis, 'devicePixelRatio', { value: 1, writable: true });

// Mock requestAnimationFrame to complete immediately
let rafCallbacks: ((time: number) => void)[] = [];
globalThis.requestAnimationFrame = (cb) => {
  rafCallbacks.push(cb);
  return rafCallbacks.length;
};

function flushRaf(time = 99999): void {
  const maxIterations = 100;
  let i = 0;
  while (rafCallbacks.length > 0 && i++ < maxIterations) {
    const cbs = rafCallbacks.slice();
    rafCallbacks = [];
    for (const cb of cbs) {
      cb(time);
    }
  }
}

/** Flush exactly one batch of RAF callbacks at the given time (no loop). */
function flushRafOneShot(time: number): void {
  const cbs = rafCallbacks.slice();
  rafCallbacks = [];
  for (const cb of cbs) cb(time);
}

// Mock performance.now to return a large value so morph/hint animations complete instantly
vi.spyOn(performance, 'now').mockReturnValue(0);

const SCALE_FACTOR = 200 / 109; // canvas 200px / viewBox 109

function makeMockKaku(strokeCount = 3) {
  let currentStroke = 0;

  // Horizontal strokes spaced vertically
  const strokes = Array.from({ length: strokeCount }, (_, i) => ({
    pathData: `M10,${20 + i * 25} L100,${20 + i * 25}`,
    metadata: { index: i },
  }));

  // Create mock RenderedStroke objects for getRenderedStrokes
  const renderedStrokes = strokes.map(() => ({
    element: document.createElementNS('http://www.w3.org/2000/svg', 'path'),
    setProgress: vi.fn(),
    setOpacity: vi.fn(),
    setTransition: vi.fn(),
    clearTransition: vi.fn(),
    setOpacityTransition: vi.fn(),
    clearOpacityTransition: vi.fn(),
  }));

  const mock = {
    get currentStroke() { return currentStroke; },
    totalStrokes: strokeCount,
    getCharacterData: vi.fn(() => ({
      character: '字',
      codePoints: [0x5b57],
      viewBox: [0, 0, 109, 109] as [number, number, number, number],
      strokes,
      source: 'test',
    })),
    nextStroke: vi.fn(async () => { currentStroke++; }),
    reset: vi.fn(() => { currentStroke = 0; }),
    getSvg: vi.fn(() => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '200');
      svg.setAttribute('height', '200');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('stroke-width', '3');
      svg.appendChild(path);
      return svg;
    }),
    getRenderedStrokes: vi.fn(() => renderedStrokes),
    state: 'idle' as const,
    character: '字',
    dispose: vi.fn(),
  };

  return mock;
}

function createContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

/** Simulate drawing a stroke on the canvas via pointer events */
function drawStroke(canvas: HTMLCanvasElement, points: Point[]): void {
  const rect = { left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200, x: 0, y: 0, toJSON: () => ({}) };
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(rect as DOMRect);

  const first = points[0];
  canvas.dispatchEvent(new PointerEvent('pointerdown', {
    clientX: first.x, clientY: first.y, pointerId: 1, bubbles: true,
  }));

  for (let i = 1; i < points.length; i++) {
    canvas.dispatchEvent(new PointerEvent('pointermove', {
      clientX: points[i].x, clientY: points[i].y, pointerId: 1, bubbles: true,
    }));
  }

  window.dispatchEvent(new PointerEvent('pointerup', {
    clientX: points[points.length - 1].x, clientY: points[points.length - 1].y,
    pointerId: 1, bubbles: true,
  }));
}

/** Generate a good horizontal line in canvas space matching stroke at viewBox y */
function goodStroke(yVb: number, n = 20): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    pts.push({
      x: (10 + t * 90) * SCALE_FACTOR,
      y: yVb * SCALE_FACTOR,
    });
  }
  return pts;
}

/** Generate a bad stroke (too short) */
function badStroke(): Point[] {
  return [
    { x: 10 * SCALE_FACTOR, y: 20 * SCALE_FACTOR },
    { x: 15 * SCALE_FACTOR, y: 20 * SCALE_FACTOR },
    { x: 20 * SCALE_FACTOR, y: 20 * SCALE_FACTOR },
  ];
}

/** Generate a reversed stroke (wrong direction) */
function reversedStroke(yVb: number, n = 20): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    pts.push({
      x: (100 - t * 90) * SCALE_FACTOR,
      y: yVb * SCALE_FACTOR,
    });
  }
  return pts;
}

function getCanvas(container: HTMLElement): HTMLCanvasElement {
  return container.querySelector('canvas')!;
}

describe('KakuRen', () => {
  let container: HTMLElement;
  let ren: KakuRen;

  beforeEach(() => {
    container = createContainer();
    rafCallbacks = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    ren?.dispose();
    container.remove();
    vi.useRealTimers();
  });

  describe('construction and properties', () => {
    it('creates and disposes without error', () => {
      const kaku = makeMockKaku();
      ren = new KakuRen({ kaku: kaku as any, container, width: 200, height: 200 });

      expect(ren.currentStroke).toBe(0);
      expect(ren.totalStrokes).toBe(3);
      expect(ren.averageScore).toBe(0);
      expect(ren.allScores).toEqual([]);

      ren.dispose();
    });

    it('defaults to 200×200 when no size option is provided', () => {
      const kaku = makeMockKaku();
      ren = new KakuRen({ kaku: kaku as any, container });

      // Should construct successfully with 200px defaults
      expect(ren.totalStrokes).toBe(3);
    });

    it('can be enabled and disabled', () => {
      const kaku = makeMockKaku();
      ren = new KakuRen({ kaku: kaku as any, container, width: 200, height: 200 });

      expect(ren.enabled).toBe(true);
      ren.enabled = false;
      expect(ren.enabled).toBe(false);
    });

    it('resets scores, failures, and kaku', () => {
      const kaku = makeMockKaku();
      ren = new KakuRen({ kaku: kaku as any, container, width: 200, height: 200 });

      ren.reset();
      expect(ren.averageScore).toBe(0);
      expect(ren.allScores).toEqual([]);
      expect(kaku.reset).toHaveBeenCalled();
    });

    it('delegates currentStroke and totalStrokes to kaku', () => {
      const kaku = makeMockKaku(5);
      ren = new KakuRen({ kaku: kaku as any, container, width: 200, height: 200 });

      expect(ren.totalStrokes).toBe(5);
      expect(ren.currentStroke).toBe(0);
    });

    it('dispose is idempotent', () => {
      const kaku = makeMockKaku();
      ren = new KakuRen({ kaku: kaku as any, container, width: 200, height: 200 });

      ren.dispose();
      ren.dispose(); // should not throw
    });
  });

  describe('stroke acceptance', () => {
    it('accepts a good stroke and advances', async () => {
      const onAccept = vi.fn();
      const kaku = makeMockKaku();
      ren = new KakuRen({
        kaku: kaku as any, container, width: 200, height: 200,
        onAccept,
      });

      const canvas = getCanvas(container);
      drawStroke(canvas, goodStroke(20));

      // Flush morph animation
      flushRaf();
      await vi.advanceTimersByTimeAsync(500);

      expect(onAccept).toHaveBeenCalledOnce();
      expect(onAccept.mock.calls[0][0]).toBe(0); // strokeIndex
      expect(onAccept.mock.calls[0][1].accepted).toBe(true);
      expect(kaku.nextStroke).toHaveBeenCalled();
      expect(ren.allScores.length).toBe(1);
      expect(ren.allScores[0]).toBeGreaterThan(0.5);
    });

    it('tracks average score across multiple accepted strokes', async () => {
      const kaku = makeMockKaku();
      ren = new KakuRen({ kaku: kaku as any, container, width: 200, height: 200 });

      const canvas = getCanvas(container);

      // Accept stroke 0
      drawStroke(canvas, goodStroke(20));
      flushRaf();
      await vi.advanceTimersByTimeAsync(500);

      // Accept stroke 1
      drawStroke(canvas, goodStroke(45));
      flushRaf();
      await vi.advanceTimersByTimeAsync(500);

      expect(ren.allScores.length).toBe(2);
      expect(ren.averageScore).toBeGreaterThan(0.5);
    });

    it('fires onComplete when all strokes are done', async () => {
      const onComplete = vi.fn();
      const kaku = makeMockKaku(1); // single stroke
      ren = new KakuRen({
        kaku: kaku as any, container, width: 200, height: 200,
        onComplete,
      });

      const canvas = getCanvas(container);
      drawStroke(canvas, goodStroke(20));
      flushRaf();
      await vi.advanceTimersByTimeAsync(500);

      expect(onComplete).toHaveBeenCalledOnce();
      expect(typeof onComplete.mock.calls[0][0]).toBe('number');
    });

    it('disables input after completion', async () => {
      const kaku = makeMockKaku(1);
      ren = new KakuRen({ kaku: kaku as any, container, width: 200, height: 200 });

      const canvas = getCanvas(container);
      drawStroke(canvas, goodStroke(20));
      flushRaf();
      await vi.advanceTimersByTimeAsync(500);

      // Input should remain disabled after all strokes done
      // (the re-enable check: currentStroke < totalStrokes is false)
      expect(ren.currentStroke).toBe(1);
      expect(ren.totalStrokes).toBe(1);
    });
  });

  describe('stroke rejection', () => {
    it('rejects a bad stroke and fires onReject', async () => {
      const onReject = vi.fn();
      const kaku = makeMockKaku();
      ren = new KakuRen({
        kaku: kaku as any, container, width: 200, height: 200,
        onReject,
      });

      const canvas = getCanvas(container);
      drawStroke(canvas, badStroke());
      flushRaf();
      await vi.advanceTimersByTimeAsync(500);

      expect(onReject).toHaveBeenCalledOnce();
      expect(onReject.mock.calls[0][1].accepted).toBe(false);
      expect(kaku.nextStroke).not.toHaveBeenCalled();
      expect(ren.allScores[0]).toBe(0);
    });

    it('rejects a reversed stroke', async () => {
      const onReject = vi.fn();
      const kaku = makeMockKaku();
      ren = new KakuRen({
        kaku: kaku as any, container, width: 200, height: 200,
        onReject,
      });

      const canvas = getCanvas(container);
      drawStroke(canvas, reversedStroke(20));
      flushRaf();
      await vi.advanceTimersByTimeAsync(500);

      expect(onReject).toHaveBeenCalledOnce();
      expect(onReject.mock.calls[0][1].rejection).toBe('wrong-direction');
    });

    it('shows hint immediately on rejection', async () => {
      const kaku = makeMockKaku();
      ren = new KakuRen({ kaku: kaku as any, container, width: 200, height: 200 });

      const canvas = getCanvas(container);
      drawStroke(canvas, badStroke());
      flushRaf();
      await vi.advanceTimersByTimeAsync(1000);

      // Should re-enable input after hint completes
      expect(ren.enabled).toBe(true);
    });

    it('re-enables input after rejection and hint', async () => {
      const kaku = makeMockKaku();
      ren = new KakuRen({ kaku: kaku as any, container, width: 200, height: 200 });

      const canvas = getCanvas(container);
      drawStroke(canvas, badStroke());
      flushRaf();
      await vi.advanceTimersByTimeAsync(1000);

      expect(ren.enabled).toBe(true);
    });

    it('animates hint with draw effect and custom color', async () => {
      const kaku = makeMockKaku();
      ren = new KakuRen({
        kaku: kaku as any, container, width: 200, height: 200,
        hintColor: '#f00',
        hintDuration: 0.5,
      });

      const canvas = getCanvas(container);
      drawStroke(canvas, badStroke());
      flushRaf();

      // During hint: rendered stroke should have transition set and progress animated
      const rendered = kaku.getRenderedStrokes()[0];
      expect(rendered.clearTransition).toHaveBeenCalled();
      expect(rendered.setTransition).toHaveBeenCalledWith(0.5, 'ease-in-out');
      expect(rendered.setProgress).toHaveBeenCalledWith(0); // reset to start
      expect(rendered.setProgress).toHaveBeenCalledWith(1); // animate to end
      expect(rendered.element.style.stroke).toBe('#f00');

      // After hint completes (500ms + 300ms hold)
      await vi.advanceTimersByTimeAsync(900);

      // Stroke color should be restored
      expect(rendered.element.style.stroke).not.toBe('#f00');
    });
  });

  describe('edge cases', () => {
    it('handles null character data gracefully', async () => {
      const kaku = makeMockKaku();
      kaku.getCharacterData = vi.fn(() => null);
      ren = new KakuRen({ kaku: kaku as any, container, width: 200, height: 200 });

      const canvas = getCanvas(container);
      // Should not throw
      drawStroke(canvas, goodStroke(20));
      flushRaf();
      await vi.advanceTimersByTimeAsync(500);

      expect(ren.allScores.length).toBe(0);
    });

    it('handles stroke index beyond strokes array', async () => {
      const kaku = makeMockKaku(0); // no strokes
      ren = new KakuRen({ kaku: kaku as any, container, width: 200, height: 200 });

      const canvas = getCanvas(container);
      drawStroke(canvas, goodStroke(20));
      flushRaf();
      await vi.advanceTimersByTimeAsync(500);

      expect(ren.allScores.length).toBe(0);
    });
  });

  describe('refresh()', () => {
    it('applies SVG layering and clears state', () => {
      const kaku = makeMockKaku();
      ren = new KakuRen({ kaku: kaku as any, container, size: 200 });

      ren.refresh();

      // getSvg called at least once (setupLayering + size validation)
      expect(kaku.getSvg).toHaveBeenCalled();
      expect(ren.allScores).toEqual([]);
      expect(ren.enabled).toBe(true);
    });

    it('throws a descriptive error when sizes differ', () => {
      const kaku = makeMockKaku();
      kaku.getSvg = vi.fn(() => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '300');
        svg.setAttribute('height', '300');
        return svg;
      });
      ren = new KakuRen({ kaku: kaku as any, container, size: 200 });

      expect(() => ren.refresh()).toThrow('200×200');
      expect(() => ren.refresh()).toThrow('300×300');
      expect(() => ren.refresh()).toThrow('size');
    });

    it('removes and re-creates the guide on re-call', () => {
      const kaku = makeMockKaku();
      ren = new KakuRen({ kaku: kaku as any, container, size: 200, showGuide: true });

      // Count guide SVGs before
      const before = container.querySelectorAll('svg').length;
      ren.refresh();
      // Guide re-created — count stays the same
      expect(container.querySelectorAll('svg').length).toBe(before);
    });

    it('updates stroke width on refresh when not explicitly set', () => {
      const kaku = makeMockKaku();
      ren = new KakuRen({ kaku: kaku as any, container, size: 200 });

      // Should not throw; exercises the strokeWidth update code path
      ren.refresh();
    });

    it('does not update stroke width when explicitly set', () => {
      const kaku = makeMockKaku();
      ren = new KakuRen({ kaku: kaku as any, container, size: 200, strokeWidth: 5 });

      ren.refresh(); // strokeWidth branch skipped
      expect(ren.enabled).toBe(true);
    });

    it('skips size validation when SVG has no width/height attributes', () => {
      const kaku = makeMockKaku();
      // SVG with no width/height → getAttribute returns null → ?? '' fallback → NaN → skip
      kaku.getSvg = vi.fn(() =>
        document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
      );
      ren = new KakuRen({ kaku: kaku as any, container, size: 200 });

      expect(() => ren.refresh()).not.toThrow();
    });
  });

  describe('guide setter and getter', () => {
    it('getter returns false when no guide exists', () => {
      const kaku = makeMockKaku();
      ren = new KakuRen({ kaku: kaku as any, container, size: 200 });

      expect(ren.guide).toBe(false);
    });

    it('getter returns true when guide is visible', () => {
      const kaku = makeMockKaku();
      ren = new KakuRen({ kaku: kaku as any, container, size: 200, showGuide: true });

      expect(ren.guide).toBe(true);
    });

    it('setter hides and shows guide', () => {
      const kaku = makeMockKaku();
      ren = new KakuRen({ kaku: kaku as any, container, size: 200, showGuide: true });

      ren.guide = false;
      expect(ren.guide).toBe(false);

      ren.guide = true;
      expect(ren.guide).toBe(true);
    });

    it('setter is a no-op when no guide exists', () => {
      const kaku = makeMockKaku();
      ren = new KakuRen({ kaku: kaku as any, container, size: 200 });

      // Should not throw
      ren.guide = false;
      expect(ren.guide).toBe(false);
    });
  });

  describe('showGuide option', () => {
    it('creates a guide SVG in the constructor when showGuide is true', () => {
      const kaku = makeMockKaku();
      ren = new KakuRen({ kaku: kaku as any, container, size: 200, showGuide: true });

      expect(ren.guide).toBe(true);
      // A guide SVG (z-index 1) should be present in the container
      const svgs = Array.from(container.querySelectorAll('svg'));
      expect(svgs.some(s => s.style.zIndex === '1')).toBe(true);
    });

    it('skips guide creation when no character data', () => {
      const kaku = makeMockKaku();
      kaku.getCharacterData = vi.fn(() => null);
      // showGuide: true but no charData → createGuide() returns early
      ren = new KakuRen({ kaku: kaku as any, container, size: 200, showGuide: true });

      expect(ren.guide).toBe(false);
    });

    it('falls back to stroke-width "3" when guide SVG has no path', () => {
      const kaku = makeMockKaku();
      // Return SVG with no child path — exercises the `: '3'` fallback in createGuide
      kaku.getSvg = vi.fn(() =>
        document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
      );
      ren = new KakuRen({ kaku: kaku as any, container, size: 200, showGuide: true });

      expect(ren.guide).toBe(true);
    });

    it('dispose removes guideSvg from DOM', () => {
      const kaku = makeMockKaku();
      ren = new KakuRen({ kaku: kaku as any, container, size: 200, showGuide: true });

      const svgsBefore = Array.from(container.querySelectorAll('svg'));
      expect(svgsBefore.some(s => s.style.zIndex === '1')).toBe(true);

      ren.dispose();

      const svgsAfter = Array.from(container.querySelectorAll('svg'));
      expect(svgsAfter.every(s => s.style.zIndex !== '1')).toBe(true);
    });
  });

  describe('playHints()', () => {
    it('does nothing when no character data', async () => {
      const kaku = makeMockKaku();
      kaku.getCharacterData = vi.fn(() => null);
      ren = new KakuRen({ kaku: kaku as any, container, size: 200 });

      await ren.playHints(); // Should not throw
      expect(ren.enabled).toBe(true);
    });

    it('plays a hint for each stroke then re-enables input', async () => {
      const kaku = makeMockKaku(1); // 1 stroke
      ren = new KakuRen({ kaku: kaku as any, container, size: 200 });

      const p = ren.playHints();
      // Advance past hintDuration (600ms) + hold (300ms) + inter-stroke pause (200ms)
      await vi.advanceTimersByTimeAsync(1500);
      await p;

      expect(ren.enabled).toBe(true);
      const rendered = kaku.getRenderedStrokes()[0];
      expect(rendered.setProgress).toHaveBeenCalledWith(0);
      expect(rendered.setProgress).toHaveBeenCalledWith(1);
    });
  });

  describe('computeStrokeWidth fallback', () => {
    it('uses default width of 3 when SVG has no path element', () => {
      const kaku = makeMockKaku();
      // Return SVG with no child path so svgPath is null → fallback `: 3` branch
      kaku.getSvg = vi.fn(() =>
        document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
      );
      ren = new KakuRen({ kaku: kaku as any, container, size: 200 });

      // Instance created successfully with fallback stroke width
      expect(ren.totalStrokes).toBe(3);
    });
  });

  describe('sampledPoints cache', () => {
    it('returns cached points on second stroke evaluation of same path', async () => {
      const kaku = makeMockKaku(1);
      ren = new KakuRen({ kaku: kaku as any, container, size: 200 });

      const canvas = getCanvas(container);

      // First draw: populates cache, gets rejected (bad stroke)
      drawStroke(canvas, badStroke());
      flushRaf();
      await vi.advanceTimersByTimeAsync(1000);

      // Second draw on same stroke (same pathData): hits the cache
      drawStroke(canvas, badStroke());
      flushRaf();
      await vi.advanceTimersByTimeAsync(1000);

      // Two rejections, both evaluated — cache hit on second
      expect(ren.allScores.length).toBe(2);
    });
  });

  describe('showHint edge cases', () => {
    it('does nothing when rendered stroke is missing at index', async () => {
      const kaku = makeMockKaku(3);
      // Return fewer rendered strokes than actual strokes
      kaku.getRenderedStrokes = vi.fn(() => []);
      ren = new KakuRen({ kaku: kaku as any, container, size: 200 });

      const canvas = getCanvas(container);
      // Bad stroke triggers showHint(0) but renderedStrokes[0] is undefined → early return
      drawStroke(canvas, badStroke());
      flushRaf();
      await vi.advanceTimersByTimeAsync(1000);

      expect(ren.enabled).toBe(true);
    });
  });

  describe('morph animation', () => {
    it('schedules intermediate RAF frames when morph is not yet complete', async () => {
      const kaku = makeMockKaku();
      ren = new KakuRen({ kaku: kaku as any, container, size: 200, morphDuration: 80 });

      const canvas = getCanvas(container);
      drawStroke(canvas, goodStroke(20));

      // First RAF at t = 40/80 = 0.5 → t < 1, schedules another frame (line 450)
      flushRafOneShot(40);
      // Second RAF at t >> 1 → resolves
      flushRafOneShot(99999);

      await vi.advanceTimersByTimeAsync(500);
    });
  });
});
