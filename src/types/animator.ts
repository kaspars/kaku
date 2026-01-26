import type { RenderedStroke } from './renderer.js';

/**
 * Animation state
 */
export type AnimationState = 'idle' | 'playing' | 'paused' | 'completed';

/**
 * Animation event types
 */
export type AnimationEventType =
  | 'start'
  | 'strokeStart'
  | 'strokeComplete'
  | 'complete'
  | 'pause'
  | 'resume'
  | 'reset';

/**
 * Animation event payload
 */
export interface AnimationEvent {
  type: AnimationEventType;
  strokeIndex?: number;
  totalStrokes?: number;
}

/**
 * Event handler function type
 */
export type AnimationEventHandler = (event: AnimationEvent) => void;

/**
 * Animator options
 */
export interface AnimatorOptions {
  /** Seconds per stroke */
  strokeDuration?: number;
  /** Easing function for CSS transition */
  easing?: string;
  /** Loop animation when complete */
  loop?: boolean;
  /** Delay before loop restart (seconds) */
  loopDelay?: number;
  /** Auto-play on load */
  autoplay?: boolean;
}

/**
 * Animator interface for stroke animation control
 */
export interface Animator {
  /** Current animation state */
  readonly state: AnimationState;
  /** Current stroke index */
  readonly currentStroke: number;
  /** Total number of strokes */
  readonly totalStrokes: number;

  /**
   * Initialize with rendered strokes
   * @param strokes - Array of rendered strokes to animate
   */
  setStrokes(strokes: RenderedStroke[]): void;

  /**
   * Start or resume animation
   */
  play(): void;

  /**
   * Pause animation
   */
  pause(): void;

  /**
   * Reset animation to beginning
   */
  reset(): void;

  /**
   * Advance to next stroke (manual mode)
   * @returns Promise that resolves when stroke animation completes
   */
  nextStroke(): Promise<void>;

  /**
   * Go back to previous stroke (manual mode)
   */
  previousStroke(): void;

  /**
   * Subscribe to animation events
   * @param event - Event type to listen for
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  on(event: AnimationEventType, handler: AnimationEventHandler): () => void;

  /**
   * Dispose animator and clean up
   */
  dispose(): void;
}
