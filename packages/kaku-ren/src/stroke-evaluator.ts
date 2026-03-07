import type { Point, EvaluationResult, EvaluatorOptions } from './types.js';

const DEFAULT_SAMPLE_COUNT = 50;
const DEFAULT_ACCEPT_THRESHOLD = 0.5;
const DEFAULT_MIN_LENGTH_RATIO = 2 / 3;
const DEFAULT_EVALUATION_RATIO = 1;

/**
 * Evaluate a user-drawn stroke against expected sample points.
 *
 * @param userPoints - Raw points captured from user input (canvas coordinates)
 * @param expectedPoints - Points sampled from the expected SVG path (viewBox coordinates)
 * @param expectedLength - Total length of the expected SVG path
 * @param scaleFactor - Ratio to convert canvas coords to viewBox coords (canvasSize / viewBoxSize)
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

  if (userPoints.length < 2 || expectedPoints.length < 2) {
    return { score: 0, accepted: false, rejection: 'too-short' };
  }

  // Resample user stroke to N equidistant points
  const resampledUser = resamplePoints(userPoints, N);

  // Convert user points from canvas space to viewBox space
  const scaledUser = resampledUser.map(p => ({
    x: p.x / scaleFactor,
    y: p.y / scaleFactor,
  }));

  // Check direction: compare forward vs reversed alignment
  if (isWrongDirection(scaledUser, expectedPoints)) {
    return { score: 0, accepted: false, rejection: 'wrong-direction' };
  }

  // Compute user stroke length in viewBox space
  const userLength = pathLength(scaledUser);

  // Reject if user stroke is too short
  if (userLength < expectedLength * minLengthRatio) {
    return { score: 0, accepted: false, rejection: 'too-short' };
  }

  // Compute average distance between corresponding points
  const avgDistance = averagePointDistance(scaledUser, expectedPoints);

  // Normalize by expected stroke length
  const normalizedDistance = avgDistance / expectedLength;

  // Apply length-based boost for short strokes
  const boost = lengthBoost(expectedLength);

  const T = evaluationRatio * boost;
  const score = Math.max(0, Math.min(1, 1 - normalizedDistance / T));

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
 * Compute length-based scoring boost for short strokes.
 * Short strokes are harder to match precisely, so we're more lenient.
 */
function lengthBoost(expectedLength: number): number {
  let boost = 1.0;

  if (expectedLength < 20) {
    boost = Math.exp((20 - expectedLength) / 8);
  } else if (expectedLength < 30) {
    boost = 1 + (30 - expectedLength) * 0.03;
  }

  return Math.min(boost, 2.0);
}
