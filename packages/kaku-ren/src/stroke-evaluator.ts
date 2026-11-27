import type { Point, EvaluationResult, EvaluatorOptions } from './types.js';

const DEFAULT_SAMPLE_COUNT = 50;
const DEFAULT_ACCEPT_THRESHOLD = 0.5;
const DEFAULT_MIN_LENGTH_RATIO = 2 / 3;
const DEFAULT_EVALUATION_RATIO = 1;
const DEFAULT_VIEWBOX_SIZE = 109; // KanjiVG
const DEFAULT_SHORT_STROKE_FLOOR = 0.3;

/**
 * Evaluate a user-drawn stroke against expected sample points.
 *
 * @param userPoints - Raw points captured from user input (canvas coordinates)
 * @param expectedPoints - Points sampled from the expected SVG path (viewBox coordinates)
 * @param expectedLength - Total length of the expected SVG path (viewBox units)
 * @param scaleFactor - Ratio of canvas pixels to viewBox units (canvasWidth / viewBoxWidth)
 * @param options - Evaluation options
 */
export function evaluateStroke(
  userPoints: Point[],
  expectedPoints: Point[],
  expectedLength: number,
  scaleFactor: number,
  options: EvaluatorOptions = {},
): EvaluationResult {
  const acceptThreshold = options.acceptThreshold ?? DEFAULT_ACCEPT_THRESHOLD;
  const minLengthRatio = options.minLengthRatio ?? DEFAULT_MIN_LENGTH_RATIO;
  const evaluationRatio = options.evaluationRatio ?? DEFAULT_EVALUATION_RATIO;
  const N = options.sampleCount ?? DEFAULT_SAMPLE_COUNT;
  // Strokes shorter than the floor are judged as if they had its length:
  // placing a dot is no more precise than placing a longer stroke.
  const floor = (options.shortStrokeFloor ?? DEFAULT_SHORT_STROKE_FLOOR) * (options.viewBoxSize ?? DEFAULT_VIEWBOX_SIZE);
  const judgedLength = Math.max(expectedLength, floor);

  if (userPoints.length < 2 || expectedPoints.length < 2) {
    return { score: 0, accepted: false, rejection: 'too-short' };
  }

  // Resample user stroke to N equidistant points
  const resampledUser = resamplePoints(userPoints, N);

  // Convert user points from canvas space to viewBox space
  let scaledUser = resampledUser.map(p => ({
    x: p.x / scaleFactor,
    y: p.y / scaleFactor,
  }));

  // Forgive a displacement of the whole stroke, up to the tolerance
  const tolerance = (options.offsetTolerance ?? 0) * (options.viewBoxSize ?? DEFAULT_VIEWBOX_SIZE);
  if (tolerance > 0) {
    const u = centroid(scaledUser);
    const e = centroid(expectedPoints);
    const dx = u.x - e.x;
    const dy = u.y - e.y;
    const k = Math.min(1, tolerance / (Math.hypot(dx, dy) || 1));
    scaledUser = scaledUser.map(p => ({ x: p.x - dx * k, y: p.y - dy * k }));
  }

  // Check direction: compare forward vs reversed alignment
  if (isWrongDirection(scaledUser, expectedPoints)) {
    return { score: 0, accepted: false, rejection: 'wrong-direction' };
  }

  // With its position forgiven, a stroke crossing the expected one could
  // score well: its overall direction must match too.
  if (
    tolerance > 0 &&
    turn(scaledUser[0], scaledUser[scaledUser.length - 1], expectedPoints[0], expectedPoints[expectedPoints.length - 1]) >
      MAX_OFFSET_TURN
  ) {
    return { score: 0, accepted: false };
  }

  // Compute user stroke length in viewBox space
  const userLength = pathLength(scaledUser);

  // Reject if user stroke is too short. A hook or brush flick at the end of
  // the expected stroke doesn't count: a finger often stops before it. Below
  // the floor the ratio eases off with the square root of the length, as
  // dots are drawn as quick flicks.
  const core = expectedLength - endFlickLength(expectedPoints, expectedLength);
  if (userLength < core * minLengthRatio * Math.sqrt(core / Math.max(core, floor))) {
    return { score: 0, accepted: false, rejection: 'too-short' };
  }

  // Compute average distance between corresponding points
  const avgDistance = averagePointDistance(scaledUser, expectedPoints);

  // Normalize by the stroke length, or the floor for short strokes
  const normalizedDistance = avgDistance / judgedLength;

  const score = Math.max(0, Math.min(1, 1 - normalizedDistance / evaluationRatio));

  return {
    score,
    accepted: score >= acceptThreshold,
  };
}

