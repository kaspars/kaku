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
  /**
   * Shortest length a stroke is judged by, as a fraction of the viewBox
   * size (default: 0.3). A shorter stroke gets the same absolute position
   * tolerance as one of this length, and a gentler minimum length.
   */
  shortStrokeFloor?: number;
  /**
   * Width of the character's viewBox: 109 for KanjiVG, 1024 for AnimCJK
   * (default: 109). KakuRen sets it from the loaded character.
   */
  viewBoxSize?: number;
  /**
   * How far, as a fraction of the viewBox size, the whole stroke may be
   * displaced without penalty (default: 0). The offset between the user's
   * stroke and the expected one, up to this distance, is removed before
   * judging; shape, direction and length are judged as usual. KakuRen uses
   * it for the first stroke (see `firstStrokeOffset`): where a character
   * starts on the pad is the writer's choice, and later strokes follow it.
   */
  offsetTolerance?: number;
}

/**
 * One stroke the user drew, as evaluated.
 */
export interface StrokeAttempt {
  /** Index of the stroke that was expected */
  index: number;
  result: EvaluationResult;
  /** The user's points in viewBox units, as captured (not resampled) */
  points: Point[];
  /** Time of each point in ms since the stroke began */
  times: number[];
  /** Length of the expected stroke in viewBox units */
  expectedLength: number;
}
