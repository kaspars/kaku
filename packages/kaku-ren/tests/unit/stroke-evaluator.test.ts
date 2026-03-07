import { describe, it, expect } from 'vitest';
import { evaluateStroke, resamplePoints } from '../../src/stroke-evaluator.js';
import type { Point } from '../../src/types.js';

/** Helper: generate a straight horizontal line from (x1,y) to (x2,y) with n points */
function hline(x1: number, x2: number, y: number, n: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    pts.push({ x: x1 + t * (x2 - x1), y });
  }
  return pts;
}

/** Helper: generate a straight vertical line from (x,y1) to (x,y2) with n points */
function vline(x: number, y1: number, y2: number, n: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    pts.push({ x, y: y1 + t * (y2 - y1) });
  }
  return pts;
}

describe('resamplePoints', () => {
  it('resamples to the requested number of points', () => {
    const input = hline(0, 100, 50, 10);
    const result = resamplePoints(input, 50);
    expect(result).toHaveLength(50);
  });

  it('preserves start and end points', () => {
    const input = hline(0, 100, 50, 5);
    const result = resamplePoints(input, 50);
    expect(result[0].x).toBeCloseTo(0);
    expect(result[49].x).toBeCloseTo(100);
    expect(result[0].y).toBeCloseTo(50);
  });

  it('produces equidistant points', () => {
    const input = hline(0, 100, 0, 3);
    const result = resamplePoints(input, 5);

    // Each segment should be ~25 units
    for (let i = 1; i < result.length; i++) {
      const dx = result[i].x - result[i - 1].x;
      expect(dx).toBeCloseTo(25, 1);
    }
  });

  it('handles a single point input', () => {
    const result = resamplePoints([{ x: 50, y: 50 }], 10);
    expect(result).toHaveLength(10);
    expect(result[0]).toEqual({ x: 50, y: 50 });
  });

  it('handles empty input', () => {
    const result = resamplePoints([], 10);
    expect(result).toHaveLength(0);
  });

  it('handles zero-length stroke (same point twice)', () => {
    const input = [{ x: 30, y: 30 }, { x: 30, y: 30 }];
    const result = resamplePoints(input, 10);
    expect(result).toHaveLength(10);
    expect(result[0]).toEqual({ x: 30, y: 30 });
  });
});

