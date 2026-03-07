import { describe, it, expect } from 'vitest';
import { evaluateStroke, sampleExpectedStroke, resamplePoints } from '../../src/stroke-evaluator.js';
import type { Point } from '../../src/types.js';

/**
 * Tests using real KanjiVG path data for 字 (U+5B57).
 * Verifies that evaluation works against actual cubic Bézier stroke paths.
 */

// Real stroke path data from 05b57.svg (字)
const STROKES = [
  // s1: short vertical tick at top
  'M52.73,9.5c1.01,1.01,1.75,2.25,1.75,3.76c0,3.53-0.09,5.73-0.1,8.95',
  // s2: left diagonal from 宀
  'M21.88,24c0,3.37-4.06,14.25-5.62,16.5',
  // s3: horizontal sweep from 冖
  'M24.07,26.66c16.68-1.91,42.18-5.28,63-5.78c10.95-0.26,4.68,5.37,0.52,8.4',
  // s4: horizontal + turn from 子
  'M34.91,36.19c2.09,1.06,4.35,1.5,6.87,1.26c4.73-0.45,19.99-2.86,26.18-4.24c3.17-0.71,4.92,0.67,2.1,3.7c-2.15,2.31-9.34,9.46-14.25,12.73',
  // s5: vertical curve of 子
  'M52.71,51.03c5.42,5.22,9.29,26.84,3.67,43.18c-2.57,7.47-8.5,2.78-10.58,0.81',
  // s6: bottom horizontal of 子
  'M14.38,63.51c3.88,1.24,8.65,0.84,12.38,0.47c15.18-1.5,43-4.92,59.75-5.41c3.45-0.1,7.13-0.23,10.37,1.15',
];

const VIEWBOX_SIZE = 109;
const CANVAS_SIZE = 300;
const SCALE_FACTOR = CANVAS_SIZE / VIEWBOX_SIZE;
const N = 50;

/** Create an SVG path element with the given d attribute (uses jsdom mock) */
function createPath(d: string): SVGPathElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  svg.appendChild(path);
  document.body.appendChild(svg);
  return path as unknown as SVGPathElement;
}

/** Sample expected points from a path data string */
function sampleStroke(d: string): { points: Point[]; length: number } {
  const path = createPath(d);
  const length = path.getTotalLength();
  const points = sampleExpectedStroke(path, N);
  path.parentElement?.parentElement?.removeChild(path.parentElement);
  return { points, length };
}

/** Convert viewBox points to canvas points and add optional noise */
function toCanvasPoints(pts: Point[], noise = 0): Point[] {
  return pts.map(p => ({
    x: p.x * SCALE_FACTOR + (noise ? (Math.random() - 0.5) * noise : 0),
    y: p.y * SCALE_FACTOR + (noise ? (Math.random() - 0.5) * noise : 0),
  }));
}