/**
 * Sample N equidistant points along an SVG path element.
 */
export function sampleExpectedStroke(path: SVGPathElement, N: number = DEFAULT_SAMPLE_COUNT): Point[] {
  const totalLength = path.getTotalLength();
  const points: Point[] = [];

  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const pos = path.getPointAtLength(totalLength * t);
    points.push({ x: pos.x, y: pos.y });
  }

  return points;
}

/**
 * Resample an array of points to exactly N equidistant points.
 */
export function resamplePoints(points: Point[], N: number): Point[] {
  if (points.length === 0) return [];
  if (points.length === 1) return Array(N).fill({ x: points[0].x, y: points[0].y });

  // Compute cumulative distances
  const cumDist = [0];
  let totalDist = 0;
  for (let i = 1; i < points.length; i++) {
    totalDist += distance(points[i], points[i - 1]);
    cumDist.push(totalDist);
  }

  // Zero-length stroke (tap)
  if (totalDist === 0) {
    return Array(N).fill({ x: points[0].x, y: points[0].y });
  }

  const interval = totalDist / (N - 1);
  const resampled: Point[] = [points[0]];
  let targetDist = interval;
  let j = 1;

  while (j < points.length && resampled.length < N) {
    if (cumDist[j] >= targetDist) {
      const t = (targetDist - cumDist[j - 1]) / (cumDist[j] - cumDist[j - 1]);
      resampled.push({
        x: points[j - 1].x + t * (points[j].x - points[j - 1].x),
        y: points[j - 1].y + t * (points[j].y - points[j - 1].y),
      });
      targetDist += interval;
    } else {
      j++;
    }
  }

  // Pad if needed due to floating point
  while (resampled.length < N) {
    resampled.push(points[points.length - 1]);
  }

  return resampled;
}

/**
 * Check if the user drew the stroke in the wrong direction.
 * Compares distance of user start/end to expected start/end vs reversed.
 */
function isWrongDirection(userPoints: Point[], expectedPoints: Point[]): boolean {
  const userStart = userPoints[0];
  const userEnd = userPoints[userPoints.length - 1];
  const expStart = expectedPoints[0];
  const expEnd = expectedPoints[expectedPoints.length - 1];

  // Forward: user start→exp start + user end→exp end
  const forwardDist = distance(userStart, expStart) + distance(userEnd, expEnd);
  // Reversed: user start→exp end + user end→exp start
  const reversedDist = distance(userStart, expEnd) + distance(userEnd, expStart);

  return reversedDist < forwardDist;
}

/**
 * Compute average Euclidean distance between corresponding points.
 */
function averagePointDistance(a: Point[], b: Point[]): number {
  const N = Math.min(a.length, b.length);
  let total = 0;
  for (let i = 0; i < N; i++) {
    total += distance(a[i], b[i]);
  }
  return total / N;
}

/**
 * Compute total path length of a point array.
 */
function pathLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += distance(points[i], points[i - 1]);
  }
  return len;
}

/**
 * Euclidean distance between two points.
 */
function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Centroid of a point array.
 */
function centroid(points: Point[]): Point {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

/** Under an offset tolerance, the largest angle (degrees) between the user's and the expected start-to-end direction. */
const MAX_OFFSET_TURN = 50;

/** A turn sharper than this (degrees) starts an end flick. */
const FLICK_TURN = 100;
/** An end flick is at most this share of the stroke. */
const FLICK_SHARE = 0.3;

/**
 * Length of a hook or brush flick at the end of a stroke: the part after
 * its last sharp turn, if that part is short. Points are equidistant, so a
 * turn can fall between two samples; the direction is compared across two
 * segments to catch it.
 */
function endFlickLength(points: Point[], length: number): number {
  let flick = 0;
  for (let k = points.length - 1; k >= 3; k--) {
    flick += distance(points[k - 1], points[k]);
    if (flick > FLICK_SHARE * length) return 0;
    if (turn(points[k - 3], points[k - 2], points[k - 1], points[k]) > FLICK_TURN) return flick;
  }
  return 0;
}

/**
 * Angle in degrees between the direction a→b and c→d.
 */
function turn(a: Point, b: Point, c: Point, d: Point): number {
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const vx = d.x - c.x;
  const vy = d.y - c.y;
  const n = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if (n === 0) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / n))) * 180) / Math.PI;
}