describe('evaluateStroke', () => {
  const N = 50;

  // Expected stroke: horizontal line from (10,50) to (100,50) in viewBox space (109x109)
  const expectedPoints = hline(10, 100, 50, N);
  const expectedLength = 90; // 100 - 10

  // Scale factor: canvas 200px / viewBox 109 units
  const scaleFactor = 200 / 109;

  // Helper to convert viewBox points to canvas points
  function toCanvas(pts: Point[]): Point[] {
    return pts.map(p => ({ x: p.x * scaleFactor, y: p.y * scaleFactor }));
  }

  it('gives high score for a matching stroke', () => {
    // User draws the same line in canvas coordinates
    const userPoints = toCanvas(hline(10, 100, 50, 20));
    const result = evaluateStroke(userPoints, expectedPoints, expectedLength, scaleFactor);

    expect(result.score).toBeGreaterThan(0.9);
    expect(result.accepted).toBe(true);
    expect(result.rejection).toBeUndefined();
  });

  it('gives lower score for an offset stroke', () => {
    // User draws parallel line but shifted 15 units up in viewBox space
    const userPoints = toCanvas(hline(10, 100, 35, 20));
    const result = evaluateStroke(userPoints, expectedPoints, expectedLength, scaleFactor);

    expect(result.score).toBeLessThan(0.9);
    expect(result.score).toBeGreaterThan(0);
  });

  it('rejects a stroke drawn in the wrong direction', () => {
    // User draws right-to-left instead of left-to-right
    const userPoints = toCanvas(hline(100, 10, 50, 20));
    const result = evaluateStroke(userPoints, expectedPoints, expectedLength, scaleFactor);

    expect(result.score).toBe(0);
    expect(result.accepted).toBe(false);
    expect(result.rejection).toBe('wrong-direction');
  });

  it('rejects a stroke that is too short', () => {
    // User draws only 1/3 of the expected length
    const userPoints = toCanvas(hline(10, 40, 50, 20));
    const result = evaluateStroke(userPoints, expectedPoints, expectedLength, scaleFactor);

    expect(result.score).toBe(0);
    expect(result.accepted).toBe(false);
    expect(result.rejection).toBe('too-short');
  });

  it('accepts a stroke that is slightly shorter than expected', () => {
    // User draws ~75% of expected length (above 2/3 threshold)
    const userPoints = toCanvas(hline(10, 77.5, 50, 20));
    const result = evaluateStroke(userPoints, expectedPoints, expectedLength, scaleFactor);

    expect(result.score).toBeGreaterThan(0);
    expect(result.rejection).toBeUndefined();
  });

  it('rejects too few user points', () => {
    const result = evaluateStroke(
      [{ x: 50, y: 50 }],
      expectedPoints,
      expectedLength,
      scaleFactor,
    );
    expect(result.score).toBe(0);
    expect(result.rejection).toBe('too-short');
  });

  it('rejects too few expected points', () => {
    const result = evaluateStroke(
      toCanvas(hline(10, 100, 50, 20)),
      [{ x: 10, y: 50 }],
      expectedLength,
      scaleFactor,
    );
    expect(result.score).toBe(0);
    expect(result.rejection).toBe('too-short');
  });

  it('gives low score for a perpendicular stroke in a different area', () => {
    // User draws vertical line in the wrong area
    const userPoints = toCanvas(vline(90, 10, 100, 20));
    const result = evaluateStroke(userPoints, expectedPoints, expectedLength, scaleFactor);

    expect(result.accepted).toBe(false);
  });

  it('score is clamped to [0, 1]', () => {
    const userPoints = toCanvas(hline(10, 100, 50, 20));
    const result = evaluateStroke(userPoints, expectedPoints, expectedLength, scaleFactor);

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('respects custom acceptThreshold', () => {
    // Slightly offset stroke that scores ~0.6-0.8
    const userPoints = toCanvas(hline(10, 100, 42, 20));
    const strict = evaluateStroke(userPoints, expectedPoints, expectedLength, scaleFactor, {
      acceptThreshold: 0.95,
    });
    const lenient = evaluateStroke(userPoints, expectedPoints, expectedLength, scaleFactor, {
      acceptThreshold: 0.3,
    });

    expect(strict.accepted).toBe(false);
    expect(lenient.accepted).toBe(true);
    // Same score regardless of threshold
    expect(strict.score).toBeCloseTo(lenient.score);
  });

  describe('short stroke boost', () => {
    it('is more lenient for short strokes', () => {
      // Short expected stroke: 15 units
      const shortExpected = hline(10, 25, 50, N);
      const shortLength = 15;

      // User draws with some offset (5 units off in y)
      const userPoints = toCanvas(hline(10, 25, 45, 20));
      const result = evaluateStroke(userPoints, shortExpected, shortLength, scaleFactor);

      // Without boost this would score poorly; with boost it should be more forgiving
      expect(result.score).toBeGreaterThan(0.3);
    });

    it('applies medium boost for medium strokes', () => {
      // Medium expected stroke: 25 units
      const medExpected = hline(10, 35, 50, N);
      const medLength = 25;

      const userPoints = toCanvas(hline(10, 35, 45, 20));
      const result = evaluateStroke(userPoints, medExpected, medLength, scaleFactor);

      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('direction checking', () => {
    it('detects reversed vertical stroke', () => {
      const expectedVert = vline(50, 10, 90, N);
      const vertLength = 80;

      // User draws bottom-to-top
      const userPoints = toCanvas(vline(50, 90, 10, 20));
      const result = evaluateStroke(userPoints, expectedVert, vertLength, scaleFactor);

      expect(result.rejection).toBe('wrong-direction');
    });

    it('accepts correct direction for vertical stroke', () => {
      const expectedVert = vline(50, 10, 90, N);
      const vertLength = 80;

      const userPoints = toCanvas(vline(50, 10, 90, 20));
      const result = evaluateStroke(userPoints, expectedVert, vertLength, scaleFactor);

      expect(result.score).toBeGreaterThan(0.9);
      expect(result.accepted).toBe(true);
    });

    it('accepts diagonal stroke in correct direction', () => {
      // Diagonal from top-left to bottom-right
      const diag: Point[] = [];
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        diag.push({ x: 10 + t * 80, y: 10 + t * 80 });
      }
      const diagLength = Math.sqrt(80 * 80 + 80 * 80);

      const userDiag: Point[] = [];
      for (let i = 0; i < 20; i++) {
        const t = i / 19;
        userDiag.push({
          x: (10 + t * 80) * scaleFactor,
          y: (10 + t * 80) * scaleFactor,
        });
      }

      const result = evaluateStroke(userDiag, diag, diagLength, scaleFactor);
      expect(result.score).toBeGreaterThan(0.9);
    });
  });
});