describe('real SVG data (字 U+5B57)', () => {
  describe('path sampling sanity', () => {
    it('samples correct start/end for stroke 1 (vertical tick)', () => {
      const { points, length } = sampleStroke(STROKES[0]);

      expect(points.length).toBe(N);
      expect(length).toBeGreaterThan(0);

      // Stroke 1 starts at (52.73, 9.5)
      expect(points[0].x).toBeCloseTo(52.73, 0);
      expect(points[0].y).toBeCloseTo(9.5, 0);

      // Ends roughly at (54.38, 22.21) — the endpoint of the Bézier curve
      // M52.73,9.5 + c...c0,3.53-0.09,5.73-0.1,8.95 → endpoint ≈ (54.38, 22.21)
      const last = points[N - 1];
      expect(last.x).toBeCloseTo(54.38, 0);
      expect(last.y).toBeCloseTo(22.21, 0);
    });

    it('samples correct start/end for stroke 6 (bottom horizontal)', () => {
      const { points } = sampleStroke(STROKES[5]);

      // Starts at (14.38, 63.51)
      expect(points[0].x).toBeCloseTo(14.38, 0);
      expect(points[0].y).toBeCloseTo(63.51, 0);

      // Ends far right — the final endpoint of the last Bézier
      const last = points[N - 1];
      expect(last.x).toBeGreaterThan(90); // should be near right edge
    });

    it('stroke lengths are positive and in expected range', () => {
      for (let i = 0; i < STROKES.length; i++) {
        const { length } = sampleStroke(STROKES[i]);
        // All strokes in a 109x109 viewBox should have reasonable lengths
        expect(length).toBeGreaterThan(5);
        expect(length).toBeLessThan(200);
      }
    });

    it('sampled points are within viewBox bounds', () => {
      for (const d of STROKES) {
        const { points } = sampleStroke(d);
        for (const p of points) {
          expect(p.x).toBeGreaterThanOrEqual(-5);
          expect(p.x).toBeLessThanOrEqual(115);
          expect(p.y).toBeGreaterThanOrEqual(-5);
          expect(p.y).toBeLessThanOrEqual(115);
        }
      }
    });
  });

  describe('stroke evaluation with real paths', () => {
    it('accepts a user stroke that traces the expected path', () => {
      const { points, length } = sampleStroke(STROKES[5]); // bottom horizontal

      // Simulate a user tracing the same path with 20 sample points
      const userPoints = toCanvasPoints(
        resamplePoints(points, 20),
      );

      const result = evaluateStroke(userPoints, points, length, SCALE_FACTOR);
      expect(result.accepted).toBe(true);
      expect(result.score).toBeGreaterThan(0.9);
    });

    it('accepts a slightly noisy user stroke', () => {
      const { points, length } = sampleStroke(STROKES[5]); // bottom horizontal

      // Trace with small random noise (±5 canvas pixels ≈ ±1.8 viewBox units)
      const userPoints = toCanvasPoints(resamplePoints(points, 25), 5);

      const result = evaluateStroke(userPoints, points, length, SCALE_FACTOR);
      expect(result.accepted).toBe(true);
      expect(result.score).toBeGreaterThan(0.5);
    });

    it('rejects a reversed stroke', () => {
      const { points, length } = sampleStroke(STROKES[5]); // bottom horizontal

      // Draw right-to-left (reversed)
      const reversed = [...points].reverse();
      const userPoints = toCanvasPoints(resamplePoints(reversed, 20));

      const result = evaluateStroke(userPoints, points, length, SCALE_FACTOR);
      expect(result.accepted).toBe(false);
      expect(result.rejection).toBe('wrong-direction');
    });

    it('rejects a stroke that is too short', () => {
      const { points, length } = sampleStroke(STROKES[5]); // bottom horizontal

      // Draw only the first quarter
      const partial = points.slice(0, Math.floor(N / 4));
      const userPoints = toCanvasPoints(partial);

      const result = evaluateStroke(userPoints, points, length, SCALE_FACTOR);
      expect(result.accepted).toBe(false);
      expect(result.rejection).toBe('too-short');
    });

    it('rejects a completely wrong stroke (different area)', () => {
      const { points, length } = sampleStroke(STROKES[5]); // bottom horizontal (y≈63)

      // Draw a vertical line in the top-left area
      const wrong: Point[] = [];
      for (let i = 0; i < 20; i++) {
        const t = i / 19;
        wrong.push({ x: 10 * SCALE_FACTOR, y: (5 + t * 40) * SCALE_FACTOR });
      }

      const result = evaluateStroke(wrong, points, length, SCALE_FACTOR);
      expect(result.accepted).toBe(false);
    });

    it('evaluates all 6 strokes of 字 with correct traces', () => {
      for (let i = 0; i < STROKES.length; i++) {
        const { points, length } = sampleStroke(STROKES[i]);
        const userPoints = toCanvasPoints(resamplePoints(points, 20));
        const result = evaluateStroke(userPoints, points, length, SCALE_FACTOR);

        expect(result.accepted).toBe(true);
        expect(result.score).toBeGreaterThan(0.8);
      }
    });

    it('short stroke (s1 vertical tick) is evaluated with boost', () => {
      const { points, length } = sampleStroke(STROKES[0]); // short stroke

      // Trace with moderate offset (3 viewBox units off)
      const offset = points.map(p => ({ x: p.x + 3, y: p.y }));
      const userPoints = toCanvasPoints(resamplePoints(offset, 20));

      const result = evaluateStroke(userPoints, points, length, SCALE_FACTOR);
      // Short strokes get a boost, so this should still score reasonably
      expect(result.score).toBeGreaterThan(0.3);
    });
  });
});
