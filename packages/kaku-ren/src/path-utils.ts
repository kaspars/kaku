import type { Point } from './types.js';

/**
 * Parse coordinate pairs from an SVG path data string.
 * Handles M, L, and simple numeric coordinate pairs.
 */
export function parsePathCoords(d: string): Point[] {
  const points: Point[] = [];
  const coordRegex = /(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/g;
  let match;
  while ((match = coordRegex.exec(d)) !== null) {
    points.push({ x: parseFloat(match[1]), y: parseFloat(match[2]) });
  }
  return points;
}

/**
 * Compute total length of a polyline defined by points.
 */
export function polylineLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

/**
 * Get a point at a given distance along a polyline.
 */
export function pointAtLength(points: Point[], len: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  let remaining = Math.max(0, len);
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (remaining <= segLen || i === points.length - 1) {
      const t = segLen > 0 ? remaining / segLen : 0;
      return {
        x: points[i - 1].x + t * dx,
        y: points[i - 1].y + t * dy,
      };
    }
    remaining -= segLen;
  }
  return points[points.length - 1];
}

/**
 * Sample N equidistant points along a path defined by a "d" attribute string.
 * This is a pure-data alternative to sampleExpectedStroke (no DOM needed).
 */
export function samplePathData(d: string, N: number): { points: Point[]; length: number } {
  const coords = parsePathCoords(d);
  if (coords.length === 0) return { points: [], length: 0 };

  const length = polylineLength(coords);
  const points: Point[] = [];

  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    points.push(pointAtLength(coords, length * t));
  }

  return { points, length };
}
