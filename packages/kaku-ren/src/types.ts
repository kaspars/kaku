/**
 * A 2D point.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Result of evaluating a user-drawn stroke against the expected stroke.
 */
export interface EvaluationResult {
  /** Score from 0 (completely wrong) to 1 (perfect match) */
  score: number;
  /** Whether the stroke was accepted (score >= threshold) */
  accepted: boolean;
  /** Reason for rejection, if any */
  rejection?: 'too-short' | 'wrong-direction';
}

/**
 * Options for stroke evaluation.
 */
export interface EvaluatorOptions {
  /** Number of sample points for comparison (default: 50) */
  sampleCount?: number;
  /** Minimum score to accept a stroke (default: 0.5) */
  acceptThreshold?: number;
  /** Minimum user stroke length as fraction of expected (default: 2/3) */
  minLengthRatio?: number;
  /** Base evaluation ratio — higher = more lenient (default: 1) */
  evaluationRatio?: number;
}
